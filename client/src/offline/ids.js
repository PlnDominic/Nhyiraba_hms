// Ids for rows created while offline.
//  * uuid tables: the device generates the real id, so replaying the same request twice is harmless
//  * numeric (serial/identity) tables: a huge negative temporary id is used locally and swapped for
//    the real one when the row reaches the server (see sync.js)

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const uuid = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

let counter = 0;
const TEMP_FLOOR = -1e13; // anything below this is a temporary id (real ids never get this large)
export const tempId = () => -(Date.now() * 100 + (counter++ % 100));
export const isTempId = (value) => typeof value === 'number' && value < TEMP_FLOOR;

// Known tables, used only until a row of the table has been seen (then the type is inferred).
const KNOWN = {
  uuid: ['reservations', 'guests', 'restaurant_orders', 'restaurant_order_items', 'restaurant_menu_items', 'waitlist_entries',
    'checkin_records', 'checkout_settlements', 'housekeeping_log', 'maintenance_tickets', 'rate_plans', 'cancellation_policies',
    'guest_notes', 'guest_profiles', 'sms_logs', 'staff', 'staff_schedules', 'time_entries'],
  number: ['invoices', 'invoice_items', 'service_requests', 'services', 'tasks']
};

export const inferIdKind = (rows) => {
  const sample = rows.find((r) => r && r.id !== undefined && r.id !== null);
  if (!sample) return null;
  if (typeof sample.id === 'number') return 'number';
  return UUID_RE.test(String(sample.id)) ? 'uuid' : null;
};

export const idKindFor = (table, knownRows = []) => inferIdKind(knownRows)
  || (KNOWN.uuid.includes(table) ? 'uuid' : KNOWN.number.includes(table) ? 'number' : null);
