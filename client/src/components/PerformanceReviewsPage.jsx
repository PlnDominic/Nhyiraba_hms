import React, { useCallback, useEffect, useState } from 'react';
import DashboardLayout from './DashboardLayout';
import { useTheme } from '../context/ThemeContext';
import useStaffAccess from '../hooks/useStaffAccess';
import {
  acknowledgeReview,
  addGoal,
  addPeriod,
  deleteGoal,
  getAllStaff,
  getGoals,
  getPeriods,
  getReviews,
  saveReview,
  updateGoal,
  updatePeriod
} from '../services/staffService';
import { goalsProgress, overallRating, ratingTrend } from '../utils/staffRules';

const CATEGORIES = [
  ['punctuality_rating', 'Punctuality'],
  ['quality_of_work_rating', 'Quality of work'],
  ['teamwork_rating', 'Teamwork'],
  ['customer_service_rating', 'Customer service']
];
const GOAL_STATUS = ['not-started', 'in-progress', 'achieved', 'missed'];
const TREND = { up: '▲ improving', down: '▼ declining', flat: '● steady' };
const blankReview = { period_id: '', punctuality_rating: '', quality_of_work_rating: '', teamwork_rating: '', customer_service_rating: '', strengths: '', areas_for_improvement: '', manager_feedback: '', status: 'draft' };

