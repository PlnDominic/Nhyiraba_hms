// node --test server/__tests__
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// --- stub @supabase/supabase-js before the server modules load -------------
const USERS = {
  'staff-token': { id: 'u-staff', role: 'staff' },
  'manager-token': { id: 'u-mgr', role: 'manager' },
  'admin-token': { id: 'u-admin', role: 'admin' },
};
let smsCountInWindow = 0;
const inserted = [];
const fakeClient = (token) => ({
  auth: {
    getUser: async (t) => (USERS[t] ? { data: { user: { id: USERS[t].id } } } : { data: null, error: { message: 'bad' } }),
  },
  from: (table) => {
    const q = {
      _table: table,
      select: (_c, opts) => { q._head = opts?.head; return q; },
      eq: (col, val) => { q._eq = val; return q; },
      gte: () => (q._head ? Promise.resolve({ count: smsCountInWindow, error: null }) : q),
      order: () => q,
      limit: () => Promise.resolve({ data: [], error: null }),
      maybeSingle: async () => {
        const user = Object.values(USERS).find((u) => u.id === q._eq);
        return { data: user ? { role: user.role, department: 'Front Desk' } : null };
      },
      insert: async (row) => { inserted.push(row); return { error: null }; },
    };
    return q;
  },
});
const supaPath = require.resolve('@supabase/supabase-js', { paths: [path.join(__dirname, '..')] });
require.cache[supaPath] = { id: supaPath, filename: supaPath, loaded: true, exports: { createClient: (_u, _k, opts) => fakeClient(opts) } };

process.env.ARKESEL_API_KEY = 'test-key';
process.env.SUPABASE_URL = 'http://localhost';
process.env.REACT_APP_SUPABASE_ANON_KEY = 'anon';
global.fetch = async () => ({ ok: true, json: async () => ({ status: 'success', data: [{ id: 'msg-1', recipient: '233241234567' }] }) });

const { handleSend, handleStatus } = require('../smsHandlers');
const { requireAuth, ADMIN_ROLES } = require('../auth');

const bearer = (t) => `Bearer ${t}`;
const lifecycle = { event: 'checked_in', phone: '0241234567', data: { guestName: 'Ama', roomNumber: 4 } };
const custom = { event: 'custom', phone: '0241234567', data: { message: 'Hello' } };

test('rejects requests without a valid session', async () => {
  assert.equal((await handleSend(undefined, lifecycle)).status, 401);
  assert.equal((await handleSend(bearer('forged'), lifecycle)).status, 401);
});

test('any signed-in staff can trigger lifecycle messages', async () => {
  const res = await handleSend(bearer('staff-token'), lifecycle);
  assert.equal(res.status, 200);
  assert.equal(inserted.at(-1).sent_by, 'u-staff');
});

test('custom messages, reminders and retries are manager-only', async () => {
  assert.equal((await handleSend(bearer('staff-token'), custom)).status, 403);
  assert.equal((await handleSend(bearer('staff-token'), { ...lifecycle, event: 'payment_reminder', data: { amount: 5 } })).status, 403);
  assert.equal((await handleSend(bearer('staff-token'), { ...lifecycle, retryOf: 'x' })).status, 403);
  assert.equal((await handleSend(bearer('manager-token'), custom)).status, 200);
});

test('unknown message types are rejected', async () => {
  assert.equal((await handleSend(bearer('manager-token'), { ...custom, event: 'drop_table' })).status, 400);
});

test('per-user rate limit stops bulk sending', async () => {
  smsCountInWindow = 40;
  assert.equal((await handleSend(bearer('manager-token'), custom)).status, 429);
  smsCountInWindow = 0;
});

test('message log is manager-only', async () => {
  assert.equal((await handleStatus(bearer('staff-token'))).status, 403);
  assert.equal((await handleStatus(bearer('manager-token'))).status, 200);
});

test('requireAuth middleware enforces roles from the database, not the request', async () => {
  const run = async (token, roles, body = { role: 'admin' }) => {
    let status = 200; let nextCalled = false;
    const req = { headers: { authorization: token && bearer(token) }, body };
    const res = { status(c) { status = c; return this; }, json() { return this; } };
    await requireAuth(roles)(req, res, () => { nextCalled = true; });
    return { status, nextCalled, auth: req.auth };
  };
  assert.equal((await run(null)).status, 401);
  const staff = await run('staff-token', ADMIN_ROLES); // claims admin in body; still refused
  assert.equal(staff.status, 403);
  assert.equal(staff.nextCalled, false);
  const admin = await run('admin-token', ADMIN_ROLES);
  assert.equal(admin.nextCalled, true);
  assert.equal(admin.auth.role, 'admin');
  assert.equal((await run('staff-token')).nextCalled, true); // any signed-in user
});
