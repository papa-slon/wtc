# governance-enforcement-auditor handoff

## Scope
Phase 1.6 Task A (read-only design audit). Specify exactly what the mechanical governance checker
`scripts/check-governance.mjs` (Node ESM, zero deps, fs-only — NOT git; discover handoffs via the
filesystem) must validate, how it splits STRICT (error/exit 1) vs INFORMATIONAL (warn/exit 0)
behaviour, and how it wires into `npm run governance:check`, the `ci:local` composite, and
`.github/workflows/ci.yml`. No code was written; this is the implementable spec for Task B.
Authoritative inputs: AGENTS.md, docs/SESSION_PROTOCOL.md, docs/handoffs/0000-orchestrator-seed.md,
docs/STATUS.md, docs/IMPLEMENTED_FILES.md, docs/NEXT_ACTIONS.md, and the latest aggregate handoff.

## Files inspected
- AGENTS.md (roster, §"Session & phase protocol", §"Handoff format")
- docs/SESSION_PROTOCOL.md (preamble + §1-§9; canonical headings = §7)
- docs/STATUS.md
- docs/IMPLEMENTED_FILES.md
- docs/NEXT_ACTIONS.md
- docs/handoffs/0000-orchestrator-seed.md
- docs/handoffs/20260529-1921-phase-1-5-governance-persistence-hardening.md (current aggregate)
- docs/handoffs/20260529-1921-integration-risk-auditor.md (suspected drift — read in full)
- docs/handoffs/20260529-acceptance-hardening.md
- docs/handoffs/20260529-phase1-persistence-hardening.md
- package.json (scripts, esp. `ci:local`, `check:core`, `secret:scan`)
- .github/workflows/ci.yml (existing step order)
- Full enumeration of docs/handoffs/ (25 files) via Glob + read-only `ls`
- Heading inventory of all handoffs via Grep `^## ` (line-numbered)
- Filesystem checks: scripts/ (ABSENT), packages/ (present, 16 pkgs), apps/ (present: web, worker)

## Files changed
None — read-only audit

## Findings

### F1 — Handoff enumeration + aggregate/per-agent classification (severity: INFO, baseline fact)
docs/handoffs/ contains exactly 25 files. Classified by filename:
- AGGREGATE / phase handoffs (match `^\d{8}-\d{4}-phase.*\.md$`): exactly ONE —
  `20260529-1921-phase-1-5-governance-persistence-hardening.md`.
  (Note: `20260529-phase1-persistence-hardening.md` and `20260529-phase0-*.md` contain the
  substring "phase" but have NO `-\d{4}-` time component, so they do NOT match the aggregate
  pattern — see Decisions D1 for why the time component must be required.)
- PER-AGENT handoffs at the current epoch `20260529-1921` (9 files): `…-governance-session-protocol-auditor.md`,
  `…-docs-contracts-drift-auditor.md`, `…-db-postgres-persistence-auditor.md`,
  `…-security-auth-secrets-auditor.md`, `…-frontend-product-truth-auditor.md`,
  `…-qa-ci-e2e-auditor.md`, `…-integration-risk-auditor.md`, `…-docs-drift-fixer.md`,
  `…-ci-devops-implementer.md`.
- HISTORICAL / grandfathered (15 files): `0000-orchestrator-seed.md`,
  `20260529-acceptance-hardening.md`, `20260529-phase1-persistence-hardening.md`,
  `20260529-tests-runner.md`, and 12 `20260529-phase0-*.md` per-agent handoffs.
- evidence: Glob `docs/handoffs/*.md` (25 results); `ls -la docs/handoffs/`.
- recommendation: implement the classifier exactly per D1. This finding is the baseline the rest
  of the checker is built on.

