import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { resetDbForTests } from './idb';
import { createOfflineFetch } from './offlineFetch';
import * as queue from './queue';
import { getState, resetStateForTests, setState } from './state';
import { _resetForTests, configureSync, discardEntry, flush, listNeedsAttention, refreshCounts, retryEntry } from './sync';
import { createFakeServer } from './testSupport/fakeServer';

const BASE = 'https://hms.test';
const REST = `${BASE}/rest/v1/`;
const settle = () => new Promise((resolve) => setTimeout(resolve, 25)); // background cache writes

const ROOMS = [
  { id: 1, room_number: 101, status: 'Available', price: 200 },
  { id: 2, room_number: 102, status: 'Occupied', price: 250 },
  { id: 3, room_number: 103, status: 'Available', price: 150 }
];
const RES_ID = '11111111-1111-4111-8111-111111111111';

let server;
let offlineFetch;
let getAccessToken;
let refreshAccessToken;

const goOffline = () => { server.state.reachable = false; setState({ forcedOffline: true }); };
const goOnline = () => { server.state.reachable = true; setState({ forcedOffline: false }); };

const get = (path, headers = {}) => offlineFetch(`${REST}${path}`, { method: 'GET', headers });
const send = (method, path, body, prefer = 'return=representation', extra = {}) => offlineFetch(`${REST}${path}`, {
  method,
  headers: { 'Content-Type': 'application/json', Prefer: prefer, ...extra },
  body: body === undefined ? undefined : JSON.stringify(body)
});
const asJson = async (res) => JSON.parse(await res.text());

beforeEach(async () => {
  global.indexedDB = new IDBFactory();
  await resetDbForTests();
  resetStateForTests();
  _resetForTests();
  localStorage.setItem('currentUser', JSON.stringify({ id: 'user-1' }));
  server = createFakeServer({
    restBase: REST,
    tables: { rooms: ROOMS, reservations: [], invoices: [], invoice_items: [] },
    numericTables: ['invoices', 'invoice_items']
  });
  getAccessToken = jest.fn(async () => 'token-1');
  refreshAccessToken = jest.fn(async () => 'fresh-token');
  offlineFetch = createOfflineFetch({ baseFetch: server.fetch, restBase: REST, onQueueChanged: async () => { await refreshCounts(); } });
  configureSync({ baseFetch: server.fetch, supabaseUrl: BASE, anonKey: 'anon', getAccessToken, refreshAccessToken });
});

afterEach(() => { _resetForTests(); });

describe('reading', () => {
  it('serves cached reads while offline and says where they came from', async () => {
    const online = await asJson(await get('rooms?select=*&order=id.asc'));
    expect(online).toHaveLength(3);
    await settle();

    goOffline();
    const res = await get('rooms?select=*&order=id.asc');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-Offline-Source')).toBe('exact');
    expect(await asJson(res)).toEqual(online);
  });

  it('answers filtered queries it never saw from the table mirror, including single-object and count', async () => {
    await get('rooms?select=*'); // whole table -> mirror
    await settle();
    goOffline();

    const available = await get('rooms?select=*&status=eq.Available&order=price.asc', { Prefer: 'count=exact' });
    expect(available.headers.get('X-Offline-Source')).toBe('mirror');
    expect(available.headers.get('Content-Range')).toBe('0-1/2');
    expect((await asJson(available)).map((r) => r.id)).toEqual([3, 1]);

    const one = await get('rooms?select=*&id=eq.2', { Accept: 'application/vnd.pgrst.object+json' });
    expect(await asJson(one)).toMatchObject({ id: 2, status: 'Occupied' });

    const none = await get('rooms?select=*&id=eq.99', { Accept: 'application/vnd.pgrst.object+json' });
    expect(none.status).toBe(406);
    expect((await asJson(none)).code).toBe('PGRST116');
  });

  it('says so plainly when the data was never loaded on this device', async () => {
    goOffline();
    const res = await get('reservations?select=*');
    expect(res.status).toBe(503);
    expect((await asJson(res)).message).toMatch(/offline/i);
  });

  it('never shows one user\'s cached data to another user', async () => {
    await get('rooms?select=*');
    await settle();
    goOffline();
    localStorage.setItem('currentUser', JSON.stringify({ id: 'user-2' }));
    expect((await get('rooms?select=*')).status).toBe(503);
  });

  it('refuses rpc calls offline instead of queueing them', async () => {
    goOffline();
    const res = await send('POST', 'rpc/store_something', { a: 1 });
    expect(res.status).toBe(503);
    expect(await queue.listEntries('user-1')).toHaveLength(0);
  });
});

