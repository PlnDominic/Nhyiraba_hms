import supabase from '../supabaseClient';

const ACTIVE_RESERVATION_STATUSES = ['Reserved', 'Confirmed', 'Checked In'];

const asDate = (value) => new Date(`${value}T00:00:00`);

const overlaps = (start, end, existingStart, existingEnd) => (
  asDate(start) < new Date(existingEnd) && asDate(end) > new Date(existingStart)
);

export const getAvailableRooms = async ({ checkIn, checkOut, roomType = 'all', excludeReservationId = null }) => {
  if (!checkIn || !checkOut || asDate(checkOut) <= asDate(checkIn)) {
    return { data: [], error: new Error('Check-out must be after check-in.') };
  }

  const [{ data: rooms, error: roomsError }, { data: reservations, error: reservationsError }] = await Promise.all([
    supabase.from('rooms').select('*').order('room_number', { ascending: true }),
    supabase.from('reservations').select('id, room_id, check_in_date, check_out_date, status')
  ]);

  if (roomsError) return { data: [], error: roomsError };
  if (reservationsError) return { data: [], error: reservationsError };

  const unavailableRoomIds = new Set(
    (reservations || [])
      .filter((reservation) => (
        reservation.id !== excludeReservationId &&
        ACTIVE_RESERVATION_STATUSES.includes(reservation.status) &&
        overlaps(checkIn, checkOut, reservation.check_in_date, reservation.check_out_date)
      ))
      .map((reservation) => String(reservation.room_id))
  );
  const searchIncludesToday = asDate(checkIn) <= new Date() && new Date() < asDate(checkOut);

  return {
    data: (rooms || []).filter((room) => (
      room.status !== 'Maintenance' &&
      room.housekeeping_status !== 'Out of Service' &&
      !(searchIncludesToday && room.status === 'Occupied') &&
      (roomType === 'all' || room.type === roomType) &&
      !unavailableRoomIds.has(String(room.id))
    )),
    error: null
  };
};

export const validateRoomAvailability = async (roomId, checkIn, checkOut, excludeReservationId = null) => {
  const result = await getAvailableRooms({ checkIn, checkOut, excludeReservationId });
  if (result.error) return result;
  const available = result.data.some((room) => String(room.id) === String(roomId));
  return {
    data: available,
    error: available ? null : new Error('The selected room is not available for those dates.')
  };
};

export const markReservationNoShow = async (reservation) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('reservations')
    .update({ status: 'No-Show', no_show_at: now, updated_at: now })
    .eq('id', reservation.id)
    .select()
    .single();
  if (error) return { data: null, error };

  if (reservation.room_id) {
    await supabase.from('rooms').update({ status: 'Available', updated_at: now }).eq('id', reservation.room_id);
  }
  return { data, error: null };
};

export const reassignReservation = async (reservation, room) => {
  const availability = await validateRoomAvailability(
    room.id,
    reservation.check_in_date,
    reservation.check_out_date,
    reservation.id
  );
  if (availability.error) return { data: null, error: availability.error };

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('reservations')
    .update({
      room_id: room.id,
      room_number: room.room_number,
      room_type: room.type,
      room_price: room.price,
      updated_at: now
    })
    .eq('id', reservation.id)
    .select()
    .single();
  if (error) return { data: null, error };

  if (reservation.room_id && String(reservation.room_id) !== String(room.id)) {
    await supabase.from('rooms').update({ status: 'Available', updated_at: now }).eq('id', reservation.room_id);
  }
  if (data.status === 'Reserved' || data.status === 'Confirmed') {
    await supabase.from('rooms').update({ status: 'Reserved', updated_at: now }).eq('id', room.id);
  }
  return { data, error: null };
};

export const cancelReservationWithPolicy = async (reservation, reason, fee = 0) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('reservations')
    .update({
      status: 'Cancelled',
      cancellation_reason: reason || 'Cancelled by staff',
      cancellation_fee: Number(fee) || 0,
      cancelled_at: now,
      updated_at: now
    })
    .eq('id', reservation.id)
    .select()
    .single();
  if (error) return { data: null, error };

  if (reservation.room_id) {
    await supabase.from('rooms').update({ status: 'Available', updated_at: now }).eq('id', reservation.room_id);
  }
  return { data, error: null };
};

export const getMaintenanceTickets = async () => {
  const { data, error } = await supabase
    .from('maintenance_tickets')
    .select('*, rooms(room_number, type)')
    .order('created_at', { ascending: false });
  return { data: data || [], error };
};

