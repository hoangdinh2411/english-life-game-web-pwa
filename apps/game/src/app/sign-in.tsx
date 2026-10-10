import { useState } from 'react';
import { router } from '../navigation/router';
import { ActionButton, Heading, Screen } from '../components/onboarding-ui';
import { useSession } from '../session/session-provider';
import { usePwa } from '../pwa/PwaProvider';

export default function SignInScreen() {
  const session = useSession();
  const { online } = usePwa();
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit() {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const outcome = await session.authenticate(email, password, creating ? displayName : undefined);
      if (outcome === 'confirmation-required') { setCreating(false); setMessage('Check your email to confirm your account, then sign in.'); return; }
      router.replace('/');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not connect. Please try again.'); }
    finally { setBusy(false); }
  }
  return <Screen><Heading title="A new life is waiting" subtitle="Sign in or create an account to begin your story." />
    <form className="form-stack" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      {creating ? <label>What should we call you?<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" required disabled={busy} /></label> : null}
      <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoCapitalize="none" autoComplete="email" required disabled={busy} /></label>
      <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={creating ? 'new-password' : 'current-password'} required disabled={busy} /></label>
      {message ? <p role="alert" className="error">{message}</p> : null}
      {!online ? <p role="status">Connect to sign in or create an account. You can still try local practice.</p> : null}
      <button type="submit" className="action-button" disabled={busy || !session.ready || !online}>{busy ? 'Please wait…' : creating ? 'Create account' : 'Sign in'}</button>
    </form>
    <ActionButton label={creating ? 'I already have an account' : 'Create a new account'} secondary disabled={busy} onClick={() => { setCreating(!creating); setMessage(''); }} />
    <ActionButton label="Try local station practice" secondary onClick={() => router.push('/practice')} />
    <p className="hint">On phones, you can install this website from your browser’s menu. Local practice is available offline after the app finishes downloading.</p>
  </Screen>;
}
