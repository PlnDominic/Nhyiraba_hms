// SMS service using the Arkesel API (https://developers.arkesel.com)
// Message wording lives here so clients can only trigger known templates.

const DEFAULT_API_URL = 'https://sms.arkesel.com/api/v2/sms/send';
const HOTEL_NAME = process.env.HOTEL_NAME || 'Nhyiraba Hotel';

// Normalise Ghana numbers to international format without '+' (e.g. 233241234567)
const normalizePhone = (raw) => {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d]/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 10) digits = `233${digits.slice(1)}`;
  if (digits.length === 9) digits = `233${digits}`;
  return digits.length >= 11 && digits.length <= 15 ? digits : null;
};

const fmtDate = (d) => {
  if (!d) return '';
  const date = new Date(d);
  return Number.isNaN(date.getTime())
    ? String(d)
    : date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const money = (n) => `GHS ${Number(n || 0).toFixed(2)}`;

const templates = {
  reservation_created: (d) =>
    `Hello ${d.guestName}, your reservation at ${HOTEL_NAME} is confirmed. Room ${d.roomNumber}, ${fmtDate(d.checkInDate)} to ${fmtDate(d.checkOutDate)}. Thank you!`,
  reservation_updated: (d) =>
    `Hello ${d.guestName}, your reservation at ${HOTEL_NAME} has been updated. Room ${d.roomNumber}, ${fmtDate(d.checkInDate)} to ${fmtDate(d.checkOutDate)}${d.roomRate ? `, rate ${money(d.roomRate)}/night` : ''}.`,
  reservation_cancelled: (d) =>
    `Hello ${d.guestName}, your reservation at ${HOTEL_NAME} (Room ${d.roomNumber}, ${fmtDate(d.checkInDate)}) has been cancelled.${Number(d.fee) > 0 ? ` Cancellation fee: ${money(d.fee)}.` : ''}`,
  checked_in: (d) =>
    `Welcome to ${HOTEL_NAME}, ${d.guestName}! You are checked in to Room ${d.roomNumber}. Check-out: ${fmtDate(d.checkOutDate)}. Enjoy your stay.`,
  checked_out: (d) =>
    `Thank you for staying at ${HOTEL_NAME}, ${d.guestName}. We hope to see you again soon!`,
  no_show: (d) =>
    `Hello ${d.guestName}, we did not see you for your reservation at ${HOTEL_NAME} on ${fmtDate(d.checkInDate)}, so it has been marked as a no-show. Please contact us to rebook.`,
  payment_received: (d) =>
    `Hello ${d.guestName}, we received your payment of ${money(d.amount)} at ${HOTEL_NAME}. Thank you!`,
};

const buildMessage = (event, data = {}) => {
  const tpl = templates[event];
  return tpl ? tpl({ guestName: 'Guest', ...data }) : null;
};

/**
 * Send an SMS through Arkesel.
 * Returns { success, skipped?, error?, data? } and never throws.
 */
const sendSms = async ({ phone, message }) => {
  const apiKey = process.env.ARKESEL_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ ARKESEL_API_KEY not set - SMS skipped');
    return { success: false, skipped: true };
  }
  const recipient = normalizePhone(phone);
  if (!recipient) return { success: false, error: 'Invalid phone number' };

  try {
    const response = await fetch(process.env.ARKESEL_API_URL || DEFAULT_API_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender: process.env.ARKESEL_SENDER_ID || 'Nhyiraba',
        message,
        recipients: [recipient],
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || (body.status && body.status !== 'success')) {
      return { success: false, error: body.message || `Arkesel error (HTTP ${response.status})` };
    }
    return { success: true, data: body.data };
  } catch (error) {
    console.error('Arkesel SMS error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = { sendSms, buildMessage, normalizePhone, templates };
