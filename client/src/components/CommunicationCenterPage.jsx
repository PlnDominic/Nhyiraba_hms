import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';
import { useTheme } from '../context/ThemeContext';
import { useGuests } from '../context/GuestContext';
import { sendStaffSms, getSmsLog } from '../services/smsService';
import { buildProfiles, normalizePhone } from '../utils/guestIdentity';

const TEMPLATES = {
  arrival_reminder: { label: 'Arrival reminder', fields: ['checkInDate', 'roomNumber'], hint: 'Reminds the guest of their arrival date.' },
  checkout_reminder: { label: 'Check-out reminder', fields: ['checkOutDate'], hint: 'Check-out is at 12:00 noon on the chosen date.' },
  payment_reminder: { label: 'Payment reminder', fields: ['amount'], hint: 'States the outstanding balance in GH₵.' },
  service_update: { label: 'Service update', fields: ['detail'], hint: 'Sends your update after a standard greeting.' },
  custom: { label: 'Custom message', fields: ['message'], hint: 'Your own text (max 320 characters).' }
};
const RETRYABLE = ['FAILED', 'REJECTD', 'NOT_DELIVERED', 'EXPIRED'];
const STATUS_STYLE = {
  DELIVERED: 'bg-emerald-100 text-emerald-800',
  SUBMITTING: 'bg-slate-100 text-slate-700',
  PENDING: 'bg-slate-100 text-slate-700',
  SUBMITTED: 'bg-blue-100 text-blue-800',
  QUEUED: 'bg-amber-100 text-amber-800',
  FAILED: 'bg-red-100 text-red-800',
  REJECTD: 'bg-red-100 text-red-800',
  NOT_DELIVERED: 'bg-red-100 text-red-800',
  PROHIBITED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-red-100 text-red-800'
};

