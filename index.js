const express = require('express');
const http = require('http');

// Crash protection for Puppeteer / WhatsApp Web detached frame exceptions
process.on('uncaughtException', (err) => {
    console.error('🚨 UNCAUGHT EXCEPTION:', err.message);
    if (err.stack) console.error(err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 UNHANDLED REJECTION AT:', promise, 'REASON:', reason);
});

const { Server } = require('socket.io');
const multer = require('multer');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const { initWhatsApp, checkWhatsApp, logoutWhatsApp } = require('./whatsappChecker');
const { checkFraudHistory } = require('./fraudChecker');
const { 
    initDatabase, 
    saveCustomerData, 
    getAllData, 
    deleteCustomerRecord, 
    generateUserExcel,
    addApiKey,
    getApiKeys,
    deleteApiKey,
    resetDailyUsageIfNeeded
} = require('./database');
const { getRandomApiKey } = require('./courierApiManager');

const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const db = require('./sqlite_db');
const compression = require('compression');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Share session with Express and Socket.io
const sessionMiddleware = session({
    store: new SQLiteStore({
        db: 'database.sqlite',
        concurrentDb: true
    }),
    secret: 'super-secret-key-for-saas',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days session
});

// Middleware
app.use(compression());
app.use(express.json());
app.use(sessionMiddleware);

io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

const activeUserIds = new Set();

const checkUserStatus = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    db.get("SELECT plan_status, role FROM users WHERE id = ?", [req.session.userId], (err, user) => {
        if (err || !user || user.plan_status === 'Inactive' || user.plan_status === 'Deactivated') {
            activeUserIds.delete(req.session.userId);
            req.session.destroy(() => {
                res.status(401).json({ error: 'Unauthorized or Account Deactivated' });
            });
        } else {
            next();
        }
    });
};

// Route protection for main app (index.html)
app.get('/', (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login');
    db.get("SELECT plan_status, role FROM users WHERE id = ?", [req.session.userId], (err, user) => {
        if (err || !user || user.plan_status === 'Inactive' || user.plan_status === 'Deactivated') {
            activeUserIds.delete(req.session.userId);
            req.session.destroy(() => {
                res.redirect('/login');
            });
        } else if (user.role === 'admin') {
            res.redirect('/admin');
        } else {
            next();
        }
    });
});

app.get('/index.html', (req, res) => {
    res.redirect('/');
});

app.get(['/dashboard', '/user-login', '/user_login', '/signin', '/signup'], (req, res) => {
    res.redirect('/');
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/preview', express.static(path.join(__dirname, 'ui'), {
    setHeaders: (res, path, stat) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
    }
}));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Setup Multer for file uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

// State
let isChecking = false;
let checkQueue = [];
let currentIndex = 0;
let isUnlimited = false;
let totalCount = 0;
let currentRunResults = [];
let currentRunStats = { found: 0, captured: 0 };
let currentRunTotals = { orders: 0, delivery: 0, cancel: 0 };

// Socket.io for Real-time communication
io.on('connection', (socket) => {
    console.log('Frontend connected.');
    
    // Sync active background scan state
    socket.emit('sync_state', {
        isChecking,
        currentIndex,
        queueLength: checkQueue.length,
        isUnlimited,
        totalCount,
        currentNumber: checkQueue[currentIndex] || '',
        results: currentRunStats,
        totals: currentRunTotals,
        liveResults: currentRunResults
    });

    // Initialize WhatsApp when frontend connects if not already initialized
    initWhatsApp(io).catch(err => console.error("WhatsApp Init Error:", err));

    socket.on('start_random_check', async (data) => {
        if (isChecking) return;
        const userId = socket.request.session.userId;
        isUnlimited = !!data.unlimited;
        totalCount = data.count || (isUnlimited ? 20 : 10);
        
        // Reset run stats
        currentRunResults = [];
        currentRunStats = { found: 0, captured: 0 };
        currentRunTotals = { orders: 0, delivery: 0, cancel: 0 };
        currentIndex = 0;
        
        // Generate random numbers
        checkQueue = [];
        const prefixes = ['017', '019', '018', '016', '013'];
        for (let i = 0; i < totalCount; i++) {
            const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
            const suffix = Math.floor(10000000 + Math.random() * 90000000).toString();
            checkQueue.push(prefix + suffix);
        }
        
        startProcessingQueue(userId);
    });

    socket.on('stop_check', () => {
        isChecking = false;
        isUnlimited = false;
        io.emit('status', { message: 'Checking stopped by user.' });
    });
    
    socket.on('start_manual_check', async (data) => {
        if (isChecking) return;
        const phone = data.phone;
        const userId = socket.request.session.userId;
        if (!phone) return;
        
        checkQueue = [phone];
        startProcessingQueue(userId);
    });

    // API Keys Management Handlers
    socket.on('get_api_keys', async () => {
        const userId = socket.request.session.userId;
        try {
            await resetDailyUsageIfNeeded(userId);
            const keys = await getApiKeys(userId);
            socket.emit('api_keys_list', keys);
        } catch (err) {
            console.error('Error fetching API keys:', err.message);
        }
    });

    socket.on('add_api_key', async (data) => {
        const userId = socket.request.session.userId;
        const { courierName, keyValue } = data;
        if (!courierName || !keyValue) return;
        try {
            await addApiKey(userId, courierName, keyValue);
            const keys = await getApiKeys(userId);
            socket.emit('api_keys_list', keys);
        } catch (err) {
            console.error('Error adding API key:', err.message);
        }
    });

    socket.on('delete_api_key', async (data) => {
        const userId = socket.request.session.userId;
        const { keyId } = data;
        if (!keyId) return;
        try {
            await deleteApiKey(keyId);
            const keys = await getApiKeys(userId);
            socket.emit('api_keys_list', keys);
        } catch (err) {
            console.error('Error deleting API key:', err.message);
        }
    });
});

