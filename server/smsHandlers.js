// Shared request logic for /api/sms/* — used by both the Express server and
// the Vercel serverless functions so they cannot drift apart.
const { authenticate, isManager } = require('./auth');
const crypto = require('node:crypto');
const { sendSms, sendSmsBatch, getSmsStatus, buildMessage, normalizePhone, personalise, hasPlaceholder } = require('./smsService');

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
    .not('event', 'like', 'bulk_%')
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
    .not('event', 'like', 'bulk_%')
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

// ---------------------------------------------------------------------------
// Bulk messaging (promotions, programmes, announcements)
// ---------------------------------------------------------------------------
const BULK_CAMPAIGNS = ['promotion', 'programme', 'announcement', 'other'];
const BULK_LIMITS = {
  maxRecipients: 500,
  maxTemplate: 320,
  dailyMessages: parseInt(process.env.BULK_SMS_DAILY_LIMIT, 10) || 1000,
};
const BATCH_SIZE = 100;
const CONCURRENCY = 5;
const FAILED_STATUSES = ['FAILED', 'NOT_DELIVERED', 'REJECTD', 'PROHIBITED', 'EXPIRED'];

const bulkSentToday = async (supabase, userId) => {
  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const { count, error } = await supabase
    .from('sms_logs')
    .select('id', { count: 'exact', head: true })
    .eq('sent_by', userId)
    .like('event', 'bulk_%')
    .gte('created_at', since);
  return error ? 0 : count || 0;
};

// New columns may not exist yet on a database that has not run the bulk migration.
const insertLogRows = async (supabase, rows) => {
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await supabase.from('sms_logs').insert(rows.slice(i, i + 200));
    if (error) console.error('Could not write bulk sms_logs rows:', error.message);
  }
};

// POST /api/sms/bulk
const handleBulkSend = async (authHeader, payload = {}) => {
  const auth = await authenticate(authHeader);
  if (auth.error) return auth.error;
  if (!isManager(auth)) {
    return { status: 403, body: { success: false, error: 'Only managers can send bulk messages' } };
  }

  const { campaign, name, message, recipients } = payload;
  const template = String(message || '').trim();
  if (!BULK_CAMPAIGNS.includes(campaign)) {
    return { status: 400, body: { success: false, error: 'Unknown campaign type' } };
  }
  if (!template || template.length > BULK_LIMITS.maxTemplate) {
    return { status: 400, body: { success: false, error: `Message must be 1-${BULK_LIMITS.maxTemplate} characters` } };
  }
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return { status: 400, body: { success: false, error: 'Choose at least one recipient' } };
  }
  if (recipients.length > BULK_LIMITS.maxRecipients) {
    return { status: 400, body: { success: false, error: `Send to at most ${BULK_LIMITS.maxRecipients} people at a time` } };
  }

  // Normalise and de-duplicate by phone number
  const seen = new Set();
  const valid = [];
  const invalid = [];
  let duplicates = 0;
  recipients.forEach((r) => {
    const phone = normalizePhone(r?.phone);
    if (!phone) { invalid.push(String(r?.phone ?? '').slice(0, 30)); return; }
    if (seen.has(phone)) { duplicates += 1; return; }
    seen.add(phone);
    valid.push({ phone, name: String(r?.name || '').slice(0, 60) });
  });
  if (valid.length === 0) {
    return { status: 400, body: { success: false, error: 'None of the phone numbers are valid', invalid } };
  }

  const remaining = BULK_LIMITS.dailyMessages - (await bulkSentToday(auth.supabase, auth.user.id));
  if (valid.length > remaining) {
    return {
      status: 429,
      body: { success: false, error: `Daily bulk limit reached. You can send ${Math.max(remaining, 0)} more message(s) in the next 24 hours.` },
    };
  }
  if (!process.env.ARKESEL_API_KEY) {
    return { status: 200, body: { success: true, skipped: true, message: 'SMS service not configured' } };
  }

  const campaignId = crypto.randomUUID();
  const { error: campaignError } = await auth.supabase.from('sms_campaigns').insert({
    id: campaignId,
    name: String(name || '').trim().slice(0, 80) || null,
    type: campaign,
    message: template,
    total: valid.length,
    created_by: auth.user.id,
  });
  if (campaignError) {
    console.error('Could not create sms_campaigns row:', campaignError.message);
    return { status: 500, body: { success: false, error: 'Bulk messaging is not set up yet. Ask an administrator to run the bulk SMS migration.' } };
  }

  // Send: one message per person when personalised, otherwise one request per batch of 100
  const outcomes = []; // { phone, message, result }
  if (hasPlaceholder(template)) {
    let next = 0;
    const worker = async () => {
      while (next < valid.length) {
        const r = valid[next]; next += 1;
        const text = personalise(template, r.name);
        const result = await sendSms({ phone: r.phone, message: text });
        outcomes.push({ phone: r.phone, message: text, result: { success: !!result.success, messageId: result.messageId, error: result.error } });
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, valid.length) }, worker));
  } else {
    for (let i = 0; i < valid.length; i += BATCH_SIZE) {
      const chunk = valid.slice(i, i + BATCH_SIZE).map((r) => r.phone);
      const batch = await sendSmsBatch({ recipients: chunk, message: template });
      batch.results.forEach((result) => outcomes.push({ phone: result.recipient, message: template, result }));
    }
  }

  const sent = outcomes.filter((o) => o.result.success).length;
  const failed = outcomes.length - sent;
  await insertLogRows(auth.supabase, outcomes.map((o) => ({
    event: `bulk_${campaign}`,
    phone: o.phone,
    message: o.message,
    provider_message_id: o.result.messageId || null,
    status: o.result.success ? 'SUBMITTING' : 'FAILED',
    error: o.result.success ? null : o.result.error,
    sent_by: auth.user.id,
    campaign_id: campaignId,
  })));
  await auth.supabase.from('sms_campaigns').update({ submitted: sent, failed }).eq('id', campaignId);

  return {
    status: 200,
    body: { success: failed < outcomes.length, campaignId, total: valid.length, sent, failed, duplicates, invalid },
  };
};

