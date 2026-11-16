// Store Guard AI - Frontend Application
let socket;
let currentUser = null;
let currentReport = null;
let activeDateFilter = 'today';
let activeStatusFilter = 'all';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    initSocket();
    await checkAuth();
    await loadStats();
    await loadLogs();
    await checkHarvestStatus();

    // Default demo view matching screenshot on initial load if empty
    renderCheckerReport({
        phone: '01911167991',
        totalOrders: 20,
        totalDelivery: 17,
        totalCancel: 3,
        successRate: '85%',
        successRateNumber: 85,
        riskLevel: 'Safe',
        riskTitleBn: 'নিম্ন ঝুঁকি (Low Risk - ৮৫%)',
        riskDescBn: 'এই কাস্টমারের পার্সেল রিসিভ করার রেকর্ড অত্যন্ত চমৎকার। ক্যাশ অন ডেলিভারিতে নির্বিঘ্নে অর্ডার কনফার্ম করতে পারেন।',
        pathaoScore: '৯৫% (ভেরিফায়েড)',
        courierBreakdown: [
            { courier: 'Steadfast', status: 'ভেরিফায়েড', orders: 10, delivery: 9, cancel: 1, rate: '90.00%' },
            { courier: 'Pathao', status: 'ভেরিফায়েড', orders: 6, delivery: 5, cancel: 1, rate: '83.33%' },
            { courier: 'RedX', status: 'সক্রিয়', orders: 4, delivery: 3, cancel: 1, rate: '75.00%' },
            { courier: 'CarryBee', status: 'ডাটা নেই', orders: 0, delivery: 0, cancel: 0, rate: '—' },
            { courier: 'Paperfly', status: 'ডাটা নেই', orders: 0, delivery: 0, cancel: 0, rate: '—' },
            { courier: 'ParcelDex', status: 'ডাটা নেই', orders: 0, delivery: 0, cancel: 0, rate: '—' }
        ]
    });
});

function initSocket() {
    socket = io();

    socket.on('log_added', () => {
        loadLogs();
        loadStats();
    });

    socket.on('harvest_progress', (data) => {
        updateHarvestProgressUI(data);
    });

    socket.on('harvest_status', (data) => {
        updateHarvestStatusUI(data.isRunning);
    });

    socket.on('harvest_hit', (data) => {
        addHarvestLiveRow(data);
    });

    socket.on('harvest_completed', (data) => {
        alert(`ডাটা কালেকশন সম্পন্ন! মোট চেক করা হয়েছে: ${data.processed}, পজিটিভ রেকর্ড পাওয়া গেছে: ${data.hits}`);
        updateHarvestStatusUI(false);
    });
}

// Auth Checking
async function checkAuth() {
    try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        currentUser = data.user;
        updateUserUI();
    } catch (e) {
        console.error('Auth error', e);
    }
}

function updateUserUI() {
    const userBadge = document.getElementById('user-badge');
    const adminNavBtn = document.getElementById('nav-admin-btn');
    const harvestNavBtn = document.getElementById('nav-harvest-btn');

    if (currentUser) {
        userBadge.innerHTML = `
            <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                <span class="text-xs font-semibold text-slate-700">${currentUser.full_name} (${currentUser.role === 'admin' ? 'অ্যাডমিন' : 'প্রতিনিধি'})</span>
                <button onclick="logout()" class="ml-2 text-xs text-rose-500 hover:text-rose-700 font-medium">লগআউট</button>
            </div>
        `;
        if (currentUser.role === 'admin') {
            adminNavBtn.classList.remove('hidden');
        } else {
            adminNavBtn.classList.add('hidden');
        }
        harvestNavBtn.classList.remove('hidden');
    } else {
        userBadge.innerHTML = `
            <button onclick="openModal('modal-login')" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-medium transition-all">
                <i class="fa-solid fa-user-lock mr-1"></i> লগইন করুন
            </button>
        `;
        adminNavBtn.classList.add('hidden');
    }
}