// File upload endpoint
app.post('/api/upload', checkUserStatus, upload.single('excelFile'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);
        const worksheet = workbook.worksheets[0]; // Get first sheet

        const numbers = [];
        worksheet.eachRow((row, rowNumber) => {
            let cellValue = row.getCell(1).value;
            if (cellValue) {
                let numStr = cellValue.toString().replace(/[^0-9]/g, '');
                // Basic BD number validation
                if (numStr.length >= 11) {
                    if (numStr.startsWith('880')) numStr = numStr.substring(2);
                    if (numStr.length === 11 && numStr.startsWith('01')) {
                        numbers.push(numStr);
                    }
                }
            }
        });

        checkQueue = numbers;
        
        res.json({ success: true, message: `Loaded ${numbers.length} valid numbers from Excel.`, count: numbers.length });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to process Excel file' });
    }
});

// Fetch database grouped by date
app.get('/api/database', checkUserStatus, async (req, res) => {
    try {
        const data = await getAllData(req.session.userId);
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch database.' });
    }
});

// Export Excel database file
app.get('/api/database/export', checkUserStatus, async (req, res) => {
    try {
        const buffer = await generateUserExcel(req.session.userId);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=customer_data.xlsx');
        res.send(buffer);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export database.' });
    }
});

// Delete specific records from database by phone
app.delete('/api/database/delete/:phone', checkUserStatus, async (req, res) => {
    try {
        const success = await deleteCustomerRecord(req.params.phone, req.session.userId);
        if (success) {
            res.json({ success: true, message: 'Record deleted.' });
        } else {
            res.status(404).json({ error: 'Record not found.' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete record.' });
    }
});

// Disconnect WhatsApp
app.post('/api/whatsapp/disconnect', checkUserStatus, async (req, res) => {
    try {
        await logoutWhatsApp(io);
        res.json({ success: true, message: 'WhatsApp Disconnected.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to disconnect WhatsApp.' });
    }
});

// SaaS Authentication Routes
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user || user.role !== 'user') return res.status(401).json({ error: 'Invalid credentials' });
        
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            if (user.plan_status === 'Inactive' || user.plan_status === 'Deactivated') {
                return res.status(403).json({ error: 'Account is deactivated' });
            }
            req.session.userId = user.id;
            req.session.role = user.role;
            activeUserIds.add(user.id);
            res.json({ success: true, role: user.role });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

app.get('/api/logout', (req, res) => {
    if (req.session.userId) {
        activeUserIds.delete(req.session.userId);
    }
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// Admin Login Routes
app.get('/admin/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin_login.html'));
});

app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user || user.role !== 'admin') return res.status(401).json({ error: 'Invalid credentials' });
        
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            req.session.userId = user.id;
            req.session.role = user.role;
            activeUserIds.add(user.id);
            res.json({ success: true, role: user.role });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    });
});

// User Profile Routes
app.get('/api/profile', checkUserStatus, (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    db.get("SELECT id, username, role, email, phone, plan_name, plan_status, plan_expires, profile_pic FROM users WHERE id = ?", [req.session.userId], (err, user) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ success: true, user });
    });
});

app.post('/api/profile/upload-pic', checkUserStatus, upload.single('profilePic'), (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const picPath = '/uploads/' + req.file.filename;
    db.run("UPDATE users SET profile_pic = ? WHERE id = ?", [picPath, req.session.userId], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true, profile_pic: picPath });
    });
});

app.post('/api/profile/remove-pic', checkUserStatus, (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Unauthorized' });
    db.run("UPDATE users SET profile_pic = NULL WHERE id = ?", [req.session.userId], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ success: true });
    });
});

// SaaS Admin Routes
app.get('/admin', (req, res) => {
    if (req.session.role !== 'admin') return res.redirect('/admin/login');
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/api/admin/users', (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    db.all("SELECT id, username, role, plan_status, created_at FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        const usersWithStatus = rows.map(u => ({
            ...u,
            isLoggedIn: activeUserIds.has(u.id)
        }));
        res.json({ success: true, users: usersWithStatus });
    });
});

