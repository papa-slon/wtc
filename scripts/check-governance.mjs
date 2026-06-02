#!/usr/bin/env node
/**
 * scripts/check-governance.mjs — mechanical governance gate for docs/handoffs (SESSION_PROTOCOL.md).
 *
 * Zero-dependency, filesystem-only (this is NOT a git repo — discovery is by readdir, never git).
 * Makes the "N-agent audit" honesty rule verifiable by files on disk. The pure logic lives in the
 * exported `evaluateGovernance()` (no fs / no process.exit) so it can be unit-tested with synthetic
 * fixtures (tests/integration/check-governance.test.ts); a thin CLI wrapper does the fs reads.
 *
 * Rules (STRICT for the current phase, INFORMATIONAL for grandfathered handoffs):
 *   1. Every per-agent handoff CITED in the current aggregate must exist on disk.
 *   2. Any numeric "N-agent" / "N auditors" claim in the aggregate must be backed by >= N per-agent
 *      handoffs ACTUALLY CITED (linked) in that aggregate — NOT merely present on disk at the epoch.
 *   3. Every per-agent handoff file at the current epoch must be cited by the aggregate (no silently
 *      dropped participant), UNLESS it is allowlisted (NON_PARTICIPANT_ALLOWLIST / KNOWN_HISTORICAL_DRIFT)
 *      or explicitly marked superseded/non-participant on a line naming it in the aggregate.
 *   4. Handoffs carry the canonical headings (SESSION_PROTOCOL.md §7), matched as a required-subset
 *      after normalising whitespace and spaces around "/" (so "## Verification / tests" and
 *      "## Verification/tests — gates …" both satisfy "## Verification/tests"). Aggregates may omit
 *      "## Files inspected".
 *
 * Severity: current-phase violations are errors (exit 1); older-epoch / pre-canonical (seed, Phase-0)
 * files are informational warnings (exit 0).
 *
 * Usage: node scripts/check-governance.mjs [--phase YYYYMMDD-HHMM]
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CANONICAL = [
  '## Scope', '## Files inspected', '## Files changed', '## Findings',
  '## Decisions', '## Risks', '## Verification/tests', '## Next actions',
];
// Operator aggregate handoffs legitimately omit "## Files inspected" (they summarise, not inventory).
const AGGREGATE_REQUIRED = CANONICAL.filter((h) => h !== '## Files inspected');

const EPOCH_RE = /^(\d{8}-\d{4})-/;          // per-agent + aggregate share a <date-time> epoch prefix
const AGGREGATE_RE = /^(\d{8}-\d{4})-phase/; // aggregate phase handoff: <epoch>-phase<slug>.md

// Already-merged, append-only artifacts with accepted heading drift. Per the Phase 1.6 governance
// auditor: do NOT rewrite a merged handoff cited by an aggregate — exempt it instead.
export const KNOWN_HISTORICAL_DRIFT = new Set([
  '20260529-1921-integration-risk-auditor.md', // "## Verification / tests"; Files-inspected folded into Scope
]);

// Current-epoch per-agent files that are intentionally NOT phase participants (rare; fail-closed empty
// by default). Prefer marking a file superseded/non-participant in the aggregate over adding it here.
export const NON_PARTICIPANT_ALLOWLIST = new Set([]);

// A line that both names a handoff (by filename or agent-slug) AND carries one of these words marks it
// a non-participant — line-scoped so a stray "superseded" elsewhere can't exempt an unrelated file.
const NON_PARTICIPANT_KEYWORDS = /\b(superseded|non-participant|not a participant|historical|excluded|withdrawn|obsolete|deprecated)\b/i;

const normHeading = (line) => line.trim().replace(/\s+/g, ' ').replace(/\s*\/\s*/g, '/');
const headingsOf = (text) => text.split(/\r?\n/).filter((l) => /^##\s+\S/.test(l)).map(normHeading);
const missingHeadings = (required, headings) =>
  required.filter((req) => { const want = normHeading(req); return !headings.some((h) => h.startsWith(want)); });
const epochOf = (f) => (EPOCH_RE.test(f) ? f.match(EPOCH_RE)[1] : null);
const agentSlug = (f) => { const m = f.match(/^\d{8}-\d{4}-(.+)\.md$/); return m ? m[1] : f; };

function isMarkedNonParticipant(aggText, file) {
  const slug = agentSlug(file);
  for (const line of aggText.split(/\r?\n/)) {
    if (!NON_PARTICIPANT_KEYWORDS.test(line)) continue;
    if (line.includes(file) || line.includes(slug)) return true;
  }
  return false;
}

/**
 * Pure governance evaluator. `files` = list of handoff filenames; `readFile(name)` => file contents.
 * Returns { errors, warnings, info, currentEpoch, currentAggregate }. No fs, no process exit.
 */
export function evaluateGovernance({ files, readFile, phaseArg = null }) {
  const errors = [];
  const warnings = [];
  const info = [];
  const fail = (m) => errors.push(m);
  const warn = (m) => warnings.push(m);

  const mdFiles = files.filter((f) => f.endsWith('.md')).sort();
  const fileSet = new Set(mdFiles);
  const aggregates = mdFiles.filter((f) => AGGREGATE_RE.test(f));
  if (aggregates.length === 0) {
    fail('no aggregate phase handoff (<epoch>-phase*.md) found.');
    return { errors, warnings, info, currentEpoch: null, currentAggregate: null };
  }

  // current phase = explicit --phase, else newest aggregate by epoch (lexical sort == chronological).
  const currentEpoch = phaseArg ?? aggregates.map((f) => f.match(AGGREGATE_RE)[1]).sort().at(-1);
  const currentAggregate = aggregates.filter((f) => f.startsWith(currentEpoch + '-')).sort().at(-1);
  if (!currentAggregate) {
    fail(`no aggregate found for phase ${currentEpoch}.`);
    return { errors, warnings, info, currentEpoch, currentAggregate: null };
  }
  const isCurrent = (f) => epochOf(f) === currentEpoch;

  info.push(`current phase ${currentEpoch} (aggregate: ${currentAggregate})`);
  info.push(`${mdFiles.length} handoff file(s); ${aggregates.length} aggregate(s).`);

  // --- (4) canonical headings — only for canonical-format files (YYYYMMDD-HHMM-*). ---
  for (const f of mdFiles) {
    if (!EPOCH_RE.test(f)) continue; // pre-canonical (seed, Phase-0) — auto-grandfathered
    const missing = missingHeadings(AGGREGATE_RE.test(f) ? AGGREGATE_REQUIRED : CANONICAL, headingsOf(readFile(f)));
    if (!missing.length) continue;
    const msg = `${f}: missing canonical heading(s): ${missing.join(', ')}`;
    if (isCurrent(f) && !KNOWN_HISTORICAL_DRIFT.has(f)) fail(msg);
    else warn(msg + (KNOWN_HISTORICAL_DRIFT.has(f) ? ' [known historical drift — exempt]' : ' [historical — informational]'));
  }

  // --- (1) current aggregate cites per-agent handoffs that all exist. ---
  const aggText = readFile(currentAggregate);
  const cited = new Set();
  for (const m of aggText.matchAll(/\]\(([^)]+?\.md)\)/g)) {
    const base = m[1].split('/').pop();
    if (base && /^\d{8}-/.test(base) && base !== currentAggregate) cited.add(base); // only handoff-named citations
  }
  for (const base of [...cited].sort()) {
    if (fileSet.has(base)) continue;
    fail(`${currentAggregate} cites ${base}, but docs/handoffs/${base} does not exist.`);
  }

  // per-agent handoffs ACTUALLY CITED (links minus any aggregate links) — the only valid N-claim proof.
  const citedPerAgent = [...cited].filter((f) => !AGGREGATE_RE.test(f)).sort();

  // --- (2) numeric "N-agent"/"N auditors" claim is backed by CITED per-agent links (not epoch files). ---
  const claimedNs = [];
  for (const m of aggText.matchAll(/(\d+)[-\s]?agents?\b/gi)) claimedNs.push(Number(m[1]));
  for (const m of aggText.matchAll(/(\d+)\s+(?:read-only\s+|disjoint\s+|implementation\s+)*auditors?\b/gi)) claimedNs.push(Number(m[1]));
  const maxClaim = claimedNs.length ? Math.max(...claimedNs) : 0;
  if (maxClaim > citedPerAgent.length) {
    fail(`${currentAggregate} claims up to ${maxClaim} agent(s)/auditor(s) but cites only ${citedPerAgent.length} per-agent handoff link(s): ${citedPerAgent.join(', ') || '(none)'}.`);
  } else if (maxClaim > 0) {
    info.push(`numeric claim OK: max ${maxClaim} <= ${citedPerAgent.length} cited per-agent handoff(s).`);
  }

  // --- (3) every current-epoch per-agent file must be cited (no silently dropped participant). ---
  const perAgentAtEpoch = mdFiles.filter((f) => isCurrent(f) && !AGGREGATE_RE.test(f));
  for (const f of perAgentAtEpoch) {
    if (cited.has(f)) continue;
    if (NON_PARTICIPANT_ALLOWLIST.has(f) || KNOWN_HISTORICAL_DRIFT.has(f)) {
      warn(`${f}: current-epoch handoff not cited by ${currentAggregate} [allowlisted non-participant].`);
      continue;
    }
    if (isMarkedNonParticipant(aggText, f)) {
      info.push(`${f}: not cited but explicitly marked superseded/non-participant in ${currentAggregate}.`);
      continue;
    }
    fail(`${f}: current-epoch per-agent handoff exists but is NOT cited in ${currentAggregate} (unlinked participant). Cite it, or mark it superseded/non-participant in the aggregate, or add it to NON_PARTICIPANT_ALLOWLIST.`);
  }

  if (cited.size) info.push(`${cited.size} cited per-agent handoff(s), all present.`);
  return { errors, warnings, info, currentEpoch, currentAggregate };
}

