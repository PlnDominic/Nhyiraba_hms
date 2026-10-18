import React, { useEffect, useMemo, useState } from 'react';
import supabase from '../supabaseClient';
import { useTheme } from '../context/ThemeContext';
import {
  calculateFolio,
  getLatestCheckInRecord,
  loadRoomCharges,
  markRoomChargesSettled,
  saveCheckoutSettlement,
  setHousekeepingStatus
} from '../services/operationsService';

const PAYMENT_METHODS = ['Cash', 'Mobile Money', 'Card', 'Bank Transfer'];

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Opens a print-ready receipt in its own window (prints only the folio, not the app).
const printReceipt = ({ guestName, roomNumber, checkIn, checkOut, folio, room, lines, depositPaid, paymentReceived, paymentMethod }) => {
  const money = (n) => `GH₵${Number(n || 0).toFixed(2)}`;
  const day = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const rows = [
    [`Room ${roomNumber} · ${folio.nights} night${folio.nights === 1 ? '' : 's'} × ${money(room?.price)}`, folio.roomTotal],
    ...lines.map((l) => [l.description, l.amount])
  ].map(([label, amount]) => `<tr><td>${escapeHtml(label)}</td><td class="r">${money(amount)}</td></tr>`).join('');
  const win = window.open('', '_blank', 'width=480,height=700');
  if (!win) return;
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt · ${escapeHtml(guestName)}</title>
<style>body{font-family:Inter,system-ui,sans-serif;color:#0f172a;margin:32px;font-size:14px}h1{font-size:20px;margin:0}
.muted{color:#64748b}table{width:100%;border-collapse:collapse;margin-top:20px}td{padding:6px 0;border-bottom:1px solid #e2e8f0}
.r{text-align:right}.total td{font-weight:700;border-bottom:2px solid #0f172a}.bal td{font-size:16px;font-weight:700;border:0}</style></head>
<body><h1>Nhyiraba Hotel</h1><div class="muted">Guest receipt</div>
<p><strong>${escapeHtml(guestName)}</strong><br>Room ${escapeHtml(roomNumber)} · ${day(checkIn)} – ${day(checkOut)}</p>
<table>${rows}<tr class="total"><td>Total</td><td class="r">${money(folio.totalDue)}</td></tr>
<tr><td>Deposit paid at check-in</td><td class="r">− ${money(depositPaid)}</td></tr>
<tr><td>Paid at check-out${paymentMethod ? ` (${escapeHtml(paymentMethod)})` : ''}</td><td class="r">− ${money(paymentReceived)}</td></tr>
<tr class="bal"><td>Balance</td><td class="r">${money(folio.balance)}</td></tr></table>
<p class="muted">Issued ${new Date().toLocaleString()}. Thank you for staying with us.</p>
<script>window.onload=function(){window.print()}</script></body></html>`);
  win.document.close();
};

/**
 * Final folio before check-out. Loads the room, in-house guest and check-in
 * deposit, lets staff add late-checkout fees / extras, records the settlement
 * and calls onSettled() so the caller can finish the check-out.
 */
const CheckoutSettlementModal = ({ roomId, onCancel, onSettled }) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [loading, setLoading] = useState(true);
  const [room, setRoom] = useState(null);
  const [guest, setGuest] = useState(null);
  const [depositPaid, setDepositPaid] = useState(0);
  const [lateFee, setLateFee] = useState('');
  const [extras, setExtras] = useState([]);
  const [extraForm, setExtraForm] = useState({ description: '', amount: '' });
  const [payment, setPayment] = useState({ amount: '', method: PAYMENT_METHODS[0] });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [roomCharges, setRoomCharges] = useState([]);
  const [excluded, setExcluded] = useState(() => new Set());
  const [checkOut] = useState(() => new Date().toISOString());

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: roomRow }, { data: guestRows }, { data: record }] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
        supabase.from('guests').select('*').eq('room', String(roomId)).eq('status', 'Checked In').order('created_at', { ascending: false }).limit(1),
        getLatestCheckInRecord(roomId)
      ]);
      if (!active) return;
      const inHouse = guestRows?.[0] || null;
      setRoom(roomRow);
      setGuest(inHouse);
      setDepositPaid(Number(record?.deposit_amount) || 0);
      // Unpaid room service and completed services posted to this room during the stay
      const charges = await loadRoomCharges(roomRow, inHouse?.check_in || inHouse?.created_at).catch(() => []);
      if (!active) return;
      setRoomCharges(charges);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [roomId]);

  const checkIn = guest?.check_in || guest?.created_at || checkOut;
  const includedCharges = useMemo(() => roomCharges.filter((c) => !excluded.has(c.key)), [roomCharges, excluded]);
  const allLines = useMemo(() => [...includedCharges, ...extras], [includedCharges, extras]);
  const folio = useMemo(() => calculateFolio({
    checkIn,
    checkOut,
    roomRate: room?.price,
    lateCheckoutFee: lateFee,
    extras: allLines,
    depositPaid,
    paymentReceived: payment.amount
  }), [checkIn, checkOut, room, lateFee, allLines, depositPaid, payment.amount]);

  const toggleCharge = (key) => setExcluded((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const receiptLines = () => [
    ...(Number(lateFee) > 0 ? [{ description: 'Late check-out', amount: Number(lateFee) }] : []),
    ...allLines
  ];

  const input = `rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${dark ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-900'}`;
  const money = (n) => `GH₵${Number(n || 0).toFixed(2)}`;

  const addExtra = () => {
    if (!extraForm.description || !(Number(extraForm.amount) > 0)) return;
    setExtras((current) => [...current, { description: extraForm.description, amount: Number(extraForm.amount) }]);
    setExtraForm({ description: '', amount: '' });
  };

  const confirm = async () => {
    if (folio.balance > 0.009) {
      setError(`Outstanding balance of ${money(folio.balance)} must be paid before check-out.`);
      return;
    }
    setSaving(true);
    setError(null);
    const { error: saveError } = await saveCheckoutSettlement({
      room_id: roomId,
      guest_name: guest?.name || room?.guest || 'Guest',
      check_in_date: checkIn,
      check_out_date: checkOut,
      nights: folio.nights,
      room_rate: Number(room?.price) || 0,
      room_total: folio.roomTotal,
      late_checkout_fee: Number(lateFee) || 0,
      extras: allLines.map(({ description, amount, source, sourceId }) => ({ description, amount, source: source || 'manual', source_id: sourceId || null })),
      extras_total: folio.extrasTotal,
      deposit_paid: depositPaid,
      payment_received: Number(payment.amount) || 0,
      payment_method: Number(payment.amount) > 0 ? payment.method : null,
      total_due: folio.totalDue,
      balance: folio.balance
    });
    if (saveError) {
      setSaving(false);
      setError(`Could not record the settlement: ${saveError.message}`);
      return;
    }
    await markRoomChargesSettled(includedCharges);
    if (room) await setHousekeepingStatus(room, 'Dirty', 'Guest checked out');
    setSaving(false);
    onSettled({ ...folio, guestName: guest?.name });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="settle-title">
      <div className={`max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-xl ${dark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
        <h2 id="settle-title" className="text-lg font-bold">Check-out settlement</h2>
        {loading ? <p className="py-6 text-sm opacity-70">Loading folio…</p> : (
          <>
            <p className="mb-4 text-sm opacity-70">{guest?.name || 'Guest'} · Room {room?.room_number ?? roomId}</p>
            {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}

            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt>Room ({folio.nights} night{folio.nights === 1 ? '' : 's'} × {money(room?.price)})</dt><dd>{money(folio.roomTotal)}</dd></div>
              <div className="flex justify-between"><dt>Late check-out fee</dt><dd>{money(lateFee)}</dd></div>
              {roomCharges.map((c) => (
                <div key={c.key} className={`flex justify-between ${excluded.has(c.key) ? 'opacity-50 line-through' : ''}`}>
                  <dt><label className="flex items-center gap-2"><input type="checkbox" checked={!excluded.has(c.key)} onChange={() => toggleCharge(c.key)} aria-label={`Include ${c.description}`} />{c.description} <span className="text-xs opacity-60">({c.source === 'restaurant' ? 'room service' : 'service'})</span></label></dt>
                  <dd>{money(c.amount)}</dd>
                </div>
              ))}
              {extras.map((item, index) => <div key={`${item.description}-${index}`} className="flex justify-between"><dt>{item.description}</dt><dd>{money(item.amount)}</dd></div>)}
              <div className="flex justify-between border-t pt-1 font-semibold"><dt>Total due</dt><dd>{money(folio.totalDue)}</dd></div>
              <div className="flex justify-between"><dt>Deposit paid at check-in</dt><dd>− {money(depositPaid)}</dd></div>
              <div className="flex justify-between"><dt>Payment received now</dt><dd>− {money(payment.amount)}</dd></div>
              <div className={`flex justify-between border-t pt-1 text-base font-bold ${folio.balance > 0.009 ? 'text-red-600' : 'text-emerald-600'}`}><dt>Balance</dt><dd>{money(folio.balance)}</dd></div>
            </dl>

            <div className="mt-4 space-y-3">
              <input aria-label="Late check-out fee" type="number" min="0" step="0.01" placeholder="Late check-out fee (GH₵)" value={lateFee} onChange={(event) => setLateFee(event.target.value)} className={`${input} w-full`} />
              <div className="grid grid-cols-5 gap-2">
                <input aria-label="Extra charge description" placeholder="Minibar / service" value={extraForm.description} onChange={(event) => setExtraForm({ ...extraForm, description: event.target.value })} className={`${input} col-span-3`} />
                <input aria-label="Extra charge amount" type="number" min="0" step="0.01" placeholder="Amount" value={extraForm.amount} onChange={(event) => setExtraForm({ ...extraForm, amount: event.target.value })} className={`${input} col-span-1`} />
                <button type="button" onClick={addExtra} className="rounded-lg bg-slate-700 px-2 text-sm font-semibold text-white">Add</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input aria-label="Payment received" type="number" min="0" step="0.01" placeholder="Payment received now (GH₵)" value={payment.amount} onChange={(event) => setPayment({ ...payment, amount: event.target.value })} className={input} />
                <select aria-label="Payment method" value={payment.method} onChange={(event) => setPayment({ ...payment, method: event.target.value })} className={input}>{PAYMENT_METHODS.map((method) => <option key={method}>{method}</option>)}</select>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => printReceipt({ guestName: guest?.name || 'Guest', roomNumber: room?.room_number ?? roomId, checkIn, checkOut, folio, room, lines: receiptLines(), depositPaid, paymentReceived: payment.amount, paymentMethod: Number(payment.amount) > 0 ? payment.method : null })} className="rounded-lg border px-4 py-2 text-sm">Print receipt</button>
              <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={confirm} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Saving…' : 'Settle & check out'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CheckoutSettlementModal;
