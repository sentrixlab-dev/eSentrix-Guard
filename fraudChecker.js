const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

let browserInstance = null;
let pageEliteMart = null;
let pageFraudCheckerLink = null;

async function getOptimizedPage() {
    const browser = await getBrowser();
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        const type = req.resourceType();
        if (type === 'image' || type === 'font' || type === 'media' || type === 'stylesheet') {
            req.abort();
        } else {
            req.continue();
        }
    });
    return page;
}

async function getPageEliteMart() {
    if (!pageEliteMart) pageEliteMart = await getOptimizedPage();
    return pageEliteMart;
}

async function getPageFraudCheckerLink() {
    if (!pageFraudCheckerLink) pageFraudCheckerLink = await getOptimizedPage();
    return pageFraudCheckerLink;
}

/**
 * Scrapes delivery stats from elitemart.com.bd
 */
async function scrapeEliteMart(phone) {
    try {
        const page = await getPageEliteMart();
        console.log(`[Scraper] Navigating to EliteMart...`);
        await page.goto('https://elitemart.com.bd/fraud-check-2', { waitUntil: 'networkidle2', timeout: 15000 });
        
        // Wait for input field
        await page.waitForSelector('input[placeholder="Mobile Number"]', { timeout: 8000 });
        
        // Clear input field using page.evaluate to ensure it is empty
        await page.evaluate(() => {
            const input = document.querySelector('input[placeholder="Mobile Number"]');
            if (input) {
                input.value = '';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        
        // Type the new number
        await page.type('input[placeholder="Mobile Number"]', phone);
        
        // Click search button
        await page.evaluate(() => {
            const input = document.querySelector('input[placeholder="Mobile Number"]');
            if (input) {
                const form = input.closest('form');
                if (form) {
                    const btn = form.querySelector('button[type="submit"]');
                    if (btn) btn.click();
                }
            }
        });
        
        // Wait 3 seconds for results to load
        await new Promise(r => setTimeout(r, 3000));
        
        // Extract stats from the DOM
        const rows = await page.evaluate(() => {
            const results = [];
            const trs = document.querySelectorAll('.fc2-courier-table tbody tr');
            trs.forEach(tr => {
                const tds = tr.querySelectorAll('td');
                if (tds.length >= 5) {
                    results.push({
                        courier: tds[0].innerText.trim(),
                        orders: parseInt(tds[1].innerText.trim()) || 0,
                        delivery: parseInt(tds[2].innerText.trim()) || 0,
                        cancel: parseInt(tds[3].innerText.trim()) || 0,
                        rate: tds[4].innerText.trim()
                    });
                }
            });
            return results;
        });
        
        return rows;
    } catch (e) {
        console.error('[Scraper] Error scraping EliteMart:', e.message);
        return [];
    }
}

/**
 * Scrapes delivery stats from fraudchecker.link
 */
async function scrapeFraudCheckerLink(phone) {
    try {
        const page = await getPageFraudCheckerLink();
        console.log(`[Scraper] Navigating to FraudChecker.link...`);
        await page.goto('https://fraudchecker.link/free-fraud-checker-bd/', { waitUntil: 'networkidle2', timeout: 15000 });
        
        // Wait for input field
        await page.waitForSelector('input[placeholder*="Enter mobile number"]', { timeout: 8000 });
        
        // Clear input field using page.evaluate to ensure it is empty
        await page.evaluate(() => {
            const input = document.querySelector('input[placeholder*="Enter mobile number"]');
            if (input) {
                input.value = '';
            }
        });
        
        // Type the new number
        await page.type('input[placeholder*="Enter mobile number"]', phone);
        
        // Click search button
        await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const searchBtn = buttons.find(b => b.innerText.includes('Search') || b.textContent.includes('Search'));
            if (searchBtn) searchBtn.click();
        });
        
        // Wait 3.5 seconds for results to load
        await new Promise(r => setTimeout(r, 3500));
        
        // Close any modal ads if present
        await page.evaluate(() => {
            const adCloseButtons = Array.from(document.querySelectorAll('button, div, span')).filter(el => {
                const style = window.getComputedStyle(el);
                return style.position === 'absolute' && (el.innerText === 'X' || el.textContent === 'X' || el.classList.contains('close'));
            });
            if (adCloseButtons.length > 0) {
                adCloseButtons[0].click();
            }
        });
        
        // Extract table rows
        const rows = await page.evaluate(() => {
            const results = [];
            const trs = document.querySelectorAll('table tbody tr');
            trs.forEach(tr => {
                const tds = tr.querySelectorAll('td');
                if (tds.length >= 5) {
                    results.push({
                        courier: tds[0].innerText.trim(),
                        orders: parseInt(tds[1].innerText.trim()) || 0,
                        delivery: parseInt(tds[2].innerText.trim()) || 0,
                        cancel: parseInt(tds[3].innerText.trim()) || 0,
                        rate: tds[4].innerText.trim()
                    });
                }
            });
            return results;
        });
        
        return rows;
    } catch (e) {
        console.error('[Scraper] Error scraping FraudChecker.link:', e.message);
        return [];
    }
}

async function fetchBdCourierApi(phone, userId) {
    if (!userId) return [];
    try {
        const { getRandomApiKey } = require('./courierApiManager');
        const apiKeyObj = await getRandomApiKey(userId, 'BD Courier');
        if (!apiKeyObj) return [];
        
        console.log(`[FraudCheck] Using API key ID ${apiKeyObj.id} for query...`);
        const axios = require('axios');
        const response = await axios.post(`https://api.bdcourier.com/courier-check`, 
            { phone: phone },
            {
                headers: { 
                    'Authorization': `Bearer ${apiKeyObj.key_value}`,
                    'Content-Type': 'application/json'
                },
                timeout: 5000
            }
        );
        
        const bdCourierRows = [];
        if (response.data && response.data.status === 'success') {
            const apiData = response.data.data;
            if (apiData) {
                for (const [key, stat] of Object.entries(apiData)) {
                    if (key === 'summary') continue;
                    bdCourierRows.push({
                        courier: stat.name || key,
                        orders: parseInt(stat.total_parcel) || 0,
                        delivery: parseInt(stat.success_parcel) || 0,
                        cancel: parseInt(stat.cancelled_parcel) || 0,
                        rate: stat.success_ratio ? stat.success_ratio + '%' : '0%'
                    });
                }
            }
        }
        return bdCourierRows;
    } catch (apiErr) {
        console.error('[FraudCheck] BD Courier API error:', apiErr.message);
        return [];
    }
}

/**
 * Checks the courier/purchase history for a given phone number by scraping multiple free sources and API.
 * @param {string} phone 
 * @param {number} userId
 * @returns {Promise<Object>} Returns courier stats.
 */
async function checkFraudHistory(phone, userId = null) {
    try {
        console.log(`[FraudCheck] Scraping history for ${phone}...`);
        
        // Run all scrapers and API concurrently
        const [eliteResult, linkResult, apiResult] = await Promise.allSettled([
            scrapeEliteMart(phone),
            scrapeFraudCheckerLink(phone),
            fetchBdCourierApi(phone, userId)
        ]);
        
        const eliteRows = eliteResult.status === 'fulfilled' ? eliteResult.value : [];
        const linkRows = linkResult.status === 'fulfilled' ? linkResult.value : [];
        const bdCourierRows = apiResult.status === 'fulfilled' ? apiResult.value : [];
        
        // Combine results using Maximum logic
        const combinedCouriers = {};
        
        const processRows = (rows) => {
            rows.forEach(r => {
                if (r.orders === 0 && r.delivery === 0 && r.cancel === 0) return; // Skip empty rows
                
                const key = r.courier.toLowerCase().trim();
                if (!combinedCouriers[key]) {
                    combinedCouriers[key] = {
                        courier: r.courier,
                        orders: r.orders,
                        delivery: r.delivery,
                        cancel: r.cancel
                    };
                } else {
                    if (r.orders > combinedCouriers[key].orders) {
                        combinedCouriers[key].orders = r.orders;
                        combinedCouriers[key].delivery = r.delivery;
                        combinedCouriers[key].cancel = r.cancel;
                    }
                }
            });
        };
        
        processRows(eliteRows);
        processRows(linkRows);
        processRows(bdCourierRows);
        
        // Format combined results
        const finalRows = Object.values(combinedCouriers);
        
        // Calculate totals
        let totalOrders = 0;
        let totalDelivery = 0;
        let totalCancel = 0;
        let finalCourierString = '-';
        
        if (finalRows.length > 0) {
            finalRows.forEach(r => {
                totalOrders += r.orders;
                totalDelivery += r.delivery;
                totalCancel += r.cancel;
            });
            // Create formatted string like "RedX-3, Steadfast-2"
            finalCourierString = finalRows.map(r => `${r.courier}-${r.orders}`).join(', ');
        }
        
        const successRate = totalOrders > 0 ? Math.round((totalDelivery / totalOrders) * 100) : 0;
        
        const stats = {
            phone: phone,
            courier: finalCourierString,
            totalOrders: totalOrders,
            totalDelivery: totalDelivery,
            totalCancel: totalCancel,
            successRate: `${successRate}%`
        };
        
        console.log(`[FraudCheck] Combined results for ${phone}:`, stats);
        return stats;
        
    } catch (error) {
        console.error(`[FraudCheck] Error during multi-source scraping for ${phone}:`, error.message);
        return {
            phone: phone,
            courier: '-',
            totalOrders: 0,
            totalDelivery: 0,
            totalCancel: 0,
            successRate: '0%'
        };
    }
}

module.exports = {
    checkFraudHistory
};
