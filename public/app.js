// Ecom Centrix Cart - Client SPA Controller

const COURIER_META = {
    'Steadfast': { logo: '/assets/courier-logo/steadfast.svg', defaultStatus: 'Verified' },
    'Pathao': { logo: '/assets/courier-logo/pathao.svg', defaultStatus: 'Verified' },
    'RedX': { logo: '/assets/courier-logo/redx.svg', defaultStatus: 'Active' },
    'CarryBee': { logo: '/assets/courier-logo/carrybee.svg', defaultStatus: 'No Data' },
    'Paperfly': { logo: '/assets/courier-logo/paperfly.svg', defaultStatus: 'No Data' },
    'ParcelDex': { logo: '/assets/courier-logo/parceldex.svg', defaultStatus: 'No Data' }
};

let currentUser = null;
let userSearchDebounceTimer = null;

// ==========================================
// SPA TAB SWITCHER (User App Isolated)
// ==========================================
function switchUserTab(tab) {
    const tabs = ['checker', 'report', 'analytics', 'blacklist', 'settings'];
    
    tabs.forEach(t => {
        const view = document.getElementById(`view-${t}`);
        if (view) view.classList.add('hidden');

        // Desktop nav button
        const dBtn = document.getElementById(`nav-btn-${t}`);
        if (dBtn) {
            dBtn.className = 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-600 hover:text-purple-800 hover:bg-purple-50/50 transition text-left text-xs font-semibold';
            const icon = dBtn.querySelector('i');
            if (icon) icon.className = icon.className.replace('text-purple-700', 'text-slate-400');
        }

        // Mobile bottom nav button
        const mBtn = document.getElementById(`mobile-btn-${t}`);
        if (mBtn) {
            mBtn.className = 'flex flex-col items-center justify-center flex-1 py-1 text-slate-400 hover:text-purple-700 transition text-[10px] font-semibold';
        }
    });

    // Activate selected view
    const targetView = document.getElementById(`view-${tab}`);
    if (targetView) targetView.classList.remove('hidden');

    // Activate desktop nav
    const activeDBtn = document.getElementById(`nav-btn-${tab}`);
    if (activeDBtn) {
        activeDBtn.className = 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-purple-50 text-purple-800 font-bold border-l-4 border-purple-700 shadow-2xs transition text-left text-xs';
        const icon = activeDBtn.querySelector('i');
        if (icon) icon.className = icon.className.replace('text-slate-400', 'text-purple-700');
    }

    // Activate mobile nav
    const activeMBtn = document.getElementById(`mobile-btn-${tab}`);
    if (activeMBtn) {
        activeMBtn.className = 'flex flex-col items-center justify-center flex-1 py-1 text-purple-700 font-bold text-[10px] transition';
    }

    // Load dynamic data on tab switch
    if (tab === 'report') loadUserHistory();
    if (tab === 'analytics') loadUserAnalytics();
    if (tab === 'blacklist') loadUserBlacklist();
    if (tab === 'settings') loadUserProfile();
}

// ==========================================
// PROFILE DROPDOWN & AUTH
// ==========================================
function toggleProfileDropdown() {
    const d = document.getElementById('profile-dropdown');
    if (d) d.classList.toggle('hidden');
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('profile-dropdown');
    const btn = e.target.closest('button[onclick="toggleProfileDropdown()"]');
    if (dropdown && !dropdown.contains(e.target) && !btn) {
        dropdown.classList.add('hidden');
    }
});

async function initCurrentUser() {
    try {
        const res = await fetch('/api/auth/me').then(r => r.json());
        if (res.success && res.user) {
            currentUser = res.user;
            const name = res.user.full_name || res.user.username;
            const initial = name.charAt(0).toUpperCase();
            
            const uName = document.getElementById('user-display-name');
            if (uName) uName.innerText = name;
            const dName = document.getElementById('dropdown-fullname');
            if (dName) dName.innerText = name;
            const dRole = document.getElementById('dropdown-role');
            if (dRole) dRole.innerText = `@${res.user.username} (${res.user.role})`;
            const dAvatar = document.getElementById('user-avatar-initial');
            if (dAvatar) dAvatar.innerText = initial;
            const mAvatar = document.getElementById('mobile-avatar-initial');
            if (mAvatar) mAvatar.innerText = initial;

            // If user is admin, show Admin Hub button in profile dropdown and mobile shortcut
            if (res.user.role === 'admin') {
                const adminLink = document.getElementById('admin-hub-link');
                if (adminLink) adminLink.classList.remove('hidden');
                const mAdminShortcut = document.getElementById('mobile-admin-shortcut');
                if (mAdminShortcut) mAdminShortcut.classList.remove('hidden');
            }
        } else {
            // Not logged in or guest
            const uName = document.getElementById('user-display-name');
            if (uName) uName.innerText = 'লগইন করুন';
            const dName = document.getElementById('dropdown-fullname');
            if (dName) dName.innerText = 'Guest Visitor';
            const dRole = document.getElementById('dropdown-role');
            if (dRole) dRole.innerText = 'Public User';
        }
    } catch (e) {
        console.error('Auth Check Error:', e);
    }
}

