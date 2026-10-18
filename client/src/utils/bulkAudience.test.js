import { buildAudience } from './bulkAudience';

const contacts = [
  { name: 'Supplier Joe', phone: '233241111111', group_name: 'Suppliers', opted_out: false },
  { name: 'Church Ama', phone: '233202222222', group_name: 'Church', opted_out: false },
  { name: 'Quiet Kofi', phone: '233203333333', group_name: 'Church', opted_out: true }
];
const profiles = [{ name: 'Guest Yaw', phones: ['233244444444'], inHouse: false, stays: [] }];

describe('buildAudience with saved contacts', () => {
  it('offers all saved contacts, minus anyone who opted out', () => {
    expect(buildAudience('contacts', { contacts }).map((p) => p.name)).toEqual(['Supplier Joe', 'Church Ama']);
  });
  it('filters by contact group', () => {
    expect(buildAudience('group:Church', { contacts }).map((p) => p.name)).toEqual(['Church Ama']);
  });
  it('includes contacts in Everyone alongside guests', () => {
    expect(buildAudience('all', { profiles, contacts }).map((p) => p.name).sort()).toEqual(['Church Ama', 'Guest Yaw', 'Supplier Joe']);
  });
  it('never messages an opted-out number, even if the same person is a guest', () => {
    const guest = [{ name: 'Kofi (guest)', phones: ['233203333333'], inHouse: true, stays: [] }];
    expect(buildAudience('inhouse', { profiles: guest, contacts })).toEqual([]);
    expect(buildAudience('all', { profiles: guest, contacts }).some((p) => p.phone === '233203333333')).toBe(false);
  });
});
