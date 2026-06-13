# DEPLOY_RUNBOOK.md — WTC ecosystem canary deploy (Tortila premium pages)

**Owner doc for the deploy agent.** This is the exact, copy-pasteable procedure to ship the new statistics + settings pages to the live canary, with backup + health-check + rollback. All facts below were confirmed via read-only SSH recon on **2026-06-13**.

> **DO NOT run any of this until the build agent has merged the premium stats + settings work and you have the target commit SHA.** The recon was read-only; this runbook is the write path. Read it fully first.

---

## 0. Confirmed topology (recon facts)

- **Edge:** nginx `:443`, vhost `wtc.54.179.188.61.nip.io` (file `/etc/nginx/sites-enabled/wtc-ecosystem-canary`) → `proxy_pass http://127.0.0.1:8301` (HTTP/1.1, upgrade headers, 60s read timeout). Certbot-managed TLS. `:80` → 301 → `:443`.
- **App container:** `wtc-ecosystem-canary`
  - image `node:22-bookworm` (node v22.22.3 / npm 10.9.8 inside)
  - `--network host`, `--restart unless-stopped`, workdir `/app`
  - entrypoint `docker-entrypoint.sh` (stock), CMD `npm run start -w @wtc/web -- --hostname 127.0.0.1 --port 8301`
  - **bind mount:** `<RELEASE_DIR>:/app`
  - **CMD runs `next start` → the release dir MUST contain a prebuilt `apps/web/.next` before the container starts.**
