// SMS service using the Arkesel API (https://developers.arkesel.com)
// Message wording lives here so clients can only trigger known templates.

const DEFAULT_API_URL = 'https://sms.arkesel.com/api/v2/sms/send';
const HOTEL_NAME = process.env.HOTEL_NAME || 'Nhyiraba Hotel';
const CHECKOUT_TIME = process.env.CHECKOUT_TIME || '10:30 AM';

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
    `Hello ${d.guestName}, your reservation at ${HOTEL_NAME} is confirmed. Room ${d.roomNumber}, ${fmtDate(d.checkInDate)} to ${fmtDate(d.checkOutDate)}. Check-out time: ${CHECKOUT_TIME}. Thank you!`,
  reservation_updated: (d) =>
    `Hello ${d.guestName}, your reservation at ${HOTEL_NAME} has been updated. Room ${d.roomNumber}, ${fmtDate(d.checkInDate)} to ${fmtDate(d.checkOutDate)}${d.roomRate ? `, rate ${money(d.roomRate)}/night` : ''}. Check-out time: ${CHECKOUT_TIME}.`,
  reservation_cancelled: (d) =>
    `Hello ${d.guestName}, your reservation at ${HOTEL_NAME} (Room ${d.roomNumber}, ${fmtDate(d.checkInDate)}) has been cancelled.${Number(d.fee) > 0 ? ` Cancellation fee: ${money(d.fee)}.` : ''}`,
  checked_in: (d) =>
    `Welcome to ${HOTEL_NAME}, ${d.guestName}! You are checked in to Room ${d.roomNumber}. Check-out: ${fmtDate(d.checkOutDate)} by ${CHECKOUT_TIME}. Enjoy your stay.`,
  checked_out: (d) =>
    `Thank you for staying at ${HOTEL_NAME}, ${d.guestName}. We hope to see you again soon!`,
  no_show: (d) =>
    `Hello ${d.guestName}, we did not see you for your reservation at ${HOTEL_NAME} on ${fmtDate(d.checkInDate)}, so it has been marked as a no-show. Please contact us to rebook.`,
  payment_received: (d) =>
    `Hello ${d.guestName}, we received your payment of ${money(d.amount)} at ${HOTEL_NAME}. Thank you!`,
  arrival_reminder: (d) =>
    `Hello ${d.guestName}, a reminder that your stay at ${HOTEL_NAME} begins on ${fmtDate(d.checkInDate)}${d.roomNumber ? ` (Room ${d.roomNumber})` : ''}. We look forward to welcoming you!`,
  checkout_reminder: (d) =>
    `Hello ${d.guestName}, a reminder that check-out at ${HOTEL_NAME} is at ${CHECKOUT_TIME} on ${fmtDate(d.checkOutDate)}. Please contact reception if you need a late check-out.`,
  payment_reminder: (d) =>
    `Hello ${d.guestName}, you have an outstanding balance of ${money(d.amount)} at ${HOTEL_NAME}. Kindly settle it at reception. Thank you.`,
  service_update: (d) =>
    `Hello ${d.guestName}, update from ${HOTEL_NAME}: ${String(d.detail || '').trim()}`,
};

const MAX_CUSTOM_LENGTH = 320;

// 'custom' lets staff write their own text (length-capped); everything else is a fixed template.
const buildMessage = (event, data = {}) => {
  if (event === 'custom') {
    const text = String(data.message || '').trim();
    return text && text.length <= MAX_CUSTOM_LENGTH ? text : null;
  }
  if (event === 'service_update' && !String(data.detail || '').trim()) return null;
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
    const first = Array.isArray(body.data) ? body.data[0] : body.data;
    return {
      success: true,
      data: body.data,
      recipient,
      messageId: first?.id || null,
    };
  } catch (error) {
    console.error('Arkesel SMS error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Look up the delivery status of a message by Arkesel message ID.
 * Returns { success, status?, raw?, error? }. Status is upper-cased
 * (DELIVERED, SUBMITTED, PENDING, QUEUED, NOT_DELIVERED, REJECTD, ...).
 */
const getSmsStatus = async (messageId) => {
  const apiKey = process.env.ARKESEL_API_KEY;
  if (!apiKey || !messageId) return { success: false, error: 'Missing API key or message id' };
  try {
    const base = (process.env.ARKESEL_API_URL || DEFAULT_API_URL).replace(/\/send\/?$/, '');
    const response = await fetch(`${base}/${encodeURIComponent(messageId)}`, {
      headers: { 'api-key': apiKey },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { success: false, error: body.message || `HTTP ${response.status}`, raw: body };
    }
    const d = Array.isArray(body.data) ? body.data[0] : body.data || body;
    const status = d?.status || d?.delivery_status || d?.state;
    return status
      ? { success: true, status: String(status).toUpperCase(), raw: body }
      : { success: false, error: 'Status not found in response', raw: body };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Bulk messages are written by staff; {name} becomes each recipient's first name.
const personalise = (template, name) => {
  const first = String(name || '').trim().split(/\s+/)[0] || 'Guest';
  return String(template).replace(/\{name\}/gi, first.slice(0, 30));
};
const hasPlaceholder = (template) => /\{name\}/i.test(template);

/**
 * Send one message to many numbers in a single Arkesel request.
 * `recipients` must already be normalised. Returns { skipped? } or
 * { results: [{ recipient, success, messageId?, error? }] } and never throws.
 */
const sendSmsBatch = async ({ recipients, message }) => {
  const apiKey = process.env.ARKESEL_API_KEY;
  if (!apiKey) return { success: false, skipped: true, results: [] };
  const failAll = (error) => ({ success: false, results: recipients.map((recipient) => ({ recipient, success: false, error })) });
  try {
    const response = await fetch(process.env.ARKESEL_API_URL || DEFAULT_API_URL, {
      method: 'POST',
      headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: process.env.ARKESEL_SENDER_ID || 'Nhyiraba', message, recipients }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || (body.status && body.status !== 'success')) {
      return failAll(body.message || `Arkesel error (HTTP ${response.status})`);
    }
    const items = Array.isArray(body.data) ? body.data : body.data ? [body.data] : [];
    const results = recipients.map((recipient, i) => {
      const hit = items.find((item) => normalizePhone(item.recipient || item.phone) === recipient)
        || (items.length === recipients.length ? items[i] : null);
      return { recipient, success: true, messageId: hit?.id || null };
    });
    return { success: true, results };
  } catch (error) {
    console.error('Arkesel batch SMS error:', error);
    return failAll(error.message);
  }
};

module.exports = { sendSms, sendSmsBatch, getSmsStatus, buildMessage, normalizePhone, personalise, hasPlaceholder, templates };
