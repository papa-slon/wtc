# governance-session-protocol-auditor handoff

## Scope
Phase 1.5, Part A. Audit project governance against the Phase 1.5 session protocol.
Read `AGENTS.md` in full; determine whether `docs/SESSION_PROTOCOL.md` exists; identify
which of the eight required governance rules are missing or weak; and draft precise text to
add to `AGENTS.md` plus a full outline/body for a new `docs/SESSION_PROTOCOL.md`. Also verify
the handoff-format block in `AGENTS.md` matches the protocol's required sections.
STRICTLY READ-ONLY. The only file written is this handoff.

## Files inspected
- `AGENTS.md` (full) — roster, standard dispatch, handoff format, non-negotiable gates, conventions.
- `docs/handoffs/0000-orchestrator-seed.md` — canonical decisions; "Every agent must read this first".
- `docs/STATUS.md` — Phase 1 status; line 29 "5 read-only auditors".
- `docs/handoffs/20260529-phase1-persistence-hardening.md` — line 3 "6-agent read-only audit".
- `docs/handoffs/20260529-acceptance-hardening.md` — lines 4-5 "5 read-only auditors".
- `docs/handoffs/20260529-tests-runner.md` — superseded banner.
- `docs/handoffs/20260529-phase0-ecosystem-security-auditor.md` — representative Phase 0 per-agent handoff.
- `docs/IMPLEMENTED_FILES.md`, `docs/NEXT_ACTIONS.md` — phase context.
- Directory listings via Glob: `docs/**/*.md`, `docs/handoffs/*.md`, `.claude/agents/*`.

## Files changed
None — read-only audit.

## Findings

1. **CRITICAL — `docs/SESSION_PROTOCOL.md` does not exist.**
   Evidence: `Glob docs/SESSION_PROTOCOL.md` → "No files found"; full `docs/**/*.md` listing
   (49 files) contains no `SESSION_PROTOCOL.md`. The entire Phase 1.5 session-discipline protocol
   is unwritten. Recommendation: create `docs/SESSION_PROTOCOL.md` using the full body drafted in
   Finding 11, and link it from `AGENTS.md` and `docs/handoffs/0000-orchestrator-seed.md`. Target: A.

2. **CRITICAL — Rule (2) unenforced AND already violated: "N-agent audit" claims with zero per-agent handoffs.**
   Evidence: `20260529-phase1-persistence-hardening.md:3` claims a "6-agent read-only audit (security,
   db/persistence, frontend-truth, docs/contracts, QA/CI/e2e, integration-risk → 66 findings)";
   `20260529-acceptance-hardening.md:4-5` claims "5 read-only auditors (security-hardening,
   contract-code-parity, routes-ux, qa-verification, docs-truthfulness) → 25 findings"; `STATUS.md:29`
   repeats "5 read-only auditors → 25 findings". But `docs/handoffs/*.md` contains NO per-agent handoff
   for any of those 6+5 claimed agents — only the two aggregate handoffs themselves, the 10 Phase 0
   per-agent files (`20260529-phase0-*.md`), the superseded `20260529-tests-runner.md`, and
   `0000-orchestrator-seed.md`. The required per-agent artifacts (e.g. a security-hardening handoff,
   a qa-verification handoff) are absent. AGENTS.md has no rule forbidding such a claim. Recommendation:
   add the explicit prohibition in Finding 9 rule (2); going forward, an "N-agent audit" claim is only
   permitted if N per-agent handoff files exist at `docs/handoffs/<ts>-<agent>.md`, each cited by path
   in the aggregate handoff. Target: A.

3. **HIGH — Rule (1) absent: no requirement that a broad/major phase launch background agents BEFORE edits.**
   Evidence: `AGENTS.md:35` only says "For broad phases, run read-only auditors in parallel; split
   implementation by disjoint write scopes" — advisory, no ordering, no "before any edit", no
   "background agents". Grep of `AGENTS.md` for `background agent|spawn|sub-agent|launch` → only the
   `:35` "parallel" hit. The Phase 1/acceptance aggregate handoffs show edits and audits were
   merged into a single narrative with no launched-before-edits gate. Recommendation: add rule (1) per
   Finding 9. Target: A.

