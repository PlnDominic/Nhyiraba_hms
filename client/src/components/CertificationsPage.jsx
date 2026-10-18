import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from './DashboardLayout';
import { useTheme } from '../context/ThemeContext';
import useStaffAccess from '../hooks/useStaffAccess';
import { sendStaffSms } from '../services/smsService';
import {
  addCertification,
  addRequirement,
  deleteCertification,
  deleteRequirement,
  getAllStaff,
  getCertifications,
  getRequirements
} from '../services/staffService';
import { certStatus, daysUntil, missingRequirements } from '../utils/staffRules';

const BADGE = {
  valid: 'bg-emerald-100 text-emerald-800',
  expiring: 'bg-amber-100 text-amber-800',
  expired: 'bg-red-100 text-red-800',
  'no-expiry': 'bg-slate-100 text-slate-700'
};

const CertificationsPage = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { isManager, staffRecord, loading: accessLoading } = useStaffAccess();
  const [staff, setStaff] = useState([]);
  const [certs, setCerts] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState({ staff_id: '', name: '', issuer: '', issued_date: '', expiry_date: '', evidence_url: '' });
  const [reqForm, setReqForm] = useState({ name: '', department: '' });
  const [notice, setNotice] = useState(null);

  const panel = `rounded-2xl border p-5 shadow-sm ${dark ? 'border-slate-700 bg-slate-900/70 text-white' : 'border-slate-200 bg-white text-slate-900'}`;
  const input = `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${dark ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`;

  const flash = useCallback((message, type = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 5000);
  }, []);

  const load = useCallback(async () => {
    const [staffRes, certRes, reqRes] = await Promise.all([
      getAllStaff(),
      getCertifications(isManager ? {} : { staffId: staffRecord?.id }),
      getRequirements()
    ]);
    setStaff(staffRes.data);
    setCerts(certRes.data);
    setRequirements(reqRes.data);
    if (certRes.error) flash(`${certRes.error.message} (has the staff features migration been run?)`, 'error');
  }, [isManager, staffRecord, flash]);

  useEffect(() => { if (!accessLoading) load(); }, [accessLoading, load]);

  const staffById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);
  const name = (id) => (staffById[id] ? `${staffById[id].first_name} ${staffById[id].last_name}` : 'Unknown');
  const rows = useMemo(() => certs.map((c) => ({ ...c, status: certStatus(c.expiry_date) })), [certs]);
  const visible = rows.filter((r) => filter === 'all' || r.status === filter);
  const counts = { expired: rows.filter((r) => r.status === 'expired').length, expiring: rows.filter((r) => r.status === 'expiring').length };

  const missing = useMemo(() => {
    const people = isManager ? staff.filter((s) => !['Terminated', 'Inactive'].includes(s.status)) : staff.filter((s) => s.id === staffRecord?.id);
    return people.map((p) => ({ person: p, items: missingRequirements(p, certs, requirements) })).filter((m) => m.items.length);
  }, [staff, certs, requirements, isManager, staffRecord]);

  const submit = async (event) => {
    event.preventDefault();
    const staffId = isManager ? form.staff_id : staffRecord?.id;
    if (!staffId || !form.name.trim()) return flash('Choose a staff member and enter the certification name.', 'error');
    if (form.issued_date && form.expiry_date && form.expiry_date < form.issued_date) return flash('Expiry cannot be before the issue date.', 'error');
    const { error } = await addCertification({
      staff_id: staffId,
      name: form.name.trim(),
      issuer: form.issuer || null,
      issued_date: form.issued_date || null,
      expiry_date: form.expiry_date || null,
      evidence_url: form.evidence_url || null
    });
    if (error) return flash(error.message, 'error');
    setForm({ staff_id: '', name: '', issuer: '', issued_date: '', expiry_date: '', evidence_url: '' });
    flash('Certification recorded.');
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this certification record?')) return;
    const { error } = await deleteCertification(id);
    if (error) return flash(error.message, 'error');
    load();
  };

  const remind = async (row) => {
    const person = staffById[row.staff_id];
    if (!person?.phone) return flash(`${name(row.staff_id)} has no phone number on file.`, 'error');
    const when = row.status === 'expired' ? 'has expired' : `expires on ${row.expiry_date}`;
    const result = await sendStaffSms('custom', person.phone, {
      message: `Hello ${person.first_name}, your ${row.name} certification ${when}. Please renew it and give the updated certificate to HR.`
    });
    flash(result.success ? `Reminder sent to ${person.first_name}.` : `Not sent: ${result.error}`, result.success ? 'success' : 'error');
  };

  const submitRequirement = async (event) => {
    event.preventDefault();
    if (!reqForm.name.trim()) return;
    const { error } = await addRequirement({ name: reqForm.name.trim(), department: reqForm.department || null });
    if (error) return flash(error.message, 'error');
    setReqForm({ name: '', department: '' });
    load();
  };

  const departments = [...new Set(staff.map((s) => s.department).filter(Boolean))].sort();

  return (
    <DashboardLayout activeLink="Certifications" title="Certifications & Training">
      <div className="space-y-6 pb-10">
        {notice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{notice.message}</div>}
        <div>
          <h1 className="text-2xl font-bold">Certifications &amp; training</h1>
          <p className="text-sm opacity-70">{isManager ? 'Track staff certificates, expiry dates and required training for each department.' : 'Your certificates and the training required for your role.'}</p>
        </div>

        {!accessLoading && !isManager && !staffRecord && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Your login isn&apos;t linked to a staff record yet. Ask an administrator to add you in Staff Management using your login email.</div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button onClick={() => setFilter(filter === 'expired' ? 'all' : 'expired')} className={`${panel} text-left`}><div className="text-sm opacity-60">Expired</div><div className="text-3xl font-bold text-red-600">{counts.expired}</div></button>
          <button onClick={() => setFilter(filter === 'expiring' ? 'all' : 'expiring')} className={`${panel} text-left`}><div className="text-sm opacity-60">Expiring within 30 days</div><div className="text-3xl font-bold text-amber-600">{counts.expiring}</div></button>
          <div className={panel}><div className="text-sm opacity-60">Missing required</div><div className="text-3xl font-bold">{missing.reduce((n, m) => n + m.items.length, 0)}</div></div>
        </div>

        <section className={panel}>
          <h2 className="mb-3 text-lg font-semibold">Add certification</h2>
          <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {isManager && <select aria-label="Staff member" value={form.staff_id} onChange={(e) => setForm({ ...form, staff_id: e.target.value })} className={input}><option value="">Select staff…</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} · {s.department}</option>)}</select>}
            <input aria-label="Certification name" placeholder="Certification (e.g. Food Handler)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            <input aria-label="Issuer" placeholder="Issued by" value={form.issuer} onChange={(e) => setForm({ ...form, issuer: e.target.value })} className={input} />
            <label className="text-xs opacity-70">Issued<input aria-label="Issued date" type="date" value={form.issued_date} onChange={(e) => setForm({ ...form, issued_date: e.target.value })} className={input} /></label>
            <label className="text-xs opacity-70">Expires (leave blank if it doesn&apos;t expire)<input aria-label="Expiry date" type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} className={input} /></label>
            <label className="text-xs opacity-70">Evidence link (scan or photo URL)<input aria-label="Evidence link" placeholder="https://…" value={form.evidence_url} onChange={(e) => setForm({ ...form, evidence_url: e.target.value })} className={input} /></label>
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white md:col-span-3">Save certification</button>
          </form>
        </section>

        <section className={panel}>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Certificates</h2>
            <select aria-label="Filter by status" value={filter} onChange={(e) => setFilter(e.target.value)} className={`${input} !w-auto`}><option value="all">All</option><option value="expired">Expired</option><option value="expiring">Expiring soon</option><option value="valid">Valid</option><option value="no-expiry">No expiry</option></select></div>
          {visible.length === 0 ? <p className="text-sm opacity-60">Nothing to show.</p> : (
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b"><th className="px-2 py-2">Staff</th><th className="px-2 py-2">Certification</th><th className="px-2 py-2">Expires</th><th className="px-2 py-2">Status</th><th className="px-2 py-2" /></tr></thead>
              <tbody>{visible.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-2 py-2">{name(r.staff_id)}</td>
                  <td className="px-2 py-2">{r.name}{r.issuer ? <span className="opacity-60"> · {r.issuer}</span> : null}{r.evidence_url && <a href={r.evidence_url} target="_blank" rel="noopener noreferrer" className="ml-2 text-xs underline">evidence</a>}</td>
                  <td className="px-2 py-2">{r.expiry_date ? `${r.expiry_date} (${daysUntil(r.expiry_date) < 0 ? `${-daysUntil(r.expiry_date)}d ago` : `in ${daysUntil(r.expiry_date)}d`})` : '—'}</td>
                  <td className="px-2 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[r.status]}`}>{r.status}</span></td>
                  <td className="whitespace-nowrap px-2 py-2">{isManager && ['expired', 'expiring'].includes(r.status) && <button onClick={() => remind(r)} className="mr-2 rounded-md bg-amber-600 px-2 py-1 text-xs font-semibold text-white">Send reminder</button>}{isManager && <button onClick={() => remove(r.id)} className="rounded-md border px-2 py-1 text-xs">Delete</button>}</td>
                </tr>))}</tbody></table></div>
          )}
        </section>

        <section className={panel}>
          <h2 className="mb-3 text-lg font-semibold">Missing required certifications</h2>
          {missing.length === 0 ? <p className="text-sm opacity-60">Everyone holds the certifications required for their department.</p> : (
            <ul className="space-y-1 text-sm">{missing.map(({ person, items }) => <li key={person.id}><strong>{person.first_name} {person.last_name}</strong> <span className="opacity-60">({person.department})</span>: {items.map((i) => i.name).join(', ')}</li>)}</ul>
          )}
        </section>

        {isManager && (
          <section className={panel}>
            <h2 className="mb-3 text-lg font-semibold">Required for each department</h2>
            <form onSubmit={submitRequirement} className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input aria-label="Required certification" placeholder="Required certification" value={reqForm.name} onChange={(e) => setReqForm({ ...reqForm, name: e.target.value })} className={input} />
              <select aria-label="Department" value={reqForm.department} onChange={(e) => setReqForm({ ...reqForm, department: e.target.value })} className={input}><option value="">Everyone</option>{departments.map((d) => <option key={d}>{d}</option>)}</select>
              <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Add requirement</button>
            </form>
            <ul className="mt-3 space-y-1 text-sm">{requirements.map((r) => <li key={r.id} className="flex items-center justify-between rounded-lg border p-2">{r.name} <span className="opacity-60">· {r.department || 'Everyone'}</span><button onClick={async () => { await deleteRequirement(r.id); load(); }} className="text-xs text-red-600">Remove</button></li>)}</ul>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CertificationsPage;
