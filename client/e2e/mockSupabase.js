// A small Supabase look-alike (auth + PostgREST) for browser end-to-end tests.
// Serves data from memory and records every write so tests can check what reached "the server".
const http = require('http');

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 365 * 86400 })}.sig`;

const USER = { id: 'user-e2e', aud: 'authenticated', role: 'authenticated', email: 'admin@e2e.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };

const seed = () => ({
  user_profiles: [{ user_id: USER.id, email: USER.email, role: 'admin', full_name: 'E2E Admin', department: 'Management', position: 'Manager', password_change_required: false }],
  rooms: [1, 2, 3, 4].map((n) => ({ id: n, room_number: n, type: 'Standard', status: n === 2 ? 'Occupied' : 'Available', price: 200, capacity: 2, guest: n === 2 ? 'Ama Boateng' : null, block: 'Main' })),
  reservations: [{ id: '00000000-0000-4000-8000-000000000001', room_id: 1, room_number: 1, guest_name: 'Seeded Guest', guest_phone: '0241234567', check_in_date: '2026-11-02T12:00:00Z', check_out_date: '2026-11-04T12:00:00Z', status: 'Reserved', room_type: 'Standard', room_price: 200, created_at: '2026-10-18T08:00:00Z' }],
  guests: [{ id: '00000000-0000-4000-8000-0000000000aa', name: 'Ama Boateng', room: '2', status: 'Checked In', phone: '0241234567', check_in: '2026-10-17T12:00:00Z', created_at: '2026-10-17T12:00:00Z' }]
});

const createMockSupabase = () => {
  let tables = seed();
  let writes = [];
  let smsCalls = [];
  const state = { reachable: true };

  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Expose-Headers': 'Content-Range' };
  const send = (res, status, body, extra = {}) => {
    res.writeHead(status, { 'Content-Type': 'application/json', ...cors, ...extra });
    res.end(body === null || body === undefined ? '' : JSON.stringify(body));
  };

  const compare = (a, b) => (typeof a === 'number' ? a - Number(b) : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
  const matches = (row, col, expr) => {
    const [op, ...rest] = expr.replace(/^not\./, '').split('.');
    const value = rest.join('.');
    const negate = expr.startsWith('not.');
    let ok;
    if (op === 'eq') ok = String(row[col]) === value;
    else if (op === 'neq') ok = String(row[col]) !== value;
    else if (op === 'in') ok = value.replace(/[()"]/g, '').split(',').includes(String(row[col]));
    else if (op === 'is') ok = value === 'null' ? row[col] == null : String(row[col]) === value;
    else if (op === 'gt') ok = row[col] != null && compare(row[col], value) > 0;
    else if (op === 'gte') ok = row[col] != null && compare(row[col], value) >= 0;
    else if (op === 'lt') ok = row[col] != null && compare(row[col], value) < 0;
    else if (op === 'lte') ok = row[col] != null && compare(row[col], value) <= 0;
    else ok = true; // unsupported filters are ignored (pages still render)
    return negate ? !ok : ok;
  };
  const filter = (rows, params) => {
    const reserved = ['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'];
    let out = rows.filter((r) => [...params.entries()].every(([k, v]) => reserved.includes(k) || k === 'or' || k === 'and' || matches(r, k, v)));
    const order = params.get('order');
    if (order) {
      const [col, dir] = order.split(',')[0].split('.');
      out = [...out].sort((a, b) => (dir === 'desc' ? -1 : 1) * compare(a[col] ?? '', b[col] ?? ''));
    }
    if (params.get('limit')) out = out.slice(Number(params.get('offset') || 0), Number(params.get('offset') || 0) + Number(params.get('limit')));
    return out;
  };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }

    // test control
    if (url.pathname === '/__calls') return send(res, 200, { writes, smsCalls });
    if (url.pathname === '/__reset') { tables = seed(); writes = []; smsCalls = []; return send(res, 200, { ok: true }); }
    if (url.pathname === '/__tables') return send(res, 200, tables);

    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const body = raw ? JSON.parse(raw) : null;

      if (url.pathname === '/auth/v1/health') return send(res, 200, { ok: true });
      if (url.pathname === '/auth/v1/token') {
        const token = jwt(USER.id);
        return send(res, 200, { access_token: token, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'refresh-e2e', user: USER });
      }
      if (url.pathname === '/auth/v1/user') return send(res, 200, USER);
      if (url.pathname === '/auth/v1/logout') return send(res, 204, null);

      if (url.pathname === '/api/sms/send') { smsCalls.push(body); return send(res, 200, { success: true }); }

      const m = url.pathname.match(/^\/rest\/v1\/([^/]+)/);
      if (!m) return send(res, 404, { message: 'not found' });
      const table = m[1];
      const rows = (tables[table] = tables[table] || []);
      const prefer = req.headers.prefer || '';
      const wantsRows = prefer.includes('return=representation');
      const single = (req.headers.accept || '').includes('vnd.pgrst.object+json');

      if (req.method === 'GET') {
        const result = filter(rows, url.searchParams);
        if (single) return result.length === 1 ? send(res, 200, result[0]) : send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${result.length} rows` });
        return send(res, 200, result, { 'Content-Range': `0-${Math.max(result.length - 1, 0)}/${result.length}` });
      }
      writes.push({ method: req.method, table, query: Object.fromEntries(url.searchParams), body, at: Date.now() });
      if (req.method === 'POST') {
        const incoming = Array.isArray(body) ? body : [body];
        const dup = incoming.find((r) => r.id && rows.some((x) => String(x.id) === String(r.id)));
        if (dup) return send(res, 409, { code: '23505', message: 'duplicate key value violates unique constraint', details: `Key (id)=(${dup.id}) already exists.` });
        rows.push(...incoming);
        return wantsRows ? send(res, 201, single ? incoming[0] : incoming) : send(res, 201, null);
      }
      const hit = filter(rows, url.searchParams);
      if (req.method === 'PATCH') { hit.forEach((r) => Object.assign(r, body)); return wantsRows ? send(res, 200, hit) : send(res, 204, null); }
      if (req.method === 'DELETE') { tables[table] = rows.filter((r) => !hit.includes(r)); return wantsRows ? send(res, 200, hit) : send(res, 204, null); }
      return send(res, 400, { message: 'unsupported' });
    });
  });

  return { server, state };
};

module.exports = { createMockSupabase };
