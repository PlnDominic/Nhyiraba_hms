const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Email service
const { sendApprovalEmail, testEmailConfig } = require('./server/emailService');

// SMS service (Arkesel)
const { handleSend, handleStatus, handleBulkSend, handleCampaigns } = require('./server/smsHandlers');

// Server-side authorization (role is read from user_profiles, never from the client)
const { requireAuth, isManager, ADMIN_ROLES } = require('./server/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Supabase client initialization
const supabaseUrl = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({ 
        message: 'Welcome to Nhyiraba Hotel Management System API',
        version: '1.0.0',
        endpoints: {
            rooms: '/api/rooms',
            reservations: '/api/reservations'
        }
    });
});

// ==================== ROOMS API ENDPOINTS ====================

// GET all rooms with optional filters
app.get('/api/rooms', requireAuth(), async (req, res) => {
    try {
        const { status, type, min_price, max_price } = req.query;

        let query = supabase
            .from('rooms')
            .select('*');

        if (status) query = query.eq('status', status);
        if (type) query = query.eq('type', type);
        if (min_price) query = query.gte('price', parseFloat(min_price));
        if (max_price) query = query.lte('price', parseFloat(max_price));

        const { data, error } = await query.order('room_number', { ascending: true });

        if (error) throw error;

        res.json({
            success: true,
            count: data.length,
            data: data
        });
    } catch (error) {
        console.error('Error fetching rooms:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// GET room by ID
app.get('/api/rooms/:id', requireAuth(), async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('rooms')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ 
                success: false, 
                error: 'Room not found' 
            });
        }

        res.json({
            success: true,
            data: data
        });
    } catch (error) {
        console.error('Error fetching room:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// PUT update room
app.put('/api/rooms/:id', requireAuth(), async (req, res) => {
    try {
        const { id } = req.params;

        // Only whitelisted fields; pricing and room definition are manager-only
        const STAFF_FIELDS = ['status', 'guest', 'housekeeping_status'];
        const MANAGER_FIELDS = ['price', 'type', 'capacity', 'amenities', 'room_number'];
        const allowed = isManager(req.auth) ? [...STAFF_FIELDS, ...MANAGER_FIELDS] : STAFF_FIELDS;
        const rejected = Object.keys(req.body || {}).filter(k => !allowed.includes(k) && !['id', 'created_at', 'updated_at'].includes(k));
        if (rejected.length) {
            return res.status(403).json({ success: false, error: `Not allowed to change: ${rejected.join(', ')}` });
        }
        const updateData = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
        updateData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('rooms')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        res.json({
            success: true,
            message: 'Room updated successfully',
            data: data
        });
    } catch (error) {
        console.error('Error updating room:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ==================== RESERVATIONS API ENDPOINTS ====================

// GET all reservations
app.get('/api/reservations', requireAuth(), async (req, res) => {
    try {
        const { status, room_id } = req.query;

        let query = supabase
            .from('reservations')
            .select('*');

        if (status) query = query.eq('status', status);
        if (room_id) query = query.eq('room_id', room_id);

        const { data, error } = await query.order('check_in_date', { ascending: false });

        if (error) throw error;

        res.json({
            success: true,
            count: data.length,
            data: data
        });
    } catch (error) {
        console.error('Error fetching reservations:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message 
        });
    }
});

// ==================== EMAIL API ENDPOINTS ====================

// POST endpoint to send approval email
app.post('/api/send-approval-email', requireAuth(ADMIN_ROLES), async (req, res) => {
    try {
        const { email, fullName, password, hotelName } = req.body;

        if (!email || !fullName || !password) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: email, fullName, password'
            });
        }

        const result = await sendApprovalEmail({
            email,
            fullName,
            password,
            hotelName: hotelName || 'Nhyiraba Hotel Management System'
        });

        if (result.skipped) {
            // Email service not configured, but don't fail the request
            return res.json({
                success: true,
                skipped: true,
                message: 'Email service not configured - email not sent'
            });
        }

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: result.error || 'Failed to send email'
            });
        }

        res.json({
            success: true,
            message: 'Approval email sent successfully',
            messageId: result.messageId
        });

    } catch (error) {
        console.error('Error in send-approval-email endpoint:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to send approval email'
        });
    }
});

// GET endpoint to test email configuration
app.get('/api/test-email', requireAuth(ADMIN_ROLES), async (req, res) => {
    try {
        const isConfigured = await testEmailConfig();
        res.json({
            success: true,
            configured: isConfigured,
            message: isConfigured 
                ? 'Email service is properly configured' 
                : 'Email service not configured. Set EMAIL_USER and EMAIL_PASSWORD in .env'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ==================== SMS API ENDPOINTS ====================

// POST endpoint to send a templated SMS (requires a valid Supabase session token)
app.post('/api/sms/send', async (req, res) => {
    try {
        const { status, body } = await handleSend(req.headers.authorization, req.body);
        res.status(status).json(body);
    } catch (error) {
        console.error('Error in /api/sms/send:', error);
        res.status(500).json({ success: false, error: 'Failed to send SMS' });
    }
});

// GET recent SMS with refreshed delivery status
app.get('/api/sms/status', async (req, res) => {
    try {
        const { status, body } = await handleStatus(req.headers.authorization, req.query);
        res.status(status).json(body);
    } catch (error) {
        console.error('Error in /api/sms/status:', error);
        res.status(500).json({ success: false, error: 'Failed to load SMS status' });
    }
});

// POST endpoint for bulk messages (managers only)
app.post('/api/sms/bulk', async (req, res) => {
    try {
        const { status, body } = await handleBulkSend(req.headers.authorization, req.body);
        res.status(status).json(body);
    } catch (error) {
        console.error('Error in /api/sms/bulk:', error);
        res.status(500).json({ success: false, error: 'Failed to send bulk messages' });
    }
});

// GET recent bulk campaigns with delivery counts
app.get('/api/sms/campaigns', async (req, res) => {
    try {
        const { status, body } = await handleCampaigns(req.headers.authorization);
        res.status(status).json(body);
    } catch (error) {
        console.error('Error in /api/sms/campaigns:', error);
        res.status(500).json({ success: false, error: 'Failed to load campaigns', data: [] });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: 'Something went wrong!'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Nhyiraba Hotel API Server running on http://localhost:${PORT}`);
    console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
