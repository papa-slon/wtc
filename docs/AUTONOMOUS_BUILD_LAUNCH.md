# AUTONOMOUS_BUILD_LAUNCH.md — how to launch the hands-off Production-B build

> Paste the **Launch prompt** below into a **fresh** session. The session becomes the
> `release-gate-conductor` and drives [`PRODUCTION_BUILD_PROGRAM.md`](PRODUCTION_BUILD_PROGRAM.md) under
> the **STUB-AND-CONTINUE** policy: build + commit freely, **never pause for an operator input** (stub it
> + punch-list it), and chain across fresh sessions via [`BUILD_PROGRESS.md`](BUILD_PROGRESS.md) so no
> single session dies from the context limit.

## What it does
- Runs Group-A build phases as background multi-agent workflows (auditors → implementers by disjoint
  scope → gates → adversarial BLOCK review → handoffs → commit), advancing on its own.
- Ticks each phase + appends any "needs: <operator input>" line in `BUILD_PROGRESS.md`.
- After ~2–3 phases (or when context fills) it writes a one-line **RESUME** command and stops — a fresh
  session continues from the baton. When the queue is drained it writes the final **PUNCH-LIST**.

## What it never does autonomously
Live deploy · anything touching real money / the live bot / real user-data deletion / external sends.
These don't arise in a stub build; if one ever would, it's punch-listed, not performed.

## Hands-off chaining (survive the context limit)
- **Manual (default):** when a session stops it prints a RESUME line; paste it into a new session to continue.
- **Unattended (optional):** ask the operator's assistant to **enable the scheduled routine** — a cron that
  fires the RESUME line every ~30 min in a fresh session, so the whole Group-A queue drains overnight with
  zero re-pasting. (Not enabled by default — it runs unattended and costs tokens; turn it on deliberately.)

---

## Launch prompt (copy-paste into a new session)

```
You are the release-gate-conductor for the WTC ecosystem. Run the autonomous Production-B build per
docs/PRODUCTION_BUILD_PROGRAM.md under the STUB-AND-CONTINUE policy (§2): build + commit freely, and
NEVER pause for an operator input/secret — build the clean stub and add a punch-list line instead.
I authorize multi-agent background workflows for this whole run.

Setup (never work from memory): read docs/BUILD_PROGRESS.md FIRST (the baton: what's done + the RESUME
line), then docs/PRODUCTION_BUILD_PROGRAM.md, docs/SESSION_PROTOCOL.md, AGENTS.md,
docs/handoffs/0000-orchestrator-seed.md, docs/STATUS.md, and the latest docs/handoffs/ phase file. Work on
branch feat/production-buildout (create it off the current tip if missing). Commit per phase. Do NOT deploy.

Loop:
  1. From docs/BUILD_PROGRESS.md, pick the next UNCHECKED Group-A phase (program §5).
  2. Run it as ONE background Workflow following SESSION_PROTOCOL Rules 1-8: read-only auditors BEFORE any
     edit → implementers split by DISJOINT write scope → node scripts/gates.mjs core then full
     (sequential, e2e isolated, OBSERVE green, never claim it) → BLOCK auditors (security + privacy for any
     public data; quant-performance-honesty-reviewer for ANY public number; billing for payments) → write
     per-agent + aggregate handoffs.
  3. On completion: verify gates were observed green; commit with a clear message; tick the phase in
     docs/BUILD_PROGRESS.md and append any "needs: <operator input>" punch-list lines.
  4. NEVER pause for an operator input — stub it cleanly (disabled CTA + premium "coming" copy, or a
     feature-flagged-off path) + punch-list it + go to the next phase.
  5. After ~2-3 phases, OR if context is getting large (SESSION_PROTOCOL Rule 7): STOP. Ensure
     docs/BUILD_PROGRESS.md is current and write the exact one-line RESUME command into its RESUME section,
     then end. Do NOT run this session until it dies.
  6. When every Group-A phase is checked: write the final PUNCH-LIST report into docs/BUILD_PROGRESS.md and stop.

The ONLY non-autonomous actions are a live deploy and anything touching real money / live bot / real
user-data deletion / external sends — never do these; if one would be required, punch-list it.
FEATURE_LIVE_BOT_CONTROL stays false; no plaintext secrets; entitlements fail closed; never claim an
unobserved green gate. Final report at each stop: gates RUN vs NOT-RUN with reasons + confirm background
agents closed.
```

---

## Stopping early
Send "stop" — the conductor writes `BUILD_PROGRESS.md` (current state + RESUME line) and ends; nothing is
left half-applied.
