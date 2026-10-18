import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';
import { useTheme } from '../context/ThemeContext';
import { useGuests } from '../context/GuestContext';
import { sendStaffSms, getSmsLog } from '../services/smsService';
import { buildProfiles, normalizePhone } from '../utils/guestIdentity';
import '../styles/ComposeCard.css';

// Label + control
const Field = ({ id, label, children }) => (
  <div className="cc-field">
    <label className="cc-label" htmlFor={id}>{label}</label>
    {children}
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
const STATUS_TONE = {
  DELIVERED: 'ok', SUBMITTED: 'info', QUEUED: 'warn',
  FAILED: 'bad', REJECTD: 'bad', NOT_DELIVERED: 'bad', PROHIBITED: 'bad', EXPIRED: 'bad'
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

  const templateLabel = (key) => TEMPLATES[key]?.label || String(key || '').replace(/_/g, ' ');
  const when = (value) => new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const has = (field) => template.fields.includes(field);

  return (
    <DashboardLayout activeLink="Communications" title="Communication Center">
      <div className={`cc-page${dark ? ' cc-page--dark' : ''} space-y-6 pb-10`}>
        {notice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{notice.message}</div>}
        <div>
          <h1 className="text-2xl font-bold">Communication center</h1>
          <p className="text-sm opacity-70">Send guest SMS and track delivery.</p>
        </div>

        <section className="cc-card" aria-labelledby="cc-title">
          <div className="cc-card-head"><h2 id="cc-title">Send an SMS</h2></div>
          <form onSubmit={send} className="cc-body">
            <Field id="cc-guest" label="Guest">
              <select id="cc-guest" defaultValue="" onChange={(e) => pickGuest(e.target.value)} className="cc-select">
                <option value="">Choose a guest, or type the details below</option>
                {profiles.filter((p) => p.phones.length).map((p) => <option key={p.key} value={p.key}>{p.name} · +{p.phones[0]}</option>)}
              </select>
            </Field>

            <div className="cc-row">
              <Field id="cc-phone" label="Phone number">
                <input id="cc-phone" type="tel" inputMode="tel" placeholder="024 123 4567" value={form.phone} onChange={set('phone')} className="cc-input" />
              </Field>
              <Field id="cc-name" label="Guest name">
                <input id="cc-name" placeholder="e.g. Ama Boateng" value={form.guestName} onChange={set('guestName')} className="cc-input" />
              </Field>
            </div>

            <Field id="cc-type" label="Message">
              <select id="cc-type" value={form.template} onChange={set('template')} className="cc-select">
                {Object.entries(TEMPLATES).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
              </select>
              <p className="cc-help">{template.hint}</p>
            </Field>

            {(has('checkInDate') || has('roomNumber') || has('checkOutDate') || has('amount')) && (
              <div className="cc-row">
                {has('checkInDate') && <Field id="cc-in" label="Check-in date"><input id="cc-in" type="date" value={form.checkInDate} onChange={set('checkInDate')} className="cc-input" /></Field>}
                {has('roomNumber') && <Field id="cc-room" label="Room (optional)"><input id="cc-room" placeholder="e.g. 4" value={form.roomNumber} onChange={set('roomNumber')} className="cc-input" /></Field>}
                {has('checkOutDate') && <Field id="cc-out" label="Check-out date"><input id="cc-out" type="date" value={form.checkOutDate} onChange={set('checkOutDate')} className="cc-input" /></Field>}
                {has('amount') && <Field id="cc-amount" label="Amount (GH₵)"><input id="cc-amount" type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={set('amount')} className="cc-input" /></Field>}
              </div>
            )}
            {has('detail') && <Field id="cc-detail" label="Update"><input id="cc-detail" placeholder="e.g. your laundry is ready for collection" value={form.detail} onChange={set('detail')} className="cc-input" /></Field>}
            {has('message') && (
              <Field id="cc-message" label="Your message">
                <textarea id="cc-message" rows={4} maxLength={320} placeholder="Type your message" value={form.message} onChange={set('message')} className="cc-textarea" />
                <span className={`cc-counter${form.message.length >= 320 ? ' is-max' : form.message.length >= 280 ? ' is-near' : ''}`}>{form.message.length}/320</span>
              </Field>
            )}

            <div className="cc-actions">
              <p className="cc-help">Over 160 characters uses more than one SMS credit.</p>
              <button type="submit" disabled={sending} className="cc-send">{sending ? 'Sending…' : 'Send SMS'}</button>
            </div>
          </form>
        </section>

        <section className="cc-card cc-log" aria-labelledby="cc-log-title">
          <div className="cc-card-head">
            <h2 id="cc-log-title">Message log</h2>
            <button type="button" onClick={loadLog} disabled={loadingLog} className="cc-btn">{loadingLog ? 'Refreshing…' : 'Refresh'}</button>
          </div>
          {logError && <div className="cc-warnbox">Could not load the log: {logError}. Has the SMS tracking migration been run?</div>}
          {!logError && log.length === 0 && !loadingLog && <div className="cc-empty">No messages yet.</div>}
          {log.length > 0 && (
            <div className="cc-scroll">
              <table className="cc-table">
                <thead><tr><th>Sent</th><th>To</th><th>Message</th><th>Status</th><th /></tr></thead>
                <tbody>
                  {log.map((m) => (
                    <tr key={m.id}>
                      <td className="cc-when">{when(m.created_at)}</td>
                      <td><div>{m.phone}</div><div className="cc-help">{templateLabel(m.event)}{m.retry_of ? ' · retry' : ''}</div></td>
                      <td className="cc-msg">{m.message}</td>
                      <td><span className="cc-badge" data-tone={STATUS_TONE[m.status] || 'neutral'}>{m.status}</span>{m.error && <div className="cc-err">{m.error}</div>}</td>
                      <td>{RETRYABLE.includes(m.status) && !retriedIds.has(m.id) && <button type="button" onClick={() => retry(m)} className="cc-retry">Retry</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
};

export default CommunicationCenterPage;
