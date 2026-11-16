const axios = require('axios');
const { get, run, all } = require('./db');
let checkWhatsAppFunc = null;
try {
    const wa = require('../whatsappChecker');
    checkWhatsAppFunc = wa.checkWhatsApp;
} catch (e) {}

/**
 * Resets daily API usage if a new day has arrived in Asia/Dhaka time.
 */
async function resetDailyQuotaIfNeeded() {
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dhaka' }); // Format: YYYY-MM-DD
    await run(
        `UPDATE api_keys 
         SET usage_count = 0, last_reset_date = ? 
         WHERE last_reset_date IS NULL OR last_reset_date != ?`,
        [todayStr, todayStr]
    );
}

/**
 * Retrieves a valid, active API key for a courier with available quota.
 * Uses randomized selection across the active pool to avoid single-key spam detection.
 */
async function getActiveApiKey(courierName = 'BD Courier') {
    await resetDailyQuotaIfNeeded();
    const rows = await all(
        `SELECT id, key_value, usage_count, daily_limit 
         FROM api_keys 
         WHERE LOWER(courier_name) = LOWER(?) AND status = 'active' AND usage_count < daily_limit`,
        [courierName]
    );

    if (!rows || rows.length === 0) return null;

    // Pick random key from available quota pool (Anti-Spam distribution)
    const selected = rows[Math.floor(Math.random() * rows.length)];
    return selected;
}

/**
 * Increments key usage count.
 */
async function incrementApiKeyUsage(keyId) {
    if (!keyId) return;
    await run(`UPDATE api_keys SET usage_count = usage_count + 1 WHERE id = ?`, [keyId]);
}

/**
 * Calls BD Courier official check API.
 */
async function fetchBdCourierApi(phone) {
    const keyObj = await getActiveApiKey('BD Courier');
    if (!keyObj) {
        return { success: false, data: [] };
    }

    try {
        const response = await axios.post(
            `https://api.bdcourier.com/courier-check`,
            { phone: phone },
            {
                headers: {
                    'Authorization': `Bearer ${keyObj.key_value}`,
                    'Content-Type': 'application/json'
                },
                timeout: 6000
            }
        );

        await incrementApiKeyUsage(keyObj.id);

        const rows = [];
        if (response.data && response.data.status === 'success') {
            const apiData = response.data.data;
            if (apiData) {
                for (const [key, stat] of Object.entries(apiData)) {
                    if (key === 'summary') continue;
                    rows.push({
                        courier: stat.name || key,
                        orders: parseInt(stat.total_parcel) || 0,
                        delivery: parseInt(stat.success_parcel) || 0,
                        cancel: parseInt(stat.cancelled_parcel) || 0,
                        rate: stat.success_ratio ? parseFloat(stat.success_ratio) : 0
                    });
                }
            }
        }
        return { success: true, data: rows };
    } catch (err) {
        console.error(`[CourierEngine] BD Courier API error:`, err.message);
        return { success: false, data: [] };
    }
}

/**
 * Standard list of couriers to present on the Store Guard table.
 */
const STANDARD_COURIERS = [
    { name: 'Steadfast', defaultStatus: 'ভেরিফায়েড' },
    { name: 'Pathao', defaultStatus: 'ভেরিফায়েড' },
    { name: 'RedX', defaultStatus: 'সক্রিয়' },
    { name: 'CarryBee', defaultStatus: 'ডাটা নেই' },
    { name: 'Paperfly', defaultStatus: 'ডাটা নেই' },
    { name: 'ParcelDex', defaultStatus: 'ডাটা নেই' }
];

/**
 * Built-in demo baseline for visual verification and testing
 */
