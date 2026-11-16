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

// Process Crash Protection Shields
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
    secret: 'store-guard-ai-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
});

app.use(sessionMiddleware);
io.use((socket, next) => sessionMiddleware(socket.request, {}, next));

// Serve Static Assets
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Friendly routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public/admin.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public/login.html')));

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
        const user = await get(`SELECT * FROM users WHERE username = ?`, [username]);
        if (!user) return res.status(401).json({ error: 'Invalid username or password' });
        if (user.status !== 'active') return res.status(403).json({ error: 'This account has been deactivated' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid username or password' });

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
// Customer Verification Endpoint (Public & SPA)
// -------------------------------------------------------------
app.post('/api/check', async (req, res) => {
    const { phone, orderRef } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    try {
        const report = await checkCustomerFraud(phone);
        const userId = req.session && req.session.user ? req.session.user.id : null;
        const ref = orderRef || `#ORD-${Math.floor(1000 + Math.random() * 9000)}`;

        let statusBadge = 'Safe';
        if (report.riskLevel === 'High Risk') {
            statusBadge = (report.totalCancel >= 5 || report.successRateNumber < 30) ? 'Auto-Blocked' : 'High Risk';
        } else if (report.riskLevel === 'Medium') {
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
// eCommerceGo SaaS Compatibility Endpoint
// -------------------------------------------------------------
app.all('/api/fraud-check', async (req, res) => {
    const phone = req.body?.phone || req.query?.phone;
    if (!phone) return res.status(400).json({ status: 'error', message: 'Phone number is required' });

    try {
        const report = await checkCustomerFraud(phone);
        res.json({
            status: 'success',
            data: {
                phone: report.phone,
                total_orders: report.totalOrders,
                total_delivery: report.totalDelivery,
                total_cancel: report.totalCancel,
                success_rate: report.successRateNumber,
                risk_level: report.riskLevel,
                courier_details: report.courierBreakdown
            }
        });
    } catch (e) {
        res.status(500).json({ status: 'error', message: e.message });
    }
});

// -------------------------------------------------------------
// Historical Database & Fraud Log (Admin)
// -------------------------------------------------------------
app.get('/api/verifications', async (req, res) => {
    const { date, filter, search, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let sql = `SELECT * FROM verifications WHERE 1=1`;
    const params = [];

    // Date filtering
    if (filter === 'today') {
        sql += ` AND DATE(created_at, '+6 hours') = DATE('now', '+6 hours')`;
    } else if (filter === 'yesterday') {
        sql += ` AND DATE(created_at, '+6 hours') = DATE('now', '+6 hours', '-1 day')`;
    } else if (date) {
        sql += ` AND DATE(created_at, '+6 hours') = ?`;
        params.push(date);
    }

    // Search filtering
    if (search) {
        sql += ` AND (phone LIKE ? OR order_ref LIKE ?)`;
        params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    sql += ` ORDER BY id DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    try {
        const rows = await all(sql, params);
        
        // Aggregate totals for header cards
        const stats = await get(`
            SELECT 
                COUNT(*) as totalChecks,
                SUM(CASE WHEN status_badge = 'Auto-Blocked' THEN 1 ELSE 0 END) as autoBlocked,
                SUM(CASE WHEN check_type = 'manual' THEN 1 ELSE 0 END) as manualChecks
            FROM verifications
        `);

        res.json({
            success: true,
            records: rows.map(r => ({
                ...r,
                courier_breakdown: typeof r.courier_breakdown === 'string' ? JSON.parse(r.courier_breakdown || '[]') : r.courier_breakdown
            })),
            stats: {
                totalChecks: stats?.totalChecks || 0,
                autoBlocked: stats?.autoBlocked || 0,
                manualChecks: stats?.manualChecks || 0
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// CSV Export
app.get('/api/verifications/export', async (req, res) => {
    const rows = await all(`SELECT phone, order_ref, check_type, total_orders, total_delivery, total_cancel, success_rate, risk_level, status_badge, created_at FROM verifications ORDER BY id DESC LIMIT 5000`);
    
    let csv = `Phone,Order_Ref,Type,Total_Orders,Delivery,Cancel,Success_Rate,Risk_Level,Status_Badge,Date\n`;
    rows.forEach(r => {
        csv += `"${r.phone}","${r.order_ref || ''}","${r.check_type}",${r.total_orders},${r.total_delivery},${r.total_cancel},"${r.success_rate}%","${r.risk_level}","${r.status_badge}","${r.created_at}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="store_guard_fraud_log.csv"');
    res.send(csv);
});

// -------------------------------------------------------------
// API Keys Pool Endpoints (With Anti-Spam Tracking)
// -------------------------------------------------------------
app.get('/api/admin/api-keys', async (req, res) => {
    await resetDailyQuotaIfNeeded();
    const keys = await all(`SELECT * FROM api_keys ORDER BY id DESC`);
    res.json({ success: true, keys });
});

app.post('/api/admin/api-keys', async (req, res) => {
    const { courierName, keyValue, dailyLimit } = req.body;
    if (!courierName || !keyValue) return res.status(400).json({ error: 'Courier name & key value required' });

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' });
    await run(
        `INSERT INTO api_keys (courier_name, key_value, daily_limit, usage_count, status, last_reset_date) VALUES (?, ?, ?, 0, 'active', ?)`,
        [courierName, keyValue.trim(), parseInt(dailyLimit) || 50, todayStr]
    );
    res.json({ success: true });
});

app.delete('/api/admin/api-keys/:id', async (req, res) => {
    await run(`DELETE FROM api_keys WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
});

app.post('/api/admin/api-keys/:id/toggle', async (req, res) => {
    const key = await get(`SELECT status FROM api_keys WHERE id = ?`, [req.params.id]);
    if (!key) return res.status(404).json({ error: 'Key not found' });
    const nextStatus = key.status === 'active' ? 'paused' : 'active';
    await run(`UPDATE api_keys SET status = ? WHERE id = ?`, [nextStatus, req.params.id]);
    res.json({ success: true, status: nextStatus });
});

app.post('/api/admin/api-keys/:id/reset', async (req, res) => {
    await run(`UPDATE api_keys SET usage_count = 0 WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
});

// -------------------------------------------------------------
// WhatsApp Checker Endpoints
// -------------------------------------------------------------
let latestQrCode = null;
let isWhatsAppServiceEnabled = false;

app.get('/api/admin/whatsapp/status', (req, res) => {
    res.json({
        enabled: isWhatsAppServiceEnabled,
        qr: latestQrCode
    });
});

app.post('/api/admin/whatsapp/toggle', async (req, res) => {
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

// -------------------------------------------------------------
// User Management Endpoints
// -------------------------------------------------------------
app.get('/api/admin/users', async (req, res) => {
    const users = await all(`SELECT id, username, full_name, role, status, created_at FROM users ORDER BY id DESC`);
    res.json({ success: true, users });
});

app.post('/api/admin/users', async (req, res) => {
    const { username, password, full_name, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await run(
            `INSERT INTO users (username, password, full_name, role, status) VALUES (?, ?, ?, ?, 'active')`,
            [username.trim(), hash, full_name || username.trim(), role || 'representative']
        );
        res.json({ success: true, userId: result.lastID });
    } catch (e) {
        if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already taken' });
        res.status(500).json({ error: 'Failed to create user' });
    }
});

app.post('/api/admin/users/:id/toggle', async (req, res) => {
    const targetId = parseInt(req.params.id);
    const user = await get(`SELECT status FROM users WHERE id = ?`, [targetId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const nextStatus = user.status === 'active' ? 'deactivated' : 'active';
    await run(`UPDATE users SET status = ? WHERE id = ?`, [nextStatus, targetId]);
    res.json({ success: true, status: nextStatus });
});

app.delete('/api/admin/users/:id', async (req, res) => {
    await run(`DELETE FROM users WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
});

// Socket.io for live events
io.on('connection', (socket) => {
    socket.on('register_qr_listener', () => {
        if (latestQrCode) socket.emit('qr_code', latestQrCode);
    });
});

// Catch QR events
io.on('qr_code', (qr) => {
    latestQrCode = qr;
});

// Start Server
const PORT = 3000;
(async () => {
    try {
        await initDB();
        await resetDailyQuotaIfNeeded();
        server.listen(PORT, () => {
            console.log(`🚀 STORE GUARD AI Server running at http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error('Fatal initialization error:', err);
    }
})();
