import supabase from '../supabaseClient';
import { normalizeEmail, normalizeName, normalizePhone } from '../utils/guestIdentity';

const safe = async (query, label, warnings) => {
  const { data, error } = await query;
  if (error) {
    warnings.push(`${label}: ${error.message}`);
    return [];
  }
  return data || [];
};

/** Loads everything the profile screens need in one round trip. Missing tables degrade to [] with a warning. */
export const loadProfileBundle = async () => {
  const warnings = [];
  const [guests, reservations, settlements, checkins, sms, savedProfiles, notes] = await Promise.all([
    safe(supabase.from('guests').select('*'), 'guests', warnings),
    safe(supabase.from('reservations').select('*'), 'reservations', warnings),
    safe(supabase.from('checkout_settlements').select('*'), 'checkout_settlements', warnings),
    safe(supabase.from('checkin_records').select('*'), 'checkin_records', warnings),
    safe(supabase.from('sms_logs').select('*').order('created_at', { ascending: false }).limit(500), 'sms_logs', warnings),
    safe(supabase.from('guest_profiles').select('*'), 'guest_profiles', warnings),
    safe(supabase.from('guest_notes').select('*').order('created_at', { ascending: false }), 'guest_notes', warnings)
  ]);
  return { guests, reservations, settlements, checkins, sms, savedProfiles, notes, warnings };
};

const byDateDesc = (field) => (a, b) => new Date(b[field] || 0) - new Date(a[field] || 0);

/** Attach everything known about one profile (pure, so it can be tested). */
export const attachProfileData = (profile, bundle) => {
  const phones = new Set(profile.phones);
  const emails = new Set(profile.emails);
  const names = new Set(profile.names.map(normalizeName));
  const ids = new Set(profile.identifiers);

  const contactMatches = (phone, email) => (
    (phone && phones.has(normalizePhone(phone))) || (email && emails.has(normalizeEmail(email)))
  );

  const reservations = bundle.reservations.filter((r) => (
    contactMatches(r.guest_phone, r.guest_email)
    || (!normalizePhone(r.guest_phone) && !normalizeEmail(r.guest_email) && names.has(normalizeName(r.guest_name)))
  )).sort(byDateDesc('check_in_date'));

  const settlements = bundle.settlements
    .filter((s) => names.has(normalizeName(s.guest_name)))
    .sort(byDateDesc('created_at'));

  const checkins = bundle.checkins
    .filter((c) => contactMatches(c.guest_phone, c.guest_email) || names.has(normalizeName(c.guest_name)))
    .sort(byDateDesc('created_at'));

  const sms = bundle.sms.filter((m) => phones.has(normalizePhone(m.phone)));

  return {
    reservations,
    settlements,
    checkins,
    sms,
    saved: bundle.savedProfiles.find((p) => ids.has(p.guest_key)) || null,
    notes: bundle.notes.filter((n) => ids.has(n.guest_key)),
    totalSpend: settlements.reduce((sum, s) => sum + (Number(s.total_due) || 0), 0),
    lastId: checkins[0] || null
  };
};

const currentUserId = async () => (await supabase.auth.getUser()).data?.user?.id || null;

export const saveGuestProfile = async (guestKey, { display_name, preferences, vip }) => supabase
  .from('guest_profiles')
  .upsert({
    guest_key: guestKey,
    display_name: display_name || null,
    preferences: preferences || null,
    vip: Boolean(vip),
    updated_by: await currentUserId(),
    updated_at: new Date().toISOString()
  })
  .select()
  .single();

export const addGuestNote = async (guestKey, note) => supabase
  .from('guest_notes')
  .insert({ guest_key: guestKey, note: note.trim(), created_by: await currentUserId() })
  .select()
  .single();
