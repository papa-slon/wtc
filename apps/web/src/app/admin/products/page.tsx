import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { assertAdmin } from '@wtc/auth';
import { Card, MetricCard, RiskWarningBanner, SectionHeader, StatusPill, buttonClasses, type Tone } from '@wtc/ui';
import { loadAdminProducts } from '@/features/admin/queries';
import { AVAILABILITY_LABEL, AVAILABILITY_TONE, type Availability } from '@/lib/product-status';

function availabilityLabel(status: string): string {
  return AVAILABILITY_LABEL[status as Availability] ?? status;
}

function availabilityTone(status: string): Tone {
  return AVAILABILITY_TONE[status as Availability] ?? 'neutral';
}

export default async function AdminProductsPage() {
  const actor = await requireUser();
  assertAdmin(actor.roles);

  const state = await loadAdminProducts();
  const activeEntitlements = state.products.reduce((sum, p) => sum + p.entitlementCounts.active + p.entitlementCounts.grace, 0);
  const pendingReview = state.products.reduce((sum, p) => sum + p.entitlementCounts.pendingPayment + p.entitlementCounts.manualReview, 0);
  const missingDbCatalog = state.products.filter((p) => !p.dbCatalogPresent).length;

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker="Admin - products"
        title="Products & plans"
        copy="Registry, catalog seed presence, plan coverage, availability, and entitlement state. Catalog edits remain code-defined; entitlement changes live on the entitlements page."
      />

      <div className="wtc-row" style={{ marginTop: -4, flexWrap: 'wrap', gap: 8 }}>
        {state.mode === 'postgres' ? (
          <StatusPill tone="ok">storage: Postgres</StatusPill>
        ) : (
          <StatusPill tone="warn">storage: in-memory (demo)</StatusPill>
        )}
        <StatusPill tone={state.checkoutEnabled ? 'ok' : 'warn'}>
          checkout: {state.checkoutEnabled ? 'enabled' : 'manual/support'}
        </StatusPill>
        <StatusPill tone={missingDbCatalog === 0 && state.mode === 'postgres' ? 'ok' : 'neutral'}>
          catalog seed: {state.mode === 'postgres' ? `${state.products.length - missingDbCatalog}/${state.products.length}` : 'not connected'}
        </StatusPill>
      </div>

      {state.mode === 'demo' && (
        <RiskWarningBanner
          severity="warning"
          title="Demo mode - no Postgres"
          detail="This page can show the code-defined registry and plan map, but DB catalog rows and entitlement counts stay empty until DATABASE_URL is configured."
        />
      )}

      <div className="wtc-grid wtc-grid-4">
        <MetricCard label="Registry products" value={state.products.length} />
        <MetricCard label="Registry plans" value={state.totalPlans} />
        <MetricCard label="DB plans" value={state.dbPlanCount ?? '-'} tone={state.dbPlanCount ? 'up' : undefined} />
        <MetricCard label="Active entitlements" value={activeEntitlements} tone={activeEntitlements > 0 ? 'up' : undefined} />
      </div>

      <Card title="Product registry overview">
        <div className="wtc-table-wrap">
          <table className="wtc-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Availability</th>
                <th>DB catalog</th>
                <th>Plans</th>
                <th>Active</th>
                <th>Pending/review</th>
                <th>Blocked</th>
              </tr>
            </thead>
            <tbody>
              {state.products.map((p) => (
                <tr key={p.code}>
                  <td data-label="Product">
                    <div style={{ fontWeight: 700 }}>{p.name}</div>
                    <div className="wtc-mono wtc-dim" style={{ fontSize: 11 }}>{p.code} - /{p.slug}</div>
                  </td>
                  <td data-label="Availability">
                    <StatusPill tone={availabilityTone(p.availabilityStatus)}>
                      {availabilityLabel(p.availabilityStatus)}
                    </StatusPill>
                    <div className="wtc-dim" style={{ fontSize: 11, marginTop: 6 }}>{p.availabilityNote}</div>
                  </td>
                  <td data-label="DB catalog">
                    <StatusPill tone={p.dbCatalogPresent ? 'ok' : state.mode === 'demo' ? 'warn' : 'bad'}>
                      {p.dbCatalogPresent ? 'present' : 'missing'}
                    </StatusPill>
                  </td>
                  <td data-label="Plans" className="wtc-dim" style={{ fontSize: 12 }}>
                    {p.planCodes.length > 0 ? p.planCodes.join(', ') : '-'}
                  </td>
                  <td data-label="Active" className="wtc-mono">{p.entitlementCounts.active + p.entitlementCounts.grace}</td>
                  <td data-label="Pending/review" className="wtc-mono">{p.entitlementCounts.pendingPayment + p.entitlementCounts.manualReview}</td>
                  <td data-label="Blocked" className="wtc-mono">{p.entitlementCounts.blocked}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {pendingReview > 0 && (
        <RiskWarningBanner
          severity="warning"
          title="Pending product access needs review"
          detail={`${pendingReview} entitlement state(s) are pending payment or manual review. Use the entitlement review queue before granting access.`}
        />
      )}

      <div className="wtc-row">
        <Link href="/admin/entitlements" className={buttonClasses('secondary')}>Manage entitlements</Link>
        <Link href="/admin/entitlements/review" className={buttonClasses('secondary')}>Review pending access</Link>
        <Link href="/pricing" className={buttonClasses('ghost')}>View public pricing</Link>
      </div>
    </div>
  );
}