export const createMaintenanceTicket = async (ticket) => {
  const { data, error } = await supabase
    .from('maintenance_tickets')
    .insert([{ ...ticket, status: 'Open' }])
    .select()
    .single();
  if (!error && ticket.room_id) {
    await supabase.from('rooms').update({ status: 'Maintenance', updated_at: new Date().toISOString() }).eq('id', ticket.room_id);
  }
  return { data, error };
};

export const updateMaintenanceTicket = async (id, updates) => {
  const { data, error } = await supabase
    .from('maintenance_tickets')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (!error && updates.status === 'Resolved' && data?.room_id) {
    await supabase.from('rooms').update({ status: 'Available', updated_at: new Date().toISOString() }).eq('id', data.room_id);
  }
  return { data, error };
};

export const getRatePlans = async () => {
  const { data, error } = await supabase.from('rate_plans').select('*').order('name');
  return { data: data || [], error };
};

export const saveRatePlan = async (plan) => {
  const payload = { ...plan, base_rate: Number(plan.base_rate), updated_at: new Date().toISOString() };
  const query = plan.id
    ? supabase.from('rate_plans').update(payload).eq('id', plan.id)
    : supabase.from('rate_plans').insert([{ ...payload, is_active: true }]);
  const { data, error } = await query.select().single();
  return { data, error };
};

export const getCancellationPolicies = async () => {
  const { data, error } = await supabase.from('cancellation_policies').select('*').eq('is_active', true).order('days_before_checkin');
  return { data: data || [], error };
};

export const saveCancellationPolicy = async (policy) => {
  const { data, error } = await supabase
    .from('cancellation_policies')
    .upsert([{ ...policy, fee_percent: Number(policy.fee_percent), is_active: true }], { onConflict: 'name' })
    .select()
    .single();
  return { data, error };
};

export const calculateCancellationFee = (reservation, policy) => {
  if (!reservation || !policy) return 0;
  const daysBefore = Math.ceil((new Date(reservation.check_in_date) - new Date()) / 86400000);
  return daysBefore >= Number(policy.days_before_checkin)
    ? Number(reservation.room_price || 0) * (Number(policy.fee_percent || 0) / 100)
    : Number(reservation.room_price || 0);
};

// ---------------------------------------------------------------------------
// Friendly messages for database-level availability enforcement (#1)
// ---------------------------------------------------------------------------
export const friendlyReservationError = (error) => {
  if (error?.code === '23P01') {
    return 'That room was just booked for overlapping dates. Please pick another room or dates.';
  }
  return error?.message || 'Unknown error occurred';
};

const currentUserId = async () => {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id || null;
};

// ---------------------------------------------------------------------------
// Housekeeping lifecycle (#6)
// ---------------------------------------------------------------------------
export const HOUSEKEEPING_STATUSES = ['Clean', 'Dirty', 'Inspected', 'Out of Service'];
export const ROOM_READY_STATUSES = ['Clean', 'Inspected'];

export const isRoomReady = (room) => ROOM_READY_STATUSES.includes(room?.housekeeping_status || 'Clean');

export const setHousekeepingStatus = async (room, toStatus, note = '') => {
  if (!HOUSEKEEPING_STATUSES.includes(toStatus)) {
    return { data: null, error: new Error('Invalid housekeeping status.') };
  }
  const now = new Date().toISOString();
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('rooms')
    .update({
      housekeeping_status: toStatus,
      housekeeping_updated_at: now,
      housekeeping_updated_by: userId,
      updated_at: now
    })
    .eq('id', room.id)
    .select()
    .single();
  if (error) return { data: null, error };

  await supabase.from('housekeeping_log').insert({
    room_id: room.id,
    from_status: room.housekeeping_status || 'Clean',
    to_status: toStatus,
    note: note || null,
    changed_by: userId
  });
  return { data, error: null };
};

export const getHousekeepingLog = async (roomId, limit = 10) => supabase
  .from('housekeeping_log')
  .select('*')
  .eq('room_id', roomId)
  .order('created_at', { ascending: false })
  .limit(limit);

// ---------------------------------------------------------------------------
// Waitlist (#4)
// ---------------------------------------------------------------------------
export const getWaitlist = async () => supabase
  .from('waitlist_entries')
  .select('*')
  .eq('status', 'Waiting')
  .order('priority', { ascending: true })
  .order('created_at', { ascending: true });

