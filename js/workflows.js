/**
 * n8n Gym Manager Automation — Workflows Deep-Dive Controller & JSON Exporter
 * Provides copyable JavaScript code snippets and downloadable n8n workflow JSONs
 * Based on Chapters 4, 5, 6, and 7 of Sachin Prajapati's Guide
 */

const Workflows = (function() {

  // JSON blueprint templates formatted for n8n Community / Cloud import
  const n8nBlueprints = {
    wf1: {
      name: "1 - New Member Entry (Gym Manager)",
      nodes: [
        {
          parameters: {
            formTitle: "Gym Registration",
            formFields: {
              values: [
                { fieldLabel: "Name", requiredField: true },
                { fieldLabel: "Phone", requiredField: true },
                { fieldLabel: "Plan", fieldType: "dropdown", fieldOptions: { values: [{ option: "Monthly" }, { option: "Quarterly" }, { option: "Half-yearly" }, { option: "Yearly" }] } },
                { fieldLabel: "Fee", fieldType: "number", requiredField: true },
                { fieldLabel: "Start Date", fieldType: "date", requiredField: true }
              ]
            }
          },
          name: "n8n Form Trigger",
          type: "n8n-nodes-base.formTrigger",
          typeVersion: 1,
          position: [240, 300]
        },
        {
          parameters: {
            jsCode: `const planMonths = { 'Monthly': 1, 'Quarterly': 3, 'Half-yearly': 6, 'Yearly': 12 };\nfunction addMonths(isoDate, months) {\n  const [y, m, d] = isoDate.split('-').map(Number);\n  const total = (m - 1) + months;\n  const ny = y + Math.floor(total / 12);\n  const nm = total % 12;\n  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();\n  const nd = Math.min(d, lastDay);\n  return ny + '-' + String(nm + 1).padStart(2, '0') + '-' + String(nd).padStart(2, '0');\n}\n\nreturn $input.all().map(item => {\n  const f = item.json;\n  let phone = String(f['Phone']).replace(/\\D/g, '');\n  if (phone.length === 10) phone = '91' + phone;\n  const months = planMonths[f['Plan']] || 1;\n  const start = String(f['Start Date']).slice(0, 10);\n  return {\n    json: {\n      member_id: 'GYM-' + String(Date.now()).slice(-6),\n      name: f['Name'],\n      phone: phone,\n      plan: f['Plan'],\n      plan_months: months,\n      fee: f['Fee'],\n      start_date: start,\n      expiry_date: addMonths(start, months),\n      payment_status: 'Pending'\n    }\n  };\n});`
          },
          name: "Format & Calculate Expiry",
          type: "n8n-nodes-base.code",
          typeVersion: 1,
          position: [460, 300]
        },
        {
          parameters: {
            operation: "appendOrUpdate",
            sheetId: "YOUR_GOOGLE_SHEET_ID",
            range: "Members!A:L",
            options: { columnToMatchOn: "phone" }
          },
          name: "Google Sheets Append/Update",
          type: "n8n-nodes-base.googleSheets",
          typeVersion: 4,
          position: [680, 300]
        }
      ]
    },

    wf2: {
      name: "2 - Expiry Reminder (Gym Manager)",
      nodes: [
        {
          parameters: {
            rule: { interval: [{ field: "cronExpression", expression: "0 9 * * *" }] },
            triggerTimes: { item: [{ hour: 9, minute: 0 }] }
          },
          name: "Schedule Trigger (9 AM IST)",
          type: "n8n-nodes-base.scheduleTrigger",
          typeVersion: 1,
          position: [240, 300]
        },
        {
          parameters: {
            operation: "getAll",
            sheetId: "YOUR_GOOGLE_SHEET_ID",
            range: "Members!A:L"
          },
          name: "Read Members Sheet",
          type: "n8n-nodes-base.googleSheets",
          typeVersion: 4,
          position: [460, 300]
        },
        {
          parameters: {
            jsCode: `const REMIND_DAYS = [3, 0];\nconst today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });\nfunction toUtc(iso) {\n  const [y, m, d] = iso.split('-').map(Number);\n  return Date.UTC(y, m - 1, d);\n}\n\nreturn $input.all().filter(item => {\n  const r = item.json;\n  if (!r.expiry_date || !r.phone) return false;\n  if (r.last_reminder_date === today) return false;\n  const daysLeft = Math.round((toUtc(r.expiry_date) - toUtc(today)) / 86400000);\n  return REMIND_DAYS.includes(daysLeft);\n});`
          },
          name: "Filter Expiring Members",
          type: "n8n-nodes-base.code",
          typeVersion: 1,
          position: [680, 300]
        },
        {
          parameters: {
            operation: "sendTemplate",
            phoneNumberId: "YOUR_PHONE_NUMBER_ID",
            recipientPhoneNumber: "={{ $json.phone }}",
            templateName: "gym_membership_expiry_reminder",
            templateLanguage: "hi",
            bodyComponents: {
              parameters: [
                { type: "text", text: "={{ $json.name }}" },
                { type: "text", text: "={{ $json.expiry_date }}" }
              ]
            }
          },
          name: "WhatsApp Cloud API",
          type: "n8n-nodes-base.whatsApp",
          typeVersion: 1,
          position: [900, 300]
        },
        {
          parameters: {
            operation: "update",
            sheetId: "YOUR_GOOGLE_SHEET_ID",
            range: "Members!A:L",
            options: { columnToMatchOn: "phone" }
          },
          name: "Update last_reminder_date",
          type: "n8n-nodes-base.googleSheets",
          typeVersion: 4,
          position: [1120, 300]
        }
      ]
    },

    wf3: {
      name: "3 - Payment Update & Renewal (Gym Manager)",
      nodes: [
        {
          parameters: {
            httpMethod: "POST",
            path: "razorpay-gym-webhook",
            options: { rawBody: true }
          },
          name: "Webhook (payment_link.paid)",
          type: "n8n-nodes-base.webhook",
          typeVersion: 1,
          position: [240, 300]
        },
        {
          parameters: {
            conditions: {
              string: [{ value1: "={{ $json.body.event }}", value2: "payment_link.paid" }]
            }
          },
          name: "Is payment_link.paid?",
          type: "n8n-nodes-base.if",
          typeVersion: 1,
          position: [460, 300]
        },
        {
          parameters: {
            jsCode: `const b = $input.first().json.body;\nconst e = b.payload.payment_link.entity;\nreturn [{\n  json: {\n    event: b.event,\n    member_id: e.reference_id,\n    link_id: e.id,\n    amount_paid: e.amount_paid / 100\n  }\n}];`
          },
          name: "Extract Payment",
          type: "n8n-nodes-base.code",
          typeVersion: 1,
          position: [680, 300]
        },
        {
          parameters: {
            operation: "getAll",
            sheetId: "YOUR_GOOGLE_SHEET_ID",
            range: "Members!A:L",
            options: { filter: "member_id == {{ $json.member_id }}" }
          },
          name: "Find Member Row",
          type: "n8n-nodes-base.googleSheets",
          typeVersion: 4,
          position: [900, 300]
        },
        {
          parameters: {
            jsCode: `function addMonths(isoDate, months) {\n  const [y, m, d] = isoDate.split('-').map(Number);\n  const total = (m - 1) + months;\n  const ny = y + Math.floor(total / 12);\n  const nm = total % 12;\n  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();\n  const nd = Math.min(d, lastDay);\n  return ny + '-' + String(nm + 1).padStart(2, '0') + '-' + String(nd).padStart(2, '0');\n}\n\nconst row = $input.first().json;\nconst pay = $('Extract Payment').first().json;\nconst today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });\n\nif (row.last_payment_ref === pay.link_id) return []; // Idempotency check\n\nconst firstPayment = !row.last_payment_date;\nconst base = row.expiry_date > today ? row.expiry_date : today;\nconst newExpiry = firstPayment ? row.expiry_date : addMonths(base, Number(row.plan_months));\n\nreturn [{\n  json: {\n    member_id: row.member_id,\n    payment_status: 'Paid',\n    last_payment_date: today,\n    expiry_date: newExpiry,\n    last_payment_ref: pay.link_id\n  }\n}];`
          },
          name: "Compute New Expiry & Idempotency",
          type: "n8n-nodes-base.code",
          typeVersion: 1,
          position: [1120, 300]
        },
        {
          parameters: {
            operation: "update",
            sheetId: "YOUR_GOOGLE_SHEET_ID",
            range: "Members!A:L",
            options: { columnToMatchOn: "member_id" }
          },
          name: "Update Member to Paid",
          type: "n8n-nodes-base.googleSheets",
          typeVersion: 4,
          position: [1340, 300]
        }
      ]
    },

    wf4: {
      name: "4 - Daily Owner Intelligence Report (Gym Manager)",
      nodes: [
        {
          parameters: {
            rule: { interval: [{ field: "cronExpression", expression: "0 8 * * *" }] }
          },
          name: "Schedule Trigger (8 AM IST)",
          type: "n8n-nodes-base.scheduleTrigger",
          typeVersion: 1,
          position: [240, 300]
        },
        {
          parameters: {
            operation: "getAll",
            sheetId: "YOUR_GOOGLE_SHEET_ID",
            range: "Members!A:L"
          },
          name: "Read Members Sheet",
          type: "n8n-nodes-base.googleSheets",
          typeVersion: 4,
          position: [460, 300]
        },
        {
          parameters: {
            jsCode: `const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });\nconst rows = $input.all().map(i => i.json).filter(r => r.member_id);\nconst active = rows.filter(r => r.expiry_date >= today);\nconst expired = rows.filter(r => r.expiry_date && r.expiry_date < today);\nconst pending = rows.filter(r => r.payment_status === 'Pending');\nconst names = list => list.length ? list.map(r => r.name).join(', ') : 'Koi nahi';\n\nconst text =\n  'Gym report ' + today + '\\n' +\n  'Active members: ' + active.length + '\\n' +\n  'Expired memberships: ' + expired.length + ' (' + names(expired) + ')\\n' +\n  'Pending payments: ' + pending.length + ' (' + names(pending) + ')';\n\nreturn [{\n  json: {\n    date: today,\n    active: active.length,\n    expired: expired.length,\n    pending: pending.length,\n    text\n  }\n}];`
          },
          name: "Aggregate Metrics",
          type: "n8n-nodes-base.code",
          typeVersion: 1,
          position: [680, 300]
        },
        {
          parameters: {
            sendTo: "gym_owner@example.com",
            subject: "=Gym report {{ $json.date }}",
            message: "={{ $json.text }}"
          },
          name: "Send Owner Email (or WhatsApp)",
          type: "n8n-nodes-base.emailSend",
          typeVersion: 2,
          position: [900, 300]
        }
      ]
    }
  };

  function downloadWorkflowJson(wfKey) {
    const blueprint = n8nBlueprints[wfKey];
    if (!blueprint) return;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(blueprint, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${wfKey}_n8n_gym_automation.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    if (window.Sandbox) {
      window.Sandbox.showToast(`Downloaded ${blueprint.name} JSON for n8n!`, 'success');
    }
  }

  function downloadAllWorkflows() {
    const bundle = {
      bundleTitle: "Complete n8n Gym Manager Automation Suite (All 4 Workflows)",
      author: "Sachin Prajapati",
      version: "2026.11",
      workflows: n8nBlueprints
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bundle, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `n8n_gym_manager_all_4_workflows.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    if (window.Sandbox) {
      window.Sandbox.showToast('Downloaded complete 4-workflow n8n bundle!', 'success');
    }
  }

  function copyCode(btn, codeId) {
    const codeEl = document.getElementById(codeId);
    if (!codeEl) return;

    const textToCopy = codeEl.innerText;
    navigator.clipboard.writeText(textToCopy).then(() => {
      const origText = btn.innerHTML;
      btn.innerHTML = `<svg class="w-3.5 h-3.5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg><span class="text-emerald-400">Copied!</span>`;
      setTimeout(() => {
        btn.innerHTML = origText;
      }, 2000);
    });
  }

  function init() {
    // Tab switching for workflow technical view
    const tabBtns = document.querySelectorAll('.wf-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', function() {
        const targetWf = this.getAttribute('data-wf');
        tabBtns.forEach(b => {
          b.className = 'wf-tab-btn px-4 py-2 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-200 border border-transparent';
        });
        this.className = 'wf-tab-btn px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';

        document.querySelectorAll('.wf-panel').forEach(panel => {
          panel.classList.add('hidden');
        });
        const activePanel = document.getElementById(`wf-panel-${targetWf}`);
        if (activePanel) activePanel.classList.remove('hidden');
      });
    });
  }

  const api = {
    init,
    downloadWorkflowJson,
    downloadAllWorkflows,
    copyCode
  };

  window.Workflows = api;
  return api;
})();
