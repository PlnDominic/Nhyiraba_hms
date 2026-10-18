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
let bulkCountInWindow = 0;
const inserted = [];
const updated = [];
const fetchCalls = [];
const fakeClient = (token) => ({
  auth: {
    getUser: async (t) => (USERS[t] ? { data: { user: { id: USERS[t].id } } } : { data: null, error: { message: 'bad' } }),
  },
  from: (table) => {
    const q = {
      _table: table,
      select: (_c, opts) => { q._head = opts?.head; return q; },
      eq: (col, val) => { q._eq = val; return q; },
      not: () => q,
      like: () => { q._bulk = true; return q; },
      in: () => q,
      gte: () => (q._head ? Promise.resolve({ count: q._bulk ? bulkCountInWindow : smsCountInWindow, error: null }) : q),
      order: () => q,
      limit: () => Promise.resolve({ data: [], error: null }),
      update: (row) => ({ eq: async () => { updated.push({ table, row }); return { error: null }; } }),
      maybeSingle: async () => {
        const user = Object.values(USERS).find((u) => u.id === q._eq);
        return { data: user ? { role: user.role, department: 'Front Desk' } : null };
      },
      insert: async (row) => { inserted.push(Array.isArray(row) ? { table, rows: row } : { table, ...row }); return { error: null }; },
    };
    return q;
  },
});
const supaPath = require.resolve('@supabase/supabase-js', { paths: [path.join(__dirname, '..')] });
require.cache[supaPath] = { id: supaPath, filename: supaPath, loaded: true, exports: { createClient: (_u, _k, opts) => fakeClient(opts) } };

process.env.ARKESEL_API_KEY = 'test-key';
process.env.SUPABASE_URL = 'http://localhost';
process.env.REACT_APP_SUPABASE_ANON_KEY = 'anon';
global.fetch = async (_url, opts) => {
  const body = JSON.parse(opts?.body || '{}');
  fetchCalls.push(body);
  const recipients = body.recipients || [];
  return { ok: true, json: async () => ({ status: 'success', data: recipients.map((r, i) => ({ id: `msg-${fetchCalls.length}-${i}`, recipient: r })) }) };
};

const { handleSend, handleStatus, handleBulkSend, handleCampaigns } = require('../smsHandlers');
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
  assert.equal(inserted.filter((r) => r.table === 'sms_logs').at(-1).sent_by, 'u-staff');
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

// ---------------------------------------------------------------- bulk SMS
const bulk = (over = {}) => ({
  campaign: 'promotion',
  name: 'Weekend offer',
  message: 'Enjoy 20% off weekend stays at Nhyiraba Hotel!',
  recipients: [{ phone: '0241234567', name: 'Ama Boateng' }, { phone: '0201112222', name: 'Kofi Mensah' }],
  ...over,
});
const reset = () => { fetchCalls.length = 0; inserted.length = 0; updated.length = 0; bulkCountInWindow = 0; };

test('bulk sending is manager-only and needs a session', async () => {
  reset();
  assert.equal((await handleBulkSend(undefined, bulk())).status, 401);
  assert.equal((await handleBulkSend(bearer('staff-token'), bulk())).status, 403);
  assert.equal(fetchCalls.length, 0);
  assert.equal((await handleCampaigns(bearer('staff-token'))).status, 403);
});

test('bulk send de-duplicates numbers, reports invalid ones and uses one batched request', async () => {
  reset();
  const res = await handleBulkSend(bearer('manager-token'), bulk({
    recipients: [
      { phone: '0241234567', name: 'Ama' },
      { phone: '+233 24 123 4567', name: 'Ama again' }, // same person, different format
      { phone: '0201112222', name: 'Kofi' },
      { phone: 'not-a-number', name: 'Bad' },
    ],
  }));
  assert.equal(res.status, 200);
  assert.deepEqual([res.body.total, res.body.sent, res.body.failed, res.body.duplicates], [2, 2, 0, 1]);
  assert.deepEqual(res.body.invalid, ['not-a-number']);
  assert.equal(fetchCalls.length, 1, 'no {name} placeholder: one request for the whole batch');
  assert.deepEqual(fetchCalls[0].recipients, ['233241234567', '233201112222']);
  const logs = inserted.find((r) => r.table === 'sms_logs' && r.rows);
  assert.equal(logs.rows.length, 2);
  assert.ok(logs.rows.every((r) => r.event === 'bulk_promotion' && r.campaign_id === res.body.campaignId && r.sent_by === 'u-mgr'));
  const campaign = inserted.find((r) => r.table === 'sms_campaigns');
  assert.equal(campaign.type, 'promotion');
  assert.equal(campaign.total, 2);
  assert.deepEqual(updated.at(-1).row, { submitted: 2, failed: 0 });
});

test('{name} personalises each message with the first name, one request per person', async () => {
  reset();
  const res = await handleBulkSend(bearer('manager-token'), bulk({ message: 'Hello {name}, join our Friday live music night!' }));
  assert.equal(res.body.sent, 2);
  assert.equal(fetchCalls.length, 2);
  assert.deepEqual(fetchCalls.map((c) => c.message).sort(), ['Hello Ama, join our Friday live music night!', 'Hello Kofi, join our Friday live music night!']);
  assert.ok(fetchCalls.every((c) => c.recipients.length === 1));
});

test('bulk input is validated before anything is sent', async () => {
  reset();
  const run = (over) => handleBulkSend(bearer('manager-token'), bulk(over));
  assert.equal((await run({ campaign: 'spam' })).status, 400);
  assert.equal((await run({ message: '   ' })).status, 400);
  assert.equal((await run({ message: 'x'.repeat(321) })).status, 400);
  assert.equal((await run({ recipients: [] })).status, 400);
  assert.equal((await run({ recipients: [{ phone: 'abc' }] })).status, 400);
  assert.equal((await run({ recipients: Array.from({ length: 501 }, (_, i) => ({ phone: `02412${String(i).padStart(5, '0')}` })) })).status, 400);
  assert.equal(fetchCalls.length, 0);
});

test('daily bulk limit applies and does not use up the single-message rate limit', async () => {
  reset();
  bulkCountInWindow = 999;
  const res = await handleBulkSend(bearer('manager-token'), bulk());
  assert.equal(res.status, 429);
  assert.match(res.body.error, /1 more/);
  assert.equal(fetchCalls.length, 0);
  reset();
  smsCountInWindow = 0;
  assert.equal((await handleSend(bearer('manager-token'), custom)).status, 200);
});

test('a failed batch is recorded as failed, not silently dropped', async () => {
  reset();
  const original = global.fetch;
  global.fetch = async () => ({ ok: false, status: 400, json: async () => ({ message: 'Insufficient balance' }) });
  const res = await handleBulkSend(bearer('manager-token'), bulk());
  global.fetch = original;
  assert.equal(res.status, 200);
  assert.deepEqual([res.body.success, res.body.sent, res.body.failed], [false, 0, 2]);
  const logs = inserted.find((r) => r.table === 'sms_logs' && r.rows);
  assert.ok(logs.rows.every((r) => r.status === 'FAILED' && r.error === 'Insufficient balance'));
});

test('managers can load the campaign list', async () => {
  assert.equal((await handleCampaigns(bearer('manager-token'))).status, 200);
});