app.post('/api/admin/users', async (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const { username, password, role, email, phone, plan_name, plan_expires } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    
    try {
        const hash = await bcrypt.hash(password, 10);
        db.run("INSERT INTO users (username, password, role, email, phone, plan_name, plan_expires) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [username, hash, role || 'user', email || '', phone || '', plan_name || 'Free Trial', plan_expires || ''],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Username already exists' });
                    }
                    return res.status(500).json({ error: 'Database error' });
                }
                res.json({ success: true, userId: this.lastID });
            }
        );
    } catch (error) {
        res.status(500).json({ error: 'Hashing error' });
    }
});

app.delete('/api/admin/users/:id', (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const targetId = parseInt(req.params.id);
    if (targetId === req.session.userId) return res.status(400).json({ error: 'Cannot delete yourself' });
    
    db.run("DELETE FROM users WHERE id = ?", [targetId], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        activeUserIds.delete(targetId);
        res.json({ success: true });
    });
});

app.post('/api/admin/users/:id/toggle-status', (req, res) => {
    if (req.session.role !== 'admin') return res.status(403).json({ error: 'Unauthorized' });
    const targetId = parseInt(req.params.id);
    const { status } = req.body; // 'Active' or 'Deactivated'
    if (targetId === req.session.userId) return res.status(400).json({ error: 'Cannot deactivate yourself' });
    
    db.run("UPDATE users SET plan_status = ? WHERE id = ?", [status, targetId], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (status === 'Deactivated' || status === 'Inactive') {
            activeUserIds.delete(targetId);
        }
        res.json({ success: true });
    });
});

// Start processing endpoint
app.post('/api/start', checkUserStatus, (req, res) => {
    if (isChecking) return res.status(400).json({ error: 'Already checking' });
    if (checkQueue.length === 0) return res.status(400).json({ error: 'Queue is empty. Upload a file first.' });
    
    startProcessingQueue(req.session.userId);
    res.json({ success: true, message: 'Processing started.' });
});

async function startProcessingQueue(userId) {
    isChecking = true;
    io.emit('status', { message: 'Checking started...' });

    for (let i = currentIndex; i < checkQueue.length; i++) {
        if (!isChecking) break; // Check if stopped
        currentIndex = i; // Save progress
        
        const phone = checkQueue[i];
        io.emit('progress', { 
            current: i + 1, 
            total: checkQueue.length, 
            isUnlimited: isUnlimited,
            phone: phone,
            status: 'Checking Courier & WhatsApp...' 
        });

        const [courierData, hasWhatsApp] = await Promise.all([
            checkFraudHistory(phone, userId),
            checkWhatsApp(phone)
        ]);
        
        courierData.hasWhatsApp = hasWhatsApp;
        
        // 3. Save to DB
        if (courierData.totalOrders > 0 || hasWhatsApp) {
            await saveCustomerData(courierData, userId);
            // Emit event to trigger auto-refresh on the frontend DatabaseView
            io.emit('db_updated', { phone: phone });
        }

        // Update current run stats
        if (courierData.totalOrders > 0) currentRunStats.found++;
        if (hasWhatsApp) currentRunStats.captured++;
        currentRunTotals.orders += courierData.totalOrders;
        currentRunTotals.delivery += courierData.totalDelivery;
        currentRunTotals.cancel += courierData.totalCancel;
        
        const parsedRate = parseInt(courierData.successRate) || 0;
        currentRunResults.unshift({
            id: Math.random().toString(),
            phone: courierData.phone,
            courier: courierData.courier || '-',
            order: String(courierData.totalOrders),
            delivery: String(courierData.totalDelivery),
            cancel: String(courierData.totalCancel),
            rate: parsedRate,
            whatsapp: hasWhatsApp
        });
        if (currentRunResults.length > 10) currentRunResults.pop();

        // 4. Send Result to Frontend
        io.emit('result', courierData);
        
        // If unlimited and nearing queue end, append more numbers
        if (isUnlimited && i >= checkQueue.length - 2) {
            const prefixes = ['017', '019', '018', '016', '013'];
            for (let k = 0; k < 20; k++) {
                const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
                const suffix = Math.floor(10000000 + Math.random() * 90000000).toString();
                checkQueue.push(prefix + suffix);
            }
        }

        // Delay to prevent ban
        await new Promise(r => setTimeout(r, 1000));
    }
    
    // If we completed the full queue, reset state
    if (currentIndex >= checkQueue.length - 1) {
        isChecking = false;
        checkQueue = [];
        currentIndex = 0;
        io.emit('status', { message: 'Checking completed.' });
    } else {
        isChecking = false;
    }
}

const PORT = 3000;
server.listen(PORT, async () => {
    try {
        await initDatabase();
    } catch (e) {
        console.error("Failed to initialize database:", e.message);
    }
    console.log(`Server running on http://localhost:${PORT}`);
});
