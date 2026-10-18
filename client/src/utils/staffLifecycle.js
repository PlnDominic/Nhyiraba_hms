// Staff joining and leaving. A leaver is never deleted: their schedules and
// clock-in history stay, and they are marked 'Left' with a last working day.

export const LEFT_STATUS = 'Left';

export const LEAVING_REASONS = [
  'Resigned',
  'Contract ended',
  'Dismissed',
  'Retired',
  'Redundancy',
  'Did not return from leave',
  'Other'
];

// Anyone who has not left can still be rostered and clocked in.
export const isCurrentStaff = (member) => {
  const status = String(member?.status ?? '').trim().toLowerCase();
  return status !== 'left' && status !== 'terminated';
};

export const isFormerStaff = (member) => !isCurrentStaff(member);

export const splitStaff = (staff = []) => ({
  current: staff.filter(isCurrentStaff),
  former: staff.filter(isFormerStaff)
});

const normalizeEmail = (raw) => String(raw ?? '').trim().toLowerCase();

// A returning employee must be reinstated, not added a second time (email is unique).
export const findFormerStaffByEmail = (staff = [], email) => {
  const wanted = normalizeEmail(email);
  if (!wanted) return null;
  return staff.find((m) => isFormerStaff(m) && normalizeEmail(m.email) === wanted) || null;
};

export const validateOffboarding = ({ endDate, reason, hireDate } = {}) => {
  const errors = {};
  if (!endDate) {
    errors.endDate = 'Enter the last working day';
  } else if (hireDate && endDate < hireDate) {
    errors.endDate = 'The last working day cannot be before the hire date';
  }
  if (!reason || !String(reason).trim()) {
    errors.reason = 'Choose a reason for leaving';
  }
  return { valid: Object.keys(errors).length === 0, errors };
};

// "3 years, 2 months" style tenure for the former-staff list.
export const tenureLabel = (hireDate, endDate) => {
  if (!hireDate) return '';
  const start = new Date(hireDate);
  const end = endDate ? new Date(endDate) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return '';
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  months = Math.max(months, 0);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts = [];
  if (years) parts.push(`${years} ${years === 1 ? 'year' : 'years'}`);
  if (rest || !years) parts.push(`${rest} ${rest === 1 ? 'month' : 'months'}`);
  return parts.join(', ');
};
