import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { botAccessForUser, reasonLabel } from '@/lib/access';
import { SectionHeader, RiskWarningBanner, EmptyState } from '@wtc/ui';

const MAP: Record<string, 'tortila_bot' | 'legacy_bot'> = { tortila: 'tortila_bot', legacy: 'legacy_bot' };

/** Entitlement-guarded skeleton for a bot sub-route. Shows access-required if not entitled. */
export async function BotSubPagePlaceholder({ bot, section, note }: { bot: string; section: string; note: string }) {
  const code = MAP[bot];
  if (!code) notFound();
  const user = await requireUser();
  const access = await botAccessForUser(user, code);
  if (!access.allowed) {
    return (
      <div className="wtc-stack">
        <SectionHeader kicker={`${bot} · ${section}`} title="Access required" />
        <RiskWarningBanner severity="warning" title={`Access ${reasonLabel(access.reason)}`} detail="Activate or renew this bot in billing to view this section." />
      </div>
    );
  }
  return (
    <div className="wtc-stack">
      <SectionHeader kicker={`${bot} · ${section}`} title={section} />
      <EmptyState title="Planned for a later phase" hint={note} />
    </div>
  );
}
