/**
 * Fixture-based self-check for the governance checker (scripts/check-governance.mjs).
 * Drives the pure `evaluateGovernance({files, readFile})` against synthetic in-memory handoff trees —
 * no fs, no child process. Locks in the Phase 1.6.1 strengthened rules.
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error — .mjs sibling script, no type declarations; runtime ESM import is fine under vitest.
import { evaluateGovernance } from '../../scripts/check-governance.mjs';

const HEADINGS = ['Scope', 'Files inspected', 'Files changed', 'Findings', 'Decisions', 'Risks', 'Verification/tests', 'Next actions'];

/** A canonical per-agent handoff body (all 8 headings). */
function agentBody(title: string): string {
  return `# ${title} handoff\n` + HEADINGS.map((h) => `## ${h}\n(content)\n`).join('');
}
/** An aggregate body: canonical headings + an optional N-claim sentence + markdown citations. */
function aggBody(opts: { claim?: number | null; cites?: string[]; extra?: string } = {}): string {
  const { claim = null, cites = [], extra = '' } = opts;
  let t = `# Phase aggregate handoff\n`;
  for (const h of HEADINGS) t += `## ${h}\n`;
  if (claim != null) t += `Driven by ${claim} read-only auditors.\n`;
  for (const c of cites) t += `- agent → [${c}](${c})\n`;
  if (extra) t += extra + '\n';
  return t;
}
/** Build the (files, readFile) pair evaluateGovernance expects from a {name: content} map. */
function tree(map: Record<string, string>) {
  return { files: Object.keys(map), readFile: (f: string) => map[f] ?? '' };
}

describe('governance checker — evaluateGovernance', () => {
  it('(a) aggregate claims 6 but links 2 → fail', () => {
    const t = tree({
      '20260601-0900-phase-x.md': aggBody({ claim: 6, cites: ['20260601-0900-a-auditor.md', '20260601-0900-b-auditor.md'] }),
      '20260601-0900-a-auditor.md': agentBody('a-auditor'),
      '20260601-0900-b-auditor.md': agentBody('b-auditor'),
    });
    const { errors } = evaluateGovernance(t);
    expect(errors.some((e: string) => /claims up to 6 .* cites only 2/.test(e))).toBe(true);
  });

  it('(b) aggregate cites a missing file → fail', () => {
    const t = tree({
      '20260601-0900-phase-x.md': aggBody({ claim: 2, cites: ['20260601-0900-a-auditor.md', '20260601-0900-ghost-auditor.md'] }),
      '20260601-0900-a-auditor.md': agentBody('a-auditor'),
    });
    const { errors } = evaluateGovernance(t);
    expect(errors.some((e: string) => /cites 20260601-0900-ghost-auditor\.md, but .* does not exist/.test(e))).toBe(true);
  });

  it('(c) unlinked current-epoch participant → fail', () => {
    const t = tree({
      '20260601-0900-phase-x.md': aggBody({ claim: 1, cites: ['20260601-0900-a-auditor.md'] }),
      '20260601-0900-a-auditor.md': agentBody('a-auditor'),
      '20260601-0900-b-auditor.md': agentBody('b-auditor'), // exists, current epoch, NOT cited
    });
    const { errors } = evaluateGovernance(t);
    expect(errors.some((e: string) => /20260601-0900-b-auditor\.md: current-epoch per-agent handoff exists but is NOT cited/.test(e))).toBe(true);
  });

  it('(c2) unlinked but explicitly marked superseded → not a failure', () => {
    const t = tree({
      '20260601-0900-phase-x.md': aggBody({
        claim: 1,
        cites: ['20260601-0900-a-auditor.md'],
        extra: 'Note: 20260601-0900-b-auditor.md was superseded mid-phase and is not a participant.',
      }),
      '20260601-0900-a-auditor.md': agentBody('a-auditor'),
      '20260601-0900-b-auditor.md': agentBody('b-auditor'),
    });
    const { errors } = evaluateGovernance(t);
    expect(errors).toHaveLength(0);
  });

  it('(d) older-epoch handoff with heading drift → warning, not failure', () => {
    const driftBody = `# old-auditor handoff\n## Scope\n## Findings\n`; // missing most canonical headings
    const t = tree({
      '20260601-0900-phase-x.md': aggBody({ claim: 1, cites: ['20260601-0900-a-auditor.md'] }),
      '20260601-0900-a-auditor.md': agentBody('a-auditor'),
      '20260529-1000-old-auditor.md': driftBody, // older epoch than the current aggregate
    });
    const { errors, warnings } = evaluateGovernance(t);
    expect(errors).toHaveLength(0);
    expect(warnings.some((w: string) => /20260529-1000-old-auditor\.md: missing canonical heading/.test(w) && /historical/.test(w))).toBe(true);
  });

  it('(e) a correct current phase → passes with zero errors', () => {
    const t = tree({
      '20260601-0900-phase-x.md': aggBody({ claim: 2, cites: ['20260601-0900-a-auditor.md', '20260601-0900-b-auditor.md'] }),
      '20260601-0900-a-auditor.md': agentBody('a-auditor'),
      '20260601-0900-b-auditor.md': agentBody('b-auditor'),
    });
    const { errors } = evaluateGovernance(t);
    expect(errors).toHaveLength(0);
  });

  it('fails closed when no aggregate exists', () => {
    const t = tree({ '20260601-0900-a-auditor.md': agentBody('a-auditor') });
    const { errors } = evaluateGovernance(t);
    expect(errors.some((e: string) => /no aggregate phase handoff/.test(e))).toBe(true);
  });
});
