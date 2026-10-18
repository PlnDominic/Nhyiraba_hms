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
  const when = (value) => new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  const detailRows = [
    template.fields.includes('checkInDate') && ['Check-in', form.checkInDate],
    template.fields.includes('roomNumber') && ['Room', form.roomNumber],
    template.fields.includes('checkOutDate') && ['Check-out', form.checkOutDate],
    template.fields.includes('amount') && ['Amount', form.amount && `GH₵${form.amount}`],
    template.fields.includes('detail') && ['Update', form.detail]
  ].filter(Boolean);
  const credits = Math.max(1, Math.ceil(form.message.length / 160));

  return (
    <DashboardLayout activeLink="Communications" title="Communication Center">
      <div className={`cc-page${dark ? ' cc-page--dark' : ''} space-y-8 pb-12`}>
        {notice && <div role="status" className={`rounded-xl border px-5 py-4 text-base ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{notice.message}</div>}
        <div>
          <h1 className="text-3xl font-bold">Communication center</h1>
          <p className="mt-1 text-base opacity-70">Send guest SMS and track delivery. Automatic messages (bookings, check-in/out) appear here too.</p>
        </div>

        <div className="cc-layout">
          <section className="cc-card" aria-labelledby="cc-title">
            <header className="cc-head">
              <span className="cc-head-icon"><Icon name="send" /></span>
              <div>
                <h2 id="cc-title" className="cc-title">New message</h2>
                <p className="cc-sub">Three quick steps: choose who, what, then the details.</p>
              </div>
            </header>

            <form onSubmit={send}>
              <div className="cc-section">
                <h3 className="cc-step"><span className="cc-step-num">1</span>Who is it for?</h3>
                <p className="cc-step-help">Pick an existing guest to fill this in, or type a number.</p>
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
              </div>

              <div className="cc-section">
                <h3 className="cc-step"><span className="cc-step-num">2</span>What do you want to send?</h3>
                <p className="cc-step-help">Choose a message type.</p>
                <div className="cc-types" role="radiogroup" aria-label="Message type">
                  {Object.entries(TEMPLATES).map(([key, t]) => (
                    <button key={key} type="button" role="radio" aria-checked={form.template === key} onClick={() => setForm((f) => ({ ...f, template: key }))} className="cc-type">
                      <b>{t.label}</b>
                      <span>{t.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="cc-section">
                <h3 className="cc-step"><span className="cc-step-num">3</span>Details</h3>
                <p className="cc-step-help">{template.hint}</p>
                <div className="cc-grid">
                  {template.fields.includes('checkInDate') && <Field id="cc-in" label="Check-in date" icon="calendar"><input id="cc-in" type="date" value={form.checkInDate} onChange={set('checkInDate')} className="cc-input" /></Field>}
                  {template.fields.includes('roomNumber') && <Field id="cc-room" label="Room number (optional)" icon="bed"><input id="cc-room" placeholder="e.g. 4" value={form.roomNumber} onChange={set('roomNumber')} className="cc-input" /></Field>}
                  {template.fields.includes('checkOutDate') && <Field id="cc-out" label="Check-out date" icon="calendar"><input id="cc-out" type="date" value={form.checkOutDate} onChange={set('checkOutDate')} className="cc-input" /></Field>}
                  {template.fields.includes('amount') && <Field id="cc-amount" label="Amount (GH₵)" icon="cash"><input id="cc-amount" type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={set('amount')} className="cc-input" /></Field>}
                  {template.fields.includes('detail') && <Field id="cc-detail" label="Update" icon="text" span><input id="cc-detail" placeholder="e.g. your laundry is ready for collection" value={form.detail} onChange={set('detail')} className="cc-input" /></Field>}
                  {template.fields.includes('message') && (
                    <Field id="cc-message" label="Message" icon="text" span area>
                      <textarea id="cc-message" rows={5} maxLength={320} placeholder="Type your message" value={form.message} onChange={set('message')} className="cc-textarea" />
                      <div className={`cc-counter${form.message.length >= 320 ? ' is-max' : form.message.length >= 280 ? ' is-near' : ''}`}>{form.message.length}/320</div>
                    </Field>
                  )}
                </div>
              </div>

              <footer className="cc-foot">
                <small>Messages longer than 160 characters use more than one SMS credit.</small>
                <button type="submit" disabled={sending} className="cc-send"><Icon name="send" />{sending ? 'Sending…' : 'Send SMS'}</button>
              </footer>
            </form>
          </section>

          <aside className="cc-card cc-side" aria-label="Message summary">
            <div className="cc-side-body">
              <h3>Summary</h3>
              <dl className="cc-sum">
                <div><dt>To</dt><dd className={form.guestName || form.phone ? '' : 'is-empty'}>{form.guestName || form.phone ? <>{form.guestName || 'Guest'}{form.phone && <><br />{form.phone}</>}</> : 'Nobody selected yet'}</dd></div>
                <div><dt>Type</dt><dd>{template.label}</dd></div>
                {detailRows.map(([label, value]) => (
                  <div key={label}><dt>{label}</dt><dd className={value ? '' : 'is-empty'}>{value || 'Not filled in yet'}</dd></div>
                ))}
              </dl>
              {form.template === 'custom' && form.message && (
                <div>
                  <dt className="cc-sum-title" style={{ fontSize: 12, fontWeight: 650, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7, marginBottom: 8 }}>Preview</dt>
                  <div className="cc-bubble">{form.message}</div>
                  <p className="cc-note" style={{ marginTop: 10 }}>{form.message.length} characters · {credits} SMS credit{credits !== 1 ? 's' : ''}</p>
                </div>
              )}
              <p className="cc-note"><Icon name="info" /><span>Delivery status appears in the message log below once the SMS is sent.</span></p>
            </div>
          </aside>
        </div>

        <section className="cc-card cc-log" aria-labelledby="cc-log-title">
          <div className="cc-log-head">
            <h2 id="cc-log-title">Message log</h2>
            <button type="button" onClick={loadLog} disabled={loadingLog} className="cc-btn">{loadingLog ? 'Refreshing…' : 'Refresh status'}</button>
          </div>
          {logError && <div className="cc-warnbox">Could not load the log: {logError}. Has the SMS tracking migration been run?</div>}
          {!logError && log.length === 0 && !loadingLog && <div className="cc-empty">No messages yet.</div>}
          <ul className="cc-log-list">
            {log.map((m) => (
              <li key={m.id} className="cc-log-item">
                <div className="cc-log-who">
                  <b>{m.phone}</b>
                  <span>{when(m.created_at)}</span>
                  <span>{templateLabel(m.event)}{m.retry_of ? ' · retry' : ''}</span>
                </div>
                <div>
                  <div className="cc-log-msg">{m.message}</div>
                  <div className="cc-log-meta">
                    <span className="cc-badge" data-tone={STATUS_TONE[m.status] || 'neutral'}>{m.status}</span>
                    {m.error && <span className="cc-log-error">{m.error}</span>}
                  </div>
                </div>
                <div>{RETRYABLE.includes(m.status) && !retriedIds.has(m.id) && <button type="button" onClick={() => retry(m)} className="cc-retry">Retry</button>}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DashboardLayout>
  );
};

export default CommunicationCenterPage;
