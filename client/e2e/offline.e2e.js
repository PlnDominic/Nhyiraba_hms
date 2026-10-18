// Real-browser check of the offline behaviour. Run: node e2e/offline.e2e.js <path-to-e2e-build>
// The build must be made with REACT_APP_E2E=true and the mock server's URLs (see OFFLINE.md).
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { createMockSupabase } = require('./mockSupabase');
const { createStaticServer } = require('./staticServer');

const buildDir = path.resolve(process.argv[2] || 'build-e2e');
const MOCK_PORT = 4010;
const APP_PORT = 4011;
const APP = `http://127.0.0.1:${APP_PORT}`;
const NEW_ID = '11111111-1111-4111-8111-111111111111';

const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { try { const v = await fn(); if (v) return v; } catch (e) { /* retry */ } await sleep(250); } return false; };

(async () => {
  const mock = createMockSupabase();
  await new Promise((r) => mock.server.listen(MOCK_PORT, '127.0.0.1', r));
  const app = createStaticServer(buildDir);
  await new Promise((r) => app.listen(APP_PORT, '127.0.0.1', r));
  const calls = async () => (await fetch(`http://127.0.0.1:${MOCK_PORT}/__calls`)).json();
  const tables = async () => (await fetch(`http://127.0.0.1:${MOCK_PORT}/__tables`)).json();

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', (e) => console.log('  pageerror:', e.message));

  try {
    // 1. sign in online
    await page.goto(`${APP}/login`);
    await page.fill('#email', 'admin@e2e.test');
    await page.fill('#password', 'whatever');
    await page.keyboard.press('Enter');
    check('signs in', !!(await until(() => /time-attendance|dashboard/.test(page.url()), 30000)), page.url());

    // 2. service worker controls the page and has precached the shell
    const swReady = await until(async () => page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return Boolean(reg && reg.active && navigator.serviceWorker.controller);
    }), 30000);
    if (!swReady) { await page.reload(); }
    check('service worker active and controlling', !!(await until(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), 15000)));

    // 3. warm the data cache on the rooms page, then also visit reservations
    await page.goto(`${APP}/rooms`);
    await until(() => page.evaluate(() => document.body.innerText.includes('Available') || document.body.innerText.includes('Occupied')), 20000);
    await page.goto(`${APP}/reservations`);
    await sleep(2500);
    check('supabase test hook present', await page.evaluate(() => typeof window.__hmsSupabase === 'object'));

    // 4. go offline and reload
    await context.setOffline(true);
    await page.reload();
    const shell = await until(() => page.evaluate(() => document.getElementById('root') && document.getElementById('root').innerText.length > 50), 20000);
    check('app shell loads offline after reload', !!shell);
    check('offline chip shown', !!(await until(() => page.evaluate(() => /offline/i.test(document.body.innerText)), 15000)));

    await page.goto(`${APP}/rooms`);
    check('cached rooms render offline', !!(await until(() => page.evaluate(() => document.body.innerText.includes('Occupied') || document.body.innerText.includes('Available')), 20000)));

    // 5. write while offline
    const written = await page.evaluate(async (id) => {
      const { error } = await window.__hmsSupabase.from('reservations').insert({
        id, room_id: 3, room_number: 3, guest_name: 'Offline Guest', guest_phone: '0200000000',
        check_in_date: '2026-12-01T12:00:00Z', check_out_date: '2026-12-03T12:00:00Z', status: 'Reserved', room_type: 'Standard', room_price: 200
      });
      const { data } = await window.__hmsSupabase.from('reservations').select('*').eq('id', id);
      return { error: error && error.message, found: data ? data.length : 0 };
    }, NEW_ID);
    check('offline insert accepted without error', !written.error, written.error || '');
    check('offline insert readable straight away (read-your-writes)', written.found === 1);
    check('nothing reached the server while offline', (await calls()).writes.length === 0);
    check('chip reports queued change', !!(await until(() => page.evaluate(() => /1 (change|pending)|queued|waiting/i.test(document.body.innerText)), 8000)), await page.evaluate(() => (document.body.innerText.match(/[^\n]*(offline|queued|waiting|pending)[^\n]*/i) || [''])[0]));

    // 6. survives reload
    await page.reload();
    await sleep(2500);
    const afterReload = await page.evaluate(async (id) => {
      const { data } = await window.__hmsSupabase.from('reservations').select('*').eq('id', id);
      return data ? data.length : 0;
    }, NEW_ID);
    check('queued reservation survives reload offline', afterReload === 1);

    // 7. back online -> replay
    await context.setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    const replayed = await until(async () => (await calls()).writes.some((w) => w.table === 'reservations' && w.method === 'POST' && (w.body.id === NEW_ID)), 30000);
    check('queued insert replayed to server with the same id', !!replayed);
    const rows = (await tables()).reservations.filter((r) => r.id === NEW_ID);
    check('exactly one row on the server', rows.length === 1, `${rows.length}`);
    check('chip shows synced', !!(await until(() => page.evaluate(() => /synced|online/i.test(document.body.innerText) && !/queued|waiting/i.test(document.body.innerText)), 20000)));
    const dup = (await calls()).writes.filter((w) => w.body && w.body.id === NEW_ID).length;
    check('sent only once', dup === 1, `${dup}`);
  } catch (e) {
    console.log('ERROR', e);
    results.push(false);
  } finally {
    await page.screenshot({ path: path.join(__dirname, 'last-run.png') }).catch(() => {});
    await browser.close();
    mock.server.close();
    app.close();
  }
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})();