// GET /api/sms/campaigns — recent bulk campaigns with delivery counts
const handleCampaigns = async (authHeader) => {
  const auth = await authenticate(authHeader);
  if (auth.error) return auth.error;
  if (!isManager(auth)) {
    return { status: 403, body: { success: false, error: 'Only managers can view campaigns' } };
  }

  const { data: campaigns, error } = await auth.supabase
    .from('sms_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return { status: 500, body: { success: false, error: error.message, data: [] } };
  if (!campaigns.length) return { status: 200, body: { success: true, data: [] } };

  const { data: rows } = await auth.supabase
    .from('sms_logs')
    .select('id, campaign_id, status, provider_message_id')
    .in('campaign_id', campaigns.map((c) => c.id))
    .limit(5000);
  const logs = rows || [];

  // Refresh a few still-pending messages so counts move towards their final state
  const pending = logs.filter((r) => r.provider_message_id && !FINAL_STATUSES.includes(r.status)).slice(0, 20);
  await Promise.all(pending.map(async (row) => {
    const res = await getSmsStatus(row.provider_message_id);
    if (!res.success) return;
    row.status = res.status;
    await auth.supabase.from('sms_logs').update({ status: res.status, status_checked_at: new Date().toISOString() }).eq('id', row.id);
  }));

  const data = campaigns.map((c) => {
    const mine = logs.filter((r) => r.campaign_id === c.id);
    return {
      ...c,
      stats: {
        delivered: mine.filter((r) => r.status === 'DELIVERED').length,
        failed: mine.filter((r) => FAILED_STATUSES.includes(r.status)).length,
        pending: mine.filter((r) => !FINAL_STATUSES.includes(r.status)).length,
      },
    };
  });
  return { status: 200, body: { success: true, data } };
};

module.exports = { handleSend, handleStatus, handleBulkSend, handleCampaigns, BULK_LIMITS };

