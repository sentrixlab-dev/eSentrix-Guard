const puppeteer = require('puppeteer');

async function findApi() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    page.on('request', request => {
        const url = request.url();
        if (url.includes('api') || url.includes('search')) {
            console.log('Intercepted Request:', url);
        }
    });

    try {
        await page.goto('https://app.courier.com.bd/search', { waitUntil: 'networkidle2' });
        
        // Let's type a number if there's an input field
        const inputSelector = 'input[type="text"], input[name="phone"], input[placeholder*="phone"]';
        const input = await page.$(inputSelector).catch(() => null);
        if (input) {
            await input.type('01948821476');
            await page.keyboard.press('Enter');
            await new Promise(r => setTimeout(r, 3000));
        } else {
            console.log("No input field found. Waiting a bit anyway.");
            await new Promise(r => setTimeout(r, 5000));
        }

    } catch (e) {
        console.error('Error:', e);
    } finally {
        await browser.close();
    }
}

findApi();
