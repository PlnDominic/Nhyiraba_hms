import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { sendBulkSms, getSmsCampaigns } from '../services/smsService';
import {
  AUDIENCES, CAMPAIGN_TYPES, GROUP_PREFIX, MAX_BULK_RECIPIENTS, MAX_BULK_LENGTH,
  buildAudience, parseManualNumbers, smsParts, firstName
} from '../utils/bulkAudience';

const typeLabel = (id) => CAMPAIGN_TYPES.find((t) => t.id === id)?.label || id;
const when = (value) => new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

const Field = ({ id, label, children }) => (
  <div className="cc-field">
    <label className="cc-label" htmlFor={id}>{label}</label>
    {children}
  </div>
);

// Compose a message for many people (left) and track past campaigns (right).
const BulkMessaging = ({ profiles, reservations, contacts = [], flash }) => {
  const [campaign, setCampaign] = useState('promotion');
  const [title, setTitle] = useState('');
  const [audience, setAudience] = useState('all');
  const [manual, setManual] = useState('');
  const [message, setMessage] = useState('');
  const [excluded, setExcluded] = useState(() => new Set());
  const [search, setSearch] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [campaignError, setCampaignError] = useState(null);
  const [loading, setLoading] = useState(true);
  const messageRef = useRef(null);

  const manualParsed = useMemo(() => parseManualNumbers(manual), [manual]);
  const people = useMemo(
    () => (audience === 'manual' ? manualParsed.entries : buildAudience(audience, { profiles, reservations, contacts })),
    [audience, manualParsed, profiles, reservations, contacts]
  );
  const contactGroups = useMemo(() => [...new Set(contacts.map((c) => c.group_name).filter(Boolean))].sort(), [contacts]);
  const selected = useMemo(() => people.filter((p) => !excluded.has(p.key)), [people, excluded]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return q ? people.filter((p) => p.name.toLowerCase().includes(q) || (digits && p.phone.includes(digits))) : people;
  }, [people, search]);

  const parts = smsParts(message.length);
  const credits = parts * selected.length;
  const tooMany = selected.length > MAX_BULK_RECIPIENTS;
  const canSend = message.trim() && selected.length > 0 && !tooMany && !sending;
  const sample = selected[0];
  const preview = message.replace(/\{name\}/gi, firstName(sample?.name));

  const loadCampaigns = useCallback(async () => {
    setLoading(true);
    const result = await getSmsCampaigns();
    setCampaigns(result.data);
    setCampaignError(result.success === false ? result.error : null);
    setLoading(false);
  }, []);
  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const changeAudience = (value) => { setAudience(value); setExcluded(new Set()); setSearch(''); setConfirming(false); };
  const toggle = (key) => setExcluded((cur) => { const next = new Set(cur); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const selectAll = () => setExcluded(new Set());
  const selectNone = () => setExcluded(new Set(people.map((p) => p.key)));

  // Put {name} where the cursor is (at the end if the box was never clicked)
  const insertName = () => {
    const box = messageRef.current;
    const start = box?.selectionStart ?? message.length;
    const end = box?.selectionEnd ?? message.length;
    const next = `${message.slice(0, start)}{name}${message.slice(end)}`.slice(0, MAX_BULK_LENGTH);
    setMessage(next);
    setConfirming(false);
    requestAnimationFrame(() => {
      if (!messageRef.current) return;
      messageRef.current.focus();
      const caret = Math.min(start + 6, next.length);
      messageRef.current.setSelectionRange(caret, caret);
    });
  };

  const send = async () => {
    setSending(true);
    const result = await sendBulkSms({
      campaign, name: title, message,
      recipients: selected.map((p) => ({ phone: p.phone, name: p.name }))
    });
    setSending(false);
    setConfirming(false);
    if (result.skipped) flash('SMS is not configured on the server.', 'error');
    else if (result.total === undefined) flash(`Not sent: ${result.error}`, 'error');
    else if (result.failed === 0) {
      flash(`Sent to ${result.sent} ${result.sent === 1 ? 'person' : 'people'}.`);
      setMessage(''); setTitle('');
    } else if (result.sent === 0) flash(`Nothing was sent: ${result.failed} failed. See the campaign list.`, 'error');
    else flash(`Sent to ${result.sent}; ${result.failed} failed. See the campaign list.`, 'error');
    loadCampaigns();
  };

  return (
    <>
      <section className="cc-card" aria-labelledby="cc-bulk-title">
        <div className="cc-card-head"><h2 id="cc-bulk-title">Message many people</h2></div>
        <form className="cc-body" onSubmit={(e) => { e.preventDefault(); if (canSend) setConfirming(true); }}>
          <div className="cc-row">
            <Field id="cb-type" label="What is it for?">
              <select id="cb-type" value={campaign} onChange={(e) => setCampaign(e.target.value)} className="cc-select">
                {CAMPAIGN_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </Field>
            <Field id="cb-title" label="Name (for your records)">
              <input id="cb-title" value={title} maxLength={80} placeholder="e.g. Weekend offer" onChange={(e) => setTitle(e.target.value)} className="cc-input" />
            </Field>
          </div>

          <Field id="cb-audience" label="Who should get it?">
            <select id="cb-audience" value={audience} onChange={(e) => changeAudience(e.target.value)} className="cc-select">
              {AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              {contactGroups.map((g) => <option key={g} value={`${GROUP_PREFIX}${g}`}>Contact group: {g}</option>)}
            </select>
          </Field>

          {audience === 'manual' && (
            <Field id="cb-manual" label="Phone numbers">
              <textarea id="cb-manual" rows={4} value={manual} onChange={(e) => setManual(e.target.value)} className="cc-textarea" placeholder={'One per line, e.g.\n0241234567, Ama\n0201112222'} />
              {manualParsed.invalid.length > 0 && <p className="cc-help cc-help--bad">Not valid and will be skipped: {manualParsed.invalid.slice(0, 5).join(', ')}{manualParsed.invalid.length > 5 ? '…' : ''}</p>}
            </Field>
          )}

          <div className="cc-field">
            <div className="cc-recips-head">
              <span className="cc-label">Recipients · <b>{selected.length}</b> of {people.length}</span>
              {people.length > 0 && (
                <span className="cc-links">
                  <button type="button" onClick={selectAll}>All</button>
                  <button type="button" onClick={selectNone}>None</button>
                </span>
              )}
            </div>
            {people.length === 0 ? (
              <p className="cc-recips-empty">{audience === 'manual' ? 'Type or paste numbers above.' : audience === 'contacts' || audience.startsWith(GROUP_PREFIX) ? 'No saved contacts here yet. Add or import them on the Saved contacts tab.' : 'Nobody with a phone number is in this group yet.'}</p>
            ) : (
              <>
                {people.length > 8 && <input aria-label="Search recipients" placeholder="Search name or number" value={search} onChange={(e) => setSearch(e.target.value)} className="cc-input cc-input--small" />}
                <ul className="cc-recips">
                  {shown.map((p) => (
                    <li key={p.key}>
                      <label>
                        <input type="checkbox" checked={!excluded.has(p.key)} onChange={() => toggle(p.key)} />
                        <span className="cc-recip-name">{p.name || 'No name'}</span>
                        <span className="cc-recip-phone">+{p.phone}</span>
                      </label>
                    </li>
                  ))}
                  {shown.length === 0 && <li className="cc-recips-empty">No match.</li>}
                </ul>
              </>
            )}
            {tooMany && <p className="cc-help cc-help--bad">You can send to at most {MAX_BULK_RECIPIENTS} people at a time. Untick some, or send in groups.</p>}
          </div>

          <Field id="cb-message" label="Message">
            <textarea id="cb-message" ref={messageRef} rows={4} maxLength={MAX_BULK_LENGTH} value={message} onChange={(e) => { setMessage(e.target.value); setConfirming(false); }} className="cc-textarea" placeholder="e.g. Hello {name}, enjoy 20% off weekend stays this month. Call us to book!" />
            <div className="cc-msg-tools">
              <button type="button" className="cc-btn" onClick={insertName}>Insert first name</button>
              <span className={`cc-counter${message.length >= MAX_BULK_LENGTH ? ' is-max' : message.length >= 280 ? ' is-near' : ''}`}>{message.length}/{MAX_BULK_LENGTH}</span>
            </div>
          </Field>

          {message.trim() && (
            <div className="cc-preview">
              <span className="cc-label">Preview{sample ? ` for ${sample.name || 'first recipient'}` : ''}</span>
              <p>{preview}</p>
            </div>
          )}

          {confirming ? (
            <div className="cc-confirm" role="alertdialog" aria-label="Confirm bulk message">
              <p><b>Send to {selected.length} {selected.length === 1 ? 'person' : 'people'}?</b> This uses about {credits} SMS credit{credits === 1 ? '' : 's'} and cannot be undone.</p>
              <div className="cc-confirm-actions">
                <button type="button" className="cc-btn" onClick={() => setConfirming(false)} disabled={sending}>Go back</button>
                <button type="button" className="cc-send" onClick={send} disabled={sending}>{sending ? 'Sending…' : 'Yes, send now'}</button>
              </div>
            </div>
          ) : (
            <div className="cc-actions">
              <p className="cc-help">{selected.length > 0 && message.trim() ? `About ${credits} SMS credit${credits === 1 ? '' : 's'} (${parts} per message).` : 'Choose who it is for and write your message.'}</p>
              <button type="submit" disabled={!canSend} className="cc-send">Send to {selected.length || '…'}</button>
            </div>
          )}
        </form>
      </section>

      <section className="cc-card cc-log" aria-labelledby="cc-camp-title">
        <div className="cc-card-head">
          <h2 id="cc-camp-title">Past campaigns</h2>
          <button type="button" onClick={loadCampaigns} disabled={loading} className="cc-btn">{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        {campaignError && <div className="cc-warnbox">Could not load campaigns: {campaignError}. Has the bulk SMS migration been run?</div>}
        {!campaignError && campaigns.length === 0 && !loading && <div className="cc-empty">No bulk messages sent yet.</div>}
        {campaigns.length > 0 && (
          <div className="cc-scroll">
            <table className="cc-table">
              <thead><tr><th>Sent</th><th>Campaign</th><th>Message</th><th>Results</th></tr></thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id}>
                    <td className="cc-when">{when(c.created_at)}</td>
                    <td><div>{c.name || typeLabel(c.type)}</div><div className="cc-help">{typeLabel(c.type)} · {c.total} recipient{c.total === 1 ? '' : 's'}</div></td>
                    <td className="cc-msg">{c.message}</td>
                    <td>
                      <div className="cc-results">
                      <span className="cc-badge" data-tone="ok">{c.stats?.delivered ?? 0} delivered</span>
                      {(c.stats?.pending ?? 0) > 0 && <span className="cc-badge" data-tone="info">{c.stats.pending} on the way</span>}
                      {((c.stats?.failed ?? 0) > 0 || c.failed > 0) && <span className="cc-badge" data-tone="bad">{Math.max(c.stats?.failed ?? 0, c.failed || 0)} failed</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
};

export default BulkMessaging;
