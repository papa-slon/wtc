import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { botAccessForUser, reasonLabel } from '@/lib/access';
import { Card, SectionHeader, EmptyState, RiskWarningBanner, StatusPill, buttonClasses } from '@wtc/ui';
import { deriveBacktesterView, backtesterPill, type BotSlug } from '@wtc/backtester';

function toBotSlug(bot: string): BotSlug | null {
  return bot === 'tortila' || bot === 'legacy' ? bot : null;
}

export default async function BacktesterPage({ params }: { params: Promise<{ bot: string }> }) {
  const { bot } = await params;
  const slug = toBotSlug(bot);
  if (!slug) notFound();

  if (slug === 'legacy') {
    const view = deriveBacktesterView('legacy');
    return (
      <div className="wtc-stack">
        <SectionHeader kicker={view.kicker} title={view.title} />
        <Card title="Backtester">
          <p className="wtc-muted" style={{ margin: 0 }}>{view.body}</p>
        </Card>
      </div>
    );
  }

  const user = await requireUser();
  const access = await botAccessForUser(user, 'tortila_bot');
  const view = deriveBacktesterView('tortila', { allowed: access.allowed, reason: access.reason });

  if (view.kind === 'access_required') {
    return (
      <div className="wtc-stack">
        <SectionHeader kicker={view.kicker} title={view.title} />
        <RiskWarningBanner
          severity="warning"
          title={`Access ${reasonLabel(access.reason)}`}
          detail={view.body}
        />
      </div>
    );
  }

  const pill = backtesterPill('tortila');
  const release = view.runner;

  return (
    <div className="wtc-stack">
      <SectionHeader
        kicker={view.kicker}
        title={view.title}
        copy="Local-only execution. The WTC web tier gives you the runner package and stores no user backtest compute jobs."
      />

      <Card title="Runner package">
        <div className="wtc-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
          <div className="wtc-stack" style={{ flex: '1 1 360px', minWidth: 0 }}>
            <p className="wtc-muted" style={{ margin: 0 }}>{view.body}</p>
            {release && (
              <div className="wtc-grid wtc-grid-4">
                <div className="wtc-card-row"><span className="k">Version</span><span className="v">{release.version}</span></div>
                <div className="wtc-card-row"><span className="k">Python</span><span className="v">{release.minPython}+</span></div>
                <div className="wtc-card-row"><span className="k">Size</span><span className="v">{Math.round(release.sizeBytes / 1024)} KB</span></div>
                <div className="wtc-card-row"><span className="k">SHA256</span><span className="v wtc-mono">{release.sha256.slice(0, 12)}...</span></div>
              </div>
            )}
          </div>
          <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
        </div>
        {release && (
          <div className="wtc-row" style={{ marginTop: 16 }}>
            <Link href={release.routeHref} className={buttonClasses('primary')}>Download local runner</Link>
            <Link href={`/api/bots/${slug}/config-export`} className={buttonClasses('secondary')}>Download current config</Link>
            <Link href={`/app/bots/${slug}/settings`} className={buttonClasses('secondary')}>Open bot settings</Link>
          </div>
        )}
      </Card>

      <Card title="Local workflow">
        <ol className="wtc-muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
          <li>Download and unzip the runner on your computer.</li>
          <li>Install Python dependencies with <span className="wtc-mono">pip install -r requirements.txt</span>.</li>
          <li>Edit <span className="wtc-mono">config.example.json</span> with symbols/timeframe/risk settings.</li>
          <li>Run <span className="wtc-mono">python run.py --config config.example.json --out result.json</span>.</li>
          <li>Copy the settings you choose back into the WTC bot configuration page.</li>
        </ol>
      </Card>

      <Card title="Results">
        <EmptyState
          title="Results stay local in this MVP"
          hint="The runner writes result.json on your machine. Server-side job creation, artifact upload, and charts remain disabled until the DB-backed artifact pipeline is built."
        />
      </Card>
    </div>
  );
}
