import React, { useState, useEffect, useRef, useContext, useMemo, useCallback } from 'react';
import * as echarts from 'echarts';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { useNavigate } from 'react-router-dom';
import OverviewWidget from './OverviewWidget';
import CheckInModal from './CheckInModal';
import { useGuests } from '../context/GuestContext';
import { useUser } from '../context/UserContext';
import DashboardLayout from './DashboardLayout';
import { useTheme } from '../context/ThemeContext';
import RoomTooltip from './RoomTooltip';
import RoomContextMenu from './RoomContextMenu';
import { useRoomReservation } from '../context/RoomReservationContext';
import supabase from '../supabaseClient';
import { format, isToday, parseISO } from 'date-fns';
import { StepModal, Step, Field, DateInput, ReviewList } from './ui/StepModal';
import '../styles/Dashboard.css';
import CheckoutSettlementModal from './CheckoutSettlementModal';

const toNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const num = parseFloat(value);
    return Number.isFinite(num) ? num : 0;
  }
  return 0;
};

const pickFirstPositive = (...values) => {
  for (const value of values) {
    const num = toNumber(value);
    if (num > 0) {
      return num;
    }
  }
  return 0;
};

const getInvoiceTotal = (invoice = {}) => {
  if (!invoice) return 0;
  const amount = pickFirstPositive(invoice.amount, invoice.total_amount, invoice.totalAmount);
  if (amount > 0) return amount;

  const roomTotal = pickFirstPositive(invoice.room_total, invoice.roomTotal);
  const serviceTotal = pickFirstPositive(invoice.service_total, invoice.serviceTotal);
  const nights = toNumber(invoice.nights);
  const roomRate = pickFirstPositive(invoice.room_rate, invoice.roomRate);
  const fallbackRoom = roomTotal > 0 ? roomTotal : Math.max(0, nights * roomRate);
  const combined = fallbackRoom + serviceTotal;
  return combined > 0 ? combined : 0;
};

const buildLastSevenDays = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dates = [];
  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - offset);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
};

const aggregateRevenueStreams = async () => {
  const [invoicesResult, ordersResult, poolResult] = await Promise.all([
    supabase.from('invoices').select('*'),
    supabase.from('restaurant_orders').select('total_amount, status, payment_status, created_at'),
    supabase.from('pool_visits').select('amount, created_at')
  ]);

  if (invoicesResult.error) throw invoicesResult.error;
  if (ordersResult.error) throw ordersResult.error;
  if (poolResult.error) throw poolResult.error;

  // 1. Room Revenue
  const paidInvoices = (invoicesResult.data || []).filter(invoice => (invoice.status || '').toLowerCase() === 'paid');
  const roomRevenue = paidInvoices.reduce((sum, invoice) => sum + getInvoiceTotal(invoice), 0);

  // 2. Restaurant Revenue
  const relevantOrders = (ordersResult.data || []).filter(order => {
    const status = (order.status || '').toLowerCase();
    const paymentStatus = (order.payment_status || '').toLowerCase();
    return ['completed', 'delivered'].includes(status) || paymentStatus === 'paid';
  });
  const barRestaurantRevenue = relevantOrders.reduce((sum, order) => sum + toNumber(order.total_amount), 0);

  // 3. Pool Revenue
  const poolRevenue = (poolResult.data || []).reduce((sum, visit) => sum + toNumber(visit.amount), 0);

  // 4. Total Revenue
  const total = roomRevenue + barRestaurantRevenue + poolRevenue;

  // Daily Series Calculation (including Pool)
  const lastSevenDays = buildLastSevenDays();
  const dailyMap = new Map(lastSevenDays.map(date => [date, 0]));

  const addToDailyMap = (dateStr, amount) => {
    if (!dateStr) return;
    const dateKey = dateStr.split('T')[0];
    if (dailyMap.has(dateKey)) {
      dailyMap.set(dateKey, dailyMap.get(dateKey) + amount);
    }
  };

  paidInvoices.forEach(invoice => addToDailyMap(invoice.created_at, getInvoiceTotal(invoice)));
  relevantOrders.forEach(order => addToDailyMap(order.created_at, toNumber(order.total_amount)));
  (poolResult.data || []).forEach(visit => addToDailyMap(visit.created_at, toNumber(visit.amount)));

  const dailySeries = lastSevenDays.map(dateIso => ({
    iso: dateIso,
    label: format(parseISO(dateIso), 'EEE'),
    value: dailyMap.get(dateIso) || 0
  }));

  return {
    roomRevenue,
    barRestaurantRevenue,
    poolRevenue,
    total,
    dailySeries
  };
};

// Room Check-in Modal Component
const RoomCheckInModal = ({ isOpen, onClose, onCheckIn, roomId }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const toDate = (str) => parseISO(str);
  const toStr = (date) => format(date, 'yyyy-MM-dd');
  const [step, setStep] = useState(0);
  const [guestName, setGuestName] = useState('');
  const [nameError, setNameError] = useState('');
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split('T')[0]);

  // Calculate default checkout date
  const defaultCheckOut = new Date();
  defaultCheckOut.setDate(defaultCheckOut.getDate() + 1);
  const [checkOutDate, setCheckOutDate] = useState(defaultCheckOut.toISOString().split('T')[0]);

  // Start every check-in from a clean form
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setGuestName('');
      setNameError('');
    }
  }, [isOpen]);

  const handleCheckInChange = (date) => {
    if (!date) return;
    const next = toStr(date);
    setCheckInDate(next);
    if (checkOutDate <= next) setCheckOutDate(toStr(new Date(date.getTime() + 86400000)));
  };

  const nights = Math.max(1, Math.round((toDate(checkOutDate) - toDate(checkInDate)) / 86400000) || 1);
  const fmt = (str) => toDate(str).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  const goNext = () => {
    if (!guestName.trim()) {
      setNameError('Guest name is required');
      return;
    }
    setNameError('');
    setStep(1);
  };

  const submit = () => {
    if (!guestName.trim()) {
      setStep(0);
      setNameError('Guest name is required');
      return;
    }
    onCheckIn(roomId, guestName, checkInDate, checkOutDate);
    onClose();
  };

  return (
    <StepModal
      isOpen={isOpen}
      onClose={onClose}
      isDarkMode={isDarkMode}
      title={`Check in · Room ${roomId}`}
      steps={['Guest', 'Stay & confirm']}
      current={step}
      recap={[
        { label: 'Room', value: `Room ${roomId}` },
        guestName.trim() && { label: 'Guest', value: guestName.trim() }
      ].filter(Boolean)}
      onBack={() => setStep(0)}
      onNext={step === 0 ? goNext : submit}
      nextLabel={step === 0 ? 'Continue' : 'Check in'}
      finalStep={step === 1}
    >
      {step === 0 ? (
        <Step title="Guest details" lead={`Who is checking in to Room ${roomId}?`}>
          <div className="sm-grid">
            <Field label="Full name" error={nameError} span>
              <input className="sm-input" type="text" value={guestName} onChange={(e) => { setGuestName(e.target.value); setNameError(''); }} placeholder="Enter guest name" autoComplete="off" autoFocus />
            </Field>
          </div>
        </Step>
      ) : (
        <Step title="Stay & confirm" lead="Set the dates and confirm the check-in.">
          <div className="sm-grid" style={{ marginBottom: 24 }}>
            <Field label="Check-in">
              <DateInput selected={toDate(checkInDate)} onChange={handleCheckInChange} />
            </Field>
            <Field label="Check-out">
              <DateInput selected={toDate(checkOutDate)} onChange={(date) => date && setCheckOutDate(toStr(date))} minDate={new Date(toDate(checkInDate).getTime() + 86400000)} />
            </Field>
          </div>
          <ReviewList rows={[
            ['Guest', guestName.trim()],
            ['Room', `Room ${roomId}`],
            ['Dates', `${fmt(checkInDate)} – ${fmt(checkOutDate)} (${nights} night${nights !== 1 ? 's' : ''})`]
          ]} />
        </Step>
      )}
    </StepModal>
  );
};