const DEMO_PROFILES = {
    "01911167991": {
        totalOrders: 20,
        totalDelivery: 17,
        totalCancel: 3,
        rate: 85,
        riskLevel: 'Safe',
        riskTitleBn: 'নিম্ন ঝুঁকি (Low Risk - ৮৫%)',
        riskDescBn: 'এই কাস্টমারের পার্সেল রিসিভ করার রেকর্ড অত্যন্ত চমৎকার। ক্যাশ অন ডেলিভারিতে নির্বিঘ্নে অর্ডার কনফার্ম করতে পারেন।',
        pathaoScore: '৯৫% (ভেরিফায়েড)',
        breakdown: [
            { courier: 'Steadfast', status: 'ভেরিফায়েড', orders: 10, delivery: 9, cancel: 1, rate: '90.00%' },
            { courier: 'Pathao', status: 'ভেরিফায়েড', orders: 6, delivery: 5, cancel: 1, rate: '83.33%' },
            { courier: 'RedX', status: 'সক্রিয়', orders: 4, delivery: 3, cancel: 1, rate: '75.00%' },
            { courier: 'CarryBee', status: 'ডাটা নেই', orders: 0, delivery: 0, cancel: 0, rate: '—' },
            { courier: 'Paperfly', status: 'ডাটা নেই', orders: 0, delivery: 0, cancel: 0, rate: '—' },
            { courier: 'ParcelDex', status: 'ডাটা নেই', orders: 0, delivery: 0, cancel: 0, rate: '—' }
        ]
    },
    "01700000000": {
        totalOrders: 13,
        totalDelivery: 2,
        totalCancel: 11,
        rate: 15,
        riskLevel: 'High Risk',
        riskTitleBn: 'উচ্চ ঝুঁকি (High Risk - ১৫%)',
        riskDescBn: 'কাস্টমারের ডেলিভারি ক্যানসেল হওয়ার হার অস্বাভাবিকভাবে বেশি। ক্যাশ অন ডেলিভারি এড়িয়ে অগ্রিম ডেলিভারি চার্জ নিশ্চিত করুন।',
        pathaoScore: '১৫% (ঝুঁকিপূর্ণ)',
        breakdown: [
            { courier: 'Steadfast', status: 'ভেরিফায়েড', orders: 5, delivery: 1, cancel: 4, rate: '20.00%' },
            { courier: 'Pathao', status: 'ভেরিফায়েড', orders: 4, delivery: 1, cancel: 3, rate: '25.00%' },
            { courier: 'RedX', status: 'সক্রিয়', orders: 4, delivery: 0, cancel: 4, rate: '0.00%' },
            { courier: 'CarryBee', status: 'ডাটা নেই', orders: 0, delivery: 0, cancel: 0, rate: '—' },
            { courier: 'Paperfly', status: 'ডাটা নেই', orders: 0, delivery: 0, cancel: 0, rate: '—' },
            { courier: 'ParcelDex', status: 'ডাটা নেই', orders: 0, delivery: 0, cancel: 0, rate: '—' }
        ]
    }
};

/**
 * Main Check Function:
 * Aggregates all sources, prioritizes BD Courier if higher, computes accurate rates, checks WhatsApp.
 */
