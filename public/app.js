// Store Guard AI - Client Logic

function copyPhone() {
    const phone = document.getElementById('display-phone').innerText.trim();
    if (phone) {
        navigator.clipboard.writeText(phone).then(() => {
            const btn = document.querySelector('button[title="কপি করুন"]');
            if (btn) {
                const original = btn.innerHTML;
                btn.innerHTML = `<i class="fa-solid fa-check text-emerald-600"></i>`;
                setTimeout(() => btn.innerHTML = original, 1500);
            }
        });
    }
}

function setAndCheck(num) {
    document.getElementById('phone-input').value = num;
    performCheck(num);
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
    const originalBtnText = btn.innerHTML;
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

        renderReport(res.data);
    } catch (err) {
        console.error('Check Error:', err);
        alert('সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি।');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalBtnText;
    }
}

function renderReport(data) {
    // 1. Phone Display
    document.getElementById('display-phone').innerText = data.phone;

    // 2. Rating & Gauge
    const rate = data.successRateNumber || 0;
    document.getElementById('gauge-percent').innerText = `${rate}%`;

    const gaugeCircle = document.getElementById('gauge-progress');
    const maxOffset = 415;
    const offset = maxOffset - (maxOffset * rate / 100);
    gaugeCircle.style.strokeDashoffset = offset;

    // Color coordination based on risk
    let gaugeColor = '#10b981'; // Emerald
    let riskBoxClass = 'border-emerald-200 bg-emerald-50/60';
    let riskIconBg = 'bg-emerald-600 text-white';
    let riskIcon = 'fa-solid fa-user-check';
    let riskTitleClass = 'text-emerald-900';
    let riskDescClass = 'text-emerald-800/80';

    if (data.totalOrders === 0) {
        gaugeColor = '#94a3b8'; // Slate
        riskBoxClass = 'border-slate-200 bg-slate-50';
        riskIconBg = 'bg-slate-400 text-white';
        riskIcon = 'fa-solid fa-circle-question';
        riskTitleClass = 'text-slate-800';
        riskDescClass = 'text-slate-600';
    } else if (rate < 50) {
        gaugeColor = '#e11d48'; // Rose
        riskBoxClass = 'border-rose-200 bg-rose-50/60';
        riskIconBg = 'bg-rose-600 text-white';
        riskIcon = 'fa-solid fa-triangle-exclamation';
        riskTitleClass = 'text-rose-900';
        riskDescClass = 'text-rose-800/80';
    } else if (rate < 80) {
        gaugeColor = '#d97706'; // Amber
        riskBoxClass = 'border-amber-200 bg-amber-50/60';
        riskIconBg = 'bg-amber-500 text-white';
        riskIcon = 'fa-solid fa-shield-halved';
        riskTitleClass = 'text-amber-900';
        riskDescClass = 'text-amber-800/80';
    }

    gaugeCircle.setAttribute('stroke', gaugeColor);

    // 3. Risk Box
    const riskBox = document.getElementById('risk-box');
    riskBox.className = `mt-6 p-4 rounded-2xl border transition-all duration-300 ${riskBoxClass}`;
    
    document.getElementById('risk-icon-wrapper').className = `w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${riskIconBg}`;
    document.getElementById('risk-icon').className = `${riskIcon} text-base`;
    
    const titleEl = document.getElementById('risk-title');
    titleEl.className = `font-bold text-sm ${riskTitleClass}`;
    titleEl.innerText = data.riskTitleBn;

    const descEl = document.getElementById('risk-desc');
    descEl.className = `text-xs mt-1 leading-relaxed ${riskDescClass}`;
    descEl.innerText = data.riskDescBn;

    // 4. Metric Cards
    document.getElementById('stat-total-orders').innerText = data.totalOrders;
    document.getElementById('stat-delivered').innerText = data.totalDelivery;
    document.getElementById('stat-cancelled').innerText = data.totalCancel;
    
    const pathaoBadge = document.getElementById('stat-pathao-badge');
    pathaoBadge.innerText = data.pathaoScore || '—';
    if (data.totalOrders === 0) {
        pathaoBadge.className = 'inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-600';
    } else if (rate < 50) {
        pathaoBadge.className = 'inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-rose-100 text-rose-800';
    } else {
        pathaoBadge.className = 'inline-block px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800';
    }

    // 5. Courier Breakdown Table
    const tbody = document.getElementById('courier-rows');
    if (Array.isArray(data.courierBreakdown) && data.courierBreakdown.length > 0) {
        tbody.innerHTML = data.courierBreakdown.map(c => {
            const hasData = c.orders > 0;
            const badgeClass = hasData 
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                : 'bg-slate-100 text-slate-500';
            const nameClass = hasData ? 'font-bold text-slate-900' : 'text-slate-500';
            const numClass = hasData ? 'text-slate-900 font-semibold' : 'text-slate-400';
            const delivClass = hasData ? 'text-emerald-600 font-semibold' : 'text-slate-400';
            const cancelClass = hasData ? 'text-rose-500 font-semibold' : 'text-slate-400';
            const rateClass = hasData ? 'text-slate-900 font-bold' : 'text-slate-400';

            return `
                <tr>
                    <td class="py-3 px-4 ${nameClass}">${c.courier}</td>
                    <td class="py-3 px-4 text-center">
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}">
                            ${c.status || (hasData ? 'ভেরিফায়েড' : 'ডাটা নেই')}
                        </span>
                    </td>
                    <td class="py-3 px-4 text-center font-['Outfit'] ${numClass}">${c.orders}</td>
                    <td class="py-3 px-4 text-center font-['Outfit'] ${delivClass}">${c.delivery}</td>
                    <td class="py-3 px-4 text-center font-['Outfit'] ${cancelClass}">${c.cancel}</td>
                    <td class="py-3 px-4 text-right font-['Outfit'] ${rateClass}">${c.rate}</td>
                </tr>
            `;
        }).join('');
    }
}

// Enter key trigger for search
document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('phone-input');
    if (input) {
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') performCheck();
        });
    }
});
