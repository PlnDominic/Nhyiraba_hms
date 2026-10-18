// Vercel serverless function: POST /api/sms/send
const { handleSend } = require('../../server/smsHandlers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  try {
    const { status, body } = await handleSend(req.headers.authorization, req.body || {});
    return res.status(status).json(body);
  } catch (error) {
    console.error('Error in /api/sms/send:', error);
    return res.status(500).json({ success: false, error: 'Failed to send SMS' });
  }
};