### F2 — Current aggregate's per-agent citations ALL resolve on disk (severity: INFO — PASS)
CONTRARY to the prior-phase pattern, the CURRENT aggregate is clean. It cites 9 per-agent handoffs
as markdown links and every target exists:
- evidence (docs/handoffs/20260529-1921-phase-1-5-governance-persistence-hardening.md):
  - :16 `](20260529-1921-governance-session-protocol-auditor.md)` -> EXISTS
  - :17 `](20260529-1921-docs-contracts-drift-auditor.md)` -> EXISTS
  - :18 `](20260529-1921-db-postgres-persistence-auditor.md)` -> EXISTS
  - :19 `](20260529-1921-security-auth-secrets-auditor.md)` -> EXISTS
  - :20 `](20260529-1921-frontend-product-truth-auditor.md)` -> EXISTS
  - :21 `](20260529-1921-qa-ci-e2e-auditor.md)` -> EXISTS
  - :22 `](20260529-1921-integration-risk-auditor.md)` -> EXISTS
  - :25 `](20260529-1921-docs-drift-fixer.md)` -> EXISTS
  - :26 `](20260529-1921-ci-devops-implementer.md)` -> EXISTS
- IMPORTANT correction: the links are RELATIVE (`](20260529-1921-…md)`), not `docs/handoffs/…`.
  A naive `docs/handoffs/[\w.-]+\.md` regex would MISS all of these (it would find only the
  `docs/handoffs/...` paths in the "## Files changed" prose). The citation extractor MUST resolve
  links relative to the aggregate file's own directory and also accept bare filenames.
