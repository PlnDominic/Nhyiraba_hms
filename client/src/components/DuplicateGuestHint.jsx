import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useGuests } from '../context/GuestContext';
import { buildProfiles, findDuplicates } from '../utils/guestIdentity';

const fmt = (value) => (value ? new Date(value).toLocaleDateString() : 'unknown date');

/**
 * Shown while entering a guest: flags returning guests (same phone/email) and
 * near-identical names so staff reuse the existing profile instead of creating a second one.
 */
const DuplicateGuestHint = ({ name, phone, email }) => {
  const { guestList } = useGuests() || {};
  const profiles = useMemo(() => buildProfiles(guestList || []), [guestList]);
  const matches = useMemo(() => (
    name || phone || email ? findDuplicates({ name, phone, email }, profiles).slice(0, 3) : []
  ), [name, phone, email, profiles]);

  if (!matches.length) return null;
  return (
    <div className="space-y-2" role="status">
      {matches.map(({ profile, level, reasons }) => (
        <div
          key={profile.key}
          className={`rounded-lg border px-3 py-2 text-sm ${level === 'strong' ? 'border-blue-200 bg-blue-50 text-blue-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
        >
          <strong>{level === 'strong' ? 'Returning guest' : 'Possible existing guest'}:</strong> {profile.name}
          {' '}— {profile.stayCount} previous stay{profile.stayCount === 1 ? '' : 's'}, last on {fmt(profile.lastStay.check_in)}
          <span className="ml-1 opacity-70">(matched by {reasons.join(' & ')})</span>
          {profile.inHouse && <span className="ml-1 font-semibold text-red-700">· currently in-house</span>}
          <Link to={`/guest-profiles?key=${encodeURIComponent(profile.key)}`} className="ml-2 font-semibold underline">View profile</Link>
        </div>
      ))}
    </div>
  );
};

export default DuplicateGuestHint;
