const express = require('express');
const http = require('http');
const path = require('path');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const { Server } = require('socket.io');
const bcrypt = require('bcrypt');
const compression = require('compression');

const { initDB, get, all, run } = require('./src/db');
const { checkCustomerFraud, resetDailyQuotaIfNeeded } = require('./src/courierEngine');
const { startHarvesting, stopHarvesting, getHarvestStatus } = require('./src/harvestEngine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Middleware
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session
const sessionMiddleware = session({
    store: new SQLiteStore({ db: 'database.sqlite', concurrentDb: true }),
    secret: 'store-guard-ai-secret-key-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
});

app.use(sessionMiddleware);
io.use((socket, next) => sessionMiddleware(socket.request, {}, next));

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Auth Guard Middlewares
const requireAuth = (req, res, next) => {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized. Please login.' });
    next();
};

const requireAdmin = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden. Admin access required.' });
    }
    next();
};

// -------------------------------------------------------------
// Authentication Endpoints
// -------------------------------------------------------------
app.get('/api/auth/me', (req, res) => {
    if (req.session.user) {
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
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });
        if (user.status !== 'active') return res.status(403).json({ error: 'Account is deactivated' });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(401).json({ error: 'Invalid credentials' });

        req.session.user = {
            id: user.id,
            username: user.username,
            full_name: user.full_name,
            role: user.role
        };

        res.json({ success: true, user: req.session.user });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => {
        res.json({ success: true });
    });
});