async function handleUserLogout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (e) {
        window.location.href = '/login';
    }
}

// ==========================================
// FRAUD CHECKER (PRIMARY ACTION)
// ==========================================
function copyPhone() {
    const phone = document.getElementById('display-phone').innerText.trim();
    if (phone) {
        navigator.clipboard.writeText(phone).then(() => {
            const btn = document.querySelector('button[title="কপি করুন"]');
            if (btn) {
                const original = btn.innerHTML;
                btn.innerHTML = `<i class="fa-solid fa-check text-emerald-600"></i>`;
                setTimeout(() => btn.innerHTML = original, 1400);
            }
        });
    }
}

async function performCheck(explicitPhone) {
    const input = document.getElementById('phone-input');
    const phone = explicitPhone || input.value.trim();
    const cleanPhone = phone.replace(/[^0-9]/g, '');

    if (cleanPhone.length < 11) {
        alert('অনুগ্রহ করে সঠিক ১১ ডিজিটের মোবাইল নম্বর প্রদান করুন');
        return;
    }

    const btn = document.getElementById('search-btn');
    const originalBtnHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-xs"></i> <span>যাচাই হচ্ছে...</span>`;

    try {
        const response = await fetch('/api/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: cleanPhone })
        });

        const res = await response.json();
        if (!res.success || !res.data) {
            alert(res.error || 'তথ্য যাচাই করতে ব্যর্থ হয়েছে');
            return;
        }

        renderDashboard(res.data);
    } catch (err) {
        console.error('Check Error:', err);
        alert('সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি।');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnHtml;
    }
}

