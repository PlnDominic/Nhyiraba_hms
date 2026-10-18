// Vercel serverless function: GET /api/sms/status
const { handleStatus } = require('../../server/smsHandlers');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  try {
    const { status, body } = await handleStatus(req.headers.authorization, req.query || {});
    return res.status(status).json(body);
  } catch (error) {
    console.error('Error in /api/sms/status:', error);
    return res.status(500).json({ success: false, error: 'Failed to load SMS status' });
  }
};
