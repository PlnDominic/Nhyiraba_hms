// Keeps the device-side copies (table mirrors + exact cached responses) in step with writes, so
// reads made while offline reflect what the user just did ("read your writes").
import * as cache from './cache';
import { applyMutation, contentRange, parseSelect, queryRows } from './postgrest';

const paramsOf = (entry) => new URL(entry.url).searchParams;

const parseBody = (entry) => {
  try { return JSON.parse(entry.body); } catch (e) { return undefined; }
};

/** Rows a mutation would touch, from the mirror (or, failing that, whatever cached responses contain). */
export const affectedRows = async (userId, table, mutation) => {
  if (mutation.method === 'POST' || mutation.method === 'PUT') {
    return applyMutation([], mutation).affected;
  }
  const mirror = await cache.loadMirror(userId, table);
  let base = mirror?.rows;
  if (!base) {
    const union = new Map();
    (await cache.listReads(userId, table)).forEach((entry) => {
      const body = parseBody(entry);
      (Array.isArray(body) ? body : body ? [body] : []).forEach((r) => { if (r && r.id !== undefined) union.set(String(r.id), r); });
    });
    base = [...union.values()];
  }
  return applyMutation(base, mutation).affected;
};

/** Apply a mutation to the table mirror and to every cached response of that table. */
export const applyToCaches = async (userId, table, mutation) => {
  const mirror = await cache.loadMirror(userId, table);
  let mirrorRows = null;
  if (mirror) {
    mirrorRows = applyMutation(mirror.rows, mutation).rows;
    await cache.saveMirror(userId, table, mirrorRows, mirror.complete);
  }

  const entries = await cache.listReads(userId, table);
  for (const entry of entries) {
    const params = paramsOf(entry);
    if (!parseSelect(params.get('select')).all) continue; // projections / embeds stay as they were
    const body = parseBody(entry);
    if (body === undefined) continue;

    let result;
    if (mirror?.complete) {
      // the mirror is the whole table: recomputing is exact (rows that newly match appear too)
      result = queryRows(mirrorRows, params);
    } else {
      const rows = applyMutation(Array.isArray(body) ? body : [body], mutation).rows;
      result = queryRows(rows, params);
    }
    if (!result.supported) continue;

    if (entry.single) {
      if (result.rows.length === 1) await cache.saveRead(entry.userId, table, entry.url, true, { status: entry.status, body: JSON.stringify(result.rows[0]), contentRange: entry.contentRange });
      else await cache.deleteRead(entry.key);
    } else {
      await cache.saveRead(entry.userId, table, entry.url, false, {
        status: entry.status,
        body: JSON.stringify(result.rows),
        contentRange: entry.contentRange ? contentRange(result.rows.length, result.total) : null
      });
    }
  }
};
