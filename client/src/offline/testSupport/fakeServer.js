// A tiny in-memory PostgREST look-alike for offline tests. Deliberately written separately from
// ../postgrest.js (only eq / in / is.null filters) so the tests do not just check the code against itself.

const toObject = (params) => Object.fromEntries(params.entries());

export const createFakeServer = ({ restBase, tables = {}, numericTables = [] }) => {
  const state = {
    tables: JSON.parse(JSON.stringify(tables)),
    nextId: Object.fromEntries(numericTables.map((t) => [t, 1000])),
    calls: [],            // every request that reached the "server"
    reachable: true,      // false => fetch rejects like a dead network
    rejectNext: null,     // { table, method, status, body } one-shot forced error
    forcedErrors: [],     // queue of { table, method, status, code, message, details }
    tokenOk: true
  };

  const rowsMatching = (rows, query) => rows.filter((row) => Object.entries(query).every(([col, expr]) => {
    if (['select', 'order', 'limit', 'offset', 'on_conflict'].includes(col)) return true;
    const [op, ...rest] = expr.split('.');
    const value = rest.join('.');
    if (op === 'eq') return String(row[col]) === value;
    if (op === 'is' && value === 'null') return row[col] === null || row[col] === undefined;
    if (op === 'in') return value.replace(/[()]/g, '').split(',').includes(String(row[col]));
    throw new Error(`fake server: unsupported filter ${col}=${expr}`);
  }));

  const json = (body, status = 200, headers = {}) => new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers }
  });

  const handler = async (url, init = {}) => {
    if (!state.reachable) throw new TypeError('Failed to fetch');
    const method = (init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    const parsed = new URL(url);

    if (!url.startsWith(restBase)) {
      state.calls.push({ method, url, table: null, body: init.body ? JSON.parse(init.body) : null, auth: headers.get('authorization') });
      return json({ ok: true });
    }
    const table = parsed.pathname.replace(/^.*\/rest\/v1\//, '').split('/')[0];
    const query = toObject(parsed.searchParams);
    const body = init.body ? JSON.parse(init.body) : null;
    const call = { method, url, table, query, body, auth: headers.get('authorization'), prefer: headers.get('prefer') };
    state.calls.push(call);

    if (!state.tokenOk && headers.get('authorization') !== 'Bearer fresh-token') return json({ message: 'JWT expired', code: 'PGRST301' }, 401);

    const forced = state.forcedErrors.find((f) => f.table === table && f.method === method);
    if (forced) {
      state.forcedErrors.splice(state.forcedErrors.indexOf(forced), 1);
      return json({ code: forced.code, message: forced.message, details: forced.details || '' }, forced.status);
    }

    const rows = (state.tables[table] = state.tables[table] || []);
    const wantsRows = (headers.get('prefer') || '').includes('return=representation');
    const single = (headers.get('accept') || '').includes('vnd.pgrst.object+json');

    if (method === 'GET') {
      const result = rowsMatching(rows, query);
      if (single) return result.length === 1 ? json(result[0]) : json({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }, 406);
      return json(result, 200, { 'Content-Range': `0-${Math.max(result.length - 1, 0)}/${result.length}` });
    }
    if (method === 'POST') {
      const incoming = (Array.isArray(body) ? body : [body]).map((row) => {
        if (row.id !== undefined && row.id !== null) {
          if (rows.some((r) => String(r.id) === String(row.id))) return { __duplicate: row.id };
          return row;
        }
        return state.nextId[table] !== undefined ? { ...row, id: state.nextId[table]++ } : row;
      });
      const dup = incoming.find((r) => r.__duplicate !== undefined);
      if (dup) return json({ code: '23505', message: `duplicate key value violates unique constraint "${table}_pkey"`, details: `Key (id)=(${dup.__duplicate}) already exists.` }, 409);
      rows.push(...incoming);
      return wantsRows ? json(single ? incoming[0] : incoming, 201) : json(null, 201);
    }
    if (method === 'PATCH') {
      const hit = rowsMatching(rows, query);
      hit.forEach((r) => Object.assign(r, body));
      return wantsRows ? json(hit) : json(null, 204);
    }
    if (method === 'DELETE') {
      const hit = rowsMatching(rows, query);
      state.tables[table] = rows.filter((r) => !hit.includes(r));
      return wantsRows ? json(hit) : json(null, 204);
    }
    return json({ message: 'unsupported' }, 400);
  };

  return { fetch: handler, state };
};
