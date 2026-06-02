import Link from 'next/link';
import { PublicTopBar } from '@/components/PublicTopBar';
import { Card, SectionHeader, buttonClasses } from '@wtc/ui';

export default function PublicEducationPage() {
  return (
    <>
      <PublicTopBar />
      <main className="wtc-container" style={{ padding: '48px 22px' }}>
        <SectionHeader kicker="Education" title="Learn the WTC way" copy="Structured lessons on risk, journaling, and the systems behind the bots and terminal. Content is entitlement-gated; teachers publish their own courses." />
        <div className="wtc-grid wtc-grid-3">
          <Card title="Risk Management Fundamentals"><p className="wtc-muted" style={{ fontSize: 14 }}>Position sizing, drawdown control, journaling discipline.</p></Card>
          <Card title="Trading the Turtle System"><p className="wtc-muted" style={{ fontSize: 14 }}>How the Tortila bot thinks — and where its current limits are.</p></Card>
          <Card title="Terminal & Journal"><p className="wtc-muted" style={{ fontSize: 14 }}>Using Axioma's execution view and journal analytics.</p></Card>
        </div>
        <div style={{ marginTop: 22 }}><Link href="/register" className={buttonClasses('primary')}>Get access</Link></div>
      </main>
    </>
  );
}
