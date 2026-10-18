// Helpers that keep a room's Occupied / Reserved status in step with the
// guests and reservations that actually exist.

const ACTIVE_RESERVATION = ['reserved', 'confirmed', 'checked in'];
const ACTIVE_GUEST = ['checked in'];
const RESERVED_GUEST = ['reserved'];

const norm = (v) => String(v ?? '').trim().toLowerCase();

// Every spelling a room may be referenced by: id, room number ("05", "5"), "Room 5".
export const roomKeys = (room) => {
  const keys = new Set();
  const add = (v) => {
    if (v === null || v === undefined || v === '') return;
    const s = String(v).trim().toLowerCase().replace(/^room\s*/, '');
    keys.add(s);
    if (/^\d+$/.test(s)) keys.add(String(parseInt(s, 10)));
  };
  add(room.id);
  add(room.room_number);
  return keys;
};

const refersTo = (keys, ref) => {
  if (ref === null || ref === undefined || ref === '') return false;
  const s = String(ref).trim().toLowerCase().replace(/^room\s*/, '');
  return keys.has(s) || (/^\d+$/.test(s) && keys.has(String(parseInt(s, 10))));
};

// Returns [{ room, status }] for rooms whose status claims a guest / booking
// that no longer exists. Maintenance and Available rooms are never touched.
// Rooms touched within `graceMs` are skipped: a check-in marks the room before
// the guest row lands, and that window must not be mistaken for a stale room.
export const findStaleRooms = (rooms, reservations, guests, graceMs = 2 * 60 * 1000) => {
  const stale = [];
  const now = Date.now();
  (rooms || []).forEach((room) => {
    const status = norm(room.status);
    if (status !== 'occupied' && status !== 'reserved') return;
    const touched = room.updated_at ? new Date(room.updated_at).getTime() : 0;
    if (touched && now - touched < graceMs) return;
    const keys = roomKeys(room);

    const hasInHouseGuest = (guests || []).some(
      (g) => ACTIVE_GUEST.includes(norm(g.status)) && refersTo(keys, g.room)
    );
    const hasReservation = (reservations || []).some(
      (r) => ACTIVE_RESERVATION.includes(norm(r.status)) && (refersTo(keys, r.room_id) || refersTo(keys, r.room_number))
    );
    const hasReservedGuest = (guests || []).some(
      (g) => RESERVED_GUEST.includes(norm(g.status)) && refersTo(keys, g.room)
    );

    const supported = status === 'occupied'
      ? hasInHouseGuest || (hasReservation && (reservations || []).some(
        (r) => norm(r.status) === 'checked in' && (refersTo(keys, r.room_id) || refersTo(keys, r.room_number))
      ))
      : hasReservation || hasReservedGuest || hasInHouseGuest;

    if (!supported) stale.push({ room, status: 'Available' });
  });
  return stale;
};