const PerformanceReviewsPage = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const { isManager, staffRecord, loading: accessLoading } = useStaffAccess();
  const [staff, setStaff] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [goals, setGoals] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [staffId, setStaffId] = useState('');
  const [periodForm, setPeriodForm] = useState({ name: '', start_date: '', end_date: '' });
  const [goalForm, setGoalForm] = useState({ title: '', description: '', target_date: '', weight: 1, period_id: '' });
  const [review, setReview] = useState(blankReview);
  const [ackText, setAckText] = useState('');
  const [notice, setNotice] = useState(null);

  const panel = `rounded-2xl border p-5 shadow-sm ${dark ? 'border-slate-700 bg-slate-900/70 text-white' : 'border-slate-200 bg-white text-slate-900'}`;
  const input = `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${dark ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`;

  const flash = useCallback((message, type = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 5000);
  }, []);

  const activeStaffId = isManager ? staffId : staffRecord?.id;

  const load = useCallback(async () => {
    const [staffRes, periodRes] = await Promise.all([getAllStaff(), getPeriods()]);
    setStaff(staffRes.data);
    setPeriods(periodRes.data);
    if (periodRes.error) flash(`${periodRes.error.message} (has the staff features migration been run?)`, 'error');
    if (activeStaffId) {
      const [goalRes, reviewRes] = await Promise.all([getGoals({ staffId: activeStaffId }), getReviews({ staffId: activeStaffId })]);
      setGoals(goalRes.data);
      setReviews(reviewRes.data);
    } else {
      setGoals([]);
      setReviews([]);
    }
  }, [activeStaffId, flash]);

  useEffect(() => { if (!accessLoading) load(); }, [accessLoading, load]);

  const periodName = (id) => periods.find((p) => p.id === id)?.name || 'No period';
  const openPeriods = periods.filter((p) => p.status === 'open');
  const person = staff.find((s) => s.id === activeStaffId);
  const progress = goalsProgress(goals);
  const trend = ratingTrend(reviews);
  const computedOverall = overallRating(review);

  const submitPeriod = async (event) => {
    event.preventDefault();
    if (!periodForm.name.trim() || !periodForm.start_date || !periodForm.end_date) return flash('Name and both dates are required.', 'error');
    if (periodForm.end_date < periodForm.start_date) return flash('The end date cannot be before the start date.', 'error');
    const { error } = await addPeriod(periodForm);
    if (error) return flash(error.message, 'error');
    setPeriodForm({ name: '', start_date: '', end_date: '' });
    load();
  };

  const submitGoal = async (event) => {
    event.preventDefault();
    if (!activeStaffId || !goalForm.title.trim()) return flash('Choose a staff member and enter a goal title.', 'error');
    const { error } = await addGoal({
      staff_id: activeStaffId,
      title: goalForm.title.trim(),
      description: goalForm.description || null,
      target_date: goalForm.target_date || null,
      weight: Number(goalForm.weight) || 1,
      period_id: goalForm.period_id || null
    });
    if (error) return flash(error.message, 'error');
    setGoalForm({ title: '', description: '', target_date: '', weight: 1, period_id: '' });
    load();
  };

  const changeGoal = async (goal, patch) => {
    const next = { ...patch };
    if (patch.progress !== undefined) {
      const value = Math.max(0, Math.min(100, Number(patch.progress) || 0));
      next.progress = value;
      if (value === 100) next.status = 'achieved';
      else if (value > 0 && goal.status === 'not-started') next.status = 'in-progress';
    }
    const { error } = await updateGoal(goal.id, next);
    if (error) return flash(error.message, 'error');
    load();
  };

  const submitReview = async (status) => {
    if (!activeStaffId) return flash('Choose a staff member first.', 'error');
    const period = periods.find((p) => p.id === review.period_id);
    if (!period) return flash('Choose the review period.', 'error');
    if (status !== 'draft' && computedOverall === null) return flash('Rate at least one category before submitting.', 'error');
    const payload = {
      ...review,
      id: review.id,
      staff_id: activeStaffId,
      reviewer_id: staffRecord?.id || null,
      review_period_start: period.start_date,
      review_period_end: period.end_date,
      overall_rating: computedOverall,
      status
    };
    CATEGORIES.forEach(([field]) => { payload[field] = payload[field] === '' ? null : Number(payload[field]); });
    if (!payload.id) delete payload.id;
    const { error } = await saveReview(payload);
    if (error) return flash(error.message, 'error');
    setReview(blankReview);
    flash(status === 'draft' ? 'Draft saved.' : 'Review submitted to the staff member.');
    load();
  };

  const acknowledge = async (r) => {
    const { error } = await acknowledgeReview(r.id, ackText);
    if (error) return flash(error.message, 'error');
    setAckText('');
    flash('Review acknowledged.');
    load();
  };

  return (
    <DashboardLayout activeLink="Performance" title="Performance">
      <div className="space-y-6 pb-10">
        {notice && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{notice.message}</div>}
        <div>
          <h1 className="text-2xl font-bold">Performance, goals &amp; reviews</h1>
          <p className="text-sm opacity-70">{isManager ? 'Set review periods and goals, then write and submit reviews.' : 'Your goals, reviews and feedback.'}</p>
        </div>

        {isManager && (
          <>
            <section className={panel}>
              <h2 className="mb-3 text-lg font-semibold">Review periods</h2>
              <form onSubmit={submitPeriod} className="grid grid-cols-1 gap-3 md:grid-cols-4">
                <input aria-label="Period name" placeholder="e.g. 2026 H2" value={periodForm.name} onChange={(e) => setPeriodForm({ ...periodForm, name: e.target.value })} className={input} />
                <input aria-label="Period start" type="date" value={periodForm.start_date} onChange={(e) => setPeriodForm({ ...periodForm, start_date: e.target.value })} className={input} />
                <input aria-label="Period end" type="date" value={periodForm.end_date} onChange={(e) => setPeriodForm({ ...periodForm, end_date: e.target.value })} className={input} />
                <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Add period</button>
              </form>
              <ul className="mt-3 space-y-1 text-sm">{periods.map((p) => <li key={p.id} className="flex items-center justify-between rounded-lg border p-2">{p.name} <span className="opacity-60">{p.start_date} → {p.end_date}</span><button onClick={async () => { await updatePeriod(p.id, { status: p.status === 'open' ? 'closed' : 'open' }); load(); }} className="rounded-md border px-2 py-1 text-xs">{p.status === 'open' ? 'Close' : 'Reopen'}</button></li>)}</ul>
            </section>

            <section className={panel}>
              <label className="text-sm font-semibold">Staff member
                <select aria-label="Staff member" value={staffId} onChange={(e) => setStaffId(e.target.value)} className={`${input} mt-1`}><option value="">Select staff…</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.first_name} {s.last_name} · {s.department}</option>)}</select>
              </label>
            </section>
          </>
        )}

        {!isManager && !accessLoading && !staffRecord && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Your login isn&apos;t linked to a staff record yet. Ask an administrator to add you in Staff Management using your login email.</div>
        )}

        {activeStaffId && (
          <>
            <section className={panel}>
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Goals{person ? ` — ${person.first_name} ${person.last_name}` : ''}</h2><span className="text-sm font-semibold">Overall progress {progress}%</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} /></div>
              {isManager && (
                <form onSubmit={submitGoal} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-5">
                  <input aria-label="Goal title" placeholder="Goal" value={goalForm.title} onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} className={`${input} md:col-span-2`} />
                  <select aria-label="Goal period" value={goalForm.period_id} onChange={(e) => setGoalForm({ ...goalForm, period_id: e.target.value })} className={input}><option value="">No period</option>{openPeriods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                  <input aria-label="Target date" type="date" value={goalForm.target_date} onChange={(e) => setGoalForm({ ...goalForm, target_date: e.target.value })} className={input} />
                  <select aria-label="Goal weight" value={goalForm.weight} onChange={(e) => setGoalForm({ ...goalForm, weight: e.target.value })} className={input}>{[1, 2, 3, 5].map((w) => <option key={w} value={w}>Weight {w}</option>)}</select>
                  <input aria-label="Goal description" placeholder="Description (optional)" value={goalForm.description} onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })} className={`${input} md:col-span-4`} />
                  <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Add goal</button>
                </form>
              )}
              <ul className="mt-4 space-y-2 text-sm">
                {goals.length === 0 && <li className="opacity-60">No goals set.</li>}
                {goals.map((g) => (
                  <li key={g.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span><strong>{g.title}</strong> <span className="opacity-60">· {periodName(g.period_id)}{g.target_date ? ` · due ${g.target_date}` : ''} · weight {g.weight}</span></span>
                      <span className="flex items-center gap-2"><select aria-label={`Status of ${g.title}`} value={g.status} onChange={(e) => changeGoal(g, { status: e.target.value })} className={`${input} !w-auto`}>{GOAL_STATUS.map((s) => <option key={s}>{s}</option>)}</select>
                        {isManager && <button onClick={async () => { await deleteGoal(g.id); load(); }} className="text-xs text-red-600">Delete</button>}</span></div>
                    {g.description && <p className="mt-1 text-xs opacity-70">{g.description}</p>}
                    <div className="mt-2 flex items-center gap-3"><input aria-label={`Progress of ${g.title}`} type="range" min="0" max="100" step="5" defaultValue={g.progress} onMouseUp={(e) => changeGoal(g, { progress: e.target.value })} onTouchEnd={(e) => changeGoal(g, { progress: e.target.value })} onKeyUp={(e) => changeGoal(g, { progress: e.target.value })} className="w-full" /><span className="w-10 text-right text-xs">{g.progress}%</span></div>
                  </li>
                ))}
              </ul>
            </section>

            {isManager && (
              <section className={panel}>
                <h2 className="mb-3 text-lg font-semibold">Write a review</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <select aria-label="Review period" value={review.period_id} onChange={(e) => setReview({ ...review, period_id: e.target.value })} className={`${input} md:col-span-2`}><option value="">Select period…</option>{periods.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.start_date} → {p.end_date})</option>)}</select>
                  {CATEGORIES.map(([field, label]) => (
                    <label key={field} className="text-sm">{label}
                      <select aria-label={label} value={review[field]} onChange={(e) => setReview({ ...review, [field]: e.target.value })} className={`${input} mt-1`}><option value="">Not rated</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                    </label>
                  ))}
                  <textarea aria-label="Strengths" placeholder="Strengths" rows={2} value={review.strengths} onChange={(e) => setReview({ ...review, strengths: e.target.value })} className={input} />
                  <textarea aria-label="Areas for improvement" placeholder="Areas for improvement" rows={2} value={review.areas_for_improvement} onChange={(e) => setReview({ ...review, areas_for_improvement: e.target.value })} className={input} />
                  <textarea aria-label="Manager feedback" placeholder="Manager feedback" rows={3} value={review.manager_feedback} onChange={(e) => setReview({ ...review, manager_feedback: e.target.value })} className={`${input} md:col-span-2`} />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-sm">Overall rating: <strong>{computedOverall ?? '—'}</strong></span>
                  <span className="flex gap-2"><button onClick={() => submitReview('draft')} className="rounded-lg border px-4 py-2 text-sm">Save draft</button><button onClick={() => submitReview('submitted')} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Submit to staff</button></span></div>
              </section>
            )}

            <section className={panel}>
              <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Review history</h2>{reviews.length > 1 && <span className="text-sm font-semibold">{TREND[trend]}</span>}</div>
              {reviews.length === 0 ? <p className="text-sm opacity-60">No reviews yet.</p> : (
                <ul className="space-y-3 text-sm">
                  {reviews.map((r) => (
                    <li key={r.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2"><strong>{periodName(r.period_id) !== 'No period' ? periodName(r.period_id) : `${r.review_period_start} → ${r.review_period_end}`}</strong><span>Rating <strong>{r.overall_rating ?? '—'}</strong> / 5 · <em>{r.status}</em></span></div>
                      {r.strengths && <p className="mt-1"><span className="opacity-60">Strengths:</span> {r.strengths}</p>}
                      {r.areas_for_improvement && <p><span className="opacity-60">To improve:</span> {r.areas_for_improvement}</p>}
                      {r.manager_feedback && <p><span className="opacity-60">Manager feedback:</span> {r.manager_feedback}</p>}
                      {r.staff_comments && <p><span className="opacity-60">Staff comments:</span> {r.staff_comments}</p>}
                      {isManager && r.status === 'draft' && <button onClick={() => setReview({ ...blankReview, ...r })} className="mt-2 text-xs underline">Edit draft</button>}
                      {!isManager && ['submitted', 'reviewed'].includes(r.status) && (
                        <div className="mt-2 flex gap-2"><input aria-label="Your comments" placeholder="Your comments (optional)" value={ackText} onChange={(e) => setAckText(e.target.value)} className={input} /><button onClick={() => acknowledge(r)} className="whitespace-nowrap rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white">Acknowledge</button></div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PerformanceReviewsPage;
