import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import * as endpoints from '../api/endpoints';
import { errorMessage } from '../api/http';
import type { Role } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Alert, Button, Card, Field, PageTitle, inputClass } from '../components/ui';
import { REGIONS } from '../lib/regions';

const ROLE_OPTIONS: { value: Role; label: string; hint: string }[] = [
  { value: 'buyer', label: 'Buyer', hint: 'Search, save favourites and contact sellers.' },
  { value: 'seller', label: 'Individual seller', hint: 'Publish your own vehicles.' },
  { value: 'dealer', label: 'Dealer', hint: 'Publish stock under a dealership profile and get verified.' },
];

export default function Account() {
  const { user, refreshUser } = useAuth();
  const [profile, setProfile] = useState({ full_name: '', phone: '', region: '', city: '', role: 'buyer' as Role });
  const [profileStatus, setProfileStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [passwords, setPasswords] = useState({ old_password: '', new_password: '', confirm: '' });
  const [passwordStatus, setPasswordStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    if (user) {
      setProfile({
        full_name: user.full_name, phone: user.phone, region: user.region ?? '', city: user.city ?? '',
        role: user.role === 'admin' ? 'buyer' : user.role,
      });
    }
  }, [user]);

  if (!user) return null;

  const set = (key: keyof typeof profile) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setProfile({ ...profile, [key]: e.target.value });

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setProfileStatus(null);
    try {
      await endpoints.updateMe({ ...profile, region: profile.region || undefined });
      await refreshUser();
      setProfileStatus({ tone: 'success', text: 'Your profile has been saved.' });
    } catch (err) {
      setProfileStatus({ tone: 'error', text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordStatus(null);
    if (passwords.new_password !== passwords.confirm) {
      setPasswordStatus({ tone: 'error', text: 'The new passwords do not match.' });
      return;
    }
    setChanging(true);
    try {
      await endpoints.changePassword(passwords.old_password, passwords.new_password);
      setPasswords({ old_password: '', new_password: '', confirm: '' });
      setPasswordStatus({ tone: 'success', text: 'Password updated.' });
    } catch (err) {
      setPasswordStatus({ tone: 'error', text: errorMessage(err) });
    } finally {
      setChanging(false);
    }
  }

  return (
    <>
      <PageTitle title="My account" subtitle={`Signed in as ${user.email}`} />
      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold text-slate-900">Profile</h2>
          <form onSubmit={saveProfile} className="space-y-4" noValidate>
            {profileStatus && <Alert tone={profileStatus.tone === 'success' ? 'success' : 'error'}>{profileStatus.text}</Alert>}
            <Field label="Full name" htmlFor="a-name">
              <input id="a-name" required className={inputClass} value={profile.full_name} onChange={set('full_name')} />
            </Field>
            <Field label="Phone" htmlFor="a-phone" hint="Tanzanian mobile number, used on your listings">
              <input id="a-phone" type="tel" className={inputClass} value={profile.phone} onChange={set('phone')} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Region" htmlFor="a-region">
                <select id="a-region" className={inputClass} value={profile.region} onChange={set('region')}>
                  <option value="">Not set</option>
                  {REGIONS.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>
              <Field label="City or area" htmlFor="a-city">
                <input id="a-city" className={inputClass} value={profile.city} onChange={set('city')} />
              </Field>
            </div>
            <fieldset>
              <legend className="text-sm font-medium text-slate-700">Account type</legend>
              <div className="mt-2 space-y-2">
                {ROLE_OPTIONS.map((option) => (
                  <label key={option.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50/50">
                    <input type="radio" name="role" value={option.value} checked={profile.role === option.value} onChange={set('role')} className="mt-1 accent-brand-600" />
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                      <span className="block text-xs text-slate-600">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</Button>
          </form>
        </Card>

        <div className="space-y-8">
          <Card>
            <h2 className="mb-4 font-semibold text-slate-900">Change password</h2>
            <form onSubmit={changePassword} className="space-y-4" noValidate>
              {passwordStatus && <Alert tone={passwordStatus.tone === 'success' ? 'success' : 'error'}>{passwordStatus.text}</Alert>}
              <Field label="Current password" htmlFor="p-old">
                <input id="p-old" type="password" required autoComplete="current-password" className={inputClass} value={passwords.old_password} onChange={(e) => setPasswords({ ...passwords, old_password: e.target.value })} />
              </Field>
              <Field label="New password" htmlFor="p-new" hint="At least 8 characters.">
                <input id="p-new" type="password" required autoComplete="new-password" className={inputClass} value={passwords.new_password} onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} />
              </Field>
              <Field label="Confirm new password" htmlFor="p-confirm">
                <input id="p-confirm" type="password" required autoComplete="new-password" className={inputClass} value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
              </Field>
              <Button type="submit" variant="secondary" disabled={changing}>{changing ? 'Updating…' : 'Update password'}</Button>
            </form>
          </Card>
          <Card>
            <h2 className="font-semibold text-slate-900">Verification</h2>
            <p className="mt-2 text-sm text-slate-600">
              {user.is_verified ? 'Your account is verified. Verified sellers display a badge on their listings.' : 'Verified sellers build trust. Submit your National ID or TIN for review.'}
            </p>
            {!user.is_verified && user.role !== 'buyer' && <VerificationLink role={user.role} />}
          </Card>
        </div>
      </div>
    </>
  );
}

function VerificationLink({ role }: { role: Role }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  if (role === 'dealer') {
    return <p className="mt-3 text-sm"><a href="/dealer" className="font-semibold text-brand-700 hover:underline">Go to your dealership profile to request verification</a></p>;
  }
  if (sent) return <Alert tone="success" >Request received. We will review it and let you know.</Alert>;
  return (
    <form className="mt-4 space-y-3" onSubmit={async (event) => {
      event.preventDefault();
      setBusy(true);
      setError('');
      try {
        await endpoints.requestVerification({ kind: 'seller', reference_number: ref.trim(), details: '' });
        setSent(true);
      } catch (err) {
        setError(errorMessage(err));
      } finally {
        setBusy(false);
      }
    }}>
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="National ID (NIDA) number" htmlFor="sv-ref">
        <input id="sv-ref" required className={inputClass} value={ref} onChange={(e) => setRef(e.target.value)} />
      </Field>
      <Button type="submit" variant="secondary" disabled={busy}>Request seller verification</Button>
    </form>
  );
}
