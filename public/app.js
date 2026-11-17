// Ecom Centrix Cart - Client SPA Controller
const socket = (typeof io !== 'undefined') ? io() : null;

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
let isHarvestingRunning = false;

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
// COLLAPSIBLE SIDEBAR
// ==========================================
function toggleSidebar() {
    const sidebar = document.getElementById('app-sidebar');
    const container = document.getElementById('main-app-container');
    const toggleBtn = document.getElementById('sidebar-toggle-btn');
    const expandPill = document.getElementById('sidebar-expand-pill');
    const toggleIcon = document.getElementById('sidebar-toggle-icon');
    if (!sidebar) return;

    const isCurrentlyCollapsed = sidebar.classList.contains('w-[72px]') || sidebar.classList.contains('w-[74px]');

    if (isCurrentlyCollapsed) {
        // Expand
        sidebar.classList.remove('w-[72px]', 'w-[74px]', 'px-2.5');
        sidebar.classList.add('w-[225px]', 'p-4');
        if (container) {
            container.classList.remove('max-w-[1100px]');
            container.classList.add('max-w-[1240px]');
        }
        document.querySelectorAll('.sidebar-text-block, .sidebar-label').forEach(el => el.classList.remove('hidden'));
        if (toggleBtn) toggleBtn.classList.remove('hidden');
        if (expandPill) expandPill.classList.add('hidden');
        if (toggleIcon) toggleIcon.className = 'fa-solid fa-chevron-left text-[10px]';
    } else {
        // Collapse
        sidebar.classList.remove('w-[225px]', 'p-4');
        sidebar.classList.add('w-[72px]', 'px-2.5', 'py-4');
        if (container) {
            container.classList.remove('max-w-[1240px]');
            container.classList.add('max-w-[1100px]');
        }
        document.querySelectorAll('.sidebar-text-block, .sidebar-label').forEach(el => el.classList.add('hidden'));
        if (toggleBtn) toggleBtn.classList.add('hidden');
        if (expandPill) expandPill.classList.remove('hidden');
        if (toggleIcon) toggleIcon.className = 'fa-solid fa-chevron-right text-[10px]';
    }
}

// ==========================================
// LANGUAGE SWITCHER
// ==========================================
function toggleLanguageDropdown() {
    const d = document.getElementById('language-dropdown');
    if (d) d.classList.toggle('hidden');
}

function changeLanguage(lang) {
    localStorage.setItem('app_lang', lang);
    const d = document.getElementById('language-dropdown');
    if (d) d.classList.add('hidden');

    const checkBn = document.getElementById('lang-check-bn');
    const checkEn = document.getElementById('lang-check-en');
    if (checkBn && checkEn) {
        if (lang === 'bn') {
            checkBn.classList.remove('hidden');
            checkEn.classList.add('hidden');
        } else {
            checkBn.classList.add('hidden');
            checkEn.classList.remove('hidden');
        }
    }
}

// ==========================================
// PROFILE DROPDOWN & AUTH
// ==========================================
function toggleProfileDropdown() {
    const d = document.getElementById('profile-dropdown');
    if (d) d.classList.toggle('hidden');
}

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
    const pDropdown = document.getElementById('profile-dropdown');
    const pBtn = e.target.closest('button[onclick="toggleProfileDropdown()"]');
    if (pDropdown && !pDropdown.contains(e.target) && !pBtn) {
        pDropdown.classList.add('hidden');
    }

    const lDropdown = document.getElementById('language-dropdown');
    const lBtn = e.target.closest('button[onclick="toggleLanguageDropdown()"]');
    if (lDropdown && !lDropdown.contains(e.target) && !lBtn) {
        lDropdown.classList.add('hidden');
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
            window.location.href = '/login';
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
    const phone = document.getElementById('display-phone')?.innerText.trim();
    if (phone) {
        navigator.clipboard.writeText(phone).then(() => {
            const btn = document.querySelector('button[title="কপি করুন"]');
            if (btn) {
                const original = btn.innerHTML;
                btn.innerHTML = `<i class="fa-solid fa-check text-emerald-600 text-xs"></i>`;
                setTimeout(() => btn.innerHTML = original, 1400);
            }
        });
    }
}