// -------------------------------------------------------------
// Manual Fraud Check Endpoint
// -------------------------------------------------------------
app.post('/api/check', async (req, res) => {
    const { phone, orderRef } = req.body;
    if (!phone) return res.status(400).json({ error: 'Phone number is required' });

    try {
        const report = await checkCustomerFraud(phone);
        const userId = req.session.user ? req.session.user.id : null;
        const ref = orderRef || `#ORD-${Math.floor(1000 + Math.random() * 9000)}`;

        // Determine Status Badge for Table
        let statusBadge = 'Safe';
        if (report.riskLevel === 'High Risk') {
            statusBadge = (report.totalCancel >= 5 || report.successRateNumber < 30) ? 'Auto-Blocked' : 'High Risk';
        } else if (report.riskLevel === 'Medium') {
            statusBadge = 'Medium';
        }

        // Save into Verifications log
        const insertResult = await run(`
            INSERT INTO verifications (
                user_id, phone, order_ref, check_type, 
                total_orders, total_delivery, total_cancel, 
                success_rate, risk_level, status_badge, courier_breakdown, created_at
            ) VALUES (?, ?, ?, 'manual', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
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
            JSON.stringify(report.courierBreakdown)
        ]);

        report.logId = insertResult.lastID;
        report.orderRef = ref;
        report.statusBadge = statusBadge;

        // Broadcast to notify all open clients to refresh their logs
        io.emit('log_added');

        res.json({ success: true, report });
    } catch (err) {
        console.error('[API Check] Error:', err);
        res.status(500).json({ error: 'Failed to check customer history' });
    }
});

// -------------------------------------------------------------
// History & Fraud Log API (Multi-User & Central Isolation)
// -------------------------------------------------------------
app.get('/api/logs', async (req, res) => {
    const { dateFilter, search, statusFilter } = req.query;
    const currentUser = req.session.user;

    let sql = `
        SELECT v.*, u.full_name as rep_name, u.username as rep_username
        FROM verifications v
        LEFT JOIN users u ON v.user_id = u.id
        WHERE 1=1
    `;
    const params = [];

    // Role Isolation: Representatives see only their own checked data! Admin sees EVERYTHING.
    if (currentUser && currentUser.role === 'representative') {
        sql += ` AND v.user_id = ?`;
        params.push(currentUser.id);
    }

    // Date Filter (Asia/Dhaka timezone)
    if (dateFilter === 'today') {
        sql += ` AND date(v.created_at, '+6 hours') = date('now', '+6 hours')`;
    } else if (dateFilter === 'yesterday') {
        sql += ` AND date(v.created_at, '+6 hours') = date('now', '+6 hours', '-1 day')`;
    } else if (dateFilter && dateFilter.match(/^\d{4}-\d{2}-\d{2}$/)) {
        sql += ` AND date(v.created_at, '+6 hours') = ?`;
        params.push(dateFilter);
    }

    // Search Filter
    if (search && search.trim() !== '') {
        sql += ` AND (v.phone LIKE ? OR v.order_ref LIKE ?)`;
        params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    // Status Filter
    if (statusFilter && statusFilter !== 'all') {
        sql += ` AND v.status_badge = ?`;
        params.push(statusFilter);
    }

    sql += ` ORDER BY v.id DESC LIMIT 100`;

    try {
        const rows = await all(sql, params);
        res.json({ success: true, logs: rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

app.get('/api/logs/stats', async (req, res) => {
    const currentUser = req.session.user;
    let userConstraint = '';
    const params = [];

    if (currentUser && currentUser.role === 'representative') {
        userConstraint = 'WHERE user_id = ?';
        params.push(currentUser.id);
    }

    try {
        const totalRow = await get(`SELECT COUNT(*) as count FROM verifications ${userConstraint}`, params);
        const autoBlockedRow = await get(
            `SELECT COUNT(*) as count FROM verifications ${userConstraint ? userConstraint + ' AND' : 'WHERE'} status_badge = 'Auto-Blocked'`,
            params
        );
        const manualRow = await get(
            `SELECT COUNT(*) as count FROM verifications ${userConstraint ? userConstraint + ' AND' : 'WHERE'} check_type = 'manual'`,
            params
        );

        res.json({
            success: true,
            totalVerifications: totalRow ? totalRow.count : 0,
            autoBlocked: autoBlockedRow ? autoBlockedRow.count : 0,
            manualChecks: manualRow ? manualRow.count : 0
        });
    } catch (e) {
        res.status(500).json({ error: 'Stats error' });
    }
});

// CSV Export
app.get('/api/logs/export-csv', async (req, res) => {
    const currentUser = req.session.user;
    let sql = `SELECT phone, order_ref, check_type, total_orders, total_delivery, total_cancel, success_rate, status_badge, created_at FROM verifications`;
    const params = [];

    if (currentUser && currentUser.role === 'representative') {
        sql += ` WHERE user_id = ?`;
        params.push(currentUser.id);
    }
    sql += ` ORDER BY id DESC LIMIT 2000`;

    const rows = await all(sql, params);
    let csv = "Order/Ref,Mobile Number,Type,Total Orders,Delivery,Cancel,Success Rate,Status,Date Time\n";
    rows.forEach(r => {
        csv += `"${r.order_ref}","${r.phone}","${r.check_type}",${r.total_orders},${r.total_delivery},${r.total_cancel},"${r.success_rate}%","${r.status_badge}","${r.created_at}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="store_guard_fraud_log.csv"');
    res.send(csv);
});

// -------------------------------------------------------------
// Auto-Harvest Controls
// -------------------------------------------------------------
app.post('/api/harvest/start', async (req, res) => {
    const { targetCount, operators } = req.body;
    const userId = req.session.user ? req.session.user.id : null;
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

// -------------------------------------------------------------
// Admin Management Routes
// -------------------------------------------------------------
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    const users = await all(`SELECT id, username, full_name, role, status, created_at FROM users ORDER BY id DESC`);
    res.json({ success: true, users });
});

app.post('/api/admin/users', requireAdmin, async (req, res) => {
    const { username, password, full_name, role } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const hash = await bcrypt.hash(password, 10);
        const result = await run(
            `INSERT INTO users (username, password, full_name, role, status) VALUES (?, ?, ?, ?, 'active')`,
            [username, hash, full_name || username, role || 'representative']
        );
        res.json({ success: true, userId: result.lastID });
    } catch (e) {
        if (e.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already taken' });
        res.status(500).json({ error: 'Error creating user' });
    }
});

app.post('/api/admin/users/:id/toggle', requireAdmin, async (req, res) => {
    const targetId = parseInt(req.params.id);
    if (targetId === req.session.user.id) return res.status(400).json({ error: 'Cannot deactivate yourself' });

    const user = await get(`SELECT status FROM users WHERE id = ?`, [targetId]);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const nextStatus = user.status === 'active' ? 'deactivated' : 'active';
    await run(`UPDATE users SET status = ? WHERE id = ?`, [nextStatus, targetId]);
    res.json({ success: true, status: nextStatus });
});

app.delete('/api/admin/users/:id', requireAdmin, async (req, res) => {
    const targetId = parseInt(req.params.id);
    if (targetId === req.session.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

    await run(`DELETE FROM users WHERE id = ?`, [targetId]);
    res.json({ success: true });
});

// Global API Keys Pool
app.get('/api/admin/api-keys', requireAdmin, async (req, res) => {
    await resetDailyQuotaIfNeeded();
    const keys = await all(`SELECT * FROM api_keys ORDER BY id DESC`);
    res.json({ success: true, keys });
});

app.post('/api/admin/api-keys', requireAdmin, async (req, res) => {
    const { courierName, keyValue, dailyLimit } = req.body;
    if (!courierName || !keyValue) return res.status(400).json({ error: 'Courier name & key value required' });

    await run(
        `INSERT INTO api_keys (courier_name, key_value, daily_limit, usage_count, status) VALUES (?, ?, ?, 0, 'active')`,
        [courierName, keyValue, parseInt(dailyLimit) || 50]
    );
    res.json({ success: true });
});

app.delete('/api/admin/api-keys/:id', requireAdmin, async (req, res) => {
    await run(`DELETE FROM api_keys WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
});

app.post('/api/admin/api-keys/:id/reset', requireAdmin, async (req, res) => {
    await run(`UPDATE api_keys SET usage_count = 0 WHERE id = ?`, [req.params.id]);
    res.json({ success: true });
});

// Central Customers Intelligence List (Admin View)
app.get('/api/admin/central-customers', requireAdmin, async (req, res) => {
    const { search } = req.query;
    let sql = `SELECT * FROM central_customers`;
    const params = [];
    if (search) {
        sql += ` WHERE phone LIKE ?`;
        params.push(`%${search.trim()}%`);
    }
    sql += ` ORDER BY last_checked_at DESC LIMIT 100`;
    const customers = await all(sql, params);
    res.json({ success: true, customers });
});

// Initialize DB and Start
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
