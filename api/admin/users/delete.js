// Vercel serverless function: POST /api/admin/users/delete
const { handleDeleteUser } = require('../../../server/adminUserHandlers');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }
  try {
    const { status, body } = await handleDeleteUser(req.headers.authorization, req.body || {});
    return res.status(status).json(body);
  } catch (error) {
    console.error('Error in /api/admin/users/delete:', error);
    return res.status(500).json({ success: false, error: 'Request failed' });
  }
};
