# ecosystem-tests-runner handoff
## Scope
Phase 4.37 read-only audit for formal visual evidence manifest closure in `C:\Users\maxib\GTE BOT\wtc_ecosystem_platform`.

Scope inspected: root visual evidence script wiring, retained visual artifact checker behavior, acceptance/deployment docs, CI upload policy, retained-visual tests, current screenshot inventory shape, and the existing retained-visual manifest. No code, test, config, schema, runtime, worker, provider, exchange, bot-control, SSH, deploy, live server, or production state was intentionally changed. The only intentional write is this required handoff.

Current checkout state observed before this handoff: branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` with a large pre-existing dirty worktree. This lane did not touch those pre-existing modified/untracked files.

## Files inspected
- `AGENTS.md` - session/agent protocol supplied by operator and present in repo.
- `docs/SESSION_PROTOCOL.md:52-57` - final reports must list exact gates run/not run and must not claim green gates unless observed green in-session.
- `package.json:36-49` - root script wiring, including `evidence:visual`.
- `scripts/check-retained-visual-artifacts.mjs:10-14` - default roots and image/blocked artifact classes.
- `scripts/check-retained-visual-artifacts.mjs:16-25` - required review marker labels.
- `scripts/check-retained-visual-artifacts.mjs:64-75` - workspace-local path confinement.
- `scripts/check-retained-visual-artifacts.mjs:108-127` - `--inventory` and `--manifest` argument parsing.
- `scripts/check-retained-visual-artifacts.mjs:161-170` - visual review manifest loading and shape limits.
- `scripts/check-retained-visual-artifacts.mjs:185-243` - manifest validation, required labels, OCR sidecars, and missing-image failures.
- `scripts/check-retained-visual-artifacts.mjs:306-327` - inventory mode and no-manifest fail-closed behavior.
- `scripts/check-retained-visual-artifacts.mjs:337-348` - manifest validation pass/fail output.
- `docs/ACCEPTANCE_MATRIX_MASTER.md:21-40` - global gate suite and retained visual artifact acceptance definition.
- `docs/ACCEPTANCE_MATRIX_MASTER.md:108-117` - retained screenshots require the separate visual-artifact review gate.
- `docs/DEPLOYMENT.md:292-317` - retained visual artifact runbook and manifest requirements.
- `docs/STATUS.md:17-20` - current status keeps formal visual manifest acceptance NOT GREEN/NOT RUN.
- `docs/STATUS.md:233-249` - Phase 3.55 visual policy says inventory is not acceptance and screenshot acceptance manifest remains not run.
- `docs/NEXT_ACTIONS.md:230-238` - retained visual policy summary and still-not-run screenshot acceptance.
- `docs/IMPLEMENTED_FILES.md:292-304` - script/test/CI policy summary for retained visual artifacts.
- `.github/workflows/ci.yml:134-157` - CI inventories screenshots and validates/uploads reviewed visual manifests only.
- `.gitignore:20-22` - `logs/` and `logs/retained-visual-artifacts/` are ignored generated evidence paths.
- `tests/integration/retained-visual-artifacts.test.ts:83-110` - no-manifest fail-closed, inventory, and passing manual manifest coverage.
- `tests/integration/retained-visual-artifacts.test.ts:121-147` - missing-image and OCR-sidecar secret refusal coverage.
- `tests/integration/retained-visual-artifacts.test.ts:149-170` - dynamic marker label and unsafe path coverage.
- `tests/integration/retained-visual-artifacts.test.ts:252-270` - root script and CI upload guard assertions.
- `docs/handoffs/20260602-1444-phase-3-55-retained-visual-artifact-policy.md:43-76` - original visual policy closure and known not-run gates.
- `docs/handoffs/20260604-2010-phase-4-35-bot-statistics-rendered-proof.md:30-63` - Phase 4.35 rendered proof, inventory-only result, and missing formal manifest.
- `logs/retained-visual-artifacts/20260602-1713-lms-db/visual-review.json:1-23` - existing one-image LMS visual review manifest.
- `tests/e2e/screenshots/` - current file inventory metadata only; this audit did not inspect image pixels.

## Files changed
None - read-only audit except this required handoff:
- `docs/handoffs/20260604-2055-visual-evidence-manifest-auditor.md`

## Findings
1. Severity P1 - The current screenshot inventory is not formal visual acceptance. Evidence: `docs/ACCEPTANCE_MATRIX_MASTER.md:37-40` defines e2e screenshots as generated evidence but says screenshot safety is not proven by e2e alone, and retained visual artifacts require `npm run evidence:visual -- --manifest <visual-review.json> <artifact-roots>`; `docs/DEPLOYMENT.md:298-314` says `--inventory` is not acceptance and the acceptance gate is manifest-backed; `scripts/check-retained-visual-artifacts.mjs:306-327` exits successfully for inventory mode but fails retained images without a manifest; Phase 4.35 explicitly recorded inventory-only PASS and formal visual manifest NOT RUN at `docs/handoffs/20260604-2010-phase-4-35-bot-statistics-rendered-proof.md:35`, `:56`, and `:62`. Recommendation: do not close Phase 4.37 from the 107-image inventory alone; create/validate a reviewed visual manifest before any formal visual acceptance claim. Target part: formal visual evidence closure.
2. Severity P1 - Full-root closure requires a manifest entry for every retained image in `tests/e2e/screenshots`; the existing LMS manifest cannot close the current screenshot root. Evidence: `scripts/check-retained-visual-artifacts.mjs:239-241` adds a failure for every scanned image missing from the manifest; `tests/integration/retained-visual-artifacts.test.ts:121-130` proves omitted retained images fail; current Phase 4.35 inventory recorded 107 images at `docs/handoffs/20260604-2010-phase-4-35-bot-statistics-rendered-proof.md:35` and `:56`; the only existing retained manifest inspected covers just `tests/e2e/screenshots/lms-db-material-lesson-lms-db-mobile.png` at `logs/retained-visual-artifacts/20260602-1713-lms-db/visual-review.json:3-20`. Recommendation: either generate/update a new manifest covering all 107 images for the full root, or pass exact reviewed screenshot paths and report closure only for that subset. Target part: manifest scope.
3. Severity P2 - The manifest is not just a file list; each artifact must carry explicit pass review metadata and required marker labels. Evidence: required marker labels are defined at `scripts/check-retained-visual-artifacts.mjs:16-25`; validation requires `result: "pass"`, `method: "manual"` or `"ocr"`, safe `reviewer`, ISO `reviewedAt`, and all required labels at `scripts/check-retained-visual-artifacts.mjs:211-219`; docs list the same JSON requirements at `docs/DEPLOYMENT.md:306-313`; the passing manual-review test uses the expected shape at `tests/integration/retained-visual-artifacts.test.ts:58-67` and `:102-110`. Recommendation: generate the manifest only after manual or OCR review of the retained screenshots, and include every required label per artifact. Target part: visual review manifest quality.
4. Severity P2 - OCR sidecars and dynamic markers are optional but become binding when used or configured. Evidence: OCR sidecars are read and scanned for forbidden text at `scripts/check-retained-visual-artifacts.mjs:221-230`; tests prove OCR sidecar DSN values fail without echoing the secret at `tests/integration/retained-visual-artifacts.test.ts:132-147`; dynamic marker labels are added to the required label set at `scripts/check-retained-visual-artifacts.mjs:181-183`; tests prove missing dynamic marker labels fail without printing marker values at `tests/integration/retained-visual-artifacts.test.ts:149-166`. Recommendation: if `LMS_DB_E2E_DYNAMIC_MARKERS_PATH` is set for the validation run, add those `dynamic marker <label>` entries to each reviewed artifact; if OCR sidecars are supplied, ensure they are workspace-local plain files and scanner-clean. Target part: OCR/dynamic-marker safety.
5. Severity P2 - CI and git hygiene do not create closure automatically. Evidence: CI inventories retained screenshots at `.github/workflows/ci.yml:134-136`, skips manifest validation/upload when no manifest exists at `.github/workflows/ci.yml:138-147`, validates only discovered `logs/retained-visual-artifacts/**/visual-review*.json` manifests at `.github/workflows/ci.yml:148-150`, and uploads only manifest files at `.github/workflows/ci.yml:152-157`; tests assert CI does not upload raw `tests/e2e/screenshots/**` at `tests/integration/retained-visual-artifacts.test.ts:261-270`; `.gitignore:20-22` ignores generated logs/manifests. Recommendation: treat the visual manifest as a generated evidence artifact that must be intentionally created and archived/attached by the operator; do not expect CI inventory or git tracking to preserve it by default. Target part: evidence retention and CI upload boundary.

## Decisions
- The current screenshot inventory is not enough for formal visual manifest closure.
- Formal closure requires a generated or updated `visual-review.json` under a workspace-local path, preferably `logs/retained-visual-artifacts/20260604-2055-bot-admin-local/visual-review.json`, followed by a passing `npm run evidence:visual -- --manifest ...` run.
- No product/code/test/script edits are needed for closure. The only needed generation is evidence data: the visual review manifest, plus optional OCR sidecar text files if OCR review is used.
- Full-root closure means every current image under `tests/e2e/screenshots` is reviewed and listed. A subset manifest is allowed only when the command roots are the exact reviewed screenshot paths and the report calls it subset visual evidence, not full screenshot-root acceptance.
- The existing `logs/retained-visual-artifacts/20260602-1713-lms-db/visual-review.json` remains useful for the single LMS DB screenshot only; it is not reusable as a 107-image root closure manifest.

## Risks
- Auto-generating `result: "pass"` entries before real manual/OCR review would fabricate evidence. Review first, then generate the manifest.
- Manual review manifests are accepted by the checker but are not OCR proof; report them as manual review evidence, consistent with `docs/DEPLOYMENT.md:312-313` and `docs/handoffs/20260602-1444-phase-3-55-retained-visual-artifact-policy.md:50-55`.
- Full-root review can accidentally mix screenshots from many historical phases. If the operator only needs Phase 4.35 bot statistics proof, prefer a scoped manifest over the four new `bot-statistics-*-dedicated-*` screenshots and call the scope explicitly.
- Because `logs/` is ignored, a generated manifest can be lost unless the operator archives or attaches it with the phase evidence package.
- Do not archive unreviewed screenshots, failure screenshots, videos, traces, compressed reports, or visual artifacts from real operator data; `docs/DEPLOYMENT.md:315-317` keeps that boundary explicit.

## Verification/tests
RUN in this read-only audit:
- `git status --short --branch` - observed branch `codex/bot-analytics-settings-canary-20260603...origin/codex/bot-analytics-settings-canary-20260603` and a large pre-existing dirty worktree.
- `rg -n "retained-visual|evidence:visual|visual-review|--manifest|--inventory|screenshot acceptance|formal visual|visual manifest" .github package.json scripts docs tests` - located script, docs, tests, CI, and handoff evidence.
- Read-only line inspection with `Get-Content` over the files listed in `## Files inspected`.
- `Get-ChildItem -Recurse -File tests\e2e\screenshots` - observed 107 current PNG files plus `.gitkeep`.
- `Get-ChildItem -Recurse -File logs\retained-visual-artifacts` - observed only the existing LMS one-image manifest.
- `git check-ignore -v logs/retained-visual-artifacts/example/visual-review.json` - observed `logs/` ignore coverage via `.gitignore:20`.

NOT RUN in this audit:
- `npm run evidence:visual -- --inventory tests/e2e/screenshots` - not rerun; Phase 4.35 already recorded this as PASS inventory-only, and this lane stayed to read-only inspection plus file metadata count.
- `npm run evidence:visual -- tests/e2e/screenshots` - not run; expected fail-closed by `scripts/check-retained-visual-artifacts.mjs:322-327` with `review manifest required for 107 image file(s)` in the current inventory.
- `npm run evidence:visual -- --manifest ... tests/e2e/screenshots` - not run/not green; no 107-image reviewed manifest exists or was generated in this lane.
- Vitest, lint, typecheck, build, Playwright/e2e, governance, secret scan, DB generate/migrate, worker continuity, admin-user DB matrix, live provider/exchange probes, live bot control, deploy, SSH/tmux/systemd, GitHub CI, and production monitoring - not run because the requested scope was read-only visual-manifest audit.

## Next actions
1. Optional scope confirmation, safe read-only command:

```powershell
npm run evidence:visual -- --inventory tests/e2e/screenshots
```

Expected output with the current root and no dynamic marker env set:

```text
# retained visual artifact inventory - 107 image file(s), 0 blocked binary/container artifact(s), 0 missing root(s), 108 total artifact file(s), 0 dynamic marker(s)
```

2. Optional fail-closed proof, safe read-only command:

```powershell
npm run evidence:visual -- tests/e2e/screenshots
```

Expected result: exit code `1`, starting with:

```text
# retained visual artifact check failed - review manifest required for 107 image file(s)
FAIL tests/e2e/screenshots/admin-audit-log-mobile375.png: missing visual review manifest
```

3. Review the retained screenshots. For full screenshot-root closure, review all 107 PNGs under `tests/e2e/screenshots`. For scoped Phase 4.35 bot-statistics closure, review only the intended `bot-statistics-*-dedicated-*` screenshots and validate only those paths.

4. After real manual review is complete, generate the full-root manifest. This is the required evidence generation, not a product/code edit:

```powershell
$runId = "20260604-2055-bot-admin-local"
$manifestDir = "logs/retained-visual-artifacts/$runId"
New-Item -ItemType Directory -Force -Path $manifestDir | Out-Null

$reviewedAt = (Get-Date).ToUniversalTime().ToString("o")
$labels = @(
  "secret-like text",
  "Postgres URL or DSN",
  "session or auth token",
  "cookie or authorization header",
  "raw public IP URL",
  "signed object URL token",
  "LMS internal storage or metadata",
  "Stripe or provider token"
)

$root = (Get-Location).Path
$artifacts = Get-ChildItem -Path tests/e2e/screenshots -Recurse -File -Include *.png,*.jpg,*.jpeg,*.webp,*.gif,*.ico |
  Sort-Object FullName |
  ForEach-Object {
    [pscustomobject]@{
      path = ($_.FullName.Substring($root.Length + 1) -replace "\\", "/")
      result = "pass"
      method = "manual"
      reviewer = "operator-manual-review"
      reviewedAt = $reviewedAt
      reviewedMarkerLabels = $labels
      notes = "Manual visual review completed for plaintext secrets, DB URLs, session/auth/cookie tokens, raw public IP URLs, signed object URL tokens, LMS internal metadata, Stripe/provider tokens, and visible layout blockers."
    }
  }

[pscustomobject]@{
  version = 1
  generatedAt = $reviewedAt
  artifacts = $artifacts
} | ConvertTo-Json -Depth 8 | Set-Content -Path (Join-Path $manifestDir "visual-review.json") -Encoding UTF8
```

5. Validate the generated manifest:

```powershell
npm run evidence:visual -- --manifest logs/retained-visual-artifacts/20260604-2055-bot-admin-local/visual-review.json tests/e2e/screenshots
```

Expected output for full-root manual review with no OCR sidecars and no dynamic marker env:

```text
# retained visual artifact check passed - 107 image file(s), 107 reviewed artifact(s), 0 OCR sidecar(s), 0 dynamic marker(s)
```

6. If OCR is required, generate workspace-local OCR sidecars, set `method: "ocr"` and `ocrTextPath` per OCR-reviewed artifact, then expect the same validation command to report the OCR sidecar count instead of `0 OCR sidecar(s)`.