// Manual Check Request
async function handleSearch() {
    const phoneInput = document.getElementById('phone-input');
    const phone = phoneInput.value.trim();
    if (!phone) {
        alert('অনুগ্রহ করে মোবাইল নম্বর প্রদান করুন');
        return;
    }

    const searchBtn = document.getElementById('search-btn');
    searchBtn.disabled = true;
    searchBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> চেক করা হচ্ছে...`;

    try {
        const res = await fetch('/api/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const data = await res.json();
        if (data.success) {
            renderCheckerReport(data.report);
            loadLogs();
            loadStats();
        } else {
            alert(data.error || 'চেক করতে ব্যর্থ হয়েছে');
        }
    } catch (e) {
        alert('সার্ভার কানেকশনে সমস্যা হয়েছে');
    } finally {
        searchBtn.disabled = false;
        searchBtn.innerHTML = `<i class="fa-solid fa-magnifying-glass mr-2"></i> রিপোর্ট দেখুন`;
    }
}

// Quick Demo Trigger
function runDemo(phone) {
    document.getElementById('phone-input').value = phone;
    handleSearch();
}

// Render Checker UI
function renderCheckerReport(report) {
    currentReport = report;

    // 1. Phone badge
    document.getElementById('report-phone').innerText = report.phone;

    // 2. Gauge Score
    const percent = report.successRateNumber || 0;
    document.getElementById('gauge-text').innerText = `${percent}%`;

    // SVG Stroke Dashoffset calculation
    // Circle perimeter for r=70 is 2 * PI * 70 ≈ 440
    const circle = document.getElementById('gauge-circle');
    const offset = 440 - (440 * percent) / 100;
    circle.style.strokeDashoffset = offset;

    // Adjust gauge gradient stroke color
    if (percent >= 80) {
        circle.style.stroke = '#10b981'; // Green
    } else if (percent >= 50) {
        circle.style.stroke = '#f59e0b'; // Amber
    } else {
        circle.style.stroke = '#ef4444'; // Red
    }

    // 3. Advisory Card
    const advCard = document.getElementById('advisory-card');
    const advTitle = document.getElementById('advisory-title');
    const advDesc = document.getElementById('advisory-desc');
    const advIcon = document.getElementById('advisory-icon');

    advTitle.innerText = report.riskTitleBn;
    advDesc.innerText = report.riskDescBn;

    if (report.riskLevel === 'Safe') {
        advCard.className = 'mt-5 p-4 rounded-xl border flex items-start gap-3 bg-emerald-50/70 border-emerald-200';
        advTitle.className = 'font-bold text-sm text-emerald-800';
        advDesc.className = 'text-xs text-emerald-700 mt-0.5 leading-relaxed';
        advIcon.className = 'w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 flex-shrink-0';
        advIcon.innerHTML = `<i class="fa-solid fa-user-check text-sm"></i>`;
    } else if (report.riskLevel === 'Medium') {
        advCard.className = 'mt-5 p-4 rounded-xl border flex items-start gap-3 bg-amber-50/70 border-amber-200';
        advTitle.className = 'font-bold text-sm text-amber-800';
        advDesc.className = 'text-xs text-amber-700 mt-0.5 leading-relaxed';
        advIcon.className = 'w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0';
        advIcon.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-sm"></i>`;
    } else {
        advCard.className = 'mt-5 p-4 rounded-xl border flex items-start gap-3 bg-rose-50/70 border-rose-200';
        advTitle.className = 'font-bold text-sm text-rose-800';
        advDesc.className = 'text-xs text-rose-700 mt-0.5 leading-relaxed';
        advIcon.className = 'w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 flex-shrink-0';
        advIcon.innerHTML = `<i class="fa-solid fa-ban text-sm"></i>`;
    }

    // 4. Metrics Cards
    document.getElementById('stat-total-orders').innerText = report.totalOrders;
    document.getElementById('stat-total-delivery').innerText = report.totalDelivery;
    document.getElementById('stat-total-cancel').innerText = report.totalCancel;
    document.getElementById('stat-pathao-score').innerText = report.pathaoScore;

    // 5. Courier Breakdown Table
    const tbody = document.getElementById('courier-table-body');
    tbody.innerHTML = '';

    report.courierBreakdown.forEach(c => {
        let statusBadgeClass = 'badge-no-data';
        if (c.status === 'ভেরিফায়েড') statusBadgeClass = 'badge-verified';
        else if (c.status === 'সক্রিয়') statusBadgeClass = 'badge-active';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td class="font-medium text-slate-800">${c.courier}</td>
            <td><span class="${statusBadgeClass}">${c.status}</span></td>
            <td class="text-slate-600 font-semibold">${c.orders}</td>
            <td class="text-emerald-600 font-semibold">${c.delivery}</td>
            <td class="text-rose-600 font-semibold">${c.cancel}</td>
            <td class="font-bold text-slate-700">${c.rate}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Load Logs
async function loadLogs() {
    const searchVal = document.getElementById('log-search-input')?.value || '';
    const statusVal = document.getElementById('status-filter')?.value || 'all';

    let url = `/api/logs?dateFilter=${activeDateFilter}&statusFilter=${statusVal}`;
    if (searchVal.trim() !== '') {
        url += `&search=${encodeURIComponent(searchVal.trim())}`;
    }

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
            renderLogsTable(data.logs);
        }
    } catch (e) {
        console.error('Error loading logs', e);
    }
}

