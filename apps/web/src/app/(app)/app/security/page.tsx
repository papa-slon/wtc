import { revalidatePath } from 'next/cache';
import { requireUser } from '@/lib/session';
import { addExchangeKey, listExchangeKeys } from '@/lib/backend';
import { exchangeKeyInputSchema } from '@wtc/shared';
import { Card, SectionHeader, StatusPill, EmptyState, RiskWarningBanner, buttonClasses } from '@wtc/ui';
import { CsrfField, assertCsrf } from '@/lib/csrf';

async function addKeyAction(formData: FormData): Promise<void> {
  'use server';
  await assertCsrf(formData); // CSRF-first (security audit F-02, 20260531-0005) — before any session read
  const user = await requireUser();
  const parsed = exchangeKeyInputSchema.safeParse({
    exchange: formData.get('exchange'),
    label: formData.get('label'),
    apiKey: formData.get('apiKey'),
    apiSecret: formData.get('apiSecret'),
    mode: formData.get('mode'),
  });
  if (!parsed.success) return;
  await addExchangeKey(user.id, parsed.data); // sealed via envelope vault; audit written redacted
  revalidatePath('/app/security');
}

export default async function SecurityPage() {
  const user = await requireUser();
  const keys = await listExchangeKeys(user.id);

  return (
    <div className="wtc-stack">
      <SectionHeader kicker="Security" title="Exchange keys & security" copy="API keys are encrypted at rest with AES-256-GCM envelope encryption (KEK→DEK). Plaintext is never stored, logged, returned, or shown — only a masked hint." />

      <RiskWarningBanner severity="info" title="Before enabling live mode" detail="Use demo mode first. Grant the minimum exchange permissions. Live bot control stays disabled until a separate audited adapter is approved." />

      <Card title="Add exchange API key">
        <form action={addKeyAction} className="wtc-grid wtc-grid-2">
          <CsrfField />
          <div className="wtc-field"><label htmlFor="exchange">Exchange</label>
            <select className="wtc-input" id="exchange" name="exchange" defaultValue="bingx"><option>bingx</option><option>binance</option><option>bybit</option><option>okx</option></select>
          </div>
          <div className="wtc-field"><label htmlFor="label">Label</label><input className="wtc-input" id="label" name="label" placeholder="Main account" required /></div>
          <div className="wtc-field"><label htmlFor="apiKey">API key</label><input className="wtc-input" id="apiKey" name="apiKey" type="password" required /></div>
          <div className="wtc-field"><label htmlFor="apiSecret">API secret</label><input className="wtc-input" id="apiSecret" name="apiSecret" type="password" required /></div>
          <div className="wtc-field"><label htmlFor="mode">Mode</label>
            <select className="wtc-input" id="mode" name="mode" defaultValue="demo"><option value="demo">demo</option><option value="live">live</option></select>
          </div>
          <div style={{ display: 'flex', alignItems: 'end' }}><button className={buttonClasses('primary')} type="submit">Encrypt & save key</button></div>
        </form>
      </Card>

      <Card title="Your keys">
        {keys.length === 0 ? (
          <EmptyState title="No exchange keys yet" hint="Add one above — it will be sealed in the vault." />
        ) : (
          <table className="wtc-table">
            <thead><tr><th>Label</th><th>Exchange</th><th>Mode</th><th>Key</th><th>Stored</th></tr></thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td>{k.label}</td>
                  <td>{k.exchange}</td>
                  <td><StatusPill tone={k.mode === 'live' ? 'warn' : 'neutral'}>{k.mode}</StatusPill></td>
                  <td className="wtc-mono">{k.keyMask}</td>
                  <td><StatusPill tone="ok">encrypted</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
