/**
 * n8n Gym Manager Automation — Central State Store
 * Handles 12-Column Google Sheets Database, Event Dispatch, & Logs
 * Based on Sachin Prajapati's Guide
 */

const Store = (function() {
  // Safe month-end calculation from Chapter 4 of Sachin's guide
  function addMonths(isoDate, months) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const total = (m - 1) + months;
    const ny = y + Math.floor(total / 12);
    const nm = total % 12;
    const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
    const nd = Math.min(d, lastDay);
    return ny + '-' + String(nm + 1).padStart(2, '0') + '-' + String(nd).padStart(2, '0');
  }

  // Get current date in Asia/Kolkata YYYY-MM-DD
  function getTodayIST() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }

  // Initial Sample Members from Page 7 of the PDF
  const initialMembers = [
    {
      member_id: 'GYM-001',
      name: 'Rohit Kumar',
      phone: '919000000001',
      plan: 'Monthly',
      plan_months: 1,
      fee: 1200,
      start_date: '2026-11-01',
      expiry_date: '2026-12-01',
      payment_status: 'Paid',
      last_payment_date: '2026-11-01',
      last_reminder_date: '',
      last_payment_ref: 'pay_init_001'
    },
    {
      member_id: 'GYM-002',
      name: 'Neha Singh',
      phone: '919000000002',
      plan: 'Quarterly',
      plan_months: 3,
      fee: 3000,
      start_date: '2026-09-10',
      expiry_date: '2026-12-10',
      payment_status: 'Paid',
      last_payment_date: '2026-09-10',
      last_reminder_date: '',
      last_payment_ref: 'pay_init_002'
    },
    {
      member_id: 'GYM-003',
      name: 'Amit Verma',
      phone: '919000000003',
      plan: 'Monthly',
      plan_months: 1,
      fee: 1200,
      start_date: '2026-10-05',
      expiry_date: '2026-11-05',
      payment_status: 'Pending',
      last_payment_date: '',
      last_reminder_date: '',
      last_payment_ref: ''
    }
  ];

  let state = {
    members: JSON.parse(JSON.stringify(initialMembers)),
    logs: [
      { type: 'info', text: 'System initialized. n8n workflow engine connected.', time: '08:00:00' },
      { type: 'success', text: 'Google Sheet "Gym Manager" loaded (12 columns).', time: '08:00:01' }
    ],
    whatsappMessages: [
      {
        id: 'msg_welcome',
        type: 'system',
        text: 'Messages and reminders are encrypted and sent via official Meta WhatsApp Cloud API.'
      }
    ],
    activeTab: 'members', // 'members' or 'dashboard'
    lastActionRowId: null
  };

  const listeners = [];

  function subscribe(fn) {
    listeners.push(fn);
  }

  function notify() {
    listeners.forEach(fn => fn(state));
  }

  function addLog(type, text) {
    const time = new Date().toLocaleTimeString('en-IN', { hour12: false });
    state.logs.unshift({ type, text, time });
    if (state.logs.length > 50) state.logs.pop();
    notify();
  }

  function addWhatsAppMessage(msg) {
    state.whatsappMessages.push(msg);
    notify();
  }

  // Workflow 1: New Member Registration
  function registerMember(formData) {
    let cleanPhone = String(formData.phone).replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;

    const planMonthsMap = { 'Monthly': 1, 'Quarterly': 3, 'Half-yearly': 6, 'Yearly': 12 };
    const months = planMonthsMap[formData.plan] || 1;
    const startDate = formData.startDate || getTodayIST();
    const expiryDate = addMonths(startDate, months);

    // Deduplication check: if phone exists, update instead of append
    const existingIndex = state.members.findIndex(m => m.phone === cleanPhone);

    const newMember = {
      member_id: existingIndex >= 0 ? state.members[existingIndex].member_id : 'GYM-' + String(Date.now()).slice(-6),
      name: formData.name.trim(),
      phone: cleanPhone,
      plan: formData.plan,
      plan_months: months,
      fee: Number(formData.fee) || 1200,
      start_date: startDate,
      expiry_date: expiryDate,
      payment_status: 'Pending',
      last_payment_date: '',
      last_reminder_date: '',
      last_payment_ref: ''
    };

    if (existingIndex >= 0) {
      state.members[existingIndex] = newMember;
      state.lastActionRowId = newMember.member_id;
      addLog('warn', `Duplicate phone ${cleanPhone} matched: Updated row for ${newMember.name}`);
    } else {
      state.members.push(newMember);
      state.lastActionRowId = newMember.member_id;
      addLog('success', `[Workflow 1] New row created: ${newMember.member_id} | ${newMember.name} | Expiry: ${expiryDate}`);
    }

    notify();
    return newMember;
  }

  // Workflow 2: Expiry Reminder (Daily 9 AM Cron)
  function runExpiryReminders() {
    const today = getTodayIST();
    const REMIND_DAYS = [3, 0];

    function toUtc(iso) {
      const [y, m, d] = iso.split('-').map(Number);
      return Date.UTC(y, m - 1, d);
    }

    addLog('info', `[Workflow 2] 09:00 AM Cron triggered. Scanning ${state.members.length} members for expiry...`);

    let sentCount = 0;
    state.members.forEach(member => {
      if (!member.expiry_date || !member.phone) return;
      if (member.last_reminder_date === today) {
        addLog('info', `Skipped ${member.name}: already reminded today (${today})`);
        return;
      }

      const daysLeft = Math.round((toUtc(member.expiry_date) - toUtc(today)) / 86400000);

      if (REMIND_DAYS.includes(daysLeft)) {
        // Mark last_reminder_date
        member.last_reminder_date = today;
        state.lastActionRowId = member.member_id;
        sentCount++;

        // Meta WhatsApp Utility Template:
        // Namaste {{1}}, aapki gym membership {{2}} ko khatam ho rahi hai. Renew karne ke liye gym par aayein ya hamse sampark karein. Dhanyavaad!
        const msgText = `Namaste *${member.name}*, aapki gym membership *${member.expiry_date}* ko khatam ho rahi hai (${daysLeft === 0 ? 'Aaj aakhri din hai!' : '3 din baaki hain'}). Renew karne ke liye gym par aayein ya hamse sampark karein. Dhanyavaad!`;

        addWhatsAppMessage({
          id: 'remind_' + Date.now() + '_' + member.member_id,
          type: 'outgoing',
          recipient: member.name,
          phone: member.phone,
          text: msgText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          hasQuickReply: true
        });

        addLog('success', `WhatsApp Utility Template dispatched to ${member.name} (${member.phone}) [Days left: ${daysLeft}]`);
      }
    });

    if (sentCount === 0) {
      addLog('info', `[Workflow 2] No members expiring in 3 days or today. Zero WhatsApp messages needed.`);
    }

    notify();
    return sentCount;
  }

  // Workflow 3: Payment Update (Razorpay Webhook or Cash Form)
  function processPayment(memberId, amount, paymentMethod = 'Razorpay', linkId = null) {
    const today = getTodayIST();
    const member = state.members.find(m => m.member_id === memberId);

    if (!member) {
      addLog('warn', `Payment failed: Member ${memberId} not found.`);
      return false;
    }

    const refId = linkId || (paymentMethod === 'Razorpay' ? 'plink_' + Date.now() : 'manual-' + Date.now());

    // Idempotency check: if this payment ref was already processed, exit
    if (member.last_payment_ref && member.last_payment_ref === refId) {
      addLog('warn', `Idempotency match: Payment ref ${refId} already processed. No double renewal.`);
      return false;
    }

    const firstPayment = !member.last_payment_date;
    const base = member.expiry_date > today ? member.expiry_date : today;
    const newExpiry = firstPayment ? member.expiry_date : addMonths(base, Number(member.plan_months));

    member.payment_status = 'Paid';
    member.last_payment_date = today;
    member.expiry_date = newExpiry;
    member.last_payment_ref = refId;
    state.lastActionRowId = member.member_id;

    addLog('success', `[Workflow 3] Payment of ₹${amount} confirmed via ${paymentMethod} for ${member.name}. Expiry extended to ${newExpiry}.`);

    addWhatsAppMessage({
      id: 'pay_' + Date.now(),
      type: 'outgoing',
      recipient: member.name,
      phone: member.phone,
      text: `Namaste *${member.name}*! Aapki ₹${amount} ki payment safal rahi. Aapki gym membership ab *${newExpiry}* tak active hai. Keep grinding! 💪`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    notify();
    return true;
  }

  // Workflow 4: Daily Owner Report (8:00 AM Cron)
  function generateDailyReport() {
    const today = getTodayIST();
    const active = state.members.filter(r => r.expiry_date >= today);
    const expired = state.members.filter(r => r.expiry_date && r.expiry_date < today);
    const pending = state.members.filter(r => r.payment_status === 'Pending');

    const names = list => list.length ? list.map(r => r.name).join(', ') : 'Koi nahi';

    const reportText = `*Gym Daily Intelligence Report (${today})*\n\n` +
      `✅ Active Members: *${active.length}*\n` +
      `⚠️ Expired Members: *${expired.length}* (${names(expired)})\n` +
      `⏳ Pending Payments: *${pending.length}* (${names(pending)})\n\n` +
      `Summary generated by n8n automation engine. Check Google Sheet for details.`;

    addLog('info', `[Workflow 4] 08:00 AM Daily Summary: Active: ${active.length}, Expired: ${expired.length}, Pending: ${pending.length}`);

    addWhatsAppMessage({
      id: 'report_' + Date.now(),
      type: 'outgoing',
      recipient: 'Gym Owner (You)',
      phone: '919876543210',
      text: reportText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });

    notify();
    return {
      today,
      activeCount: active.length,
      expiredCount: expired.length,
      pendingCount: pending.length,
      text: reportText
    };
  }

  // Reset to initial state
  function reset() {
    state.members = JSON.parse(JSON.stringify(initialMembers));
    state.logs = [
      { type: 'info', text: 'System reset to clean baseline.', time: new Date().toLocaleTimeString() }
    ];
    state.whatsappMessages = [
      {
        id: 'msg_welcome',
        type: 'system',
        text: 'Messages and reminders are encrypted and sent via official Meta WhatsApp Cloud API.'
      }
    ];
    state.lastActionRowId = null;
    notify();
    addLog('success', 'Simulation state restored to default test dataset.');
  }

  // Fast forward helper: set a member's expiry to 3 days from now
  function setTestExpiryIn3Days(memberId) {
    const member = state.members.find(m => m.member_id === memberId);
    if (member) {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      member.expiry_date = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      member.last_reminder_date = '';
      state.lastActionRowId = member.member_id;
      addLog('warn', `Test helper: Set ${member.name}'s expiry to 3 days ahead (${member.expiry_date})`);
      notify();
    }
  }

  const api = {
    getState: () => state,
    subscribe,
    registerMember,
    runExpiryReminders,
    processPayment,
    generateDailyReport,
    reset,
    setTestExpiryIn3Days,
    addMonths,
    getTodayIST
  };

  window.Store = api;
  return api;
})();
