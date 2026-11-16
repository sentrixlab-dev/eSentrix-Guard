const { Client, LocalAuth } = require('whatsapp-web.js');

let client;
let isReady = false;
let currentQr = null;

/**
 * Initializes the WhatsApp Web client.
 * @param {Object} io Socket.io instance to emit events to frontend
 */
function initWhatsApp(io) {
    return new Promise((resolve, reject) => {
        if (client) {
            // Already initializing or initialized
            if (isReady) {
                io.emit('wa_status', { ready: true });
                resolve();
            } else if (currentQr) {
                io.emit('qr_code', currentQr);
            }
            return;
        }

        console.log('[WhatsApp] Initializing client...');
        io.emit('wa_status', { ready: false, message: 'Initializing WhatsApp...' });

        const isWin = process.platform === 'win32';
        const chromePath = isWin
            ? require('path').join(__dirname, 'chrome-headless-shell', 'win64-146.0.7680.31', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')
            : '/usr/bin/chromium-browser';

        client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                executablePath: chromePath,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
            }
        });

        client.on('qr', (qr) => {
            console.log('[WhatsApp] QR Code received.');
            currentQr = qr;
            io.emit('qr_code', qr); // Send raw QR string to frontend (frontend will generate image)
        });

        client.on('ready', () => {
            console.log('[WhatsApp] Client is ready!');
            isReady = true;
            currentQr = null;
            io.emit('wa_status', { ready: true, message: 'WhatsApp Connected' });
            resolve();
        });

        client.on('auth_failure', (msg) => {
            console.error('[WhatsApp] Authentication failure:', msg);
            io.emit('wa_status', { ready: false, message: 'Auth Failure' });
            reject(msg);
        });

        client.on('disconnected', (reason) => {
            console.log('[WhatsApp] Disconnected:', reason);
            isReady = false;
            io.emit('wa_status', { ready: false, message: 'Disconnected' });
            if (client) {
                client.destroy().catch(err => console.error('[WhatsApp] Error during destroy:', err.message));
                client = null;
            }
        });

        client.initialize();
    });
}

/**
 * Checks if a phone number is registered on WhatsApp.
 * @param {string} phone Number in local format
 */
async function checkWhatsApp(phone) {
    if (!isReady) return false;

    try {
        let formattedPhone = phone.startsWith('0') ? '88' + phone : phone;
        const whatsappId = `${formattedPhone}@c.us`;
        const isRegistered = await client.isRegisteredUser(whatsappId);
        return isRegistered;
    } catch (error) {
        console.error(`[WhatsApp] Error checking ${phone}:`, error.message);
        return false;
    }
}

/**
 * Logs out and destroys the WhatsApp client session.
 * @param {Object} io 
 */
async function logoutWhatsApp(io) {
    if (client) {
        try {
            // Attempt to destroy client immediately instead of logging out
            await client.destroy();
        } catch (e) {
            console.error("Error during destroy:", e);
        }
        client = null;
        isReady = false;
        currentQr = null;
        
        // Remove auth folder to force fresh session
        const fs = require('fs');
        const path = require('path');
        const authPath = path.join(__dirname, '.wwebjs_auth');
        if (fs.existsSync(authPath)) {
            try {
                fs.rmSync(authPath, { recursive: true, force: true });
            } catch(e) {
                console.error("Failed to delete auth folder:", e);
            }
        }

        io.emit('wa_status', { ready: false, message: 'Disconnected. Refreshing QR...' });
        
        // Re-initialize to get new QR
        initWhatsApp(io).catch(e => console.error(e));
    }
}

module.exports = {
    initWhatsApp,
    checkWhatsApp,
    logoutWhatsApp
};