const Dashboard = () => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const { rooms: contextRooms, loading: roomsLoading, error: roomsError, getRooms, revenue, updateRoomStatus, refreshData, checkOutGuest } = useRoomReservation();
  const { guestList, addGuestToList } = useGuests();
  const navigate = useNavigate();
  const dashboardRef = useRef(null);
  const revenueChartRef = useRef(null);
  const taskChartRef = useRef(null);
  const occRateChartRef = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [totalGuests, setTotalGuests] = useState(0);
  const [rooms, setRooms] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revenueData, setRevenueData] = useState({ dates: [], values: [] });
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [stats, setStats] = useState({
    availableRooms: 0,
    occupiedRooms: 0,
    reservedRooms: 0,
    totalRevenue: 0,
    roomRevenue: 0,
    barRestaurantRevenue: 0,
    poolRevenue: 0
  });
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [isCheckInModalOpen, setIsCheckInModalOpen] = useState(false);
  const [settlementRoomId, setSettlementRoomId] = useState(null);
  const [hoveredRoom, setHoveredRoom] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const [showTooltip, setShowTooltip] = useState(false);
  const [todaysCheckIns, setTodaysCheckIns] = useState([]);
  const [recentReservations, setRecentReservations] = useState([]);
  const [restaurantStats, setRestaurantStats] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    avgOrderValue: 0,
    popularItems: []
  });
  const [restaurantDateRange, setRestaurantDateRange] = useState('all'); // 'today', 'week', 'month', 'all'

  // Stats calculation with defensive coding - use contextRooms as primary source
  const activeRooms = contextRooms && contextRooms.length > 0 ? contextRooms : rooms;
  const totalRooms = activeRooms?.length || 0;
  const availableRooms = activeRooms?.filter(room => room.status === 'Available').length || 0;
  const occupiedRooms = activeRooms?.filter(room => room.status === 'Occupied').length || 0;
  const reservedRooms = activeRooms?.filter(room => room.status === 'Reserved').length || 0;
  const maintenanceRooms = activeRooms?.filter(room => room.status === 'Maintenance').length || 0;
  const cleaningRooms = activeRooms?.filter(room => room.status === 'Cleaning').length || 0;

  // Calculate occupancy rate including both occupied and reserved rooms
  const occupancyRate = totalRooms > 0
    ? Math.round(((occupiedRooms + reservedRooms) / totalRooms) * 100)
    : 0;

  // Calculate total guests (occupied + reserved rooms) with defensive coding
  const calculateTotalGuests = () => {
    if (Array.isArray(activeRooms)) {
      const totalGuests = activeRooms.filter(room => room && room.guest).length;
      setTotalGuests(totalGuests);
    }
  };

  // Dynamic notifications
  const [notificationCount, setNotificationCount] = useState(0);

  // Fetch tasks from Supabase
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const { data, error } = await supabase
          .from('tasks')
          .select('*')
          .eq('status', 'Pending')
          .order('priority', { ascending: false })
          .limit(5);

        if (error) {
          console.error('Error fetching tasks:', error);
          console.warn('Failed to fetch tasks from database');
        } else if (data) {
          setTasks(data);
        }
      } catch (err) {
        console.error('Unexpected error fetching tasks:', err);
        console.warn('Failed to fetch tasks from database');
      }
    };

    fetchTasks();
  }, []);

  // Initialize notifications
  useEffect(() => {
    // In a full version, notifications would be fetched from the database
    setNotifications([]);
  }, []);

  // Create a notification refresh function


  // Initialize notifications
  useEffect(() => {
    // In the online-only system, notifications are managed in real-time
    // No need for periodic refreshing
  }, []);

  // Create a helper function to add notifications (can be used throughout the app)
  const addNotification = (title, message, type = 'info') => {
    try {
      // Add new notification
      const newNotification = {
        title,
        message,
        type,
        timestamp: new Date().toISOString()
      };

      // Update notifications state
      setNotifications(prev => [newNotification, ...prev].slice(0, 5));
    } catch (e) {
      console.error('Error adding notification:', e);
    }
  };

  // Listen for notification updates from other components
  useEffect(() => {
    const handleNotificationUpdate = (event) => {
      if (event.detail && event.detail.notifications) {
        setNotifications(event.detail.notifications.slice(0, 5));
      }
    };

    document.addEventListener('hotelNotificationUpdate', handleNotificationUpdate);

    // Clean up
    return () => {
      document.removeEventListener('hotelNotificationUpdate', handleNotificationUpdate);
    };
  }, []);

  // Update rooms when context rooms change
  useEffect(() => {
    if (contextRooms && Array.isArray(contextRooms)) {
      console.log(`Dashboard received ${contextRooms.length} rooms from context`);
      // Process the rooms to ensure rooms with guests are marked as Occupied
      const processedData = contextRooms.map(room => {
        // If a room has a guest, it should always be marked as Occupied regardless of database status
        if (room.guest) {
          return { ...room, status: 'Occupied' };
        }
        return room;
      });

      setRooms(processedData);
    }
  }, [contextRooms]);

  // Fetch rooms and set up event listeners
  const fetchRoomData = async () => {
    console.log("Fetching room data for dashboard");
    try {
      setLoading(true);
      // Use refreshData from context instead of local getRooms
      await refreshData(true);
    } catch (error) {
      console.error('Error fetching rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Set up revenue update listener
    const handleRevenueUpdate = (event) => {
      console.log('Dashboard received revenue update event:', event.detail);
      if (event.detail) {
        // Update total revenue if available
        if (typeof event.detail.totalRevenue === 'number') {
          setTotalRevenue(event.detail.totalRevenue);
        }

        // Update revenue chart data if available
        if (event.detail.revenueData) {
          setRevenueData(event.detail.revenueData);
        }
      }
    };

    // Listen for room status updates from ReservationsList and other components
    const handleRoomStatusUpdate = (event) => {
      console.log('Dashboard received room status update:', event.detail);
      if (event.detail && event.detail.roomId && event.detail.status) {
        if (event.detail.forceRefresh) {
          // Force a full refresh of room data from database
          console.log('Forcing refresh of room data from database');
          fetchRoomData();
        } else {
          // Just update the local state
          setRooms(prevRooms =>
            prevRooms.map(room => {
              if (room.id === event.detail.roomId) {
                // If status is Available, always clear the guest
                if (event.detail.status === 'Available') {
                  return { ...room, status: 'Available', guest: null };
                }
                // If room has a guest but status update is something other than Occupied/Available
                if (room.guest && event.detail.status !== 'Occupied' && event.detail.status !== 'Available') {
                  console.warn(`Room ${room.id} has a guest (${room.guest}) but status update is ${event.detail.status}. Setting to "Occupied" for consistency.`);
                  return { ...room, status: 'Occupied' };
                }
                // Normal status update
                return { ...room, status: event.detail.status };
              }
              return room;
            })
          );
        }
      }
    };

    // Listen for guest check-ins from any component
    const handleGuestCheckIn = (event) => {
      console.log('Dashboard received guest check-in event:', event.detail);
      if (event.detail && event.detail.roomId && event.detail.guestName) {
        if (event.detail.forceRefresh) {
          // Force a full refresh of room data from database
          console.log('Forcing refresh of room data from database due to check-in');
          fetchRoomData();
        } else {
          // Always update room status to "Occupied" when a guest checks in
          // regardless of what the event.detail.status might be
          setRooms(prevRooms =>
            prevRooms.map(room =>
              room.id === event.detail.roomId
                ? {
                  ...room,
                  status: 'Occupied',
                  guest: event.detail.guestName
                }
                : room
            )
          );
        }

        // Add notification
        addNotification(
          'Guest Checked In',
          `${event.detail.guestName} has checked into Room ${event.detail.roomId}`,
          'success'
        );
      }
    };

    // Listen for occupancy updates
    const handleOccupancyUpdate = (event) => {
      console.log('Dashboard received occupancy update:', event.detail);
      if (event.detail && event.detail.roomId && event.detail.status) {
        if (event.detail.forceRefresh) {
          // Force a full refresh of room data from database
          console.log('Forcing refresh of room data from database due to occupancy update');
          fetchRoomData();
        } else {
          // Handle status updates
          if (event.detail.status === 'Available') {
            // For Available status, always clear guest info
            setRooms(prevRooms =>
              prevRooms.map(room =>
                room.id === event.detail.roomId
                  ? {
                    ...room,
                    status: 'Available',
                    guest: null,
                    reservation: null
                  }
                  : room
              )
            );
          } else {
            // For other statuses
            // Always set the room as "Occupied" if there's a guest name
            const newStatus = event.detail.guestName ? 'Occupied' : event.detail.status;

            setRooms(prevRooms =>
              prevRooms.map(room =>
                room.id === event.detail.roomId
                  ? {
                    ...room,
                    status: newStatus,
                    guest: event.detail.guestName || room.guest || null
                  }
                  : room
              )
            );

            // If there's a guest name but the status isn't "Occupied", log a warning
            if (event.detail.guestName && event.detail.status !== 'Occupied') {
              console.warn(`Room ${event.detail.roomId} has a guest (${event.detail.guestName}) but status is ${event.detail.status}. Setting to "Occupied" for consistency.`);
            }
          }
        }
      }
    };

    // Perform initial data fetch
    fetchRoomData();

    calculateTotalRevenue();

    // Set up poll for room status updates
    const pollInterval = setInterval(() => {
      fetchRoomData();
    }, 60000); // Poll every minute

    document.addEventListener('hotelRevenueUpdate', handleRevenueUpdate);
    document.addEventListener('hotelRoomStatusUpdate', handleRoomStatusUpdate);
    document.addEventListener('hotelGuestCheckIn', handleGuestCheckIn);
    document.addEventListener('hotelOccupancyUpdate', handleOccupancyUpdate);

    return () => {
      document.removeEventListener('hotelRevenueUpdate', handleRevenueUpdate);
      document.removeEventListener('hotelRoomStatusUpdate', handleRoomStatusUpdate);
      document.removeEventListener('hotelGuestCheckIn', handleGuestCheckIn);
      document.removeEventListener('hotelOccupancyUpdate', handleOccupancyUpdate);
      clearInterval(pollInterval);
    };
  }, []);

  // Load rooms and reservations
  useEffect(() => {
    console.log('Dashboard component: Loading rooms and reservations...');
    const loadedRooms = getRooms() || [];
    setRooms(loadedRooms);

    // Get reservations from Supabase directly since not available in context
    const loadReservations = async () => {
      try {
        const { data, error } = await supabase
          .from('reservations')
          .select('*');
        if (!error && data) {
          setReservations(data);
        } else {
          console.error('Error fetching reservations:', error);
          // Handle error gracefully
          setReservations([]);
        }
      } catch (err) {
        console.error('Error fetching reservations:', err);
        // Handle error gracefully
        setReservations([]);
      }
    };
    loadReservations();

    console.log(`Loaded ${loadedRooms.length} rooms and ${reservations ? reservations.length : 0} reservations`);
  }, [getRooms]);

  // Calculate total revenue from invoices
  const calculateTotalRevenue = async () => {
    try {
      console.log('Calculating total revenue from room and restaurant streams...');
      const revenueStreams = await aggregateRevenueStreams();
      console.log(`Calculated total revenue: GH₵${revenueStreams.total.toFixed(2)}`);
      setTotalRevenue(revenueStreams.total);
    } catch (error) {
      console.error('Error calculating total revenue:', error);
    }
  };

  // Load data on component mount
  useEffect(() => {
    // Load rooms, revenue data, etc.
    const loadDashboardData = async () => {
      try {
        console.log('Dashboard component: Loading data...');

        // Load rooms
        const loadedRooms = getRooms() || [];
        setRooms(loadedRooms);

        // Get reservations from Supabase directly since not available in context
        try {
          const { data, error } = await supabase.from('reservations').select('*');
          if (!error && data) {
            setReservations(data);
            console.log(`Loaded ${data.length} reservations from Supabase`);
          } else {
            console.error('Error fetching reservations:', error);
            // Handle error gracefully
            setReservations([]);
          }
        } catch (err) {
          console.error('Error in Supabase query:', err);
        }

        // Refresh combined revenue streams (rooms + restaurant)
        await fetchRevenueData();

      } catch (error) {
        console.error('Error loading dashboard data:', error);
      }
    };

    // Initial load
    loadDashboardData();

    // Set up polling to refresh data every 5 minutes
    const refreshInterval = setInterval(() => {
      fetchRevenueData();
    }, 300000); // 5 minutes

    return () => clearInterval(refreshInterval);
  }, []); // Empty dependency array to run only once on mount

  // Listen for revenue updates from the BillingPage component
  useEffect(() => {
    const handleRevenueUpdate = async (event) => {
      if (event.detail && event.detail.totalRevenue) {
        console.log('Received revenue update event:', event.detail.totalRevenue);
        setTotalRevenue(event.detail.totalRevenue);
      } else {
        // If no specific amount provided, recalculate from invoices
        await fetchRevenueData();
      }
    };

    document.addEventListener('hotelRevenueUpdate', handleRevenueUpdate);

    return () => {
      document.removeEventListener('hotelRevenueUpdate', handleRevenueUpdate);
    };
  }, []);

  // Function to handle check-in
  const handleCheckIn = async (guestData) => {
    try {
      console.log('Checking in guest:', guestData);
      
      // Add guest to database using GuestContext
      const result = await addGuestToList(guestData);
      
      if (result.success) {
        console.log('Guest checked in successfully:', result.data);
        // Room status is already updated by addGuestToList
        setIsCheckInModalOpen(false);
        
        // Refresh data to show updated room status
        await refreshData();
      } else {
        console.error('Failed to check in guest:', result.error);
        alert(`Failed to check in guest: ${result.error}`);
      }
    } catch (error) {
      console.error('Error during check-in:', error);
      alert(`Error during check-in: ${error.message}`);
    }
  };

  // Process a check-in request
  const processCheckIn = async (roomId, guestName, checkOutDate) => {
    try {
      const room = rooms.find(r => r.id === roomId);
      const roomName = room ? (room.name || room.room_number) : `Room ${roomId}`;
      console.log(`Processing check-in for ${roomName} with guest ${guestName}`);

      // Update room status in the database
      await updateRoomStatus(roomId, 'Occupied');

      // Update local state
      setRooms(rooms.map(room =>
        room.id === roomId
          ? { ...room, status: 'Occupied', guest: guestName }
          : room
      ));

      // Add notification
      addNotification(
        'New Check-In',
        `${guestName} has checked into ${roomName}`,
        'success'
      );

      setIsCheckInModalOpen(false);
    } catch (error) {
      console.error('Error during check-in:', error);
      addNotification('Check-In Failed', 'There was an error during check-in process', 'error');
    }
  };

  // Handle check-out
  const handleCheckOut = async (roomId) => {
    try {
      const room = rooms.find(r => r.id === roomId);
      if (!room) {
        console.error(`Room ${roomId} not found`);
        return;
      }

      const guestName = room.guest || 'Guest';
      const roomName = room.name || room.room_number || `Room ${roomId}`;

      // Update room status in database
      await updateRoomStatus(roomId, 'Available');

      // Dispatch events to ensure all UI components update
      // 1. General room status update
      const roomStatusEvent = new CustomEvent('hotelRoomStatusUpdate', {
        detail: {
          roomId: roomId,
          status: 'Available',
          forceRefresh: true
        }
      });
      document.dispatchEvent(roomStatusEvent);

      // Update local state
      setRooms(prevRooms =>
        prevRooms.map(room =>
          room.id === roomId
            ? { ...room, status: 'Available', guest: null }
            : room
        )
      );

      // Add notification
      addNotification(
        'Check-Out Completed',
        `${guestName} has checked out from ${roomName}`,
        'info'
      );

      // Refresh reservations data
      const loadReservations = async () => {
        try {
          const { data, error } = await supabase
            .from('reservations')
            .select('*');
          if (!error && data) {
            setReservations(data);
            console.log('Updated reservations list after checkout');
          }
        } catch (err) {
          console.error('Error fetching reservations after checkout:', err);
        }
      };
      loadReservations();

      // Close any open modals
      setIsCheckInModalOpen(false);
    } catch (error) {
      console.error('Error during check-out:', error);
      addNotification('Check-Out Failed', 'There was an error during check-out process', 'error');
    }
  };

  // Set room to maintenance
  const handleSetMaintenance = async (roomId) => {
    try {
      const room = rooms.find(r => r.id === roomId);
      const roomName = room ? (room.name || room.room_number) : `Room ${roomId}`;

      // Update room status in database
      await updateRoomStatus(roomId, 'Maintenance');

      // Update local state
      setRooms(rooms.map(room =>
        room.id === roomId
          ? { ...room, status: 'Maintenance' }
          : room
      ));

      // Add notification
      addNotification(
        'Room Status Updated',
        `${roomName} is now under maintenance`,
        'info'
      );
    } catch (error) {
      console.error('Error setting maintenance status:', error);
      addNotification('Status Update Failed', 'There was an error updating room status', 'error');
    }
  };

  // Reserve a room
  const handleReserveRoom = (roomId) => {
    setSelectedRoom(rooms.find(r => r.id === roomId));
    setIsCheckInModalOpen(true);
  };

  // Process a reservation request
  const processReservation = async (roomId, guestName, checkInDate, checkOutDate) => {
    try {
      const room = rooms.find(r => r.id === roomId);
      const roomName = room ? (room.name || room.room_number) : `Room ${roomId}`;

      console.log(`Processing reservation for ${roomName} with guest ${guestName}`);

      // Update room status in the database
      await updateRoomStatus(roomId, 'Reserved');

      // Create the reservation record
      const newReservation = {
        guest_name: guestName,
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        room_id: roomId,
        status: 'Confirmed'
      };

      // Update local state
      setRooms(rooms.map(room =>
        room.id === roomId
          ? { ...room, status: 'Reserved', reservation: { guest: guestName, checkIn: checkInDate, checkOut: checkOutDate } }
          : room
      ));

      // Add notification
      addNotification(
        'New Reservation',
        `${roomName} reserved for ${guestName} from ${checkInDate} to ${checkOutDate}`,
        'info'
      );

      setIsCheckInModalOpen(false);
    } catch (error) {
      console.error('Error during reservation:', error);
      addNotification('Reservation Failed', 'There was an error processing the reservation', 'error');
    }
  };

  // Handle right-click on a room to show context menu
  const handleContextMenu = (e, room) => {
    e.preventDefault();
    setSelectedRoom(room);
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  // Close context menu
  const closeContextMenu = () => {
    setShowContextMenu(false);
  };

  // Convert a reserved room to occupied (check-in)
  const convertReservedToOccupied = async (roomId) => {
    try {
      const room = rooms.find(r => r.id === roomId);
      const roomName = room ? (room.name || room.room_number) : `Room ${roomId}`;

      console.log(`Converting reserved ${roomName} to occupied status...`);

      if (!room) {
        console.error(`${roomName} not found`);
        addNotification('Status Update Failed', `${roomName} not found`, 'error');
        return;
      }

      if (room.status !== 'Reserved' && !room.reservation && !room.guest) {
        console.error(`${roomName} is not reserved or has no reservation data`);
        addNotification('Status Update Failed', `${roomName} is not reserved or missing reservation data`, 'error');
        return;
      }

      // Use guest from either reservation object or room.guest property
      const guestName = room.reservation?.guest || room.guest || 'Guest';

      // Update room status in database
      const result = await updateRoomStatus(roomId, 'Occupied');
      if (!result || !result.success) {
        console.error(`Failed to update room ${roomId} status in database:`, result?.error || 'Unknown error');
        addNotification('Status Update Failed', 'There was an error updating room status in the database', 'error');
        return;
      }

      console.log(`Room ${roomId} status updated to Occupied in database`);

      // Dispatch events to ensure all components update

      // 1. General room status update
      const roomStatusEvent = new CustomEvent('hotelRoomStatusUpdate', {
        detail: {
          roomId: roomId,
          status: 'Occupied',
          forceRefresh: true
        }
      });
      document.dispatchEvent(roomStatusEvent);

      // 2. Guest check-in event
      const guestCheckInEvent = new CustomEvent('hotelGuestCheckIn', {
        detail: {
          roomId: roomId,
          guestName: guestName,
          forceRefresh: true
        }
      });
      document.dispatchEvent(guestCheckInEvent);

      // 3. Occupancy update event
      const updateOccupancyEvent = new CustomEvent('hotelOccupancyUpdate', {
        detail: {
          roomId: roomId,
          status: 'Occupied',
          guestName: guestName,
          forceRefresh: true
        }
      });
      document.dispatchEvent(updateOccupancyEvent);

      // Update local state
      setRooms(prevRooms =>
        prevRooms.map(room =>
          room.id === roomId
            ? { ...room, status: 'Occupied', guest: guestName, reservation: null }
            : room
        )
      );

      // Add notification
      addNotification(
        'Check-in Complete',
        `${guestName} has checked in to Room ${roomId}`,
        'success'
      );

      console.log(`Successfully checked in ${guestName} to Room ${roomId}`);

    } catch (error) {
      console.error('Error converting reservation to check-in:', error);
      addNotification('Status Update Failed', 'There was an error during the check-in process', 'error');
    }
  };

  // Mark a room as available (from any status)
  const markRoomAsAvailable = async (roomId) => {
    try {
      const room = rooms.find(r => r.id === roomId);
      const roomName = room ? (room.name || room.room_number) : `Room ${roomId}`;

      console.log(`Setting ${roomName} to Available status`);

      // Update room status in database
      const result = await updateRoomStatus(roomId, 'Available');
      if (!result || !result.success) {
        console.error(`Failed to update ${roomName} status in database:`, result?.error || 'Unknown error');
        addNotification('Status Update Failed', 'There was an error updating room status in the database', 'error');
        return;
      }

      // Dispatch events to ensure all components update

      // 1. Room status update
      const roomStatusEvent = new CustomEvent('hotelRoomStatusUpdate', {
        detail: {
          roomId: roomId,
          status: 'Available',
          forceRefresh: true
        }
      });
      document.dispatchEvent(roomStatusEvent);

      // 2. Occupancy update event
      const updateOccupancyEvent = new CustomEvent('hotelOccupancyUpdate', {
        detail: {
          roomId: roomId,
          status: 'Available',
          guestName: null,
          forceRefresh: true
        }
      });
      document.dispatchEvent(updateOccupancyEvent);

      // Update local state
      setRooms(prevRooms =>
        prevRooms.map(room =>
          room.id === roomId
            ? { ...room, status: 'Available', guest: null, reservation: null }
            : room
        )
      );

      // Add notification
      addNotification(
        'Room Status Updated',
        `${roomName} is now available`,
        'info'
      );

      // Refresh reservations data
      const loadReservations = async () => {
        try {
          const { data, error } = await supabase
            .from('reservations')
            .select('*');
          if (!error && data) {
            setReservations(data);
            console.log('Updated reservations list after setting room available');
          }
        } catch (err) {
          console.error('Error fetching reservations after setting room available:', err);
        }
      };
      loadReservations();

      console.log(`Successfully set ${roomName} to Available`);
    } catch (error) {
      console.error('Error setting room as available:', error);
      addNotification('Status Update Failed', 'There was an error updating room status', 'error');
    }
  };

  // Format duration for display
  const formatDuration = (minutes) => {
    if (!minutes) return 'N/A';

    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return '';
    try {
      return format(parseISO(dateString), 'MMM d, yyyy');
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return null;

    try {
      const now = new Date();
      const date = new Date(timestamp);
      const diffInMinutes = Math.floor((now - date) / (1000 * 60));

      if (diffInMinutes < 1) return 'Just now';
      if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
      if (diffInMinutes < 1440) {
        const hours = Math.floor(diffInMinutes / 60);
        return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      }

      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } catch (e) {
      console.error('Error formatting time:', e);
      return null;
    }
  };

  // Initialize revenue chart
  useEffect(() => {
    if (revenueChartRef.current) {
      const chart = echarts.init(revenueChartRef.current);

      // Use actual revenue data from state
      const days = revenueData.dates && revenueData.dates.length > 0
        ? revenueData.dates
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

      const values = revenueData.values && revenueData.values.length > 0
        ? revenueData.values
        : [0, 0, 0, 0, 0, 0, 0];

      const option = {
        title: {
          text: 'Daily Revenue (GH₵)',
          left: 'center',
          textStyle: {
            color: isDarkMode ? '#ffffff' : '#333333'
          }
        },
        tooltip: {
          trigger: 'axis',
          formatter: '{b}: GH₵{c}'
        },
        xAxis: {
          type: 'category',
          data: days,
          axisLine: {
            lineStyle: {
              color: isDarkMode ? '#555555' : '#cccccc'
            }
          },
          axisLabel: {
            color: isDarkMode ? '#cccccc' : '#333333'
          }
        },
        yAxis: {
          type: 'value',
          axisLine: {
            lineStyle: {
              color: isDarkMode ? '#555555' : '#cccccc'
            }
          },
          axisLabel: {
            color: isDarkMode ? '#cccccc' : '#333333',
            formatter: 'GH₵{value}'
          },
          splitLine: {
            lineStyle: {
              color: isDarkMode ? '#333333' : '#eeeeee'
            }
          }
        },
        series: [
          {
            data: values,
            type: 'line',
            smooth: true,
            symbol: 'circle',
            symbolSize: 8,
            lineStyle: {
              color: '#3082f6',
              width: 3
            },
            itemStyle: {
              color: '#3082f6',
              borderColor: isDarkMode ? '#000000' : '#ffffff',
              borderWidth: 2
            },
            areaStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                {
                  offset: 0,
                  color: isDarkMode ? 'rgba(48, 130, 246, 0.6)' : 'rgba(48, 130, 246, 0.4)'
                },
                {
                  offset: 1,
                  color: isDarkMode ? 'rgba(48, 130, 246, 0.1)' : 'rgba(48, 130, 246, 0.05)'
                }
              ])
            }
          }
        ]
      };

      chart.setOption(option);

      // Handle resize
      const handleResize = () => {
        chart.resize();
      };

      window.addEventListener('resize', handleResize);

      // Return cleanup function for this chart
      return () => {
        chart.dispose();
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isDarkMode, revenueData]); // Re-render when revenueData changes

  // Initialize task chart
  useEffect(() => {
    if (taskChartRef.current) {
      const chart = echarts.init(taskChartRef.current);

      // Chart data from actual tasks
      const taskData = tasks.map(task => {
        return {
          name: task.room,
          value: task.duration || 30
        };
      }) || [];

      // If no tasks, use placeholder data
      const chartData = taskData.length > 0 ? taskData : [
        { name: 'No Tasks', value: 1, itemStyle: { color: '#cccccc' } }
      ];

      const option = {
        title: {
          text: 'Housekeeping Tasks',
          left: 'center',
          textStyle: {
            color: isDarkMode ? '#ffffff' : '#333333'
          }
        },
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {c} minutes'
        },
        series: [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 10,
              borderColor: isDarkMode ? '#000000' : '#ffffff',
              borderWidth: 2
            },
            label: {
              show: false,
              position: 'center'
            },
            emphasis: {
              label: {
                show: true,
                fontSize: '18',
                fontWeight: 'bold'
              }
            },
            labelLine: {
              show: false
            },
            data: chartData
          }
        ]
      };

      chart.setOption(option);

      // Handle resize
      const handleResize = () => {
        chart.resize();
      };

      window.addEventListener('resize', handleResize);

      // Return cleanup function for this chart
      return () => {
        chart.dispose();
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isDarkMode, tasks]); // Re-initialize when theme changes or tasks update

  // Initialize occupancy rate chart
  useEffect(() => {
    if (occRateChartRef.current) {
      const chart = echarts.init(occRateChartRef.current);

      // Calculate room statistics
      const totalRooms = rooms?.length || 0;
      const availableRooms = rooms?.filter(room => room.status === 'Available').length || 0;
      const occupiedRooms = rooms?.filter(room => room.status === 'Occupied').length || 0;
      const reservedRooms = rooms?.filter(room => room.status === 'Reserved').length || 0;
      const maintenanceRooms = rooms?.filter(room => room.status === 'Maintenance').length || 0;
      const cleaningRooms = rooms?.filter(room => room.status === 'Cleaning').length || 0;

      const option = {
        title: {
          text: 'Room Status Distribution',
          left: 'center',
          textStyle: {
            color: isDarkMode ? '#ffffff' : '#333333'
          }
        },
        tooltip: {
          trigger: 'item',
          formatter: function (params) {
            const percentage = ((params.value / totalRooms) * 100).toFixed(1);
            return `${params.name}: ${params.value} rooms (${percentage}%)`;
          }
        },
        legend: {
          top: '80%',
          bottom: '10%',
          left: 'center',
          textStyle: {
            color: isDarkMode ? '#cccccc' : '#333333'
          },
          padding: [15, 0, 0, 0]
        },
        series: [
          {
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: {
              borderRadius: 10,
              borderColor: isDarkMode ? '#000000' : '#ffffff',
              borderWidth: 2
            },
            label: {
              show: false,
              position: 'center'
            },
            emphasis: {
              label: {
                show: true,
                fontSize: '18',
                fontWeight: 'bold'
              }
            },
            labelLine: {
              show: false
            },
            data: [
              {
                value: occupiedRooms,
                name: 'Occupied',
                itemStyle: { color: '#ef4444' }
              },
              {
                value: reservedRooms,
                name: 'Reserved',
                itemStyle: { color: '#3b82f6' }
              },
              {
                value: availableRooms,
                name: 'Available',
                itemStyle: { color: '#22c55e' }
              },
              {
                value: maintenanceRooms,
                name: 'Maintenance',
                itemStyle: { color: '#f59e0b' }
              },
              {
                value: cleaningRooms,
                name: 'Cleaning',
                itemStyle: { color: '#8b5cf6' }
              }
            ]
          }
        ]
      };

      chart.setOption(option);

      // Handle resize
      const handleResize = () => {
        chart.resize();
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        chart.dispose();
      };
    }
  }, [rooms, isDarkMode]);

  // Update stats when rooms or revenue change
  useEffect(() => {
    const availableRooms = rooms.filter(room => room.status === 'Available').length;
    const occupiedRooms = rooms.filter(room => room.status === 'Occupied').length;
    const reservedRooms = rooms.filter(room => room.status === 'Reserved').length;
    const maintenanceRooms = rooms.filter(room => room.status === 'Maintenance').length;

    // Update local totalRevenue state
    setStats(prev => ({
      ...prev,
      availableRooms,
      occupiedRooms,
      reservedRooms,
      maintenanceRooms,
      totalRevenue: revenue || prev.totalRevenue || 0,
    }));
  }, [rooms, revenue]);

  // Update total guests count from guest list
  useEffect(() => {
    if (guestList && Array.isArray(guestList)) {
      setTotalGuests(guestList.length);
      console.log(`Updated total guests count: ${guestList.length}`);
    }
  }, [guestList]);

  // Update Today's Check-ins from Guest data
  useEffect(() => {
    if (guestList && guestList.length > 0) {
      // Filter guests that are checking in today or already checked in recently
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todaysCheckIns = guestList
        .filter(guest => {
          // Check if there's a checkIn date
          if (!guest.checkIn && !guest.check_in) return false;

          // Get the check in date in proper format
          const checkInDate = guest.checkIn || guest.check_in;

          // Parse the date in various formats
          let parsedDate;
          try {
            if (checkInDate instanceof Date) {
              parsedDate = checkInDate;
            } else if (typeof checkInDate === 'string') {
              parsedDate = parseISO(checkInDate);
            }

            // Check if the check-in date is today
            if (parsedDate && isToday(parsedDate)) {
              return true;
            }

            // Also include guests that checked in within the last 24 hours
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            return parsedDate >= yesterday;
          } catch (err) {
            console.error("Error parsing check-in date:", err);
            return false;
          }
        })
        .map(guest => {
          // Get room details
          const roomId = guest.room_id || guest.room;
          const room = rooms.find(r => r.id === roomId || r.id === parseInt(roomId, 10));

          // Format arrival date/time
          let arrivalTime = guest.checkIn || guest.check_in || new Date();
          try {
            if (typeof arrivalTime === 'string') {
              arrivalTime = parseISO(arrivalTime);
            }
            arrivalTime = format(arrivalTime, 'MMM dd, yyyy, HH:mm');
          } catch (err) {
            arrivalTime = "Today";
          }

          // Determine status
          const status = guest.status === 'Checked In' ? 'Arrived' : 'Pending';

          // Get guest preferences if any
          const preferences = guest.preferences || [];

          return {
            id: guest.id,
            guest: guest.name || guest.guest_name,
            room: roomId || 'Not Assigned',
            roomType: room ? room.type : 'Standard',
            arrival: arrivalTime,
            status,
            preferences
          };
        });

      // Add reservations that are due for check-in today but not checked in yet
      const todaysReservations = reservations
        .filter(reservation => {
          // Skip if guest is already checked in
          if (todaysCheckIns.some(checkIn => checkIn.id === reservation.guest_id)) {
            return false;
          }

          // Check if there's a checkIn date
          if (!reservation.check_in_date) return false;

          try {
            const reservationDate = parseISO(reservation.check_in_date);
            return isToday(reservationDate);
          } catch (err) {
            return false;
          }
        })
        .map(reservation => {
          return {
            id: reservation.guest_id,
            guest: reservation.guest_name,
            room: reservation.room,
            roomType: "Reserved",
            arrival: "Expected Today",
            status: "Expected",
            preferences: []
          };
        });

      // Combine both lists and sort by status (Pending first, then Arrived)
      const combinedCheckIns = [...todaysReservations, ...todaysCheckIns];
      combinedCheckIns.sort((a, b) => {
        // Sort by status first (Expected, then Pending, then Arrived)
        if (a.status === 'Expected' && b.status !== 'Expected') return -1;
        if (a.status === 'Pending' && b.status === 'Arrived') return -1;
        if (a.status === 'Arrived' && b.status === 'Pending') return 1;
        // If status is the same, sort by arrival time (most recent first)
        return -1; // Default to showing newest first
      });

      setCheckIns(combinedCheckIns);
    }
  }, [guestList, reservations, rooms]);

  // Additional useEffect to filter today's check-ins and recent reservations
  useEffect(() => {
    if (Array.isArray(reservations)) {
      // Filter today's check-ins
      const today = new Date().toISOString().split('T')[0];
      const checkInsToday = reservations.filter(res =>
        res.check_in_date && res.check_in_date.startsWith(today) &&
        (res.status === 'Reserved' || res.status === 'Confirmed')
      ).map(res => ({
        id: res.id,
        guest_name: res.guest_name,
        room_number: res.room_number || 'Not Assigned',
        check_in_date: res.check_in_date
      }));

      setTodaysCheckIns(checkInsToday);

      // Get recent reservations (last 5)
      const recent = [...reservations]
        .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
        .slice(0, 5);

      setRecentReservations(recent);
    }
  }, [reservations]);

  useEffect(() => {
    fetchRoomStats();
    fetchRevenueData();
    fetchTasks();
    fetchRecentReservations();
    fetchRestaurantStats();
  }, []);

  // Add new useEffect for restaurant date range changes
  useEffect(() => {
    fetchRestaurantStats();
  }, [restaurantDateRange]);

  const fetchRestaurantStats = async () => {
    try {
      const { data: orders, error } = await supabase
        .from('restaurant_orders')
        .select(`
          *,
          restaurant_order_items(
            *,
            restaurant_menu_items(name, price)
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter orders based on date range
      const filteredOrders = filterRestaurantOrdersByDateRange(orders || [], restaurantDateRange);

      // Only consider completed orders for revenue calculation
      const completedOrders = filteredOrders.filter(order =>
        order.status === 'completed' || order.status === 'delivered'
      );

      // Calculate total revenue
      const totalRevenue = completedOrders.reduce((sum, order) => {
        return sum + (parseFloat(order.total_amount) || 0);
      }, 0);

      // Calculate average order value
      const avgOrderValue = completedOrders.length > 0
        ? totalRevenue / completedOrders.length
        : 0;

      // Find popular items
      const itemCounts = {};
      completedOrders.forEach(order => {
        if (order.restaurant_order_items && order.restaurant_order_items.length > 0) {
          order.restaurant_order_items.forEach(item => {
            const itemName = item.restaurant_menu_items ? item.restaurant_menu_items.name : item.name;
            if (itemName) {
              itemCounts[itemName] = (itemCounts[itemName] || 0) + item.quantity;
            }
          });
        }
      });

      // Convert to array and sort by count
      const popularItems = Object.entries(itemCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3); // Top 3 items

      setRestaurantStats({
        totalRevenue,
        totalOrders: completedOrders.length,
        avgOrderValue,
        popularItems
      });
    } catch (error) {
      console.error('Error fetching restaurant stats:', error);
    }
  };

  // Filter orders based on date range
  const filterRestaurantOrdersByDateRange = (ordersData, range) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    switch (range) {
      case 'today':
        return ordersData.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= today;
        });
      case 'week':
        return ordersData.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= startOfWeek;
        });
      case 'month':
        return ordersData.filter(order => {
          const orderDate = new Date(order.created_at);
          return orderDate >= startOfMonth;
        });
      case 'all':
      default:
        return ordersData;
    }
  };

  // Handle date range change
  const handleRestaurantDateRangeChange = (range) => {
    setRestaurantDateRange(range);
    fetchRestaurantStats();
  };

  const fetchRoomStats = async () => {
    try {
      const { data: roomsData, error } = await supabase
        .from('rooms')
        .select('*');

      if (error) throw error;
      setRooms(roomsData);
    } catch (error) {
      console.error('Error fetching room stats:', error);
    }
  };

  const fetchRevenueData = async () => {
    try {
      const revenueStreams = await aggregateRevenueStreams();
      setTotalRevenue(revenueStreams.total);

      setStats(prev => ({
        ...prev,
        totalRevenue: revenueStreams.total,
        roomRevenue: revenueStreams.roomRevenue,
        barRestaurantRevenue: revenueStreams.barRestaurantRevenue,
        poolRevenue: revenueStreams.poolRevenue
      }));

      setRevenueData({
        dates: revenueStreams.dailySeries.map(d => d.label),
        values: revenueStreams.dailySeries.map(d => d.value)
      });
    } catch (error) {
      console.error('Error fetching revenue data:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('status', 'Pending')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setTasks(tasksData);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchRecentReservations = async () => {
    try {
      const { data: reservationsData, error } = await supabase
        .from('reservations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setRecentReservations(reservationsData);
    } catch (error) {
      console.error('Error fetching recent reservations:', error);
    }
  };

  // Overview Section
  const renderOverviewSection = () => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* 1. Total Revenue (All Sources) */}
        <div className={`bg-gradient-to-br from-blue-500/80 to-blue-700/80 backdrop-blur-lg rounded-xl p-6 shadow-custom border border-blue-500/30 relative overflow-hidden group hover:shadow-lg hover:shadow-blue-500/40 transition-all duration-300`}>
          <div className={`absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-blue-600 rounded-xl opacity-0 group-hover:opacity-50 blur-xl transition-all duration-500`}></div>
          <div className="relative z-10 flex flex-col items-center justify-center text-center">
            <div className={`bg-blue-500/30 p-3 rounded-full h-12 w-12 flex items-center justify-center mb-2 text-blue-400`}>
              <i className={`fas fa-money-bill-wave text-xl`}></i>
            </div>
            <h3 className={`text-sm font-medium text-blue-100`}>Total Revenue</h3>
            <p className="text-3xl font-bold text-white mt-1">GH₵{stats.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <span className="text-xs text-blue-200 mt-1">Rooms + Restaurant + Pool</span>
          </div>
        </div>

        {/* 2. Rooms Revenue */}
        <div className={`bg-gradient-to-br from-purple-500/80 to-purple-700/80 backdrop-blur-lg rounded-xl p-6 shadow-custom border border-purple-500/30 relative overflow-hidden group hover:shadow-lg hover:shadow-purple-500/40 transition-all duration-300`}>
          <div className={`absolute -inset-0.5 bg-gradient-to-r from-purple-600 to-purple-600 rounded-xl opacity-0 group-hover:opacity-50 blur-xl transition-all duration-500`}></div>
          <div className="relative z-10 flex flex-col items-center justify-center text-center">
            <div className={`bg-purple-500/30 p-3 rounded-full h-12 w-12 flex items-center justify-center mb-2 text-purple-400`}>
              <i className={`fas fa-bed text-xl`}></i>
            </div>
            <h3 className={`text-sm font-medium text-purple-100`}>Rooms Revenue</h3>
            <p className="text-3xl font-bold text-white mt-1">GH₵{stats.roomRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <span className="text-xs text-purple-200 mt-1">Accommodation only</span>
          </div>
        </div>

        {/* 3. Restaurant & Bar Revenue */}
        <div className={`bg-gradient-to-br from-amber-500/80 to-amber-700/80 backdrop-blur-lg rounded-xl p-6 shadow-custom border border-amber-500/30 relative overflow-hidden group hover:shadow-lg hover:shadow-amber-500/40 transition-all duration-300`}>
          <div className={`absolute -inset-0.5 bg-gradient-to-r from-amber-600 to-amber-600 rounded-xl opacity-0 group-hover:opacity-50 blur-xl transition-all duration-500`}></div>
          <div className="relative z-10 flex flex-col items-center justify-center text-center">
            <div className={`bg-amber-500/30 p-3 rounded-full h-12 w-12 flex items-center justify-center mb-2 text-amber-400`}>
              <i className={`fas fa-utensils text-xl`}></i>
            </div>
            <h3 className={`text-sm font-medium text-amber-100`}>Rest. & Bar Revenue</h3>
            <p className="text-3xl font-bold text-white mt-1">GH₵{stats.barRestaurantRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <span className="text-xs text-amber-200 mt-1">Food & Beverage sales</span>
          </div>
        </div>

        {/* 4. Pool Revenue */}
        <div className={`bg-gradient-to-br from-cyan-500/80 to-cyan-700/80 backdrop-blur-lg rounded-xl p-6 shadow-custom border border-cyan-500/30 relative overflow-hidden group hover:shadow-lg hover:shadow-cyan-500/40 transition-all duration-300`}>
          <div className={`absolute -inset-0.5 bg-gradient-to-r from-cyan-600 to-cyan-600 rounded-xl opacity-0 group-hover:opacity-50 blur-xl transition-all duration-500`}></div>
          <div className="relative z-10 flex flex-col items-center justify-center text-center">
            <div className={`bg-cyan-500/30 p-3 rounded-full h-12 w-12 flex items-center justify-center mb-2 text-cyan-400`}>
              <i className={`fas fa-swimming-pool text-xl`}></i>
            </div>
            <h3 className={`text-sm font-medium text-cyan-100`}>Pool Revenue</h3>
            <p className="text-3xl font-bold text-white mt-1">GH₵{stats.poolRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <span className="text-xs text-cyan-200 mt-1">Pool access & passes</span>
          </div>
        </div>
      </div>
    );
  };

  const renderRevenueDashboardWidget = () => {
    return (
      <div className="bg-gradient-to-br from-blue-500/80 to-purple-700/80 backdrop-blur-lg rounded-xl p-6 shadow-custom border border-white/10 flex flex-col items-center justify-center text-white relative overflow-hidden group hover:shadow-blue-500/40 hover:shadow-lg transition-all duration-300">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-pink-600 to-purple-600 rounded-xl opacity-0 group-hover:opacity-50 blur-xl transition-all duration-500"></div>
        <div className="relative z-10 w-full">
          <div className="bg-white/20 p-3 rounded-full mb-3 backdrop-blur-sm w-12 h-12 flex items-center justify-center mx-auto">
            <i className="fas fa-money-bill-wave text-2xl"></i>
          </div>
          <span className="text-sm text-blue-100 block text-center">Total Revenue</span>
          <span className="text-3xl font-bold mt-1 block text-center">GH₵{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span className="text-xs text-blue-200 mt-1 block text-center">rooms & restaurant streams</span>
        </div>
      </div>
    );
  };

  // Helper functions for UI
  const getRoomStatusClass = (status, isDark = true) => {
    switch (status) {
      case 'Available':
        return isDark
          ? 'border-green-500/30 bg-green-500/10 hover:border-green-400'
          : 'border-green-400 bg-green-50 hover:border-green-500';
      case 'Occupied':
        return isDark
          ? 'border-red-500/30 bg-red-500/10 hover:border-red-400'
          : 'border-red-400 bg-red-50 hover:border-red-500';
      case 'Reserved':
        return isDark
          ? 'border-blue-500/30 bg-blue-500/10 hover:border-blue-400'
          : 'border-blue-400 bg-blue-50 hover:border-blue-500';
      case 'Maintenance':
        return isDark
          ? 'border-amber-500/30 bg-amber-500/10 hover:border-amber-400'
          : 'border-amber-400 bg-amber-50 hover:border-amber-500';
      default:
        return isDark
          ? 'border-gray-500/30 bg-gray-500/10 hover:border-gray-400'
          : 'border-gray-300 bg-gray-50 hover:border-gray-400';
    }
  };

  const getTaskStatusClass = (status, isDark = true) => {
    switch (status) {
      case 'Completed':
        return isDark ? 'bg-green-500/30 text-green-400' : 'bg-green-500/20 text-green-600';
      case 'In Progress':
        return isDark ? 'bg-blue-500/30 text-blue-400' : 'bg-blue-500/20 text-blue-600';
      case 'Pending':
        return isDark ? 'bg-amber-500/30 text-amber-400' : 'bg-amber-500/20 text-amber-600';
      case 'Urgent':
        return isDark ? 'bg-red-500/30 text-red-400' : 'bg-red-500/20 text-red-600';
      default:
        return isDark ? 'bg-gray-500/30 text-gray-400' : 'bg-gray-500/20 text-gray-600';
    }
  };

  const getReservationStatusClass = (status, isDark = true) => {
    switch (status) {
      case 'Confirmed':
        return isDark ? 'bg-green-500/30 text-green-400' : 'bg-green-500/20 text-green-600';
      case 'Reserved':
        return isDark ? 'bg-blue-500/30 text-blue-400' : 'bg-blue-500/20 text-blue-600';
      case 'Checked In':
        return isDark ? 'bg-purple-500/30 text-purple-400' : 'bg-purple-500/20 text-purple-600';
      case 'Checked Out':
        return isDark ? 'bg-gray-500/30 text-gray-400' : 'bg-gray-500/20 text-gray-600';
      case 'Cancelled':
        return isDark ? 'bg-red-500/30 text-red-400' : 'bg-red-500/20 text-red-600';
      default:
        return isDark ? 'bg-gray-500/30 text-gray-400' : 'bg-gray-500/20 text-gray-600';
    }
  };

  const getRoomStatusIndicator = (status, isDark = true) => {
    switch (status) {
      case 'Available':
        return isDark ? 'bg-green-500' : 'bg-green-600';
      case 'Occupied':
        return isDark ? 'bg-red-500' : 'bg-red-600';
      case 'Reserved':
        return isDark ? 'bg-blue-500' : 'bg-blue-600';
      case 'Maintenance':
        return isDark ? 'bg-amber-500' : 'bg-amber-600';
      default:
        return isDark ? 'bg-gray-500' : 'bg-gray-600';
    }
  };

  // Room interaction handlers
  const handleRoomClick = (e, room) => {
    e.preventDefault();

    // Perform default action based on room status
    if (room.status === 'Available') {
      openCheckInModal(room.id);
    } else if (room.status === 'Occupied') {
      // Implement check-out functionality
      if (window.confirm(`Check out from Room ${room.number}?`)) {
        updateRoomStatus(room.id, 'Available');
      }
    }
  };

  const handleRoomMouseEnter = (e, room) => {
    setHoveredRoom(room);
    setTooltipPosition({ x: e.clientX, y: e.clientY });
    setShowTooltip(true);
  };

  const handleRoomMouseLeave = () => {
    setShowTooltip(false);
  };

  const handleRoomContextMenu = (e, room) => {
    e.preventDefault();
    setSelectedRoom(room);
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleContextMenuAction = (action, roomId) => {
    setShowContextMenu(false);

    switch (action) {
      case 'checkIn':
        openCheckInModal(roomId);
        break;
      case 'checkOut':
        // Settle the folio first; the check-out completes in onSettled
        setSettlementRoomId(roomId);
        break;
      case 'maintenance':
        updateRoomStatus(roomId, 'Maintenance');
        break;
      case 'available':
        updateRoomStatus(roomId, 'Available');
        break;
      case 'reserve':
        navigate('/reservations');
        break;
      case 'details':
        // Navigate to rooms page
        navigate('/rooms');
        break;
      case 'invoice':
        // Handle invoice generation
        navigate(`/billing/new?roomId=${roomId}`);
        break;
      case 'cancel':
        // Handle reservation cancellation
        if (window.confirm(`Cancel reservation for Room ${selectedRoom.number}?`)) {
          updateRoomStatus(roomId, 'Available');
        }
        break;
      default:
        console.log(`Unhandled action: ${action} for room ${roomId}`);
        break;
    }
  };

  // Function to open check-in modal
  const openCheckInModal = (roomId) => {
    setSelectedRoom(rooms.find(r => r.id === roomId));
    setIsCheckInModalOpen(true);
  };

  const handleCheckInClick = (checkIn) => {
    // Navigate to check-in details or process check-in
    navigate(`/check-ins/${checkIn.id}`);
  };

  const handleReservationClick = (reservation) => {
    // Navigate to reservation details
    navigate(`/reservations/${reservation.id}`);
  };

  return (
    <DashboardLayout title="Dashboard" activeLink="Dashboard">
      <div className="relative z-10">
        <div className="max-w-[1440px] mx-auto">
          {/* Statistics Overview Cards */}
          {/* Statistics Overview Cards */}
          {renderOverviewSection()}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <button onClick={() => navigate('/rooms')} className={`bg-gradient-to-r ${isDarkMode ? 'from-blue-600 to-blue-800 border-blue-500/30' : 'from-blue-500 to-blue-700 border-blue-400/40'} text-white rounded-lg p-4 hover:from-blue-700 hover:to-blue-900 flex items-center justify-center space-x-2 transition-all duration-300 shadow-lg border backdrop-blur-sm`}>
              <div className={`${isDarkMode ? 'bg-blue-500/30' : 'bg-blue-400/40'} p-2 rounded-lg mr-2`}>
                <i className="fas fa-bed"></i>
              </div>
              <span>Manage Rooms</span>
            </button>
            <button onClick={() => navigate('/guests')} className={`bg-gradient-to-r ${isDarkMode ? 'from-green-600 to-green-800 border-green-500/30' : 'from-green-500 to-green-700 border-green-400/40'} text-white rounded-lg p-4 hover:from-green-700 hover:to-green-900 flex items-center justify-center space-x-2 transition-all duration-300 shadow-lg border backdrop-blur-sm`}>
              <div className={`${isDarkMode ? 'bg-green-500/30' : 'bg-green-400/40'} p-2 rounded-lg mr-2`}>
                <i className="fas fa-users"></i>
              </div>
              <span>Manage Guests</span>
            </button>
            <button onClick={() => navigate('/tasks')} className={`bg-gradient-to-r ${isDarkMode ? 'from-yellow-600 to-amber-800 border-yellow-500/30' : 'from-yellow-500 to-amber-700 border-yellow-400/40'} text-white rounded-lg p-4 hover:from-yellow-700 hover:to-amber-900 flex items-center justify-center space-x-2 transition-all duration-300 shadow-lg border backdrop-blur-sm`}>
              <div className={`${isDarkMode ? 'bg-yellow-500/30' : 'bg-yellow-400/40'} p-2 rounded-lg mr-2`}>
                <i className="fas fa-tasks"></i>
              </div>
              <span>View Tasks</span>
            </button>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Room Status */}
            <div className="lg:col-span-3 space-y-8">
              {/* Room Status Section */}
              <div className={`${isDarkMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur-md rounded-xl p-6 shadow-lg border ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                <div className="flex items-center justify-between mb-6">
                  <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} flex items-center`}>
                    <i className={`fas fa-th-large mr-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`}></i>
                    Room Status
                  </h3>
                  <div className="flex space-x-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${isDarkMode ? 'bg-green-900/30 text-green-400 border border-green-500/30' : 'bg-green-100 text-green-800'}`}>
                      Available: {availableRooms}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${isDarkMode ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30' : 'bg-blue-100 text-blue-800'}`}>
                      Occupied: {occupiedRooms}
                    </span>
                  </div>
                </div>

                {loading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* Main Block (Rooms 1-28) */}
                    <div>
                      <h4 className={`text-lg font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} pb-2`}>
                        Main Block
                      </h4>
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2">
                        {rooms.slice(0, 28).map((room) => (
                          <div
                            key={room.id}
                            onClick={(e) => handleRoomClick(e, room)}
                            onContextMenu={(e) => handleRoomContextMenu(e, room)}
                            onMouseEnter={(e) => handleRoomMouseEnter(e, room)}
                            onMouseLeave={handleRoomMouseLeave}
                            className={`relative p-2 rounded-lg border cursor-pointer transition-all duration-200 transform hover:scale-[1.03] ${getRoomStatusClass(room.status, isDarkMode)}`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className={`font-bold text-base ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                                {room.room_number || room.name}
                              </span>
                              <div className={`w-2 h-2 rounded-full ${getRoomStatusIndicator(room.status, isDarkMode)}`}></div>
                            </div>

                            {/* Room Price */}
                            <div className={`text-[13px] font-semibold mb-1 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                              GH₵{room.price ? room.price.toFixed(2) : '0.00'}
                            </div>

                            <div className="mt-1">
                              <div className={`text-[13px] truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                {room.status === 'Occupied' && room.guest ? (
                                  <span className="flex items-center">
                                    <i className="fas fa-user mr-1 text-xs opacity-70"></i>
                                    {room.guest}
                                  </span>
                                ) : room.status === 'Reserved' && room.reservation ? (
                                  <span className="flex items-center">
                                    <i className="fas fa-calendar-check mr-1 text-xs opacity-70"></i>
                                    {room.reservation.guest || 'Reserved'}
                                  </span>
                                ) : (
                                  <span className="opacity-50">{room.status}</span>
                                )}
                              </div>
                            </div>

                            {/* Status Badge */}
                            {room.status === 'Cleaning' && (
                              <div className="absolute top-0 right-0 -mt-1 -mr-1">
                                <span className="flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Acquarian Block (Rooms 29+) */}
                    <div>
                      <h4 className={`text-lg font-medium mb-3 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} pb-2`}>
                        Acquarian Block
                      </h4>
                      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2">
                        {rooms.slice(28).map((room) => (
                          <div
                            key={room.id}
                            onClick={(e) => handleRoomClick(e, room)}
                            onContextMenu={(e) => handleRoomContextMenu(e, room)}
                            onMouseEnter={(e) => handleRoomMouseEnter(e, room)}
                            onMouseLeave={handleRoomMouseLeave}
                            className={`relative p-2 rounded-lg border cursor-pointer transition-all duration-200 transform hover:scale-[1.03] ${getRoomStatusClass(room.status, isDarkMode)}`}
                          >
                            <div className="flex justify-between items-start mb-1">
                              <span className={`font-bold text-base ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
                                {room.room_number || room.name}
                              </span>
                              <div className={`w-2 h-2 rounded-full ${getRoomStatusIndicator(room.status, isDarkMode)}`}></div>
                            </div>

                            {/* Room Price */}
                            <div className={`text-[13px] font-semibold mb-1 ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                              GH₵{room.price ? room.price.toFixed(2) : '0.00'}
                            </div>

                            <div className="mt-1">
                              <div className={`text-[13px] truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                                {room.status === 'Occupied' && room.guest ? (
                                  <span className="flex items-center">
                                    <i className="fas fa-user mr-1 text-xs opacity-70"></i>
                                    {room.guest}
                                  </span>
                                ) : room.status === 'Reserved' && room.reservation ? (
                                  <span className="flex items-center">
                                    <i className="fas fa-calendar-check mr-1 text-xs opacity-70"></i>
                                    {room.reservation.guest || 'Reserved'}
                                  </span>
                                ) : (
                                  <span className="opacity-50">{room.status}</span>
                                )}
                              </div>
                            </div>

                            {/* Status Badge */}
                            {room.status === 'Cleaning' && (
                              <div className="absolute top-0 right-0 -mt-1 -mr-1">
                                <span className="flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional Widgets moved inside Room Status container */}
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6 border-t pt-8 dark:border-gray-700 border-gray-200">
                  {/* Occupancy Rate Chart */}
                  <div className={`${isDarkMode ? 'bg-slate-900/50' : 'bg-gray-50/80'} rounded-xl p-6 border ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                    <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-4 flex items-center`}>
                      <i className={`fas fa-chart-pie mr-2 ${isDarkMode ? 'text-amber-400' : 'text-amber-500'}`}></i>
                      Occupancy Rate
                    </h3>
                    <div ref={occRateChartRef} className="w-full h-[300px]"></div>
                  </div>

                  {/* Today's Check-ins */}
                  <div className={`${isDarkMode ? 'bg-slate-900/50' : 'bg-gray-50/80'} rounded-xl p-6 border ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                    <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-4 flex items-center`}>
                      <i className={`fas fa-sign-in-alt mr-2 ${isDarkMode ? 'text-green-400' : 'text-green-500'}`}></i>
                      Today's Check-ins
                    </h3>
                    {todaysCheckIns.length > 0 ? (
                      <div className="space-y-3">
                        {todaysCheckIns.map((checkIn) => (
                          <div key={checkIn.id}
                            className={`${isDarkMode ? 'bg-slate-800/50 border-slate-700 hover:border-blue-500/50' : 'bg-white/90 border-gray-200 hover:border-blue-400/60'} rounded-lg p-3 flex justify-between items-center border transition-all duration-300`}
                            onClick={() => handleCheckInClick(checkIn)}
                          >
                            <div>
                              <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{checkIn.guest_name}</div>
                              <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{checkIn.room_number} · {formatDate(checkIn.check_in_date)}</div>
                            </div>
                            <button className={`${isDarkMode ? 'bg-green-600/30 hover:bg-green-600/50 text-green-400' : 'bg-green-500/20 hover:bg-green-500/30 text-green-600'} p-2 rounded-lg transition-colors duration-300`}>
                              <i className="fas fa-check"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`text-center py-6 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        <i className="fas fa-calendar-check text-4xl mb-2 opacity-30"></i>
                        <p>No check-ins scheduled for today</p>
                      </div>
                    )}
                  </div>

                  {/* Housekeeping Tasks */}
                  <div className={`${isDarkMode ? 'bg-slate-900/50' : 'bg-gray-50/80'} rounded-xl p-6 border ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                    <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-4 flex items-center`}>
                      <i className={`fas fa-broom mr-2 ${isDarkMode ? 'text-purple-400' : 'text-purple-500'}`}></i>
                      Housekeeping Tasks
                    </h3>
                    {tasks && tasks.length > 0 ? (
                      <div className="space-y-3">
                        {tasks.map((task) => (
                          <div
                            key={task.id}
                            className={`${isDarkMode ? 'bg-slate-800/50 border-slate-700 hover:border-purple-500/50' : 'bg-white/90 border-gray-200 hover:border-purple-400/60'} rounded-lg p-3 flex justify-between items-center border transition-all duration-300`}
                          >
                            <div>
                              <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{task.title}</div>
                              <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{task.room_name || task.room} · {task.assigned_to}</div>
                            </div>
                            <div className={`text-xs px-2 py-1 rounded ${getTaskStatusClass(task.status, isDarkMode)}`}>
                              {task.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`text-center py-6 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        <i className="fas fa-broom text-4xl mb-2 opacity-30"></i>
                        <p>No active housekeeping tasks</p>
                      </div>
                    )}

                    <button
                      className={`mt-4 w-full bg-gradient-to-r ${isDarkMode ? 'from-purple-600/50 to-indigo-600/50 border-purple-500/30' : 'from-purple-500/40 to-indigo-500/40 border-purple-400/40'} text-white rounded-lg py-2 hover:from-purple-700/50 hover:to-indigo-700/50 transition-all duration-300 border backdrop-blur-sm`}
                      onClick={() => navigate('/housekeeping')}
                    >
                      View All Tasks
                    </button>
                  </div>

                  {/* Recent Reservations */}
                  <div className={`${isDarkMode ? 'bg-slate-900/50' : 'bg-gray-50/80'} rounded-xl p-6 border ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                    <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-4 flex items-center`}>
                      <i className={`fas fa-calendar-alt mr-2 ${isDarkMode ? 'text-cyan-400' : 'text-cyan-500'}`}></i>
                      Recent Reservations
                    </h3>

                    {recentReservations && recentReservations.length > 0 ? (
                      <div className="space-y-3">
                        {recentReservations.map((reservation) => (
                          <div
                            key={reservation.id}
                            className={`${isDarkMode ? 'bg-slate-800/50 border-slate-700 hover:border-cyan-500/50' : 'bg-white/90 border-gray-200 hover:border-cyan-400/60'} rounded-lg p-3 flex justify-between items-center border transition-all duration-300`}
                            onClick={() => handleReservationClick(reservation)}
                          >
                            <div>
                              <div className={`font-medium ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>{reservation.guest_name}</div>
                              <div className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                                {formatDate(reservation.check_in_date)} - {formatDate(reservation.check_out_date)}
                              </div>
                            </div>
                            <div className={`text-xs px-2 py-1 rounded ${getReservationStatusClass(reservation.status, isDarkMode)}`}>
                              {reservation.status}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`text-center py-6 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        <i className="fas fa-calendar-alt text-4xl mb-2 opacity-30"></i>
                        <p>No recent reservations</p>
                      </div>
                    )}

                    <button
                      className={`mt-4 w-full bg-gradient-to-r ${isDarkMode ? 'from-cyan-600/50 to-blue-600/50 border-cyan-500/30' : 'from-cyan-500/40 to-blue-500/40 border-cyan-400/40'} text-white rounded-lg py-2 hover:from-cyan-700/50 hover:to-blue-700/50 transition-all duration-300 border backdrop-blur-sm`}
                      onClick={() => navigate('/reservations')}
                    >
                      View All Reservations
                    </button>
                  </div>
                </div>
              </div>

              {/* Revenue Analytics */}
              <div className={`${isDarkMode ? 'bg-slate-800/80' : 'bg-white/80'} backdrop-blur-md rounded-xl p-6 shadow-lg border ${isDarkMode ? 'border-slate-700' : 'border-gray-200'}`}>
                <h3 className={`text-xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'} mb-4 flex items-center`}>
                  <i className={`fas fa-chart-line mr-2 ${isDarkMode ? 'text-blue-400' : 'text-blue-500'}`}></i>
                  Revenue Analytics
                </h3>
                <div ref={revenueChartRef} className="w-full h-[300px]"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Context Menu */}
        {
          showContextMenu && (
            <RoomContextMenu
              position={menuPosition}
              room={selectedRoom}
              onClose={() => setShowContextMenu(false)}
              onAction={handleContextMenuAction}
              isDarkMode={isDarkMode}
            />
          )
        }

        {/* Check-out settlement */}
        {settlementRoomId !== null && (
          <CheckoutSettlementModal
            roomId={settlementRoomId}
            onCancel={() => setSettlementRoomId(null)}
            onSettled={async () => {
              const roomId = settlementRoomId;
              setSettlementRoomId(null);
              await checkOutGuest(roomId);
              await handleCheckOut(roomId);
            }}
          />
        )}

        {/* Check-in Modal */}
        {
          isCheckInModalOpen && selectedRoom && (
            <CheckInModal
              room={selectedRoom}
              isOpen={isCheckInModalOpen}
              onClose={() => setIsCheckInModalOpen(false)}
              onAddGuest={handleCheckIn}
            />
          )
        }

        {/* Room Tooltip */}
        {
          showTooltip && (
            <RoomTooltip
              room={hoveredRoom}
              position={tooltipPosition}
              isDarkMode={isDarkMode}
            />
          )
        }
      </div>

    </DashboardLayout >
  );
};

export default Dashboard;