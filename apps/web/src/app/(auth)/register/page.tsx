import Link from 'next/link';
import { PublicTopBar } from '@/components/PublicTopBar';
import { Card, RiskWarningBanner, buttonClasses } from '@wtc/ui';
import { registerAction } from '../actions';
import { authErrorCopy } from '@/features/auth/error-copy';

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const errorCopy = authErrorCopy(error);
  return (
    <>
      <PublicTopBar />
      <main className="wtc-container" style={{ maxWidth: 460, padding: '56px 22px' }}>
        <Card>
          <h1 className="wtc-h2">Create your WTC account</h1>
          <p className="wtc-muted" style={{ fontSize: 14, marginTop: 0 }}>Use one account for every WTC product.</p>
          {errorCopy && <RiskWarningBanner severity="error" title="Could not register" detail={errorCopy.detail} />}
          <form action={registerAction} className="wtc-stack" style={{ marginTop: 14 }}>
            <div className="wtc-field">
              <label htmlFor="displayName">Display name</label>
              <input className="wtc-input" id="displayName" name="displayName" type="text" autoComplete="name" />
            </div>
            <div className="wtc-field">
              <label htmlFor="email">Email</label>
              <input className="wtc-input" id="email" name="email" type="email" autoComplete="email" required />
            </div>
            <div className="wtc-field">
              <label htmlFor="password">Password (min 10 chars)</label>
              <input className="wtc-input" id="password" name="password" type="password" autoComplete="new-password" required minLength={10} />
            </div>
            <button className={buttonClasses('primary')} type="submit">Create account</button>
          </form>
          <p className="wtc-muted" style={{ fontSize: 13, marginTop: 16 }}>
            Already registered? <Link href="/login" className="wtc-link">Sign in</Link>
          </p>
        </Card>
      </main>
    </>
  );
}
