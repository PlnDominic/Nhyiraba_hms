const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
// the handlers get their own fake clients; keep the real library (and its install quirks) out of the test
const supaPath = require.resolve('@supabase/supabase-js', { paths: [path.join(__dirname, '..')] });
require.cache[supaPath] = { id: supaPath, filename: supaPath, loaded: true, exports: { createClient: () => ({}) } };

const { handleSetPassword, handleDeleteUser } = require('../adminUserHandlers');

process.env.SUPABASE_SERVICE_KEY = 'service';

const makeAuth = (role, { admins = 2, target = { user_id: 't1', email: 'kofi@hotel.com', role: 'staff' } } = {}) => {
  const log = { passwords: [], flagged: [], deletedAuth: [], deletedRows: [] };
  const supabase = {
    auth: { admin: {
      updateUserById: async (id, attrs) => { log.passwords.push({ id, ...attrs }); return { error: null }; },
      deleteUser: async (id) => { log.deletedAuth.push(id); return { error: null }; },
    } },
    from: (table) => {
      const q = {
        select: (_c, opts) => { q._head = opts?.head; return q; },
        in: () => Promise.resolve({ count: admins, error: null }),
        eq: (_c, v) => {
          if (q._delete) { log.deletedRows.push({ table, v }); return Promise.resolve({ error: null }); }
          if (q._update) { log.flagged.push({ table, v, ...q._update }); return Promise.resolve({ error: null }); }
          q._id = v; return q;
        },
        maybeSingle: async () => ({ data: q._id === target.user_id ? target : null }),
        update: (row) => { q._update = row; return q; },
        delete: () => { q._delete = true; return q; },
      };
      return q;
    },
  };
  return { fn: async () => ({ supabase, user: { id: 'me' }, role }), log };
};

test('non-admins cannot set passwords or delete users', async () => {
  const { fn } = makeAuth('manager');
  assert.strictEqual((await handleSetPassword('Bearer x', { userId: 't1' }, fn)).status, 403);
  assert.strictEqual((await handleDeleteUser('Bearer x', { userId: 't1' }, fn)).status, 403);
});

test('reset generates a strong temporary password and forces a change', async () => {
  const { fn, log } = makeAuth('admin');
  const r = await handleSetPassword('Bearer x', { userId: 't1' }, fn);
  assert.strictEqual(r.status, 200);
  assert.ok(r.body.temporaryPassword.length >= 14);
  assert.strictEqual(log.passwords[0].password, r.body.temporaryPassword);
  assert.strictEqual(log.flagged[0].password_change_required, true);
});

test('an admin-chosen password must meet the policy', async () => {
  const { fn, log } = makeAuth('admin');
  assert.strictEqual((await handleSetPassword('Bearer x', { userId: 't1', password: 'short' }, fn)).status, 400);
  assert.strictEqual((await handleSetPassword('Bearer x', { userId: 't1', password: 'kofi-Strong-77x' }, fn)).status, 400); // contains email name
  const ok = await handleSetPassword('Bearer x', { userId: 't1', password: 'Violet-River-4821' }, fn);
  assert.strictEqual(ok.status, 200);
  assert.strictEqual(ok.body.temporaryPassword, undefined);
  assert.strictEqual(log.passwords.length, 1);
});

test('delete removes permissions, profile and sign-in account', async () => {
  const { fn, log } = makeAuth('admin');
  const r = await handleDeleteUser('Bearer x', { userId: 't1' }, fn);
  assert.strictEqual(r.status, 200);
  assert.deepStrictEqual(log.deletedRows.map((d) => d.table), ['user_permissions', 'user_profiles']);
  assert.deepStrictEqual(log.deletedAuth, ['t1']);
});

test('cannot delete yourself or the last admin', async () => {
  const self = makeAuth('admin', { target: { user_id: 'me', role: 'admin' } });
  assert.strictEqual((await handleDeleteUser('Bearer x', { userId: 'me' }, self.fn)).status, 400);
  const last = makeAuth('admin', { admins: 1, target: { user_id: 't2', email: 'a@b.c', role: 'admin' } });
  const r = await handleDeleteUser('Bearer x', { userId: 't2' }, last.fn);
  assert.strictEqual(r.status, 400);
  assert.strictEqual(last.log.deletedAuth.length, 0);
});

test('reports a clear error when the service key is missing', async () => {
  const { fn } = makeAuth('admin');
  delete process.env.SUPABASE_SERVICE_KEY;
  const r = await handleSetPassword('Bearer x', { userId: 't1' }, fn);
  process.env.SUPABASE_SERVICE_KEY = 'service';
  assert.strictEqual(r.status, 503);
});
