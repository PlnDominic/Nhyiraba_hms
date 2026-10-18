// Pure helpers that let the offline layer answer PostgREST (Supabase) requests from rows kept
// on the device. Anything it cannot evaluate faithfully (or/and groups, JSON paths, embedded
// resources, full-text search...) reports `supported: false` and the caller falls back to the
// exact cached response instead of guessing.

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns', 'returning']);
const SIMPLE_OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in'];

// ---------------------------------------------------------------------------
// URL / header parsing
// ---------------------------------------------------------------------------
export const parseRestRequest = (url, restBase) => {
  if (typeof url !== 'string' || !url.startsWith(restBase)) return null;
  const parsed = new URL(url);
  const path = parsed.pathname.replace(/^.*\/rest\/v1\//, '');
  if (!path) return null;
  const [name] = path.split('/');
  return { table: decodeURIComponent(name), isRpc: path.startsWith('rpc/'), params: parsed.searchParams };
};

const splitTop = (text) => {
  // splits "a,b,\"c,d\"" on commas outside quotes
  const parts = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === ',' && !quoted) { parts.push(current); current = ''; continue; }
    current += ch;
  }
  parts.push(current);
  return parts;
};

export const parseFilters = (params) => {
  const filters = [];
  let supported = true;
  for (const [key, raw] of params.entries()) {
    if (RESERVED.has(key)) continue;
    if (key === 'and' || key === 'or' || key.includes('->') || key.includes('.')) { supported = false; continue; }
    let rest = raw;
    let negate = false;
    if (rest.startsWith('not.')) { negate = true; rest = rest.slice(4); }
    const dot = rest.indexOf('.');
    const op = dot === -1 ? rest : rest.slice(0, dot);
    const value = dot === -1 ? '' : rest.slice(dot + 1);
    if (!SIMPLE_OPS.includes(op)) { supported = false; continue; }
    if (op === 'in') {
      const inner = value.replace(/^\(/, '').replace(/\)$/, '');
      filters.push({ col: key, op, value: inner === '' ? [] : splitTop(inner), negate });
    } else {
      filters.push({ col: key, op, value, negate });
    }
  }
  return { filters, supported };
};

export const parseOrder = (text) => (text
  ? text.split(',').filter(Boolean).map((part) => {
    const [col, ...mods] = part.split('.');
    return { col, desc: mods.includes('desc'), nullsFirst: mods.includes('nullsfirst') ? true : mods.includes('nullslast') ? false : null };
  })
  : []);

export const parseSelect = (text) => {
  if (!text || text === '*') return { all: true, supported: true };
  if (/[():>]/.test(text)) return { all: false, supported: false }; // embeds, aliases, casts, json paths
  return { all: false, columns: text.split(',').map((c) => c.trim()).filter(Boolean), supported: true };
};

export const preferTokens = (headers) => {
  const out = {};
  const value = headers.get('prefer');
  if (!value) return out;
  value.split(',').forEach((token) => {
    const [k, v] = token.trim().split('=');
    out[k] = v === undefined ? true : v;
  });
  return out;
};

export const wantsSingleObject = (headers) => (headers.get('accept') || '').includes('application/vnd.pgrst.object+json');

// ---------------------------------------------------------------------------
// Value comparison
// ---------------------------------------------------------------------------
const ISO_LIKE = /^\d{4}-\d{2}-\d{2}/;
const asTime = (v) => (typeof v === 'string' && ISO_LIKE.test(v) ? Date.parse(v) : NaN);

const coerceFilterValue = (rowValue, text) => {
  if (typeof rowValue === 'number') return Number(text);
  if (typeof rowValue === 'boolean') return text === 'true' || text === 't';
  return text;
};

const compare = (rowValue, text) => {
  const target = coerceFilterValue(rowValue, text);
  if (typeof rowValue === 'string') {
    const a = asTime(rowValue);
    const b = asTime(text);
    if (!Number.isNaN(a) && !Number.isNaN(b)) return a - b;
  }
  if (rowValue < target) return -1;
  if (rowValue > target) return 1;
  return rowValue === target ? 0 : NaN;
};

const likeToRegex = (pattern, flags) => new RegExp(
  `^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/[%*]/g, '.*').replace(/_/g, '.')}$`,
  flags
);

const matchOne = (row, { col, op, value }) => {
  const rowValue = row[col];
  if (op === 'is') {
    if (value === 'null') return rowValue === null || rowValue === undefined;
    if (value === 'true') return rowValue === true;
    if (value === 'false') return rowValue === false;
    return false;
  }
  if (rowValue === null || rowValue === undefined) return false; // SQL: NULL never matches comparisons
  switch (op) {
    case 'eq': return compare(rowValue, value) === 0;
    case 'neq': return compare(rowValue, value) !== 0;
    case 'gt': return compare(rowValue, value) > 0;
    case 'gte': return compare(rowValue, value) >= 0;
    case 'lt': return compare(rowValue, value) < 0;
    case 'lte': return compare(rowValue, value) <= 0;
    case 'like': return likeToRegex(value, '').test(String(rowValue));
    case 'ilike': return likeToRegex(value, 'i').test(String(rowValue));
    case 'in': return value.some((v) => compare(rowValue, v) === 0);
    default: return false;
  }
};

