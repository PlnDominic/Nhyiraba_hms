import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useRoomReservation } from '../context/RoomReservationContext';
import {
  HOUSEKEEPING_STATUSES,
  addWaitlistEntry,
  getAvailableRooms,
  getWaitlist,
  setHousekeepingStatus,
  updateWaitlistEntry
} from '../services/operationsService';

const useStyles = () => {
  const { theme } = useTheme();
  const dark = theme === 'dark';
  return {
    dark,
    panel: `rounded-2xl border p-5 shadow-sm ${dark ? 'border-slate-700 bg-slate-900/70 text-white' : 'border-slate-200 bg-white text-slate-900'}`,
    input: `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${dark ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`
  };
};

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const PRIORITIES = { 1: 'Urgent', 2: 'High', 3: 'Normal', 4: 'Low', 5: 'Lowest' };

export const WaitlistPanel = ({ onNotice }) => {
  const { panel, input } = useStyles();
  const { rooms, createReservation, refreshData } = useRoomReservation();
  const [entries, setEntries] = useState([]);
  const [matches, setMatches] = useState({});
  const [form, setForm] = useState({ guest_name: '', guest_phone: '', room_type: 'all', check_in_date: today, check_out_date: tomorrow, priority: 3, notes: '' });
  const roomTypes = useMemo(() => [...new Set(rooms.map((room) => room.type).filter(Boolean))], [rooms]);

  const load = useCallback(async () => {
    const { data, error } = await getWaitlist();
    if (error) return onNotice(error.message, 'error');
    setEntries(data || []);
    const found = {};
    await Promise.all((data || []).map(async (entry) => {
      const result = await getAvailableRooms({ checkIn: entry.check_in_date, checkOut: entry.check_out_date, roomType: entry.room_type || 'all' });
      found[entry.id] = result.data || [];
    }));
    setMatches(found);
  }, [onNotice]);

  useEffect(() => { load(); }, [load]);

  const submit = async (event) => {
    event.preventDefault();
    if (!form.guest_name || !form.guest_phone) return onNotice('Guest name and phone are required.', 'error');
    if (form.check_out_date <= form.check_in_date) return onNotice('Check-out must be after check-in.', 'error');
    const { error } = await addWaitlistEntry(form);
    if (error) return onNotice(error.message, 'error');
    setForm({ ...form, guest_name: '', guest_phone: '', notes: '' });
    onNotice('Guest added to the waitlist.');
    load();
  };

  const convert = async (entry) => {
    const room = (matches[entry.id] || [])[0];
    if (!room) return onNotice('No matching room is available for those dates yet.', 'error');
    const result = await createReservation(room.id, {
      guestName: entry.guest_name,
      phoneNumber: entry.guest_phone,
      email: entry.guest_email,
      checkInDate: entry.check_in_date,
      checkOutDate: entry.check_out_date,
      adults: entry.adults,
      roomPrice: room.price,
      specialRequests: entry.notes || 'Converted from waitlist'
    });
    if (!result.success) return onNotice(result.error, 'error');
    await updateWaitlistEntry(entry.id, { status: 'Converted', converted_reservation_id: result.data?.id || null });
    onNotice(`${entry.guest_name} booked into Room ${room.room_number}.`);
    await refreshData(true);
    load();
  };

  const cancel = async (entry) => {
    const { error } = await updateWaitlistEntry(entry.id, { status: 'Cancelled' });
    if (error) return onNotice(error.message, 'error');
    load();
  };

  return (
    <section className={panel}>
      <h2 className="mb-1 text-lg font-semibold">Waitlist</h2>
      <p className="mb-4 text-sm opacity-70">Queue guests when nothing is free, then convert them as rooms open up.</p>
      <form onSubmit={submit} className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input aria-label="Guest name" placeholder="Guest name" value={form.guest_name} onChange={(event) => setForm({ ...form, guest_name: event.target.value })} className={input} />
        <input aria-label="Guest phone" placeholder="Phone" value={form.guest_phone} onChange={(event) => setForm({ ...form, guest_phone: event.target.value })} className={input} />
        <select aria-label="Room type" value={form.room_type} onChange={(event) => setForm({ ...form, room_type: event.target.value })} className={input}><option value="all">Any room type</option>{roomTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
        <input aria-label="Check-in" type="date" min={today} value={form.check_in_date} onChange={(event) => setForm({ ...form, check_in_date: event.target.value })} className={input} />
        <input aria-label="Check-out" type="date" min={form.check_in_date} value={form.check_out_date} onChange={(event) => setForm({ ...form, check_out_date: event.target.value })} className={input} />
        <select aria-label="Priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })} className={input}>{Object.entries(PRIORITIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white md:col-span-3">Add to waitlist</button>
      </form>
      <div className="mt-4 space-y-2">
        {entries.length === 0 && <p className="text-sm opacity-60">No one is waiting.</p>}
        {entries.map((entry) => {
          const available = matches[entry.id] || [];
          return (
            <div key={entry.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm">
              <div>
                <strong>{entry.guest_name}</strong> <span className="text-xs opacity-70">· {PRIORITIES[entry.priority]} · {entry.room_type || 'Any type'}</span>
                <div className="text-xs opacity-70">{entry.check_in_date} → {entry.check_out_date} · {entry.guest_phone}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold ${available.length ? 'text-emerald-600' : 'text-slate-500'}`}>{available.length ? `${available.length} room${available.length === 1 ? '' : 's'} free` : 'No room yet'}</span>
                <button onClick={() => convert(entry)} disabled={!available.length} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40">Convert</button>
                <button onClick={() => cancel(entry)} className="rounded-md border px-3 py-1.5 text-xs">Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

const STATUS_STYLES = {
  Clean: 'bg-emerald-100 text-emerald-800',
  Inspected: 'bg-blue-100 text-blue-800',
  Dirty: 'bg-amber-100 text-amber-800',
  'Out of Service': 'bg-red-100 text-red-800'
};

export const HousekeepingPanel = ({ onNotice }) => {
  const { panel, input } = useStyles();
  const { rooms, refreshData } = useRoomReservation();
  const [filter, setFilter] = useState('all');
  const visible = rooms.filter((room) => filter === 'all' || (room.housekeeping_status || 'Clean') === filter);

  const change = async (room, status) => {
    const { error } = await setHousekeepingStatus(room, status);
    if (error) return onNotice(`${error.message} (has the operations phase 2 migration been run?)`, 'error');
    onNotice(`Room ${room.room_number} marked ${status}.`);
    await refreshData(true);
  };

  return (
    <section className={panel}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Housekeeping</h2>
          <p className="text-sm opacity-70">Rooms must be Clean or Inspected before check-in. Check-out marks a room Dirty.</p>
        </div>
        <select aria-label="Filter housekeeping status" value={filter} onChange={(event) => setFilter(event.target.value)} className={`${input} !w-auto`}>
          <option value="all">All rooms</option>
          {HOUSEKEEPING_STATUSES.map((status) => <option key={status}>{status}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((room) => {
          const status = room.housekeeping_status || 'Clean';
          return (
            <div key={room.id} className="rounded-xl border p-3 text-sm">
              <div className="flex items-center justify-between"><strong>Room {room.room_number}</strong><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}>{status}</span></div>
              <div className="mt-1 text-xs opacity-70">{room.status}{room.housekeeping_updated_at ? ` · updated ${new Date(room.housekeeping_updated_at).toLocaleString()}` : ''}</div>
              <select aria-label={`Set housekeeping status for room ${room.room_number}`} value={status} onChange={(event) => change(room, event.target.value)} className={`${input} mt-2`}>
                {HOUSEKEEPING_STATUSES.map((option) => <option key={option}>{option}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    </section>
  );
};