function copyHarvestPhone() {
    const phone = document.getElementById('harvest-active-phone')?.innerText.trim();
    if (phone) {
        navigator.clipboard.writeText(phone);
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
    // 1. Phone row reveal
    const phoneRow = document.getElementById('result-phone-row');
    const displayPhone = document.getElementById('display-phone');
    if (displayPhone) displayPhone.innerText = data.phone;
    if (phoneRow) phoneRow.classList.remove('hidden');

    // 2. Trust Score & Gradient Arc
    const rate = Math.round(data.successRateNumber || 0);
    const gaugePercent = document.getElementById('gauge-percent');
    if (gaugePercent) gaugePercent.innerText = `${rate}%`;

    const gaugeCircle = document.getElementById('gauge-circle');
    const maxOffset = 402;
    const offset = maxOffset - (maxOffset * rate / 100);
    if (gaugeCircle) gaugeCircle.style.strokeDashoffset = offset;

    const gradient = document.getElementById('trustGradient');
    const riskCard = document.getElementById('risk-result-card');
    const pillBadge = document.getElementById('risk-pill-badge');
    const pillIcon = document.getElementById('risk-pill-icon');
    const pillText = document.getElementById('risk-pill-text');
    const headlineIcon = document.getElementById('risk-headline-icon');
    const headlineText = document.getElementById('risk-headline-text');
    const subtext = document.getElementById('risk-subtext');

    if (riskCard) riskCard.classList.remove('hidden');

    // TIER 1: 100% or Safe (ঝুঁকিমুক্ত)
    if (rate >= 80 || data.totalOrders === 0 && rate === 100) {
        if (gradient) {
            gradient.innerHTML = `<stop offset="0%" stop-color="#84cc16" /><stop offset="100%" stop-color="#10b981" />`;
        }
        if (riskCard) {
            riskCard.className = 'w-full mt-1.5 p-2.5 rounded-xl border border-emerald-300 bg-emerald-50/40 text-center transition-all duration-300';
        }
        if (pillBadge) pillBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-emerald-700 border border-emerald-200 shadow-2xs';
        if (pillIcon) pillIcon.className = 'fa-regular fa-circle-check text-[9px]';
        if (pillText) pillText.innerText = `Low Risk (${rate}%)`;

        if (headlineIcon) headlineIcon.className = 'fa-solid fa-user-plus text-sm text-emerald-700';
        if (headlineText) {
            headlineText.innerText = 'ঝুঁকিমুক্ত';
            headlineText.className = 'text-sm sm:text-base font-extrabold text-emerald-800';
        }
        if (subtext) {
            subtext.innerText = 'এই কাস্টমারকে নিশ্চিন্তে পার্সেল দিতে পারেন।';
            subtext.className = 'text-[11px] text-emerald-800/80 mt-0.5 font-medium leading-relaxed';
        }
    } 
    // TIER 2: Medium Risk (নিম্ন ঝুঁকি)
    else if (rate >= 50) {
        if (gradient) {
            gradient.innerHTML = `<stop offset="0%" stop-color="#fbbf24" /><stop offset="100%" stop-color="#d97706" />`;
        }
        if (riskCard) {
            riskCard.className = 'w-full mt-1.5 p-2.5 rounded-xl border border-amber-300 bg-amber-50/40 text-center transition-all duration-300';
        }
        if (pillBadge) pillBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-amber-700 border border-amber-200 shadow-2xs';
        if (pillIcon) pillIcon.className = 'fa-regular fa-circle-check text-[9px]';
        if (pillText) pillText.innerText = `Low Risk (${rate}%)`;

        if (headlineIcon) headlineIcon.className = 'fa-solid fa-user-check text-sm text-amber-700';
        if (headlineText) {
            headlineText.innerText = 'নিম্ন ঝুঁকি';
            headlineText.className = 'text-sm sm:text-base font-extrabold text-amber-800';
        }
        if (subtext) {
            subtext.innerText = 'এই কাস্টমারের ডেলিভারি রেট ভালো।';
            subtext.className = 'text-[11px] text-amber-800/80 mt-0.5 font-medium leading-relaxed';
        }
    } 
    // TIER 3: High Risk (উচ্চ ঝুঁকি)
    else {
        if (gradient) {
            gradient.innerHTML = `<stop offset="0%" stop-color="#fb7185" /><stop offset="100%" stop-color="#e11d48" />`;
        }
        if (riskCard) {
            riskCard.className = 'w-full mt-1.5 p-2.5 rounded-xl border border-rose-300 bg-rose-50/40 text-center transition-all duration-300';
        }
        if (pillBadge) pillBadge.className = 'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white text-rose-700 border border-rose-200 shadow-2xs';
        if (pillIcon) pillIcon.className = 'fa-solid fa-triangle-exclamation text-[9px]';
        if (pillText) pillText.innerText = `High Risk (${rate}%)`;

        if (headlineIcon) headlineIcon.className = 'fa-solid fa-triangle-exclamation text-sm text-rose-600';
        if (headlineText) {
            headlineText.innerText = 'উচ্চ ঝুঁকি';
            headlineText.className = 'text-sm sm:text-base font-extrabold text-rose-700';
        }
        if (subtext) {
            subtext.innerText = 'কাস্টমারের পার্সেল রিটার্নের হার অস্বাভাবিক বেশি। অগ্রিম চার্জ ছাড়া অর্ডার ঝুঁকিপূর্ণ।';
            subtext.className = 'text-[11px] text-rose-700/80 mt-0.5 font-medium leading-relaxed';
        }
    }

    // 3. Metric Summary Cards
    document.getElementById('stat-total-orders').innerText = data.totalOrders;
    document.getElementById('stat-delivered').innerText = data.totalDelivery;
    document.getElementById('stat-cancelled').innerText = data.totalCancel;
    document.getElementById('stat-rate').innerText = `${rate.toFixed(2)}%`;

    // 4. Detailed Courier Table
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
// DATA SCRAPING & HARVEST CONTROLLER
// ==========================================
async function handleHarvestToggle() {
    const btn = document.getElementById('harvest-action-btn');
    const liveBox = document.getElementById('harvest-live-box');
    
    if (!isHarvestingRunning) {
        const targetCount = parseInt(document.getElementById('harvest-target-input').value) || 100;
        const operator = document.getElementById('harvest-operator-select').value;
        const operators = operator === 'all' ? ['gp', 'bl', 'robi', 'airtel', 'teletalk'] : [operator];

        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-[10px]"></i> <span>Starting...</span>`;

        try {
            const res = await fetch('/api/harvest/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetCount, operators })
            }).then(r => r.json());

            if (res.success) {
                isHarvestingRunning = true;
                btn.className = 'w-full py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-2';
                btn.innerHTML = `<i class="fa-solid fa-stop text-[10px]"></i> <span>Stop scraping</span>`;
                liveBox.classList.remove('hidden');
                document.getElementById('harvest-fraction-text').innerText = `0 / ${targetCount}`;
                document.getElementById('harvest-count-remaining').innerText = targetCount;
            } else {
                btn.className = 'w-full py-2.5 bg-purple-700 hover:bg-purple-800 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-2';
                btn.innerHTML = `<i class="fa-solid fa-play text-[10px]"></i> <span>Start scraping</span>`;
                alert(res.error || res.message || 'স্ক্র্যাপিং শুরু করতে ব্যর্থ হয়েছে');
            }
        } catch (e) {
            btn.className = 'w-full py-2.5 bg-purple-700 hover:bg-purple-800 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-2';
            btn.innerHTML = `<i class="fa-solid fa-play text-[10px]"></i> <span>Start scraping</span>`;
            alert('সার্ভার সংযোগ সমস্যা');
        } finally {
            btn.disabled = false;
        }
    } else {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-[10px]"></i> <span>বন্ধ হচ্ছে...</span>`;
        try {
            await fetch('/api/harvest/stop', { method: 'POST' });
            isHarvestingRunning = false;
            btn.className = 'w-full py-2.5 bg-purple-700 hover:bg-purple-800 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-2';
            btn.innerHTML = `<i class="fa-solid fa-play text-[10px]"></i> <span>Start scraping</span>`;
            const badge = document.getElementById('harvest-badge-status');
            if (badge) {
                badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200';
                badge.innerHTML = `<span>Scraping stopped</span>`;
            }
        } catch (e) {
            console.error(e);
        } finally {
            btn.disabled = false;
        }
    }
}

// Socket.io Real-time Event Wiring
if (socket) {
    socket.on('harvest_progress', (data) => {
        const liveBox = document.getElementById('harvest-live-box');
        if (liveBox) liveBox.classList.remove('hidden');

        const activePhone = document.getElementById('harvest-active-phone');
        if (activePhone) activePhone.innerText = data.currentPhone || '01XXXXXXXXX';

        const pctText = document.getElementById('harvest-pct-text');
        if (pctText) pctText.innerText = `${data.percent || 0}%`;

        const fracText = document.getElementById('harvest-fraction-text');
        if (fracText) fracText.innerText = `${data.processedCount || 0} / ${data.targetCount || 100}`;

        const fillBar = document.getElementById('harvest-fill-bar');
        if (fillBar) fillBar.style.width = `${data.percent || 0}%`;

        const countChecked = document.getElementById('harvest-count-checked');
        if (countChecked) countChecked.innerText = data.processedCount || 0;

        const countRem = document.getElementById('harvest-count-remaining');
        if (countRem) countRem.innerText = Math.max(0, (data.targetCount || 100) - (data.processedCount || 0));
    });

    socket.on('harvest_hit', (data) => {
        const countValid = document.getElementById('harvest-count-valid');
        if (countValid) countValid.innerText = parseInt(countValid.innerText || 0) + 1;

        if (parseInt(data.rate) < 50) {
            const countFraud = document.getElementById('harvest-count-fraud');
            if (countFraud) countFraud.innerText = parseInt(countFraud.innerText || 0) + 1;
        }

        // Live refresh user history if view-report is active
        const reportView = document.getElementById('view-report');
        if (reportView && !reportView.classList.contains('hidden')) {
            loadUserHistory();
        }
    });

    socket.on('harvest_completed', (data) => {
        isHarvestingRunning = false;
        const btn = document.getElementById('harvest-action-btn');
        if (btn) {
            btn.className = 'w-full py-2.5 bg-purple-700 hover:bg-purple-800 active:scale-[0.98] text-white rounded-xl font-bold text-xs shadow-xs transition flex items-center justify-center gap-2';
            btn.innerHTML = `<i class="fa-solid fa-play text-[10px]"></i> <span>Start scraping</span>`;
        }
        const badge = document.getElementById('harvest-badge-status');
        if (badge) {
            badge.className = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200';
            badge.innerHTML = `<i class="fa-solid fa-check text-[9px]"></i> <span>Scraping completed</span>`;
        }
    });
}

// ==========================================
// USER HISTORY (REPORT TAB WITH COURIER SVG)
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
            const ratePillClass = isHighRisk 
                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                : (r.risk_level === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200');

            const dateStr = new Date(r.created_at).toLocaleDateString('bn-BD', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

            // Build Courier SVG Badges
            let courierHtml = '<span class="text-slate-300 font-mono">—</span>';
            try {
                const breakdown = typeof r.courier_breakdown === 'string' ? JSON.parse(r.courier_breakdown) : r.courier_breakdown;
                if (Array.isArray(breakdown)) {
                    const activeCouriers = breakdown.filter(c => c.orders > 0);
                    if (activeCouriers.length > 0) {
                        courierHtml = `<div class="flex items-center gap-1.5 flex-wrap">` + activeCouriers.map(c => {
                            const logo = COURIER_META[c.courier]?.logo || '/assets/courier-logo/steadfast.svg';
                            return `<div class="inline-flex items-center gap-1 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-lg shadow-2xs">
                                <img src="${logo}" class="h-3.5 w-auto object-contain" alt="${c.courier}" onerror="this.style.display='none'">
                                <span class="font-bold text-[10px] text-slate-800">${c.courier}</span>
                                <span class="bg-purple-100 text-purple-700 font-bold text-[9px] px-1 rounded-sm">${c.orders}</span>
                            </div>`;
                        }).join('') + `</div>`;
                    }
                }
            } catch (e) {}

            const waCell = r.has_whatsapp 
                ? `<i class="fa-brands fa-whatsapp text-emerald-500 text-sm"></i>` 
                : `<span class="text-slate-300 font-mono">—</span>`;

            return `
                <tr>
                    <td class="py-3 px-4 font-mono font-bold text-slate-900">${r.phone}</td>
                    <td class="py-3 px-4">${courierHtml}</td>
                    <td class="py-3 px-4 text-center font-['Outfit'] font-bold text-slate-700">${r.total_orders || 0}</td>
                    <td class="py-3 px-4 text-center font-['Outfit'] text-emerald-600 font-semibold">${r.total_delivery || 0}</td>
                    <td class="py-3 px-4 text-center font-['Outfit'] text-rose-500 font-semibold">${r.total_cancel || 0}</td>
                    <td class="py-3 px-4 text-center">
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${ratePillClass}">
                            ${r.success_rate}%
                        </span>
                    </td>
                    <td class="py-3 px-4 text-center">${waCell}</td>
                    <td class="py-3 px-4 text-right text-slate-400 font-['Outfit'] text-[11px]">${dateStr}</td>
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

    // Language init from storage
    const savedLang = localStorage.getItem('app_lang') || 'bn';
    changeLanguage(savedLang);
});
