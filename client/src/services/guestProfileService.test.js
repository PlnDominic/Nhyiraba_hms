jest.mock('../supabaseClient', () => ({ __esModule: true, default: {} }));

import { buildProfiles } from '../utils/guestIdentity';
import { attachProfileData } from './guestProfileService';

const profile = buildProfiles([
  { id: 1, name: 'Ama Boateng', phone: '0241234567', email: 'ama@x.com', status: 'Checked Out', check_in: '2026-01-01' }
])[0];

describe('attachProfileData', () => {
  const bundle = {
    reservations: [
      { id: 'r1', guest_name: 'Ama B', guest_phone: '+233241234567', check_in_date: '2026-06-01' },
      { id: 'r2', guest_name: 'Someone Else', guest_phone: '0200000000', check_in_date: '2026-06-02' },
      { id: 'r3', guest_name: 'ama boateng', check_in_date: '2026-07-01' }
    ],
    settlements: [
      { id: 's1', guest_name: 'Ama Boateng', total_due: '300.50', created_at: '2026-01-03' },
      { id: 's2', guest_name: 'Ama Boateng', total_due: 100, created_at: '2026-02-03' },
      { id: 's3', guest_name: 'Other', total_due: 999, created_at: '2026-02-03' }
    ],
    checkins: [{ id: 'c1', guest_name: 'Ama Boateng', guest_phone: '0241234567', id_type: 'Passport', id_number: 'G1234567' }],
    sms: [{ id: 'm1', phone: '233241234567' }, { id: 'm2', phone: '233200000000' }],
    savedProfiles: [{ guest_key: profile.key, vip: true }, { guest_key: 'p:other', vip: false }],
    notes: [{ id: 'n1', guest_key: profile.key }, { id: 'n2', guest_key: 'p:other' }]
  };

  it('matches reservations by contact (any phone format) or by name when contact is absent', () => {
    const data = attachProfileData(profile, bundle);
    expect(data.reservations.map((r) => r.id)).toEqual(['r3', 'r1']);
  });

  it('totals spend from this guest\'s settlements only', () => {
    expect(attachProfileData(profile, bundle).totalSpend).toBeCloseTo(400.5);
  });

  it('attaches ID record, messages, saved profile and notes', () => {
    const data = attachProfileData(profile, bundle);
    expect(data.lastId.id_type).toBe('Passport');
    expect(data.sms).toHaveLength(1);
    expect(data.saved.vip).toBe(true);
    expect(data.notes).toHaveLength(1);
  });
});
