# governance-checker-auditor handoff

_2026-05-29 22:28. Phase 1.6.1 Task B — "Strengthen governance:check". READ-ONLY audit per
[`docs/SESSION_PROTOCOL.md`](../SESSION_PROTOCOL.md) §2–§4 (the N-agent honesty rule). The only file
written by this agent is this handoff._

> VERIFICATION NOTE: This is a READ-ONLY audit. Every fact below is verified live against the tree
> (Read/Grep/Glob on the actual files). I read **in full**: `scripts/check-governance.mjs`,
> `package.json`, `vitest.config.ts`, `.github/workflows/ci.yml`, `AGENTS.md`,
> `docs/SESSION_PROTOCOL.md`, `docs/handoffs/0000-orchestrator-seed.md`, `docs/STATUS.md`, the Phase-1.6
> aggregate `20260529-2052-phase-1-6-enforcement-persistence-truth.md`, and
> `20260529-2052-governance-enforcement-auditor.md`; enumerated `docs/handoffs/` (32 files) and the
> 2052 epoch via Glob; and ran a repo-wide `prepend`/`first` Grep. I did NOT run any npm script / test /
> git / `node scripts/check-governance.mjs` (no state mutation, no gate execution). The proposed code +
> tests are a spec for the implementer; they are not yet present or run (stated honestly in Verification).

## Scope

Audit `scripts/check-governance.mjs` in full and specify the exact strengthening of the "N-agent"
honesty enforcement: (1) change the N-claim denominator from "all per-agent files at the epoch" to
"per-agent handoff **links actually cited** in the current aggregate (minus aggregates)"; (2) stop
counting epoch files as proof of the N-claim; (3) add **unlinked current-epoch participant** detection
(a `<epoch>-*.md` per-agent file that exists but is NOT cited must FAIL, unless explicitly marked
non-participant/superseded/historical or allowlisted) with a concrete detection rule + a
`NON_PARTICIPANT_ALLOWLIST` constant; (4) keep older epochs INFORMATIONAL and keep
`KNOWN_HISTORICAL_DRIFT`; (5) design Vitest fixture tests by refactoring the pure logic into an
exported `evaluateGovernance(...)`; (6) re-verify the current tree still PASSES under the new rule
(cited-count vs file-count vs max-claim); (7) find every doc that wrongly says `governance:check` was
"prepended/first" in `ci:local` (truth: it is AFTER `check:core`).

## Files inspected

- `scripts/check-governance.mjs` (the file under audit — full read, all 116 lines) [verified]
- `package.json` (scripts; confirms `ci:local` order at :27) [verified]
- `AGENTS.md` (§"Session & phase protocol" Rule 2; §"Handoff format") [verified]
- `docs/SESSION_PROTOCOL.md` (§3 N-agent honesty rule; §4 aggregate-links-every-per-agent; §7 canonical headings) [verified]
- `docs/handoffs/0000-orchestrator-seed.md` [verified]
- `docs/STATUS.md` (Phase 1.6 additions; governance:check description at :13–:16, :30) [verified]
- `docs/handoffs/20260529-2052-phase-1-6-enforcement-persistence-truth.md` (current aggregate — full read; citations + N-claims counted from the text) [verified]
- `docs/handoffs/20260529-2052-governance-enforcement-auditor.md` (Task A spec the checker implements; D1–D7, F1–F9) [verified]
- `docs/handoffs/20260529-2052-qa-ci-gates-auditor.md` (the source of the "governance-first" recommendation; see F8) [verified]
- `vitest.config.ts` (full read — `test.include = ['packages/**/*.test.ts', 'tests/integration/**/*.test.ts']`, `exclude` includes `apps/web/**`) [verified]
- `.github/workflows/ci.yml` (full read — `Governance check` step at :47–48 is AFTER `Check core (smoke)` :44–45) [verified]
- full `docs/handoffs/` enumeration (32 files) + the 2052 epoch (6 `*-auditor.md` + the aggregate) via Glob [verified]
- repo-wide `prepend` / `first` Grep across `docs/**` + root (excluding node_modules) [verified]

## Files changed

None — read-only audit

## Findings

### F1 — CONFIRMED weakness: the N-claim denominator counts on-disk epoch files, not citations (severity: HIGH)
`scripts/check-governance.mjs:102` computes
`const perAgentAtEpoch = files.filter((f) => isCurrent(f) && !AGGREGATE_RE.test(f));`
i.e. **every** per-agent `*.md` whose epoch == current epoch, regardless of whether the aggregate
links it. Line :107 then enforces `if (maxClaim > perAgentAtEpoch.length) fail(...)`. This is exactly
the protocol violation flagged in the task: SESSION_PROTOCOL.md §3 requires an "N-agent" claim be
backed by N per-agent files **"each cited by path in the aggregate"** — mere presence on disk is not
proof. An operator could drop N empty stub files at the epoch and the current check would pass an
"N-agent" claim with **zero** of them actually cited. The denominator must be the count of per-agent
handoffs **cited in the aggregate** (the existing `cited` Set, lines :91–:95), minus any cited target
that is itself an aggregate. evidence: `scripts/check-governance.mjs:102,104,105,106,107`.

