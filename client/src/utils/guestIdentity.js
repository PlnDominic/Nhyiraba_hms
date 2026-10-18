// Guest identity helpers: every stay is its own row in `guests`, so a "guest
// profile" is a group of stays that share a phone number or email.

// Ghana-aware: 0241234567 / 241234567 / +233241234567 all become 233241234567
export const normalizePhone = (raw) => {
  let digits = String(raw ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = `233${digits.slice(1)}`;
  else if (digits.length === 9) digits = `233${digits}`;
  return digits.length >= 11 ? digits : '';
};

export const normalizeEmail = (raw) => String(raw ?? '').trim().toLowerCase();

export const normalizeName = (raw) => String(raw ?? '')
  .toLowerCase()
  .replace(/[^a-z\s]/g, ' ')
  .split(/\s+/)
  .filter(Boolean)
  .sort()
  .join(' ');

// Damerau-Levenshtein (optimal string alignment)
const levenshtein = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      // an adjacent swap ("Mensah" -> "Mensha") counts as one typo, not two
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[a.length][b.length];
};

// 0..1, word order ignored ("Kofi Mensah" == "Mensah Kofi")
export const nameSimilarity = (a, b) => {
  const x = normalizeName(a);
  const y = normalizeName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
};

const identifiersOf = ({ phone, email, name }) => {
  const ids = [];
  const p = normalizePhone(phone);
  const e = normalizeEmail(email);
  if (p) ids.push(`p:${p}`);
  if (e) ids.push(`e:${e}`);
  if (!ids.length) {
    const n = normalizeName(name);
    if (n) ids.push(`n:${n}`);
  }
  return ids;
};

/**
 * Group stay rows into profiles. Rows are linked when they share a phone or
 * email; rows with neither are grouped by exact (order-insensitive) name.
 */
export const buildProfiles = (guests = []) => {
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    parent.set(x, root);
    return root;
  };
  const union = (a, b) => parent.set(find(a), find(b));

  const rows = guests.map((guest) => ({ guest, ids: identifiersOf({ phone: guest.phone, email: guest.email, name: guest.name }) }));
  rows.forEach(({ ids }) => {
    ids.forEach((id) => find(id));
    for (let i = 1; i < ids.length; i += 1) union(ids[0], ids[i]);
  });

  const groups = new Map();
  rows.forEach(({ guest, ids }) => {
    if (!ids.length) return;
    const root = find(ids[0]);
    if (!groups.has(root)) groups.set(root, { stays: [], identifiers: new Set() });
    const group = groups.get(root);
    group.stays.push(guest);
    ids.forEach((id) => group.identifiers.add(id));
  });

  const when = (g) => new Date(g.check_in || g.created_at || 0).getTime();
  return [...groups.values()].map(({ stays, identifiers }) => {
    stays.sort((a, b) => when(b) - when(a));
    const ids = [...identifiers].sort();
    const phones = ids.filter((i) => i.startsWith('p:')).map((i) => i.slice(2));
    const emails = ids.filter((i) => i.startsWith('e:')).map((i) => i.slice(2));
    return {
      key: ids[0],
      identifiers: ids,
      name: stays[0].name,
      names: [...new Set(stays.map((s) => s.name))],
      phones,
      emails,
      stays,
      stayCount: stays.length,
      lastStay: stays[0],
      inHouse: stays.some((s) => s.status === 'Checked In')
    };
  }).sort((a, b) => when(b.lastStay) - when(a.lastStay));
};

/**
 * Compare a candidate (name/phone/email) with existing profiles.
 * 'strong' = same phone or email; 'possible' = very similar name only.
 */
export const findDuplicates = (candidate, profiles = []) => {
  const phone = normalizePhone(candidate.phone);
  const email = normalizeEmail(candidate.email);
  const matches = [];
  profiles.forEach((profile) => {
    const reasons = [];
    if (phone && profile.phones.includes(phone)) reasons.push('phone');
    if (email && profile.emails.includes(email)) reasons.push('email');
    if (reasons.length) {
      matches.push({ profile, level: 'strong', reasons });
      return;
    }
    const similarity = Math.max(0, ...profile.names.map((n) => nameSimilarity(candidate.name, n)));
    if (similarity >= 0.85) matches.push({ profile, level: 'possible', reasons: ['name'], similarity });
  });
  return matches.sort((a, b) => (a.level === b.level ? (b.similarity || 1) - (a.similarity || 1) : a.level === 'strong' ? -1 : 1));
};

/**
 * Pairs of existing profiles that probably are the same person but were not
 * linked (e.g. similar name, different phone) — for the cleanup list.
 */
export const findProbableDuplicatePairs = (profiles = []) => {
  const pairs = [];
  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      const a = profiles[i];
      const b = profiles[j];
      const similarity = Math.max(...a.names.flatMap((x) => b.names.map((y) => nameSimilarity(x, y))));
      if (similarity >= 0.88) pairs.push({ a, b, similarity });
    }
  }
  return pairs.sort((x, y) => y.similarity - x.similarity);
};
