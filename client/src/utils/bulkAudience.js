// Who a bulk message can go to, built from guest profiles and reservations.
import { normalizePhone } from './guestIdentity';

export const AUDIENCES = [
  { id: 'all', label: 'Everyone (all guests and customers)' },
  { id: 'inhouse', label: 'Guests staying now' },
  { id: 'upcoming', label: 'Upcoming reservations' },
  { id: 'past', label: 'Past guests' },
  { id: 'manual', label: 'Numbers I type or paste' }
];

export const CAMPAIGN_TYPES = [
  { id: 'promotion', label: 'Promotion' },
  { id: 'programme', label: 'Programme or event' },
  { id: 'announcement', label: 'Announcement' },
  { id: 'other', label: 'Other' }
];

export const MAX_BULK_RECIPIENTS = 500;
export const MAX_BULK_LENGTH = 320;

const ACTIVE_RESERVATION = ['reserved', 'confirmed'];
const status = (s) => String(s || '').trim().toLowerCase();

// One entry per phone number: { key, name, phone }
const dedupe = (entries) => {
  const seen = new Map();
  entries.forEach((e) => {
    const phone = normalizePhone(e.phone);
    if (phone && !seen.has(phone)) seen.set(phone, { key: phone, name: e.name || '', phone });
  });
  return [...seen.values()];
};

export const buildAudience = (id, { profiles = [], reservations = [] } = {}) => {
  const fromProfile = (p) => ({ name: p.name, phone: p.phones[0] });
  const reservationContacts = reservations
    .filter((r) => r.guest_phone)
    .map((r) => ({ name: r.guest_name, phone: r.guest_phone, status: status(r.status) }));

  if (id === 'inhouse') return dedupe(profiles.filter((p) => p.inHouse && p.phones.length).map(fromProfile));
  if (id === 'upcoming') {
    return dedupe([
      ...profiles.filter((p) => p.stays.some((s) => status(s.status) === 'reserved') && p.phones.length).map(fromProfile),
      ...reservationContacts.filter((r) => ACTIVE_RESERVATION.includes(r.status))
    ]);
  }
  if (id === 'past') {
    return dedupe(profiles
      .filter((p) => p.phones.length && !p.inHouse && !p.stays.some((s) => status(s.status) === 'reserved'))
      .map(fromProfile));
  }
  if (id === 'all') return dedupe([...profiles.filter((p) => p.phones.length).map(fromProfile), ...reservationContacts]);
  return [];
};

// One number per line, optionally followed by a name ("0241234567, Ama"), or
// several numbers separated by commas / semicolons / spaces. Numbers may
// contain spaces or dashes ("+233 24 123 4567").
export const parseManualNumbers = (text) => {
  const entries = [];
  const invalid = [];
  const addNumber = (raw, name = '') => (normalizePhone(raw) ? entries.push({ phone: raw, name }) : invalid.push(raw));

  String(text || '').split(/\n+/).forEach((line) => {
    const parts = line.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
    let last = null;
    parts.forEach((part) => {
      if (/[a-z]/i.test(part)) {                       // a name belongs to the number before it
        if (last) last.name = part; else invalid.push(part);
        return;
      }
      const digits = part.replace(/\D/g, '');
      const pieces = digits.length > 15 ? part.split(/\s+/) : [part]; // several numbers pasted with spaces
      pieces.forEach((piece) => {
        addNumber(piece);
        last = entries[entries.length - 1] && entries[entries.length - 1].phone === piece ? entries[entries.length - 1] : null;
      });
    });
  });
  return { entries: dedupe(entries), invalid };
};

// Rough SMS credit estimate: 160 characters per message part
export const smsParts = (length) => Math.max(1, Math.ceil(length / 160));

export const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'Guest';
