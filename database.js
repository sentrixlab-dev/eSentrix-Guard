const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const db = require('./sqlite_db');

/**
 * Initializes the Excel database. Deprecated since migrating to SQLite.
 */
async function initDatabase() {
    console.log('[DB] SQLite database initialized via sqlite_db.js');
}

/**
 * Saves a single customer record to the SQLite scans table.
 */
function saveCustomerData(data, userId) {
    return new Promise((resolve, reject) => {
        const scanDate = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Dhaka' }); // Standard Date key (e.g. 6/26/2026)
        db.run(
            `INSERT INTO scans (user_id, phone, courier, total_orders, total_delivery, total_cancel, success_rate, has_whatsapp, scan_date)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId || null,
                data.phone,
                data.courier || '-',
                data.totalOrders || 0,
                data.totalDelivery || 0,
                data.totalCancel || 0,
                data.successRate || '0%',
                data.hasWhatsApp ? 1 : 0,
                scanDate
            ],
            function(err) {
                if (err) {
                    console.error('[DB] Error saving scan to SQLite:', err.message);
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
}

/**
 * Reads all data from the SQLite scans table and groups it by Date.
 */
function getAllData(userId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM scans WHERE user_id = ? ORDER BY id DESC`,
            [userId || null],
            (err, rows) => {
                if (err) {
                    console.error('[DB] Error reading scans from SQLite:', err.message);
                    return resolve([]);
                }
                const formattedRows = rows.map(row => ({
                    phone: row.phone,
                    courier: row.courier || '-',
                    orders: row.total_orders,
                    delivery: row.total_delivery,
                    cancel: row.total_cancel,
                    success_rate: row.success_rate,
                    has_whatsapp: row.has_whatsapp,
                    scan_date: row.scan_date
                }));
                resolve(formattedRows);
            }
        );
    });
}

/**
 * Deletes database records matching the phone number and user ID.
 */
function deleteCustomerRecord(phone, userId) {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM scans WHERE phone = ? AND user_id = ?`,
            [phone, userId || null],
            function(err) {
                if (err) {
                    console.error(`[DB] Error deleting scan for ${phone}:`, err.message);
                    resolve(false);
                } else {
                    resolve(this.changes > 0);
                }
            }
        );
    });
}

/**
 * Generates an Excel buffer dynamically containing scans for the specific user.
 */
function generateUserExcel(userId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM scans WHERE user_id = ? ORDER BY id ASC`,
            [userId || null],
            async (err, rows) => {
                if (err) {
                    return reject(err);
                }
                try {
                    const workbook = new ExcelJS.Workbook();
                    const sheet = workbook.addWorksheet('Verified Customers');
                    
                    sheet.columns = [
                        { header: 'Phone Number', key: 'phone', width: 20 },
                        { header: 'Courier', key: 'courier', width: 15 },
                        { header: 'Total Orders', key: 'total_orders', width: 15 },
                        { header: 'Total Delivery', key: 'total_delivery', width: 15 },
                        { header: 'Total Cancel', key: 'total_cancel', width: 15 },
                        { header: 'Success Rate', key: 'success_rate', width: 15 },
                        { header: 'Has WhatsApp', key: 'has_whatsapp', width: 15 },
                        { header: 'Check Time', key: 'check_time', width: 25 },
                    ];
                    
                    sheet.getRow(1).font = { bold: true };
                    sheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
                    
                    rows.forEach(row => {
                        sheet.addRow({
                            phone: row.phone,
                            courier: row.courier || '-',
                            total_orders: row.total_orders,
                            total_delivery: row.total_delivery,
                            total_cancel: row.total_cancel,
                            success_rate: row.success_rate,
                            has_whatsapp: row.has_whatsapp === 1 ? row.phone : '-',
                            check_time: row.scan_date
                        });
                    });
                    
                    const buffer = await workbook.xlsx.writeBuffer();
                    resolve(buffer);
                } catch (e) {
                    reject(e);
                }
            }
        );
    });
}

/**
 * API Keys database operations
 */
function addApiKey(userId, courierName, keyValue) {
    return new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO api_keys (user_id, courier_name, key_value, status, usage_count)
             VALUES (?, ?, ?, 'active', 0)`,
            [userId || null, courierName, keyValue],
            function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });
}

function getApiKeys(userId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM api_keys WHERE user_id = ? ORDER BY id DESC`,
            [userId || null],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });
}

function incrementKeyUsage(keyId) {
    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE api_keys SET usage_count = usage_count + 1 WHERE id = ?`,
            [keyId],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes > 0);
            }
        );
    });
}

function deleteApiKey(keyId) {
    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM api_keys WHERE id = ?`,
            [keyId],
            function(err) {
                if (err) reject(err);
                else resolve(this.changes > 0);
            }
        );
    });
}

function resetDailyUsageIfNeeded(userId) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, last_reset_time FROM api_keys WHERE user_id = ?`,
            [userId || null],
            (err, rows) => {
                if (err) return reject(err);
                const now = new Date();
                const todayStr = now.toLocaleDateString('en-US', { timeZone: 'Asia/Dhaka' });
                
                const resetPromises = rows.map(row => {
                    const resetDate = new Date(row.last_reset_time).toLocaleDateString('en-US', { timeZone: 'Asia/Dhaka' });
                    if (resetDate !== todayStr) {
                        return new Promise((res) => {
                            db.run(
                                `UPDATE api_keys SET usage_count = 0, last_reset_time = CURRENT_TIMESTAMP WHERE id = ?`,
                                [row.id],
                                () => res()
                            );
                        });
                    }
                    return Promise.resolve();
                });
                
                Promise.all(resetPromises).then(() => resolve()).catch(reject);
            }
        );
    });
}

module.exports = {
    initDatabase,
    saveCustomerData,
    getAllData,
    deleteCustomerRecord,
    generateUserExcel,
    addApiKey,
    getApiKeys,
    incrementKeyUsage,
    deleteApiKey,
    resetDailyUsageIfNeeded
};
