// Admin-only staff account actions: set / reset a password and delete an account.
// These need the Supabase service key (auth.admin API), so they run on the server only.
const crypto = require('node:crypto');
const { authenticate, isAdmin } = require('./auth');

const MIN_LENGTH = 10;

// Same rules as client/src/utils/passwordPolicy.js
const passwordProblems = (password, email) => {
  const value = String(password || '');
  const problems = [];
  if (value.length < MIN_LENGTH) problems.push(`Use at least ${MIN_LENGTH} characters.`);
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value)) problems.push('Mix upper and lower case letters.');
  if (!/\d/.test(value)) problems.push('Include at least one number.');
  const lower = value.toLowerCase();
  if (['password', 'qwerty', 'letmein', 'welcome', 'admin', 'nhyiraba', 'hotel', '12345678'].some((c) => lower.includes(c))) {
    problems.push('Avoid common words like "password" or the hotel name.');
  }
  const local = String(email || '').split('@')[0].toLowerCase();
  if (local.length >= 3 && lower.includes(local)) problems.push('Do not include the email name.');
  return problems;
};

const generateTempPassword = (length = 14) => {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(upper), pick(lower), pick(digits)];
  while (chars.length < length) chars.push(pick(all));
  for (let i = chars.length - 1; i > 0; i -= 1) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
};

const fail = (status, error) => ({ status, body: { success: false, error } });

const requireAdmin = async (authHeader, authenticateFn) => {
  const auth = await authenticateFn(authHeader);
  if (auth.error) return { response: auth.error };
  if (!isAdmin(auth)) return { response: fail(403, 'Only administrators can manage staff accounts') };
  if (!process.env.SUPABASE_SERVICE_KEY) {
    return { response: fail(503, 'Account management is not configured: add SUPABASE_SERVICE_KEY to the server environment.') };
  }
  return { auth };
};

const loadTarget = async (supabase, userId) => {
  const { data } = await supabase.from('user_profiles').select('user_id, email, role').eq('user_id', userId).maybeSingle();
  return data;
};

// POST /api/admin/users/password  { userId, password? }  (no password = generate a temporary one)
const handleSetPassword = async (authHeader, payload = {}, authenticateFn = authenticate) => {
  const { response, auth } = await requireAdmin(authHeader, authenticateFn);
  if (response) return response;

  const { userId } = payload;
  if (!userId) return fail(400, 'Missing user');
  const target = await loadTarget(auth.supabase, userId);
  if (!target) return fail(404, 'User not found');

  const generated = !payload.password;
  const password = generated ? generateTempPassword() : String(payload.password);
  if (!generated) {
    const problems = passwordProblems(password, target.email);
    if (problems.length) return fail(400, `Password too weak. ${problems.join(' ')}`);
  }

  const { error } = await auth.supabase.auth.admin.updateUserById(userId, { password });
  if (error) return fail(500, error.message || 'Could not update the password');

  // The staff member must replace an admin-set password at next sign-in
  const { error: flagError } = await auth.supabase.from('user_profiles').update({ password_change_required: true }).eq('user_id', userId);
  if (flagError) console.error('Could not flag password_change_required:', flagError.message);

  return { status: 200, body: { success: true, ...(generated ? { temporaryPassword: password } : {}) } };
};

// POST /api/admin/users/delete  { userId }
const handleDeleteUser = async (authHeader, payload = {}, authenticateFn = authenticate) => {
  const { response, auth } = await requireAdmin(authHeader, authenticateFn);
  if (response) return response;

  const { userId } = payload;
  if (!userId) return fail(400, 'Missing user');
  if (userId === auth.user.id) return fail(400, 'You cannot delete your own account');
  const target = await loadTarget(auth.supabase, userId);
  if (!target) return fail(404, 'User not found');

  if (['admin', 'administrator'].includes(target.role)) {
    const { count } = await auth.supabase.from('user_profiles').select('user_id', { count: 'exact', head: true }).in('role', ['admin', 'administrator']);
    if (count !== null && count <= 1) return fail(400, 'You cannot delete the last administrator');
  }

  await auth.supabase.from('user_permissions').delete().eq('user_id', userId);
  const { error: profileError } = await auth.supabase.from('user_profiles').delete().eq('user_id', userId);
  if (profileError) return fail(500, profileError.message || 'Could not delete the staff profile');

  const { error } = await auth.supabase.auth.admin.deleteUser(userId);
  if (error && !/not found/i.test(error.message || '')) return fail(500, error.message || 'Could not delete the sign-in account');

  return { status: 200, body: { success: true } };
};

module.exports = { handleSetPassword, handleDeleteUser, passwordProblems, generateTempPassword };
