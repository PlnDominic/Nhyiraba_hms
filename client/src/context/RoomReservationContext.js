import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, useMemo } from 'react';
import { useUser } from './UserContext';
import supabase from '../supabaseClient';
import {
  getReservations,
  createReservation as createReservationService,
  updateReservation as updateReservationService
} from '../services/reservationService';
import { findStaleRooms } from '../utils/roomReconcile';
import { sendSmsNotification, reservationSmsData } from '../services/smsService';
import {
  validateRoomAvailability,
  markReservationNoShow,
  reassignReservation,
  cancelReservationWithPolicy,
  friendlyReservationError
} from '../services/operationsService';

const RoomReservationContext = createContext();

// Enhanced function to check if connection works
async function testDatabaseConnection() {
  console.log('Testing database connection...');
  try {
    // First, test with a simple ping query
    const startTime = Date.now();
    const { data, error, status } = await supabase
      .from('rooms')
      .select('count')
      .limit(1);

    const latency = Date.now() - startTime;

    if (error) {
      console.error('Database connection test failed:', error, 'HTTP Status:', status);
      console.error('Connection error details:', JSON.stringify(error, null, 2));
      return {
        success: false,
        error,
        status,
        message: `Connection failed: ${error.message || 'Unknown error'}`
      };
    }

    console.log(`Database connection test successful! Latency: ${latency}ms`);

    // Try to get actual data to ensure permissions are correct
    const { data: roomData, error: roomError } = await supabase
      .from('rooms')
      .select('*')
      .limit(1);

    if (roomError) {
      console.warn('Connection works but querying data failed:', roomError);
      return {
        success: true,
        hasData: false,
        error: roomError,
        message: 'Connected but cannot access data. Possible permission issue.'
      };
    }

    if (!roomData || !Array.isArray(roomData) || roomData.length === 0) {
      console.warn('Connection works but no room data found');
      return {
        success: true,
        hasData: false,
        message: 'Connected but no room data found. Database might be empty.'
      };
    }

    console.log('Successfully retrieved room data');
    return {
      success: true,
      hasData: true,
      latency,
      message: 'Connection successful, data retrieved'
    };
  } catch (err) {
    console.error('Exception testing database connection:', err);
    console.error('Error stack:', err.stack);
    return {
      success: false,
      error: err,
      message: `Connection exception: ${err.message || err}`
    };
  }
}

const initialState = {
  rooms: [],
  reservations: [],
  loading: true,
  error: null,
  revenue: 0,
  isDataFresh: false,
  lastFetchTime: 0
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_ROOMS':
      return { ...state, rooms: action.payload, isDataFresh: true };

    case 'SET_RESERVATIONS':
      return { ...state, reservations: action.payload, isDataFresh: true };

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'SET_LAST_FETCH_TIME':
      return { ...state, lastFetchTime: action.payload };

    case 'SET_DATA_FRESH':
      return { ...state, isDataFresh: action.payload };

    case 'UPDATE_ROOM_STATUS':
      const updatedRooms = state.rooms.map(room =>
        room.id === action.payload.roomId
          ? { ...room, status: action.payload.status, guest: 'guest' in action.payload ? action.payload.guest : room.guest }
          : room
      );
      return { ...state, rooms: updatedRooms };

    case 'ADD_RESERVATION':
      const newReservations = [...state.reservations, action.payload];
      return { ...state, reservations: newReservations };

    case 'UPDATE_RESERVATION':
      const updatedReservations = state.reservations.map(reservation =>
        reservation.id === action.payload.id
          ? { ...reservation, ...action.payload }
          : reservation
      );
      return { ...state, reservations: updatedReservations };

    case 'DELETE_RESERVATION':
      const filteredReservations = state.reservations.filter(reservation =>
        reservation.id !== action.payload
      );
      return { ...state, reservations: filteredReservations };

    case 'UPDATE_REVENUE':
      const newRevenue = state.revenue + action.payload;
      return { ...state, revenue: newRevenue };

    case 'SET_REVENUE':
      return { ...state, revenue: action.payload };

    default:
      return state;
  }
}

