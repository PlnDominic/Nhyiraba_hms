import React, { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLayout from './DashboardLayout';
import { HousekeepingPanel, WaitlistPanel } from './OperationsExtras';
import DuplicateGuestHint from './DuplicateGuestHint';
import { useTheme } from '../context/ThemeContext';
import { useRoomReservation } from '../context/RoomReservationContext';
import {
  calculateCancellationFee,
  createMaintenanceTicket,
  getAvailableRooms,
  getCancellationPolicies,
  getMaintenanceTickets,
  getRatePlans,
  saveCancellationPolicy,
  saveRatePlan,
  updateMaintenanceTicket
} from '../services/operationsService';

const today = new Date().toISOString().slice(0, 10);
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

const inputClass = (isDarkMode) => `w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 ${isDarkMode ? 'border-slate-600 bg-slate-800 text-white' : 'border-slate-200 bg-white text-slate-900'}`;
const panelClass = (isDarkMode) => `rounded-2xl border p-5 shadow-sm ${isDarkMode ? 'border-slate-700 bg-slate-900/70 text-white' : 'border-slate-200 bg-white text-slate-900'}`;

const ReservationOperationsPage = () => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const {
    rooms,
    reservations,
    createReservation,
    markNoShow,
    reassignRoom,
    cancelReservation,
    refreshData
  } = useRoomReservation();

  const [availability, setAvailability] = useState({ checkIn: today, checkOut: tomorrow, roomType: 'all' });
  const [availableRooms, setAvailableRooms] = useState([]);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [maintenance, setMaintenance] = useState([]);
  const [ratePlans, setRatePlans] = useState([]);
  const [policies, setPolicies] = useState([]);
  const [notice, setNotice] = useState(null);
  const [ticketForm, setTicketForm] = useState({ room_id: '', title: '', description: '', priority: 'Medium' });
  const [rateForm, setRateForm] = useState({ name: '', description: '', base_rate: '', meal_plan: 'Room Only', min_nights: 1 });
  const [policyForm, setPolicyForm] = useState({ name: '', days_before_checkin: 2, fee_percent: 0, description: '' });
  const [walkIn, setWalkIn] = useState({ guestName: '', phoneNumber: '', roomId: '', checkOut: tomorrow });

  const activeReservations = useMemo(() => reservations.filter((reservation) => ['Reserved', 'Confirmed', 'Checked In'].includes(reservation.status)), [reservations]);
  const noShows = useMemo(() => reservations.filter((reservation) => ['Reserved', 'Confirmed'].includes(reservation.status) && new Date(reservation.check_in_date) <= new Date()), [reservations]);
  const roomTypes = useMemo(() => [...new Set(rooms.map((room) => room.type).filter(Boolean))], [rooms]);

  const showNotice = useCallback((message, type = 'success') => {
    setNotice({ message, type });
    window.setTimeout(() => setNotice(null), 4500);
  }, []);

  const searchAvailability = async () => {
    const result = await getAvailableRooms(availability);
    if (result.error) return showNotice(result.error.message, 'error');
    setAvailableRooms(result.data);
  };

  useEffect(() => {
    searchAvailability();
    Promise.all([getMaintenanceTickets(), getRatePlans(), getCancellationPolicies()]).then(([tickets, rates, policyList]) => {
      setMaintenance(tickets.data || []);
      setRatePlans(rates.data || []);
      setPolicies(policyList.data || []);
    });
  }, []);

  const createWalkIn = async (event) => {
    event.preventDefault();
    if (!walkIn.guestName || !walkIn.roomId || !walkIn.checkOut) return showNotice('Guest, room, and checkout date are required.', 'error');
    const result = await createReservation(walkIn.roomId, {
      guestName: walkIn.guestName,
      phoneNumber: walkIn.phoneNumber,
      checkInDate: today,
      checkOutDate: walkIn.checkOut,
      roomPrice: rooms.find((room) => String(room.id) === String(walkIn.roomId))?.price,
      specialRequests: 'Walk-in guest'
    });
    if (!result.success) return showNotice(result.error, 'error');
    showNotice('Walk-in reservation created. Complete check-in from the reservation list.');
    setWalkIn({ guestName: '', phoneNumber: '', roomId: '', checkOut: tomorrow });
    await refreshData(true);
  };

  const handleNoShow = async (reservation) => {
    const result = await markNoShow(reservation);
    if (!result.success) return showNotice(result.error, 'error');
    showNotice(`${reservation.guest_name} marked as a no-show and room released.`);
    await refreshData(true);
  };

  const handleCancel = async (reservation) => {
    const reason = window.prompt('Cancellation reason:', 'Cancelled by guest');
    if (reason === null) return;
    const daysBeforeCheckIn = Math.ceil((new Date(reservation.check_in_date) - new Date()) / 86400000);
    const policy = [...policies]
      .sort((a, b) => Number(b.days_before_checkin) - Number(a.days_before_checkin))
      .find((candidate) => daysBeforeCheckIn >= Number(candidate.days_before_checkin)) || policies[0];
    const fee = calculateCancellationFee(reservation, policy);
    const result = await cancelReservation(reservation.id, reason, fee);
    if (!result.success) return showNotice(result.error, 'error');
    showNotice(`Reservation cancelled${fee ? ` with a GH₵${fee.toFixed(2)} fee` : ''}.`);
    await refreshData(true);
  };

  const handleReassign = async (reservation, roomId) => {
    const room = rooms.find((candidate) => String(candidate.id) === String(roomId));
    if (!room) return;
    const result = await reassignRoom(reservation, room);
    if (!result.success) return showNotice(result.error, 'error');
    setSelectedReservation(null);
    showNotice(`Room reassigned to ${room.room_number}.`);
    await refreshData(true);
  };

  const submitTicket = async (event) => {
    event.preventDefault();
    if (!ticketForm.room_id || !ticketForm.title) return showNotice('Room and ticket title are required.', 'error');
    const result = await createMaintenanceTicket(ticketForm);
    if (result.error) return showNotice(result.error.message, 'error');
    setMaintenance((current) => [result.data, ...current]);
    setTicketForm({ room_id: '', title: '', description: '', priority: 'Medium' });
    showNotice('Maintenance ticket created and room placed out of service.');
    await refreshData(true);
  };

  const resolveTicket = async (ticket) => {
    const result = await updateMaintenanceTicket(ticket.id, { status: 'Resolved', resolved_at: new Date().toISOString() });
    if (result.error) return showNotice(result.error.message, 'error');
    setMaintenance((current) => current.map((item) => item.id === ticket.id ? { ...item, ...result.data } : item));
    showNotice('Ticket resolved and room returned to available inventory.');
    await refreshData(true);
  };

  const submitRatePlan = async (event) => {
    event.preventDefault();
    if (!rateForm.name || !rateForm.base_rate) return showNotice('Rate plan name and base rate are required.', 'error');
    const result = await saveRatePlan(rateForm);
    if (result.error) return showNotice(result.error.message, 'error');
    setRatePlans((current) => [...current.filter((item) => item.id !== result.data.id), result.data].sort((a, b) => a.name.localeCompare(b.name)));
    setRateForm({ name: '', description: '', base_rate: '', meal_plan: 'Room Only', min_nights: 1 });
    showNotice('Rate plan saved.');
  };

  const submitPolicy = async (event) => {
    event.preventDefault();
    if (!policyForm.name) return showNotice('Policy name is required.', 'error');
    const result = await saveCancellationPolicy(policyForm);
    if (result.error) return showNotice(result.error.message, 'error');
    setPolicies((current) => [...current.filter((item) => item.name !== result.data.name), result.data].sort((a, b) => b.days_before_checkin - a.days_before_checkin));
    setPolicyForm({ name: '', days_before_checkin: 2, fee_percent: 0, description: '' });
    showNotice('Cancellation policy saved.');
  };

  return (
    <DashboardLayout activeLink="Operations" title="Reservation Operations">
      <div className="space-y-6 pb-10">
        {notice && <div className={`rounded-xl border px-4 py-3 text-sm ${notice.type === 'error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-green-200 bg-green-50 text-green-700'}`}>{notice.message}</div>}
        <div>
          <h1 className="text-2xl font-bold">Reservation Operations</h1>
          <p className={`mt-1 text-sm ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>Validate availability, manage exceptions, and keep room inventory accurate.</p>
        </div>

        <section className={panelClass(isDarkMode)}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Availability search</h2><p className="text-sm opacity-70">Overlapping active reservations are excluded automatically.</p></div><button onClick={searchAvailability} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">Search rooms</button></div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <input type="date" value={availability.checkIn} onChange={(event) => setAvailability({ ...availability, checkIn: event.target.value })} className={inputClass(isDarkMode)} />
            <input type="date" value={availability.checkOut} onChange={(event) => setAvailability({ ...availability, checkOut: event.target.value })} className={inputClass(isDarkMode)} />
            <select value={availability.roomType} onChange={(event) => setAvailability({ ...availability, roomType: event.target.value })} className={inputClass(isDarkMode)}><option value="all">All room types</option>{roomTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select>
            <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">{availableRooms.length} room{availableRooms.length === 1 ? '' : 's'} available</div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">{availableRooms.map((room) => <div key={room.id} className={`rounded-xl border p-3 ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'}`}><div className="font-semibold">Room {room.room_number}</div><div className="text-sm opacity-70">{room.type} · GH₵{room.price}</div><button onClick={() => setWalkIn({ ...walkIn, roomId: room.id })} className="mt-3 text-sm font-semibold text-blue-600">Use for walk-in</button></div>)}</div>
        </section>

        <WaitlistPanel onNotice={showNotice} />
        <HousekeepingPanel onNotice={showNotice} />

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className={panelClass(isDarkMode)}><h2 className="mb-1 text-lg font-semibold">Walk-in guest</h2><p className="mb-4 text-sm opacity-70">Create today’s reservation and place the guest in the check-in queue.</p><form onSubmit={createWalkIn} className="space-y-3"><input placeholder="Guest full name" value={walkIn.guestName} onChange={(event) => setWalkIn({ ...walkIn, guestName: event.target.value })} className={inputClass(isDarkMode)} /><input placeholder="Phone number" value={walkIn.phoneNumber} onChange={(event) => setWalkIn({ ...walkIn, phoneNumber: event.target.value })} className={inputClass(isDarkMode)} /><DuplicateGuestHint name={walkIn.guestName} phone={walkIn.phoneNumber} /><div className="grid grid-cols-2 gap-3"><select value={walkIn.roomId} onChange={(event) => setWalkIn({ ...walkIn, roomId: event.target.value })} className={inputClass(isDarkMode)}><option value="">Select room</option>{availableRooms.map((room) => <option key={room.id} value={room.id}>Room {room.room_number} · {room.type}</option>)}</select><input type="date" value={walkIn.checkOut} min={today} onChange={(event) => setWalkIn({ ...walkIn, checkOut: event.target.value })} className={inputClass(isDarkMode)} /></div><button className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Create walk-in</button></form></section>

          <section className={panelClass(isDarkMode)}><h2 className="mb-1 text-lg font-semibold">Arrival exceptions</h2><p className="mb-4 text-sm opacity-70">Process overdue arrivals without deleting their history.</p>{noShows.length === 0 ? <p className="text-sm opacity-60">No overdue arrivals.</p> : <div className="space-y-2">{noShows.map((reservation) => <div key={reservation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><div><strong>{reservation.guest_name}</strong><div className="text-xs text-slate-600">Room {reservation.room_number || reservation.room_id} · {new Date(reservation.check_in_date).toLocaleDateString()}</div></div><div className="flex gap-2"><button onClick={() => setSelectedReservation(reservation)} className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">Reassign</button><button onClick={() => handleNoShow(reservation)} className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white">No-show</button><button onClick={() => handleCancel(reservation)} className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700">Cancel</button></div></div>)}</div>}</section>
        </div>

        <section className={panelClass(isDarkMode)}><h2 className="mb-4 text-lg font-semibold">Room assignment and reassignment</h2>{selectedReservation ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-slate-800"><div className="mb-3 flex items-center justify-between"><div><strong>{selectedReservation.guest_name}</strong><div>Current room: {selectedReservation.room_number || selectedReservation.room_id}</div></div><button onClick={() => setSelectedReservation(null)} className="text-blue-700">Close</button></div><select defaultValue="" onChange={(event) => handleReassign(selectedReservation, event.target.value)} className="w-full rounded-lg border border-blue-200 bg-white px-3 py-2"><option value="">Choose an available room for these dates</option>{rooms.filter((room) => room.status !== 'Maintenance' && String(room.id) !== String(selectedReservation.room_id)).map((room) => <option key={room.id} value={room.id}>Room {room.room_number} · {room.type} · GH₵{room.price}</option>)}</select></div> : <p className="text-sm opacity-60">Select Reassign from an overdue arrival to move it safely. Date-overlap validation runs before saving.</p>}</section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className={panelClass(isDarkMode)}><h2 className="mb-4 text-lg font-semibold">Maintenance tickets</h2><form onSubmit={submitTicket} className="grid grid-cols-1 gap-3 md:grid-cols-2"><select value={ticketForm.room_id} onChange={(event) => setTicketForm({ ...ticketForm, room_id: event.target.value })} className={inputClass(isDarkMode)}><option value="">Select room</option>{rooms.map((room) => <option key={room.id} value={room.id}>Room {room.room_number} · {room.status}</option>)}</select><input placeholder="Issue title" value={ticketForm.title} onChange={(event) => setTicketForm({ ...ticketForm, title: event.target.value })} className={inputClass(isDarkMode)} /><select value={ticketForm.priority} onChange={(event) => setTicketForm({ ...ticketForm, priority: event.target.value })} className={inputClass(isDarkMode)}><option>Low</option><option>Medium</option><option>High</option><option>Urgent</option></select><input placeholder="Description" value={ticketForm.description} onChange={(event) => setTicketForm({ ...ticketForm, description: event.target.value })} className={inputClass(isDarkMode)} /><button className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white md:col-span-2">Open maintenance ticket</button></form><div className="mt-4 space-y-2">{maintenance.slice(0, 6).map((ticket) => <div key={ticket.id} className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"><div><strong>{ticket.title}</strong><div className="text-xs opacity-70">Room {ticket.rooms?.room_number || ticket.room_id} · {ticket.priority} · {ticket.status}</div></div>{ticket.status !== 'Resolved' && <button onClick={() => resolveTicket(ticket)} className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">Resolve</button>}</div>)}</div></section>

          <section className={panelClass(isDarkMode)}><h2 className="mb-4 text-lg font-semibold">Rate-plan management</h2><form onSubmit={submitRatePlan} className="grid grid-cols-1 gap-3 md:grid-cols-2"><input placeholder="Plan name" value={rateForm.name} onChange={(event) => setRateForm({ ...rateForm, name: event.target.value })} className={inputClass(isDarkMode)} /><input type="number" min="0" placeholder="Base rate" value={rateForm.base_rate} onChange={(event) => setRateForm({ ...rateForm, base_rate: event.target.value })} className={inputClass(isDarkMode)} /><select value={rateForm.meal_plan} onChange={(event) => setRateForm({ ...rateForm, meal_plan: event.target.value })} className={inputClass(isDarkMode)}><option>Room Only</option><option>Breakfast</option><option>Half Board</option><option>Full Board</option></select><input placeholder="Description" value={rateForm.description} onChange={(event) => setRateForm({ ...rateForm, description: event.target.value })} className={inputClass(isDarkMode)} /><button className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white md:col-span-2">Save rate plan</button></form><div className="mt-4 space-y-2">{ratePlans.map((plan) => <div key={plan.id} className="flex items-center justify-between rounded-lg border p-3 text-sm"><span><strong>{plan.name}</strong><span className="ml-2 opacity-70">{plan.meal_plan}</span></span><strong>GH₵{Number(plan.base_rate).toFixed(2)}</strong></div>)}</div></section>
        </div>

        <section className={panelClass(isDarkMode)}><h2 className="mb-4 text-lg font-semibold">Cancellation policy management</h2><form onSubmit={submitPolicy} className="grid grid-cols-1 gap-3 md:grid-cols-4"><input placeholder="Policy name" value={policyForm.name} onChange={(event) => setPolicyForm({ ...policyForm, name: event.target.value })} className={inputClass(isDarkMode)} /><input type="number" min="0" placeholder="Days before check-in" value={policyForm.days_before_checkin} onChange={(event) => setPolicyForm({ ...policyForm, days_before_checkin: event.target.value })} className={inputClass(isDarkMode)} /><input type="number" min="0" max="100" placeholder="Fee %" value={policyForm.fee_percent} onChange={(event) => setPolicyForm({ ...policyForm, fee_percent: event.target.value })} className={inputClass(isDarkMode)} /><button className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white">Save policy</button></form><div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-3">{policies.map((policy) => <div key={policy.id} className="rounded-lg border p-3 text-sm"><strong>{policy.name}</strong><div className="opacity-70">{policy.days_before_checkin} days · {policy.fee_percent}% fee</div></div>)}</div></section>

        <section className={panelClass(isDarkMode)}><h2 className="mb-3 text-lg font-semibold">Active reservation controls</h2><div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b"><th className="px-2 py-2">Guest</th><th className="px-2 py-2">Room</th><th className="px-2 py-2">Dates</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Actions</th></tr></thead><tbody>{activeReservations.slice(0, 15).map((reservation) => <tr key={reservation.id} className="border-b last:border-0"><td className="px-2 py-2">{reservation.guest_name}</td><td className="px-2 py-2">{reservation.room_number || reservation.room_id}</td><td className="px-2 py-2">{new Date(reservation.check_in_date).toLocaleDateString()} – {new Date(reservation.check_out_date).toLocaleDateString()}</td><td className="px-2 py-2">{reservation.status}</td><td className="px-2 py-2"><button onClick={() => handleCancel(reservation)} className="text-xs font-semibold text-red-600">Cancel with policy</button></td></tr>)}</tbody></table></div></section>
      </div>
    </DashboardLayout>
  );
};

export default ReservationOperationsPage;