export const rowMatches = (row, filters) => filters.every((f) => {
  const result = matchOne(row, f);
  return f.negate ? !result : result;
});

const compareForSort = (a, b, { desc, nullsFirst }) => {
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  // Postgres default: NULLs are "largest" -> last for ASC, first for DESC
  const nullsAreFirst = nullsFirst === null ? desc : nullsFirst;
  if (aNull || bNull) {
    if (aNull && bNull) return 0;
    return aNull ? (nullsAreFirst ? -1 : 1) : (nullsAreFirst ? 1 : -1);
  }
  const ta = asTime(a);
  const tb = asTime(b);
  let result;
  if (!Number.isNaN(ta) && !Number.isNaN(tb)) result = ta - tb;
  else if (typeof a === 'number' && typeof b === 'number') result = a - b;
  else result = String(a).localeCompare(String(b), undefined, { numeric: false });
  return desc ? -result : result;
};

export const sortRows = (rows, order) => {
  if (!order.length) return rows;
  return [...rows].sort((x, y) => {
    for (const o of order) {
      const c = compareForSort(x[o.col], y[o.col], o);
      if (c !== 0) return c;
    }
    return 0;
  });
};

export const projectRow = (row, select) => {
  if (select.all) return row;
  const out = {};
  select.columns.forEach((c) => { if (c in row) out[c] = row[c]; });
  return out;
};

/**
 * Evaluate a GET against local rows. Returns { rows, total, supported }.
 * `total` is the match count before limit/offset (for Prefer: count).
 */
export const queryRows = (rows, params) => {
  const { filters, supported: filtersOk } = parseFilters(params);
  const select = parseSelect(params.get('select'));
  const supported = filtersOk && select.supported;
  if (!supported) return { rows: [], total: 0, supported: false };

  const matched = rows.filter((r) => rowMatches(r, filters));
  const total = matched.length;
  let result = sortRows(matched, parseOrder(params.get('order')));
  const offset = Number(params.get('offset')) || 0;
  const limit = params.get('limit') === null ? undefined : Number(params.get('limit'));
  if (offset || limit !== undefined) result = result.slice(offset, limit === undefined ? undefined : offset + limit);
  return { rows: result.map((r) => projectRow(r, select)), total, supported: true };
};

/** A query that returns the whole table (no filters/limits/embeds) can seed the offline mirror. */
export const isFullTableQuery = (params) => {
  const { filters, supported } = parseFilters(params);
  return supported && filters.length === 0 && params.get('limit') === null && !params.get('offset')
    && parseSelect(params.get('select')).all;
};

// ---------------------------------------------------------------------------
// Applying a queued mutation to a set of rows (read-your-writes while offline)
// ---------------------------------------------------------------------------
export const rowsFromBody = (body) => {
  if (body === null || body === undefined || body === '') return [];
  const parsed = typeof body === 'string' ? JSON.parse(body) : body;
  return Array.isArray(parsed) ? parsed : [parsed];
};

const sameKey = (a, b, keys) => keys.every((k) => a[k] !== undefined && String(a[k]) === String(b[k]));

/**
 * mutation: { method, params (URLSearchParams), body (string|object), prefer: {} }
 * Returns { rows: newRows, affected: rowsTouched }.
 */
export const applyMutation = (rows, mutation) => {
  const method = mutation.method.toUpperCase();
  const { filters } = parseFilters(mutation.params);

  if (method === 'POST' || method === 'PUT') {
    const incoming = rowsFromBody(mutation.body);
    const onConflict = (mutation.params.get('on_conflict') || '').split(',').filter(Boolean);
    const keys = onConflict.length ? onConflict : ['id'];
    const upsert = Boolean(mutation.prefer?.resolution) || method === 'PUT' || onConflict.length > 0;
    let next = [...rows];
    const affected = [];
    incoming.forEach((row) => {
      const index = upsert ? next.findIndex((r) => sameKey(r, row, keys)) : -1;
      if (index >= 0) {
        if (mutation.prefer?.resolution === 'ignore-duplicates') return;
        next[index] = { ...next[index], ...row };
        affected.push(next[index]);
      } else {
        next = [...next, row];
        affected.push(row);
      }
    });
    return { rows: next, affected };
  }

  if (method === 'PATCH') {
    const patch = rowsFromBody(mutation.body)[0] || {};
    const affected = [];
    const next = rows.map((r) => {
      if (!rowMatches(r, filters)) return r;
      const updated = { ...r, ...patch };
      affected.push(updated);
      return updated;
    });
    return { rows: next, affected };
  }

  if (method === 'DELETE') {
    const affected = rows.filter((r) => rowMatches(r, filters));
    return { rows: rows.filter((r) => !rowMatches(r, filters)), affected };
  }

  return { rows, affected: [] };
};

// ---------------------------------------------------------------------------
// Response builders (shapes postgrest-js understands)
// ---------------------------------------------------------------------------
export const jsonResponse = (body, { status = 200, headers = {} } = {}) => new Response(
  status === 204 || body === undefined ? null : JSON.stringify(body),
  { status, headers: { 'Content-Type': 'application/json', ...headers } }
);

export const errorResponse = (status, code, message, details = null) => jsonResponse(
  { code, message, details, hint: null },
  { status }
);

export const contentRange = (returned, total) => (returned === 0 ? `*/${total}` : `0-${returned - 1}/${total}`);
