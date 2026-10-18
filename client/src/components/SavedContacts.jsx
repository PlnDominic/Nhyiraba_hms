import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '../context/UserContext';
import { addContacts, deleteContacts, setContactOptOut } from '../services/contactService';
import { MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, parseContactsCsv } from '../utils/contactImport';
import { normalizePhone } from '../utils/guestIdentity';

const SAMPLE_CSV = 'data:text/csv;charset=utf-8,Name,Phone,Group%0AAma Mensah,0241234567,Suppliers%0AKofi Boateng,0201112222,Church%20members%0A';

// Saved numbers for people who are not hotel guests. Everyone who can open this page can see
// them and message them; only administrators can add, import, opt out or delete.
const SavedContacts = ({ contacts, onChanged, flash }) => {
  const { user } = useUser();
  const isAdmin = ['admin', 'administrator'].includes(String(user?.role || '').toLowerCase());
  const fileRef = useRef(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [group, setGroup] = useState('');
  const [csvText, setCsvText] = useState('');
  const [csvGroup, setCsvGroup] = useState('');
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  const preview = useMemo(() => (csvText.trim() ? parseContactsCsv(csvText) : null), [csvText]);
  const saved = useMemo(() => new Set(contacts.map((c) => c.phone)), [contacts]);
  const fresh = useMemo(() => (preview ? preview.contacts.filter((c) => !saved.has(c.phone)) : []), [preview, saved]);
  const groups = useMemo(() => [...new Set(contacts.map((c) => c.group_name).filter(Boolean))].sort(), [contacts]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return contacts.filter((c) =>
      (!groupFilter || c.group_name === groupFilter) &&
      (!q || (c.name || '').toLowerCase().includes(q) || (digits && c.phone.includes(digits)))
    );
  }, [contacts, search, groupFilter]);

  useEffect(() => { setSelected(new Set()); }, [groupFilter, search]);

  const run = useCallback(async (job) => {
    setBusy(true);
    try { await job(); } finally { setBusy(false); }
  }, []);

  const addOne = (e) => {
    e.preventDefault();
    const digits = normalizePhone(phone);
    if (!digits || digits.length > 15) return flash('Enter a valid phone number.', 'error');
    if (saved.has(digits)) return flash('That number is already saved.', 'error');
    run(async () => {
      const result = await addContacts([{ name: name.trim().slice(0, 60), phone: digits, group: group.trim().slice(0, 40) }]);
      if (!result.success) return flash(result.error, 'error');
      flash('Contact saved.');
      setName(''); setPhone('');
      onChanged();
    });
  };

  const readFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) return flash('That file is too large. Split it into smaller files.', 'error');
    setCsvText(await file.text());
    if (fileRef.current) fileRef.current.value = '';
  };

  const importNow = () => run(async () => {
    const rows = fresh.map((c) => ({ ...c, group: c.group || csvGroup.trim().slice(0, 40) }));
    const result = await addContacts(rows);
    if (!result.success) {
      flash(result.added ? `Saved ${result.added}, then it stopped: ${result.error}` : result.error, 'error');
    } else {
      flash(`Imported ${result.added} contact${result.added === 1 ? '' : 's'}.`);
      setCsvText(''); setCsvGroup('');
    }
    onChanged();
  });

  const toggleOptOut = (c) => run(async () => {
    const result = await setContactOptOut(c.id, !c.opted_out);
    if (!result.success) flash(result.error, 'error');
    onChanged();
  });

  const removeSelected = () => {
    if (!window.confirm(`Delete ${selected.size} contact${selected.size === 1 ? '' : 's'}? This cannot be undone.`)) return;
    run(async () => {
      const result = await deleteContacts([...selected]);
      if (!result.success) flash(result.error, 'error');
      else flash(`Deleted ${selected.size} contact${selected.size === 1 ? '' : 's'}.`);
      setSelected(new Set());
      onChanged();
    });
  };

  const toggle = (id) => setSelected((cur) => { const next = new Set(cur); if (next.has(id)) next.delete(id); else next.add(id); return next; });

  return (
    <>
      {isAdmin ? (
        <section className="cc-card" aria-labelledby="sc-add-title">
          <div className="cc-card-head"><h2 id="sc-add-title">Add contacts</h2></div>
          <div className="cc-body">
            <form onSubmit={addOne}>
              <div className="cc-row">
                <div className="cc-field"><label className="cc-label" htmlFor="sc-name">Name</label>
                  <input id="sc-name" className="cc-input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ama Mensah" /></div>
                <div className="cc-field"><label className="cc-label" htmlFor="sc-phone">Phone number *</label>
                  <input id="sc-phone" className="cc-input" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0241234567 or +233241234567" /></div>
              </div>
              <div className="cc-row">
                <div className="cc-field"><label className="cc-label" htmlFor="sc-group">Group (optional)</label>
                  <input id="sc-group" className="cc-input" maxLength={40} list="sc-groups" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. Suppliers" />
                  <datalist id="sc-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist></div>
                <div className="cc-actions"><button type="submit" className="cc-send" disabled={busy || !phone.trim()}>Save contact</button></div>
              </div>
            </form>

            <hr />

            <div className="cc-field">
              <span className="cc-label">Import from a spreadsheet (CSV)</span>
              <p className="cc-help">
                Needs a phone column; name and group columns are optional. In Excel use Save As, CSV. Up to {MAX_IMPORT_ROWS.toLocaleString()} rows.{' '}
                <a href={SAMPLE_CSV} download="contacts-sample.csv">Download a sample</a>
              </p>
              <div className="cc-msg-tools">
                <input ref={fileRef} type="file" accept=".csv,text/csv,text/plain" onChange={(e) => readFile(e.target.files?.[0])} aria-label="Choose a CSV file" />
              </div>
              <textarea className="cc-textarea" rows={4} value={csvText} onChange={(e) => setCsvText(e.target.value)} aria-label="Or paste rows here" placeholder={'Or paste rows here:\nAma Mensah, 0241234567, Suppliers'} />
            </div>

            {preview && (
              <div className="cc-preview">
                <span className="cc-label">Check before importing</span>
                {preview.tooMany ? (
                  <p className="cc-help cc-help--bad">That is more than {MAX_IMPORT_ROWS.toLocaleString()} rows. Split the file and import it in parts.</p>
                ) : (
                  <>
                    <p>
                      <b>{fresh.length}</b> new contact{fresh.length === 1 ? '' : 's'} will be saved
                      {preview.contacts.length - fresh.length > 0 && <>, {preview.contacts.length - fresh.length} already saved</>}
                      {preview.duplicates > 0 && <>, {preview.duplicates} repeated in the file</>}
                      {preview.invalid.length > 0 && <>, <b>{preview.invalid.length}</b> skipped</>}.
                    </p>
                    {preview.invalid.length > 0 && (
                      <ul className="cc-help cc-help--bad">
                        {preview.invalid.slice(0, 5).map((i) => <li key={i.line}>Line {i.line}: {i.value || '(empty)'}. {i.reason}.</li>)}
                        {preview.invalid.length > 5 && <li>…and {preview.invalid.length - 5} more.</li>}
                      </ul>
                    )}
                    <div className="cc-field">
                      <label className="cc-label" htmlFor="sc-csv-group">Group for rows without one (optional)</label>
                      <input id="sc-csv-group" className="cc-input" maxLength={40} value={csvGroup} onChange={(e) => setCsvGroup(e.target.value)} placeholder="e.g. Imported October" />
                    </div>
                  </>
                )}
                <div className="cc-confirm-actions">
                  <button type="button" className="cc-btn" onClick={() => { setCsvText(''); setCsvGroup(''); }} disabled={busy}>Clear</button>
                  <button type="button" className="cc-send" onClick={importNow} disabled={busy || preview.tooMany || fresh.length === 0}>
                    {busy ? 'Importing…' : `Import ${fresh.length}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      ) : (
        <div className="cc-warnbox">Only administrators can add or import contacts. You can still send messages to the saved contacts from "Many people".</div>
      )}

      <section className="cc-card cc-log" aria-labelledby="sc-list-title">
        <div className="cc-card-head">
          <h2 id="sc-list-title">Saved contacts ({contacts.length})</h2>
          {isAdmin && selected.size > 0 && <button type="button" className="cc-btn" onClick={removeSelected} disabled={busy}>Delete {selected.size}</button>}
        </div>
        {contacts.length === 0 ? (
          <div className="cc-empty">No saved contacts yet.</div>
        ) : (
          <>
            <div className="cc-row" style={{ padding: '12px 18px' }}>
              <input className="cc-input cc-input--small" aria-label="Search contacts" placeholder="Search name or number" value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="cc-select" aria-label="Filter by group" value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)}>
                <option value="">All groups</option>
                {groups.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            <div className="cc-scroll">
              <table className="cc-table">
                <thead><tr>{isAdmin && <th aria-label="Select" />}<th>Name</th><th>Phone</th><th>Group</th><th>Messages</th></tr></thead>
                <tbody>
                  {shown.slice(0, 200).map((c) => (
                    <tr key={c.id}>
                      {isAdmin && <td><input type="checkbox" aria-label={`Select ${c.name || c.phone}`} checked={selected.has(c.id)} onChange={() => toggle(c.id)} /></td>}
                      <td>{c.name || <span className="cc-help">No name</span>}</td>
                      <td>+{c.phone}</td>
                      <td>{c.group_name || ''}</td>
                      <td>
                        {c.opted_out ? <span className="cc-badge" data-tone="bad">Opted out</span> : <span className="cc-badge" data-tone="ok">Allowed</span>}
                        {isAdmin && <button type="button" className="cc-btn" style={{ marginLeft: 8 }} onClick={() => toggleOptOut(c)} disabled={busy}>{c.opted_out ? 'Allow' : 'Opt out'}</button>}
                      </td>
                    </tr>
                  ))}
                  {shown.length === 0 && <tr><td colSpan={5} className="cc-help">No match.</td></tr>}
                </tbody>
              </table>
              {shown.length > 200 && <p className="cc-help" style={{ padding: '8px 18px' }}>Showing the first 200 of {shown.length}. Search or pick a group to narrow it down.</p>}
            </div>
          </>
        )}
      </section>
    </>
  );
};

export default SavedContacts;
