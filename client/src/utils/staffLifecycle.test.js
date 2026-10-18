import {
  findFormerStaffByEmail,
  isCurrentStaff,
  splitStaff,
  tenureLabel,
  validateOffboarding
} from './staffLifecycle';

describe('isCurrentStaff', () => {
  it('treats Left and Terminated as former, everyone else as current', () => {
    expect(isCurrentStaff({ status: 'Active' })).toBe(true);
    expect(isCurrentStaff({ status: 'On Leave' })).toBe(true);
    expect(isCurrentStaff({ status: 'Inactive' })).toBe(true);
    expect(isCurrentStaff({ status: 'Left' })).toBe(false);
    expect(isCurrentStaff({ status: 'terminated' })).toBe(false);
  });
  it('keeps rows with no status visible', () => {
    expect(isCurrentStaff({})).toBe(true);
    expect(isCurrentStaff(null)).toBe(true);
  });
});

describe('splitStaff', () => {
  it('separates current and former staff', () => {
    const { current, former } = splitStaff([
      { id: 1, status: 'Active' },
      { id: 2, status: 'Left' },
      { id: 3, status: 'On Leave' }
    ]);
    expect(current.map((m) => m.id)).toEqual([1, 3]);
    expect(former.map((m) => m.id)).toEqual([2]);
  });
});

describe('findFormerStaffByEmail', () => {
  const staff = [
    { id: 1, email: 'Ama@Nhyiraba.com', status: 'Left' },
    { id: 2, email: 'kofi@nhyiraba.com', status: 'Active' }
  ];
  it('matches a leaver regardless of case and spacing', () => {
    expect(findFormerStaffByEmail(staff, '  ama@nhyiraba.com ').id).toBe(1);
  });
  it('ignores current staff and blanks', () => {
    expect(findFormerStaffByEmail(staff, 'kofi@nhyiraba.com')).toBeNull();
    expect(findFormerStaffByEmail(staff, '')).toBeNull();
  });
});

describe('validateOffboarding', () => {
  it('requires a last working day and a reason', () => {
    const { valid, errors } = validateOffboarding({});
    expect(valid).toBe(false);
    expect(errors.endDate).toBeTruthy();
    expect(errors.reason).toBeTruthy();
  });
  it('rejects a last day before the hire date', () => {
    const { valid, errors } = validateOffboarding({ endDate: '2024-01-01', reason: 'Resigned', hireDate: '2025-01-01' });
    expect(valid).toBe(false);
    expect(errors.endDate).toMatch(/hire date/);
  });
  it('accepts a complete record', () => {
    expect(validateOffboarding({ endDate: '2026-10-31', reason: 'Resigned', hireDate: '2025-01-01' }).valid).toBe(true);
  });
});

describe('tenureLabel', () => {
  it('formats years and months', () => {
    expect(tenureLabel('2023-08-15', '2026-10-31')).toBe('3 years, 2 months');
    expect(tenureLabel('2026-10-01', '2026-10-20')).toBe('0 months');
    expect(tenureLabel('2025-10-01', '2026-10-20')).toBe('1 year');
  });
  it('returns empty text for missing or invalid dates', () => {
    expect(tenureLabel('', '2026-10-31')).toBe('');
    expect(tenureLabel('2026-10-31', '2025-01-01')).toBe('');
  });
});
