/**
 * n8n Gym Manager Automation — Sandbox Studio Controller
 * Controls the 3-Pane Split Screen Simulation:
 * Pane 1: Workflow Control Console
 * Pane 2: Virtual Google Sheet (12 Columns & Dashboard Formulas)
 * Pane 3: Virtual WhatsApp Smartphone Simulator
 */

const Sandbox = (function() {

  function renderSheet(state) {
    const tbody = document.getElementById('sheet-tbody');
    const totalCountEl = document.getElementById('kpi-total');
    const activeCountEl = document.getElementById('kpi-active');
    const expiredCountEl = document.getElementById('kpi-expired');
    const pendingCountEl = document.getElementById('kpi-pending');

    if (!tbody) return;

    const today = Store.getTodayIST();
    let activeCount = 0;
    let expiredCount = 0;
    let pendingCount = 0;

    let rowsHtml = '';
    state.members.forEach((m, idx) => {
      const isExpired = m.expiry_date && m.expiry_date < today;
      const isActive = m.expiry_date && m.expiry_date >= today;
      const isPending = m.payment_status === 'Pending';

      if (isActive) activeCount++;
      if (isExpired) expiredCount++;
      if (isPending) pendingCount++;

      let badgeClass = 'pill-pending';
      if (m.payment_status === 'Paid') badgeClass = 'pill-paid';
      else if (isExpired) badgeClass = 'pill-expired';

      const isLastAction = m.member_id === state.lastActionRowId;
      const animClass = isLastAction ? 'sheet-row-new' : '';

      rowsHtml += `
        <tr class="${animClass}" data-id="${m.member_id}">
          <td class="font-mono text-emerald-400 font-medium">${m.member_id}</td>
          <td class="font-semibold text-slate-100">${m.name}</td>
          <td class="font-mono text-slate-300">${m.phone}</td>
          <td><span class="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">${m.plan}</span></td>
          <td class="text-center font-mono">${m.plan_months}</td>
          <td class="font-mono text-emerald-300 font-semibold">₹${m.fee}</td>
          <td class="font-mono text-slate-400">${m.start_date}</td>
          <td class="font-mono ${isExpired ? 'text-red-400 font-bold' : 'text-slate-200'}">${m.expiry_date}</td>
          <td><span class="${badgeClass}">${m.payment_status}</span></td>
          <td class="font-mono text-slate-400">${m.last_payment_date || '-'}</td>
          <td class="font-mono ${m.last_reminder_date ? 'text-sky-300' : 'text-slate-500'}">${m.last_reminder_date || '-'}</td>
          <td class="font-mono text-xs text-slate-500">${m.last_payment_ref || '-'}</td>
        </tr>
      `;
    });

    tbody.innerHTML = rowsHtml;

    // Update Ribbon KPIs
    if (totalCountEl) totalCountEl.innerText = state.members.length;
    if (activeCountEl) activeCountEl.innerText = activeCount;
    if (expiredCountEl) expiredCountEl.innerText = expiredCount;
    if (pendingCountEl) pendingCountEl.innerText = pendingCount;

    // Update Dashboard Tab formulas if currently visible
    updateDashboardFormulas(state.members.length, activeCount, expiredCount, pendingCount);
  }

  function updateDashboardFormulas(total, active, expired, pending) {
    const dTotal = document.getElementById('dash-formula-total');
    const dActive = document.getElementById('dash-formula-active');
    const dExpired = document.getElementById('dash-formula-expired');
    const dPending = document.getElementById('dash-formula-pending');

    if (dTotal) dTotal.innerText = total;
    if (dActive) dActive.innerText = active;
    if (dExpired) dExpired.innerText = expired;
    if (dPending) dPending.innerText = pending;
  }

  function renderTerminal(logs) {
    const terminalEl = document.getElementById('terminal-logs');
    if (!terminalEl) return;

    let html = '';
    logs.forEach(log => {
      let colorClass = 'terminal-info';
      if (log.type === 'success') colorClass = 'terminal-success';
      if (log.type === 'warn') colorClass = 'terminal-warn';

      html += `<div class="terminal-line"><span class="terminal-time">[${log.time}]</span><span class="${colorClass}">${log.text}</span></div>`;
    });

    terminalEl.innerHTML = html;
  }

  function renderWhatsApp(messages) {
    const viewport = document.getElementById('wa-messages-viewport');
    if (!viewport) return;

    let html = '';
    messages.forEach(msg => {
      if (msg.type === 'system') {
        html += `<div class="wa-system-pill">${msg.text}</div>`;
      } else {
        html += `
          <div class="wa-bubble">
            <div class="text-[11px] text-emerald-200 font-semibold mb-1 flex items-center gap-1">
              <span>To: ${msg.recipient}</span>
              <span class="text-slate-400 font-mono text-[10px]">(${msg.phone})</span>
            </div>
            <div class="leading-relaxed">${msg.text.replace(/\*(.*?)\*/g, '<strong class="nm">$1</strong>')}</div>
            <div class="wa-meta">
              <span>${msg.time}</span>
              <svg class="w-3.5 h-3.5 text-sky-400 inline" fill="currentColor" viewBox="0 0 16 16">
                <path d="M12.354 4.354a.5.5 0 0 0-.708-.708L5 10.293 1.854 7.146a.5.5 0 1 0-.708.708l3.5 3.5a.5.5 0 0 0 .708 0l7-7zm-4.208 7-.896-.897.707-.707.543.543 6.646-6.647a.5.5 0 0 1 .708.708l-7 7a.5.5 0 0 1-.708 0z"/>
              </svg>
            </div>
            ${msg.hasQuickReply ? `
              <div class="wa-pay-btn" onclick="Sandbox.quickPayReply('${msg.phone}')">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                <span>Click to Pay / Renew Online</span>
              </div>
            ` : ''}
          </div>
        `;
      }
    });

    viewport.innerHTML = html;
    viewport.scrollTop = viewport.scrollHeight;
  }

  function quickPayReply(phone) {
    const state = Store.getState();
    const member = state.members.find(m => m.phone === phone);
    if (member) {
      Store.processPayment(member.member_id, member.fee, 'Razorpay Payment Link');
      showToast('Payment confirmed for ' + member.name + '! Status set to Paid.', 'success');
    }
  }

  function switchSheetTab(tab) {
    const tabMembersBtn = document.getElementById('tab-btn-members');
    const tabDashBtn = document.getElementById('tab-btn-dashboard');
    const membersView = document.getElementById('sheet-members-view');
    const dashView = document.getElementById('sheet-dashboard-view');

    if (tab === 'members') {
      if (tabMembersBtn) tabMembersBtn.className = 'sheet-tab active';
      if (tabDashBtn) tabDashBtn.className = 'sheet-tab';
      if (membersView) membersView.classList.remove('hidden');
      if (dashView) dashView.classList.add('hidden');
    } else {
      if (tabMembersBtn) tabMembersBtn.className = 'sheet-tab';
      if (tabDashBtn) tabDashBtn.className = 'sheet-tab active';
      if (membersView) membersView.classList.add('hidden');
      if (dashView) dashView.classList.remove('hidden');
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
      </svg>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function init() {
    Store.subscribe((state) => {
      renderSheet(state);
      renderTerminal(state.logs);
      renderWhatsApp(state.whatsappMessages);
    });

    // Initial render
    const initialState = Store.getState();
    renderSheet(initialState);
    renderTerminal(initialState.logs);
    renderWhatsApp(initialState.whatsappMessages);

    // Bind Workflow 1 Member Intake Form
    const memberForm = document.getElementById('form-member-intake');
    if (memberForm) {
      memberForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const name = document.getElementById('input-name').value;
        const phone = document.getElementById('input-phone').value;
        const plan = document.getElementById('input-plan').value;
        const fee = document.getElementById('input-fee').value;
        const startDate = document.getElementById('input-start-date').value;

        if (!name || !phone) {
          showToast('Please provide member name and phone number', 'warn');
          return;
        }

        const member = Store.registerMember({ name, phone, plan, fee, startDate });
        showToast(`Workflow 1: Registered ${member.name} (${member.member_id})`, 'success');

        // Reset inputs
        document.getElementById('input-name').value = '';
        document.getElementById('input-phone').value = '';
      });
    }

    // Auto-update fee placeholder on plan change
    const planSelect = document.getElementById('input-plan');
    const feeInput = document.getElementById('input-fee');
    if (planSelect && feeInput) {
      planSelect.addEventListener('change', function() {
        const fees = { 'Monthly': 1200, 'Quarterly': 3000, 'Half-yearly': 5500, 'Yearly': 10000 };
        feeInput.value = fees[this.value] || 1200;
      });
    }

    // Trigger Workflow 2: Expiry Reminders (9 AM Cron)
    const btnWorkflow2 = document.getElementById('btn-trigger-wf2');
    if (btnWorkflow2) {
      btnWorkflow2.addEventListener('click', function() {
        const sent = Store.runExpiryReminders();
        if (sent > 0) {
          showToast(`Workflow 2 Executed: Dispatched ${sent} WhatsApp reminder(s)!`, 'success');
        } else {
          showToast('Workflow 2 Executed: No members due for reminder today.', 'info');
        }
      });
    }

    // Fast-Forward helper: set GYM-001 or GYM-002 expiry to 3 days from now
    const btnSetExpiry3Days = document.getElementById('btn-test-set-expiry');
    if (btnSetExpiry3Days) {
      btnSetExpiry3Days.addEventListener('click', function() {
        Store.setTestExpiryIn3Days('GYM-001');
        showToast('Set Rohit Kumar (GYM-001) expiry to 3 days ahead. Now run 9 AM Reminder!', 'info');
      });
    }

    // Trigger Workflow 3: Payment Webhook Simulator
    const btnWorkflow3 = document.getElementById('btn-trigger-wf3');
    if (btnWorkflow3) {
      btnWorkflow3.addEventListener('click', function() {
        // Pick the first pending member or GYM-003
        const state = Store.getState();
        const pendingMember = state.members.find(m => m.payment_status === 'Pending') || state.members[0];
        if (pendingMember) {
          Store.processPayment(pendingMember.member_id, pendingMember.fee, 'Razorpay Webhook (payment_link.paid)');
          showToast(`Workflow 3: Payment captured for ${pendingMember.name}. Expiry extended!`, 'success');
        } else {
          showToast('All members are already marked Paid.', 'info');
        }
      });
    }

    // Trigger Workflow 4: Daily Owner Report (8 AM Cron)
    const btnWorkflow4 = document.getElementById('btn-trigger-wf4');
    if (btnWorkflow4) {
      btnWorkflow4.addEventListener('click', function() {
        const res = Store.generateDailyReport();
        showToast(`Workflow 4 Executed: Daily Owner Report sent! Active: ${res.activeCount}`, 'success');
      });
    }

    // Reset Button
    const btnReset = document.getElementById('btn-reset-sandbox');
    if (btnReset) {
      btnReset.addEventListener('click', function() {
        Store.reset();
        showToast('Sandbox reset to original test state.', 'info');
      });
    }

    // Tab buttons for sheet
    const tabMembersBtn = document.getElementById('tab-btn-members');
    const tabDashBtn = document.getElementById('tab-btn-dashboard');
    if (tabMembersBtn) tabMembersBtn.addEventListener('click', () => switchSheetTab('members'));
    if (tabDashBtn) tabDashBtn.addEventListener('click', () => switchSheetTab('dashboard'));
  }

  const api = {
    init,
    quickPayReply,
    switchSheetTab,
    showToast
  };

  window.Sandbox = api;
  return api;
})();


