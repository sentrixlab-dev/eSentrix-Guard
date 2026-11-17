// Ecom Centrix Cart - Fraud Checker Client Engine

const COURIER_META = {
    'Steadfast': { logo: '/assets/courier-logo/steadfast.svg', defaultStatus: 'Verified', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    'Pathao': { logo: '/assets/courier-logo/pathao.svg', defaultStatus: 'Verified', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    'RedX': { logo: '/assets/courier-logo/redx.svg', defaultStatus: 'Active', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
    'CarryBee': { logo: '/assets/courier-logo/carrybee.svg', defaultStatus: 'No Data', badgeClass: 'bg-slate-100 text-slate-500 border-slate-200' },
    'Paperfly': { logo: '/assets/courier-logo/paperfly.svg', defaultStatus: 'No Data', badgeClass: 'bg-slate-100 text-slate-500 border-slate-200' },
    'ParcelDex': { logo: '/assets/courier-logo/parceldex.svg', defaultStatus: 'No Data', badgeClass: 'bg-slate-100 text-slate-500 border-slate-200' }
};

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
    // 1. Phone Display
    document.getElementById('display-phone').innerText = data.phone;

    // 2. Trust Score & Gauge
    const rate = data.successRateNumber || 0;
    document.getElementById('gauge-percent').innerText = `${rate}%`;

    const gaugeCircle = document.getElementById('gauge-circle');
    const maxOffset = 402;
    const offset = maxOffset - (maxOffset * rate / 100);
    gaugeCircle.style.strokeDashoffset = offset;

    // Gradient definitions update
    const gradient = document.getElementById('trustGradient');
    let riskBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    let riskBadgeIcon = 'fa-regular fa-circle-check';
    let riskBadgeText = 'নিম্ন ঝুঁকি (Low Risk)';
    let riskDesc = 'এই নম্বরধারীর কুরিয়ার ডেলিভারি রেকর্ড ভালো এবং ফ্রডের সম্ভাবনা কম।';

    if (data.totalOrders === 0) {
        if (gradient) {
            gradient.innerHTML = `<stop offset="0%" stop-color="#94a3b8" /><stop offset="100%" stop-color="#64748b" />`;
        }
        riskBadgeClass = 'bg-slate-100 text-slate-700 border-slate-200';
        riskBadgeIcon = 'fa-regular fa-circle-question';
        riskBadgeText = 'নতুন কাস্টমার (No Record)';
        riskDesc = 'পূর্বে কোনো কুরিয়ার ডেলিভারি হিস্ট্রি পাওয়া যায়নি। ফোনে কথা বলে কনফার্ম করুন।';
    } else if (rate < 50) {
        if (gradient) {
            gradient.innerHTML = `<stop offset="0%" stop-color="#fb7185" /><stop offset="100%" stop-color="#e11d48" />`;
        }
        riskBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
        riskBadgeIcon = 'fa-solid fa-triangle-exclamation';
        riskBadgeText = `উচ্চ ঝুঁকি (High Risk - ${rate}%)`;
        riskDesc = 'কাস্টমারের পার্সেল রিটার্নের হার অস্বাভাবিক বেশি। অগ্রিম ডেলিভারি চার্জ ছাড়া অর্ডার পাঠানো ঝুঁকিপূর্ণ।';
    } else if (rate < 80) {
        if (gradient) {
            gradient.innerHTML = `<stop offset="0%" stop-color="#fbbf24" /><stop offset="100%" stop-color="#d97706" />`;
        }
        riskBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
        riskBadgeIcon = 'fa-solid fa-shield-halved';
        riskBadgeText = `মাঝারি ঝুঁকি (Medium Risk - ${rate}%)`;
        riskDesc = 'কাস্টমারের কিছু রিটার্ন রেকর্ড রয়েছে। অর্ডার কনফার্ম করার পূর্বে ফোনে নিশ্চিত হয়ে নিন।';
    } else {
        if (gradient) {
            gradient.innerHTML = `<stop offset="0%" stop-color="#84cc16" /><stop offset="100%" stop-color="#10b981" />`;
        }
        riskBadgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        riskBadgeIcon = 'fa-regular fa-circle-check';
        riskBadgeText = `নিম্ন ঝুঁকি (Low Risk - ${rate}%)`;
        riskDesc = 'এই নম্বরধারীর কুরিয়ার ডেলিভারি রেকর্ড ভালো এবং ফ্রডের সম্ভাবনা কম।';
    }

    const badgeEl = document.getElementById('risk-badge');
    badgeEl.className = `inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${riskBadgeClass}`;
    badgeEl.innerHTML = `<i class="${riskBadgeIcon}"></i> <span>${riskBadgeText}</span>`;
    document.getElementById('risk-desc-text').innerText = riskDesc;

    // 3. Metric Summary Cards
    document.getElementById('stat-total-orders').innerText = data.totalOrders;
    document.getElementById('stat-delivered').innerText = data.totalDelivery;
    document.getElementById('stat-cancelled').innerText = data.totalCancel;
    document.getElementById('stat-rate').innerText = `${rate.toFixed(2)}%`;

    // 4. Courier Breakdown Table
    const tbody = document.getElementById('courier-table-body');
    if (Array.isArray(data.courierBreakdown) && data.courierBreakdown.length > 0) {
        tbody.innerHTML = data.courierBreakdown.map(c => {
            const hasData = c.orders > 0;
            const meta = COURIER_META[c.courier] || {
                logo: '/assets/courier-logo/steadfast.svg',
                defaultStatus: hasData ? 'Verified' : 'No Data',
                badgeClass: hasData ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500'
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

// Enter Key triggers search
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('phone-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performCheck();
        });
    }
});
