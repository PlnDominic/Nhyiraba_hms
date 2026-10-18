// Shared request logic for /api/sms/* — used by both the Express server and
// the Vercel serverless functions so they cannot drift apart.
const { createClient } = require('@supabase/supabase-js');
const { sendSms, getSmsStatus, buildMessage } = require('./smsService');

const FINAL_STATUSES = ['DELIVERED', 'NOT_DELIVERED', 'REJECTD', 'PROHIBITED', 'EXPIRED', 'FAILED'];

const getClient = (token) => {
  const url = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (serviceKey) return createClient(url, serviceKey);
  // No service key: act as the logged-in user so RLS policies apply
  return createClient(url, process.env.REACT_APP_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
};

const authenticate = async (authHeader) => {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '');
  if (!token) return { error: { status: 401, body: { success: false, error: 'Authentication required' } } };
  const supabase = getClient(token);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) {
    return { error: { status: 401, body: { success: false, error: 'Invalid session' } } };
  }
  return { supabase, user: data.user };
};

const logSms = async (supabase, row) => {
  const { error } = await supabase.from('sms_logs').insert(row);
  if (error) console.error('Could not write sms_logs row:', error.message);
};

// POST /api/sms/send
const handleSend = async (authHeader, payload = {}) => {
  const auth = await authenticate(authHeader);
  if (auth.error) return auth.error;

  const { event, phone, data } = payload;
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
