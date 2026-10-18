import React, { createContext, useContext, useState, useEffect } from 'react';
import useOfflineDatabase from '../hooks/useOfflineDatabase';

const OfflineRoomReservationContext = createContext();

export const useOfflineRoomReservation = () => {
  const context = useContext(OfflineRoomReservationContext);
  if (!context) {
    throw new Error('useOfflineRoomReservation must be used within an OfflineRoomReservationProvider');
  }
  return context;
};

export const OfflineRoomReservationProvider = ({ children }) => {
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [revenue, setRevenue] = useState({ total: 0, dates: [], values: [] });
  const [isShiftActive, setIsShiftActive] = useState(false);

  const {
    isInitialized,
    getRooms,
    updateRoomStatus,
    getReservations,
    createReservation,
    updateReservation,
    deleteReservation,
    getGuests,
    createGuest,
    updateGuest,
    reconcileRoomStatuses,
    getRevenue
  } = useOfflineDatabase();

  const norm = (v) => String(v ?? '').toLowerCase().replace(/[_-]/g, ' ').trim();
  const sameRoom = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && Number(a) === Number(b);

  // Load initial data when database is ready
  useEffect(() => {
    if (isInitialized) {
      reconcileRoomStatuses()
        .catch(err => console.error('Error reconciling room statuses:', err))
        .finally(() => {
          loadRooms();
          loadReservations();
          loadRevenue();
        });
    }
  }, [isInitialized]);

  // Guest and reservation screens announce their changes; keep rooms in step
  useEffect(() => {
    if (!isInitialized) return undefined;
    const reload = () => Promise.all([loadRooms(), loadReservations()]);
    window.addEventListener('offlineDataChanged', reload);
    return () => window.removeEventListener('offlineDataChanged', reload);
  }, [isInitialized]);

  const loadRooms = async () => {
    try {
      setLoading(true);
      const roomsData = await getRooms();
      setRooms(roomsData);
      setError(null);
    } catch (err) {
      console.error('Error loading rooms:', err);
      setError('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  };

  const loadReservations = async () => {
    try {
      const reservationsData = await getReservations();
      setReservations(reservationsData);
    } catch (err) {
      console.error('Error loading reservations:', err);
      setError('Failed to load reservations');
    }
  };

  const loadRevenue = async () => {
    try {
      const revenueData = await getRevenue();
      setRevenue(revenueData);
    } catch (err) {
      console.error('Error loading revenue:', err);
    }
  };

  const toDay = (d) => (d ? String(d).split('T')[0] : null);

  // Close whatever is currently attached to a room: in-house guests are checked
  // out and live reservations are completed. Used by check-out and by "set Available".
  const releaseRoom = async (roomId, { includeReserved = false } = {}) => {
    const closable = includeReserved ? ['checked in', 'reserved', 'confirmed'] : ['checked in'];

    const guests = await getGuests();
    for (const guest of guests) {
      if (sameRoom(guest.room_id, roomId) && closable.includes(norm(guest.status))) {
        await updateGuest(guest.id, { status: includeReserved && norm(guest.status) !== 'checked in' ? 'Cancelled' : 'Checked Out' });
      }
    }

    const current = await getReservations();
    for (const res of current) {
      if (sameRoom(res.room_id, roomId) && closable.includes(norm(res.status))) {
        await updateReservation(res.id, { status: norm(res.status) === 'checked in' ? 'checked_out' : 'cancelled' });
      }
    }
  };

  const checkInGuest = async (roomId, guestData, dates = {}) => {
    try {
      setLoading(true);

      const checkIn = toDay(dates.checkIn) || toDay(new Date().toISOString());
      const checkOut = toDay(dates.checkOut) || toDay(new Date(Date.now() + 86400000).toISOString());

      // Record the guest and the stay first; the room status follows from them
      const guestId = await createGuest({
        name: guestData.name,
        email: guestData.email,
        phone: guestData.phone,
        room_id: roomId,
        status: 'Checked In',
        check_in: checkIn,
        check_out: checkOut
      });

      await createReservation({
        guest_id: guestId,
        guest_name: guestData.name,
        room_id: roomId,
        check_in_date: checkIn,
        check_out_date: checkOut,
        status: 'checked_in',
        total_amount: 0 // Will be calculated based on room rate and duration
      });

      await Promise.all([loadRooms(), loadReservations(), loadRevenue()]);

      setError(null);
      return { success: true };
    } catch (err) {
      console.error('Error checking in guest:', err);
      setError('Failed to check in guest');
      // Never leave a room claiming a guest that was not saved
      await reconcileRoomStatuses().catch(() => {});
      await loadRooms();
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const checkOutGuest = async (roomId) => {
    try {
      setLoading(true);

      await releaseRoom(roomId);

      await Promise.all([loadRooms(), loadReservations(), loadRevenue()]);

      setError(null);
      return { success: true };
    } catch (err) {
      console.error('Error checking out guest:', err);
      setError('Failed to check out guest');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const makeReservation = async (reservationData) => {
    try {
      setLoading(true);

      const guestId = reservationData.guest_id ?? await createGuest({
        name: reservationData.guest_name,
        email: reservationData.email,
        phone: reservationData.phone,
        status: 'Reserved'
      });

      await createReservation({
        ...reservationData,
        guest_id: guestId,
        status: reservationData.status || 'confirmed'
      });

      await Promise.all([loadRooms(), loadReservations(), loadRevenue()]);

      setError(null);
      return { success: true };
    } catch (err) {
      console.error('Error making reservation:', err);
      setError('Failed to make reservation');
      await reconcileRoomStatuses().catch(() => {});
      await loadRooms();
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const cancelReservation = async (reservationId) => {
    try {
      setLoading(true);

      const current = await getReservations();
      const reservation = current.find(res => Number(res.id) === Number(reservationId));
      if (!reservation) {
        throw new Error('Reservation not found');
      }

      // Cancelling frees the room automatically (unless someone else holds it)
      await updateReservation(reservationId, { status: 'cancelled' });

      await Promise.all([loadRooms(), loadReservations(), loadRevenue()]);

      setError(null);
      return { success: true };
    } catch (err) {
      console.error('Error cancelling reservation:', err);
      setError('Failed to cancel reservation');
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  // Room-card actions. Occupied / Reserved only make sense with a guest behind
  // them, so those create the guest + stay; Available releases the room.
  const updateRoomStatusOnly = async (roomId, status, metadata = {}) => {
    try {
      setLoading(true);

      const target = norm(status);
      if ((target === 'occupied' || target === 'reserved') && metadata.guestName) {
        const alreadyHeld = (await getGuests()).some(
          g => sameRoom(g.room_id, roomId) && norm(g.status) === (target === 'occupied' ? 'checked in' : 'reserved')
        );
        if (!alreadyHeld) {
          const checkIn = toDay(metadata.checkInDate) || toDay(new Date().toISOString());
          const checkOut = toDay(metadata.checkOutDate) || toDay(new Date(Date.now() + 86400000).toISOString());
          const guestId = await createGuest({
            name: metadata.guestName,
            room_id: roomId,
            status: target === 'occupied' ? 'Checked In' : 'Reserved',
            check_in: checkIn,
            check_out: checkOut
          });
          await createReservation({
            guest_id: guestId,
            guest_name: metadata.guestName,
            room_id: roomId,
            check_in_date: checkIn,
            check_out_date: checkOut,
            status: target === 'occupied' ? 'checked_in' : 'confirmed',
            total_amount: 0
          });
        }
      } else if (target === 'available') {
        await releaseRoom(roomId, { includeReserved: true });
        await updateRoomStatus(roomId, 'Available');
      } else {
        await updateRoomStatus(roomId, status, metadata);
      }

      await Promise.all([loadRooms(), loadReservations()]);

      setError(null);
      return { success: true };
    } catch (err) {
      console.error('Error updating room status:', err);
      setError('Failed to update room status');
      await reconcileRoomStatuses().catch(() => {});
      await loadRooms();
      return { success: false, error: err.message };
    } finally {
      setLoading(false);
    }
  };

  const getRoomById = (roomId) => {
    return rooms.find(room => room.id === parseInt(roomId));
  };

  const getReservationById = (reservationId) => {
    return reservations.find(res => res.id === parseInt(reservationId));
  };

  const getReservationsByRoom = (roomId) => {
    return reservations.filter(res => res.room_id === parseInt(roomId));
  };

  const getReservationsByDate = (date) => {
    const targetDate = new Date(date).toISOString().split('T')[0];
    return reservations.filter(res => 
      res.check_in_date <= targetDate && res.check_out_date >= targetDate
    );
  };

  const startShift = () => {
    setIsShiftActive(true);
    localStorage.setItem('offlineShiftActive', 'true');
  };

  const endShift = () => {
    setIsShiftActive(false);
    localStorage.removeItem('offlineShiftActive');
  };

  // Check for active shift on load
  useEffect(() => {
    const shiftActive = localStorage.getItem('offlineShiftActive');
    setIsShiftActive(!!shiftActive);
  }, []);

  const value = {
    // Data
    rooms,
    reservations,
    revenue,
    loading,
    error,
    isShiftActive,

    // Room operations
    getRooms: loadRooms,
    updateRoomStatus: updateRoomStatusOnly,
    getRoomById,

    // Guest operations
    checkInGuest,
    checkOutGuest,

    // Reservation operations
    createReservation: makeReservation,
    updateReservation,
    deleteReservation,
    cancelReservation,
    getReservationById,
    getReservationsByRoom,
    getReservationsByDate,

    // Shift operations
    startShift,
    endShift,

    // Utility
    refreshData: () => Promise.all([loadRooms(), loadReservations(), loadRevenue()]),
    clearError: () => setError(null)
  };

  return (
    <OfflineRoomReservationContext.Provider value={value}>
      {children}
    </OfflineRoomReservationContext.Provider>
  );
}; 