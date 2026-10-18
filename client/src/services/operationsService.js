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