export const addWaitlistEntry = async (entry) => {
  const userId = await currentUserId();
  return supabase
    .from('waitlist_entries')
    .insert({
      guest_name: entry.guest_name,
      guest_phone: entry.guest_phone || null,
      guest_email: entry.guest_email || null,
      room_type: entry.room_type && entry.room_type !== 'all' ? entry.room_type : null,
      check_in_date: entry.check_in_date,
      check_out_date: entry.check_out_date,
      adults: Number(entry.adults) || 1,
      priority: Number(entry.priority) || 3,
      notes: entry.notes || null,
      created_by: userId
    })
    .select()
    .single();
};

export const updateWaitlistEntry = async (id, updates) => supabase
  .from('waitlist_entries')
  .update({ ...updates, updated_at: new Date().toISOString() })
  .eq('id', id)
  .select()
  .single();

// ---------------------------------------------------------------------------
// Check-in validation (#7)
// ---------------------------------------------------------------------------
export const ID_TYPES = ['Ghana Card', 'Passport', "Driver's Licence", "Voter's ID", 'Other'];

/**
 * Returns a list of problems that block check-in. Managers can override the
 * payment requirement with a reason; identity, readiness and policy cannot be skipped.
 */
export const validateCheckIn = ({ reservation, room, form }) => {
  const problems = [];
  if (!(reservation.guest_phone || form.phone) && !(reservation.guest_email || form.email)) {
    problems.push('A phone number or email address is required.');
  }
  if (!form.idType || !String(form.idNumber || '').trim()) {
    problems.push('Guest identity (ID type and number) is required.');
  }
  const paid = reservation.payment_status === 'Paid' || Number(form.depositAmount) > 0 || form.paymentConfirmed;
  if (!paid && !String(form.overrideReason || '').trim()) {
    problems.push('Confirm a deposit/payment, or enter a reason for proceeding without one.');
  }
  if (room && !isRoomReady(room)) {
    problems.push(`Room ${room.room_number} is marked "${room.housekeeping_status}" and is not ready for check-in.`);
  }
  if (room?.status === 'Maintenance') {
    problems.push(`Room ${room.room_number} is under maintenance.`);
  }
  if (!form.policyAcknowledged) {
    problems.push('The guest must acknowledge the hotel policies.');
  }
  return problems;
};

export const saveCheckInRecord = async ({ reservation, form }) => {
  const userId = await currentUserId();
  return supabase.from('checkin_records').insert({
    reservation_id: String(reservation.id).startsWith('local-') ? null : reservation.id,
    room_id: reservation.room_id,
    guest_name: reservation.guest_name,
    guest_phone: reservation.guest_phone || form.phone || null,
    guest_email: reservation.guest_email || form.email || null,
    id_type: form.idType,
    id_number: String(form.idNumber).trim(),
    deposit_amount: Number(form.depositAmount) || 0,
    payment_confirmed: Boolean(form.paymentConfirmed) || Number(form.depositAmount) > 0,
    policy_acknowledged: Boolean(form.policyAcknowledged),
    override_reason: String(form.overrideReason || '').trim() || null,
    checked_in_by: userId
  });
};

export const getLatestCheckInRecord = async (roomId) => supabase
  .from('checkin_records')
  .select('*')
  .eq('room_id', roomId)
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();

// ---------------------------------------------------------------------------
// Check-out settlement (#8)
// ---------------------------------------------------------------------------
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export const calculateNights = (checkIn, checkOut) => {
  const ms = new Date(checkOut) - new Date(checkIn);
  return Math.max(1, Math.ceil(ms / 86400000));
};

/**
 * Pure folio calculation so the UI and tests agree.
 * extras: [{ description, amount }]
 */
export const calculateFolio = ({ checkIn, checkOut, roomRate, lateCheckoutFee = 0, extras = [], depositPaid = 0, paymentReceived = 0 }) => {
  const nights = calculateNights(checkIn, checkOut);
  const roomTotal = round2(nights * Number(roomRate || 0));
  const extrasTotal = round2(extras.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const totalDue = round2(roomTotal + extrasTotal + Number(lateCheckoutFee || 0));
  const balance = round2(totalDue - Number(depositPaid || 0) - Number(paymentReceived || 0));
  return { nights, roomTotal, extrasTotal, totalDue, balance };
};

export const saveCheckoutSettlement = async (settlement) => {
  const userId = await currentUserId();
  return supabase
    .from('checkout_settlements')
    .insert({ ...settlement, settled_by: userId })
    .select()
    .single();
};
