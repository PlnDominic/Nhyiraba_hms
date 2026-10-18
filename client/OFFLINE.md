# Working offline

The app installs as a PWA. After one online visit it starts without a network.

**What works offline**
- App shell (service worker precache, `src/service-worker.js`).
- Reading any data the signed-in user has already loaded (IndexedDB mirror, `src/offline/`).
- Creating, editing and deleting rows. Changes are queued, shown immediately, and replayed oldest-first when the connection returns. Reservation double-booking conflicts are reported in the "Changes that need attention" dialog (Retry / Discard).
- Lifecycle SMS are queued and sent on reconnect (dropped after 12 hours).

**Needs a connection**: first sign-in, sign-up/password changes, RPC calls, file uploads, manual custom SMS.

**Behaviour notes**
- Queued changes belong to the user who made them and only replay for them. Signing out keeps unsynced changes; the read cache is cleared.
- Numeric-id tables use temporary negative ids that are swapped for real ids on replay; uuid tables use client-generated ids, so a retried insert is never duplicated.
- A new app version waits for the user to click "Reload".

**Tests**
- `CI=true npx craco test --watchAll=false src/offline src/components/SyncStatus.test.js`
- Browser run: build with `REACT_APP_E2E=true REACT_APP_SUPABASE_URL=http://127.0.0.1:4010 REACT_APP_SUPABASE_ANON_KEY=anon REACT_APP_API_URL=http://127.0.0.1:4010/api BUILD_PATH=build-e2e npx craco build`, then `node e2e/offline.e2e.js build-e2e`.