describe('writing offline', () => {
  it('queues an insert with a client-generated uuid, shows it immediately, and replays it with the same id', async () => {
    await get('reservations?select=*'); // teaches the layer the table (empty here, so the uuid table registry is used)
    await settle();
    goOffline();

    const res = await send('POST', 'reservations?select=*', { guest_name: 'Ama', room_id: 1 });
    expect(res.status).toBe(201);
    const [created] = await asJson(res);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(getState().queued).toBe(1);

    // read-your-writes
    const list = await asJson(await get('reservations?select=*'));
    expect(list.map((r) => r.guest_name)).toEqual(['Ama']);

    goOnline();
    await flush();
    const post = server.state.calls.find((c) => c.method === 'POST' && c.table === 'reservations');
    expect(post.body.id).toBe(created.id);        // same id => replays are idempotent
    expect(post.auth).toBe('Bearer token-1');
    expect(server.state.tables.reservations).toHaveLength(1);
    expect(getState().queued).toBe(0);
    expect(await queue.listEntries('user-1')).toHaveLength(0);
  });

  it('gives numeric-id rows temporary ids and rewrites dependent changes when the real id arrives', async () => {
    await get('invoices?select=*');
    await settle();
    goOffline();

    const inv = (await asJson(await send('POST', 'invoices?select=*', { guest_name: 'Kofi' })))[0];
    expect(inv.id).toBeLessThan(-1e13);
    await send('POST', 'invoice_items?select=*', { invoice_id: inv.id, item_name: 'Minibar', item_price: 30 });
    await send('PATCH', `invoices?id=eq.${inv.id}`, { status: 'Paid' }, 'return=minimal');

    goOnline();
    await flush();

    const [realInvoice] = server.state.tables.invoices;
    expect(realInvoice.id).toBeGreaterThanOrEqual(1000);            // server-assigned
    expect(realInvoice).toMatchObject({ guest_name: 'Kofi', status: 'Paid' }); // the PATCH found it by its real id
    expect(server.state.tables.invoice_items[0].invoice_id).toBe(realInvoice.id);
    const invoicePost = server.state.calls.find((c) => c.method === 'POST' && c.table === 'invoices');
    expect(invoicePost.body.id).toBeUndefined();                    // the temp id was never sent
    expect(getState().queued).toBe(0);
  });

  it('applies updates and deletes locally right away and replays them in order', async () => {
    await get('rooms?select=*');
    await settle();
    goOffline();

    const updated = await send('PATCH', 'rooms?id=eq.1&select=*', { status: 'Reserved' });
    expect((await asJson(updated)).map((r) => r.status)).toEqual(['Reserved']);
    expect((await send('DELETE', 'rooms?id=eq.3', undefined, 'return=minimal')).status).toBe(204);

    const rooms = await asJson(await get('rooms?select=*&order=id.asc'));
    expect(rooms.map((r) => [r.id, r.status])).toEqual([[1, 'Reserved'], [2, 'Occupied']]);
    // a filtered read now reflects the change too
    expect((await asJson(await get('rooms?select=*&status=eq.Available'))).map((r) => r.id)).toEqual([]);

    goOnline();
    await flush();
    expect(server.state.tables.rooms.map((r) => [r.id, r.status])).toEqual([[1, 'Reserved'], [2, 'Occupied']]);
    expect(server.state.calls.filter((c) => c.method !== 'GET').map((c) => c.method)).toEqual(['PATCH', 'DELETE']);
  });

  it('keeps new writes behind waiting ones even when the connection is back', async () => {
    await get('rooms?select=*');
    await settle();
    goOffline();
    await send('PATCH', 'rooms?id=eq.1', { status: 'Reserved' }, 'return=minimal');
    server.state.reachable = true; // network is back but the queue has not been flushed yet
    setState({ forcedOffline: false });

    await send('PATCH', 'rooms?id=eq.1', { status: 'Occupied' }, 'return=minimal');
    expect(server.state.calls.filter((c) => c.method === 'PATCH')).toHaveLength(0); // queued, not sent out of order

    await flush();
    expect(server.state.calls.filter((c) => c.method === 'PATCH').map((c) => c.body.status)).toEqual(['Reserved', 'Occupied']);
  });

  it('queues a write whose request fails on a flaky connection instead of losing it', async () => {
    await get('rooms?select=*');
    await settle();
    server.state.reachable = false; // browser still thinks it is online
    const res = await send('PATCH', 'rooms?id=eq.2&select=*', { status: 'Available' });
    expect(res.status).toBe(200);
    expect(getState().forcedOffline).toBe(true);
    expect(getState().queued).toBe(1);
  });

  it('online writes update the device copy so a later offline read is current', async () => {
    await get('rooms?select=*');
    await settle();
    await send('PATCH', 'rooms?id=eq.1', { status: 'Maintenance' }, 'return=minimal'); // goes straight to the server
    await settle();
    expect(server.state.tables.rooms[0].status).toBe('Maintenance');

    goOffline();
    const rooms = await asJson(await get('rooms?select=*'));
    expect(rooms.find((r) => r.id === 1).status).toBe('Maintenance');
  });
});

