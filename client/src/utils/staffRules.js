// Pure rules for leave, certifications and reviews so UI and tests agree.

const DAY_MS = 86400000;
const toDate = (value) => {
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const iso = (date) => date.toISOString().slice(0, 10);

/** Working days (Mon–Fri) between two ISO dates, inclusive. Public holidays are not excluded. */
export const countLeaveDays = (start, end) => {
  if (!start || !end) return 0;
  const s = toDate(start);
  const e = toDate(end);
  if (e < s) return 0;
  let days = 0;
  for (let t = s.getTime(); t <= e.getTime(); t += DAY_MS) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) days += 1;
  }
  return days;
};

export const rangesOverlap = (aStart, aEnd, bStart, bEnd) => toDate(aStart) <= toDate(bEnd) && toDate(bStart) <= toDate(aEnd);

/**
 * Entitlement vs usage for one staff member in a calendar year.
 * policies: [{ leave_type, days_per_year }]; leaves: that person's rows.
 * Only approved days are "used"; pending days are shown separately.
 */
export const leaveBalances = (policies, leaves, year) => policies.map((policy) => {
  const inYear = leaves.filter((l) => l.leave_type === policy.leave_type && String(l.start_date).slice(0, 4) === String(year));
  const used = inYear.filter((l) => l.status === 'approved').reduce((sum, l) => sum + Number(l.days_count || 0), 0);
  const pending = inYear.filter((l) => l.status === 'pending').reduce((sum, l) => sum + Number(l.days_count || 0), 0);
  const entitled = Number(policy.days_per_year || 0);
  return {
    leave_type: policy.leave_type,
    entitled,
    used,
    pending,
    remaining: entitled - used - pending
  };
});

/**
 * Validates a new leave request. Returns a list of problems (empty = ok).
 * Unpaid leave and sick leave are never blocked by balance.
 */
export const validateLeaveRequest = ({ request, existingLeaves, balances, today = iso(new Date()) }) => {
  const problems = [];
  if (!request.leave_type) problems.push('Choose a leave type.');
  if (!request.start_date || !request.end_date) {
    problems.push('Choose start and end dates.');
    return problems;
  }
  if (toDate(request.end_date) < toDate(request.start_date)) problems.push('The end date cannot be before the start date.');
  const days = countLeaveDays(request.start_date, request.end_date);
  if (days === 0) problems.push('The selected dates contain no working days.');
  if (request.leave_type !== 'sick' && request.start_date < today) problems.push('Leave cannot start in the past (use sick leave for recent absence).');

  const clash = existingLeaves.find((l) => ['pending', 'approved'].includes(l.status) && rangesOverlap(request.start_date, request.end_date, l.start_date, l.end_date));
  if (clash) problems.push(`These dates overlap an existing ${clash.status} ${clash.leave_type} request (${clash.start_date} to ${clash.end_date}).`);

  const balance = balances.find((b) => b.leave_type === request.leave_type);
  const policed = !['unpaid', 'sick'].includes(request.leave_type);
  if (balance && policed && days > balance.remaining) {
    problems.push(`Only ${Math.max(0, balance.remaining)} ${request.leave_type} day(s) remaining; you requested ${days}.`);
  }
  return problems;
};

/**
 * Days in [start,end] where approving `candidate` would leave the department below its minimum.
 * staff: [{id, department, status}], approvedLeaves: [{staff_id,start_date,end_date}],
 * Returns [{ date, available, min }].
 */
export const coverageGaps = ({ candidate, staff, approvedLeaves, minStaff }) => {
  const person = staff.find((s) => s.id === candidate.staff_id);
  if (!person || !minStaff) return [];
  const team = staff.filter((s) => s.department === person.department && s.status !== 'Terminated' && s.status !== 'Inactive');
  const gaps = [];
  const s = toDate(candidate.start_date);
  const e = toDate(candidate.end_date);
  for (let t = s.getTime(); t <= e.getTime(); t += DAY_MS) {
    const day = iso(new Date(t));
    const dow = new Date(t).getUTCDay();
    if (dow === 0 || dow === 6) continue;
    const away = new Set(approvedLeaves.filter((l) => l.start_date <= day && day <= l.end_date).map((l) => l.staff_id));
    away.add(candidate.staff_id);
    const available = team.filter((m) => !away.has(m.id)).length;
    if (available < minStaff) gaps.push({ date: day, available, min: minStaff });
  }
  return gaps;
};

// ---------------------------------------------------------------------------
// Certifications
// ---------------------------------------------------------------------------
export const certStatus = (expiryDate, today = iso(new Date()), windowDays = 30) => {
  if (!expiryDate) return 'no-expiry';
  const days = Math.round((toDate(expiryDate) - toDate(today)) / DAY_MS);
  if (days < 0) return 'expired';
  return days <= windowDays ? 'expiring' : 'valid';
};

export const daysUntil = (date, today = iso(new Date())) => Math.round((toDate(date) - toDate(today)) / DAY_MS);

/** Required certifications a person does not currently hold (valid/expiring/no-expiry count as held). */
export const missingRequirements = (person, certifications, requirements, today = iso(new Date())) => {
  const held = new Set(certifications
    .filter((c) => c.staff_id === person.id && certStatus(c.expiry_date, today) !== 'expired')
    .map((c) => c.name.trim().toLowerCase()));
  return requirements.filter((r) => (
    (!r.department || r.department === person.department)
    && (!r.position || r.position === person.position)
    && !held.has(r.name.trim().toLowerCase())
  ));
};

// ---------------------------------------------------------------------------
// Goals and reviews
// ---------------------------------------------------------------------------
/** Weighted average progress (0-100) across goals. */
export const goalsProgress = (goals) => {
  const totalWeight = goals.reduce((sum, g) => sum + Number(g.weight || 1), 0);
  if (!totalWeight) return 0;
  return Math.round(goals.reduce((sum, g) => sum + Number(g.progress || 0) * Number(g.weight || 1), 0) / totalWeight);
};

const RATING_FIELDS = ['punctuality_rating', 'quality_of_work_rating', 'teamwork_rating', 'customer_service_rating'];

/** Overall rating = mean of the rated categories (1 decimal), or null if none given. */
export const overallRating = (review) => {
  const values = RATING_FIELDS.map((f) => Number(review[f])).filter((v) => Number.isFinite(v) && v > 0);
  return values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : null;
};

/** 'up' | 'down' | 'flat' comparing the latest two reviews (newest first). */
export const ratingTrend = (reviewsNewestFirst) => {
  const rated = reviewsNewestFirst.filter((r) => Number(r.overall_rating) > 0);
  if (rated.length < 2) return 'flat';
  const diff = Number(rated[0].overall_rating) - Number(rated[1].overall_rating);
  if (Math.abs(diff) < 0.2) return 'flat';
  return diff > 0 ? 'up' : 'down';
};
