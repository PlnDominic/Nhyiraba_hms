// One password policy for every screen that sets a password.
export const MIN_LENGTH = 10;

const COMMON = ['password', 'password1', 'qwerty', 'letmein', 'welcome', 'admin', 'nhyiraba', 'hotel', '12345678', '123456789', '1234567890', 'abc123'];

/** Returns a list of problems (empty = acceptable). `context` may carry email/name to forbid. */
export const validatePassword = (password, context = {}) => {
  const problems = [];
  const value = String(password || '');
  if (value.length < MIN_LENGTH) problems.push(`Use at least ${MIN_LENGTH} characters.`);
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value)) problems.push('Mix upper and lower case letters.');
  if (!/\d/.test(value)) problems.push('Include at least one number.');
  const lower = value.toLowerCase();
  if (COMMON.some((c) => lower.includes(c))) problems.push('Avoid common words like "password" or the hotel name.');
  const local = String(context.email || '').split('@')[0].toLowerCase();
  if (local.length >= 3 && lower.includes(local)) problems.push('Do not include your email name.');
  return problems;
};

/** Cryptographically random temporary password that always satisfies the policy. */
export const generateTempPassword = (length = 14) => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const rand = (max) => {
    // rejection sampling avoids modulo bias
    const limit = 256 - (256 % max);
    const buf = new Uint8Array(1);
    do { window.crypto.getRandomValues(buf); } while (buf[0] >= limit);
    return buf[0] % max;
  };
  const pick = (set) => set[rand(set.length)];
  const chars = [pick(upper), pick(lower), pick(digits)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = rand(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};
