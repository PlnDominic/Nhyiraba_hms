import {
  buildProfiles,
  findDuplicates,
  findProbableDuplicatePairs,
  nameSimilarity,
  normalizePhone
} from './guestIdentity';

const stay = (over) => ({ id: Math.random(), status: 'Checked Out', check_in: '2026-01-01', ...over });

describe('normalizePhone', () => {
  it('maps local, international and spaced formats to one value', () => {
    expect(normalizePhone('024 123 4567')).toBe('233241234567');
    expect(normalizePhone('+233241234567')).toBe('233241234567');
    expect(normalizePhone('241234567')).toBe('233241234567');
    expect(normalizePhone('12')).toBe('');
  });
});

describe('nameSimilarity', () => {
  it('ignores word order and case', () => {
    expect(nameSimilarity('Kofi Mensah', 'mensah KOFI')).toBe(1);
  });
  it('is high for typos and low for different people', () => {
    expect(nameSimilarity('Kofi Mensah', 'Kofi Mensha')).toBeGreaterThan(0.85);
    expect(nameSimilarity('Kofi Mensah', 'Ama Boateng')).toBeLessThan(0.5);
  });
});

describe('buildProfiles', () => {
  it('merges stays that share a phone or email, even across formats', () => {
    const profiles = buildProfiles([
      stay({ name: 'Ama Boateng', phone: '0241234567', check_in: '2026-01-01' }),
      stay({ name: 'Ama Boateng', phone: '+233241234567', email: 'ama@x.com', check_in: '2026-03-01' }),
      stay({ name: 'A. Boateng', email: 'AMA@x.com', check_in: '2026-05-01' }),
      stay({ name: 'Kojo Annan', phone: '0200000000' })
    ]);
    expect(profiles).toHaveLength(2);
    const ama = profiles.find((p) => p.phones.includes('233241234567'));
    expect(ama.stayCount).toBe(3);
    expect(ama.lastStay.name).toBe('A. Boateng');
  });

  it('groups contact-less rows by name only', () => {
    const profiles = buildProfiles([stay({ name: 'Walk In' }), stay({ name: 'walk in' }), stay({ name: 'Other Guest' })]);
    expect(profiles).toHaveLength(2);
  });
});

describe('findDuplicates', () => {
  const profiles = buildProfiles([stay({ name: 'Kofi Mensah', phone: '0241234567', email: 'k@x.com' })]);

  it('flags a strong match on phone or email', () => {
    expect(findDuplicates({ name: 'Someone', phone: '024-123-4567' }, profiles)[0]).toMatchObject({ level: 'strong', reasons: ['phone'] });
    expect(findDuplicates({ name: 'Someone', email: 'K@X.com' }, profiles)[0].reasons).toEqual(['email']);
  });

  it('flags a possible match on a near-identical name only', () => {
    expect(findDuplicates({ name: 'Kofi Mensha' }, profiles)[0].level).toBe('possible');
    expect(findDuplicates({ name: 'Ama Boateng' }, profiles)).toHaveLength(0);
  });
});

describe('findProbableDuplicatePairs', () => {
  it('suggests unlinked profiles with near-identical names', () => {
    const profiles = buildProfiles([
      stay({ name: 'Kofi Mensah', phone: '0241234567' }),
      stay({ name: 'Kofi Mensha', phone: '0551112222' }),
      stay({ name: 'Ama Boateng', phone: '0200000000' })
    ]);
    expect(findProbableDuplicatePairs(profiles)).toHaveLength(1);
  });
});
