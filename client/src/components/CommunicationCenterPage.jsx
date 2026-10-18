import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';
import { useTheme } from '../context/ThemeContext';
import { useGuests } from '../context/GuestContext';
import { sendStaffSms, getSmsLog } from '../services/smsService';
import { buildProfiles, normalizePhone } from '../utils/guestIdentity';
import '../styles/ComposeCard.css';

const ICONS = {
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z',
  calendar: 'M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  bed: 'M3 18V7m0 7h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5M7 11h.01',
  cash: 'M3 7h18v10H3V7Zm9 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  text: 'M4 6h16M4 12h16M4 18h10',
  send: 'M21 3 10 14M21 3l-7 18-4-7-7-4 18-7Z',
  info: 'M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z'
};
const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[name]} /></svg>
);

// Label + icon + elevated control
const Field = ({ id, label, icon, span, area, children }) => (
  <div className={`cc-field${span ? ' cc-span' : ''}`}>
    <label className="cc-label" htmlFor={id}>{label}</label>
    <div className={`cc-control${area ? ' cc-control--area' : ''}`}>{icon && <Icon name={icon} />}{children}</div>
  </div>
);

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

        <section className={`cc-card${dark ? ' cc-card--dark' : ''}`} aria-labelledby="cc-title">
          <header className="cc-head">
            <span className="cc-head-icon"><Icon name="send" /></span>
            <div>
              <h2 id="cc-title" className="cc-title">New message</h2>
              <p className="cc-sub">Send an SMS to a guest. Delivery status appears in the log below.</p>
            </div>
          </header>

          <form onSubmit={send}>
            <div className="cc-body">
              <div className="cc-grid">
                <Field id="cc-guest" label="Existing guest" icon="user" span>
                  <select id="cc-guest" defaultValue="" onChange={(e) => pickGuest(e.target.value)} className="cc-select">
                    <option value="">Pick a guest to fill in their details…</option>
                    {profiles.filter((p) => p.phones.length).map((p) => <option key={p.key} value={p.key}>{p.name} · +{p.phones[0]}</option>)}
                  </select>
                </Field>
                <Field id="cc-phone" label="Phone number" icon="phone">
                  <input id="cc-phone" type="tel" inputMode="tel" placeholder="024 123 4567" value={form.phone} onChange={set('phone')} className="cc-input" />
                </Field>
                <Field id="cc-name" label="Guest name" icon="user">
                  <input id="cc-name" placeholder="e.g. Ama Boateng" value={form.guestName} onChange={set('guestName')} className="cc-input" />
                </Field>
              </div>

              <div role="radiogroup" aria-label="Message type">
                <span className="cc-section-label">Message type</span>
                <div className="cc-chips">
                  {Object.entries(TEMPLATES).map(([key, t]) => (
                    <button key={key} type="button" role="radio" aria-checked={form.template === key} onClick={() => setForm((f) => ({ ...f, template: key }))} className="cc-chip">{t.label}</button>
                  ))}
                </div>
              </div>

              <div className="cc-grid">
                {template.fields.includes('checkInDate') && <Field id="cc-in" label="Check-in date" icon="calendar"><input id="cc-in" type="date" value={form.checkInDate} onChange={set('checkInDate')} className="cc-input" /></Field>}
                {template.fields.includes('roomNumber') && <Field id="cc-room" label="Room number (optional)" icon="bed"><input id="cc-room" placeholder="e.g. 4" value={form.roomNumber} onChange={set('roomNumber')} className="cc-input" /></Field>}
                {template.fields.includes('checkOutDate') && <Field id="cc-out" label="Check-out date" icon="calendar"><input id="cc-out" type="date" value={form.checkOutDate} onChange={set('checkOutDate')} className="cc-input" /></Field>}
                {template.fields.includes('amount') && <Field id="cc-amount" label="Amount (GH₵)" icon="cash"><input id="cc-amount" type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={set('amount')} className="cc-input" /></Field>}
                {template.fields.includes('detail') && <Field id="cc-detail" label="Update" icon="text" span><input id="cc-detail" placeholder="e.g. your laundry is ready for collection" value={form.detail} onChange={set('detail')} className="cc-input" /></Field>}
                {template.fields.includes('message') && (
                  <Field id="cc-message" label="Message" icon="text" span area>
                    <textarea id="cc-message" rows={4} maxLength={320} placeholder="Type your message" value={form.message} onChange={set('message')} className="cc-textarea" />
                    <div className={`cc-counter${form.message.length >= 320 ? ' is-max' : form.message.length >= 280 ? ' is-near' : ''}`}>{form.message.length}/320</div>
                  </Field>
                )}
              </div>

              <p className="cc-hint"><Icon name="info" />{template.hint}</p>
            </div>

            <footer className="cc-foot">
              <small>Messages longer than 160 characters use more than one SMS credit.</small>
              <button type="submit" disabled={sending} className="cc-send"><Icon name="send" />{sending ? 'Sending…' : 'Send SMS'}</button>
            </footer>
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
