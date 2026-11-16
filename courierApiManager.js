const db = require('./sqlite_db');
const { incrementKeyUsage } = require('./database');

/**
 * Gets a random active API key for a given courier from the SQLite pool.
 * Only returns keys that have usage_count < dailyLimit.
 * @param {number} userId 
 * @param {string} courierName 
 * @param {number} dailyLimit Defaults to 50
 * @returns {Promise<Object|null>} Returns key object { id, key_value } or null if none active.
 */
function getRandomApiKey(userId, courierName, dailyLimit = 50) {
    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, key_value, usage_count FROM api_keys 
             WHERE user_id = ? AND LOWER(courier_name) = LOWER(?) AND status = 'active' AND usage_count < ?`,
            [userId || null, courierName, dailyLimit],
            async (err, rows) => {
                if (err) {
                    console.error('[ApiManager] Error fetching keys from DB:', err.message);
                    return resolve(null);
                }
                
                if (!rows || rows.length === 0) {
                    console.log(`[ApiManager] No active keys with available quota for ${courierName}.`);
                    return resolve(null);
                }
                
                // Select a random key from the available pool
                const randomIndex = Math.floor(Math.random() * rows.length);
                const selectedKey = rows[randomIndex];
                
                console.log(`[ApiManager] Selected key ID: ${selectedKey.id} for ${courierName} (Usage: ${selectedKey.usage_count}/${dailyLimit})`);
                
                // Automatically increment usage count
                try {
                    await incrementKeyUsage(selectedKey.id);
                } catch (e) {
                    console.error(`[ApiManager] Failed to increment key usage for key ID ${selectedKey.id}:`, e.message);
                }
                
                resolve({
                    id: selectedKey.id,
                    key_value: selectedKey.key_value
                });
            }
        );
    });
}

module.exports = {
    getRandomApiKey
};