function renderLogsTable(logs) {
    const tbody = document.getElementById('history-table-body');
    tbody.innerHTML = '';

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-8 text-slate-400">
                    <i class="fa-regular fa-folder-open text-3xl mb-2 block"></i>
                    কোনো হিস্টোরি রেকর্ড পাওয়া যায়নি
                </td>
            </tr>
        `;
        return;
    }

    logs.forEach(log => {
        let badgeHtml = '';
        if (log.status_badge === 'Auto-Blocked') {
            badgeHtml = `<span class="badge-auto-blocked"><span class="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block mr-1"></span> High Risk</span>`;
        } else if (log.status_badge === 'High Risk') {
            badgeHtml = `<span class="badge-high-risk">High Risk</span>`;
        } else if (log.status_badge === 'Safe') {
            badgeHtml = `<span class="badge-safe">Safe</span>`;
        } else {
            badgeHtml = `<span class="badge-medium">Medium</span>`;
        }

        const dateFormatted = new Date(log.created_at).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const isAuto = log.status_badge === 'Auto-Blocked';
        const typeHtml = isAuto
            ? `<div class="flex items-center gap-1.5 font-bold text-xs text-rose-600"><span class="w-2 h-2 rounded-full bg-rose-600 inline-block"></span> AUTO-BLOCKED</div><div class="text-[11px] text-slate-400 mono-font">${log.order_ref || '#ORD'}</div>`
            : `<div class="font-medium text-xs text-slate-700 flex items-center gap-1.5"><i class="fa-regular fa-id-card text-slate-400"></i> Manual Check</div>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${typeHtml}</td>
            <td>
                <div class="flex items-center gap-2">
                    <span class="mono-font font-bold text-slate-800 text-xs">${log.phone}</span>
                    <button onclick="copyPhone('${log.phone}')" class="text-slate-400 hover:text-slate-600 text-xs" title="কপি করুন"><i class="fa-regular fa-copy"></i></button>
                </div>
                ${log.rep_name && currentUser?.role === 'admin' ? `<div class="text-[10px] text-slate-400 font-medium">দ্বারা: ${log.rep_name}</div>` : ''}
            </td>
            <td class="text-slate-600 font-semibold">${log.total_orders}</td>
            <td class="text-emerald-600 font-semibold">${log.total_delivery}</td>
            <td class="text-rose-600 font-semibold">${log.total_cancel}</td>
            <td class="font-bold text-slate-700">${log.success_rate}%</td>
            <td>${badgeHtml}</td>
            <td class="text-slate-500 text-xs">${dateFormatted}</td>
        `;
        tbody.appendChild(tr);
    });
}

// Load Summary Stats
async function loadStats() {
    try {
        const res = await fetch('/api/logs/stats');
        const data = await res.json();
        if (data.success) {
            document.getElementById('stat-total-verifications').innerText = data.totalVerifications;
            document.getElementById('stat-auto-blocked').innerText = data.autoBlocked;
            document.getElementById('stat-manual-checks').innerText = data.manualChecks;
        }
    } catch (e) {
        console.error(e);
    }
}

// Date Filter Selector
function setDateFilter(filterName, btnElement) {
    activeDateFilter = filterName;
    document.querySelectorAll('.date-filter-btn').forEach(b => {
        b.className = 'date-filter-btn text-xs font-medium px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-all';
    });
    btnElement.className = 'date-filter-btn text-xs font-semibold px-3 py-1.5 rounded-lg bg-teal-800 text-white shadow-sm transition-all';
    loadLogs();
}

// Status Filter Selector
function handleStatusFilterChange() {
    activeStatusFilter = document.getElementById('status-filter').value;
    loadLogs();
}

// Copy phone helper
function copyPhone(phone) {
    navigator.clipboard.writeText(phone);
    alert('নম্বর কপি করা হয়েছে: ' + phone);
}

// CSV Export
function exportLogsCSV() {
    window.open('/api/logs/export-csv', '_blank');
}

// Modal management
function openModal(modalId) {
    document.getElementById(modalId)?.classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
}

// Login
async function handleLoginSubmit(e) {
    e.preventDefault();
    const u = document.getElementById('login-username').value;
    const p = document.getElementById('login-password').value;

    try {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: u, password: p })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            closeModal('modal-login');
            updateUserUI();
            loadLogs();
            loadStats();
        } else {
            alert(data.error || 'ভুল তথ্য');
        }
    } catch (err) {
        alert('লগইন ব্যর্থ হয়েছে');
    }
}

async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    currentUser = null;
    updateUserUI();
    loadLogs();
    loadStats();
}

// =========================================================
// Auto-Harvesting (Discovery Scraping) Logic
// =========================================================
async function checkHarvestStatus() {
    try {
        const res = await fetch('/api/harvest/status');
        const data = await res.json();
        if (data.success && data.status) {
            updateHarvestStatusUI(data.status.is_running === 1);
            if (data.status.is_running === 1) {
                updateHarvestProgressUI({
                    currentPhone: data.status.current_phone,
                    processedCount: data.status.processed_count,
                    targetCount: data.status.target_count,
                    hitsFound: data.status.hits_found,
                    percent: Math.round((data.status.processed_count / (data.status.target_count || 1)) * 100)
                });
            }
        }
    } catch (e) {}
}

function updateHarvestStatusUI(isRunning) {
    const startBtn = document.getElementById('harvest-start-btn');
    const stopBtn = document.getElementById('harvest-stop-btn');
    const statusPill = document.getElementById('harvest-status-pill');

    if (isRunning) {
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
        statusPill.className = 'px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 animate-pulse';
        statusPill.innerText = '● রানিং (Crawling Active)';
    } else {
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
        statusPill.className = 'px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600';
        statusPill.innerText = 'আইডল (Stopped)';
    }
}

function updateHarvestProgressUI(data) {
    document.getElementById('harvest-curr-phone').innerText = data.currentPhone || '01XXXXXXXXX';
    document.getElementById('harvest-processed').innerText = data.processedCount;
    document.getElementById('harvest-target').innerText = data.targetCount;
    document.getElementById('harvest-hits').innerText = data.hitsFound;
    document.getElementById('harvest-percent').innerText = `${data.percent || 0}%`;
    document.getElementById('harvest-progress-bar').style.width = `${data.percent || 0}%`;
}

function addHarvestLiveRow(data) {
    const list = document.getElementById('harvest-live-list');
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg text-xs';
    item.innerHTML = `
        <span class="mono-font font-bold text-slate-800">${data.phone}</span>
        <span class="text-slate-600">অর্ডার: <b>${data.orders}</b></span>
        <span class="text-emerald-600 font-semibold">ডেলিভারি: <b>${data.delivery}</b></span>
        <span class="text-rose-600 font-semibold">ক্যানসেল: <b>${data.cancel}</b></span>
        <span class="badge-safe">${data.rate}</span>
    `;
    list.prepend(item);
    if (list.children.length > 20) list.lastElementChild.remove();
}

async function startHarvestJob() {
    const target = parseInt(document.getElementById('harvest-target-input').value) || 500;
    const ops = [];
    if (document.getElementById('op-gp').checked) ops.push('gp');
    if (document.getElementById('op-bl').checked) ops.push('bl');
    if (document.getElementById('op-robi').checked) ops.push('robi');
    if (document.getElementById('op-airtel').checked) ops.push('airtel');
    if (document.getElementById('op-teletalk').checked) ops.push('teletalk');

    try {
        const res = await fetch('/api/harvest/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetCount: target, operators: ops })
        });
        const data = await res.json();
        if (data.success) {
            updateHarvestStatusUI(true);
        } else {
            alert(data.message || 'শুরু করা যায়নি');
        }
    } catch (e) {
        alert('কানেকশন ত্রুটি');
    }
}

async function stopHarvestJob() {
    try {
        await fetch('/api/harvest/stop', { method: 'POST' });
        updateHarvestStatusUI(false);
    } catch (e) {}
}

// =========================================================
// Admin Panel Management (Representatives & API Keys)
// =========================================================
async function openAdminPanel() {
    openModal('modal-admin');
    await loadAdminUsers();
    await loadAdminApiKeys();
    await loadCentralCustomers();
}

async function loadAdminUsers() {
    try {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        if (data.success) {
            const tbody = document.getElementById('admin-users-table');
            tbody.innerHTML = '';
            data.users.forEach(u => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="font-semibold text-slate-800">${u.full_name} (@${u.username})</td>
                    <td><span class="px-2 py-0.5 rounded text-[11px] font-bold ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}">${u.role}</span></td>
                    <td><span class="px-2 py-0.5 rounded text-[11px] font-bold ${u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">${u.status}</span></td>
                    <td>
                        <button onclick="toggleUserStatus(${u.id})" class="text-xs text-blue-600 hover:underline mr-2">টগল</button>
                        ${u.id !== currentUser.id ? `<button onclick="deleteUser(${u.id})" class="text-xs text-rose-600 hover:underline">মুছুন</button>` : ''}
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {}
}

async function handleCreateUser(e) {
    e.preventDefault();
    const un = document.getElementById('new-user-username').value;
    const pw = document.getElementById('new-user-password').value;
    const fn = document.getElementById('new-user-fullname').value;
    const rl = document.getElementById('new-user-role').value;

    const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: un, password: pw, full_name: fn, role: rl })
    });
    const data = await res.json();
    if (data.success) {
        alert('ব্যবহারকারী যোগ করা হয়েছে');
        document.getElementById('create-user-form').reset();
        loadAdminUsers();
    } else {
        alert(data.error || 'ব্যর্থ হয়েছে');
    }
}

async function toggleUserStatus(id) {
    await fetch(`/api/admin/users/${id}/toggle`, { method: 'POST' });
    loadAdminUsers();
}

async function deleteUser(id) {
    if (!confirm('আপনি কি নিশ্চিত?')) return;
    await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
    loadAdminUsers();
}

// API Keys Management
async function loadAdminApiKeys() {
    try {
        const res = await fetch('/api/admin/api-keys');
        const data = await res.json();
        if (data.success) {
            const tbody = document.getElementById('admin-keys-table');
            tbody.innerHTML = '';
            data.keys.forEach(k => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="font-bold text-slate-800">${k.courier_name}</td>
                    <td class="mono-font text-xs text-slate-500">${k.key_value.substring(0, 8)}••••••••</td>
                    <td><span class="font-semibold text-emerald-600">${k.usage_count}</span> / ${k.daily_limit}</td>
                    <td>
                        <button onclick="resetKeyCount(${k.id})" class="text-xs text-blue-600 hover:underline mr-2">রিসেট</button>
                        <button onclick="deleteApiKey(${k.id})" class="text-xs text-rose-600 hover:underline">ডিলিট</button>
                    </td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {}
}

async function handleAddApiKey(e) {
    e.preventDefault();
    const cname = document.getElementById('new-key-courier').value;
    const kval = document.getElementById('new-key-val').value;
    const limit = document.getElementById('new-key-limit').value;

    const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courierName: cname, keyValue: kval, dailyLimit: limit })
    });
    const data = await res.json();
    if (data.success) {
        alert('API কী সফলভাবে পুলে যোগ হয়েছে');
        document.getElementById('add-key-form').reset();
        loadAdminApiKeys();
    } else {
        alert(data.error || 'যোগ করতে ব্যর্থ হয়েছে');
    }
}

async function resetKeyCount(id) {
    await fetch(`/api/admin/api-keys/${id}/reset`, { method: 'POST' });
    loadAdminApiKeys();
}

async function deleteApiKey(id) {
    if (!confirm('API কী মুছে ফেলবেন?')) return;
    await fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' });
    loadAdminApiKeys();
}

// Central Customers Intelligence Explorer
async function loadCentralCustomers() {
    try {
        const res = await fetch('/api/admin/central-customers');
        const data = await res.json();
        if (data.success) {
            const countEl = document.getElementById('central-cust-count');
            if (countEl) countEl.innerText = data.customers.length;

            const tbody = document.getElementById('central-cust-table');
            tbody.innerHTML = '';
            data.customers.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="mono-font font-bold text-slate-800">${c.phone}</td>
                    <td class="text-slate-600 font-semibold">${c.total_orders}</td>
                    <td class="text-emerald-600 font-semibold">${c.total_delivery}</td>
                    <td class="text-rose-600 font-semibold">${c.total_cancel}</td>
                    <td class="font-bold text-slate-700">${c.success_rate}%</td>
                    <td><span class="${c.risk_level === 'Safe' ? 'badge-safe' : 'badge-high-risk'}">${c.risk_level}</span></td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch (e) {}
}