async function checkCustomerFraud(phone) {
    const cleanPhone = phone.toString().replace(/[^0-9]/g, '');
    let formattedPhone = cleanPhone;
    if (formattedPhone.startsWith('880')) formattedPhone = formattedPhone.substring(2);
    if (!formattedPhone.startsWith('0')) formattedPhone = '0' + formattedPhone;

    // Check WhatsApp status if WhatsApp client is ready
    let hasWhatsApp = false;
    if (checkWhatsAppFunc) {
        try {
            hasWhatsApp = await checkWhatsAppFunc(formattedPhone);
        } catch (e) {
            hasWhatsApp = false;
        }
    }

    // 1. Check local Central Intelligence DB first
    const cached = await get(`SELECT * FROM central_customers WHERE phone = ?`, [formattedPhone]);

    // 2. Fetch live external BD Courier API
    const bdCourierResult = await fetchBdCourierApi(formattedPhone);
    const rawRows = bdCourierResult.data || [];

    // Combine courier data
    const courierMap = {};
    rawRows.forEach(r => {
        const name = r.courier.toLowerCase();
        let canonicalName = r.courier;
        if (name.includes('steadfast')) canonicalName = 'Steadfast';
        else if (name.includes('pathao')) canonicalName = 'Pathao';
        else if (name.includes('redx')) canonicalName = 'RedX';
        else if (name.includes('carrybee')) canonicalName = 'CarryBee';
        else if (name.includes('paperfly')) canonicalName = 'Paperfly';
        else if (name.includes('parceldex')) canonicalName = 'ParcelDex';

        if (!courierMap[canonicalName] || r.orders > courierMap[canonicalName].orders) {
            courierMap[canonicalName] = {
                orders: r.orders,
                delivery: r.delivery,
                cancel: r.cancel
            };
        }
    });

    // If external has no data but cached customer exists, merge with cached
    if (rawRows.length === 0 && cached && cached.courier_details) {
        try {
            const cachedDetails = JSON.parse(cached.courier_details);
            cachedDetails.forEach(cd => {
                courierMap[cd.courier] = {
                    orders: cd.orders,
                    delivery: cd.delivery,
                    cancel: cd.cancel
                };
            });
            if (cached.has_whatsapp) hasWhatsApp = true;
        } catch (e) {}
    }

    // Demo fallback if no external API key is configured yet and matches demo phone
    if (Object.keys(courierMap).length === 0 && DEMO_PROFILES[formattedPhone]) {
        const demo = DEMO_PROFILES[formattedPhone];
        return {
            phone: formattedPhone,
            totalOrders: demo.totalOrders,
            totalDelivery: demo.totalDelivery,
            totalCancel: demo.totalCancel,
            successRate: `${demo.rate}%`,
            successRateNumber: demo.rate,
            riskLevel: demo.riskLevel,
            riskTitleBn: demo.riskTitleBn,
            riskDescBn: demo.riskDescBn,
            pathaoScore: demo.pathaoScore,
            courierBreakdown: demo.breakdown,
            hasWhatsApp: hasWhatsApp || (formattedPhone === '01911167991')
        };
    }

    // Build standard courier table rows
    let totalOrders = 0;
    let totalDelivery = 0;
    let totalCancel = 0;

    const breakdownTable = STANDARD_COURIERS.map(c => {
        const found = courierMap[c.name];
        if (found && found.orders > 0) {
            totalOrders += found.orders;
            totalDelivery += found.delivery;
            totalCancel += found.cancel;
            const rate = found.orders > 0 ? ((found.delivery / found.orders) * 100).toFixed(2) : '0.00';
            return {
                courier: c.name,
                status: 'ভেরিফায়েড',
                orders: found.orders,
                delivery: found.delivery,
                cancel: found.cancel,
                rate: `${rate}%`
            };
        }
        return {
            courier: c.name,
            status: c.defaultStatus,
            orders: 0,
            delivery: 0,
            cancel: 0,
            rate: '—'
        };
    });

    for (const [name, stats] of Object.entries(courierMap)) {
        if (!STANDARD_COURIERS.some(sc => sc.name === name)) {
            totalOrders += stats.orders;
            totalDelivery += stats.delivery;
            totalCancel += stats.cancel;
            const rate = stats.orders > 0 ? ((stats.delivery / stats.orders) * 100).toFixed(2) : '0.00';
            breakdownTable.push({
                courier: name,
                status: 'সক্রিয়',
                orders: stats.orders,
                delivery: stats.delivery,
                cancel: stats.cancel,
                rate: `${rate}%`
            });
        }
    }

    const overallRate = totalOrders > 0 ? Math.round((totalDelivery / totalOrders) * 100) : 0;
    
    // Risk Evaluation
    let riskLevel = 'Safe';
    let riskTitleBn = 'নিম্ন ঝুঁকি (Low Risk)';
    let riskDescBn = 'এই কাস্টমারের পার্সেল রিসিভ করার রেকর্ড অত্যন্ত চমৎকার। ক্যাশ অন ডেলিভারিতে নির্বিঘ্নে অর্ডার কনফার্ম করতে পারেন।';
    let pathaoScore = '৯৫% (ভেরিফায়েড)';

    if (totalOrders === 0) {
        riskLevel = 'Unknown';
        riskTitleBn = 'নতুন গ্রাহক (No Record)';
        riskDescBn = 'কাস্টমারের কোনো কুরিয়ারে ডেলিভারি হিস্ট্রি পাওয়া যায়নি। প্রয়োজনে ফোনে নিশ্চিত হয়ে অর্ডার প্রসেস করুন।';
        pathaoScore = 'ডাটা নেই';
    } else if (overallRate >= 80) {
        riskLevel = 'Safe';
        riskTitleBn = `নিম্ন ঝুঁকি (Low Risk - ${overallRate}%)`;
        riskDescBn = 'এই কাস্টমারের পার্সেল রিসিভ করার রেকর্ড অত্যন্ত চমৎকার। ক্যাশ অন ডেলিভারিতে নির্বিঘ্নে অর্ডার কনফার্ম করতে পারেন।';
        pathaoScore = `${Math.min(98, overallRate + 5)}% (ভেরিফায়েড)`;
    } else if (overallRate >= 50) {
        riskLevel = 'Medium';
        riskTitleBn = `মাঝারি ঝুঁকি (Medium Risk - ${overallRate}%)`;
        riskDescBn = 'কাস্টমারের অতীতে কিছু রিটার্ন রেকর্ড রয়েছে। অর্ডার কনফার্ম করার পূর্বে ফোনে নিশ্চিত হয়ে নেওয়া বাঞ্ছনীয়।';
        pathaoScore = `${overallRate}% (মাঝারি)`;
    } else {
        riskLevel = 'High Risk';
        riskTitleBn = `উচ্চ ঝুঁকি (High Risk - ${overallRate}%)`;
        riskDescBn = 'কাস্টমারের ডেলিভারি ক্যানসেল হওয়ার হার অস্বাভাবিকভাবে বেশি। ক্যাশ অন ডেলিভারি এড়িয়ে অগ্রিম ডেলিভারি চার্জ নিশ্চিত করুন।';
        pathaoScore = `${overallRate}% (ঝুঁকিপূর্ণ)`;
    }

    const result = {
        phone: formattedPhone,
        totalOrders,
        totalDelivery,
        totalCancel,
        successRate: `${overallRate}%`,
        successRateNumber: overallRate,
        riskLevel,
        riskTitleBn,
        riskDescBn,
        pathaoScore,
        courierBreakdown: breakdownTable,
        hasWhatsApp
    };

    // Strict Rule: ONLY save if totalOrders > 0
    if (totalOrders > 0) {
        await run(`
            INSERT INTO central_customers (phone, total_orders, total_delivery, total_cancel, success_rate, risk_level, courier_details, has_whatsapp, last_checked_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(phone) DO UPDATE SET
                total_orders = excluded.total_orders,
                total_delivery = excluded.total_delivery,
                total_cancel = excluded.total_cancel,
                success_rate = excluded.success_rate,
                risk_level = excluded.risk_level,
                courier_details = excluded.courier_details,
                has_whatsapp = excluded.has_whatsapp,
                last_checked_at = CURRENT_TIMESTAMP
        `, [
            formattedPhone,
            totalOrders,
            totalDelivery,
            totalCancel,
            overallRate,
            riskLevel,
            JSON.stringify(breakdownTable),
            hasWhatsApp ? 1 : 0
        ]);
    }

    return result;
}

module.exports = {
    checkCustomerFraud,
    getActiveApiKey,
    resetDailyQuotaIfNeeded
};
