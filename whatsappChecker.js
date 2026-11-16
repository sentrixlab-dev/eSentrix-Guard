const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

let client = null;
let isReady = false;
let currentQr = null;
let isInitializing = false;

/**
 * Initializes the WhatsApp Web client safely without crashing the host process.
 * @param {Object} io Socket.io instance to emit events to frontend
 */
function initWhatsApp(io) {
    return new Promise((resolve) => {
        if (client) {
            if (isReady) {
                if (io) io.emit('wa_status', { ready: true, message: 'WhatsApp Connected' });
                return resolve(true);
            } else if (currentQr) {
                if (io) io.emit('qr_code', currentQr);
                return resolve(false);
            }
        }

        if (isInitializing) return resolve(false);
        isInitializing = true;

        console.log('[WhatsApp] Initializing client safely...');
        if (io) io.emit('wa_status', { ready: false, message: 'Initializing WhatsApp...' });

        const isWin = process.platform === 'win32';
        const chromePath = isWin
            ? path.join(__dirname, 'chrome-headless-shell', 'win64-146.0.7680.31', 'chrome-headless-shell-win64', 'chrome-headless-shell.exe')
            : '/usr/bin/chromium-browser';

        try {
            client = new Client({
                authStrategy: new LocalAuth(),
                puppeteer: {
                    headless: true,
                    executablePath: chromePath,
                    protocolTimeout: 180000, // 3 minutes timeout to prevent ProtocolError
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-gpu',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process'
                    ]
                }
            });

            client.on('qr', (qr) => {
                console.log('[WhatsApp] QR Code received.');
                currentQr = qr;
                isInitializing = false;
                if (io) io.emit('qr_code', qr);
            });

            client.on('ready', () => {
                console.log('[WhatsApp] Client is ready!');
                isReady = true;
                currentQr = null;
                isInitializing = false;
                if (io) io.emit('wa_status', { ready: true, message: 'WhatsApp Connected' });
                resolve(true);
            });

            client.on('auth_failure', (msg) => {
                console.error('[WhatsApp] Authentication failure:', msg);
                isReady = false;
                isInitializing = false;
                if (io) io.emit('wa_status', { ready: false, message: 'Authentication Failed' });
                resolve(false);
            });

            client.on('disconnected', (reason) => {
                console.log('[WhatsApp] Disconnected:', reason);
                isReady = false;
                isInitializing = false;
                currentQr = null;
                if (io) io.emit('wa_status', { ready: false, message: 'Disconnected' });
                if (client) {
                    client.destroy().catch(err => console.error('[WhatsApp] Destroy error:', err.message));
                    client = null;
                }
            });

            client.initialize().catch(err => {
                console.error('[WhatsApp Init Caught Exception]:', err.message);
                isReady = false;
                isInitializing = false;
                if (io) io.emit('wa_status', { ready: false, message: 'Connection Timeout. Please retry.' });
                resolve(false);
            });

        } catch (err) {
            console.error('[WhatsApp Setup Error]:', err.message);
            isReady = false;
            isInitializing = false;
            resolve(false);
        }
    });
}

/**
 * Checks if a phone number is registered on WhatsApp.
 * @param {string} phone Number in local format
 */
async function checkWhatsApp(phone) {
    if (!isReady || !client) return false;

    try {
        let formattedPhone = phone.startsWith('0') ? '88' + phone : phone;
        const whatsappId = `${formattedPhone}@c.us`;
        const isRegistered = await client.isRegisteredUser(whatsappId);
        return !!isRegistered;
    } catch (error) {
        console.error(`[WhatsApp] Error checking ${phone}:`, error.message);
        return false;
    }
}

/**
 * Logs out and safely cleans the WhatsApp client session.
 * @param {Object} io 
 */
async function logoutWhatsApp(io) {
    if (client) {
        try {
            await client.destroy();
        } catch (e) {
            console.error('[WhatsApp Destroy Note]:', e.message);
        }
        client = null;
        isReady = false;
        currentQr = null;
        isInitializing = false;

        // Grace period for browser process lock release
        await new Promise(r => setTimeout(r, 1500));

        const authPath = path.join(__dirname, '.wwebjs_auth');
        if (fs.existsSync(authPath)) {
            try {
                fs.rmSync(authPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 });
            } catch (e) {
                // Ignore lock error, next start will handle it
            }
        }

        if (io) io.emit('wa_status', { ready: false, message: 'Disconnected' });
    }
}

module.exports = {
    initWhatsApp,
    checkWhatsApp,
    logoutWhatsApp
};