// ---------------- CLI wrapper (only runs when executed directly, not when imported by a test) ----------------
function runCli() {
  const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
  const HANDOFFS = join(ROOT, 'docs', 'handoffs');
  if (!existsSync(HANDOFFS)) {
    console.error('governance:check — no docs/handoffs directory at ' + HANDOFFS);
    process.exit(1);
  }
  const files = readdirSync(HANDOFFS).filter((f) => f.endsWith('.md'));
  const phaseArgIdx = process.argv.indexOf('--phase');
  const phaseArg = phaseArgIdx >= 0 ? process.argv[phaseArgIdx + 1] : null;
  const readFile = (f) => readFileSync(join(HANDOFFS, f), 'utf8');

  const { errors, warnings, info } = evaluateGovernance({ files, readFile, phaseArg });
  for (const m of info) console.log('  ' + m);
  for (const m of warnings) console.warn('  ⚠ warn   ' + m);
  for (const m of errors) console.error('  ✖ ERROR  ' + m);
  console.log(`governance:check — ${errors.length} error(s), ${warnings.length} warning(s).`);
  process.exit(errors.length ? 1 : 0);
}

const isMain = (() => {
  try { return import.meta.url === pathToFileURL(process.argv[1]).href; } catch { return false; }
})();
if (isMain) runCli();
