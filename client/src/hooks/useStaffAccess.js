import { useEffect, useState } from 'react';
import { useUser } from '../context/UserContext';
import { findStaffRecord } from '../services/staffService';

const MANAGER_ROLES = ['admin', 'administrator', 'manager', 'hr'];

/** Who is looking at the page: manager or ordinary staff, and which staff record is theirs. */
const useStaffAccess = () => {
  const { user } = useUser() || {};
  const [staffRecord, setStaffRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const isManager = MANAGER_ROLES.includes(user?.role);

  useEffect(() => {
    let active = true;
    setLoading(true);
    findStaffRecord(user).then((record) => {
      if (!active) return;
      setStaffRecord(record);
      setLoading(false);
    });
    return () => { active = false; };
  }, [user?.id, user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  return { user, isManager, staffRecord, loading };
};

export default useStaffAccess;
