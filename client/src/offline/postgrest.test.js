import {
  applyMutation,
  isFullTableQuery,
  parseRestRequest,
  preferTokens,
  queryRows,
  wantsSingleObject
} from './postgrest';

const BASE = 'https://x.supabase.co/rest/v1/';
const q = (query) => new URLSearchParams(query);

const rooms = [
  { id: 1, room_number: 101, status: 'Available', price: 200, type: 'Standard', guest: null, updated_at: '2026-10-01T10:00:00+00:00' },
  { id: 2, room_number: 102, status: 'Occupied', price: 250, type: 'Deluxe', guest: 'Ama', updated_at: '2026-10-03T10:00:00Z' },
  { id: 3, room_number: 103, status: 'Available', price: 150, type: 'Standard', guest: null, updated_at: '2026-10-02T10:00:00Z' },
  { id: 4, room_number: 104, status: 'Maintenance', price: 300, type: 'Suite', guest: null, updated_at: null }
];

describe('parseRestRequest', () => {
  it('extracts the table and params, ignoring non-REST urls', () => {
    const r = parseRestRequest(`${BASE}rooms?select=*&id=eq.5`, BASE);
    expect(r.table).toBe('rooms');
    expect(r.isRpc).toBe(false);
    expect(r.params.get('id')).toBe('eq.5');
    expect(parseRestRequest('https://x.supabase.co/auth/v1/token', BASE)).toBeNull();
    expect(parseRestRequest(`${BASE}rpc/list_tables`, BASE).isRpc).toBe(true);
  });
});

describe('queryRows filters', () => {
  const ids = (query) => queryRows(rooms, q(query)).rows.map((r) => r.id);

  it('eq / neq coerce numbers', () => {
    expect(ids('id=eq.2')).toEqual([2]);
    expect(ids('status=neq.Available')).toEqual([2, 4]);
  });
  it('gt/gte/lt/lte', () => {
    expect(ids('price=gt.200')).toEqual([2, 4]);
    expect(ids('price=gte.200')).toEqual([1, 2, 4]);
    expect(ids('price=lt.200')).toEqual([3]);
    expect(ids('price=lte.200')).toEqual([1, 3]);
  });
  it('in handles quotes and numbers', () => {
    expect(ids('id=in.(1,3)')).toEqual([1, 3]);
    expect(ids('status=in.("Available","Maintenance")')).toEqual([1, 3, 4]);
    expect(ids('id=in.()')).toEqual([]);
  });
  it('is.null and not.is.null; null never matches comparisons', () => {
    expect(ids('guest=is.null')).toEqual([1, 3, 4]);
    expect(ids('guest=not.is.null')).toEqual([2]);
    expect(ids('guest=neq.Ama')).toEqual([]); // SQL NULL <> 'Ama' is not true
  });
  it('like / ilike with % and * wildcards', () => {
    expect(ids('type=like.Stand*')).toEqual([1, 3]);
    expect(ids('type=ilike.%25DELUXE%25')).toEqual([2]); // supabase-js sends % as %25
    expect(ids('type=like.Stand*&status=eq.Available&price=lt.200')).toEqual([3]);
  });
  it('not. negates any operator', () => {
    expect(ids('status=not.eq.Available')).toEqual([2, 4]);
    expect(ids('id=not.in.(1,2)')).toEqual([3, 4]);
  });
  it('compares timestamps by instant, not by text', () => {
    expect(ids('updated_at=gte.2026-10-02T10:00:00Z')).toEqual([2, 3]);
    expect(ids('updated_at=eq.2026-10-01T10:00:00Z')).toEqual([1]); // +00:00 vs Z
  });
  it('reports unsupported syntax instead of guessing', () => {
    expect(queryRows(rooms, q('or=(id.eq.1,id.eq.2)')).supported).toBe(false);
    expect(queryRows(rooms, q('select=*,reservations(*)')).supported).toBe(false);
    expect(queryRows(rooms, q('data->>x=eq.1')).supported).toBe(false);
    expect(queryRows(rooms, q('name=fts.hotel')).supported).toBe(false);
  });
});

