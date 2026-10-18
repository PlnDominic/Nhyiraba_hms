import { generateTempPassword, validatePassword } from './passwordPolicy';

describe('validatePassword', () => {
  it('accepts a strong password', () => expect(validatePassword('Tr1cky-Kettle-77')).toEqual([]));
  it('rejects short, single-case and digit-less passwords', () => {
    expect(validatePassword('Ab1')).toContain('Use at least 10 characters.');
    expect(validatePassword('alllowercase123')).toContain('Mix upper and lower case letters.');
    expect(validatePassword('NoDigitsHereAtAll')).toContain('Include at least one number.');
  });
  it('rejects common words and the hotel name', () => {
    expect(validatePassword('Nhyiraba2026Hotel')).toHaveLength(1);
    expect(validatePassword('MyPassword12345')).toHaveLength(1);
  });
  it('rejects passwords containing the email name', () => {
    expect(validatePassword('Ama.Boateng2026!', { email: 'ama.boateng@x.com' })).toHaveLength(1);
  });
});

describe('generateTempPassword', () => {
  beforeAll(() => { if (!window.crypto?.getRandomValues) Object.defineProperty(window, "crypto", { value: require("crypto").webcrypto }); });
  it('always satisfies the policy and is not repeated', () => {
    const seen = new Set();
    for (let i = 0; i < 200; i += 1) {
      const p = generateTempPassword();
      expect(p).toHaveLength(14);
      expect(validatePassword(p)).toEqual([]);
      seen.add(p);
    }
    expect(seen.size).toBe(200);
  });
});