function renderDashboard(data) {
    document.getElementById('display-phone').innerText = data.phone;

    // Trust Score & Gradient Arc
    const rate = data.successRateNumber || 0;
    document.getElementById('gauge-percent').innerText = `${rate}%`;

    const gaugeCircle = document.getElementById('gauge-circle');
    const maxOffset = 402;
    const offset = maxOffset - (maxOffset * rate / 100);
    gaugeCircle.style.strokeDashoffset = offset;

    const gradient = document.getElementById('trustGradient');
    let riskBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    let riskBadgeIcon = 'fa-regular fa-circle-check';
    let riskBadgeText = 'নিম্ন ঝুঁকি (Low Risk)';
    let riskDesc = 'এই নম্বরধারীর কুরিয়ার ডেলিভারি রেকর্ড ভালো এবং ফ্রডের সম্ভাবনা কম।';

    if (data.totalOrders === 0) {
        if (gradient) gradient.innerHTML = `<stop offset="0%" stop-color="#94a3b8" /><stop offset="100%" stop-color="#64748b" />`;
        riskBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
        riskBadgeIcon = 'fa-regular fa-circle-question';
        riskBadgeText = 'নতুন কাস্টমার (No Record)';
        riskDesc = 'পূর্বে কোনো কুরিয়ার ডেলিভারি হিস্ট্রি পাওয়া যায়নি। ফোনে কথা বলে কনফার্ম করুন।';
    } else if (rate < 50) {
        if (gradient) gradient.innerHTML = `<stop offset="0%" stop-color="#fb7185" /><stop offset="100%" stop-color="#e11d48" />`;
        riskBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
        riskBadgeIcon = 'fa-solid fa-triangle-exclamation';
        riskBadgeText = `উচ্চ ঝুঁকি (High Risk - ${rate}%)`;
        riskDesc = 'কাস্টমারের পার্সেল রিটার্নের হার অস্বাভাবিক বেশি। অগ্রিম ডেলিভারি চার্জ ছাড়া অর্ডার পাঠানো ঝুঁকিপূর্ণ।';
    } else if (rate < 80) {
        if (gradient) gradient.innerHTML = `<stop offset="0%" stop-color="#fbbf24" /><stop offset="100%" stop-color="#d97706" />`;
        riskBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
        riskBadgeIcon = 'fa-solid fa-shield-halved';
        riskBadgeText = `মাঝারি ঝুঁকি (Medium Risk - ${rate}%)`;
        riskDesc = 'কাস্টমারের কিছু রিটার্ন রেকর্ড রয়েছে। অর্ডার কনফার্ম করার পূর্বে ফোনে নিশ্চিত হয়ে নিন।';
    } else {
        if (gradient) gradient.innerHTML = `<stop offset="0%" stop-color="#84cc16" /><stop offset="100%" stop-color="#10b981" />`;
        riskBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        riskBadgeIcon = 'fa-regular fa-circle-check';
        riskBadgeText = `নিম্ন ঝুঁকি (Low Risk - ${rate}%)`;
        riskDesc = 'এই নম্বরধারীর কুরিয়ার ডেলিভারি রেকর্ড ভালো এবং ফ্রডের সম্ভাবনা কম।';
    }

    const badgeEl = document.getElementById('risk-badge');
    badgeEl.className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${riskBadgeClass}`;
    badgeEl.innerHTML = `<i class="${riskBadgeIcon}"></i> <span>${riskBadgeText}</span>`;
    document.getElementById('risk-desc-text').innerText = riskDesc;

    // Metric Summary Cards
    document.getElementById('stat-total-orders').innerText = data.totalOrders;
    document.getElementById('stat-delivered').innerText = data.totalDelivery;
    document.getElementById('stat-cancelled').innerText = data.totalCancel;
    document.getElementById('stat-rate').innerText = `${rate.toFixed(2)}%`;

    // Courier Table
    const tbody = document.getElementById('courier-table-body');
    if (Array.isArray(data.courierBreakdown) && data.courierBreakdown.length > 0) {
        tbody.innerHTML = data.courierBreakdown.map(c => {
            const hasData = c.orders > 0;
            const meta = COURIER_META[c.courier] || {
                logo: '/assets/courier-logo/steadfast.svg',
                defaultStatus: hasData ? 'Verified' : 'No Data'
            };

            let statusBadge = '';
            if (hasData) {
                if (c.courier === 'RedX') {
                    statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"><i class="fa-solid fa-bolt text-[9px]"></i> Active</span>`;
                } else {
                    statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><i class="fa-regular fa-circle-check text-[9px]"></i> Verified</span>`;
                }
            } else {
                statusBadge = `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-slate-500 bg-slate-100"><i class="fa-regular fa-circle text-[8px]"></i> No Data</span>`;
            }

            const waCell = (data.hasWhatsApp || hasData)
                ? `<span class="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-semibold font-mono"><i class="fa-brands fa-whatsapp text-xs"></i> ${data.phone}</span>`
                : `<span class="text-slate-300 font-mono">—</span>`;

            const numClass = hasData ? 'text-slate-900 font-semibold' : 'text-slate-400';
            const delivClass = hasData ? 'text-emerald-600 font-semibold' : 'text-slate-400';
            const cancelClass = hasData ? 'text-rose-500 font-semibold' : 'text-slate-400';
            const rateClass = hasData ? 'text-slate-900 font-bold' : 'text-slate-400 font-mono';

            return `
                <tr>
                    <td class="py-3 px-4 flex items-center gap-2.5">
                        <img src="${meta.logo}" alt="${c.courier}" class="h-4 w-auto object-contain ${hasData ? '' : 'opacity-70'}" onerror="this.style.display='none'">
                        <span class="${hasData ? 'font-bold text-slate-900' : 'text-slate-600 font-semibold'}">${c.courier}</span>
                    </td>
                    <td class="py-3 px-3 text-center">${statusBadge}</td>
                    <td class="py-3 px-3 text-center font-['Outfit'] ${numClass}">${c.orders}</td>
                    <td class="py-3 px-3 text-center font-['Outfit'] ${delivClass}">${c.delivery}</td>
                    <td class="py-3 px-3 text-center font-['Outfit'] ${cancelClass}">${c.cancel}</td>
                    <td class="py-3 px-3 text-center">${waCell}</td>
                    <td class="py-3 px-4 text-right font-['Outfit'] ${rateClass}">${c.rate}</td>
                </tr>
            `;
        }).join('');
    }
}

// ==========================================
// USER HISTORY (REPORT TAB)
// ==========================================
function debounceUserSearch() {
    clearTimeout(userSearchDebounceTimer);
    userSearchDebounceTimer = setTimeout(loadUserHistory, 350);
}

