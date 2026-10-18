// Shared request logic for /api/sms/* — used by both the Express server and
// the Vercel serverless functions so they cannot drift apart.
const { authenticate, isManager } = require('./auth');
const { sendSms, getSmsStatus, buildMessage } = require('./smsService');

const FINAL_STATUSES = ['DELIVERED', 'NOT_DELIVERED', 'REJECTD', 'PROHIBITED', 'EXPIRED', 'FAILED'];

// Automatic messages sent as a side effect of front-desk actions: any signed-in staff.
const LIFECYCLE_EVENTS = [
  'reservation_created', 'reservation_updated', 'reservation_cancelled',
  'checked_in', 'checked_out', 'no_show', 'payment_received',
];
// Staff-composed messages (free text or reminders) and retries: managers only.
const MANAGER_EVENTS = ['arrival_reminder', 'checkout_reminder', 'payment_reminder', 'service_update', 'custom'];

// Per-user cap so a stolen session cannot drain SMS credit.
const RATE_LIMIT = { windowMinutes: 10, maxMessages: 40 };

const overRateLimit = async (supabase, userId) => {
  const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60000).toISOString();
  const { count, error } = await supabase
    .from('sms_logs')
    .select('id', { count: 'exact', head: true })
    .eq('sent_by', userId)
    .gte('created_at', since);
  return !error && count >= RATE_LIMIT.maxMessages;
};

const logSms = async (supabase, row) => {
  const { error } = await supabase.from('sms_logs').insert(row);
  if (error) console.error('Could not write sms_logs row:', error.message);
};

// POST /api/sms/send
const handleSend = async (authHeader, payload = {}) => {
  const auth = await authenticate(authHeader);
  if (auth.error) return auth.error;

  const { event, phone, data, retryOf } = payload;
  if (!LIFECYCLE_EVENTS.includes(event) && !MANAGER_EVENTS.includes(event)) {
    return { status: 400, body: { success: false, error: 'Unknown message type' } };
  }
  if ((MANAGER_EVENTS.includes(event) || retryOf) && !isManager(auth)) {
    return { status: 403, body: { success: false, error: 'Only managers can send custom messages or reminders' } };
  }
  if (await overRateLimit(auth.supabase, auth.user.id)) {
    return { status: 429, body: { success: false, error: 'Too many messages sent recently. Please wait a few minutes.' } };
  }
  const message = buildMessage(event, data);
  if (!phone || !message) {
    return { status: 400, body: { success: false, error: 'Missing or invalid fields: event, phone' } };
  }

  const result = await sendSms({ phone, message });
  if (result.skipped) {
    return { status: 200, body: { success: true, skipped: true, message: 'SMS service not configured' } };
  }

  await logSms(auth.supabase, {
    event,
    phone: result.recipient || phone,
    message,
    provider_message_id: result.messageId || null,
    status: result.success ? 'SUBMITTING' : 'FAILED',
    error: result.success ? null : result.error,
    sent_by: auth.user.id,
    ...(retryOf ? { retry_of: retryOf } : {}),
  });

  if (!result.success) {
    console.error('Arkesel rejected SMS:', result.error);
    return { status: 502, body: { success: false, error: result.error } };
  }
  return { status: 200, body: { success: true, messageId: result.messageId } };
};

// GET /api/sms/status?limit=20 — recent messages, refreshing any not yet final
const handleStatus = async (authHeader, query = {}) => {
  const auth = await authenticate(authHeader);
  if (auth.error) return auth.error;
  if (!isManager(auth)) {
    return { status: 403, body: { success: false, error: 'Only managers can view the message log' } };
  }

  const limit = Math.min(parseInt(query.limit, 10) || 20, 100);
  const { data: rows, error } = await auth.supabase
    .from('sms_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) return { status: 500, body: { success: false, error: error.message } };

  const pending = rows
    .filter((r) => r.provider_message_id && !FINAL_STATUSES.includes(r.status))
    .slice(0, 10);

  await Promise.all(
    pending.map(async (row) => {
      const res = await getSmsStatus(row.provider_message_id);
      if (!res.success) {
        row.last_check_error = res.error;
        return;
      }
      row.status = res.status;
      row.last_check_error = null;
      await auth.supabase
        .from('sms_logs')
        .update({ status: res.status, status_checked_at: new Date().toISOString() })
        .eq('id', row.id);
    })
  );

  return { status: 200, body: { success: true, data: rows } };
};

module.exports = { handleSend, handleStatus };
