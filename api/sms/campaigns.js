// Vercel serverless function: GET /api/sms/campaigns
const { handleCampaigns } = require('../../server/smsHandlers');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  try {
    const { status, body } = await handleCampaigns(req.headers.authorization);
    return res.status(status).json(body);
  } catch (error) {
    console.error('Error in /api/sms/campaigns:', error);
    return res.status(500).json({ success: false, error: 'Failed to load campaigns', data: [] });
  }
};
