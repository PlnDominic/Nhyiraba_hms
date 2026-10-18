import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import supabase from '../supabaseClient';
import { useUser } from '../context/UserContext';
import { MIN_LENGTH, validatePassword } from '../utils/passwordPolicy';

/**
 * Shown to anyone whose account was created with a temporary password
 * (user_profiles.password_change_required). The rest of the app is locked until it is replaced.
 */
const ChangePasswordPage = () => {
  const { user, setCurrentUser } = useUser();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problems, setProblems] = useState([]);
  const [saving, setSaving] = useState(false);
  const forced = Boolean(user?.passwordChangeRequired);

  const submit = async (event) => {
    event.preventDefault();
    const found = validatePassword(password, { email: user?.email });
    if (password !== confirm) found.push('The two passwords do not match.');
    setProblems(found);
    if (found.length) return;

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.from('user_profiles').update({ password_change_required: false }).eq('user_id', user.id);
      await setCurrentUser({ ...user, passwordChangeRequired: false });
      toast.success('Password updated');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      setProblems([error.message || 'Could not update the password. Please try again.']);
    } finally {
      setSaving(false);
    }
  };

  const field = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-8 shadow-xl">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{forced ? 'Choose a new password' : 'Change password'}</h1>
          {forced && <p className="mt-1 text-sm text-slate-600">You signed in with a temporary password. Please set your own before continuing.</p>}
        </div>
        {problems.length > 0 && (
          <ul role="alert" className="list-disc space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 pl-7 text-sm text-red-700">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
        <label className="block text-sm font-medium text-slate-700">New password
          <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`${field} mt-1`} />
        </label>
        <label className="block text-sm font-medium text-slate-700">Confirm new password
          <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`${field} mt-1`} />
        </label>
        <p className="text-xs text-slate-500">At least {MIN_LENGTH} characters with upper and lower case letters and a number.</p>
        <button disabled={saving} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Save password'}</button>
      </form>
    </div>
  );
};

export default ChangePasswordPage;