4. **HIGH — Rule (4) absent: no requirement that the operator write an aggregate phase handoff distinct from per-agent handoffs.**
   Evidence: `AGENTS.md:36` requires only that "Every agent writes a handoff
   `docs/handoffs/<YYYYMMDD-HHMM>-<agent>.md`"; there is no mention of an operator-authored aggregate
   phase handoff. (Aggregates like `20260529-phase1-persistence-hardening.md` exist in practice but are
   not mandated, not named to a convention, and — per Finding 2 — are not backed by per-agent files.)
   Recommendation: add rule (4): operator writes `docs/handoffs/<ts>-phaseN-<slug>.md` that links every
   per-agent handoff by path. Target: A.

5. **HIGH — Rule (5) absent: no requirement to close/clean up background agents before the final report.**
   Evidence: no occurrence of "close", "clean up", or "background" in `AGENTS.md` (Grep
   `close|clean ?up|background` → no governance hit). Recommendation: add rule (5) per Finding 9. Target: A.

6. **HIGH — Rule (6) absent: no "each new phase = a NEW session" rule.**
   Evidence: Grep `AGENTS.md` for `session|new session` → no matches. Phase numbering exists (Phase 0,
   1, 1.5 in `STATUS.md`/`NEXT_ACTIONS.md`) but session boundaries are nowhere defined. Recommendation:
   add rule (6) per Finding 9 and mirror it in `docs/SESSION_PROTOCOL.md`. Target: A.

7. **HIGH — Rule (7) absent: no stop/handoff/new-session-prompt rule for scope/time/context overrun or quality degradation.**
   Evidence: no "exceeds scope", "context", "degrade", or "stop" governance language in `AGENTS.md`
   (Grep returned none). Nothing tells an agent to halt, write a handoff, and hand the operator a
   new-session prompt rather than continue silently. Recommendation: add rule (7) per Finding 9. Target: A.

8. **HIGH — Rule (8) absent: the final report is not required to list exact gates RUN vs gates NOT RUN.**
   Evidence: `AGENTS.md` "Non-negotiable gates" (`:51-59`) are *policy* gates (no live mutation, no
   plaintext secrets, fail-closed entitlements), not a required *run-log* of CI gates. There is no rule
   that the final report enumerate which gates were executed and which were not. The good-practice
   example to codify already exists at `STATUS.md:9-21` and the table in
   `20260529-phase1-persistence-hardening.md:50-63` (note `db:migrate`/`db:seed` explicitly marked
   "NOT RUN" — exactly the pattern to require). Recommendation: add rule (8) per Finding 9. Target: A.

9. **HIGH — Rule (3) weak/underspecified AND the AGENTS.md handoff-format block diverges from the required protocol sections.**
   Evidence: `AGENTS.md:36` mandates a handoff per agent (rule (3) partially present) but the format
   block at `AGENTS.md:38-49` lists: `# <agent-name> handoff`, `## Scope`,
   `## Files inspected / changed` (combined), `## Findings`, `## Decisions`, `## Risks`,
   `## Tests / verification`, `## Next actions`. The Phase 1.5 protocol / this auditor's required
   format uses SEPARATE `## Files inspected` and `## Files changed`, and `## Verification/tests`
   (order/naming differ). Real handoffs are already inconsistent: `20260529-acceptance-hardening.md`
   has `## Findings addressed` (not `## Findings`), `## Tests / verification (observed)`, and is
   MISSING both `## Files inspected / changed` and `## Decisions` (Grep of that file shows only Scope,
   Findings addressed, Tests/verification, Risks, Next actions). Phase 0 files use yet another style
   (`## Files Inspected (Read-Only)` / `## Files Written`, e.g.
   `20260529-phase0-ecosystem-security-auditor.md:15,24`). Recommendation: (a) make rule (3) explicit —
   every agent (including background agents) MUST write a handoff in the canonical format and MUST set
   `## Files changed` to "None — read-only audit" when read-only; (b) reconcile the `AGENTS.md` format
   block to the canonical seven sections below so AGENTS.md and `SESSION_PROTOCOL.md` agree. Target: A.

