import supabase from '../supabaseClient';

const API_BASE_URL = process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:5000/api');

/**
 * Ask the server to send a templated SMS. Fire-and-forget: failures are logged
 * and never block the reservation workflow.
 * Events: reservation_created, reservation_updated, reservation_cancelled,
 * checked_in, checked_out, no_show, payment_received
 */
export const sendSmsNotification = async (event, phone, data = {}) => {
  if (!phone) return { success: false, skipped: true };
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return { success: false, error: 'Not authenticated' };

    const response = await fetch(`${API_BASE_URL}/sms/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ event, phone, data })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) console.warn('SMS not sent:', result.error);
    return result;
  } catch (error) {
    console.warn('SMS notification failed:', error.message);
    return { success: false, error: error.message };
  }
};

// Shape a reservation row (snake_case) into template data
export const reservationSmsData = (r = {}, extra = {}) => ({
  guestName: r.guest_name || r.guestName,
  roomNumber: r.room_number || r.roomNumber,
  checkInDate: r.check_in_date || r.checkInDate,
  checkOutDate: r.check_out_date || r.checkOutDate,
  roomRate: r.room_price || r.roomPrice,
  ...extra
});