async function loadUserHistory() {
    const search = document.getElementById('user-history-search')?.value.trim() || '';
    let url = `/api/user/verifications?limit=40`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    try {
        const res = await fetch(url).then(r => r.json());
        const tbody = document.getElementById('user-history-rows');
        if (!res.success || !res.records || res.records.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-400">কোনো হিস্ট্রি রেকর্ড পাওয়া যায়নি</td></tr>`;
            return;
        }

        tbody.innerHTML = res.records.map(r => {
            const isHighRisk = r.risk_level === 'High Risk' || r.status_badge === 'High Risk';
            const badgeClass = isHighRisk 
                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                : (r.risk_level === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200');

            const dateStr = new Date(r.created_at).toLocaleDateString('bn-BD', { day: '2-digit', month: 'short' });

            return `
                <tr>
                    <td class="py-3 px-4 font-mono font-bold text-slate-800">${r.order_ref || '#ORD'}</td>
                    <td class="py-3 px-4 font-mono font-bold text-slate-900">${r.phone}</td>
                    <td class="py-3 px-4 text-center font-['Outfit']">${r.total_orders}</td>
                    <td class="py-3 px-4 text-center font-['Outfit'] text-emerald-600 font-semibold">${r.total_delivery}</td>
                    <td class="py-3 px-4 text-center font-['Outfit'] text-rose-500 font-semibold">${r.total_cancel}</td>
                    <td class="py-3 px-4 text-center font-['Outfit'] font-bold text-slate-800">${r.success_rate}%</td>
                    <td class="py-3 px-4 text-center">
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${badgeClass}">
                            ${r.status_badge || r.risk_level}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-right text-slate-500 font-['Outfit']">${dateStr}</td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        console.error('History load error:', e);
    }
}

// ==========================================
// USER ANALYTICS
// ==========================================
async function loadUserAnalytics() {
    try {
        const res = await fetch('/api/user/analytics').then(r => r.json());
        if (res.success && res.analytics) {
            document.getElementById('analytics-total').innerText = res.analytics.totalChecks;
            document.getElementById('analytics-safe').innerText = res.analytics.safeCount;
            document.getElementById('analytics-highrisk').innerText = res.analytics.highRiskCount;
            document.getElementById('analytics-rate').innerText = `${res.analytics.avgSuccessRate}%`;
        }
    } catch (e) {
        console.error('Analytics load error:', e);
    }
}

// ==========================================
// USER BLACKLIST
// ==========================================
async function loadUserBlacklist() {
    try {
        const res = await fetch('/api/user/blacklist').then(r => r.json());
        const tbody = document.getElementById('blacklist-rows');
        if (!res.success || !res.blacklist || res.blacklist.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="py-8 text-center text-slate-400">কোনো ব্ল্যাকলিস্ট নম্বর পাওয়া যায়নি</td></tr>`;
            return;
        }

        tbody.innerHTML = res.blacklist.map(b => `
            <tr>
                <td class="py-3 px-4 font-mono font-bold text-slate-900">${b.phone}</td>
                <td class="py-3 px-4 text-center font-['Outfit']">${b.total_orders}</td>
                <td class="py-3 px-4 text-center font-['Outfit'] text-rose-600 font-bold">${b.total_cancel}</td>
                <td class="py-3 px-4 text-center font-['Outfit'] font-bold text-rose-700">${b.success_rate}%</td>
                <td class="py-3 px-4 text-center">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">High Risk</span>
                </td>
                <td class="py-3 px-4 text-right">
                    <button onclick="navigator.clipboard.writeText('${b.phone}')" class="text-xs text-purple-700 hover:text-purple-900 font-bold">কপি</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error('Blacklist load error:', e);
    }
}

// ==========================================
// USER SETTINGS
// ==========================================
function loadUserProfile() {
    if (currentUser) {
        document.getElementById('settings-fullname').value = currentUser.full_name || currentUser.username;
    }
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const fullName = document.getElementById('settings-fullname').value.trim();
    const newPassword = document.getElementById('settings-newpassword').value;

    try {
        const res = await fetch('/api/user/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, newPassword })
        }).then(r => r.json());

        if (res.success) {
            alert('আপনার প্রোফাইল তথ্য সফলভাবে আপডেট হয়েছে!');
            document.getElementById('settings-newpassword').value = '';
            initCurrentUser();
        } else {
            alert(res.error || 'আপডেট করতে ব্যর্থ হয়েছে');
        }
    } catch (e) {
        alert('সার্ভার এরর');
    }
}

// Enter Key triggers search on Fraud Checker
document.addEventListener('DOMContentLoaded', () => {
    initCurrentUser();

    const input = document.getElementById('phone-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performCheck();
        });
    }

    // Initial check for default phone
    performCheck('01911167991');
});