10. **PROPOSED ADDITIONS TO `AGENTS.md` (do NOT edit; text to insert verbatim).**
    Insert a new section after the "Standard dispatch" block (`AGENTS.md:28-36`), titled
    "## Session & phase protocol (Phase 1.5+)", and replace the existing "## Handoff format (required)"
    block (`AGENTS.md:38-49`) with the canonical version. Proposed text:

    ```
    ## Session & phase protocol (Phase 1.5+)

    See `docs/SESSION_PROTOCOL.md` for the full protocol. Binding rules:

    1. A broad or major phase MUST launch its background read-only agents BEFORE any
       edit to code or docs. No edits until the audit agents are dispatched.
    2. No "N-agent audit" claim may be made unless N per-agent handoff files actually
       exist at `docs/handoffs/<YYYYMMDD-HHMM>-<agent>.md`, one per claimed agent, and
       each is cited by path in the aggregate phase handoff. A narrative is not an agent.
    3. Every agent (foreground or background) writes a handoff in the canonical format
       below. Read-only agents set `## Files changed` to "None — read-only audit".
    4. The operator writes an aggregate phase handoff
       `docs/handoffs/<YYYYMMDD-HHMM>-phase<N>-<slug>.md` that links every per-agent
       handoff for that phase by path.
    5. All background agents MUST be closed/cleaned up before the final report is written.
       The final report states that they were closed.
    6. Each new phase is a NEW session. Do not run two phases in one session.
    7. If a phase exceeds its scope, its time budget, or the context window, or if output
       quality degrades: STOP. Write a handoff capturing current state, hand the operator
       an explicit new-session prompt to continue, and do not continue silently.
    8. The final report MUST list the exact gates RUN and the exact gates NOT RUN
       (with the reason a gate was skipped), e.g. `db:migrate`/`db:seed` = NOT RUN
       (no Docker/Postgres on host).

    ## Handoff format (required)

    ```
    # <agent-name> handoff
    ## Scope
    ## Files inspected
    ## Files changed            (read-only → "None — read-only audit")
    ## Findings                 (numbered; each: severity, evidence file:line,
                                 recommendation, target part)
    ## Decisions
    ## Risks
    ## Verification/tests
    ## Next actions
    ```
    ```
    Target: A.

11. **PROPOSED FULL BODY FOR `docs/SESSION_PROTOCOL.md` (do NOT create; text below is the deliverable).**

    ```
    # SESSION_PROTOCOL.md — WTC Ecosystem Platform (Phase 1.5+)

    Binding session and multi-agent governance protocol. Read with `AGENTS.md` and
    `docs/handoffs/0000-orchestrator-seed.md`. Conflicts: newest discovery doc wins;
    this protocol governs PROCESS, the seed governs technical decisions.

    ## 1. Sessions and phases
    - Each new phase = a NEW session (Rule 6). One phase per session. Name the phase
      (e.g. "Phase 1.5 — TV/LMS persistence") at session start.
    - A session begins by reading: AGENTS.md, 0000-orchestrator-seed.md, STATUS.md,
      the latest phase handoff, IMPLEMENTED_FILES.md, NEXT_ACTIONS.md.

    ## 2. Broad/major phases: agents before edits (Rule 1)
    - A broad or major phase MUST launch its background read-only audit agents BEFORE
      any code or doc edit. No edits until the audit agents are dispatched.
    - Split implementation by DISJOINT write scopes (per AGENTS.md). Read-only auditors
      run in parallel.

    ## 3. Per-agent handoffs (Rule 3) and the "N-agent" honesty rule (Rule 2)
    - Every agent (foreground or background) writes EXACTLY ONE handoff at
      `docs/handoffs/<YYYYMMDD-HHMM>-<agent>.md` in the canonical format (section 7).
    - Read-only agents set `## Files changed` to "None — read-only audit".
    - No "N-agent audit" claim is permitted unless N such per-agent files actually exist,
      one per claimed agent, each cited by path in the aggregate handoff. Counting a
      narrative section as an "agent" is prohibited.

    ## 4. Aggregate phase handoff (Rule 4)
    - The operator writes `docs/handoffs/<YYYYMMDD-HHMM>-phase<N>-<slug>.md` that:
      links every per-agent handoff by path; summarizes findings→fixes; and contains the
      gates table (section 6).

    ## 5. Closing background agents (Rule 5)
    - Before the final report, ALL background agents are closed/cleaned up. The final
      report explicitly states they were closed.

    ## 6. Final report: gates RUN vs NOT RUN (Rule 8)
    - The final report and the aggregate handoff MUST list the EXACT gates RUN and the
      EXACT gates NOT RUN, each NOT-RUN with a reason. Use the existing pattern in
      STATUS.md (lines 9-21) and the Phase 1 handoff table — e.g. `db:migrate`/`db:seed`
      = NOT RUN (no Docker/Postgres on host; verified via PGlite).
    - Do not claim a gate is green unless it was observed green in this session.

    ## 7. Canonical handoff format
    ```
    # <agent-name> handoff
    ## Scope
    ## Files inspected
    ## Files changed            (read-only → "None — read-only audit")
    ## Findings                 (numbered; severity, evidence file:line,
                                 recommendation, target part)
    ## Decisions
    ## Risks
    ## Verification/tests
    ## Next actions
    ```

    ## 8. Stop conditions (Rule 7)
    - If a phase exceeds scope, time budget, or context window, or if quality degrades:
      STOP immediately. Write a handoff capturing exact current state and remaining work,
      hand the operator an explicit copy-pasteable new-session prompt, and DO NOT continue
      silently in the degraded session.

    ## 9. Read-only / safety carry-overs (from AGENTS.md & seed)
    - Discovery is read-only; never touch live servers/bots/secrets. These remain in force
      every session and are not relaxed by any phase.
    ```
    Target: A.

12. **MEDIUM — `0000-orchestrator-seed.md` is the mandated first read but does not point to a session protocol.**
    Evidence: `0000-orchestrator-seed.md:1-3` ("Every agent must read this file first") and its
    "Next actions" (`:157-161`) describe Phase 0 doc ownership only; no session/phase-discipline
    pointer. Recommendation: once `docs/SESSION_PROTOCOL.md` exists, add a one-line pointer to it from
    the seed and from `AGENTS.md` so the protocol is discoverable from the mandated first reads.
    Target: A.

13. **LOW/INFO — Stack version drift noted in passing (not Part A; flagged for the relevant auditor).**
    Evidence: `0000-orchestrator-seed.md:46` says "PostgreSQL 16"; `STATUS.md`/host facts reference
    PostgreSQL 17 (`C:\Program Files\PostgreSQL\17\bin\psql.exe`). Out of scope for governance;
    record only so a docs-truth/devops auditor can reconcile. Target: A (governance note only).

## Decisions
- Treated the eight enumerated rules as the required protocol baseline and mapped each to a finding
  (rule 1→F3, 2→F2, 3→F9, 4→F4, 5→F5, 6→F6, 7→F7, 8→F8), plus the missing file (F1) and the format
  reconciliation (F9/F10).
- Classified F1 and F2 as CRITICAL because F2 is an already-realized violation (claims without
  artifacts) and F1 leaves the entire protocol unwritten; the remaining rule-gaps are HIGH.
- Did NOT edit `AGENTS.md` or create `docs/SESSION_PROTOCOL.md`; full proposed texts are delivered as
  Findings 10 and 11 per the read-only mandate.

## Risks
- If the "6-agent"/"5-auditor" claims (F2) are left standing without per-agent handoffs, the project's
  audit history is unverifiable and future phases may inherit the same false-rigor pattern.
- Three competing handoff-format styles (canonical, acceptance-hardening, Phase 0) mean "required
  format" is currently unenforceable; new agents will keep diverging until F9/F10 land.
- This audit is documentation-only; it cannot retroactively produce the missing per-agent handoffs —
  only future enforcement plus an operator note correcting the historical claims can.

## Verification/tests
Read-only audit; no code or gates executed. Claims verified by: `Glob docs/SESSION_PROTOCOL.md`
(no file), `Glob docs/handoffs/*.md` (15 files; no per-agent files for the 6+5 claimed agents),
`Grep` over `AGENTS.md` for session/background/gate terms (absent), and direct reads of the cited
handoffs at the line numbers given.

## Next actions
- Operator: in a NEW session, apply Finding 10 to `AGENTS.md` and create `docs/SESSION_PROTOCOL.md`
  from Finding 11; add the discoverability pointers (Finding 12).
- Operator: correct or annotate the "6-agent"/"5-auditor" claims (`20260529-phase1-persistence-hardening.md:3`,
  `20260529-acceptance-hardening.md:4-5`, `STATUS.md:29`) — either attach the missing per-agent
  handoffs or restate them honestly (e.g. "single-session audit covering N areas").
- Hand other Part B-H auditors their slices; this auditor's scope (Part A) ends here.
