import React, { useCallback, useEffect, useState } from 'react';
import { discardEntry, listNeedsAttention, retryEntry } from '../offline';
import { applyUpdate } from '../offline/registerSW';
import useOfflineStatus from '../offline/useOfflineStatus';

const describe = (entry) => {
  if (entry.kind === 'sms') return `Text message (${entry.event.replace(/_/g, ' ')}) to ${entry.phone}`;
  const verb = { POST: 'Add to', PUT: 'Save to', PATCH: 'Change', DELETE: 'Remove from' }[entry.method] || 'Change';
  return `${verb} ${String(entry.table || 'data').replace(/_/g, ' ')}`;
};

const when = (iso) => new Date(iso).toLocaleString();

const SyncIssues = ({ onClose }) => {
  const [entries, setEntries] = useState([]);
  const load = useCallback(async () => setEntries(await listNeedsAttention()), []);
  useEffect(() => { load(); }, [load]);

  const retry = async (id) => { await retryEntry(id); load(); };
  const discard = async (entry) => {
    if (!window.confirm('Discard this change? It will not be saved to the server.')) return;
    await discardEntry(entry.id);
    load();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="sync-issues-title">
      <div className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 text-slate-900 shadow-2xl">
        <div className="mb-1 flex items-start justify-between gap-4">
          <h2 id="sync-issues-title" className="text-lg font-bold">Changes that need attention</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button>
        </div>
        <p className="mb-4 text-sm text-slate-600">These were made while offline, but the server could not accept them. Retry once the cause is fixed, or discard them.</p>
        {entries.length === 0 && <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Nothing needs attention.</p>}
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="rounded-xl border border-slate-200 p-3 text-sm">
              <div className="font-semibold">{describe(entry)}</div>
              <div className="text-xs text-slate-500">Made {when(entry.createdAt)}</div>
              <div className="mt-1 text-red-700">{entry.error || 'The server rejected this change.'}</div>
              <div className="mt-2 flex gap-2">
                <button onClick={() => retry(entry.id)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">Retry</button>
                <button onClick={() => discard(entry)} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">Discard</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

/**
 * Small floating indicator: offline mode, waiting/syncing changes, rejected changes,
 * a "signed out" warning and the "new version" prompt. Hidden when everything is normal.
 */
const SyncStatus = () => {
  const status = useOfflineStatus();
  const [showIssues, setShowIssues] = useState(false);
  const [justSynced, setJustSynced] = useState(false);
  const offline = status.forcedOffline || !status.online;

  useEffect(() => {
    if (!status.lastSyncAt || status.queued > 0) return undefined;
    setJustSynced(true);
    const timer = setTimeout(() => setJustSynced(false), 4000);
    return () => clearTimeout(timer);
  }, [status.lastSyncAt, status.queued]);

  const chip = (() => {
    if (status.authRequired && status.queued > 0) {
      return { tone: 'bg-red-600', text: `Sign in again to upload ${status.queued} waiting change${status.queued === 1 ? '' : 's'}`, action: <a href="/login" className="underline">Sign in</a> };
    }
    if (offline) {
      return {
        tone: 'bg-amber-600',
        text: status.queued > 0
          ? `Offline: ${status.queued} change${status.queued === 1 ? '' : 's'} saved on this device`
          : 'Offline: you can keep working, changes upload when you are back online'
      };
    }
    if (status.syncing) return { tone: 'bg-blue-600', text: `Syncing ${status.queued || ''} change${status.queued === 1 ? '' : 's'}…`.replace('  ', ' ') };
    if (status.needsAttention > 0) {
      return { tone: 'bg-red-600', text: `${status.needsAttention} change${status.needsAttention === 1 ? '' : 's'} need attention`, action: <button onClick={() => setShowIssues(true)} className="underline">Review</button> };
    }
    if (status.queued > 0) return { tone: 'bg-blue-600', text: `${status.queued} change${status.queued === 1 ? '' : 's'} waiting to upload` };
    if (justSynced) return { tone: 'bg-emerald-600', text: 'All changes synced' };
    return null;
  })();

  if (!chip && !status.updateAvailable && !showIssues) return null;

  return (
    <>
      <div className="pointer-events-none fixed bottom-4 left-4 z-[60] flex max-w-[calc(100vw-2rem)] flex-col items-start gap-2 print:hidden">
        {status.updateAvailable && (
          <div role="status" className="pointer-events-auto flex items-center gap-3 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
            A new version is ready
            <button onClick={applyUpdate} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-900">Reload</button>
          </div>
        )}
        {chip && (
          <div role="status" aria-live="polite" className={`pointer-events-auto flex items-center gap-3 rounded-full px-4 py-2 text-sm font-medium text-white shadow-lg ${chip.tone}`}>
            <span>{chip.text}</span>
            {chip.action}
            {status.needsAttention > 0 && !chip.action && (
              <button onClick={() => setShowIssues(true)} className="text-xs underline">{status.needsAttention} need attention</button>
            )}
          </div>
        )}
      </div>
      {showIssues && <SyncIssues onClose={() => setShowIssues(false)} />}
    </>
  );
};

export default SyncStatus;
