# ecosystem-devops-implementer handoff
## Scope
Read-only Phase 3.17 devops audit for LMS production-storage readiness. Scope was limited to environment/deployment readiness for LMS object storage, local/dev storage, malware scanner mode, quarantine/retention flags, and the gates that must remain NOT RUN without real object-storage or scanner credentials. No live services, servers, preview worker, production endpoints, Stripe, Axioma, TradingView, bot, exchange, SSH, tmux, or systemd commands were touched.

## Files inspected
- AGENTS.md
- docs/handoffs/0000-orchestrator-seed.md
- docs/SESSION_PROTOCOL.md
- docs/STATUS.md
- docs/handoffs/20260601-2240-phase-3-16-worker-local-smoke-heartbeat.md
- docs/IMPLEMENTED_FILES.md
- docs/NEXT_ACTIONS.md
- .env.example
- packages/config/src/env.ts
- packages/config/src/env.test.ts
- docs/DEPLOYMENT.md
- docs/PRODUCTION_BLOCKERS_CURRENT.md
- docs/EDUCATION_LMS_PLAN.md
- docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md
- packages/lms/src/materials.ts
- packages/lms/src/materials.test.ts
- packages/lms/src/types.ts
- packages/lms/src/urls.ts
- packages/db/src/schema.ts
- packages/db/src/repositories.ts
- packages/db/migrations/0011_late_madelyne_pryor.sql
- apps/web/src/features/lms/actions.ts
- apps/web/src/features/lms/queries.ts
- apps/web/src/features/lms/material-download.ts
- apps/web/src/app/api/education/materials/[materialId]/download/route.ts
- apps/web/src/app/teacher/materials/page.tsx
- apps/web/src/app/teacher/courses/[id]/page.tsx
- apps/web/src/app/(app)/app/education/[courseId]/[lessonId]/page.tsx
- tests/integration/lms-material-download-handler.test.ts
- tests/integration/db-lms-ph3-1.test.ts
- tests/integration/lms-ph3-1-static.test.ts

## Files changed
None - read-only audit

