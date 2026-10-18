import { useEffect, useState } from 'react';
import { getOfflineState, subscribeOffline } from './index';

/** Re-renders whenever connection / sync status changes. */
const useOfflineStatus = () => {
  const [status, setStatus] = useState(getOfflineState());
  useEffect(() => subscribeOffline(setStatus), []);
  return status;
};

export default useOfflineStatus;
