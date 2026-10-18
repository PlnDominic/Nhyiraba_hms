import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from './DashboardLayout';
import { useTheme } from '../context/ThemeContext';
import useStaffAccess from '../hooks/useStaffAccess';
import { sendStaffSms } from '../services/smsService';
import {
  createLeave,
  getAllStaff,
  getAvailability,
  getLeavePolicies,
  getLeaves,
  getMinCoverage,
  saveAvailability,
  saveMinCoverage,
  updateLeave
} from '../services/staffService';
import {
  countLeaveDays,
  coverageGaps,
  leaveBalances,
  validateLeaveRequest
} from '../utils/staffRules';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TYPE_LABEL = { annual: 'Annual', sick: 'Sick', personal: 'Personal', maternity: 'Maternity', paternity: 'Paternity', unpaid: 'Unpaid' };
const STATUS_STYLE = {
  pending: 'bg-amber-100 text-amber-800',
  approved: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-slate-100 text-slate-600'
};
const today = new Date().toISOString().slice(0, 10);

const LeavePage = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { isManager, staffRecord, loading: accessLoading } = useStaffAccess();
  const [policies, setPolicies] = useState([]);
  const [myLeaves, setMyLeaves] = useState([]);
  const [allLeaves, setAllLeaves] = useState([]);
  const [staff, setStaff] = useState([]);
  const [coverage, setCoverage] = useState({});
  const [availability, setAvailability] = useState([]);
  const [form, setForm] = useState({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
  const [problems, setProblems] = useState([]);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const panel = `rounded-2xl border p-5 shadow-sm ${dark ? 'border-slate-700 bg-slate-900/70 text-white' : 'border-slate-200 bg-white text-slate-900'}`;
  const input = `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${dark ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`;

  const flash = useCallback((message, type = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 5000);
  }, []);

  const load = useCallback(async () => {
    const [pol, staffRes] = await Promise.all([getLeavePolicies(), getAllStaff()]);
    setPolicies(pol.data);
    setStaff(staffRes.data);
    if (staffRecord) {
      const [mine, avail] = await Promise.all([getLeaves({ staffId: staffRecord.id }), getAvailability(staffRecord.id)]);
      setMyLeaves(mine.data);
      setAvailability(avail.data);
    }
    if (isManager) {
      const [leaves, cov] = await Promise.all([getLeaves(), getMinCoverage()]);
      setAllLeaves(leaves.data);
      setCoverage(Object.fromEntries(cov.data.map((c) => [c.department, c.min_staff])));
    }
  }, [staffRecord, isManager]);

  useEffect(() => { if (!accessLoading) load(); }, [accessLoading, load]);

  const balances = useMemo(() => leaveBalances(policies, myLeaves, new Date().getFullYear()), [policies, myLeaves]);
  const requestedDays = countLeaveDays(form.start_date, form.end_date);
  const staffById = useMemo(() => Object.fromEntries(staff.map((s) => [s.id, s])), [staff]);
  const departments = useMemo(() => [...new Set(staff.map((s) => s.department).filter(Boolean))].sort(), [staff]);

  const submit = async (event) => {
    event.preventDefault();
    const found = validateLeaveRequest({ request: form, existingLeaves: myLeaves, balances, today });
    setProblems(found);
    if (found.length) return;
    setBusy(true);
    const { error } = await createLeave({
      staff_id: staffRecord.id,
      leave_type: form.leave_type,
      start_date: form.start_date,
      end_date: form.end_date,
      days_count: requestedDays,
      reason: form.reason || null,
      status: 'pending'
    });
    setBusy(false);
    if (error) return flash(`${error.message} (has the staff features migration been run?)`, 'error');
    setForm({ leave_type: 'annual', start_date: '', end_date: '', reason: '' });
    flash('Leave request submitted for approval.');
    load();
  };

  const cancel = async (leave) => {
    const { error } = await updateLeave(leave.id, { status: 'cancelled' });
    if (error) return flash(error.message, 'error');
    load();
  };

  const notifyStaff = (leave, text) => {
    const person = staffById[leave.staff_id];
    if (person?.phone) sendStaffSms('custom', person.phone, { message: `Hello ${person.first_name}, ${text}` });
  };

  const decide = async (leave, approve) => {
    const person = staffById[leave.staff_id];
    const label = `${TYPE_LABEL[leave.leave_type]} leave (${leave.start_date} to ${leave.end_date})`;
    if (approve) {
      const gaps = coverageGaps({
        candidate: leave,
        staff,
        approvedLeaves: allLeaves.filter((l) => l.status === 'approved' && l.id !== leave.id),
        minStaff: coverage[person?.department]
      });
      if (gaps.length) {
        const sample = gaps.slice(0, 4).map((g) => `${g.date} (${g.available}/${g.min})`).join(', ');
        if (!window.confirm(`Approving this leaves ${person.department} below its minimum on ${gaps.length} day(s): ${sample}${gaps.length > 4 ? '…' : ''}. Approve anyway?`)) return;
      }
      const { error } = await updateLeave(leave.id, { status: 'approved', approved_by: staffRecord?.id || null, approval_date: new Date().toISOString() });
      if (error) return flash(error.message, 'error');
      notifyStaff(leave, `your ${label} has been approved.`);
      flash('Leave approved.');
    } else {
      const reason = window.prompt('Reason for declining (shown to the staff member):');
      if (reason === null) return;
      const { error } = await updateLeave(leave.id, { status: 'rejected', rejection_reason: reason || null, approved_by: staffRecord?.id || null, approval_date: new Date().toISOString() });
      if (error) return flash(error.message, 'error');
      notifyStaff(leave, `your ${label} was declined.${reason ? ` Reason: ${reason}` : ''}`);
      flash('Leave declined.');
    }
    load();
  };

  const setMin = async (department, value) => {
    const { error } = await saveMinCoverage(department, value);
    if (error) return flash(error.message, 'error');
    setCoverage((c) => ({ ...c, [department]: Number(value) || 0 }));
  };

  const availabilityRows = WEEKDAYS.map((_, weekday) => {
    const row = availability.find((a) => a.weekday === weekday);
    return row || { weekday, available: weekday !== 0 && weekday !== 6, start_time: '', end_time: '' };
  });
  const changeAvailability = (weekday, patch) => setAvailability(availabilityRows.map((r) => (r.weekday === weekday ? { ...r, ...patch } : r)));
  const persistAvailability = async () => {
    const rows = availabilityRows.map(({ weekday, available, start_time, end_time }) => ({ weekday, available, start_time: start_time || null, end_time: end_time || null }));
    const { error } = await saveAvailability(staffRecord.id, rows);
    flash(error ? error.message : 'Availability saved.', error ? 'error' : 'success');
  };

  const pending = allLeaves.filter((l) => l.status === 'pending');
  const upcoming = allLeaves.filter((l) => l.status === 'approved' && l.end_date >= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
  const name = (id) => (staffById[id] ? `${staffById[id].first_name} ${staffById[id].last_name}` : 'Unknown');

  return (
    <DashboardLayout activeLink="Leave" title="Leave & Availability">
      <div className="space-y-6 pb-10">
        {notice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{notice.message}</div>}
        <div>
          <h1 className="text-2xl font-bold">Leave &amp; availability</h1>
          <p className="text-sm opacity-70">Request time off, track your balance, and (for managers) approve requests while keeping each department covered.</p>
        </div>

        {!accessLoading && !staffRecord && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Your login isn&apos;t linked to a staff record{isManager ? ', so you can manage requests but not submit your own' : ''}. Ask an administrator to add you in Staff Management using your login email.
          </div>
        )}

        {staffRecord && (
          <>
            <section className={panel}>
              <h2 className="mb-3 text-lg font-semibold">My balance ({new Date().getFullYear()})</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                {balances.filter((b) => b.entitled > 0 || b.used > 0 || b.pending > 0).map((b) => (
                  <div key={b.leave_type} className="rounded-xl border p-3 text-sm">
                    <div className="opacity-60">{TYPE_LABEL[b.leave_type]}</div>
                    <div className="text-2xl font-bold">{b.remaining}<span className="text-xs font-normal opacity-60"> / {b.entitled}</span></div>
                    <div className="text-xs opacity-60">{b.used} used{b.pending ? ` · ${b.pending} pending` : ''}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className={panel}>
              <h2 className="mb-3 text-lg font-semibold">Request leave</h2>
              {problems.length > 0 && <ul className="mb-3 list-disc space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 pl-7 text-sm text-red-700" role="alert">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
              <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <select aria-label="Leave type" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })} className={input}>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <input aria-label="Start date" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className={input} />
                <input aria-label="End date" type="date" min={form.start_date} value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className={input} />
                <div className="flex items-center rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">{requestedDays} working day{requestedDays === 1 ? '' : 's'}</div>
                <input aria-label="Reason" placeholder="Reason (optional)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className={`${input} md:col-span-3`} />
                <button disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? 'Submitting…' : 'Submit request'}</button>
              </form>
              <p className="mt-2 text-xs opacity-60">Weekends are not counted. Public holidays are not excluded automatically.</p>
            </section>

            <section className={panel}>
              <h2 className="mb-3 text-lg font-semibold">My requests</h2>
              {myLeaves.length === 0 ? <p className="text-sm opacity-60">No requests yet.</p> : (
                <ul className="space-y-2 text-sm">
                  {myLeaves.map((l) => (
                    <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                      <span>{TYPE_LABEL[l.leave_type]} · {l.start_date} → {l.end_date} · {l.days_count} day{l.days_count === 1 ? '' : 's'}{l.rejection_reason ? <em className="ml-2 text-red-600">“{l.rejection_reason}”</em> : null}</span>
                      <span className="flex items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[l.status]}`}>{l.status}</span>{l.status === 'pending' && <button onClick={() => cancel(l)} className="rounded-md border px-2 py-1 text-xs">Cancel</button>}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={panel}>
              <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">My weekly availability</h2><button onClick={persistAvailability} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Save</button></div>
              <div className="space-y-2">
                {availabilityRows.map((r) => (
                  <div key={r.weekday} className="grid grid-cols-[110px_1fr_1fr_1fr] items-center gap-2 text-sm">
                    <span>{WEEKDAYS[r.weekday]}</span>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={r.available} onChange={(e) => changeAvailability(r.weekday, { available: e.target.checked })} /> Available</label>
                    <input aria-label={`${WEEKDAYS[r.weekday]} from`} type="time" disabled={!r.available} value={r.start_time || ''} onChange={(e) => changeAvailability(r.weekday, { start_time: e.target.value })} className={input} />
                    <input aria-label={`${WEEKDAYS[r.weekday]} until`} type="time" disabled={!r.available} value={r.end_time || ''} onChange={(e) => changeAvailability(r.weekday, { end_time: e.target.value })} className={input} />
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {isManager && (
          <>
            <section className={panel}>
              <h2 className="mb-3 text-lg font-semibold">Pending approvals ({pending.length})</h2>
              {pending.length === 0 ? <p className="text-sm opacity-60">Nothing waiting for approval.</p> : (
                <ul className="space-y-2 text-sm">
                  {pending.map((l) => {
                    const person = staffById[l.staff_id];
                    const gaps = coverageGaps({ candidate: l, staff, approvedLeaves: allLeaves.filter((x) => x.status === 'approved'), minStaff: coverage[person?.department] });
                    return (
                      <li key={l.id} className="rounded-lg border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span><strong>{name(l.staff_id)}</strong> <span className="opacity-60">({person?.department})</span> · {TYPE_LABEL[l.leave_type]} · {l.start_date} → {l.end_date} · {l.days_count} day{l.days_count === 1 ? '' : 's'}{l.reason ? ` · “${l.reason}”` : ''}</span>
                          <span className="flex gap-2"><button onClick={() => decide(l, true)} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Approve</button><button onClick={() => decide(l, false)} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">Decline</button></span>
                        </div>
                        {gaps.length > 0 && <div className="mt-2 text-xs font-semibold text-amber-700">⚠ Coverage: {person.department} would drop below {gaps[0].min} on {gaps.length} day(s), e.g. {gaps[0].date} ({gaps[0].available} available).</div>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className={panel}>
              <h2 className="mb-3 text-lg font-semibold">Upcoming approved leave</h2>
              {upcoming.length === 0 ? <p className="text-sm opacity-60">No upcoming approved leave.</p> : (
                <ul className="space-y-1 text-sm">{upcoming.slice(0, 15).map((l) => <li key={l.id}>{l.start_date} → {l.end_date} · <strong>{name(l.staff_id)}</strong> ({staffById[l.staff_id]?.department}) · {TYPE_LABEL[l.leave_type]}</li>)}</ul>
              )}
            </section>

            <section className={panel}>
              <h2 className="mb-1 text-lg font-semibold">Minimum department cover</h2>
              <p className="mb-3 text-sm opacity-70">Approvals warn you when a department would fall below this many staff on a working day. 0 turns the check off.</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {departments.map((d) => (
                  <label key={d} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm">{d}
                    <input aria-label={`Minimum staff for ${d}`} type="number" min="0" defaultValue={coverage[d] ?? 0} onBlur={(e) => setMin(d, e.target.value)} className={`${input} !w-20`} />
                  </label>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default LeavePage;