## Findings
1. High - LMS production object-storage configuration is still absent from the deploy env surface. Evidence: the LMS plan requires S3-compatible object storage and non-public storage keys (`docs/EDUCATION_LMS_PLAN.md:284`, `docs/EDUCATION_LMS_PLAN.md:295`, `docs/EDUCATION_LMS_PLAN.md:298`, `docs/EDUCATION_LMS_PLAN.md:1030`, `docs/EDUCATION_LMS_PLAN.md:1031`, `docs/EDUCATION_LMS_PLAN.md:1485`), but the current env template only defines database, secrets, bot, Axioma, billing, and app keys (`.env.example:11`, `.env.example:19`, `.env.example:28`, `.env.example:38`, `.env.example:51`, `.env.example:65`, `.env.example:76`) and the typed schema ends at the current core/bot/Axioma/billing fields (`packages/config/src/env.ts:17`, `packages/config/src/env.ts:26`, `packages/config/src/env.ts:32`, `packages/config/src/env.ts:37`, `packages/config/src/env.ts:46`, `packages/config/src/env.ts:57`, `packages/config/src/env.ts:60`). Recommendation: add documented and typed LMS storage keys before production upload enablement, including provider enum, bucket/container, endpoint/region, key secret refs, signed URL TTL, max object size, and a production fail-closed rule that rejects `db-local`/dev providers. Target part: env template and typed config.
2. High - Current LMS file runtime is still DB-local byte storage, not object storage or local filesystem adapter storage. Evidence: the teacher action reads the uploaded `File`, calls `normalizeLmsFileUpload`, and returns `fileBytesBase64` only (`apps/web/src/features/lms/actions.ts:120`, `apps/web/src/features/lms/actions.ts:125`, `apps/web/src/features/lms/actions.ts:126`); the materials table persists `file_bytes_base64` and has no storage provider/key columns (`packages/db/src/schema.ts:256`, `packages/db/src/schema.ts:259`, `packages/db/src/schema.ts:260`, `packages/db/src/schema.ts:261`); repository comments confirm file bytes are stored base64 in the local DB row (`packages/db/src/repositories.ts:681`); downloads decode bytes from that DB column (`packages/db/src/repositories.ts:723`, `packages/db/src/repositories.ts:734`, `packages/db/src/repositories.ts:742`, `packages/db/src/repositories.ts:753`, `apps/web/src/features/lms/material-download.ts:55`, `apps/web/src/features/lms/material-download.ts:59`, `apps/web/src/features/lms/material-download.ts:61`). Recommendation: keep DB-local storage as dev/local only, add a storage port plus local filesystem dev adapter and object-storage adapter, and migrate file records to storage provider/key/checksum metadata before public production uploads. Target part: LMS storage adapter and DB model.
3. High - Malware scan, quarantine, and retention are present only as package-level local helpers, not as persisted/deployable controls. Evidence: `@wtc/lms` now defines hardcoded local provider, scan statuses, retention default, and prepared-material metadata (`packages/lms/src/materials.ts:4`, `packages/lms/src/materials.ts:5`, `packages/lms/src/materials.ts:6`, `packages/lms/src/materials.ts:26`, `packages/lms/src/materials.ts:29`, `packages/lms/src/materials.ts:31`, `packages/lms/src/materials.ts:32`), and its scanner is an inline EICAR/text-signature heuristic (`packages/lms/src/materials.ts:97`, `packages/lms/src/materials.ts:101`, `packages/lms/src/materials.ts:103`, `packages/lms/src/materials.ts:105`, `packages/lms/src/materials.ts:106`), but the web upload path still calls `normalizeLmsFileUpload` instead of `prepareLmsFileMaterial` (`apps/web/src/features/lms/actions.ts:120`, `apps/web/src/features/lms/actions.ts:125`, `apps/web/src/features/lms/actions.ts:126`) and the DB material row has no scan status, quarantine reason, scan timestamp, or retained-until fields (`packages/db/src/schema.ts:248`, `packages/db/src/schema.ts:256`, `packages/db/src/schema.ts:260`, `packages/db/src/schema.ts:261`). Recommendation: add typed scanner mode (`disabled-dev`, `local-signature`, `external` or equivalent), persist scan/quarantine/retention state, block download unless a file is clean or explicitly dev-not-required, and document which modes are allowed in production. Target part: malware scanner and retention readiness.
4. Medium - Deployment docs name production upload blockers but do not yet provide operator-ready LMS storage/scanner configuration steps or NOT-RUN criteria. Evidence: blockers state object storage, malware scanning/quarantine, retention policy, and DB-backed browser acceptance remain open (`docs/PRODUCTION_BLOCKERS_CURRENT.md:16`; `docs/NEXT_ACTIONS.md:23`, `docs/NEXT_ACTIONS.md:24`, `docs/NEXT_ACTIONS.md:25`; `docs/STATUS.md:29`, `docs/STATUS.md:30`), while deployment's production env section only lists core DB/secrets/Axioma env keys (`docs/DEPLOYMENT.md:153`, `docs/DEPLOYMENT.md:155`, `docs/DEPLOYMENT.md:156`, `docs/DEPLOYMENT.md:157`) and the NOT-RUN list omits LMS object storage/scanner gates (`docs/DEPLOYMENT.md:175`, `docs/DEPLOYMENT.md:177`, `docs/DEPLOYMENT.md:180`, `docs/DEPLOYMENT.md:181`, `docs/DEPLOYMENT.md:182`, `docs/DEPLOYMENT.md:183`, `docs/DEPLOYMENT.md:184`). Recommendation: update deployment docs with required LMS storage/scanner env, local/dev adapter notes, production readiness checks, and explicit NOT RUN entries for real object-store upload/download, scanner acceptance, quarantine release/delete, and retention cleanup when credentials are absent. Target part: docs/DEPLOYMENT.md and .env.example.
5. Medium - Browser/runtime acceptance remains local/PGlite-heavy rather than DB-backed browser acceptance for the upload path. Evidence: Phase 3.15 explicitly says browser e2e is mostly demo-mode and route/PGlite tests are stronger acceptance evidence (`docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md:58`, `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md:60`, `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md:72`, `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md:73`, `docs/handoffs/20260601-2142-phase-3-15-lms-local-file-embed-storage.md:78`); current teacher UI also labels production object storage, virus scanning, and retention as separate gates (`apps/web/src/app/teacher/materials/page.tsx:35`, `apps/web/src/app/teacher/materials/page.tsx:38`, `apps/web/src/app/teacher/courses/[id]/page.tsx:237`, `apps/web/src/app/teacher/courses/[id]/page.tsx:240`). Recommendation: keep production upload rollout blocked until a DB-backed browser flow covers teacher file/embed creation, student download/render, denied access, and scanner/quarantine behavior. Target part: LMS acceptance gates.
6. Medium - Source-of-truth docs are drifting around "stub" versus actual DB-local behavior. Evidence: the LMS plan still says file upload is "Interface + S3 adapter stub" and signed URL TTL is implemented (`docs/EDUCATION_LMS_PLAN.md:1030`, `docs/EDUCATION_LMS_PLAN.md:1031`, `docs/EDUCATION_LMS_PLAN.md:1314`, `docs/EDUCATION_LMS_PLAN.md:1315`, `docs/EDUCATION_LMS_PLAN.md:1316`, `docs/EDUCATION_LMS_PLAN.md:1475`, `docs/EDUCATION_LMS_PLAN.md:1485`), while the implemented path stores/streams local DB bytes (`apps/web/src/features/lms/material-download.ts:57`, `apps/web/src/features/lms/material-download.ts:59`, `apps/web/src/features/lms/material-download.ts:61`; `packages/db/src/repositories.ts:681`). Recommendation: reconcile `docs/EDUCATION_LMS_PLAN.md` and deployment docs so "current" means DB-local acceptance and S3/R2/filesystem/scanner remain target work. Target part: LMS docs truth.

