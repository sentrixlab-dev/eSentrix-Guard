const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Initialize Database Tables
db.serialize(() => {
    // Users Table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Safe Schema Migrations (Add missing columns to users table)
    const addColumn = (colName, colDef) => {
        db.run(`ALTER TABLE users ADD COLUMN ${colName} ${colDef}`, (err) => {
            // Ignore duplicate column errors
        });
    };
    addColumn('email', 'TEXT');
    addColumn('phone', 'TEXT');
    addColumn('plan_name', 'TEXT DEFAULT \'Free Trial\'');
    addColumn('plan_status', 'TEXT DEFAULT \'Active\'');
    addColumn('plan_expires', 'TEXT');
    addColumn('profile_pic', 'TEXT');

    // Scans Table
    db.run(`CREATE TABLE IF NOT EXISTS scans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        phone TEXT,
        courier TEXT,
        total_orders INTEGER,
        total_delivery INTEGER,
        total_cancel INTEGER,
        success_rate TEXT,
        has_whatsapp BOOLEAN,
        scan_date DATE,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Schema Migrations for scans table
    const addColumnToScans = (colName, colDef) => {
        db.run(`ALTER TABLE scans ADD COLUMN ${colName} ${colDef}`, (err) => {
            // Ignore duplicate column errors
        });
    };
    addColumnToScans('courier', 'TEXT');

    // API Keys Table
    db.run(`CREATE TABLE IF NOT EXISTS api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        courier_name TEXT,
        key_value TEXT,
        status TEXT DEFAULT 'active',
        usage_count INTEGER DEFAULT 0,
        last_reset_time DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Create a default admin user if not exists
    const bcrypt = require('bcrypt');
    db.get("SELECT id, email FROM users WHERE username = 'admin'", async (err, row) => {
        if (!row) {
            const hash = await bcrypt.hash('admin123', 10);
            db.run("INSERT INTO users (username, password, role, email, phone, plan_name, plan_expires) VALUES (?, ?, ?, ?, ?, ?, ?)", 
                ['admin', hash, 'admin', 'admin@openlogic.com', '01711223344', 'Enterprise Pro', '2026-12-31']);
        } else if (!row.email) {
            db.run("UPDATE users SET email = ?, phone = ?, plan_name = ?, plan_expires = ? WHERE username = 'admin'",
                ['admin@openlogic.com', '01711223344', 'Enterprise Pro', '2026-12-31']);
        }
    });
});

module.exports = db;
