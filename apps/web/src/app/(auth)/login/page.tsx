import Link from 'next/link';
import { PublicTopBar } from '@/components/PublicTopBar';
import { Card, RiskWarningBanner, buttonClasses } from '@wtc/ui';
import { loginAction } from '../actions';
import { DEMO_PASSWORD } from '@/lib/backend';
import { authErrorCopy } from '@/features/auth/error-copy';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const errorCopy = authErrorCopy(error);
  // Demo credentials are a dev convenience only — never prefill or display them in production HTML.
  const showDemo = process.env.NODE_ENV !== 'production';
  return (
    <>
      <PublicTopBar />
      <main className="wtc-container" style={{ maxWidth: 460, padding: '56px 22px' }}>
        <Card>
          <h1 className="wtc-h2">Sign in</h1>
          <p className="wtc-muted" style={{ fontSize: 14, marginTop: 0 }}>Access your WTC dashboard.</p>
          {errorCopy && <RiskWarningBanner severity="error" title="Could not sign in" detail={errorCopy.detail} />}
          <form action={loginAction} className="wtc-stack" style={{ marginTop: 14 }}>
            <div className="wtc-field">
              <label htmlFor="email">Email</label>
              <input className="wtc-input" id="email" name="email" type="email" autoComplete="email" required defaultValue={showDemo ? 'user@wtc.local' : undefined} />
            </div>
            <div className="wtc-field">
              <label htmlFor="password">Password</label>
              <input className="wtc-input" id="password" name="password" type="password" autoComplete="current-password" required defaultValue={showDemo ? DEMO_PASSWORD : undefined} />
            </div>
            <button className={buttonClasses('primary')} type="submit">Sign in</button>
          </form>
          {showDemo && (
            <p className="wtc-dim" style={{ fontSize: 12, marginTop: 16 }}>
              Demo accounts (password <code>{DEMO_PASSWORD}</code>): <br />
              admin@wtc.local · teacher@wtc.local · user@wtc.local
            </p>
          )}
          <p className="wtc-muted" style={{ fontSize: 13 }}>
            No account? <Link href="/register" className="wtc-link">Create one</Link>
          </p>
        </Card>
      </main>
    </>
  );
}