describe('queryRows order / paging / projection / count', () => {
  it('orders asc/desc with Postgres null placement and multiple keys', () => {
    expect(queryRows(rooms, q('order=price.desc')).rows.map((r) => r.id)).toEqual([4, 2, 1, 3]);
    expect(queryRows(rooms, q('order=updated_at.asc')).rows.map((r) => r.id)).toEqual([1, 3, 2, 4]); // null last
    expect(queryRows(rooms, q('order=updated_at.desc')).rows.map((r) => r.id)).toEqual([4, 2, 3, 1]); // null first
    expect(queryRows(rooms, q('order=type.asc,price.desc')).rows.map((r) => r.id)).toEqual([2, 1, 3, 4]);
    expect(queryRows(rooms, q('order=updated_at.desc.nullslast')).rows.map((r) => r.id)).toEqual([2, 3, 1, 4]);
  });
  it('limit/offset slice after ordering and total counts all matches', () => {
    const r = queryRows(rooms, q('order=id.asc&offset=1&limit=2'));
    expect(r.rows.map((x) => x.id)).toEqual([2, 3]);
    expect(r.total).toBe(4);
    expect(queryRows(rooms, q('status=eq.Available&limit=1')).total).toBe(2);
  });
  it('projects selected columns', () => {
    expect(queryRows(rooms, q('select=id,status&id=eq.1')).rows).toEqual([{ id: 1, status: 'Available' }]);
  });
  it('flags whole-table queries (mirror seeds)', () => {
    expect(isFullTableQuery(q('select=*&order=id'))).toBe(true);
    expect(isFullTableQuery(q('select=*&id=eq.1'))).toBe(false);
    expect(isFullTableQuery(q('select=id'))).toBe(false);
    expect(isFullTableQuery(q('select=*&limit=10'))).toBe(false);
  });
});

describe('headers', () => {
  it('reads Prefer tokens and single-object Accept', () => {
    const h = new Headers({ Prefer: 'return=representation,count=exact', Accept: 'application/vnd.pgrst.object+json' });
    expect(preferTokens(h)).toEqual({ return: 'representation', count: 'exact' });
    expect(wantsSingleObject(h)).toBe(true);
    expect(wantsSingleObject(new Headers({ Accept: 'application/json' }))).toBe(false);
  });
});

describe('applyMutation', () => {
  const mut = (method, query, body, prefer) => ({ method, params: q(query), body: body && JSON.stringify(body), prefer });

  it('insert appends rows', () => {
    const { rows, affected } = applyMutation(rooms, mut('POST', '', [{ id: 9, room_number: 109 }]));
    expect(rows).toHaveLength(5);
    expect(affected).toEqual([{ id: 9, room_number: 109 }]);
  });
  it('upsert merges on id or on_conflict and honours ignore-duplicates', () => {
    expect(applyMutation(rooms, mut('POST', 'on_conflict=id', { id: 1, status: 'Reserved' }, { resolution: 'merge-duplicates' })).rows[0])
      .toMatchObject({ id: 1, status: 'Reserved', room_number: 101 });
    expect(applyMutation(rooms, mut('POST', 'on_conflict=room_number', { room_number: 102, status: 'X' }, { resolution: 'merge-duplicates' })).rows[1].status).toBe('X');
    expect(applyMutation(rooms, mut('POST', '', { id: 1, status: 'Y' }, { resolution: 'ignore-duplicates' })).rows[0].status).toBe('Available');
  });
  it('patch updates only matching rows', () => {
    const { rows, affected } = applyMutation(rooms, mut('PATCH', 'status=eq.Available', { status: 'Reserved' }));
    expect(rows.map((r) => r.status)).toEqual(['Reserved', 'Occupied', 'Reserved', 'Maintenance']);
    expect(affected).toHaveLength(2);
  });
  it('delete removes matching rows', () => {
    const { rows, affected } = applyMutation(rooms, mut('DELETE', 'id=in.(1,2)'));
    expect(rows.map((r) => r.id)).toEqual([3, 4]);
    expect(affected).toHaveLength(2);
  });
});
