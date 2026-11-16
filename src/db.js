const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, '..', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Enable WAL mode for high concurrency
db.run("PRAGMA journal_mode = WAL;");
db.run("PRAGMA busy_timeout = 5000;");

// Helper wrapper for async sqlite queries
function run(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function get(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
}

function all(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
}

async function addColumnIfNotExists(table, column, definition) {
    try {
        await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    } catch (e) {
        // Ignored if column already exists
    }
}

async function initDB() {
    // 1. Users Table
    await run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT,
        role TEXT DEFAULT 'representative', -- 'admin' or 'representative'
        status TEXT DEFAULT 'active',        -- 'active' or 'deactivated'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Ensure columns exist in case table was created previously
    await addColumnIfNotExists('users', 'full_name', 'TEXT');
    await addColumnIfNotExists('users', 'status', "TEXT DEFAULT 'active'");

    // 2. Central Customers Table (Global Intelligence DB)
    await run(`CREATE TABLE IF NOT EXISTS central_customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        phone TEXT UNIQUE NOT NULL,
        total_orders INTEGER DEFAULT 0,
        total_delivery INTEGER DEFAULT 0,
        total_cancel INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 0,
        risk_level TEXT DEFAULT 'Unknown',
        courier_details TEXT DEFAULT '{}',
        has_whatsapp BOOLEAN DEFAULT 0,
        last_checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await run(`CREATE INDEX IF NOT EXISTS idx_customers_phone ON central_customers(phone)`);

    // 3. Verifications Table (Audit Trail for Representatives & Automations)
    await run(`CREATE TABLE IF NOT EXISTS verifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        phone TEXT NOT NULL,
        order_ref TEXT,
        check_type TEXT DEFAULT 'manual', -- 'manual', 'auto_harvest', 'excel_upload'
        total_orders INTEGER DEFAULT 0,
        total_delivery INTEGER DEFAULT 0,
        total_cancel INTEGER DEFAULT 0,
        success_rate REAL DEFAULT 0,
        risk_level TEXT DEFAULT 'Safe',
        status_badge TEXT DEFAULT 'Safe',
        courier_breakdown TEXT DEFAULT '[]',
        has_whatsapp BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
    )`);
    await run(`CREATE INDEX IF NOT EXISTS idx_verifications_user ON verifications(user_id)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_verifications_phone ON verifications(phone)`);
    await run(`CREATE INDEX IF NOT EXISTS idx_verifications_date ON verifications(created_at)`);

    // 4. Global API Keys Pool
    await run(`CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        courier_name TEXT NOT NULL,
        key_value TEXT NOT NULL,
        daily_limit INTEGER DEFAULT 50,
        usage_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        last_reset_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    await addColumnIfNotExists('api_keys', 'daily_limit', 'INTEGER DEFAULT 50');
    await addColumnIfNotExists('api_keys', 'last_reset_date', 'TEXT');

    // 5. Harvest Jobs / Crawler State
    await run(`CREATE TABLE IF NOT EXISTS harvest_state (
        id INTEGER PRIMARY KEY,
        is_running BOOLEAN DEFAULT 0,
        target_count INTEGER DEFAULT 0,
        processed_count INTEGER DEFAULT 0,
        hits_found INTEGER DEFAULT 0,
        current_phone TEXT,
        selected_operators TEXT DEFAULT 'all',
        last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Ensure state row exists
    const state = await get(`SELECT id FROM harvest_state WHERE id = 1`);
    if (!state) {
        await run(`INSERT INTO harvest_state (id, is_running, target_count, processed_count, hits_found) VALUES (1, 0, 0, 0, 0)`);
    }

    // Default Admin User
    const admin = await get(`SELECT id FROM users WHERE username = 'admin'`);
    if (!admin) {
        const hash = await bcrypt.hash('admin123', 10);
        await run(`INSERT INTO users (username, password, full_name, role, status) VALUES (?, ?, ?, ?, ?)`,
            ['admin', hash, 'Super Administrator', 'admin', 'active']
        );
        console.log('[DB] Default admin created (admin / admin123)');
    } else {
        // Update admin full_name and role if needed
        await run(`UPDATE users SET full_name = 'Super Administrator', role = 'admin', status = 'active' WHERE username = 'admin'`);
    }

    // Default Representative for testing
    const rep = await get(`SELECT id FROM users WHERE username = 'rep1'`);
    if (!rep) {
        const hash = await bcrypt.hash('rep123', 10);
        await run(`INSERT INTO users (username, password, full_name, role, status) VALUES (?, ?, ?, ?, ?)`,
            ['rep1', hash, 'Representative 1', 'representative', 'active']
        );
        console.log('[DB] Default representative created (rep1 / rep123)');
    }

    // Initial Demo Verifications (Matching UI Screenshot)
    const existingVerifications = await get(`SELECT COUNT(*) as count FROM verifications`);
    if (existingVerifications && existingVerifications.count === 0) {
        await run(`
            INSERT INTO verifications (phone, order_ref, check_type, total_orders, total_delivery, total_cancel, success_rate, risk_level, status_badge, courier_breakdown, created_at)
            VALUES 
            ('01700000000', '#ORD-9824', 'manual', 13, 2, 11, 15.38, 'High Risk', 'Auto-Blocked', '[]', datetime('now', '-2 hours')),
            ('01911167991', '#ORD-9825', 'manual', 20, 17, 3, 85.00, 'Safe', 'Safe', '[]', datetime('now', '-1 hours')),
            ('01310013881', '#ORD-9826', 'manual', 10, 6, 4, 60.00, 'Medium', 'Medium', '[]', datetime('now', '-30 minutes'))
        `);
        console.log('[DB] Seeded initial demo log records.');
    }

    console.log('[DB] Store Guard AI Database Initialized successfully.');
}

module.exports = {
    db,
    run,
    get,
    all,
    initDB
};
