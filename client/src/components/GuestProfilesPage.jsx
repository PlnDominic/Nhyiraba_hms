import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DashboardLayout from './DashboardLayout';
import { useTheme } from '../context/ThemeContext';
import { buildProfiles, findProbableDuplicatePairs } from '../utils/guestIdentity';
import {
  addGuestNote,
  attachProfileData,
  loadProfileBundle,
  saveGuestProfile
} from '../services/guestProfileService';

const fmtDate = (value) => (value ? new Date(value).toLocaleDateString() : '—');
const money = (n) => `GH₵${Number(n || 0).toFixed(2)}`;
const maskId = (id) => (id ? `${'•'.repeat(Math.max(0, id.length - 3))}${id.slice(-3)}` : '—');

const GuestProfilesPage = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [searchParams, setSearchParams] = useSearchParams();
  const [bundle, setBundle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [notice, setNotice] = useState(null);
  const [prefs, setPrefs] = useState({ preferences: '', vip: false });
  const [noteText, setNoteText] = useState('');

  const panel = `rounded-2xl border p-5 shadow-sm ${dark ? 'border-slate-700 bg-slate-900/70 text-white' : 'border-slate-200 bg-white text-slate-900'}`;
  const input = `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${dark ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`;

  const load = useCallback(async () => {
    setLoading(true);
    setBundle(await loadProfileBundle());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const profiles = useMemo(() => buildProfiles(bundle?.guests || []), [bundle]);
  const savedKeyed = useMemo(() => {
    const map = new Map();
    (bundle?.savedProfiles || []).forEach((p) => map.set(p.guest_key, p));
    return map;
  }, [bundle]);
  const isVip = (profile) => profile.identifiers.some((id) => savedKeyed.get(id)?.vip);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter((p) => (
      p.names.some((n) => n.toLowerCase().includes(q))
      || p.phones.some((ph) => ph.includes(q.replace(/\D/g, '') || '§'))
      || p.emails.some((e) => e.includes(q))
    ));
  }, [profiles, search]);

  const selectedKey = searchParams.get('key');
  const selected = useMemo(() => profiles.find((p) => p.key === selectedKey) || null, [profiles, selectedKey]);
  const detail = useMemo(() => (selected && bundle ? attachProfileData(selected, bundle) : null), [selected, bundle]);
  const duplicatePairs = useMemo(() => (showDuplicates ? findProbableDuplicatePairs(profiles) : []), [showDuplicates, profiles]);

  useEffect(() => {
    setPrefs({ preferences: detail?.saved?.preferences || '', vip: Boolean(detail?.saved?.vip) });
    setNoteText('');
  }, [detail?.saved, selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (message, type = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 4000);
  };

  const savePrefs = async () => {
    const { error } = await saveGuestProfile(selected.key, { display_name: selected.name, ...prefs });
    if (error) return flash(`${error.message} (has the guest profiles migration been run?)`, 'error');
    flash('Profile saved.');
    load();
  };

  const submitNote = async (event) => {
    event.preventDefault();
    if (!noteText.trim()) return;
    const { error } = await addGuestNote(selected.key, noteText);
    if (error) return flash(`${error.message} (has the guest profiles migration been run?)`, 'error');
    setNoteText('');
    load();
  };

  const select = (key) => setSearchParams(key ? { key } : {});

  return (
    <DashboardLayout activeLink="Guest Profiles" title="Guest Profiles">
      <div className="space-y-6 pb-10">
        {notice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{notice.message}</div>}
        {bundle?.warnings?.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Some data could not be loaded: {bundle.warnings.join(' · ')}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Guest profiles</h1>
            <p className="text-sm opacity-70">{profiles.length} guests, built from stays that share a phone number or email.</p>
          </div>
          <button onClick={() => setShowDuplicates((v) => !v)} className="rounded-lg border px-3 py-2 text-sm font-semibold">
            {showDuplicates ? 'Hide' : 'Find'} possible duplicates
          </button>
        </div>

        {showDuplicates && (
          <section className={panel}>
            <h2 className="mb-3 text-lg font-semibold">Possible duplicates</h2>
            {duplicatePairs.length === 0 ? <p className="text-sm opacity-60">No similar-looking guests with different contact details.</p> : (
              <ul className="space-y-2 text-sm">
                {duplicatePairs.slice(0, 20).map(({ a, b, similarity }) => (
                  <li key={`${a.key}|${b.key}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                    <span>
                      <button onClick={() => select(a.key)} className="font-semibold underline">{a.name}</button> ({a.phones[0] || a.emails[0] || 'no contact'})
                      {' ≈ '}
                      <button onClick={() => select(b.key)} className="font-semibold underline">{b.name}</button> ({b.phones[0] || b.emails[0] || 'no contact'})
                    </span>
                    <span className="text-xs opacity-70">{Math.round(similarity * 100)}% name match</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs opacity-60">Fix a duplicate by giving both stays the same phone number or email; the profiles will merge automatically.</p>
          </section>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <section className={`${panel} lg:col-span-1`}>
            <input aria-label="Search guests" placeholder="Search name, phone or email" value={search} onChange={(e) => setSearch(e.target.value)} className={input} />
            <div className="mt-3 max-h-[70vh] space-y-2 overflow-y-auto">
              {loading && <p className="text-sm opacity-60">Loading…</p>}
              {!loading && filtered.length === 0 && <p className="text-sm opacity-60">No guests found.</p>}
              {filtered.map((p) => (
                <button
                  key={p.key}
                  onClick={() => select(p.key)}
                  className={`w-full rounded-lg border p-3 text-left text-sm transition ${p.key === selectedKey ? 'border-blue-500 ring-1 ring-blue-500' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <strong>{p.name}</strong>
                    <span className="flex gap-1">
                      {isVip(p) && <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">VIP</span>}
                      {p.inHouse && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">In-house</span>}
                    </span>
                  </div>
                  <div className="text-xs opacity-70">{p.phones[0] ? `+${p.phones[0]}` : p.emails[0] || 'No contact'} · {p.stayCount} stay{p.stayCount === 1 ? '' : 's'} · last {fmtDate(p.lastStay.check_in)}</div>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-6 lg:col-span-2">
            {!selected && <div className={`${panel} text-sm opacity-70`}>Select a guest to see their full history.</div>}
            {selected && detail && (
              <>
                <div className={panel}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold">{selected.name}</h2>
                      <p className="text-sm opacity-70">
                        {selected.phones.map((p) => `+${p}`).join(', ') || 'No phone'} · {selected.emails.join(', ') || 'No email'}
                      </p>
                      {selected.names.length > 1 && <p className="text-xs opacity-60">Also recorded as: {selected.names.filter((n) => n !== selected.name).join(', ')}</p>}
                    </div>
                    {selected.phones[0] && <Link to={`/communications?phone=${selected.phones[0]}&name=${encodeURIComponent(selected.name)}`} className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white">Message guest</Link>}
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                    <div><dt className="opacity-60">Stays</dt><dd className="text-lg font-semibold">{selected.stayCount}</dd></div>
                    <div><dt className="opacity-60">Total billed</dt><dd className="text-lg font-semibold">{money(detail.totalSpend)}</dd></div>
                    <div><dt className="opacity-60">Last stay</dt><dd className="text-lg font-semibold">{fmtDate(selected.lastStay.check_in)}</dd></div>
                    <div><dt className="opacity-60">ID on file</dt><dd className="text-lg font-semibold">{detail.lastId ? `${detail.lastId.id_type} ${maskId(detail.lastId.id_number)}` : '—'}</dd></div>
                  </dl>
                </div>

                <div className={panel}>
                  <h3 className="mb-3 font-semibold">Preferences</h3>
                  <textarea aria-label="Guest preferences" rows={3} placeholder="e.g. quiet room, late arrivals, allergies" value={prefs.preferences} onChange={(e) => setPrefs({ ...prefs, preferences: e.target.value })} className={input} />
                  <div className="mt-3 flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={prefs.vip} onChange={(e) => setPrefs({ ...prefs, vip: e.target.checked })} /> VIP guest</label>
                    <button onClick={savePrefs} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Save</button>
                  </div>
                </div>

                <div className={panel}>
                  <h3 className="mb-3 font-semibold">Stay history</h3>
                  <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b"><th className="px-2 py-1">Check-in</th><th className="px-2 py-1">Check-out</th><th className="px-2 py-1">Room</th><th className="px-2 py-1">Status</th></tr></thead>
                    <tbody>{selected.stays.map((s) => <tr key={s.id} className="border-b last:border-0"><td className="px-2 py-1">{fmtDate(s.check_in)}</td><td className="px-2 py-1">{fmtDate(s.check_out)}</td><td className="px-2 py-1">{s.room_name || s.room}</td><td className="px-2 py-1">{s.status}</td></tr>)}</tbody></table></div>
                  {detail.reservations.length > 0 && (
                    <>
                      <h4 className="mb-2 mt-4 text-sm font-semibold">Reservations</h4>
                      <ul className="space-y-1 text-sm">{detail.reservations.slice(0, 10).map((r) => <li key={r.id}>{fmtDate(r.check_in_date)} → {fmtDate(r.check_out_date)} · Room {r.room_number || r.room_id} · {r.status}</li>)}</ul>
                    </>
                  )}
                </div>

                <div className={panel}>
                  <h3 className="mb-3 font-semibold">Payments</h3>
                  {detail.settlements.length === 0 ? <p className="text-sm opacity-60">No settled check-outs yet.</p> : (
                    <ul className="space-y-1 text-sm">{detail.settlements.map((s) => <li key={s.id} className="flex justify-between"><span>{fmtDate(s.created_at)} · {s.nights} night{s.nights === 1 ? '' : 's'}{s.payment_method ? ` · ${s.payment_method}` : ''}</span><strong>{money(s.total_due)}</strong></li>)}</ul>
                  )}
                </div>

                <div className={panel}>
                  <h3 className="mb-3 font-semibold">Messages</h3>
                  {detail.sms.length === 0 ? <p className="text-sm opacity-60">No SMS sent to this guest.</p> : (
                    <ul className="space-y-2 text-sm">{detail.sms.slice(0, 10).map((m) => <li key={m.id} className="rounded-lg border p-2"><div className="flex justify-between text-xs opacity-70"><span>{new Date(m.created_at).toLocaleString()}</span><span>{m.status}</span></div><div>{m.message}</div></li>)}</ul>
                  )}
                </div>

                <div className={panel}>
                  <h3 className="mb-3 font-semibold">Notes</h3>
                  <form onSubmit={submitNote} className="flex gap-2"><input aria-label="Add a note" placeholder="Add a note about this guest" value={noteText} onChange={(e) => setNoteText(e.target.value)} className={input} /><button className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white">Add</button></form>
                  <ul className="mt-3 space-y-2 text-sm">{detail.notes.map((n) => <li key={n.id} className="rounded-lg border p-2"><div className="text-xs opacity-60">{new Date(n.created_at).toLocaleString()}</div>{n.note}</li>)}</ul>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default GuestProfilesPage;
