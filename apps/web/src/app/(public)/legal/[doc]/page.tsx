import { notFound } from 'next/navigation';
import { PublicTopBar } from '@/components/PublicTopBar';
import { Card, SectionHeader, RiskWarningBanner } from '@wtc/ui';

const DOCS: Record<string, { title: string; body: string; draft?: boolean }> = {
  terms: { title: 'Terms of Service', draft: true, body: 'Placeholder terms. Use of WTC products is subject to these terms and the risk disclosure. Replace with counsel-reviewed copy before launch.' },
  privacy: { title: 'Privacy Policy', draft: true, body: 'Placeholder privacy policy. WTC stores account data and encrypted secrets; plaintext exchange keys are never stored or logged.' },
  'risk-disclosure': { title: 'Risk Disclosure', body: 'Trading involves substantial risk of loss. Automated strategies can fail. The Tortila bot has known open items (TP reconciliation, margin pre-flight) shown as warnings. Never trade with funds you cannot afford to lose.' },
};

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const { doc } = await params;
  const content = DOCS[doc];
  if (!content) notFound();
  return (
    <>
      <PublicTopBar />
      <main className="wtc-container" style={{ maxWidth: 760, padding: '48px 22px' }}>
        <SectionHeader kicker="Legal" title={content.title} />
        {content.draft && <RiskWarningBanner severity="warning" title="Draft — not a final legal document" detail="This placeholder has not been reviewed by counsel and is not binding. Final, counsel-reviewed terms will be published before launch." />}
        {doc === 'risk-disclosure' && <RiskWarningBanner severity="warning" title="High-risk activity" detail="Read carefully before enabling any live trading." />}
        <Card><p className="wtc-muted" style={{ lineHeight: 1.7, margin: 0 }}>{content.body}</p></Card>
      </main>
    </>
  );
}