- **Worker container:** `wtc-ecosystem-worker` — same image / `--network host` / `--restart unless-stopped`, CMD `bash -lc "npm run start -w @wtc/worker"`, same bind mount `<RELEASE_DIR>:/app`.
- **NOT docker-compose managed.** The only `docker-compose.yml` in the repo is local-dev postgres (`wtc_postgres`) and does not deploy anything. Both containers are raw `docker run` with `--env-file`. (Compose labels on the containers are empty — confirmed.)
- **Release root:** `/home/ubuntu/apps/wtc_ecosystem_platform_releases/`
  - **CURRENT (live now):** `20260606-0213-abe6784-phase474-main` (git SHA `abe6784`, phase 474 — this is PRE the premium PR #17).
  - **ROLLBACK target (last known-good before current):** `20260605-203900-3aff273-phase467-picker`.
  - Releases are immutable timestamped dirs `YYYYMMDD-HHMM[SS]-<sha>-<phase>-<tag>`. There is no `current` symlink — the live release is whatever the running container is bind-mounted to.
- **Env file (server-side secret, per release):** `<RELEASE_DIR>/.env.canary.live` (mode `0600`, owner `ubuntu`). Contains `JOURNAL_READ_TOKEN` (present, confirmed), `TORTILA_JOURNAL_URL`, `BOT_ADAPTER_MODE=read-only`, `DATABASE_URL`, `SESSION_SECRET`, `SECRET_VAULT_KEK`, `FEATURE_LIVE_BOT_CONTROL=false`, etc. **This file is NOT in git — it must be copied into every new release dir before build/migrate/start.**
- **Journal (data source the canary reads):** `http://127.0.0.1:8080` — healthy, returns `401` without bearer (expected), `200`+data with the token. Reachable from inside the canary container (`journal_from_canary=401` = auth wall reached). Do not touch the journal during this deploy.
- **DB:** `DATABASE_URL` → postgres `wtc_platform_canary_20260602_1412` on `127.0.0.1:5432`. Migrations run via `npm run db:migrate -w @wtc/db`.
- **SSH (recon + deploy):** `ssh -i "C:\Users\maxib\GTE BOT\keys\key_server_bot_singapur.pem" -o StrictHostKeyChecking=no ubuntu@54.179.188.61 "<CMD>"`. Disk: 58G free on `/` — ample.

Set these shell vars on the server for the whole procedure (fill `NEW_SHA` from the merged build commit):

```bash
RELEASES=/home/ubuntu/apps/wtc_ecosystem_platform_releases
CURRENT_DIR=$RELEASES/20260606-0213-abe6784-phase474-main      # live now (rollback-to-this if build fails before swap)
ROLLBACK_DIR=$RELEASES/20260605-203900-3aff273-phase467-picker  # prior known-good
NEW_SHA=<short-sha-of-merged-premium-commit>
TS=$(date -u +%Y%m%d-%H%M%S)
NEW_DIR=$RELEASES/${TS}-${NEW_SHA}-tortila-premium-main
REPO=/home/ubuntu/apps/wtc_ecosystem_platform                   # git working copy to cut the release from
```

---

## 1. Pre-flight (read-only — verify before changing anything)

```bash
# Containers up, on the current release
docker ps --format '{{.Names}}\t{{.Status}}' | grep wtc-ecosystem
docker inspect wtc-ecosystem-canary --format 'release={{range .Mounts}}{{.Source}}{{end}} cmd={{json .Config.Cmd}}'

# Canary serving + journal healthy
curl -s -o /dev/null -w 'canary_root=%{http_code}\n' http://127.0.0.1:8301/
curl -s -o /dev/null -w 'stats=%{http_code}\n'       http://127.0.0.1:8301/app/bots/statistics   # 307 (auth redirect) is healthy
curl -s -o /dev/null -w 'journal=%{http_code}\n'     http://127.0.0.1:8080/                       # 200

# Rollback dir still exists and has a built .next (so rollback is instant)
ls -d "$ROLLBACK_DIR" && ls "$ROLLBACK_DIR/apps/web/.next" >/dev/null 2>&1 && echo "rollback .next OK"
# Env secret present in the CURRENT release (we will copy it forward)
sudo test -f "$CURRENT_DIR/.env.canary.live" && echo "env present"; sudo stat -c '%a %U' "$CURRENT_DIR/.env.canary.live"
```

Abort if any container is not `Up`, the journal is not `200`, or the rollback `.next` is missing.

---

## 2. Backup

The deploy is dir-immutable (new release dir, old one untouched) — that IS the primary backup. Additionally snapshot the DB and record the live state so rollback is one command.

```bash
# 2a. Record exactly what is live now (paste this output into the deploy log)
docker inspect wtc-ecosystem-canary --format 'LIVE_RELEASE={{range .Mounts}}{{.Source}}{{end}}'
docker inspect wtc-ecosystem-worker --format 'LIVE_WORKER_RELEASE={{range .Mounts}}{{.Source}}{{end}}'

# 2b. DB backup (pre-migration). pg creds are in the env file; pull the DATABASE_URL safely:
DBURL=$(sudo grep -E '^DATABASE_URL=' "$CURRENT_DIR/.env.canary.live" | cut -d= -f2-)
mkdir -p "$RELEASES/_db_backups"
docker run --rm --network host -e PGURL="$DBURL" postgres:17-alpine \
  sh -lc 'pg_dump "$PGURL" --no-owner --format=custom' \
  > "$RELEASES/_db_backups/${TS}-pre-${NEW_SHA}.dump"
ls -lh "$RELEASES/_db_backups/${TS}-pre-${NEW_SHA}.dump"   # must be non-empty
```

> If the new code ships **no DB migration** (likely — these are UI-only pages), step 2b is precautionary; keep it anyway. If `npm run db:migrate` is a no-op, the dump is your safety net regardless.

---

## 3. Cut the new release dir at NEW_SHA

```bash
# 3a. Update the git working copy and check out the merged commit
git -C "$REPO" fetch --all --prune
git -C "$REPO" checkout "$NEW_SHA"
git -C "$REPO" rev-parse --short HEAD   # must equal $NEW_SHA

# 3b. Materialize an immutable release dir (clean copy, no .git churn, no node_modules/.next from the working copy)
mkdir -p "$NEW_DIR"
rsync -a --delete \
  --exclude '.git' --exclude 'node_modules' \
  --exclude '**/.next' --exclude '**/.turbo' \
  "$REPO/" "$NEW_DIR/"

# 3c. Copy the server-side secret env into the new release (REQUIRED — not in git)
sudo cp -p "$CURRENT_DIR/.env.canary.live" "$NEW_DIR/.env.canary.live"
sudo chown ubuntu:ubuntu "$NEW_DIR/.env.canary.live"; sudo chmod 600 "$NEW_DIR/.env.canary.live"
sudo test -f "$NEW_DIR/.env.canary.live" && echo "env copied"
```

---

## 4. Build + migrate INSIDE a throwaway container on the new release

Build with the same image the runtime uses, mounting the new dir at `/app`. This produces `apps/web/.next` in the release dir (which the long-running container then serves).

```bash
docker run --rm --network host \
  -v "$NEW_DIR":/app -w /app \
  --env-file "$NEW_DIR/.env.canary.live" \
  node:22-bookworm \
  bash -lc 'npm ci && npm run build -w @wtc/web && npm run db:migrate -w @wtc/db'
```

- This must exit `0`. Confirm artifacts: `ls "$NEW_DIR/apps/web/.next/BUILD_ID"`.
- If it fails: **stop here. Nothing is live-affected** — the running containers are still on `$CURRENT_DIR`. Investigate, fix, re-cut. No rollback needed (you never swapped).
- Build time on this box is a few minutes; run under `tmux`/`nohup` if your SSH session may drop.

---

## 5. Swap traffic: recreate both containers on the new release

nginx points at a fixed port (`8301`), so "deploy" = stop the old containers and `docker run` new ones bind-mounted to `$NEW_DIR`. The host-network + fixed port means the new canary immediately receives nginx traffic. Recreate the **worker** too (it shares the release dir).

```bash
# 5a. Stop + remove the current containers (release dirs remain on disk untouched)
docker stop wtc-ecosystem-canary wtc-ecosystem-worker
docker rm   wtc-ecosystem-canary wtc-ecosystem-worker

# 5b. Recreate the WEB canary on the new release (exact reconstruction of the live spec)
docker run -d --name wtc-ecosystem-canary \
  --network host --restart unless-stopped \
  -v "$NEW_DIR":/app -w /app \
  --env-file "$NEW_DIR/.env.canary.live" \
  node:22-bookworm \
  npm run start -w @wtc/web -- --hostname 127.0.0.1 --port 8301

# 5c. Recreate the WORKER on the new release
docker run -d --name wtc-ecosystem-worker \
  --network host --restart unless-stopped \
  -v "$NEW_DIR":/app -w /app \
  --env-file "$NEW_DIR/.env.canary.live" \
  node:22-bookworm \
  bash -lc 'npm run start -w @wtc/worker'
```

> The image's stock `docker-entrypoint.sh` is applied automatically (it's the `node:22-bookworm` default entrypoint) — do not pass `--entrypoint`. Passing the env via `--env-file` reproduces the confirmed live env (the recon showed the live container's env matches `.env.canary.live`, incl. the journal token).

---

## 6. Health-check (must pass before you walk away)

```bash
# 6a. Containers came up and stayed up
sleep 5; docker ps --format '{{.Names}}\t{{.Status}}' | grep wtc-ecosystem
docker inspect wtc-ecosystem-canary --format 'on={{range .Mounts}}{{.Source}}{{end}}'   # must be $NEW_DIR

# 6b. Next server is listening + routes healthy (poll up to ~60s for first boot)
for i in $(seq 1 12); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8301/ || true)
  echo "try $i root=$code"; [ "$code" = "200" ] && break; sleep 5
done
curl -s -o /dev/null -w 'stats=%{http_code}\n' http://127.0.0.1:8301/app/bots/statistics   # expect 200 or 307
curl -s -o /dev/null -w 'edge=%{http_code}\n'  -k https://wtc.54.179.188.61.nip.io/         # through nginx, expect 200

# 6c. Logs clean (no crash loop, no missing-env, no journal auth failure)
docker logs --since 2m wtc-ecosystem-canary 2>&1 | tail -40
docker logs --since 2m wtc-ecosystem-worker 2>&1 | tail -40
```

**Pass criteria:** both containers `Up`; canary mount == `$NEW_DIR`; `http://127.0.0.1:8301/` → `200`; `/app/bots/statistics` → `200|307`; edge HTTPS → `200`; no repeating errors in logs. Then do a human eyeball: log in, open `/app/bots/statistics?bot=tortila` and `/app/bots/tortila/settings`, confirm the premium pages render with live numbers and none of the deleted noise panels.

---

## 7. ROLLBACK (if health-check fails or the pages look wrong)

Rollback = recreate both containers on the previous release dir. Instant, because the old release still has its built `.next`.

```bash
# Roll back to the immediately-prior live release ($CURRENT_DIR = the abe6784 phase474 release running before this deploy)
ROLLBACK_TO="$CURRENT_DIR"     # or "$ROLLBACK_DIR" (3aff273 phase467) if the current one is also suspect

docker stop wtc-ecosystem-canary wtc-ecosystem-worker
docker rm   wtc-ecosystem-canary wtc-ecosystem-worker

docker run -d --name wtc-ecosystem-canary \
  --network host --restart unless-stopped \
  -v "$ROLLBACK_TO":/app -w /app --env-file "$ROLLBACK_TO/.env.canary.live" \
  node:22-bookworm \
  npm run start -w @wtc/web -- --hostname 127.0.0.1 --port 8301

docker run -d --name wtc-ecosystem-worker \
  --network host --restart unless-stopped \
  -v "$ROLLBACK_TO":/app -w /app --env-file "$ROLLBACK_TO/.env.canary.live" \
  node:22-bookworm \
  bash -lc 'npm run start -w @wtc/worker'

# Re-run §6 health checks. Then, only if a migration was applied and is incompatible, restore the DB dump:
#   docker run --rm --network host -e PGURL="$DBURL" -v "$RELEASES/_db_backups":/b postgres:17-alpine \
#     sh -lc 'pg_restore --clean --no-owner -d "$PGURL" /b/'"${TS}-pre-${NEW_SHA}.dump"
```

> DB restore is last-resort and only relevant if step 4's migration changed schema in a breaking way. For UI-only changes (expected here) rollback is just the container swap above; leave the DB alone.

---

## 8. Post-deploy

- Paste into the deploy log: `NEW_DIR`, `NEW_SHA`, build exit code, all §6 health codes, and the `LIVE_RELEASE` from §2a (so the next deploy knows the new rollback target).
- Leave the previous release dir (`$CURRENT_DIR`) and the DB dump in place as the rollback point. Prune only releases older than the last 3–4 known-good dirs, and never the one a container is mounted on.
- Optional: record the deploy as a `docs:` commit on a `codex/phase-XXX-canary-deploy-<sha>` branch to match the repo's existing deploy-record convention (see prior `82903be docs: record phase 4.74 canary deploy`).

---

## Safety verdict

**A direct server-side canary deploy IS safe here, with rollback,** because: (1) releases are immutable dirs — the old build is never mutated; (2) the build runs in a throwaway container and never touches live traffic until §5; (3) rollback is a sub-minute container swap onto a dir whose `.next` is already built; (4) nginx is a fixed-port reverse proxy, so no nginx edit is needed and there's nothing to misconfigure at the edge; (5) the journal data source and the `.env.canary.live` secret are untouched and carried forward verbatim. The only irreversible-ish step is a breaking DB migration — mitigated by the §2b pre-migration dump and the fact these pages are UI-only.
