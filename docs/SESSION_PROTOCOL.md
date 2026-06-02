# SESSION_PROTOCOL.md — WTC Ecosystem Platform (Phase 1.5+)

Binding **process** governance for sessions and multi-agent work. Read alongside
[`AGENTS.md`](../AGENTS.md) and [`docs/handoffs/0000-orchestrator-seed.md`](handoffs/0000-orchestrator-seed.md).
Conflict rule: this protocol governs **process**; the seed governs **technical decisions**; for
discovery facts, the newest discovery doc wins.

> Why this exists: a Phase-1 handoff claimed a "6-agent audit" and an acceptance handoff claimed
> "5 read-only auditors", but **no per-agent handoff files were ever written** for those claims
> (see [`0000`](handoffs/0000-orchestrator-seed.md) history and the 2026-05-29 governance audit
> [`20260529-1921-governance-session-protocol-auditor.md`](handoffs/20260529-1921-governance-session-protocol-auditor.md)).
> Rules 2–4 below exist so that an "N-agent" claim is always verifiable by files on disk.

## 1. Sessions and phases

- **Each new phase = a NEW session.** One phase per session. Name the phase at session start
  (e.g. "Phase 1.5 — Governance + Persistence Truth").
- A session **begins** by reading, in this order: `AGENTS.md`,
  `docs/handoffs/0000-orchestrator-seed.md`, `docs/SESSION_PROTOCOL.md` (this file),
  `docs/STATUS.md`, the latest phase handoff in `docs/handoffs/`, `docs/IMPLEMENTED_FILES.md`,
  `docs/NEXT_ACTIONS.md`.
- Do not "continue from memory" across sessions — re-establish ground truth from the docs and code.

## 2. Broad/major phases: agents before edits (Rule 1)

- A broad or major phase **MUST launch its background read-only audit agents BEFORE any edit** to
  code or docs. No edits until the audit agents are dispatched.
- If the agent tooling is unavailable, **STOP and report BLOCKED** — do not do a broad phase solo.
- Split implementation by **disjoint write scopes** (per `AGENTS.md`). Read-only auditors run in
  parallel; implementation agents only run in parallel when their file sets do not overlap.

## 3. Per-agent handoffs (Rule 3) and the "N-agent" honesty rule (Rule 2)

- **Every agent** (foreground or background, auditor or implementer) writes **exactly one** handoff
  at `docs/handoffs/<YYYYMMDD-HHMM>-<agent>.md` in the canonical format (§7).
- Read-only agents set `## Files changed` to **"None — read-only audit"**.
- **No "N-agent audit" claim is permitted unless N such per-agent files actually exist** — one per
  claimed agent — each **cited by path** in the aggregate phase handoff. A narrative section is not
  an agent; counting prose as an "agent" is prohibited.

## 4. Aggregate phase handoff (Rule 4)

- The operator writes an aggregate phase handoff
  `docs/handoffs/<YYYYMMDD-HHMM>-phase<N>-<slug>.md` that: **links every per-agent handoff by path**,
  summarizes findings → fixes, lists files changed, and contains the gates table (§6).

## 5. Closing background agents (Rule 5)

- Before the final report, **all background agents are closed/cleaned up** (completed or stopped;
  none left running). The final report **explicitly states** they were closed.

## 6. Final report: gates RUN vs NOT RUN (Rule 8)

- The final report and the aggregate handoff **MUST list the exact gates RUN and the exact gates
  NOT RUN**, each NOT-RUN with a reason. Use the pattern already in `STATUS.md` and the Phase 1
  handoff table — e.g. `db:migrate`/`db:seed` = NOT RUN (reason).
- **Do not claim a gate is green unless it was observed green in this session.**

## 7. Canonical handoff format

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

## 8. Stop conditions (Rule 7)

- If a phase exceeds its scope, its time budget, or the context window, or if output quality
  degrades: **STOP immediately.** Write a handoff capturing exact current state and remaining work,
  hand the operator an explicit copy-pasteable **new-session prompt**, and **do not continue
  silently** in the degraded session.

## 9. Read-only / safety carry-overs (from AGENTS.md & the seed)

- Discovery is read-only; never stop/restart/modify live servers/bots/secrets. No live bot control
  until a separately audited adapter is approved. No plaintext exchange secrets anywhere.
  Entitlements fail closed and are the only access source of truth. These remain in force **every
  session** and are not relaxed by any phase.
