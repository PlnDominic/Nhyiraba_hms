import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { ID_TYPES, validateCheckIn } from '../services/operationsService';
import DuplicateGuestHint from './DuplicateGuestHint';

const POLICIES = [
  'Check-out time is 12:00 noon; late check-out may be charged.',
  'The guest is responsible for damage to hotel property.',
  'Smoking is not permitted in rooms.',
  'The hotel is not liable for valuables left unattended.'
];

const CheckInValidationModal = ({ reservation, room, onCancel, onConfirm }) => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  const [form, setForm] = useState({
    phone: reservation.guest_phone || '',
    email: reservation.guest_email || '',
    idType: ID_TYPES[0],
    idNumber: '',
    depositAmount: '',
    paymentConfirmed: reservation.payment_status === 'Paid',
    policyAcknowledged: false,
    overrideReason: ''
  });
  const [problems, setProblems] = useState([]);
  const [saving, setSaving] = useState(false);

  const input = `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${dark ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-300 bg-white text-slate-900'}`;
  const set = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = validateCheckIn({ reservation, room, form });
    setProblems(found);
    if (found.length) return;
    setSaving(true);
    try {
      await onConfirm(form);
    } finally {
      setSaving(false);
    }
  };

  const noPayment = !form.paymentConfirmed && !(Number(form.depositAmount) > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="checkin-title">
      <form onSubmit={submit} className={`max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl p-6 shadow-xl ${dark ? 'bg-slate-900 text-white' : 'bg-white text-slate-900'}`}>
        <h2 id="checkin-title" className="text-lg font-bold">Check in {reservation.guest_name}</h2>
        <p className="mb-4 text-sm opacity-70">Room {reservation.room_number || reservation.room_id} · {room?.housekeeping_status || 'Clean'}</p>

        {problems.length > 0 && (
          <ul className="mb-4 list-disc space-y-1 rounded-lg border border-red-200 bg-red-50 p-3 pl-7 text-sm text-red-700" role="alert">
            {problems.map((problem) => <li key={problem}>{problem}</li>)}
          </ul>
        )}

        <div className="space-y-3">
          <DuplicateGuestHint name={reservation.guest_name} phone={form.phone} email={form.email} />
          <div className="grid grid-cols-2 gap-3">
            <input aria-label="Phone" placeholder="Phone" value={form.phone} onChange={set('phone')} className={input} />
            <input aria-label="Email" placeholder="Email" value={form.email} onChange={set('email')} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select aria-label="ID type" value={form.idType} onChange={set('idType')} className={input}>
              {ID_TYPES.map((type) => <option key={type}>{type}</option>)}
            </select>
            <input aria-label="ID number" placeholder="ID number" value={form.idNumber} onChange={set('idNumber')} className={input} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input aria-label="Deposit amount" type="number" min="0" step="0.01" placeholder="Deposit received (GH₵)" value={form.depositAmount} onChange={set('depositAmount')} className={input} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.paymentConfirmed} onChange={set('paymentConfirmed')} /> Payment confirmed</label>
          </div>
          {noPayment && (
            <input aria-label="Reason for checking in without payment" placeholder="No deposit/payment — reason for proceeding" value={form.overrideReason} onChange={set('overrideReason')} className={input} />
          )}
          <div className={`rounded-lg border p-3 text-xs ${dark ? 'border-slate-700' : 'border-slate-200 bg-slate-50'}`}>
            <ul className="list-disc space-y-1 pl-4">{POLICIES.map((policy) => <li key={policy}>{policy}</li>)}</ul>
            <label className="mt-3 flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={form.policyAcknowledged} onChange={set('policyAcknowledged')} /> Guest acknowledges the hotel policies</label>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{saving ? 'Checking in…' : 'Complete check-in'}</button>
        </div>
      </form>
    </div>
  );
};

export default CheckInValidationModal;