describe('syncing', () => {
  const queueReservation = async (id = RES_ID) => {
    await get('reservations?select=*');
    await settle();
    goOffline();
    await send('POST', 'reservations?select=*', { id, guest_name: 'Ama', room_id: 1 });
    goOnline();
  };

  it('holds a data conflict for the user, keeps syncing the rest, and lets them retry or discard', async () => {
    await queueReservation();
    await send('PATCH', 'rooms?id=eq.1', { status: 'Reserved' }, 'return=minimal');
    server.state.forcedErrors.push({ table: 'reservations', method: 'POST', status: 409, code: '23P01', message: 'conflicting key value violates exclusion constraint' });

    await flush();

    const attention = await listNeedsAttention();
    expect(attention).toHaveLength(1);
    expect(attention[0]).toMatchObject({ table: 'reservations', status: 'conflict' });
    expect(attention[0].error).toMatch(/booking took this room/i);
    expect(server.state.tables.rooms[0].status).toBe('Reserved'); // the independent change still went through
    expect(getState()).toMatchObject({ queued: 0, needsAttention: 1 });

    // the phantom reservation is gone from the device copy
    goOffline();
    expect((await get('reservations?select=*')).status).toBe(503);
    goOnline();

    await retryEntry(attention[0].id);
    await settle();
    expect(server.state.tables.reservations).toHaveLength(1);
    expect(getState().needsAttention).toBe(0);
  });

  it('discarding a rejected change removes it', async () => {
    await queueReservation();
    server.state.forcedErrors.push({ table: 'reservations', method: 'POST', status: 409, code: '23P01', message: 'x' });
    await flush();
    const [entry] = await listNeedsAttention();
    await discardEntry(entry.id);
    expect(await queue.listEntries('user-1')).toHaveLength(0);
    expect(getState().needsAttention).toBe(0);
  });

  it('treats a replayed insert that already exists as done (the first attempt got through)', async () => {
    await queueReservation();
    server.state.tables.reservations.push({ id: RES_ID, guest_name: 'Ama' }); // already on the server
    await flush();
    expect(await queue.listEntries('user-1')).toHaveLength(0);
    expect(server.state.tables.reservations).toHaveLength(1);
  });

  it('stops at a network failure, keeps order, and resumes later', async () => {
    await queueReservation();
    await send('PATCH', 'rooms?id=eq.1', { status: 'Reserved' }, 'return=minimal');
    server.state.reachable = false;
    await flush();

    expect(server.state.calls.filter((c) => c.method !== 'GET' && c.table)).toHaveLength(0);
    const entries = await queue.listEntries('user-1');
    expect(entries).toHaveLength(2);
    expect(entries[0].attempts).toBe(1);
    expect(entries[0].nextAttemptAt).toBeGreaterThan(Date.now());

    server.state.reachable = true;
    await queue.updateEntry(entries[0].id, { nextAttemptAt: null });
    await flush();
    expect(server.state.calls.filter((c) => c.table && c.method !== 'GET').map((c) => c.table)).toEqual(['reservations', 'rooms']);
    expect(getState().queued).toBe(0);
  });

  it('refreshes an expired token once and carries on', async () => {
    await queueReservation();
    server.state.tokenOk = false;
    await flush();
    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(server.state.tables.reservations).toHaveLength(1);
    expect(getState().authRequired).toBe(false);
  });

  it('pauses with "sign in again" when the session cannot be refreshed, and keeps the changes', async () => {
    await queueReservation();
    server.state.tokenOk = false;
    refreshAccessToken.mockResolvedValue(null);
    await flush();
    expect(getState().authRequired).toBe(true);
    expect(await queue.listEntries('user-1')).toHaveLength(1);
    expect(server.state.tables.reservations).toHaveLength(0);
  });

  it('only replays changes that belong to the signed-in user', async () => {
    await queueReservation();
    localStorage.setItem('currentUser', JSON.stringify({ id: 'user-2' }));
    await flush();
    expect(server.state.tables.reservations).toHaveLength(0);
    expect(await queue.listEntries('user-1')).toHaveLength(1); // still waiting for its owner

    localStorage.setItem('currentUser', JSON.stringify({ id: 'user-1' }));
    await flush();
    expect(server.state.tables.reservations).toHaveLength(1);
  });

  it('sends queued SMS through the app API and drops ones that are too old', async () => {
    goOffline();
    const now = Date.now();
    await queue.addEntry({ kind: 'sms', userId: 'user-1', event: 'checked_in', phone: '0241234567', data: { guestName: 'Ama' }, expiresAt: now + 60000 });
    await queue.addEntry({ kind: 'sms', userId: 'user-1', event: 'checked_out', phone: '0241234567', data: {}, expiresAt: now - 1000 });
    goOnline();
    await flush();

    const sms = server.state.calls.filter((c) => c.url.endsWith('/sms/send'));
    expect(sms).toHaveLength(1);
    expect(sms[0].body).toMatchObject({ event: 'checked_in', phone: '0241234567' });
    expect(sms[0].auth).toBe('Bearer token-1');
    const [expired] = await listNeedsAttention();
    expect(expired).toMatchObject({ event: 'checked_out', status: 'failed' });
    expect(expired.error).toMatch(/too old/i);
  });
});