const CommunicationCenterPage = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { guestList } = useGuests() || {};
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    phone: searchParams.get('phone') || '',
    guestName: searchParams.get('name') || '',
    template: 'arrival_reminder',
    checkInDate: '', checkOutDate: '', roomNumber: '', amount: '', detail: '', message: ''
  });
  const [log, setLog] = useState([]);
  const [logError, setLogError] = useState(null);
  const [loadingLog, setLoadingLog] = useState(true);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState(null);

  const panel = `rounded-2xl border p-5 shadow-sm ${dark ? 'border-slate-700 bg-slate-900/70 text-white' : 'border-slate-200 bg-white text-slate-900'}`;
  const input = `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${dark ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`;
  const profiles = useMemo(() => buildProfiles(guestList || []), [guestList]);
  const template = TEMPLATES[form.template];

  const flash = useCallback((message, type = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 5000);
  }, []);

  const loadLog = useCallback(async () => {
    setLoadingLog(true);
    const result = await getSmsLog(50);
    setLog(result.data || []);
    setLogError(result.success ? null : result.error);
    setLoadingLog(false);
  }, []);
  useEffect(() => { loadLog(); }, [loadLog]);

  const set = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  const pickGuest = (key) => {
    const profile = profiles.find((p) => p.key === key);
    if (profile) setForm((f) => ({ ...f, guestName: profile.name, phone: profile.phones[0] ? `+${profile.phones[0]}` : '' }));
  };

  const send = async (event) => {
    event.preventDefault();
    if (!normalizePhone(form.phone)) return flash('Enter a valid phone number.', 'error');
    const missing = template.fields.find((f) => !String(form[f] || '').trim());
    if (missing) return flash('Please fill in all fields for this template.', 'error');
    if (form.template === 'custom' && form.message.length > 320) return flash('Messages are limited to 320 characters.', 'error');

    setSending(true);
    const data = {
      guestName: form.guestName || 'Guest',
      checkInDate: form.checkInDate, checkOutDate: form.checkOutDate, roomNumber: form.roomNumber,
      amount: form.amount, detail: form.detail, message: form.message
    };
    const result = await sendStaffSms(form.template, form.phone, data);
    setSending(false);
    if (result.skipped) flash('SMS is not configured on the server.', 'error');
    else if (!result.success) flash(`Not sent: ${result.error}`, 'error');
    else flash('Message sent. Delivery status will update below.');
    loadLog();
  };

  const retry = async (entry) => {
    const result = await sendStaffSms('custom', entry.phone, { message: entry.message }, { retryOf: entry.id });
    if (!result.success) flash(`Retry failed: ${result.error}`, 'error');
    else flash('Message re-sent.');
    loadLog();
  };

  const retriedIds = useMemo(() => new Set(log.map((m) => m.retry_of).filter(Boolean)), [log]);

  return (
    <DashboardLayout activeLink="Communications" title="Communication Center">
      <div className="space-y-6 pb-10">
        {notice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{notice.message}</div>}
        <div>
          <h1 className="text-2xl font-bold">Communication center</h1>
          <p className="text-sm opacity-70">Send guest SMS and track delivery. Automatic messages (bookings, check-in/out) appear here too.</p>
        </div>

        <section className={panel}>
          <h2 className="mb-3 text-lg font-semibold">New message</h2>
          <form onSubmit={send} className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <select aria-label="Pick an existing guest" defaultValue="" onChange={(e) => pickGuest(e.target.value)} className={input}>
              <option value="">Pick an existing guest…</option>
              {profiles.filter((p) => p.phones.length).map((p) => <option key={p.key} value={p.key}>{p.name} · +{p.phones[0]}</option>)}
            </select>
            <input aria-label="Phone number" placeholder="Phone (e.g. 024 123 4567)" value={form.phone} onChange={set('phone')} className={input} />
            <input aria-label="Guest name" placeholder="Guest name" value={form.guestName} onChange={set('guestName')} className={input} />
            <select aria-label="Template" value={form.template} onChange={set('template')} className={input}>
              {Object.entries(TEMPLATES).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
            </select>
            {template.fields.includes('checkInDate') && <input aria-label="Check-in date" type="date" value={form.checkInDate} onChange={set('checkInDate')} className={input} />}
            {template.fields.includes('roomNumber') && <input aria-label="Room number" placeholder="Room number (optional)" value={form.roomNumber} onChange={set('roomNumber')} className={input} />}
            {template.fields.includes('checkOutDate') && <input aria-label="Check-out date" type="date" value={form.checkOutDate} onChange={set('checkOutDate')} className={input} />}
            {template.fields.includes('amount') && <input aria-label="Amount" type="number" min="0" step="0.01" placeholder="Amount (GH₵)" value={form.amount} onChange={set('amount')} className={input} />}
            {template.fields.includes('detail') && <input aria-label="Update details" placeholder="e.g. your laundry is ready for collection" value={form.detail} onChange={set('detail')} className={`${input} md:col-span-2`} />}
            {template.fields.includes('message') && (
              <div className="md:col-span-2">
                <textarea aria-label="Message" rows={3} maxLength={320} placeholder="Type your message" value={form.message} onChange={set('message')} className={input} />
                <div className="mt-1 text-right text-xs opacity-60">{form.message.length}/320</div>
              </div>
            )}
            <p className="text-xs opacity-60 md:col-span-2">{template.hint}</p>
            <button disabled={sending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2">{sending ? 'Sending…' : 'Send SMS'}</button>
          </form>
        </section>

        <section className={panel}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Message log</h2>
            <button onClick={loadLog} disabled={loadingLog} className="rounded-lg border px-3 py-1.5 text-sm font-semibold">{loadingLog ? 'Refreshing…' : 'Refresh status'}</button>
          </div>
          {logError && <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Could not load the log: {logError}. Has the SMS tracking migration been run?</div>}
          {!logError && log.length === 0 && !loadingLog && <p className="text-sm opacity-60">No messages yet.</p>}
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b"><th className="px-2 py-2">Sent</th><th className="px-2 py-2">To</th><th className="px-2 py-2">Type</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Message</th><th className="px-2 py-2" /></tr></thead>
              <tbody>
                {log.map((m) => (
                  <tr key={m.id} className="border-b align-top last:border-0">
                    <td className="whitespace-nowrap px-2 py-2">{new Date(m.created_at).toLocaleString()}</td>
                    <td className="px-2 py-2">{m.phone}</td>
                    <td className="px-2 py-2">{m.event}{m.retry_of ? ' (retry)' : ''}</td>
                    <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[m.status] || 'bg-slate-100 text-slate-700'}`}>{m.status}</span>{m.error && <div className="mt-1 text-xs text-red-600">{m.error}</div>}</td>
                    <td className="max-w-xs px-2 py-2">{m.message}</td>
                    <td className="px-2 py-2">{RETRYABLE.includes(m.status) && !retriedIds.has(m.id) && <button onClick={() => retry(m)} className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white">Retry</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default CommunicationCenterPage;
