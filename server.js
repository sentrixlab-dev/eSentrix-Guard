const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const compression = require('compression');

const { initDB, get, all, run } = require('./src/db');
const { checkCustomerFraud, resetDailyQuotaIfNeeded } = require('./src/courierEngine');
const { initWhatsApp, checkWhatsApp, logoutWhatsApp } = require('./whatsappChecker');
const { startHarvesting, stopHarvesting, getHarvestStatus } = require('./src/harvestEngine');

// Crash Protection Shields
process.on('uncaughtException', (err) => {
    console.error('[CRASH SHIELD] Uncaught Exception:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('[CRASH SHIELD] Unhandled Rejection:', reason);
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Store
const sessionMiddleware = session({
    store: new SQLiteStore({ db: 'database.sqlite', concurrentDb: true }),
    secret: 'ecom-centrix-cart-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
});

app.use(sessionMiddleware);
io.use((socket, next) => sessionMiddleware(socket.request, {}, next));

// Serve Static Assets (Disable auto-serving index.html so auth guard on '/' works)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Friendly routes
app.get('/', (req, res) => {
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    res.sendFile(path.join(__dirname, 'public/index.html'));
});
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));
app.get('/admin', (req, res) => {
    // Only allow admin role to access /admin
    if (!req.session || !req.session.user) {
        return res.redirect('/login');
    }
    if (req.session.user.role !== 'admin') {
        return res.redirect('/');
    }
    res.sendFile(path.join(__dirname, 'public/admin.html'));
});

// Auth Guard Middlewares
const requireAuth = (req, res, next) => {
    if (!req.session || !req.session.user) return res.status(401).json({ error: 'Unauthorized. Please login.' });
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden. Admin access required.' });
    }
    next();
};

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------
app.get('/api/auth/me', (req, res) => {
    if (req.session && req.session.user) {
        res.json({ success: true, user: req.session.user });
    } else {
        res.json({ success: true, user: null });
    }
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username & password required' });

    try {
        const user = await get(`SELECT * FROM users WHERE username = ?`, [username.trim()]);
        if (!user) return res.status(401).json({ error: 'ভুল ইউজারনেম বা পাসওয়ার্ড' });
        if (user.status !== 'active') return res.status(403).json({ error: 'এই অ্যাকাউন্টটি নিষ্ক্রিয় করা হয়েছে' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'ভুল ইউজারনেম বা পাসওয়ার্ড' });

        req.session.user = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role
        };

        res.json({ success: true, user: req.session.user });
    } catch (e) {
        console.error('[Auth Error]', e);
        res.status(500).json({ error: 'Server authentication error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// -------------------------------------------------------------
// Customer Verification Endpoint
// -------------------------------------------------------------
app.post('/api/check', async (req, res) => {
    const { phone, orderRef } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    try {
        const report = await checkCustomerFraud(phone);
        const userId = req.session && req.session.user ? req.session.user.id : null;
        const ref = orderRef || `#ORD-${Math.floor(1000 + Math.random() * 9000)}`;

        // Clean status badge: High Risk, Medium, or Safe (No "Auto-Blocked")
        let statusBadge = 'Safe';
        if (report.riskLevel === 'High Risk' || report.successRateNumber < 50) {
            statusBadge = 'High Risk';
        } else if (report.riskLevel === 'Medium' || report.successRateNumber < 80) {
            statusBadge = 'Medium';
        }

        // Strict rule: ONLY store in verifications if totalOrders > 0
        if (report.totalOrders > 0) {
            await run(`
                INSERT INTO verifications (
                    user_id, phone, order_ref, check_type, 
                    total_orders, total_delivery, total_cancel, 
                    success_rate, risk_level, status_badge, courier_breakdown, has_whatsapp, created_at
                ) VALUES (?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                userId,
                report.phone,
                ref,
                report.totalOrders,
                report.totalDelivery,
                report.totalCancel,
                report.successRateNumber,
                report.riskLevel,
                statusBadge,
                JSON.stringify(report.courierBreakdown),
                report.hasWhatsApp ? 1 : 0
            ]);
        }

        res.json({ success: true, data: report });
    } catch (err) {
        console.error('[Check API Error]', err);
        res.status(500).json({ error: 'Failed to complete courier check', details: err.message });
    }
});

// -------------------------------------------------------------
// User-Specific Endpoints (For Front-End SPA User Experience)
// -------------------------------------------------------------

// User's own search history
app.get('/api/user/verifications', async (req, res) => {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    const { search, limit = 20, page = 1 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `SELECT * FROM verifications WHERE 1=1`;
    const params = [];

    if (userId) {
        sql += ` AND user_id = ?`;
        params.push(userId);
    }
    if (search) {
        sql += ` AND (phone LIKE ? OR order_ref LIKE ?)`;
        params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    try {
        const rows = await all(sql, params);
        res.json({
            success: true,
            records: rows.map(r => ({
                ...r,
                courier_breakdown: typeof r.courier_breakdown === 'string' ? JSON.parse(r.courier_breakdown || '[]') : r.courier_breakdown
            }))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// User's own analytics summary
app.get('/api/user/analytics', async (req, res) => {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    let sql = `SELECT 
        COUNT(*) as totalChecks,
        SUM(CASE WHEN risk_level = 'High Risk' OR success_rate < 50 THEN 1 ELSE 0 END) as highRiskCount,
        SUM(CASE WHEN risk_level = 'Safe' AND success_rate >= 80 THEN 1 ELSE 0 END) as safeCount,
        SUM(CASE WHEN risk_level = 'Medium' OR (success_rate >= 50 AND success_rate < 80) THEN 1 ELSE 0 END) as mediumCount,
        AVG(success_rate) as avgSuccessRate
    FROM verifications`;

    const params = [];
    if (userId) {
        sql += ` WHERE user_id = ?`;
        params.push(userId);
    }

    try {
        const stats = await get(sql, params);
        res.json({
            success: true,
            analytics: {
                totalChecks: stats?.totalChecks || 0,
                highRiskCount: stats?.highRiskCount || 0,
                safeCount: stats?.safeCount || 0,
                mediumCount: stats?.mediumCount || 0,
                avgSuccessRate: stats?.avgSuccessRate ? Math.round(stats.avgSuccessRate) : 0
            }
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// User's blacklist
app.get('/api/user/blacklist', async (req, res) => {
    const userId = req.session && req.session.user ? req.session.user.id : null;
    let sql = `SELECT DISTINCT phone, total_orders, total_cancel, success_rate, risk_level, created_at 
               FROM verifications 
               WHERE (risk_level = 'High Risk' OR success_rate < 50)`;
    const params = [];
    if (userId) {
        sql += ` AND user_id = ?`;
        params.push(userId);
    }
    sql += ` ORDER BY id DESC LIMIT 50`;

    try {
        const rows = await all(sql, params);
        res.json({ success: true, blacklist: rows });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// User profile update
app.post('/api/user/profile', requireAuth, async (req, res) => {
    const { fullName, newPassword } = req.body;
    const userId = req.session.user.id;

    try {
        if (newPassword && newPassword.trim().length >= 4) {
            const hash = await bcrypt.hash(newPassword.trim(), 10);
            await run(`UPDATE users SET full_name = ?, password = ? WHERE id = ?`, [fullName, hash, userId]);
        } else {
            await run(`UPDATE users SET full_name = ? WHERE id = ?`, [fullName, userId]);
        }
        req.session.user.full_name = fullName;
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// -------------------------------------------------------------
// Central Intelligence Admin Hub Endpoints
// -------------------------------------------------------------
app.get('/api/verifications', requireAdmin, async (req, res) => {
    const { date, filter, search, page = 1, limit = 30 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `SELECT v.*, u.username as checked_by FROM verifications v LEFT JOIN users u ON v.user_id = u.id WHERE 1=1`;
    const params = [];

    if (filter === 'today') {
        sql += ` AND DATE(v.created_at, '+6 hours') = DATE('now', '+6 hours')`;
    } else if (filter === 'yesterday') {
        sql += ` AND DATE(v.created_at, '+6 hours') = DATE('now', '+6 hours', '-1 day')`;
    } else if (date) {
        sql += ` AND DATE(v.created_at, '+6 hours') = ?`;
        params.push(date);
    }

    if (search) {
        sql += ` AND (v.phone LIKE ? OR v.order_ref LIKE ? OR u.username LIKE ?)`;
        params.push(`%${search.trim()}%`, `%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ` ORDER BY v.id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    try {
        const rows = await all(sql, params);
        res.json({
            success: true,
            records: rows.map(r => ({
                ...r,
                courier_breakdown: typeof r.courier_breakdown === 'string' ? JSON.parse(r.courier_breakdown || '[]') : r.courier_breakdown
            }))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Central CSV Export
app.get('/api/verifications/export', async (req, res) => {
    const rows = await all(`SELECT phone, order_ref, check_type, total_orders, total_delivery, total_cancel, success_rate, risk_level, status_badge, created_at FROM verifications ORDER BY id DESC LIMIT 5000`);
    
    let csv = `Phone,Order_Ref,Type,Total_Orders,Delivery,Cancel,Success_Rate,Risk_Level,Status_Badge,Date\n`;
    rows.forEach(r => {
        csv += `"${r.phone}","${r.order_ref || ''}","${r.check_type}",${r.total_orders},${r.total_delivery},${r.total_cancel},"${r.success_rate}%","${r.risk_level}","${r.status_badge}","${r.created_at}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="ecom_centrix_fraud_log.csv"');
    res.send(csv);
});

// API Keys Pool
app.get('/api/admin/api-keys', requireAdmin, async (req, res) => {
    await resetDailyQuotaIfNeeded();
    const keys = await all(`SELECT * FROM api_keys ORDER BY id DESC`);
    res.json({ success: true, keys });
});

app.post('/api/admin/api-keys', requireAdmin, async (req, res) => {
    const { courierName, keyValue, dailyLimit } = req.body;
    if (!courierName || !keyValue) return res.status(400).json({ error: 'Courier name & key value required' });

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
    await run(
        `INSERT INTO api_keys (courier_name, key_value, daily_limit, usage_count, status, last_reset_date) VALUES (?, ?, ?, 0, 'active', ?)`,
        [courierName, keyValue.trim(), parseInt(dailyLimit) || 50, todayStr]
    );
    res.json({ success: true });
});

app.delete('/api/admin/api-keys/:id', requireAdmin, async (req, res) => {
    await run(`DELETE FROM api_keys WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
});

app.post('/api/admin/api-keys/:id/toggle', requireAdmin, async (req, res) => {
    const key = await get(`SELECT status FROM api_keys WHERE id = ?`, [req.params.id]);
    if (!key) return res.status(404).json({ error: 'Key not found' });
    const nextStatus = key.status === 'active' ? 'paused' : 'active';
    await run(`UPDATE api_keys SET status = ? WHERE id = ?`, [nextStatus, req.params.id]);
    res.json({ success: true, status: nextStatus });
});

app.post('/api/admin/api-keys/:id/reset', requireAdmin, async (req, res) => {
    await run(`UPDATE api_keys SET usage_count = 0 WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
});

// WhatsApp
let latestQrCode = null;
let isWhatsAppServiceEnabled = false;

app.get('/api/admin/whatsapp/status', requireAdmin, (req, res) => {
    res.json({
        enabled: isWhatsAppServiceEnabled,
        qr: latestQrCode
    });
});

app.post('/api/admin/whatsapp/toggle', requireAdmin, async (req, res) => {
    const { enable } = req.body;
    isWhatsAppServiceEnabled = !!enable;

    if (isWhatsAppServiceEnabled) {
        initWhatsApp(io).catch(err => console.error('[WhatsApp Init Error]', err));
    } else {
        await logoutWhatsApp(io);
        latestQrCode = null;
    }
    res.json({ success: true, enabled: isWhatsAppServiceEnabled });
});

// User Management
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    const users = await all(`SELECT id, username, full_name, role, status, plain_password, created_at FROM users ORDER BY id DESC`);
    res.json({ success: true, users });
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
    const { username, password, full_name, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await run(
            `INSERT INTO users (username, password, plain_password, full_name, role, status) VALUES (?, ?, ?, ?, ?, 'active')`,
            [username.trim(), hash, password.trim(), full_name || username.trim(), role || 'user']
        );
        res.json({ success: true, userId: result.lastID });
    } catch (e) {
        if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already taken' });
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.post('/api/admin/users/:id/password', requireAdmin, async (req, res) => {
    const targetId = parseInt(req.params.id);
    const { password } = req.body;
    if (!password || password.trim().length < 3) {
        return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৩ অক্ষরের হতে হবে' });
    }
    const user = await get(`SELECT id FROM users WHERE id = ?`, [targetId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    try {
        const hash = await bcrypt.hash(password.trim(), 10);
        await run(`UPDATE users SET password = ?, plain_password = ? WHERE id = ?`, [hash, password.trim(), targetId]);
        res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে', password: password.trim() });
    } catch (e) {
        res.status(500).json({ error: 'পাসওয়ার্ড আপডেট করতে ব্যর্থ হয়েছে' });
    }
});

app.put('/api/admin/users/:id/password', requireAdmin, async (req, res) => {
    const targetId = parseInt(req.params.id);
    const { password } = req.body;
    if (!password || password.trim().length < 3) {
        return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৩ অক্ষরের হতে হবে' });
    }
    const user = await get(`SELECT id FROM users WHERE id = ?`, [targetId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    try {
        const hash = await bcrypt.hash(password.trim(), 10);
        await run(`UPDATE users SET password = ?, plain_password = ? WHERE id = ?`, [hash, password.trim(), targetId]);
        res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে', password: password.trim() });
    } catch (e) {
        res.status(500).json({ error: 'পাসওয়ার্ড আপডেট করতে ব্যর্থ হয়েছে' });
    }
});

app.post('/api/admin/users/:id/toggle', requireAdmin, async (req, res) => {
    const targetId = parseInt(req.params.id);
    const user = await get(`SELECT status FROM users WHERE id = ?`, [targetId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const nextStatus = user.status === 'active' ? 'deactivated' : 'active';
    await run(`UPDATE users SET status = ? WHERE id = ?`, [nextStatus, targetId]);
    res.json({ success: true, status: nextStatus });
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    await run(`DELETE FROM users WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
});

// Automated Bulk Harvester / Scraper Controls
app.post('/api/harvest/start', async (req, res) => {
    const { targetCount, operators } = req.body;
    const userId = req.session && req.session.user ? req.session.user.id : null;
    const result = await startHarvesting(io, { targetCount, operators, userId });
    res.json(result);
});

app.post('/api/harvest/stop', async (req, res) => {
    const result = await stopHarvesting(io);
    res.json(result);
});

app.get('/api/harvest/status', async (req, res) => {
    const status = await getHarvestStatus();
    res.json({ success: true, status });
});

// Socket listeners
io.on('connection', (socket) => {
    socket.on('register_qr_listener', () => {
        if (latestQrCode) socket.emit('qr_code', latestQrCode);
    });
});
io.on('qr_code', (qr) => { latestQrCode = qr; });

// Start Server
const PORT = process.env.PORT || 3050;
(async () => {
    try {
        await initDB();
        await resetDailyQuotaIfNeeded();
        server.listen(PORT, () => {
            console.log(`🚀 eSentrix Guard Server running at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Fatal initialization error:', err);
    }
})();