### F2 — The `cited` Set already exists and is the correct denominator source (severity: INFO — enabler)
Lines :91–:95 build `cited` by scanning the aggregate for markdown links `](<...>.md)`, taking the
basename, and keeping only handoff-named targets (`/^\d{8}-/`) that are not the aggregate itself.
Lines :96–:99 already verify each cited file **exists** (the rule "aggregate links a missing file →
fail" is already implemented and correct — keep it). So the fix for rule 1 is to derive
`citedPerAgent` from this same Set (excluding cited targets that match `AGGREGATE_RE`) and compare
`maxClaim <= citedPerAgent.length`. No new parsing needed. evidence: `scripts/check-governance.mjs:90–99`.

### F3 — No unlinked-current-epoch-participant detection today (severity: MEDIUM — gap)
The checker never asserts the converse of "all cited exist": it does not check that all current-epoch
per-agent files are **cited**. A `<epoch>-<agent>.md` participant the aggregate forgot to link passes
silently. Rule 3 closes this: any current-epoch per-agent file NOT in `cited` must FAIL, unless it is
(a) in `NON_PARTICIPANT_ALLOWLIST`, (b) in `KNOWN_HISTORICAL_DRIFT` (already-merged artifact), or
(c) explicitly named in the aggregate text near a non-participant/superseded/historical keyword.
evidence: absence — there is no loop over `perAgentAtEpoch` testing membership in `cited`.

### F4 — `KNOWN_HISTORICAL_DRIFT` and the older-epoch grandfathering are correct and must stay (severity: INFO)
Lines :43–:45 (`KNOWN_HISTORICAL_DRIFT`), :71–:72 (`isCurrent`), :78–:79 (pre-canonical auto-grandfather),
:85–:86 (strict only when `isCurrent(f) && !KNOWN_HISTORICAL_DRIFT.has(f)`) already make older epochs +
pre-canonical files INFORMATIONAL. Rule 4 = keep all of this unchanged. The new rule-3 participant
check must reuse the SAME exemptions (current-epoch-only; skip `KNOWN_HISTORICAL_DRIFT`) so it cannot
fire on history. Older-epoch files have `isCurrent(f) === false`, so they never enter the rule-3 loop.
evidence: `scripts/check-governance.mjs:43–45,71–72,78–86`.

### F5 — Top-level-executing `.mjs` blocks unit testing; needs a pure exported core (severity: MEDIUM)
The script runs at import time (reads argv, reads fs, calls `process.exit` at :115). It exports
nothing. To unit-test the logic without spawning a process or hitting the real `docs/handoffs`, the
pure decision logic must be extracted into an exported function with **injected** file access
(`readFile`, `files`) and **no** `process.exit`/`console` side effects (return `{errors, warnings, …}`
instead). A thin CLI wrapper keeps current behaviour. This is the recommended approach (item 5) — far
cleaner than a `child_process` + temp-dir + new `--dir` arg harness.
evidence: `scripts/check-governance.mjs:24–28,57,58,90,115`.

### F6 — Current-aggregate citation/claim counts + on-disk 2052 files — ALL VERIFIED (severity: INFO — drives item 6)
In `docs/handoffs/20260529-2052-phase-1-6-enforcement-persistence-truth.md`:
- Markdown-link citations to `20260529-2052-*-auditor.md` (the `cited` Set under the new rule), verified
  at the listed lines:
  - :38 `](20260529-2052-governance-enforcement-auditor.md)`
  - :39 `](20260529-2052-db-race-safety-auditor.md)`
  - :40 `](20260529-2052-docs-contract-truth-auditor.md)`
  - :41 `](20260529-2052-security-config-auditor.md)`
  - :42 `](20260529-2052-ui-product-truth-auditor.md)`
  - :43 `](20260529-2052-qa-ci-gates-auditor.md)`
  → **citedPerAgent = 6**, none of which is an aggregate.
- **On-disk `20260529-2052-*` files (Glob-verified):** exactly those **6** `*-auditor.md` files PLUS the
  aggregate `20260529-2052-phase-1-6-enforcement-persistence-truth.md` — i.e. **zero uncited
  current-epoch per-agent files**. So rule 3 finds nothing to flag, and all 6 cited files exist (the
  existing :96–:99 existence check also passes).
- Max numeric N-claim in the aggregate text: :4 "**6 background read-only auditors**", :7 parenthetical,
  :35 "**6 read-only auditors**". (The `+3 concurrency tests` etc. numbers are "tests", not
  "agents/auditors", so the :104–:105 regexes do not match them.) → **maxClaim = 6**.
- **CONCLUSION (item 6):** under the strengthened checker, `maxClaim 6 <= citedPerAgent 6` (N-claim
  PASS) AND no unlinked current-epoch participant (rule 3 PASS). **The current tree still PASSES.**
  Numbers: **cited = 6, on-disk per-agent = 6, max-claim = 6** (6 == 6 == 6).

### F7 — Phase-1.6.1 forward-compat (new aggregate `20260529-2228-phase-1-6-1-*.md` citing 6 NEW auditors) (severity: INFO)
The task states a new Phase 1.6.1 aggregate will cite 6 new auditors (this `governance-checker-auditor`
is one of them). Under the strengthened rule it PASSES iff: (a) it links all 6 per-agent files by
markdown path, AND (b) every `20260529-2228-*` per-agent file present on disk is among those 6 links
(or allowlisted). NOTE: **this very handoff** (`20260529-2228-governance-checker-auditor.md`) becomes a
current-epoch per-agent file the moment the 2228 aggregate is the newest aggregate — so the 2228
aggregate MUST cite this file too, or rule 3 will (correctly) fail. maxClaim "6 auditors" == 6 cited →
OK. Operator action: ensure the 1.6.1 aggregate links all six 2228 auditor handoffs including this one.

### F8 — "prepended/first" wording bug (severity: LOW — doc-truth) — repo-wide Grep VERIFIED
**Truth:** `package.json:27` is
`"ci:local": "npm run check:core && npm run governance:check && npm run lint && …"` and
`.github/workflows/ci.yml:44–48` puts the `Governance check` step AFTER `Check core (smoke)` — so
`governance:check` is the **second** gate, **inserted AFTER `check:core`**, NOT "prepended"/"first".
A repo-wide Grep for `prepend` / `first` (across `docs/**` + root, excluding `node_modules`) yields
these governance-ordering hits:

**MUST FIX (present-tense falsehood about the shipped order):**
1. `docs/handoffs/20260529-2052-phase-1-6-enforcement-persistence-truth.md:48` — the CURRENT aggregate:
   "`package.json` (`governance:check` script + **prepended into `ci:local`**)". → change to "inserted
   into `ci:local` **after `check:core`**".

**HISTORICAL RECOMMENDATIONS (in the merged, append-only qa-ci-gates-auditor handoff — these record
what that auditor *recommended* (governance-FIRST), which is the opposite of what shipped; per the
append-only norm the operator may leave them, but none describe the shipped order correctly):**
2. `docs/handoffs/20260529-2052-qa-ci-gates-auditor.md:90` — heading "recommend slotting it **FIRST** in `ci:local` and as the first gate after `secret:scan` in `ci.yml`".
3. `…qa-ci-gates-auditor.md:94` — "The Task G list puts `governance:check` **first**".
4. `…qa-ci-gates-auditor.md:97` — "Slot it **first** in `ci:local`: `"ci:local": "npm run governance:check && npm run check:core && …"`".
5. `…qa-ci-gates-auditor.md:170` — "`governance:check` slots **first** in `ci:local` and immediately after `secret:scan` in `ci.yml`".
6. `…qa-ci-gates-auditor.md:188` — table cell "slot **first** in `ci:local`, after `secret:scan` in `ci.yml`".
7. `…qa-ci-gates-auditor.md:224` — "Add … to root `package.json`; **prepend** it to [`ci:local`]".
8. `…qa-ci-gates-auditor.md:226` — "Run gates in the offline-fast order: governance:check → check:core → lint → …" (lists governance BEFORE check:core).

**DO NOT change (already correct):** `docs/handoffs/20260529-2052-governance-enforcement-auditor.md:278`
("insert `governance:check` immediately after `check:core`") and :345 ("insert into `ci:local` after
`check:core`"). **NEUTRAL (no change):** `docs/STATUS.md:13` ("Wired into `ci:local` + `ci.yml`") and
`docs/IMPLEMENTED_FILES.md:50` — no "prepend/first" ordering wording.
(`docs/SECRET_VAULT_DESIGN.md:83` "IV+tag prepended" is unrelated crypto wording — ignore.)

## Decisions

### Item 1 — N-agent rule: exact code change (line numbers + replacement)
Replace the block at **`scripts/check-governance.mjs:101–112`** (the current rule-2 block through the
old `if (cited.size) console.log(...)` line) with the following. The change: (a) derive `citedPerAgent`
= cited targets that are NOT aggregates; (b) compare `maxClaim <= citedPerAgent.length`; (c) keep
`perAgentAtEpoch` ONLY for rule 3 (unlinked-participant detection), not for the N-claim.

```js
// --- (2) numeric "N-agent"/"N auditors" claim is backed by per-agent handoffs CITED in the aggregate. ---
// Per SESSION_PROTOCOL.md §3, an "N-agent" claim must be backed by N per-agent files *cited by path
// in the aggregate* — NOT merely present on disk. Denominator = cited per-agent handoffs (the `cited`
// Set), excluding any cited target that is itself an aggregate phase handoff.
const citedPerAgent = [...cited].filter((f) => !AGGREGATE_RE.test(f));
const claimedNs = [];
for (const m of aggText.matchAll(/(\d+)[-\s]?agents?\b/gi)) claimedNs.push(Number(m[1]));
for (const m of aggText.matchAll(/(\d+)\s+(?:read-only\s+|disjoint\s+|implementation\s+)*auditors?\b/gi)) claimedNs.push(Number(m[1]));
const maxClaim = claimedNs.length ? Math.max(...claimedNs) : 0;
if (maxClaim > citedPerAgent.length) {
  fail(`${currentAggregate} claims up to ${maxClaim} agents/auditors but only cites ${citedPerAgent.length} per-agent handoff(s): ${citedPerAgent.sort().join(', ') || '(none)'}.`);
} else if (maxClaim > 0) {
  console.log(`  numeric claim OK: max ${maxClaim} <= ${citedPerAgent.length} cited per-agent handoff(s).`);
}

// --- (3) unlinked current-epoch participant: a per-agent file at the current epoch that the aggregate
//         does NOT cite looks like a phase participant the aggregate failed to link → FAIL, unless it
//         is allowlisted, known historical drift, or explicitly marked non-participant in the text. ---
const perAgentAtEpoch = files.filter((f) => isCurrent(f) && !AGGREGATE_RE.test(f));
for (const f of perAgentAtEpoch) {
  if (cited.has(f)) continue;                       // properly linked
  if (NON_PARTICIPANT_ALLOWLIST.has(f)) continue;   // operator-sanctioned non-participant
  if (KNOWN_HISTORICAL_DRIFT.has(f)) continue;      // already-merged append-only artifact
  if (isMarkedNonParticipant(aggText, f)) { warn(`${f}: present at current epoch and not cited, but marked non-participant/superseded in ${currentAggregate}.`); continue; }
  fail(`${f} exists at the current epoch ${currentEpoch} but is NOT cited in ${currentAggregate} (unlinked phase participant). Cite it, add it to NON_PARTICIPANT_ALLOWLIST, or mark it non-participant/superseded in the aggregate.`);
}
if (cited.size) console.log(`  ${cited.size} cited per-agent handoff(s), all present.`);
```

> Note: the old standalone `if (cited.size) console.log(...)` (current :112) is folded into the block
> above — delete the old :112 so it is not duplicated. Lines :113–:115 (final summary + `process.exit`)
> stay as-is (or move into the CLI wrapper per item 5).

### Item 2 — Do not count epoch files as proof of the N-claim
Confirmed: in the replacement above, `perAgentAtEpoch` is **no longer used for the N-claim** (it is used
ONLY by rule 3 to find unlinked participants). The N-claim denominator is strictly `citedPerAgent.length`.

### Item 3 — Unlinked-participant detection rule + `NON_PARTICIPANT_ALLOWLIST` (precise, low false-positive)
Add two constants near the top (next to `KNOWN_HISTORICAL_DRIFT`, after `scripts/check-governance.mjs:45`):

```js
// Per-agent files that legitimately exist at the current epoch but are intentionally NOT cited by the
// aggregate (e.g. a superseded re-run, or a meta-handoff). Keep this EMPTY unless an operator adds a
// reviewed entry — an unexplained uncited current-epoch handoff should fail, not be silently waved.
const NON_PARTICIPANT_ALLOWLIST = new Set([
  // '20260529-2228-some-superseded-auditor.md',
]);

// Keywords that, on the SAME line as the filename or its agent-slug in the aggregate text, mark a
// current-epoch handoff as a deliberate non-participant rather than a forgotten link.
const NON_PARTICIPANT_KEYWORDS = /(non-participant|not a participant|superseded|supersedes|historical|excluded|withdrawn|obsolete|deprecated)/i;
```

Detection helper (place with the other helpers, after `missingHeadings` at ~:55):

```js
// True iff the aggregate text explicitly marks this current-epoch per-agent file as a non-participant.
// Match is line-scoped (the keyword must be on the SAME line as the filename OR its agent slug) to
// avoid a stray "superseded" elsewhere in the doc falsely exempting an unrelated forgotten link.
const isMarkedNonParticipant = (aggText, filename) => {
  const slug = filename.replace(/^\d{8}-\d{4}-/, '').replace(/\.md$/, ''); // e.g. "db-race-safety-auditor"
  return aggText.split(/\r?\n/).some((line) =>
    (line.includes(filename) || line.includes(slug)) && NON_PARTICIPANT_KEYWORDS.test(line));
};
```

Rationale (avoids the two false-positive modes the task warns about):
- **Filename or slug must be ON the line** — a generic "superseded" sentence elsewhere cannot exempt an
  unrelated file.
- **A keyword must be ON the same line** — merely mentioning the filename in prose (e.g. a "Findings"
  reference) does NOT exempt it; only an explicit non-participant/superseded annotation does.
- The default `NON_PARTICIPANT_ALLOWLIST` is **empty** (fail-by-default for unexplained uncited files),
  the safe direction; operators opt out one reviewed filename at a time.

### Item 4 — Historical allowlist stays
No change to `KNOWN_HISTORICAL_DRIFT` (:43–:45), `isCurrent`, the pre-canonical grandfathering, or the
older-epoch INFORMATIONAL behaviour. Rule 3 is current-epoch-only and skips `KNOWN_HISTORICAL_DRIFT`,
so older/grandfathered handoffs are never treated as "unlinked participants".

### Item 5 — Test approach: refactor to an exported `evaluateGovernance(...)` (CHOSEN), with Vitest fixtures
**Chosen: refactor the pure logic into an exported, dependency-injected function**, keep a thin CLI
wrapper. Reasons: (i) no `child_process` spawn, no temp-dir scaffolding, no new `--dir` arg surface;
(ii) deterministic, fast, runs in the existing Vitest project; (iii) `evaluateGovernance` takes
synthetic `files` + a `readFile(name)` map, so each test is a pure in-memory fixture.

Refactor shape (CLI behaviour preserved):

```js
// PURE CORE — no fs, no argv, no process.exit, no console. Returns a result object.
// files: string[] of basenames in docs/handoffs; readFile: (basename) => string (utf8 contents).
export function evaluateGovernance({ files, readFile, phaseArg = null,
    knownHistoricalDrift = KNOWN_HISTORICAL_DRIFT, nonParticipantAllowlist = NON_PARTICIPANT_ALLOWLIST }) {
  const errors = [];
  const warnings = [];
  // ... all of the current :58–:112 logic, but push to errors/warnings arrays instead of console+counters,
  //     and `return { ok: errors.length === 0, errors, warnings, currentEpoch, currentAggregate, citedPerAgent };`
}

// CLI WRAPPER (only when executed directly), preserving today's exit/console contract:
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = readdirSync(HANDOFFS).filter((f) => f.endsWith('.md')).sort();
  const phaseArgIdx = process.argv.indexOf('--phase');
  const res = evaluateGovernance({ files, readFile: (f) => readFileSync(join(HANDOFFS, f), 'utf8'),
                                   phaseArg: phaseArgIdx >= 0 ? process.argv[phaseArgIdx + 1] : null });
  for (const e of res.errors) console.error('  ✖ ERROR  ' + e);
  for (const w of res.warnings) console.warn('  ⚠ warn   ' + w);
  console.log(`governance:check — ${res.errors.length} error(s), ${res.warnings.length} warning(s).`);
  process.exit(res.ok ? 0 : 1);
}
```
(Add `import { pathToFileURL } from 'node:url';` alongside the existing `fileURLToPath` import.)

**Test file path (VERIFIED against the include globs): `tests/integration/check-governance.test.ts`.**
`vitest.config.ts:8` is `include: ['packages/**/*.test.ts', 'tests/integration/**/*.test.ts']` — so the
ONLY directories matched are `packages/**` and `tests/integration/**`. A file at
`scripts/check-governance.test.ts` would be **silently NOT run** (the trap to avoid), and
`tests/unit/**` is **also not matched** (no `tests/**` wildcard — only `tests/integration/**`). Options,
in order of preference:
1. **RECOMMENDED — `tests/integration/check-governance.test.ts`** (matches the existing glob, zero config
   change; the Phase-1.6 DB test already lives at `tests/integration/db-persistence.test.ts`). Import:
   `import { evaluateGovernance } from '../../scripts/check-governance.mjs';`. These are pure unit tests
   (no DB/process) — "integration" is only the directory name; acceptable, no config edit.
2. Add `'scripts/**/*.test.ts'` to `vitest.config.ts:8` `include`, then co-locate at
   `scripts/check-governance.test.ts`.
3. Add `'tests/unit/**/*.test.ts'` to the include and place it at `tests/unit/check-governance.test.ts`.
Whichever is chosen, confirm by running `npm test` and seeing the new file in the Vitest file list
(file count 12 → 13). `exclude` includes `apps/web/**` but not `scripts/`/`tests/`, so exclusion is not
a concern. **Default to option 1** (no config churn).

**The 5 required test cases (sketches), driving `evaluateGovernance` with synthetic fixtures:**

```ts
import { it, expect } from 'vitest';
// Recommended location: tests/integration/check-governance.test.ts (matches vitest.config.ts include).
import { evaluateGovernance } from '../../scripts/check-governance.mjs';

const HEADINGS_AGG = ['## Scope','## Files changed','## Findings','## Decisions','## Risks','## Verification/tests','## Next actions'].join('\n');
const HEADINGS_AGENT = ['## Scope','## Files inspected','## Files changed','## Findings','## Decisions','## Risks','## Verification/tests','## Next actions'].join('\n');
const agent = (body = '') => `# x handoff\n${HEADINGS_AGENT}\n${body}\n`;

// (a) aggregate claims 6 but links 2 → FAIL
it('fails when the N-claim exceeds cited per-agent handoffs', () => {
  const files = ['20260601-1000-phase-9-x.md','20260601-1000-a-auditor.md','20260601-1000-b-auditor.md'];
  const readFile = (f) => f.includes('phase')
    ? `# agg\nDriven by **6 read-only auditors**.\n[a](20260601-1000-a-auditor.md) [b](20260601-1000-b-auditor.md)\n${HEADINGS_AGG}\n`
    : agent();
  const res = evaluateGovernance({ files, readFile });
  expect(res.ok).toBe(false);
  expect(res.errors.join('\n')).toMatch(/claims up to 6 .* only cites 2/);
});

// (b) aggregate links a missing file → FAIL
it('fails when the aggregate cites a non-existent handoff', () => {
  const files = ['20260601-1000-phase-9-x.md','20260601-1000-a-auditor.md'];
  const readFile = (f) => f.includes('phase')
    ? `# agg\n[a](20260601-1000-a-auditor.md) [ghost](20260601-1000-ghost-auditor.md)\n${HEADINGS_AGG}\n`
    : agent();
  const res = evaluateGovernance({ files, readFile });
  expect(res.ok).toBe(false);
  expect(res.errors.join('\n')).toMatch(/ghost-auditor\.md does not exist/);
});

// (c) unlinked current-epoch participant → FAIL
it('fails when a current-epoch per-agent file is not cited', () => {
  const files = ['20260601-1000-phase-9-x.md','20260601-1000-a-auditor.md','20260601-1000-orphan-auditor.md'];
  const readFile = (f) => f.includes('phase')
    ? `# agg\n[a](20260601-1000-a-auditor.md)\n${HEADINGS_AGG}\n`   // orphan exists but is NOT linked
    : agent();
  const res = evaluateGovernance({ files, readFile });
  expect(res.ok).toBe(false);
  expect(res.errors.join('\n')).toMatch(/orphan-auditor\.md .* NOT cited/);
});
// (c2) ... but PASSES (warn) when marked non-participant on the same line:
it('warns (not fails) when an uncited current-epoch file is marked superseded', () => {
  const files = ['20260601-1000-phase-9-x.md','20260601-1000-a-auditor.md','20260601-1000-orphan-auditor.md'];
  const readFile = (f) => f.includes('phase')
    ? `# agg\n[a](20260601-1000-a-auditor.md)\nNote: 20260601-1000-orphan-auditor.md is superseded.\n${HEADINGS_AGG}\n`
    : agent();
  const res = evaluateGovernance({ files, readFile });
  expect(res.ok).toBe(true);
  expect(res.warnings.join('\n')).toMatch(/orphan-auditor.*(non-participant|superseded)/i);
});

// (d) historical allowlist / older epoch → WARNING, not fail
it('treats an older-epoch heading-drifted handoff as informational', () => {
  const files = ['20260601-1000-phase-9-x.md','20260601-1000-a-auditor.md','20251201-0900-old-auditor.md'];
  const readFile = (f) => f.includes('phase-9')
    ? `# agg\n[a](20260601-1000-a-auditor.md)\n${HEADINGS_AGG}\n`
    : f.startsWith('20251201') ? `# old\n## Scope\n(missing most headings)\n` : agent();
  const res = evaluateGovernance({ files, readFile });
  expect(res.ok).toBe(true);                       // older epoch never fails
  expect(res.warnings.join('\n')).toMatch(/old-auditor\.md/);
});

// (e) a correct current phase → PASS
it('passes a well-formed current phase', () => {
  const files = ['20260601-1000-phase-9-x.md','20260601-1000-a-auditor.md','20260601-1000-b-auditor.md'];
  const readFile = (f) => f.includes('phase')
    ? `# agg\nDriven by **2 read-only auditors**.\n[a](20260601-1000-a-auditor.md) [b](20260601-1000-b-auditor.md)\n${HEADINGS_AGG}\n`
    : agent();
  const res = evaluateGovernance({ files, readFile });
  expect(res.ok).toBe(true);
  expect(res.errors).toHaveLength(0);
});
```

### Item 6 — Re-verify against the live tree (current aggregate 20260529-2052) — VERIFIED
**Verified via Glob + reading the aggregate:** cited per-agent links = **6** (governance-enforcement,
db-race-safety, docs-contract-truth, security-config, ui-product-truth, qa-ci-gates auditors, at :38–:43).
On-disk `20260529-2052-*` files = exactly those **6** `*-auditor.md` + the aggregate (nothing uncited).
Max numeric N-claim in the aggregate = **6**. Under the strengthened rule:
`maxClaim (6) <= citedPerAgent.length (6)` → **N-claim PASSES**.
- **Rule 3 (unlinked participant):** the disk holds exactly the 6 cited auditors + the aggregate at the
  2052 epoch → **zero** uncited current-epoch per-agent files → **PASS**.
- **Citation existence (existing :96–:99):** all 6 cited files exist on disk (Glob-confirmed) → **PASS**.
- **CONCLUSION:** under the strengthened checker the **current tree still PASSES** — N-claim 6<=6, no
  unlinked participant, all citations resolve. The numbers: **cited = 6, on-disk per-agent = 6,
  max-claim = 6** (6 == 6 == 6). No operator fix to the aggregate is required for the checker to stay
  green. (The only doc fix is the cosmetic :48 "prepended" wording in F8/item 7, which does not affect
  the checker.)
- **Phase 1.6.1 sanity (new `20260529-2228-phase-1-6-1-*.md` citing 6 new auditors):** PASSES iff the
  new aggregate (a) links all 6 of the 2228 per-agent handoffs **including this
  `20260529-2228-governance-checker-auditor.md`**, and (b) no uncited `20260529-2228-*` file remains.
  maxClaim "6 auditors" == 6 cited → OK.

### Item 7 — "prepended/first" wording hits — see F8 for the full enumeration
The complete list (repo-wide Grep) is in **F8**. The one present-tense falsehood to fix is
`docs/handoffs/20260529-2052-phase-1-6-enforcement-persistence-truth.md:48` ("prepended into `ci:local`"
→ "inserted into `ci:local` after `check:core`"). The qa-ci-gates-auditor handoff has several
"first/prepend" hits (:90, :94, :97, :170, :188, :224, :226) but those are that auditor's
*recommendations* (governance-first) in a merged append-only artifact — historical, not a claim about
the shipped order; leave unless annotating. `governance-enforcement-auditor.md:278/:345` are already
correct — do NOT change. `STATUS.md:13` / `IMPLEMENTED_FILES.md:50` are neutral.

## Risks

- R1 — **Heuristic N-claim regex (inherited).** The denominator change is robust, but the *numerator*
  (`maxClaim`) still regex-scans prose for `\d+ …agents?/auditors?`. "audited 12 endpoints by 6 auditors"
  is fine (12 is "endpoints"), but "a 9-agent roster" in narrative would be read as a claim of 9. This is
  pre-existing and acceptable (tripwire, not proof); the fix only makes the comparison stricter, never looser.
- R2 — **Vitest include glob is narrow (VERIFIED).** `vitest.config.ts:8` matches ONLY `packages/**` +
  `tests/integration/**`. A test at `scripts/*.test.ts` OR `tests/unit/*.test.ts` would be **silently
  not run** (false sense of coverage). Mitigation: use `tests/integration/check-governance.test.ts`
  (matches as-is) — or edit the include if co-locating. Confirm the file appears in `npm test`'s list
  (12 → 13 files).
- R3 — **`NON_PARTICIPANT_KEYWORDS` over-broad words.** Words like "historical"/"excluded" are common;
  the line-scoped requirement (filename/slug AND keyword on the SAME line) prevents false exemptions.
  Keep `NON_PARTICIPANT_ALLOWLIST` empty by default so the explicit-allowlist path requires a reviewed
  entry. If line-scoping proves too loose, tighten to require the keyword within N chars of the filename.
- R4 — **Rule-3 strictness could surprise an operator** who legitimately left a draft handoff at the
  current epoch. That is the intended behaviour (an uncited current-epoch participant is exactly the
  failure mode §3 targets); the three documented escapes (cite / allowlist / mark superseded) are the
  sanctioned ways out, and are spelled out in the proposed `fail(...)` message.
- R5 — **Append-only tension on the qa-ci-gates handoff (F8 #2–#8).** Those "governance-first" lines are
  factually at odds with the shipped order but are a *recommendation* in a merged artifact. Rewriting
  them touches history; the recommended action is to fix only the current aggregate's :48 and leave the
  historical recommendations (optionally annotate). The strengthened checker does not inspect prose
  ordering, so it is unaffected either way.

## Verification/tests

- This was a **read-only design audit**; I ran NO npm scripts, NO tests, NO git, and touched no live
  servers/bots/secrets. I did NOT run `node scripts/check-governance.mjs` (borderline-permitted; I judged
  the static read sufficient and chose not to execute anything). The proposed tests are sketches for the
  implementer to add; they are **not yet present or run**.
- **Facts established (all VERIFIED live via Read/Grep/Glob):**
  - CONFIRMED weakness at `scripts/check-governance.mjs:102` (`perAgentAtEpoch` = all epoch files) +
    `:107` (`maxClaim > perAgentAtEpoch.length`) — the epoch-file denominator.
  - The `cited` Set at :91–:95 is the correct denominator source; the citation-existence check (:96–:99)
    is correct and stays; `KNOWN_HISTORICAL_DRIFT` + grandfathering (:43–45, :71–72, :78–86) stay.
  - `package.json:27` order = `check:core && governance:check && lint && …`; `.github/workflows/ci.yml:44–48`
    runs `Governance check` AFTER `Check core (smoke)`. So governance is **after check:core**, NOT
    "prepended/first" → the aggregate's :48 "prepended" wording is wrong (F8/item 7).
  - Current aggregate cites **6** auditor handoffs (:38–:43); on-disk `20260529-2052-*` = exactly those
    6 `*-auditor.md` + the aggregate; max N-claim = **6** → strengthened checker **PASSES**
    (6 cited == 6 on-disk == 6 claimed; no unlinked participant).
  - `vitest.config.ts:8` include = `['packages/**/*.test.ts', 'tests/integration/**/*.test.ts']` (narrow;
    `scripts/` and `tests/unit/` NOT matched) → recommended test path
    `tests/integration/check-governance.test.ts`.
  - Repo-wide `prepend`/`first` Grep hits enumerated in F8 (1 must-fix in the current aggregate;
    several historical recommendations in the qa-ci-gates handoff; STATUS/IMPLEMENTED_FILES neutral).
- **Operator should run after implementing:**
  1. `npm run governance:check` — expect PASS on the 2052 tree; after the 1.6.1 aggregate lands, re-run
     (expect PASS iff it cites all six 2228 handoffs including this one).
  2. `npm test` — expect the 5 required cases + the (c2) marker case green, and the new test file listed
     (file count 12 → 13).

## Next actions

1. **Implement item 1** — replace `scripts/check-governance.mjs:101–112` with the denominator-fix +
   rule-3 block above; add `NON_PARTICIPANT_ALLOWLIST`, `NON_PARTICIPANT_KEYWORDS`, and
   `isMarkedNonParticipant` near :45/:55; delete the now-duplicated old :112.
2. **Refactor to `evaluateGovernance(...)`** (item 5 / F5): extract the pure logic, add the
   `import.meta.url === pathToFileURL(process.argv[1]).href` CLI guard, export the function; preserve the
   existing console/exit contract in the wrapper.
3. **Add the test** at `tests/integration/check-governance.test.ts` (VERIFIED to match `vitest.config.ts:8`;
   do NOT use `scripts/*.test.ts` or `tests/unit/*` — neither is globbed) with the 5 required cases (a–e)
   + the (c2) non-participant-marker case. Verify it is picked up by `npm test` (file count 12 → 13).
4. **Fix the wording** at `20260529-2052-phase-1-6-enforcement-persistence-truth.md:48` ("prepended into
   `ci:local`" → "inserted into `ci:local` after `check:core`"). The qa-ci-gates-auditor "first/prepend"
   hits (F8 #2–#8) are historical *recommendations* in a merged append-only handoff — leave them unless
   you choose to annotate. Do NOT edit the governance-enforcement-auditor handoff (already correct).
5. **Re-verify (item 6):** run `npm run governance:check` — expect PASS on the 2052 tree (cited 6 ==
   on-disk 6 == claim 6). When the 1.6.1 aggregate is authored, ensure it cites all six 2228 per-agent
   handoffs **including this one** (`20260529-2228-governance-checker-auditor.md`), or rule 3 will
   (correctly) fail on the uncited ones.
