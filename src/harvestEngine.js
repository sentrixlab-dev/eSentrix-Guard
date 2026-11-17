const { get, run, all } = require('./db');
const { checkCustomerFraud } = require('./courierEngine');

const OPERATOR_PREFIXES = {
    gp: ['017', '013'],
    bl: ['019', '014'],
    robi: ['018'],
    airtel: ['016'],
    teletalk: ['015']
};

let harvestLoopActive = false;
let harvestIntervalTimer = null;

function generateRandomBDNumber(allowedOperators = ['gp', 'bl', 'robi', 'airtel', 'teletalk']) {
    let prefixes = [];
    allowedOperators.forEach(op => {
        if (OPERATOR_PREFIXES[op]) {
            prefixes.push(...OPERATOR_PREFIXES[op]);
        } else if (typeof op === 'string' && op.startsWith('01')) {
            prefixes.push(op);
        }
    });
    if (prefixes.length === 0) prefixes = ['017', '019', '018', '016', '013', '014', '015'];

    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = Math.floor(10000000 + Math.random() * 90000000).toString();
    return prefix + suffix;
}

/**
 * Starts the Auto-Harvest background job
 */
async function startHarvesting(io, options = {}) {
    if (harvestLoopActive) return { success: false, message: 'Harvesting is already running.' };

    const targetCount = parseInt(options.targetCount) || 500;
    const operators = options.operators || ['gp', 'bl', 'robi', 'airtel', 'teletalk'];
    const userId = options.userId || null;

    harvestLoopActive = true;
    await run(
        `UPDATE harvest_state SET is_running = 1, target_count = ?, processed_count = 0, hits_found = ?, selected_operators = ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1`,
        [targetCount, 0, JSON.stringify(operators)]
    );

    console.log(`[HarvestEngine] Started automated data collection for ${targetCount} numbers...`);
    io.emit('harvest_status', { isRunning: true, targetCount, processedCount: 0, hitsFound: 0 });

    let processed = 0;
    let hits = 0;

    const runStep = async () => {
        if (!harvestLoopActive) return;

        // Generate number
        const phone = generateRandomBDNumber(operators);
        processed++;

        io.emit('harvest_progress', {
            currentPhone: phone,
            processedCount: processed,
            targetCount,
            hitsFound: hits,
            percent: Math.round((processed / targetCount) * 100)
        });

        try {
            // Check Courier
            const report = await checkCustomerFraud(phone);

            if (report.totalOrders > 0) {
                hits++;
                // Record into verifications table as auto_harvest
                await run(`
                    INSERT INTO verifications (user_id, phone, order_ref, check_type, total_orders, total_delivery, total_cancel, success_rate, risk_level, status_badge, courier_breakdown, created_at)
                    VALUES (?, ?, ?, 'auto_harvest', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, [
                    userId,
                    report.phone,
                    `#AUT-${Math.floor(1000 + Math.random() * 9000)}`,
                    report.totalOrders,
                    report.totalDelivery,
                    report.totalCancel,
                    report.successRateNumber,
                    report.riskLevel,
                    report.riskLevel === 'High Risk' ? 'High Risk' : (report.riskLevel === 'Safe' ? 'Safe' : 'Medium'),
                    JSON.stringify(report.courierBreakdown)
                ]);

                io.emit('harvest_hit', {
                    phone: report.phone,
                    orders: report.totalOrders,
                    delivery: report.totalDelivery,
                    cancel: report.totalCancel,
                    rate: report.successRate,
                    status: report.riskLevel
                });

                // Also notify logs update
                io.emit('log_added');
            }

            await run(
                `UPDATE harvest_state SET processed_count = ?, hits_found = ?, current_phone = ?, last_updated = CURRENT_TIMESTAMP WHERE id = 1`,
                [processed, hits, phone]
            );

            if (processed >= targetCount) {
                stopHarvesting(io);
                io.emit('harvest_completed', { processed, hits });
                return;
            }

            // Schedule next check with a safe 1.2s delay to protect quotas
            if (harvestLoopActive) {
                harvestIntervalTimer = setTimeout(runStep, 1200);
            }
        } catch (e) {
            console.error('[HarvestEngine] Error in step:', e.message);
            if (harvestLoopActive) {
                harvestIntervalTimer = setTimeout(runStep, 2000);
            }
        }
    };

    runStep();
    return { success: true, message: 'Harvesting started.' };
}

/**
 * Stops the Auto-Harvest job
 */
async function stopHarvesting(io) {
    harvestLoopActive = false;
    if (harvestIntervalTimer) clearTimeout(harvestIntervalTimer);
    harvestIntervalTimer = null;

    await run(`UPDATE harvest_state SET is_running = 0, last_updated = CURRENT_TIMESTAMP WHERE id = 1`);
    if (io) io.emit('harvest_status', { isRunning: false });
    console.log('[HarvestEngine] Harvesting stopped.');
    return { success: true, message: 'Harvesting stopped.' };
}

async function getHarvestStatus() {
    const row = await get(`SELECT * FROM harvest_state WHERE id = 1`);
    return row || { is_running: 0, target_count: 0, processed_count: 0, hits_found: 0 };
}

module.exports = {
    startHarvesting,
    stopHarvesting,
    getHarvestStatus
};
