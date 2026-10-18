// Server-side authentication and role checks shared by the Express server
// and the Vercel functions. Never trust a role sent by the browser: the role
// is read from user_profiles for the user that owns the bearer token.
const { createClient } = require('@supabase/supabase-js');

const MANAGER_ROLES = ['admin', 'administrator', 'manager'];
const ADMIN_ROLES = ['admin', 'administrator'];

const supabaseUrl = () => process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;

// Service key when configured (bypasses RLS, server only); otherwise act as the user so RLS applies.
const getClient = (token) => {
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (serviceKey) return createClient(supabaseUrl(), serviceKey);
  return createClient(supabaseUrl(), process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};

const deny = (status, error) => ({ error: { status, body: { success: false, error } } });

/**
 * Resolve the caller from an Authorization header.
 * Returns { supabase, user, role, department } or { error: { status, body } }.
 */
const authenticate = async (authHeader) => {
  const token = String(authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return deny(401, 'Authentication required');

  const supabase = getClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return deny(401, 'Invalid session');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('role, department')
    .eq('user_id', data.user.id)
    .maybeSingle();

  return {
    supabase,
    user: data.user,
    role: profile?.role || 'staff',
    department: profile?.department || null,
  };
};

const isManager = (auth) => MANAGER_ROLES.includes(auth?.role);
const isAdmin = (auth) => ADMIN_ROLES.includes(auth?.role);

/** Authenticate and require one of `roles` (omit roles to allow any signed-in staff). */
const authorize = async (authHeader, roles = null) => {
  const auth = await authenticate(authHeader);
  if (auth.error) return auth;
  if (roles && !roles.includes(auth.role)) return deny(403, 'You do not have permission to do this');
  return auth;
};

/** Express middleware: req.auth is set on success. */
const requireAuth = (roles = null) => async (req, res, next) => {
  try {
    const auth = await authorize(req.headers.authorization, roles);
    if (auth.error) return res.status(auth.error.status).json(auth.error.body);
    req.auth = auth;
    return next();
  } catch (error) {
    console.error('Authorization check failed:', error);
    return res.status(500).json({ success: false, error: 'Authorization check failed' });
  }
};

module.exports = { authenticate, authorize, requireAuth, isManager, isAdmin, MANAGER_ROLES, ADMIN_ROLES };
