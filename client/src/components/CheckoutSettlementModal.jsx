import React, { useEffect, useMemo, useState } from 'react';
import supabase from '../supabaseClient';
import { useTheme } from '../context/ThemeContext';
import {
  calculateFolio,
  getLatestCheckInRecord,
  saveCheckoutSettlement,
  setHousekeepingStatus
} from '../services/operationsService';

const PAYMENT_METHODS = ['Cash', 'Mobile Money', 'Card', 'Bank Transfer'];

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

  useEffect(() => {
    let active = true;
    (async () => {
      const [{ data: roomRow }, { data: guestRows }, { data: record }] = await Promise.all([
        supabase.from('rooms').select('*').eq('id', roomId).maybeSingle(),
        supabase.from('guests').select('*').eq('room', String(roomId)).eq('status', 'Checked In').order('created_at', { ascending: false }).limit(1),
        getLatestCheckInRecord(roomId)
      ]);
      if (!active) return;
      setRoom(roomRow);
      setGuest(guestRows?.[0] || null);
      setDepositPaid(Number(record?.deposit_amount) || 0);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [roomId]);

  const checkIn = guest?.check_in || guest?.created_at || new Date().toISOString();
  const checkOut = new Date().toISOString();
  const folio = useMemo(() => calculateFolio({
    checkIn,
    checkOut,
    roomRate: room?.price,
    lateCheckoutFee: lateFee,
    extras,
    depositPaid,
    paymentReceived: payment.amount
  }), [checkIn, checkOut, room, lateFee, extras, depositPaid, payment.amount]);

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
      extras,
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
              <button type="button" onClick={() => window.print()} className="rounded-lg border px-4 py-2 text-sm">Print folio</button>
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
