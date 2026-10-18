import React, { createContext, useContext, useState, useEffect } from 'react';
import useOfflineDatabase from '../hooks/useOfflineDatabase';

const OfflineReservationContext = createContext();

export const useOfflineReservation = () => {
  const context = useContext(OfflineReservationContext);
  if (!context) {
    throw new Error('useOfflineReservation must be used within an OfflineReservationProvider');
  }
  return context;
};

export const OfflineReservationProvider = ({ children }) => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const {
    isInitialized,
    getReservations,
    createGuest,
    createReservation: dbCreateReservation,
    updateReservation: dbUpdateReservation,
    deleteReservation: dbDeleteReservation
  } = useOfflineDatabase();

  useEffect(() => {
    if (isInitialized) {
      loadReservations();
    }
  }, [isInitialized]);

  const loadReservations = async () => {
    try {
      setLoading(true);
      const reservationsData = await getReservations();
      setReservations(reservationsData);
      setError(null);
    } catch (err) {
      console.error('Error loading reservations:', err);
      setError('Failed to load reservations');
    } finally {
      setLoading(false);
    }
  };

  const afterChange = async () => {
    await loadReservations();
    window.dispatchEvent(new CustomEvent('offlineDataChanged'));
  };

  // Every reservation belongs to a guest; create one when only a name is given.
  const createReservation = async (data) => {
    const guestId = data.guest_id ?? await createGuest({
      name: data.guest_name,
      email: data.email,
      phone: data.phone,
      status: 'Reserved'
    });
    const id = await dbCreateReservation({ ...data, guest_id: guestId, status: data.status || 'confirmed' });
    await afterChange();
    return id;
  };

  const updateReservation = async (id, updates) => {
    await dbUpdateReservation(id, updates);
    await afterChange();
  };

  const deleteReservation = async (id) => {
    await dbDeleteReservation(id);
    await afterChange();
  };

  const value = {
    reservations,
    createReservation,
    updateReservation,
    deleteReservation,
    loading,
    error,
    refreshReservations: loadReservations,
    clearError: () => setError(null)
  };

  return (
    <OfflineReservationContext.Provider value={value}>
      {children}
    </OfflineReservationContext.Provider>
  );
}; 