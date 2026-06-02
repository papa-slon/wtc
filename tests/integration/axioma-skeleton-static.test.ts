import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

const helper = read('apps/web/src/features/terminal/axioma-route-core.ts');
const downloadRoute = read('apps/web/src/app/api/axioma/download/route.ts');
const downloadTerminalRoute = read('apps/web/src/app/api/axioma/download/terminal/route.ts');
const downloadHandler = read('apps/web/src/features/terminal/axioma-download.ts');
const handoffRoute = read('apps/web/src/app/api/axioma/journal-handoff/route.ts');
const handoffHandler = read('apps/web/src/features/terminal/axioma-journal-handoff.ts');
const accountLinkRoute = read('apps/web/src/app/api/axioma/account-link/route.ts');
const accountLinkInitRoute = read('apps/web/src/app/api/axioma/account-link/init/route.ts');
const accountLinkCompleteRoute = read('apps/web/src/app/api/axioma/account-link/complete/route.ts');
const accountLinkHandler = read('apps/web/src/features/terminal/axioma-account-link.ts');
const jtiConsumeRoute = read('apps/web/src/app/api/axioma/jti/consume/route.ts');
const jtiConsumeHandler = read('apps/web/src/features/terminal/axioma-jti-consume.ts');
const jwksRoute = read('apps/web/src/app/.well-known/axioma-jwks.json/route.ts');
const jwksReadiness = read('apps/web/src/features/terminal/axioma-jwks-readiness.ts');
const terminalPage = read('apps/web/src/app/(app)/app/terminal/page.tsx');
const terminalLoader = read('apps/web/src/features/terminal/loader.ts');
const envExample = read('.env.example');
const dbSchema = read('packages/db/src/schema.ts');
const dbRepos = read('packages/db/src/repositories.ts');

