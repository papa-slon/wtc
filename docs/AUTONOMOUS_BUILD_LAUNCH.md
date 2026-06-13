# AUTONOMOUS_BUILD_LAUNCH.md — how to launch the hands-off Production-B build

> Paste the **Launch prompt** below into a **fresh** session. The session becomes the
> `release-gate-conductor` and drives [`PRODUCTION_BUILD_PROGRAM.md`](PRODUCTION_BUILD_PROGRAM.md) under
> **Policy A** (build freely; pause only at 🛑 gates). Launch once, walk away, return at gates.

## What it does
- Runs the **Group-A** build phases back-to-back as background multi-agent workflows (auditors-before-edits →
  implementers by disjoint scopes → gates → adversarial BLOCK review → handoffs → commit), advancing on its own.
- Commits each finished phase to a build branch and updates `STATUS.md`.

## What it will NOT do without you (🛑 gates)
Live deploy · anything touching real money / the live bot · turning on real payments · deleting/editing real
user data · sending anything external · using a secret you must supply (Stripe / domain / KMS / S3-R2 / Axioma).
At any of these it **stops, logs it, and hands you a one-paste resume prompt.**

## Honest limits
- It runs as far as one session's context allows; at a 🛑 gate **or** a Rule-7 boundary (context/quality) it
  stops cleanly with a resume prompt — so "walk away" means "return at the next gate or handoff," not literally never.
- Nothing reaches the live site until **you** clear a deploy gate (unless you later raise autonomy to mode B).

## Optional pre-launch (fewer pauses)
- Pre-answer the §6 gate questions in `PRODUCTION_BUILD_PROGRAM.md` (Stripe / domain / backup / storage / KMS / Axioma).
- Decide the build branch base (default below = branch off the current canary tip `97209c4`).

---

## Launch prompt (copy-paste into a new session)

```
You are the release-gate-conductor for the WTC ecosystem. Run the autonomous Production-B build per
docs/PRODUCTION_BUILD_PROGRAM.md under Policy A (build freely; pause only at the 🛑 gates listed in §2).
I am authorizing multi-agent background workflows for this whole run.

Setup (do first, never work from memory):
- Read docs/PRODUCTION_BUILD_PROGRAM.md, docs/SESSION_PROTOCOL.md, AGENTS.md,
  docs/handoffs/0000-orchestrator-seed.md, docs/STATUS.md, and the latest docs/handoffs/ phase file.
- Work on branch feat/production-buildout (create it off the current tip if missing). Commit per phase.
  Do NOT deploy and do NOT push to any server.

Loop — repeat until the Group-A queue (§4) is empty or you hit a 🛑 gate:
  1. Pick the next PENDING Group-A phase from PRODUCTION_BUILD_PROGRAM.md §4.
  2. Run that phase as ONE background Workflow that follows SESSION_PROTOCOL Rules 1-8:
       - dispatch the phase's read-only auditors BEFORE any edit (Rule 1);
       - implement with the right ecosystem agents, split by DISJOINT write scopes (parallel only if file
         sets don't overlap);
       - gates: node scripts/gates.mjs core, then full — SEQUENTIAL, e2e isolated; OBSERVE green, never
         claim a gate you didn't see green (Rule 8);
       - BLOCK review: run the adversarial auditors §5 requires (security-auditor + privacy review for any
         public data; quant-performance-honesty-reviewer for ANY public-facing number; billing-access-auditor
         for payments) — a BLOCK means the phase is NOT done; fix and re-run;
       - write per-agent handoffs + an aggregate phase handoff linking each by path (Rules 2-4).
  3. On workflow completion: verify the gates were observed green; commit on the branch with a clear message;
     update docs/STATUS.md (gates RUN vs NOT-RUN, each NOT-RUN with a reason). Then IMMEDIATELY start the next
     phase's workflow — do not wait for me.
  4. 🛑 GATE: if the next required step is a live deploy, touches real money / the live bot, turns on real
     payments, deletes/edits real user data, sends anything external, or needs an operator-only secret
     (Stripe / domain / KMS / S3-R2 / Axioma) — STOP. Log it in STATUS.md, write a handoff with exact state +
     remaining work, and give me a one-paste resume prompt. Do not proceed past the gate.

Stop conditions (Rule 7): if you approach the context limit or output quality degrades, STOP cleanly with a
resume prompt rather than continuing degraded. Final report each stop: gates RUN vs NOT-RUN with reasons, and
confirm all background agents are closed. Never claim an unobserved green gate. FEATURE_LIVE_BOT_CONTROL stays
false; no live bot control; no plaintext secrets; entitlements fail closed.
```

---

## Resume after a gate
When the session stops at a 🛑 gate it gives you a resume prompt. Either: (a) supply the needed input (e.g. the
Stripe env), perform the gated action yourself (or approve it), then paste the resume prompt into a fresh session;
or (b) paste the resume prompt as-is to continue with the remaining Group-A phases and revisit the gate later.

## Stopping early
Just send "stop" — the conductor writes a handoff with exact state and a resume prompt; nothing is left half-applied.
