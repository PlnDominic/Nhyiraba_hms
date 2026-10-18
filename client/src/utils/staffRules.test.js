import {
  certStatus,
  countLeaveDays,
  coverageGaps,
  goalsProgress,
  leaveBalances,
  missingRequirements,
  overallRating,
  ratingTrend,
  validateLeaveRequest
} from './staffRules';

describe('countLeaveDays', () => {
  it('counts Mon-Fri only, inclusive', () => {
    expect(countLeaveDays('2026-11-02', '2026-11-06')).toBe(5); // Mon-Fri
    expect(countLeaveDays('2026-11-02', '2026-11-09')).toBe(6); // Mon..next Mon
    expect(countLeaveDays('2026-11-07', '2026-11-08')).toBe(0); // weekend
    expect(countLeaveDays('2026-11-05', '2026-11-05')).toBe(1);
    expect(countLeaveDays('2026-11-06', '2026-11-02')).toBe(0);
  });
});

describe('leaveBalances', () => {
  const policies = [{ leave_type: 'annual', days_per_year: 15 }, { leave_type: 'sick', days_per_year: 10 }];
  const leaves = [
    { leave_type: 'annual', start_date: '2026-03-02', days_count: 5, status: 'approved' },
    { leave_type: 'annual', start_date: '2026-06-01', days_count: 3, status: 'pending' },
    { leave_type: 'annual', start_date: '2026-07-01', days_count: 4, status: 'rejected' },
    { leave_type: 'annual', start_date: '2025-12-01', days_count: 9, status: 'approved' }
  ];
  it('uses approved days, shows pending separately and ignores other years/rejections', () => {
    expect(leaveBalances(policies, leaves, 2026)[0]).toEqual({ leave_type: 'annual', entitled: 15, used: 5, pending: 3, remaining: 7 });
    expect(leaveBalances(policies, leaves, 2026)[1].remaining).toBe(10);
  });
});

describe('validateLeaveRequest', () => {
  const balances = [{ leave_type: 'annual', remaining: 3 }, { leave_type: 'sick', remaining: 0 }, { leave_type: 'unpaid', remaining: 0 }];
  const base = { leave_type: 'annual', start_date: '2026-11-02', end_date: '2026-11-04' };
  const check = (request, existing = []) => validateLeaveRequest({ request: { ...base, ...request }, existingLeaves: existing, balances, today: '2026-10-20' });

  it('accepts a valid request', () => expect(check({})).toEqual([]));
  it('rejects past, reversed, weekend-only and over-balance requests', () => {
    expect(check({ start_date: '2026-10-01', end_date: '2026-10-02' })[0]).toMatch(/past/);
    expect(check({ start_date: '2026-11-05', end_date: '2026-11-03' }).join()).toMatch(/before/);
    expect(check({ start_date: '2026-11-07', end_date: '2026-11-08' }).join()).toMatch(/no working days/);
    expect(check({ start_date: '2026-11-02', end_date: '2026-11-06' }).join()).toMatch(/Only 3/);
  });
  it('does not balance-check sick or unpaid leave, and allows recent sick leave', () => {
    expect(check({ leave_type: 'sick', start_date: '2026-10-19', end_date: '2026-10-20' })).toEqual([]);
    expect(check({ leave_type: 'unpaid', start_date: '2026-11-02', end_date: '2026-11-13' })).toEqual([]);
  });
  it('rejects overlap with pending/approved leave but ignores rejected', () => {
    const existing = [{ status: 'approved', leave_type: 'annual', start_date: '2026-11-03', end_date: '2026-11-03' }];
    expect(check({}, existing).join()).toMatch(/overlap/);
    expect(check({}, [{ ...existing[0], status: 'rejected' }])).toEqual([]);
  });
});

describe('coverageGaps', () => {
  const staff = ['a', 'b', 'c'].map((id) => ({ id, department: 'Housekeeping', status: 'Active' }))
    .concat([{ id: 'x', department: 'Kitchen', status: 'Active' }]);
  it('reports days where approving would leave the team below the minimum', () => {
    const gaps = coverageGaps({
      candidate: { staff_id: 'a', start_date: '2026-11-02', end_date: '2026-11-04' },
      staff,
      approvedLeaves: [{ staff_id: 'b', start_date: '2026-11-03', end_date: '2026-11-03' }],
      minStaff: 2
    });
    expect(gaps).toEqual([{ date: '2026-11-03', available: 1, min: 2 }]);
  });
  it('returns nothing without a minimum or for weekends', () => {
    expect(coverageGaps({ candidate: { staff_id: 'a', start_date: '2026-11-02', end_date: '2026-11-02' }, staff, approvedLeaves: [], minStaff: 0 })).toEqual([]);
    expect(coverageGaps({ candidate: { staff_id: 'a', start_date: '2026-11-07', end_date: '2026-11-08' }, staff, approvedLeaves: [], minStaff: 3 })).toEqual([]);
  });
});

describe('certifications', () => {
  it('classifies expiry', () => {
    expect(certStatus('2026-10-01', '2026-10-20')).toBe('expired');
    expect(certStatus('2026-11-10', '2026-10-20')).toBe('expiring');
    expect(certStatus('2027-03-01', '2026-10-20')).toBe('valid');
    expect(certStatus(null, '2026-10-20')).toBe('no-expiry');
  });
  it('finds missing required certifications by department and name', () => {
    const person = { id: 'a', department: 'Kitchen', position: 'Cook' };
    const certs = [{ staff_id: 'a', name: 'Food Handler', expiry_date: '2026-01-01' }, { staff_id: 'a', name: 'First Aid', expiry_date: '2027-01-01' }];
    const reqs = [
      { name: 'food handler', department: 'Kitchen' },
      { name: 'First Aid', department: null },
      { name: 'Lifeguard', department: 'Pool' }
    ];
    expect(missingRequirements(person, certs, reqs, '2026-10-20').map((r) => r.name)).toEqual(['food handler']);
  });
});

describe('goals and reviews', () => {
  it('weights goal progress', () => {
    expect(goalsProgress([{ weight: 3, progress: 100 }, { weight: 1, progress: 0 }])).toBe(75);
    expect(goalsProgress([])).toBe(0);
  });
  it('averages category ratings', () => {
    expect(overallRating({ punctuality_rating: 5, teamwork_rating: 4, quality_of_work_rating: 3 })).toBe(4);
    expect(overallRating({})).toBeNull();
  });
  it('detects rating trend', () => {
    expect(ratingTrend([{ overall_rating: 4.5 }, { overall_rating: 3.5 }])).toBe('up');
    expect(ratingTrend([{ overall_rating: 3 }, { overall_rating: 4 }])).toBe('down');
    expect(ratingTrend([{ overall_rating: 4 }, { overall_rating: 4.1 }])).toBe('flat');
    expect(ratingTrend([{ overall_rating: 4 }])).toBe('flat');
  });
});