// Simple debounce function to prevent multiple rapid calls
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Add this utility function
const formatError = (error) => {
  if (!error) return null;

  if (typeof error === 'string') return error;

  if (typeof error === 'object') {
    // For Supabase error objects
    if (error.message) {
      return error.message;
    }

    // Try to extract a meaningful message
    try {
      return JSON.stringify(error);
    } catch (e) {
      return 'Unknown error occurred';
    }
  }

  return String(error);
};

export const RoomReservationProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const isLoadingRef = useRef(false);
  const fetchTimeoutRef = useRef(null);
  const prefetchTriggeredRef = useRef(false);

  // Free rooms that are marked Occupied / Reserved although no guest or
  // reservation is attached to them (left behind by edits, deletes, failed
  // writes or offline sync). Works from fresh database reads, and does
  // nothing unless every read succeeded.
  const reconcileRoomStatuses = useCallback(async () => {
    try {
      const [roomsRes, reservationsRes, guestsRes] = await Promise.all([
        supabase.from('rooms').select('*'),
        supabase.from('reservations').select('id, room_id, room_number, status'),
        supabase.from('guests').select('id, room, status')
      ]);
      if (roomsRes.error || reservationsRes.error || guestsRes.error) return 0;

      const stale = findStaleRooms(roomsRes.data, reservationsRes.data, guestsRes.data);
      for (const { room, status } of stale) {
        const { error } = await supabase
          .from('rooms')
          .update({ status, guest: null, updated_at: new Date().toISOString() })
          .eq('id', room.id);
        if (!error) {
          dispatch({ type: 'UPDATE_ROOM_STATUS', payload: { roomId: room.id, status, guest: '' } });
          console.warn(`Room ${room.room_number || room.id} was ${room.status} with no guest or reservation; set to ${status}.`);
        }
      }
      return stale.length;
    } catch (err) {
      console.error('Room status reconciliation failed:', err);
      return 0;
    }
  }, []);

  // Enhanced refreshData to better handle room data
  const refreshData = useCallback(async (forceRefresh = false) => {
    console.log('refreshData called with forceRefresh:', forceRefresh);
    console.log('Current state - isDataFresh:', state.isDataFresh, 'rooms count:', state.rooms.length, 'reservations count:', state.reservations.length);

    // If data is fresh and no force refresh, return immediately
    if (state.isDataFresh && !forceRefresh) {
      console.log('Data is fresh, skipping refresh');
      return;
    }

    const now = Date.now();

    // Set loading state
    dispatch({ type: 'SET_LOADING', payload: true });
    console.log('Setting loading state to true');

    try {
      // Fetch rooms and dispatch to state
      const roomResult = await fetchRoomsFromSupabase();
      if (roomResult.data && Array.isArray(roomResult.data)) {
        console.log(`Dispatching ${roomResult.data.length} rooms to state`);
        dispatch({ type: 'SET_ROOMS', payload: roomResult.data });
      } else if (roomResult.error) {
        console.error('Error fetching rooms:', roomResult.error);
        dispatch({ type: 'SET_ERROR', payload: formatError(roomResult.error) });
      }

      // Also fetch reservations
      try {
        // The service answers { data, error }, not a bare array
        const reservationsResult = await getReservations();
        if (reservationsResult?.error) throw reservationsResult.error;
        const reservationsData = Array.isArray(reservationsResult) ? reservationsResult : reservationsResult?.data;
        if (reservationsData && Array.isArray(reservationsData)) {
          console.log(`Dispatching ${reservationsData.length} reservations to state`);
          dispatch({ type: 'SET_RESERVATIONS', payload: reservationsData });
        }
      } catch (reservationsError) {
        console.error('Error fetching reservations:', reservationsError);
        // Don't set error state for reservations failure, just log it
      }

      // Heal rooms whose status no longer matches any guest / reservation
      await reconcileRoomStatuses();
    } catch (error) {
      console.error('Error during refresh:', error);
      dispatch({ type: 'SET_ERROR', payload: formatError(error) });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
      dispatch({ type: 'SET_LAST_FETCH_TIME', payload: now });
    }
  }, [state.isDataFresh, state.rooms.length, state.reservations.length, reconcileRoomStatuses]);

  // Modified getRooms function
  const fetchRoomsFromSupabase = async () => {
    try {
      console.log('Fetching rooms from Supabase...');

      // First check if connection to Supabase is working
      try {
        const { data: connectionTest, error: connectionError } = await supabase
          .from('rooms')
          .select('count')
          .limit(1);

        if (connectionError) {
          console.error('Supabase connection test failed:', connectionError);
          throw new Error(`Connection to Supabase failed: ${connectionError.message}`);
        }

        console.log('Supabase connection test successful');
      } catch (connectionTestError) {
        console.error('Error testing Supabase connection:', connectionTestError);
      }

      // Now fetch the actual room data
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .order('id');

      if (error) {
        console.error('Error fetching rooms:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw error;
      }

      if (!data || !Array.isArray(data)) {
        console.error('Invalid room data received:', data);
        return { data: [], error: new Error('Invalid room data format received') };
      }

      console.log(`Successfully fetched ${data.length} rooms`);

      // Log a sample of the data (first room) for debugging
      if (data.length > 0) {
        console.log('Sample room data:', JSON.stringify(data[0], null, 2));
      }

      return { data, error: null };
    } catch (error) {
      console.error('Exception fetching rooms:', error);
      console.error('Error stack:', error.stack);
      return { data: [], error };
    }
  };

  // Room operations
  const checkInGuest = async (roomId, guestData) => {
    try {
      // First update local state
      dispatch({
        type: 'UPDATE_ROOM_STATUS',
        payload: { roomId, status: 'Occupied' }
      });

      // Update room status in database
      const roomUpdateResult = await supabase
        .from('rooms')
        .update({
          status: 'Occupied',
          guest: guestData.name,
          updated_at: new Date().toISOString()
        })
        .eq('id', roomId);

      if (roomUpdateResult.error) {
        throw roomUpdateResult.error;
      }

      return { success: true };
    } catch (error) {
      console.error('Error during check-in:', error);
      return { success: false, error: error.message };
    }
  };

  // Guest check-out operation
  const checkOutGuest = async (roomId) => {
    try {
      // Update local state first
      dispatch({
        type: 'UPDATE_ROOM_STATUS',
        payload: { roomId, status: 'Available' }
      });

      // Persist the room status even when no reservation row exists (check-in removes it)
      const { error: roomError } = await supabase
        .from('rooms')
        .update({ status: 'Available', updated_at: new Date().toISOString() })
        .eq('id', roomId);
      if (roomError) throw roomError;

      await supabase
        .from('guests')
        .update({ status: 'Checked Out', updated_at: new Date().toISOString() })
        .eq('room', String(roomId))
        .eq('status', 'Checked In');

      // Find the active reservation for this room
      const activeReservation = state.reservations.find(
        res => res.room_id === roomId && res.status === 'Checked In'
      );

      if (activeReservation) {
        // Update local state
        const updatedReservation = {
          ...activeReservation,
          status: 'Checked Out',
          updated_at: new Date().toISOString()
        };

        dispatch({
          type: 'UPDATE_RESERVATION',
          payload: updatedReservation
        });

        // Update room status in database
        const roomUpdateResult = await supabase
          .from('rooms')
          .update({ status: 'Available', updated_at: new Date().toISOString() })
          .eq('id', roomId);

        if (roomUpdateResult.error) {
          throw roomUpdateResult.error;
        }

        // Update reservation in database
        const { error } = await updateReservationService(
          activeReservation.id,
          {
            status: 'Checked Out',
            updated_at: new Date().toISOString()
          }
        );

        if (error) {
          throw error;
        }

        sendSmsNotification('checked_out', activeReservation.guest_phone, reservationSmsData(activeReservation));
      }

      return { success: true };
    } catch (error) {
      console.error('Error checking out guest:', error);
      return { success: false, error: error.message };
    }
  };

  // Create a reservation without check-in
  const createReservation = async (roomId, reservationDetails) => {
    try {
      // Log the incoming reservation details for debugging
      console.log('Creating reservation with details:', reservationDetails);
      console.log('Room ID:', roomId);

      const selectedRoom = state.rooms.find(room => String(room.id) === String(roomId));
      if (!selectedRoom) {
        return { success: false, error: 'Selected room could not be found.' };
      }

      const availability = await validateRoomAvailability(
        roomId,
        reservationDetails.checkInDate,
        reservationDetails.checkOutDate
      );
      if (availability.error) {
        return { success: false, error: availability.error.message };
      }

      // Update local state for room status
      dispatch({
        type: 'UPDATE_ROOM_STATUS',
        payload: { roomId, status: 'Reserved' }
      });

      // Prepare reservation data with consistent field names for database
      const reservationData = {
        room_id: roomId,
        room_number: selectedRoom.room_number,
        room_type: selectedRoom.type,
        guest_name: reservationDetails.guestName || '',
        guest_email: reservationDetails.email || '',
        guest_phone: reservationDetails.phoneNumber || '',
        check_in_date: reservationDetails.checkInDate || new Date().toISOString(),
        check_out_date: reservationDetails.checkOutDate || new Date().toISOString(),
        status: 'Reserved',
        special_requests: reservationDetails.specialRequests || '',
        payment_method: reservationDetails.paymentMethod || 'Credit Card',
        payment_status: 'Pending',
        adults: reservationDetails.adults || 1,
        children: reservationDetails.children || 0,
        room_price: reservationDetails.roomPrice || selectedRoom.price || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Generate a local temporary ID
      const tempId = 'local-' + Date.now();
      const newReservation = { id: tempId, ...reservationData };

      // Log the processed reservation data
      console.log('Processed reservation data for Supabase:', reservationData);

      // Update local state with new reservation
      dispatch({ type: 'ADD_RESERVATION', payload: newReservation });

      // Update room status in database
      console.log('Updating room status in Supabase:', { roomId, status: 'Reserved' });
      const roomUpdateResult = await supabase
        .from('rooms')
        .update({ status: 'Reserved', updated_at: new Date().toISOString() })
        .eq('id', roomId);

      if (roomUpdateResult.error) {
        console.error('Error updating room status in Supabase:', roomUpdateResult.error);
        throw roomUpdateResult.error;
      }

      // Create reservation in database
      console.log('Sending reservation data to createReservationService:', reservationData);
      const { data, error } = await createReservationService(reservationData);

      if (error) {
        console.error('Error returned from createReservationService:', error);
        throw error;
      }

      console.log('Reservation successfully created in Supabase:', data);

      // Update the local reservation with the real ID
      dispatch({ type: 'UPDATE_RESERVATION', payload: { ...newReservation, id: data.id } });

      sendSmsNotification('reservation_created', reservationData.guest_phone, reservationSmsData(reservationData));

      return { success: true, data };
    } catch (error) {
      console.error('Error creating reservation:', error);
      console.error('Error stack:', error.stack);
      return { success: false, error: friendlyReservationError(error) };
    }
  };

  // Cancel a reservation
  const cancelReservation = async (reservationId, reason = 'Cancelled by staff', fee = 0) => {
    try {
      // Find the reservation
      const reservation = state.reservations.find(r => r.id === reservationId);
      if (!reservation) {
        return {
          success: false,
          error: `Reservation with ID ${reservationId} not found`
        };
      }

      const roomNumber = reservation.room_id;

      const { error } = await cancelReservationWithPolicy(reservation, reason, fee);
      if (error) throw error;

      // Update local state after successful database operations
      dispatch({
        type: 'UPDATE_ROOM_STATUS',
        payload: { roomId: roomNumber, status: 'Available' }
      });

      dispatch({
        type: 'UPDATE_RESERVATION',
        payload: {
          ...reservation,
          status: 'Cancelled',
          cancellation_reason: reason,
          cancellation_fee: fee,
          cancelled_at: new Date().toISOString()
        }
      });

      sendSmsNotification('reservation_cancelled', reservation.guest_phone, reservationSmsData(reservation, { fee }));

      return { success: true };
    } catch (error) {
      console.error('Error canceling reservation:', error);
      return {
        success: false,
        error: formatError(error) || 'Unknown error occurred'
      };
    }
  };

  // Mark a reservation as a no-show and release its room.
  const markNoShow = async (reservation) => {
    const result = await markReservationNoShow(reservation);
    if (result.error) return { success: false, error: result.error.message };
    dispatch({ type: 'UPDATE_RESERVATION', payload: result.data });
    dispatch({ type: 'UPDATE_ROOM_STATUS', payload: { roomId: reservation.room_id, status: 'Available' } });
    sendSmsNotification('no_show', reservation.guest_phone, reservationSmsData(reservation));
    return { success: true, data: result.data };
  };

  // Reassign a reservation to a different room after rechecking date overlap.
  const reassignRoom = async (reservation, room) => {
    const result = await reassignReservation(reservation, room);
    if (result.error) return { success: false, error: result.error.message };
    dispatch({ type: 'UPDATE_RESERVATION', payload: result.data });
    dispatch({ type: 'UPDATE_ROOM_STATUS', payload: { roomId: reservation.room_id, status: 'Available' } });
    dispatch({ type: 'UPDATE_ROOM_STATUS', payload: { roomId: room.id, status: 'Reserved' } });
    sendSmsNotification('reservation_updated', reservation.guest_phone, {
      ...reservationSmsData(reservation),
      roomNumber: room.room_number || result.data?.room_number
    });
    return { success: true, data: result.data };
  };

  // Update a reservation
  const updateReservation = async (reservationData) => {
    try {
      // Re-check availability (excluding this reservation) when dates are being changed
      const existing = state.reservations.find(r => r.id === reservationData.id);
      const newCheckIn = reservationData.checkInDate || reservationData.check_in_date;
      const newCheckOut = reservationData.checkOutDate || reservationData.check_out_date;
      if (existing && newCheckIn && newCheckOut && ['Reserved', 'Confirmed'].includes(existing.status)) {
        const availability = await validateRoomAvailability(
          existing.room_id,
          String(newCheckIn).slice(0, 10),
          String(newCheckOut).slice(0, 10),
          existing.id
        );
        if (availability.error) {
          return { success: false, error: availability.error.message };
        }
      }

      // Update local state first
      dispatch({
        type: 'UPDATE_RESERVATION',
        payload: reservationData
      });

      // Update reservation status in database
      const { error } = await updateReservationService(
        reservationData.id,
        {
          guest_name: reservationData.guestName,
          guest_email: reservationData.email,
          guest_phone: reservationData.phoneNumber,
          room_price: reservationData.roomPrice || reservationData.room_rate || 0,
          room_number: reservationData.roomNumber,
          check_in_date: reservationData.checkInDate,
          check_out_date: reservationData.checkOutDate,
          adults: reservationData.adults,
          children: reservationData.children,
          special_requests: reservationData.specialRequests,
          payment_method: reservationData.paymentMethod,
          status: reservationData.status,
          updated_at: new Date().toISOString()
        }
      );

      if (error) {
        throw error;
      }

      // Cancelling / checking out / moving a reservation must release its room
      await reconcileRoomStatuses();

      sendSmsNotification('reservation_updated', reservationData.phoneNumber || reservationData.guest_phone, {
        guestName: reservationData.guestName || reservationData.guest_name,
        roomNumber: reservationData.roomNumber || reservationData.room_number,
        checkInDate: reservationData.checkInDate || reservationData.check_in_date,
        checkOutDate: reservationData.checkOutDate || reservationData.check_out_date,
        roomRate: reservationData.roomPrice || reservationData.room_rate
      });

      return { success: true };
    } catch (error) {
      console.error('Error updating reservation:', error);
      return { success: false, error: friendlyReservationError(error) };
    }
  };



  // Get all rooms with improved error handling
  const getRooms = (filterBy = null, sortBy = null) => {
    console.log('getRooms called with filters:', filterBy, 'sort:', sortBy);
    console.log('Current rooms state:', state.rooms?.length || 0, 'rooms');

    // Safety check - if rooms is not an array, log error and return empty array
    if (!state.rooms) {
      console.warn('state.rooms is undefined or null');
      // Don't trigger refresh from getRooms to avoid infinite loops
      return [];
    }

    if (!Array.isArray(state.rooms)) {
      console.error('state.rooms is not an array:', typeof state.rooms, state.rooms);
      return [];
    }

    // Create a safe copy of the rooms array, filtering out any invalid room objects
    let filteredRooms = state.rooms
      .filter(room => room && typeof room === 'object')
      .map(room => ({ ...room })); // Create a shallow copy of each room

    console.log(`Starting with ${filteredRooms.length} valid rooms`);

    // Apply filters if provided
    if (filterBy) {
      // Filter by status
      if (filterBy.status) {
        filteredRooms = filteredRooms.filter(room => room.status === filterBy.status);
        console.log(`After status filter (${filterBy.status}): ${filteredRooms.length} rooms`);
      }

      // Filter by type
      if (filterBy.type) {
        filteredRooms = filteredRooms.filter(room => room.type === filterBy.type);
        console.log(`After type filter (${filterBy.type}): ${filteredRooms.length} rooms`);
      }

      // Filter by search term
      if (filterBy.searchTerm) {
        const searchLower = filterBy.searchTerm.toLowerCase();
        filteredRooms = filteredRooms.filter(room => {
          // Safely check each field
          const roomNumber = room.room_number ? String(room.room_number).toLowerCase() : '';
          const name = room.name ? String(room.name).toLowerCase() : '';
          const type = room.type ? String(room.type).toLowerCase() : '';

          return roomNumber.includes(searchLower) ||
            name.includes(searchLower) ||
            type.includes(searchLower);
        });
        console.log(`After search filter (${filterBy.searchTerm}): ${filteredRooms.length} rooms`);
      }
    }

    // Apply sorting if provided
    if (sortBy && sortBy.field) {
      try {
        filteredRooms.sort((a, b) => {
          // Safely get values, defaulting to empty string or 0
          let aValue = a[sortBy.field];
          let bValue = b[sortBy.field];

          // Handle missing values
          if (aValue === undefined || aValue === null) aValue = '';
          if (bValue === undefined || bValue === null) bValue = '';

          // Sort strings and numbers differently
          if (typeof aValue === 'string' || typeof bValue === 'string') {
            // Convert both to strings for consistent comparison
            aValue = String(aValue);
            bValue = String(bValue);

            return sortBy.direction === 'asc'
              ? aValue.localeCompare(bValue)
              : bValue.localeCompare(aValue);
          } else {
            // Numeric sort
            return sortBy.direction === 'asc'
              ? aValue - bValue
              : bValue - aValue;
          }
        });
        console.log(`Sorted rooms by ${sortBy.field} (${sortBy.direction})`);
      } catch (error) {
        console.error('Error sorting rooms:', error);
        // Continue with unsorted rooms if there's an error
      }
    }

    console.log(`Returning ${filteredRooms.length} rooms after filtering and sorting`);
    return filteredRooms;
  };

  // Get room by id
  const getRoomById = (roomId) => {
    return state.rooms.find(room => room.id === roomId);
  };

  // Get reservation by id
  const getReservationById = (reservationId) => {
    return state.reservations.find(res => res.id === reservationId);
  };

  // Get reservations for a room
  const getReservationsForRoom = (roomId) => {
    return state.reservations.filter(res => res.room_id === roomId);
  };

  // Get active reservation for a room
  const getActiveReservationForRoom = (roomId) => {
    return state.reservations.find(
      res => res.room_id === roomId &&
        (res.status === 'Reserved' || res.status === 'Checked In')
    );
  };

  // Update room status
  const updateRoomStatus = async (roomId, status) => {
    try {
      console.log(`Updating room ${roomId} status to ${status}`);

      // Update local state first
      dispatch({ type: 'UPDATE_ROOM_STATUS', payload: { roomId, status } });

      // Update in Supabase
      const { error } = await supabase
        .from('rooms')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', roomId);

      if (error) {
        console.error('Error updating room status in Supabase:', error);
        // Revert local state on error
        dispatch({ type: 'UPDATE_ROOM_STATUS', payload: { roomId, status: 'Available' } });
        throw error;
      }

      console.log(`Room ${roomId} status updated to ${status} successfully`);
      return { success: true };
    } catch (error) {
      console.error('Exception updating room status:', error);
      throw error;
    }
  };

  // Update revenue stats
  const updateRevenueStats = (amount, reset = false) => {
    if (reset) {
      // If reset is true, set revenue directly to the amount
      dispatch({ type: 'SET_REVENUE', payload: amount });
    } else {
      // Otherwise add to existing revenue
      dispatch({ type: 'UPDATE_REVENUE', payload: amount });
    }
  };

  const { loading: userLoading } = useUser();

  // Offline changes have just been uploaded (or rejected): reload so the screen shows the server's truth
  useEffect(() => {
    const onSynced = () => refreshData(true);
    window.addEventListener('hms-data-synced', onSynced);
    return () => window.removeEventListener('hms-data-synced', onSynced);
  }, [refreshData]);

  // Load initial data and set up real-time subscriptions
  useEffect(() => {
    // Wait for user to be loaded
    if (userLoading) return;

    refreshData();

    // Set up real-time subscription
    try {
      const roomsSubscription = supabase
        .channel('rooms-channel')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'rooms'
        }, () => {
          console.log('Room data changed, refreshing...');
          refreshData();
        })
        .subscribe();

      const reservationsSubscription = supabase
        .channel('reservations-channel')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'reservations'
        }, () => {
          console.log('Reservation data changed, refreshing...');
          refreshData();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(roomsSubscription);
        supabase.removeChannel(reservationsSubscription);
      };
    } catch (err) {
      console.error('Error setting up real-time subscriptions:', err);
    }
  }, [refreshData, userLoading]);

  // Create a memoized value object to prevent unnecessary re-renders
  const value = useMemo(() => ({
    rooms: state.rooms,
    reservations: state.reservations,
    loading: state.loading,
    error: state.error,
    revenue: state.revenue,
    refreshData,
    checkInGuest,
    checkOutGuest,
    createReservation,
    cancelReservation,
    updateReservation,
    updateRoomStatus,
    getRooms,
    getRoomById,
    getReservationById,
    getReservationsForRoom,
    getActiveReservationForRoom,
    updateRevenueStats,
    markNoShow,
    reassignRoom,
    reconcileRoomStatuses,
    testDatabaseConnection
  }), [
    state.rooms,
    state.reservations,
    state.loading,
    state.error,
    state.revenue,
    refreshData,
    checkInGuest,
    checkOutGuest,
    createReservation,
    cancelReservation,
    updateReservation,
    getRooms,
    getRoomById,
    getReservationById,
    getReservationsForRoom,
    getActiveReservationForRoom,
    markNoShow,
    reassignRoom,
    reconcileRoomStatuses,
    getReservations,
    updateRoomStatus,
    updateRevenueStats
  ]);

  return (
    <RoomReservationContext.Provider value={value}>
      {children}
    </RoomReservationContext.Provider>
  );
};

export const useRoomReservation = () => useContext(RoomReservationContext);
