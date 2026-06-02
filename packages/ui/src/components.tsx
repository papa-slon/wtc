import type { ReactNode } from 'react';

export type Tone = 'ok' | 'warn' | 'bad' | 'gold' | 'neutral';

export function cn(...parts: (string | false | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function buttonClasses(variant: 'primary' | 'secondary' | 'ghost' = 'primary'): string {
  return `wtc-btn wtc-btn-${variant}`;
}

export function Card({ children, className, title, action }: { children: ReactNode; className?: string; title?: string; action?: ReactNode }) {
  return (
    <section className={cn('wtc-card', className)}>
      {(title || action) && (
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          {title && <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function SectionHeader({ kicker, title, copy }: { kicker?: string; title: string; copy?: string }) {
  return (
    <div style={{ marginBottom: 18 }}>
      {kicker && <div className="wtc-kicker">{kicker}</div>}
      <h2 className="wtc-h2">{title}</h2>
      {copy && <p className="wtc-lead" style={{ maxWidth: 640 }}>{copy}</p>}
    </div>
  );
}

export function StatusPill({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  const cls = tone === 'neutral' ? 'wtc-pill' : `wtc-pill ${tone}`;
  return (
    <span className={cls}>
      <i /> {children}
    </span>
  );
}

export function MetricCard({ label, value, tone, sub }: { label: string; value: ReactNode; tone?: 'up' | 'down'; sub?: string }) {
  return (
    <div className="wtc-metric">
      <div className="label">{label}</div>
      <div className={cn('value', tone === 'up' && 'wtc-up', tone === 'down' && 'wtc-down')}>{value}</div>
      {sub && <div className="wtc-dim" style={{ fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export function RiskWarningBanner({ severity, title, detail }: { severity: 'info' | 'warning' | 'error'; title: string; detail: string }) {
  const icon = severity === 'error' ? '✕' : severity === 'warning' ? '!' : 'i';
  return (
    <div className={`wtc-warning ${severity}`} role={severity === 'error' ? 'alert' : 'status'}>
      <span aria-hidden style={{ fontWeight: 800 }}>{icon}</span>
      <div>
        <div className="w-title">{title}</div>
        <div className="w-detail">{detail}</div>
      </div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="wtc-empty">
      <div style={{ fontWeight: 700 }}>{title}</div>
      {hint && <div style={{ marginTop: 6, fontSize: 13 }}>{hint}</div>}
    </div>
  );
}

/** Renders a metric value or an em-dash when null — never a misleading 0. */
export function MetricValue({ value, suffix = '', prefix = '' }: { value: number | null; suffix?: string; prefix?: string }) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return <span className="wtc-dim">—</span>;
  }
  return <>{prefix}{value}{suffix}</>;
}

export function ProductStatusCard(props: {
  name: string;
  description: string;
  allowed: boolean;
  reason: string;
  statusLabel: string;
  href: string;
  ctaLabel: string;
}) {
  const tone: Tone = props.allowed ? 'ok' : props.reason === 'grace' ? 'warn' : props.reason === 'blocked_no_entitlement' ? 'neutral' : 'bad';
  return (
    <div className="wtc-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 18 }}>{props.name}</h3>
        <StatusPill tone={tone}>{props.statusLabel}</StatusPill>
      </div>
      <p className="wtc-muted" style={{ fontSize: 14, lineHeight: 1.6, margin: '10px 0 16px' }}>{props.description}</p>
      <a className={buttonClasses(props.allowed ? 'primary' : 'ghost')} href={props.href}>
        {props.ctaLabel}
      </a>
    </div>
  );
}
