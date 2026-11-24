import { useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/http';
import { useAuth } from '../auth/AuthContext';
import { Alert, Button, Field, inputClass, PageTitle } from '../components/ui';

function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md">
      <PageTitle title={title} subtitle={subtitle} />
      <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">{children}</div>
      {footer && <div className="mt-5 text-center text-sm text-slate-600">{footer}</div>}
    </div>
  );
}

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await signIn(email.trim(), password);
      const fallback = user.role === 'admin' ? '/admin' : '/dashboard';
      navigate(next && next.startsWith('/') ? next : fallback, { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Those details do not match an active account.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back. Sign in to manage listings, favourites and enquiries."
      footer={<>New here? <Link to="/register" className="font-semibold text-brand-700 hover:underline">Create a free account</Link></>}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        <Field label="Email" htmlFor="login-email">
          <input id="login-email" type="email" required autoComplete="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" htmlFor="login-password">
          <input id="login-password" type="password" required autoComplete="current-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        <p className="text-center text-sm">
          <Link to="/forgot-password" className="text-brand-700 hover:underline">Forgot your password?</Link>
        </p>
      </form>
    </AuthShell>
  );
}

export function RegisterPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialRole = searchParams.get('role') === 'seller' ? 'seller' : searchParams.get('role') === 'dealer' ? 'dealer' : 'buyer';
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', role: initialRole, password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(key: keyof typeof form) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: event.target.value });
  }

  function validate(): Record<string, string> {
    const problems: Record<string, string> = {};
    if (!form.full_name.trim()) problems.full_name = 'Enter your full name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) problems.email = 'Enter a valid email address.';
    if (form.password.length < 8) problems.password = 'Use at least 8 characters.';
    if (form.password !== form.confirm) problems.confirm = 'The passwords do not match.';
    return problems;
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const problems = validate();
    setErrors(problems);
    setFormError('');
    if (Object.keys(problems).length) return;
    setBusy(true);
    try {
      await endpoints.register({
        email: form.email.trim(), full_name: form.full_name.trim(), phone: form.phone.trim(),
        role: form.role, password: form.password,
      });
      const user = await signIn(form.email.trim(), form.password);
      navigate(user.role === 'seller' || user.role === 'dealer' ? '/dashboard' : '/vehicles', { replace: true });
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      if (data && typeof data === 'object' && !('detail' in data)) {
        const mapped: Record<string, string> = {};
        for (const [field, value] of Object.entries(data)) {
          mapped[field] = Array.isArray(value) ? String(value[0]) : String(value);
        }
        setErrors(mapped);
      } else {
        setFormError(errorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Buy freely, or list your cars as a seller or dealer."
      footer={<>Already registered? <Link to="/login" className="font-semibold text-brand-700 hover:underline">Sign in</Link></>}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <Field label="I want to" htmlFor="reg-role" hint="You can change this later in your account settings.">
          <select id="reg-role" className={inputClass} value={form.role} onChange={update('role')}>
            <option value="buyer">Buy vehicles</option>
            <option value="seller">Sell my own vehicles</option>
            <option value="dealer">Run a dealership</option>
          </select>
        </Field>
        <Field label="Full name" htmlFor="reg-name" error={errors.full_name}>
          <input id="reg-name" required autoComplete="name" className={inputClass} value={form.full_name} onChange={update('full_name')} />
        </Field>
        <Field label="Email" htmlFor="reg-email" error={errors.email}>
          <input id="reg-email" type="email" required autoComplete="email" className={inputClass} value={form.email} onChange={update('email')} />
        </Field>
        <Field label="Phone (optional)" htmlFor="reg-phone" error={errors.phone} hint="Used so buyers can reach you. Tanzanian mobile numbers only.">
          <input id="reg-phone" type="tel" autoComplete="tel" className={inputClass} value={form.phone} onChange={update('phone')} />
        </Field>
        <Field label="Password" htmlFor="reg-password" error={errors.password} hint="At least 8 characters. Avoid common passwords.">
          <input id="reg-password" type="password" required autoComplete="new-password" className={inputClass} value={form.password} onChange={update('password')} />
        </Field>
        <Field label="Confirm password" htmlFor="reg-confirm" error={errors.confirm}>
          <input id="reg-confirm" type="password" required autoComplete="new-password" className={inputClass} value={form.confirm} onChange={update('confirm')} />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</Button>
      </form>
    </AuthShell>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await endpoints.requestPasswordReset(email.trim());
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell title="Reset your password" subtitle="Enter your account email and we will send a reset link.">
      {done ? (
        <Alert tone="success">If that email is registered, a reset link is on its way. Check your spam folder too.</Alert>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="Email" htmlFor="fp-email">
            <input id="fp-email" type="email" required autoComplete="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</Button>
        </form>
      )}
      <p className="text-center text-sm"><Link to="/login" className="text-brand-700 hover:underline">Back to sign in</Link></p>
    </AuthShell>
  );
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const uid = searchParams.get('uid') ?? '';
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) {
      setError('The passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await endpoints.confirmPasswordReset(uid, token, password);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!uid || !token) {
    return (
      <AuthShell title="Reset link incomplete">
        <Alert tone="error">This link is incomplete. Request a new one from the reset page.</Alert>
        <Link to="/forgot-password" className="block text-center text-brand-700 hover:underline">Request a new link</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password">
      {done ? (
        <>
          <Alert tone="success">Your password has been reset.</Alert>
          <Link to="/login" className="block text-center font-semibold text-brand-700 hover:underline">Sign in with your new password</Link>
        </>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {error && <Alert tone="error">{error}</Alert>}
          <Field label="New password" htmlFor="rp-password" hint="At least 8 characters.">
            <input id="rp-password" type="password" required autoComplete="new-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Field label="Confirm new password" htmlFor="rp-confirm">
            <input id="rp-confirm" type="password" required autoComplete="new-password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Saving…' : 'Set new password'}</Button>
        </form>
      )}
    </AuthShell>
  );
}
