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

// Invoice just marked Paid: text the guest a payment confirmation.
// Invoices carry no phone number, so look it up from the guest record, then their reservation.
export const sendInvoicePaymentSms = async (invoice = {}, guestId = null) => {
  try {
    let phone = null;
    if (guestId != null && guestId !== '') {
      const { data } = await supabase.from('guests').select('phone').eq('id', guestId).maybeSingle();
      phone = data?.phone || null;
    }
    const name = invoice.guest || invoice.guest_name;
    if (!phone && name) {
      const { data } = await supabase.from('reservations').select('guest_phone')
        .ilike('guest_name', name).not('guest_phone', 'is', null)
        .order('created_at', { ascending: false }).limit(1);
      phone = data?.[0]?.guest_phone || null;
    }
    if (!phone) return { success: false, skipped: true, error: 'No phone number on file' };

    return sendSmsNotification('payment_received', phone, {
      guestName: name,
      amount: invoice.amount,
      invoiceNumber: invoice.invoiceNumber || (invoice.id && !String(invoice.id).startsWith('local-') ? `#${String(invoice.id).slice(0, 8)}` : undefined),
      roomNumber: invoice.room_number || invoice.room
    });
  } catch (error) {
    console.warn('Payment SMS failed:', error.message);
    return { success: false, error: error.message };
  }
};

/**
 * Staff-initiated message. `event` is a server template (arrival_reminder,
 * checkout_reminder, payment_reminder, service_update) or 'custom' with data.message.
 */
export const sendStaffSms = (event, phone, data = {}, { retryOf } = {}) => {
  const run = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return { success: false, error: 'Not authenticated' };
    try {
      const response = await fetch(`${API_BASE_URL}/sms/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ event, phone, data, retryOf })
      });
      return await response.json().catch(() => ({ success: false, error: `HTTP ${response.status}` }));
    } catch (error) {
      return { success: false, error: error.message };
    }
  };
  return run();
};

// Recent SMS with delivery status refreshed from Arkesel
export const getSmsLog = async (limit = 50) => {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return { success: false, error: 'Not authenticated', data: [] };
  try {
    const response = await fetch(`${API_BASE_URL}/sms/status?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const result = await response.json().catch(() => ({}));
    return response.ok ? result : { success: false, error: result.error || `HTTP ${response.status}`, data: [] };
  } catch (error) {
    return { success: false, error: error.message, data: [] };
  }
};