describe('Axioma route skeletons fail closed', () => {
  it('centralizes route readiness on explicit flag, DB, bridge token, ES256 key, and URL config', () => {
    expect(helper).toMatch(/AXIOMA_ROUTE_SKELETON_ENABLED/);
    expect(helper).toMatch(/database_not_configured/);
    expect(helper).toMatch(/AXIOMA_BRIDGE_API_TOKEN/);
    expect(helper).toMatch(/AXIOMA_BRIDGE_API_TOKEN\?\.trim/);
    expect(helper).toMatch(/AXIOMA_HANDOFF_SIGNING_KEY/);
    expect(helper).toMatch(/AXIOMA_HANDOFF_KEY_ID/);
    expect(helper).toMatch(/es256_key_invalid/);
    expect(helper).toMatch(/createEs256Signer/);
    expect(helper).toMatch(/new URL/);
    expect(helper).toMatch(/hs256Secret: undefined/);
    expect(envExample).toMatch(/AXIOMA_ROUTE_SKELETON_ENABLED=false/);
  });

  it('download route is auth + entitlement gated and returns not_configured before any live bridge work', () => {
    expect(downloadRoute).toMatch(/handleAxiomaDownloadRequest/);
    expect(downloadTerminalRoute).toMatch(/handleAxiomaDownloadRequest/);
    expect(downloadHandler).toMatch(/requireUser/);
    expect(downloadHandler).toMatch(/accessFor\(user\.id, 'axioma_terminal'\)/);
    expect(downloadHandler).toMatch(/entitlement_denied/);
    expect(downloadHandler).toMatch(/not_configured/);
    expect(downloadHandler).toMatch(/status: 503/);
    expect(downloadHandler).toMatch(/issueTerminalDownloadTokenWithAudit/);
    expect(downloadHandler).toMatch(/consumeTerminalDownloadTokenWithAudit/);
    expect(downloadHandler).toMatch(/tokenHash/);
    expect(downloadHandler).toMatch(/fetchInstaller/);
    expect(downloadHandler).toMatch(/bridge_not_implemented/);
    expect(downloadRoute).not.toMatch(/fetch\(/);
    expect(downloadHandler).not.toMatch(/fetch\(/);
    expect(downloadHandler).toMatch(/set\('x-content-type-options', 'nosniff'\)/);
    expect(read('packages/db/src/schema.ts')).toMatch(/tokenHash: text\('token_hash'\)/);
  });

  it('journal handoff is POST-only, records jti when configured, and never places token in a GET path', () => {
    expect(handoffRoute).toMatch(/handleAxiomaJournalHandoffRequest/);
    expect(handoffRoute).toMatch(/export async function POST/);
    expect(handoffRoute).toMatch(/export async function GET/);
    expect(handoffHandler).toMatch(/method_not_allowed/);
    expect(handoffHandler).toMatch(/POST only/);
    expect(handoffHandler).toMatch(/x-csrf-token/);
    expect(handoffHandler).toMatch(/csrf_failed/);
    expect(handoffHandler).toMatch(/issueHandoffJtiWithAudit/);
    expect(handoffHandler).toMatch(/buildHandoffEntitlementSnapshot/);
    expect(handoffHandler).toMatch(/getLinkedAxiomaAccountForUser/);
    expect(handoffHandler).toMatch(/account_link_required/);
    expect(handoffHandler).toMatch(/axiomaUserId,/);
    expect(dbRepos).toMatch(/axioma\.account_link_init/);
    expect(handoffHandler).toMatch(/token: handoff\.token/);
    expect(handoffRoute).not.toMatch(/redirect\(/);
    expect(handoffHandler).not.toMatch(/redirect\(/);
    expect(handoffRoute).not.toMatch(/\?token=/);
    expect(handoffHandler).not.toMatch(/\?token=/);
    expect(read('packages/axioma-bridge/src/bridge.ts')).toMatch(/method: 'POST'/);
    expect(read('packages/axioma-bridge/src/bridge.ts')).not.toMatch(/\?token=/);
  });

  it('account-link persistence is hash-only for new OTC flows and keeps active-link uniqueness', () => {
    expect(dbSchema).toMatch(/linkNonceHash: text\('link_nonce_hash'\)/);
    expect(dbSchema).toMatch(/oneTimeCode: text\('one_time_code'\).*legacy nullable column/);
    expect(dbSchema).toMatch(/aal_link_nonce_hash_idx/);
    expect(dbSchema).toMatch(/aal_active_user_idx/);
    expect(dbSchema).toMatch(/aal_active_axioma_user_idx/);
    expect(dbRepos).toMatch(/issueAxiomaAccountLinkNonceWithAudit/);
    expect(dbRepos).toMatch(/consumeAxiomaAccountLinkNonceWithAudit/);
    expect(dbRepos).toMatch(/revokeAxiomaAccountLinksForUserWithAudit/);
    expect(dbRepos).toMatch(/getAxiomaAccountLinkByNonceHash/);
    expect(dbRepos).toMatch(/recordAxiomaAccountLinkCompleteFailureWithAudit/);
    expect(dbRepos).toMatch(/getLinkedAxiomaAccountForUser/);
    expect(dbRepos).toMatch(/linkNonceHash/);
    expect(dbRepos).not.toMatch(/oneTimeCode:\s*input/);
    expect(dbRepos).not.toMatch(/oneTimeCode:\s*[^n]/);
    expect(read('packages/db/migrations/0010_axioma_account_link_hash.sql')).toMatch(/SET "one_time_code" = NULL/);
  });

  it('account-link routes are thin, local-only, and preserve OTC secrecy boundaries', () => {
    expect(accountLinkInitRoute).toMatch(/handleAxiomaAccountLinkInitRequest/);
    expect(accountLinkInitRoute).toMatch(/csrfToken/);
    expect(accountLinkInitRoute).toMatch(/requireUser/);
    expect(accountLinkInitRoute).toMatch(/accessFor/);
    expect(accountLinkCompleteRoute).toMatch(/handleAxiomaAccountLinkCompleteRequest/);
    expect(accountLinkRoute).toMatch(/handleAxiomaAccountLinkDeleteRequest/);
    expect(accountLinkRoute).toMatch(/csrfToken/);
    expect(accountLinkRoute).toMatch(/requireUser/);
    expect(accountLinkRoute).toMatch(/export async function DELETE/);

    expect(accountLinkHandler).toMatch(/verifyCsrf/);
    expect(accountLinkHandler).toMatch(/x-csrf-token/);
    expect(accountLinkHandler).toMatch(/authorization/);
    expect(accountLinkHandler).toMatch(/timingSafeEqual/);
    expect(accountLinkHandler).toMatch(/AXIOMA_BRIDGE_API_TOKEN/);
    expect(accountLinkHandler).toMatch(/completeBodySchema/);
    expect(accountLinkHandler).toMatch(/query_token_forbidden/);
    expect(accountLinkHandler).toMatch(/new URL\(req\.url\)\.search/);
    expect(accountLinkHandler).toMatch(/getAxiomaAccountLinkByNonceHash/);
    expect(accountLinkHandler).toMatch(/accessFor\(pending\.userId, 'axioma_terminal'\)/);
    expect(accountLinkHandler).toMatch(/recordAxiomaAccountLinkCompleteFailureWithAudit/);
    expect(accountLinkHandler).toMatch(/issueAxiomaAccountLinkNonceWithAudit/);
    expect(accountLinkHandler).toMatch(/consumeAxiomaAccountLinkNonceWithAudit/);
    expect(accountLinkHandler).toMatch(/revokeAxiomaAccountLinksForUserWithAudit/);
    expect(accountLinkHandler).toMatch(/cache-control.*no-store/s);
    expect(accountLinkHandler).not.toMatch(/fetch\(/);
    expect(accountLinkRoute).not.toMatch(/fetch\(/);
    expect(accountLinkInitRoute).not.toMatch(/fetch\(/);
    expect(accountLinkCompleteRoute).not.toMatch(/fetch\(/);
    expect(accountLinkHandler).not.toMatch(/\?code=/);
    expect(accountLinkHandler).not.toMatch(/\?token=/);
    expect(accountLinkHandler).not.toMatch(/oneTimeCode:\s*input/);
  });

  it('jti consume route is bearer-gated, no-store, and writes consume/replay audit events', () => {
    expect(jtiConsumeRoute).toMatch(/handleAxiomaJtiConsumeRequest/);
    expect(jtiConsumeHandler).toMatch(/AXIOMA_BRIDGE_API_TOKEN/);
    expect(jtiConsumeHandler).toMatch(/AXIOMA_BRIDGE_API_TOKEN!\.trim/);
    expect(jtiConsumeHandler).toMatch(/authorization/);
    expect(jtiConsumeHandler).toMatch(/consumeHandoffJti/);
    expect(jtiConsumeHandler).toMatch(/axioma\.handoff_jti_consume/);
    expect(jtiConsumeHandler).toMatch(/axioma\.handoff_jti_replay/);
    expect(jtiConsumeHandler).toMatch(/cache-control.*no-store/s);
    expect(jtiConsumeHandler).not.toMatch(/fetch\(/);
    expect(jtiConsumeHandler).not.toMatch(/\?token=/);
  });

  it('terminal CTAs remain disabled unless the same server-side readiness passes', () => {
    expect(terminalLoader).toMatch(/axiomaRouteReadiness/);
    expect(terminalLoader).toMatch(/resolveAxiomaJwksReadiness/);
    expect(terminalLoader).toMatch(/routeSkeletonConfigured/);
    expect(terminalLoader).toMatch(/bridgeActionsImplemented: false/);
    expect(terminalPage).toMatch(/terminalData\.routeSkeletonConfigured && terminalData\.bridgeActionsImplemented/);
    expect(terminalPage).toMatch(/disabled=\{!bridgeActionsEnabled\}/);
    expect(terminalPage).toMatch(/Download terminal \(not configured\)/);
    expect(terminalPage).toMatch(/Open Axioma Journal \(not configured\)/);
  });

  it('serves a public JWKS route only when the ES256 signing key is configured', () => {
    expect(jwksRoute).toMatch(/resolveAxiomaJwksReadiness/);
    expect(jwksReadiness).toMatch(/AXIOMA_HANDOFF_SIGNING_KEY/);
    expect(jwksReadiness).toMatch(/AXIOMA_HANDOFF_KEY_ID/);
    expect(jwksReadiness).toMatch(/createEs256Signer/);
    expect(jwksReadiness).toMatch(/buildJwks/);
    expect(jwksReadiness).toMatch(/signing_key_invalid/);
    expect(jwksRoute).toMatch(/jwks_not_configured/);
    expect(jwksRoute).not.toMatch(/requireUser/);
    expect(jwksRoute).not.toMatch(/d:/);
  });
});
