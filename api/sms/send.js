// Vercel serverless function: POST /api/sms/send
// Mirrors the Express route in server.js (requires a valid Supabase session token).
const { createClient } = require('@supabase/supabase-js');
const { sendSms, buildMessage } = require('../../server/smsService');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData?.user) {
      return res.status(401).json({ success: false, error: 'Invalid session' });
    }

    const { event, phone, data } = req.body || {};
    const message = buildMessage(event, data);
    if (!phone || !message) {
      return res.status(400).json({ success: false, error: 'Missing or invalid fields: event, phone' });
    }

    const result = await sendSms({ phone, message });
    if (result.skipped) {
      return res.json({ success: true, skipped: true, message: 'SMS service not configured' });
    }
    if (!result.success) {
      return res.status(502).json({ success: false, error: result.error });
    }
    return res.json({ success: true });
  } catch (error) {
    console.error('Error in /api/sms/send:', error);
    return res.status(500).json({ success: false, error: 'Failed to send SMS' });
  }
};