## Decisions
- Treated Phase 3.17 as read-only except for this required handoff file.
- Did not run servers, workers, preview commands, migrations, seeds, Playwright, or live integration calls.
- Treated current DB-local file storage as acceptable only for local acceptance, not production object-storage readiness.
- Treated `packages/lms/src/materials.ts` local scan/retention helpers as useful design evidence but not deployable readiness because they are not env-configured, persisted, or enforced by the current upload/download path.
- No background agents were spawned by this per-agent audit; none are left running.

## Risks
- Enabling public production LMS uploads with the current shape would put file bytes in Postgres, without object-store lifecycle controls, provider-level access controls, or independent scanner/quarantine state.
- The current package-level scanner can mark EICAR/text-signature cases but does not replace a real malware scanner credentialed and documented for production.
- Retention currently appears as a hardcoded package default, not an operator-configured or persisted lifecycle policy.
- Deployment operators do not yet have a single env/config checklist for LMS storage/scanner readiness, so production enablement could be accidentally judged by local PGlite/DB-byte evidence.

## Verification/tests
RUN:
- Read required protocol docs first: `AGENTS.md`, `docs/handoffs/0000-orchestrator-seed.md`, and `docs/SESSION_PROTOCOL.md`.
- Read session ground-truth docs required by the protocol: `docs/STATUS.md`, latest phase aggregate `docs/handoffs/20260601-2240-phase-3-16-worker-local-smoke-heartbeat.md`, `docs/IMPLEMENTED_FILES.md`, and `docs/NEXT_ACTIONS.md`.
- Inspected env/config/deployment/LMS files with `Get-Content` line-number passes and targeted `rg` searches for storage, object-store, S3/R2, scanner, malware, quarantine, and retention terms.
- `Test-Path docs/handoffs/20260601-2303-ecosystem-devops-implementer.md` returned `False` before this handoff was written.
- `rg` found LMS local provider/scan/retention helpers only in `packages/lms/src/materials.ts` and related docs, not as typed `packages/config/src/env.ts` fields or `.env.example` variables.

NOT RUN:
- `npm test`, `node scripts/gates.mjs full`, `node scripts/gates.mjs e2e`, `npm run build`, `npm run typecheck`, and `npm run db:generate` were NOT RUN because this was a read-only devops audit focused on file/config evidence, and running gates could write generated artifacts/logs outside the single permitted handoff write.
- `npm run dev`, `npm run preview:safe`, `npm run worker:smoke`, migrations, seeds, server starts, preview-worker checks, or DB mutations were NOT RUN because the prompt forbids running servers/live services and limits writes to this handoff.
- Real object storage upload/download acceptance, malware scanner acceptance, quarantine release/delete flows, retention cleanup jobs, signed URL acceptance, Stripe, Axioma, TradingView, bot/exchange, SSH, tmux, systemd, and production endpoint checks were NOT RUN because credentials/contracts are absent or explicitly forbidden in this phase.

## Next actions
1. Add typed LMS storage/scanner env and template docs: provider enum, local filesystem root, object-store endpoint/region/bucket/key secret refs, signed URL TTL, max size, scanner mode, quarantine mode, retention days, and production fail-closed validation.
2. Introduce an LMS storage port with at least a real local filesystem/dev adapter and an S3-compatible target adapter; stop treating DB `file_bytes_base64` as the production shape.
3. Persist storage provider/key, scan status, scan timestamp, quarantine reason, retained-until/delete-after fields, and block downloads for non-clean files outside explicitly labelled dev mode.
4. Update `docs/DEPLOYMENT.md`, `.env.example`, `docs/PRODUCTION_BLOCKERS_CURRENT.md`, and `docs/EDUCATION_LMS_PLAN.md` so current DB-local acceptance and target object-storage/scanner work are not conflated.
5. When object-store/scanner credentials are provided, run DB-backed browser acceptance plus route tests for upload, download, denied access, scanner clean/quarantine paths, and retention/deletion behavior.
