/**
 * ============================================================================
 * IronFit Gym — Client Controller & Backend API Connector
 * Seamlessly interfaces with persistent SQLite backend at /api/*
 * ============================================================================
 */

const GymApp = (function() {

  let selectedPlan = 'Quarterly';
  let selectedFee = 3000;

  function setPlan(planName, fee) {
    selectedPlan = planName;
    selectedFee = fee;

    document.querySelectorAll('.plan-card').forEach(card => {
      if (card.getAttribute('data-plan') === planName) {
        card.classList.add('selected');
      } else {
        card.classList.remove('selected');
      }
    });

    const planSelect = document.getElementById('reg-plan');
    const feeDisplay = document.getElementById('reg-fee-display');
    if (planSelect) planSelect.value = planName;
    if (feeDisplay) feeDisplay.innerText = '₹' + fee.toLocaleString('en-IN');

    const formSection = document.getElementById('join');
    if (formSection) {
      formSection.scrollIntoView({ behavior: 'smooth' });
    }
  }

  // 1. Live Member Registration (POST /api/members/register)
  async function handleRegistration(e) {
    e.preventDefault();

    const name = document.getElementById('reg-name').value.trim();
    const phone = document.getElementById('reg-phone').value.trim();
    const plan = document.getElementById('reg-plan').value;
    const startDate = document.getElementById('reg-start-date').value;

    const planFees = { 'Monthly': 1200, 'Quarterly': 3000, 'Half-yearly': 5500, 'Yearly': 10000 };
    const fee = planFees[plan] || 1200;

    if (!name || !phone) {
      showToast('Please enter your full name and phone number', 'warn');
      return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.innerText : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerText = 'PROCESSING REGISTRATION...';
    }

    try {
      const response = await fetch('/api/members/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, plan, fee, startDate })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Registration failed');
      }

      const m = result.member;

      // Update and display Confirmation Modal
      const overlay = document.getElementById('success-overlay');
      const idEl = document.getElementById('modal-member-id');
      const nameEl = document.getElementById('modal-member-name');
      const planEl = document.getElementById('modal-member-plan');
      const expiryEl = document.getElementById('modal-member-expiry');
      const feeEl = document.getElementById('modal-member-fee');

      if (idEl) idEl.innerText = m.member_id;
      if (nameEl) nameEl.innerText = m.name;
      if (planEl) planEl.innerText = m.plan;
      if (expiryEl) expiryEl.innerText = m.expiry_date;
      if (feeEl) feeEl.innerText = '₹' + Number(m.fee).toLocaleString('en-IN');

      if (overlay) overlay.classList.add('show');

      // Add automated welcome notification in WhatsApp Assistant
      addBotMessage(`Namaste *${m.name}*! Welcome to IronFit Gym. Your membership record is saved in our database. Member ID: *${m.member_id}*. Valid until *${m.expiry_date}*. See you at the squat rack! 💪`);

      showToast(`Welcome ${m.name}! Registration confirmed.`, 'success');

      // Pre-fill search input in member portal
      const portalInput = document.getElementById('portal-search-input');
      if (portalInput) portalInput.value = m.member_id;

    } catch (err) {
      showToast('Error: ' + err.message, 'warn');
      console.error('Registration Error:', err);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
      }
    }
  }

  // 2. Member Portal Lookup (GET /api/members/:query)
  async function searchMembership() {
    const input = document.getElementById('portal-search-input');
    const query = input ? input.value.trim() : '';
    const resultBox = document.getElementById('portal-result');

    if (!query) {
      showToast('Please enter your phone number or Member ID', 'warn');
      return;
    }

    if (resultBox) {
      resultBox.innerHTML = `
        <div class="p-8 text-center text-xs text-neutral-400 font-mono">
          <div class="spinner mb-2"></div>
          <div>Querying SQLite Database...</div>
        </div>
      `;
    }

    try {
      const response = await fetch('/api/members/' + encodeURIComponent(query));
      const data = await response.json();

      if (!response.ok || !data.success) {
        resultBox.innerHTML = `
          <div class="p-6 text-center rounded bg-[#181818] border border-red-900/40">
            <div class="text-2xl mb-2">🔍</div>
            <div class="text-sm font-bold text-white mb-1">No Membership Record Found</div>
            <div class="text-xs text-neutral-400">We couldn't find a record for "${query}". Check your number or register above.</div>
          </div>
        `;
        return;
      }

      const m = data.member;
      const isExpired = m.isExpired;
      const isPaid = m.payment_status === 'Paid';

      resultBox.innerHTML = `
        <div class="p-6 rounded bg-[#181818] border border-neutral-800 space-y-4">
          <div class="flex items-start justify-between pb-4 border-b border-neutral-800">
            <div>
              <div class="text-xs uppercase font-mono text-red-500 font-bold tracking-wider">${m.member_id}</div>
              <div class="text-xl font-black text-white font-['Barlow_Condensed'] uppercase tracking-wide">${m.name}</div>
              <div class="text-xs text-neutral-400 font-mono">${m.phone}</div>
            </div>
            <span class="px-3 py-1 text-xs font-bold uppercase rounded ${isPaid && !isExpired ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800' : 'bg-red-950/80 text-red-400 border border-red-800'}">
              ${isPaid && !isExpired ? 'ACTIVE MEMBER' : (isExpired ? 'EXPIRED' : 'PAYMENT DUE')}
            </span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div class="p-3 bg-[#111] rounded border border-neutral-800">
              <span class="text-neutral-500 block text-[10px]">CURRENT PLAN</span>
              <span class="text-white font-bold">${m.plan}</span>
            </div>
            <div class="p-3 bg-[#111] rounded border border-neutral-800">
              <span class="text-neutral-500 block text-[10px]">VALID UNTIL</span>
              <span class="${isExpired ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}">${m.expiry_date}</span>
            </div>
            <div class="p-3 bg-[#111] rounded border border-neutral-800">
              <span class="text-neutral-500 block text-[10px]">PAYMENT STATUS</span>
              <span class="${isPaid ? 'text-emerald-400' : 'text-amber-400'} font-bold">${m.payment_status}</span>
            </div>
            <div class="p-3 bg-[#111] rounded border border-neutral-800">
              <span class="text-neutral-500 block text-[10px]">DAYS REMAINING</span>
              <span class="${m.daysLeft <= 3 ? 'text-amber-400 font-bold' : 'text-neutral-200'}">${m.daysLeft >= 0 ? m.daysLeft + ' Days' : 'Overdue'}</span>
            </div>
          </div>

          <div class="pt-2 flex flex-wrap gap-3 items-center justify-between">
            <div class="text-xs text-neutral-400">
              ${isPaid && !isExpired ? '✅ Database verified. Your gym floor access is fully active.' : '⚠️ Membership expired or payment pending. Renew below for instant extension.'}
            </div>
            <button onclick="GymApp.renewMember('${m.member_id}', ${m.fee})" class="btn btn-red btn-sm">
              ${isPaid && !isExpired ? 'Extend Ahead (+1 Cycle)' : 'Renew Online (₹' + Number(m.fee).toLocaleString('en-IN') + ')'}
            </button>
          </div>
        </div>
      `;

    } catch (err) {
      resultBox.innerHTML = `<div class="p-4 text-center text-xs text-red-400 font-mono">Error connecting to database: ${err.message}</div>`;
    }
  }

  // 3. Online Renewal & Payment (POST /api/members/renew)
  async function renewMember(memberId, fee) {
    try {
      const response = await fetch('/api/members/renew', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId,
          paymentRef: 'upi_' + Date.now(),
          method: 'UPI_Instant'
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Renewal failed');
      }

      showToast(`Renewal payment captured! Valid until: ${data.member.expiry_date}`, 'success');
      searchMembership(); // Refresh member card view

    } catch (err) {
      showToast('Error: ' + err.message, 'warn');
    }
  }

  // 4. AI Gym Assistant Conversational Bot (POST /api/chat)
  async function sendUserQuery() {
    const input = document.getElementById('bot-query-input');
    const q = input ? input.value.trim() : '';
    if (!q) return;

    addBotMessage(q, true);
    input.value = '';

    // Show realistic "typing..." indicator bubble
    showTypingIndicator();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      });

      const data = await response.json();
      const replyText = (data && data.reply) 
        ? data.reply 
        : "I'm here to help with training programs, pricing, or timings. Feel free to ask!";

      // Realistic human typing delay based on message length (between 1.1s and 2.4s)
      const typingDelay = Math.min(Math.max(replyText.length * 15, 1200), 2500);

      setTimeout(() => {
        removeTypingIndicator();
        addBotMessage(replyText);
      }, typingDelay);

    } catch (err) {
      setTimeout(() => {
        removeTypingIndicator();
        addBotMessage("IronFit Gym is open Mon-Sat 5:30 AM to 10:30 PM. For instant assistance, call our front desk at +91 98765 43210.");
      }, 1500);
    }
  }

  function showTypingIndicator() {
    removeTypingIndicator(); // Ensure no duplicates
    const container = document.getElementById('bot-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.id = 'bot-typing-bubble';
    div.className = 'wa-bubble-bot';
    div.innerHTML = `
      <div class="text-[10px] text-red-400 font-bold mb-0.5">IronFit Assistant</div>
      <div class="bot-typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function removeTypingIndicator() {
    const bubble = document.getElementById('bot-typing-bubble');
    if (bubble) bubble.remove();
  }

  function addBotMessage(text, isUser = false) {
    const container = document.getElementById('bot-messages');
    if (!container) return;

    const div = document.createElement('div');
    div.className = isUser ? 'wa-bubble-user' : 'wa-bubble-bot';
    div.innerHTML = `
      <div class="text-[10px] ${isUser ? 'text-neutral-400' : 'text-red-400'} font-bold mb-0.5">${isUser ? 'You' : 'IronFit Assistant'}</div>
      <div class="leading-relaxed text-xs text-white">${text.replace(/\*(.*?)\*/g, '<strong>$1</strong>')}</div>
      <div class="text-[9px] text-neutral-400 text-right mt-1">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;

    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function toggleBotWidget() {
    const widget = document.getElementById('bot-widget');
    if (widget) {
      widget.classList.toggle('hidden');
    }
  }

  function toggleStaffModal() {
    const modal = document.getElementById('staff-modal');
    if (modal) {
      modal.classList.toggle('hidden');
      if (!modal.classList.contains('hidden')) {
        renderStaffData();
      }
    }
  }

  // 5. Staff Console: Real-time Member Table & Stats
  async function renderStaffData() {
    const tbody = document.getElementById('staff-sheet-tbody');
    const digestEl = document.getElementById('staff-digest-preview');

    try {
      // Fetch stats
      const statsRes = await fetch('/api/stats');
      const stats = await statsRes.json();

      if (digestEl && stats.success) {
        digestEl.innerHTML = `
          <div class="grid grid-cols-4 gap-2 text-center text-xs font-mono">
            <div class="p-2 bg-neutral-900 rounded border border-neutral-800"><span class="text-white font-bold">${stats.total}</span> Total</div>
            <div class="p-2 bg-neutral-900 rounded border border-neutral-800"><span class="text-emerald-400 font-bold">${stats.active}</span> Active</div>
            <div class="p-2 bg-neutral-900 rounded border border-neutral-800"><span class="text-red-400 font-bold">${stats.expired}</span> Expired</div>
            <div class="p-2 bg-neutral-900 rounded border border-neutral-800"><span class="text-amber-400 font-bold">${stats.pending}</span> Dues</div>
          </div>
        `;
      }

      // Fetch members
      const membersRes = await fetch('/api/members');
      const data = await membersRes.json();

      if (tbody && data.success) {
        let html = '';
        data.members.forEach(m => {
          const isExpired = m.expiry_date && m.expiry_date < (stats.today || '');
          html += `
            <tr class="border-b border-neutral-800 text-xs font-mono">
              <td class="p-2 text-red-400 font-bold">${m.member_id}</td>
              <td class="p-2 text-white font-sans font-semibold">${m.name}</td>
              <td class="p-2 text-neutral-300">${m.phone}</td>
              <td class="p-2 text-neutral-400">${m.plan}</td>
              <td class="p-2 text-emerald-400 font-semibold">₹${m.fee}</td>
              <td class="p-2 ${isExpired ? 'text-red-400' : 'text-neutral-300'}">${m.expiry_date}</td>
              <td class="p-2">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${m.payment_status === 'Paid' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-400 border border-amber-800'}">
                  ${m.payment_status}
                </span>
              </td>
              <td class="p-2 text-neutral-500">${m.last_reminder_date || '-'}</td>
            </tr>
          `;
        });
        tbody.innerHTML = html;
      }

    } catch (err) {
      console.error('Error fetching staff data:', err);
    }
  }

  // 6. Trigger 9 AM Expiry Reminders on Database (POST /api/cron/reminders)
  async function triggerExpiryScan() {
    try {
      const response = await fetch('/api/cron/reminders', { method: 'POST' });
      const data = await response.json();
      if (data.success) {
        showToast(`Dispatched ${data.dispatchedCount} WhatsApp expiry reminder(s)!`, 'success');
        renderStaffData();
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'warn');
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="text-red-500 font-bold">⚡</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  function init() {
    // Auto-fill today's date in start-date input
    const startDateInput = document.getElementById('reg-start-date');
    if (startDateInput) {
      startDateInput.value = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    }

    // Bind registration form
    const regForm = document.getElementById('form-gym-register');
    if (regForm) {
      regForm.addEventListener('submit', handleRegistration);
    }

    // Plan selection cards
    document.querySelectorAll('.plan-card').forEach(card => {
      card.addEventListener('click', function() {
        const plan = this.getAttribute('data-plan');
        const fee = Number(this.getAttribute('data-fee'));
        setPlan(plan, fee);
      });
    });

    // Close success modal
    const closeSuccessBtn = document.getElementById('btn-close-modal');
    const overlay = document.getElementById('success-overlay');
    if (closeSuccessBtn && overlay) {
      closeSuccessBtn.addEventListener('click', () => {
        overlay.classList.remove('show');
      });
    }

    // AI bot query on Enter
    const botInput = document.getElementById('bot-query-input');
    const botSubmitBtn = document.getElementById('btn-send-bot-query');
    if (botSubmitBtn) botSubmitBtn.addEventListener('click', sendUserQuery);
    if (botInput) {
      botInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendUserQuery();
      });
    }

    // Member portal search on Enter
    const portalSearch = document.getElementById('portal-search-input');
    if (portalSearch) {
      portalSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') searchMembership();
      });
    }

    // Initial greeting in Bot
    setTimeout(() => {
      addBotMessage("Namaste! Welcome to **GymDesk**. Ask me anything about our training programs, membership pricing, or operating hours!");
    }, 800);
  }

  return {
    init,
    setPlan,
    searchMembership,
    renewMember,
    toggleBotWidget,
    toggleStaffModal,
    triggerExpiryScan,
    sendUserQuery,
    renderStaffData,
    addBotMessage,
    showToast
  };
})();

window.GymApp = GymApp;
