import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';
import { useTheme } from '../context/ThemeContext';
import { useGuests } from '../context/GuestContext';
import { sendStaffSms, getSmsLog } from '../services/smsService';
import { buildProfiles, normalizePhone } from '../utils/guestIdentity';
import '../styles/ComposeCard.css';

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
  const when = (value) => {
    const d = new Date(value);
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay
      ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };
  const has = (f) => template.fields.includes(f);
  const near = form.message.length >= 280;

  return (
    <DashboardLayout activeLink="Communications" title="Communication Center">
      <div className={`cc-page${dark ? ' cc-page--dark' : ''} pb-12`}>
        <h1 className="cc-title">Messages</h1>
        {notice && <div role="status" className="cc-toast" data-type={notice.type}>{notice.message}</div>}

        <form onSubmit={send}>
          <div className="cc-group-wrap">
            <p className="cc-group-title">To</p>
            <div className="cc-group">
              <label className="cc-row">
                <span className="cc-row-label">Guest</span>
                <select defaultValue="" onChange={(e) => { pickGuest(e.target.value); e.target.classList.toggle('has-value', !!e.target.value); }} className="cc-field" aria-label="Existing guest">
                  <option value="">Choose</option>
                  {profiles.filter((p) => p.phones.length).map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                </select>
              </label>
              <label className="cc-row">
                <span className="cc-row-label">Phone</span>
                <input type="tel" inputMode="tel" placeholder="024 123 4567" value={form.phone} onChange={set('phone')} className="cc-field" />
              </label>
              <label className="cc-row">
                <span className="cc-row-label">Name</span>
                <input placeholder="Optional" value={form.guestName} onChange={set('guestName')} className="cc-field" />
              </label>
            </div>
          </div>

          <div className="cc-group-wrap">
            <p className="cc-group-title">Message</p>
            <div className="cc-group">
              <label className="cc-row">
                <span className="cc-row-label">Type</span>
                <select value={form.template} onChange={(e) => setForm((f) => ({ ...f, template: e.target.value }))} className="cc-field has-value" aria-label="Message type">
                  {Object.entries(TEMPLATES).map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
                </select>
              </label>
              {has('checkInDate') && <label className="cc-row"><span className="cc-row-label">Check-in</span><input type="date" value={form.checkInDate} onChange={set('checkInDate')} className="cc-field" /></label>}
              {has('roomNumber') && <label className="cc-row"><span className="cc-row-label">Room</span><input placeholder="Optional" value={form.roomNumber} onChange={set('roomNumber')} className="cc-field" /></label>}
              {has('checkOutDate') && <label className="cc-row"><span className="cc-row-label">Check-out</span><input type="date" value={form.checkOutDate} onChange={set('checkOutDate')} className="cc-field" /></label>}
              {has('amount') && <label className="cc-row"><span className="cc-row-label">Amount</span><input type="number" min="0" step="0.01" placeholder="GH₵ 0.00" value={form.amount} onChange={set('amount')} className="cc-field" /></label>}
              {has('detail') && <label className="cc-row"><span className="cc-row-label">Update</span><input placeholder="e.g. laundry is ready" value={form.detail} onChange={set('detail')} className="cc-field" /></label>}
              {has('message') && (
                <div className="cc-row cc-row--area">
                  <textarea rows={4} maxLength={320} placeholder="Message" value={form.message} onChange={set('message')} className="cc-area" aria-label="Message" />
                  <div className={`cc-count${form.message.length >= 320 ? ' is-max' : near ? ' is-near' : ''}`}>{form.message.length}/320</div>
                </div>
              )}
            </div>
            <p className="cc-foot-note">{template.hint} Over 160 characters uses more than one SMS credit.</p>
          </div>

          <div className="cc-group-wrap">
            <button type="submit" disabled={sending} className="cc-send">{sending ? 'Sending…' : 'Send'}</button>
          </div>
        </form>

        <div className="cc-group-wrap">
          <div className="cc-list-head">
            <p className="cc-group-title">Recent</p>
            <button type="button" onClick={loadLog} disabled={loadingLog} className="cc-link">{loadingLog ? 'Refreshing…' : 'Refresh'}</button>
          </div>
          <div className="cc-group">
            {logError && <div className="cc-empty">Could not load messages: {logError}</div>}
            {!logError && log.length === 0 && !loadingLog && <div className="cc-empty">No messages yet</div>}
            {log.map((m) => {
              const tone = STATUS_TONE[m.status] || 'neutral';
              const canRetry = RETRYABLE.includes(m.status) && !retriedIds.has(m.id);
              return (
                <div key={m.id} className="cc-msg">
                  <div className="cc-msg-top">
                    <span className="cc-msg-to">{m.phone}</span>
                    <span className="cc-msg-time">{when(m.created_at)}</span>
                  </div>
                  <div className="cc-msg-text" title={m.message}>{m.message}</div>
                  <div className="cc-msg-bottom">
                    <span className="cc-status" data-tone={tone}>
                      {templateLabel(m.event)}{m.retry_of ? ' · retry' : ''} · {m.status.charAt(0) + m.status.slice(1).toLowerCase().replace(/_/g, ' ')}{m.error ? ` · ${m.error}` : ''}
                    </span>
                    {canRetry && <button type="button" onClick={() => retry(m)} className="cc-link">Retry</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default CommunicationCenterPage;