- recommendation: `validateAggregateCitations()` extracts BOTH `](<target>)` markdown link targets
  AND inline `docs/handoffs/<name>.md` paths, normalises each to a path under docs/handoffs/, and
  `fs.existsSync()` each (excluding the aggregate's own filename). ERROR per missing file.
- concrete target fix (Task B): regex set =
  `/\]\(([^)]+\.md)\)/g` (link form) + `/docs\/handoffs\/([\w.-]+\.md)/g` (path form); map link
  targets through `path.resolve(path.dirname(aggregate), target)`; dedupe; check existence. Today
  this validator passes with 0 errors — it is a regression guard, not a current failure.

### F3 — Numeric "N-agent / N-auditor" claims: current claim IS backed; unbacked claims are HISTORICAL + already annotated (severity: MEDIUM)
- evidence (current, BACKED): docs/handoffs/20260529-1921-phase-1-5-governance-persistence-hardening.md:3
  `**7-agent read-only audit** + **2 disjoint implementation agents**`; :15 `7 read-only auditors`;
  :52 `47 findings across the 7 auditors`. Backing files at epoch 20260529-1921 = 9 (7 auditors at
  lines 16-22 + 2 implementers at lines 25-26). 7 auditor files + 2 implementer files all exist
  (F2). So N=7 auditors is backed and N=9 total agents is backed. PASS.
- evidence (historical, UNBACKED but corrected):
  - docs/handoffs/20260529-phase1-persistence-hardening.md:3 `covering 6 areas (...66 findings)` —
    annotated at :8-:11 "per-agent handoff files were **not** retained ... read '6-agent audit' as
    6 review areas". No per-agent files for this claim exist.
  - docs/handoffs/20260529-acceptance-hardening.md:5-6 `covering 5 areas` — annotated at :9-:12
    likewise. No per-agent files exist.
  - docs/STATUS.md:28 restates the "6-agent"/"5-auditor" claims as "N review areas in one session".
  - docs/SESSION_PROTOCOL.md:8-9 preamble explains exactly this history.
- INTERPRETATION: the dangerous unbacked numeric claims are confined to HISTORICAL handoffs and
  have already been explicitly downgraded to "N review areas" with honesty notes. The current
  phase does NOT repeat the violation. Therefore a checker that ERRORs on every numeric claim
  across all handoffs would FALSE-POSITIVE on already-corrected history.
- recommendation: enforce numeric agent/auditor claims STRICTLY only for the CURRENT-phase
  aggregate; treat matches in historical handoffs / STATUS / SESSION_PROTOCOL as INFORMATIONAL
  (WARN at most). For the current aggregate, compare claimed N to the count of per-agent files at
  the aggregate's epoch.
- concrete target fix (Task B): `validateAgentCountClaims()` — within the current aggregate only,
  scan for `/\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)[\s-]+(?:read-only\s+)?
  (agents?|auditors?)\b/i`, map words->ints, take the MAX claimed N adjacent to "auditor(s)",
  compare to `countPerAgentHandoffsForEpoch(epoch)`. ERROR only when claimed N exceeds files found.
  Skip lines that are obviously self-referential prose like "across the 7 auditors" by counting
  distinct numbers and comparing the max — current max (7 auditors / 9 agents) <= 9 files, so PASS.

### F4 — integration-risk-auditor heading-drift VERDICT (severity: MEDIUM) — CORRECTED
The task prompt suspected `## Files Inspected` / `## Changed Files` drift. That is NOT what is on
disk. Exact `##` headings of docs/handoffs/20260529-1921-integration-risk-auditor.md, verbatim with
line numbers:
- :5  `## Scope`                  (canonical OK)
- :36 `## Files changed`          (canonical OK — body line 38 is `None — read-only audit.`)
- :40 `## Findings`               (canonical OK)
- :156 `## Decisions`             (canonical OK)
- :162 `## Risks`                 (canonical OK)
- :172 `## Verification / tests`  (DRIFT — spaces around the slash; canonical is `## Verification/tests`)
- :179 `## Next actions`          (canonical OK)
Two real deviations, neither matching the prompt's guess:
1. NO standalone `## Files inspected` heading. The files-inspected list is folded into the Scope
   section as a prose label `Files inspected:` at line 14 (not a `##` heading). So the canonical
   heading `## Files inspected` is ABSENT.
2. `## Verification / tests` has spaces around `/`. A case-sensitive prefix match against
   `## Verification/tests` FAILS on this (`"## Verification / tests".startsWith("## Verification/
   tests")` is false), unless the normaliser strips spaces around `/`.
- evidence: docs/handoffs/20260529-1921-integration-risk-auditor.md:5,14,36,40,156,162,172,179.
- VERDICT: treat this file's heading drift as INFORMATIONAL (WARN, not ERROR). Rationale: it is an
  append-only Phase-1.5 artifact already merged and cited by the current aggregate; rewriting it
  would violate the append-only norm (AGENTS.md §"Session & phase protocol"). The drift is cosmetic
  (`## Verification / tests`) plus one structural omission (`## Files inspected` folded into Scope).
  Do NOT block CI on it. The clean path forward is: future handoffs (incl. THIS one and Task B's)
  use canonical headings; legacy ones are informational. (Alternative requiring human sign-off:
  a one-time normalisation note — see Risks R1.)
- concrete target fix (Task B): heading normaliser =
  `line.trim().replace(/\s*\/\s*/g, '/').replace(/\s+/g,' ')` then case-sensitive
  `startsWith(canonical)`. After this normalisation, `## Verification / tests` -> matches
  `## Verification/tests` (so it would actually PASS the prefix test — good). The only residual
  WARN for this file is the missing `## Files inspected` heading.

### F5 — Repo-wide canonical-heading drift inventory (severity: LOW, historical) — full scan
Scanning all 25 handoffs for the 8 canonical headings (SESSION_PROTOCOL.md §7:
`## Scope`, `## Files inspected`, `## Files changed`, `## Findings`, `## Decisions`, `## Risks`,
`## Verification/tests`, `## Next actions`), the following NON-canonical heading variants exist
(all in historical files; evidence = file:line from Grep `^## `):
- `## Files Inspected (Read-Only)` / `## Files Inspected (read-only)` — the 12 Phase-0 handoffs,
  e.g. 20260529-phase0-platform-architect.md:17, 20260529-phase0-ecosystem-security-auditor.md:15,
  20260529-phase0-ecosystem-db-architect.md:24 (capitalised + parenthetical suffix).
- `## Files Written` / `## Files written` / `## Files Changed / Written` / `## Files Changed / Created`
  / `## Files Changed (Written)` — Phase-0 handoffs in place of `## Files changed`,
  e.g. 20260529-phase0-ecosystem-product-architect.md:32, 20260529-phase0-ecosystem-backtester-architect.md:35,
  20260529-phase0-ecosystem-db-architect.md:33, 20260529-phase0-ecosystem-education-implementer.md:31,
  20260529-phase0-platform-architect.md:27.
- `## Tests / Verification` / `## Tests / verification` — Phase-0 handoffs + the seed in place of
  `## Verification/tests`, e.g. 0000-orchestrator-seed.md:155,
  20260529-phase0-bot-integration-auditor.md:132, 20260529-phase0-ecosystem-billing-access-auditor.md:92.
- `## Verification / tests` — 20260529-1921-integration-risk-auditor.md:172 (see F4).
- `## Files inspected / changed` (merged) + `## Tests / verification` —
  20260529-tests-runner.md:10,36.
- `## Findings addressed` + `## Tests / verification (observed)` —
  20260529-acceptance-hardening.md:14,38.
- The seed (0000-orchestrator-seed.md) is structurally different: no `## Files inspected`/`## Files
  changed`/`## Verification/tests`; it has bespoke sections (Discovery facts, Locked stack, etc.).
- The 8 current-epoch (20260529-1921-*) per-agent handoffs + the aggregate use the canonical
  headings by prefix (verified via the `^## ` grep) — EXCEPT integration-risk (F4). docs-drift-fixer
  uses `## Findings (what I changed + evidence file:line)` (20260529-1921-docs-drift-fixer.md:36) and
  ci-devops-implementer uses `## Findings (what you changed + evidence file:line)`
  (20260529-1921-ci-devops-implementer.md:27) — both PASS by PREFIX (`## Findings` + suffix), which
  is exactly why prefix-matching is required.
- recommendation: all of the above except the current-epoch files are HISTORICAL -> INFORMATIONAL
  (WARN). Only current-epoch handoffs are STRICT. This keeps CI green today while flagging legacy
  drift for visibility.
- concrete target fix (Task B): `validateHeadings(file)` collects `^##\s+(.*)$`, normalises (F4
  normaliser), and for each of the 8 canonical headings checks `someHeading.startsWith(canonical)`.
  Missing canonical headings -> ERROR if `isStrict(file)` else WARN. Extra headings are allowed (F7).

### F6 — Seed + sub-canonical-format historical handoffs predate the canonical format (severity: LOW)
- evidence: docs/handoffs/0000-orchestrator-seed.md has no `## Files inspected`, no `## Files
  changed`, no `## Verification/tests` (headings at :9,:14,:43,:56,…,:155,:159); filename prefix is
  `0000-`, not `\d{8}-\d{4}`. The 12 `20260529-phase0-*` files and `20260529-tests-runner.md` /
  `20260529-acceptance-hardening.md` / `20260529-phase1-persistence-hardening.md` similarly predate
  §7 (they have no `-\d{4}-` epoch).
- recommendation: grandfather any handoff whose filename does NOT match `^\d{8}-\d{4}-` out of
  STRICT mode entirely (heading checks become WARN). This cleanly exempts the seed and all Phase-0 /
  pre-1921 handoffs without an explicit allowlist.
- concrete target fix (Task B): `isStrict(file)` returns false unless
  `/^\d{8}-\d{4}-/.test(basename)` AND the epoch == current epoch (D3).

### F7 — Aggregate uses canonical headings + an extra section; checker must allow extra headings (severity: INFO)
- evidence: docs/handoffs/20260529-1921-phase-1-5-governance-persistence-hardening.md headings:
  :8 `## Scope`, :30 `## Files changed`, :52 `## Findings → fixes (47 findings across the 7 auditors)`,
  :69 `## Decisions`, :75 `## Risks`,
  :81 `## Verification/tests — gates RUN vs NOT RUN (per SESSION_PROTOCOL.md §6)`, :101 `## Next actions`,
  PLUS extra sections :14 `## Agents launched (all closed — see Verification)` and :97 `## Background
  agents — closed`. NOTE the aggregate has NO `## Files inspected` heading (it is an operator
  aggregate, not an auditor). So even the current aggregate would FAIL a strict "all 8 present"
  check on `## Files inspected`.
- recommendation: (a) the canonical set is a REQUIRED-SUBSET, never an exact-set — extra `##`
  sections (`## Agents launched`, `## Background agents`) must NOT error. (b) Aggregates legitimately
  omit `## Files inspected`; the checker must apply a RELAXED required-set to aggregates: aggregates
  require `## Scope`, `## Files changed`, `## Findings`, `## Decisions`, `## Risks`,
  `## Verification/tests`, `## Next actions` (7), NOT `## Files inspected`. Per-agent handoffs
  require all 8.
- concrete target fix (Task B): two required-sets — `REQUIRED_AGENT` (all 8) and
  `REQUIRED_AGGREGATE` (the 8 minus `## Files inspected`). Heading-ORDER is NOT enforced (the
  aggregate interleaves `## Agents launched` between Scope and Files changed); order is at most a
  WARN. `## Findings → fixes (...)` and `## Verification/tests — gates RUN...` PASS by prefix.

### F8 — `## Files changed` sentinel for read-only handoffs (severity: INFO)
- evidence: docs/handoffs/20260529-1921-integration-risk-auditor.md:38 body under `## Files changed`
  is `None — read-only audit.` (em dash, trailing period). SESSION_PROTOCOL.md §7 / AGENTS.md
  prescribe the sentinel "None — read-only audit". The 1921 auditor handoffs that DID change files
  (docs-drift-fixer, ci-devops-implementer) list real bullets instead.
- recommendation: the checker must NOT require file bullets under `## Files changed`, and must NOT
  treat the sentinel as "missing content". If any body validation is added, accept `none`
  (case-insensitive, dash-normalised, optional trailing period) as the empty marker.
- concrete target fix (Task B): if body validation is implemented, normalise dashes (`—`/`-`/`--`)
  and match `/^none\b/i`. RECOMMENDED v1 scope: heading-level validation only; defer body
  validation (low value, high false-positive risk).

### F9 — IMPLEMENTED_FILES "scripts must exist" invariant + missing scripts/ dir (severity: MEDIUM)
- evidence:
  - docs/IMPLEMENTED_FILES.md describes the staged CI and the build, and the Phase 1.6 plan promises
    a checker that verifies "if a script is listed, it exists on disk". The `scripts/` directory is
    ABSENT entirely (`ls scripts` -> No such file or directory).
  - package.json:25 `check:core` invokes `node --experimental-strip-types packages/*/src/__smoke__.ts`
    (seven package smoke files — NOT `scripts/*`), and :17 `secret:scan` is `secretlint "**/*"`.
    CORRECTION to the Task A brief: there is NO `scripts/check-core.mjs` or `scripts/scan-secrets.mjs`
    referenced anywhere; the brief's example paths do not exist in package.json. The only script the
    checker itself introduces is `scripts/check-governance.mjs` (created by Task B).
- recommendation: a `validateScriptReferences()` check is LOW-RISK here precisely because almost
  nothing references `scripts/*` today: scan package.json `scripts.*` values and the
  IMPLEMENTED_FILES doc for `scripts/[\w.-]+\.(mjs|js|ts)` tokens and ERROR if absent. Once Task B
  lands `scripts/check-governance.mjs`, the lone self-reference passes. This is a cheap regression
  guard against future "documented but missing" scripts.
- concrete target fix (Task B): optional `validateScriptReferences()` as above. Because the brief's
  assumed `check-core.mjs`/`scan-secrets.mjs` do not actually exist, there is no day-one failure to
  worry about (contrast the earlier risk concern) — the check is safe to ship enabled.

## Decisions

### D1 — Handoff taxonomy (filename-based; no git, no front-matter)
- AGGREGATE/PHASE: `/^(\d{8})-(\d{4})-phase.*\.md$/` (time component REQUIRED, so `phase0`/`phase1`
  historical files without `-HHMM-` do NOT match). Current set = 1 file, epoch `20260529-1921`.
- PER-AGENT: `/^(\d{8})-(\d{4})-.*\.md$/` AND not an aggregate. Epoch = the `\d{8}-\d{4}` prefix.
- GRANDFATHERED/SEED: filename without a `\d{8}-\d{4}-` prefix (seed `0000-…`, all `phase0`/`phase1`,
  `tests-runner`, `acceptance-hardening`). Heading checks are INFORMATIONAL for these.

### D2 — "Current phase" determination
Newest aggregate by lexicographic max of its `\d{8}-\d{4}` prefix (zero-padded => string sort ==
chronological). That prefix is the CURRENT EPOCH. Provide `--phase <YYYYMMDD-HHMM>` CLI override for
re-auditing an older phase. If two aggregates share the max prefix, emit a WARN and use the first.
Current epoch on disk = `20260529-1921`.

### D3 — STRICT vs INFORMATIONAL split
- STRICT (push ERRORs, exit 1): (a) the current-phase aggregate, and (b) every per-agent handoff
  whose epoch == current epoch. Strict checks: aggregate citation existence (F2), numeric
  agent-count claim in the aggregate (F3), canonical-heading presence by normalised prefix
  (F4/F5/F7 — relaxed required-set for the aggregate per F7), and script-reference existence (F9).
- INFORMATIONAL (push WARNs, exit 0): every grandfathered handoff (D1), every handoff with an epoch
  OLDER than current, heading order, and extra headings. Heading drift here is WARN, never ERROR.
- BOUNDARY (F4): integration-risk-auditor shares the current epoch, so it is STRICT by (b). Its only
  potential strict failure after dash-normalisation is the missing `## Files inspected` heading.
  VERDICT/override: downgrade THIS file's heading drift to WARN via an explicit
  `KNOWN_HISTORICAL_DRIFT = new Set(["20260529-1921-integration-risk-auditor.md"])`, because it is an
  already-merged append-only artifact. Citation/other strict checks are unaffected (none apply to it
  as a per-agent handoff). Net effect: `governance:check` is GREEN on the current tree.

### D4 — Exit semantics / output / runtime
- Exit 1 iff `errors.length > 0`; else exit 0 (warnings allowed).
- Output: `ERROR <file>: <msg>` lines, then `WARN <file>: <msg>` lines, then a summary
  `governance:check — <E> error(s), <W> warning(s) (<n> handoffs, phase <epoch>)`. On full pass:
  `governance:check — OK (<n> handoffs scanned, current phase <epoch>, <W> historical warnings)`.
- Zero deps: only `node:fs`, `node:path`, `node:process`, `node:url`. ESM `.mjs`. Resolve repo root
  from `import.meta.url` so it runs from any cwd. Read `docs/handoffs/` with
  `fs.readdirSync(handoffDir)` and filter `*.md`. NEVER shell out to git.

### D5 — package.json wiring (exact)
- Add to `scripts`: `"governance:check": "node scripts/check-governance.mjs"`.
- Update `ci:local` to insert `governance:check` immediately after `check:core` (cheapest gate
  first, fail fast):
  `"ci:local": "npm run check:core && npm run governance:check && npm run lint && npm run typecheck && npm run typecheck -w @wtc/web && npm run secret:scan && npm test && npm run build -w @wtc/web"`

### D6 — CI workflow wiring (exact)
In .github/workflows/ci.yml, insert a new step in the `gates` job BETWEEN `Check core (smoke)`
(lines 44-45) and `Lint` (lines 47-48):
```yaml
      - name: Governance check
        run: npm run governance:check
```
Placement rationale: fs-only and the cheapest gate; failing fast before lint/typecheck/test/build
surfaces process violations first and saves CI minutes. (Do NOT add it to the separate `e2e` job.)

### D7 — v1 scope (avoid gold-plating)
v1 MUST implement: D1-D4 core, `validateAggregateCitations` (F2, link+path forms), heading
validation with normaliser + relaxed-aggregate required-set + KNOWN_HISTORICAL_DRIFT downgrade
(F4/F5/F7), `validateAgentCountClaims` for the current aggregate only (F3), and wiring (D5/D6).
v1 SHOULD implement `validateScriptReferences` (F9 — safe, no day-one failures). v1 MAY defer: F8
body validation and heading-order enforcement (keep as WARN).

## Risks
- R1 (human decision): F4 boundary. Either (a) ship the `KNOWN_HISTORICAL_DRIFT` allowlist
  (recommended; keeps history immutable) or (b) authorise a one-time normalisation of
  `20260529-1921-integration-risk-auditor.md` headings (`## Verification / tests` ->
  `## Verification/tests`, add `## Files inspected`). Option (b) edits a merged handoff, which is
  against the append-only norm and needs explicit operator sign-off. Until decided, ship (a).
- R2: F3 numeric-claim regex is heuristic. Mitigation: enforce ONLY inside the current aggregate and
  compare the MAX claimed N to the per-agent file count; treat STATUS.md / SESSION_PROTOCOL.md /
  historical-handoff numbers as INFORMATIONAL. The current aggregate's max (7 auditors / 9 agents)
  is <= 9 files, so it passes.
- R3: F2 link-resolution. The current aggregate uses RELATIVE link targets `](<name>.md)`, not
  `docs/handoffs/<name>.md`. A path-only regex would silently find 0 citations and vacuously PASS,
  hiding future unbacked claims. The extractor MUST handle both link form and path form (D5/F2).
- R4: "current phase" by filename timestamp breaks if an aggregate is added with a wrong/older
  timestamp, or two aggregates share the max prefix. Mitigation: `--phase` override + a WARN on
  duplicate max prefixes (D2).
- R5 (out of scope, FYI): the prior unbacked "6-agent"/"5-auditor" claims are confined to
  HISTORICAL handoffs and were already annotated as "N review areas" (F3) — the checker should not
  resurrect them as errors. Re-running those audits is neither required nor desirable; the honesty
  notes already discharge the violation. This differs from a live unbacked claim, which the checker
  WOULD error on.
- R6: packages/ has 16 workspaces and apps/ has web+worker (both present) — so the broader
  docs-vs-reality drift I initially feared does not exist; only `scripts/` is absent (expected; Task
  B creates it). No action needed beyond F9.

## Verification/tests
- Read-only design audit. Ran NO gates: did NOT run `npm run check:core`, `lint`, `typecheck`,
  `typecheck -w @wtc/web`, `secret:scan`, `test`, `coverage`, `e2e`, or `build`. Ran NO
  git/npm/install/build/migration commands and touched no live servers/bots/secrets.
- Verification = static inspection only: Read on the governance docs + package.json + ci.yml + the
  aggregate + integration-risk + the two historical phase handoffs; Glob on docs/handoffs (25 files),
  package.json, workflows; read-only `ls` of repo root, docs/, docs/handoffs/, scripts/ (absent),
  packages/ (16), apps/ (web, worker); Grep `^## ` across all handoffs (line-numbered) and targeted
  Greps for `handoffs/*.md` citations and `(\d|word)[ -](agent|auditor)s?` claims.
- Facts established: docs/handoffs/ = 25 files; exactly 1 aggregate (epoch 20260529-1921); the
  aggregate's 9 per-agent citations ALL exist (0 unbacked in the current phase); the only unbacked
  numeric claims are historical + already annotated; integration-risk drift = `## Verification /
  tests` (spaces) + folded `## Files inspected` (NOT the `## Files Inspected`/`## Changed Files` the
  brief guessed); broad Phase-0 heading drift is historical; `scripts/` dir is absent.

## Next actions
1. Phase 1.6 Task B — implement `scripts/check-governance.mjs` per this spec: classifier (D1),
   current-epoch resolution + `--phase` override (D2), strict/informational split (D3), exit/output
   (D4); validators `validateAggregateCitations` (F2, link+path forms),
   `validateHeadings` (normaliser + relaxed-aggregate required-set + KNOWN_HISTORICAL_DRIFT, F4/F5/F7),
   `validateAgentCountClaims` (current aggregate only, F3), optional `validateScriptReferences` (F9).
2. Wire package.json: add `governance:check`; insert into `ci:local` after `check:core` (D5).
3. Wire .github/workflows/ci.yml: add `Governance check` step after `Check core (smoke)`, before
   `Lint`, in the `gates` job (D6).
4. Confirm R1 (KNOWN_HISTORICAL_DRIFT allowlist vs a normalisation note for integration-risk) before
   merge. Default = allowlist; checker stays GREEN on the current tree either way.
5. (Optional, future) extend the heading WARN report into a one-time INFORMATIONAL handoff cataloguing
   Phase-0 drift, so historical files are documented without being rewritten.
