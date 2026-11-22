/**
 * ============================================================================
 * IronFit Gym — Production Backend Server & SQLite Database
 * Built with Node.js built-in HTTP and node:sqlite (Node v22+)
 * ============================================================================
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'gym.db');

// Initialize persistent SQLite database
const db = new DatabaseSync(DB_PATH);

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS members (
    member_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL,
    plan_months INTEGER NOT NULL,
    fee INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'Pending',
    last_payment_date TEXT,
    last_reminder_date TEXT,
    last_payment_ref TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    method TEXT NOT NULL,
    payment_ref TEXT NOT NULL,
    payment_date TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(member_id) REFERENCES members(member_id)
  );

  CREATE TABLE IF NOT EXISTS reminders_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    member_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    template_name TEXT NOT NULL,
    sent_date TEXT NOT NULL,
    days_left INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

// Date helper: UTC month-end clamped date math (from Sachin's guide Chapter 4)
function addMonths(isoDate, months) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const total = (m - 1) + months;
  const ny = y + Math.floor(total / 12);
  const nm = total % 12;
  const lastDay = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const nd = Math.min(d, lastDay);
  return ny + '-' + String(nm + 1).padStart(2, '0') + '-' + String(nd).padStart(2, '0');
}

// Current date in Asia/Kolkata (YYYY-MM-DD)
function getTodayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// Seed initial members if database is fresh
const memberCount = db.prepare('SELECT COUNT(*) as count FROM members').get().count;
if (memberCount === 0) {
  const seedMembers = [
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

  const insertStmt = db.prepare(`
    INSERT INTO members (member_id, name, phone, plan, plan_months, fee, start_date, expiry_date, payment_status, last_payment_date, last_reminder_date, last_payment_ref)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  seedMembers.forEach(m => {
    insertStmt.run(m.member_id, m.name, m.phone, m.plan, m.plan_months, m.fee, m.start_date, m.expiry_date, m.payment_status, m.last_payment_date, m.last_reminder_date, m.last_payment_ref);
  });

  db.prepare('INSERT INTO audit_logs (event_type, description) VALUES (?, ?)').run('SYSTEM_INIT', 'Pre-seeded 3 default members into persistent SQLite database.');
}

// Plan configuration lookup
const PLAN_MONTHS = {
  'Monthly': 1,
  'Quarterly': 3,
  'Half-yearly': 6,
  'Yearly': 12
};

const PLAN_FEES = {
  'Monthly': 1200,
  'Quarterly': 3000,
  'Half-yearly': 5500,
  'Yearly': 10000
};

// Parse JSON request body helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1e6) { // 1MB limit
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

// Helper to respond with JSON
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// Server router
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // --------------------------------------------------------------------------
  // API ENDPOINTS
  // --------------------------------------------------------------------------

  // 1. GET /api/stats — Dashboard KPI metrics
  if (req.method === 'GET' && pathname === '/api/stats') {
    const today = getTodayIST();
    const allMembers = db.prepare('SELECT * FROM members').all();

    const total = allMembers.length;
    const active = allMembers.filter(m => m.expiry_date >= today).length;
    const expired = allMembers.filter(m => m.expiry_date && m.expiry_date < today).length;
    const pending = allMembers.filter(m => m.payment_status === 'Pending').length;
    const totalCollected = db.prepare("SELECT COALESCE(SUM(amount), 0) as sum FROM payments").get().sum;

    return sendJson(res, 200, {
      success: true,
      today,
      total,
      active,
      expired,
      pending,
      totalCollected
    });
  }

  // 2. GET /api/members — List all members (with optional search)
  if (req.method === 'GET' && pathname === '/api/members') {
    const q = parsedUrl.searchParams.get('q');
    let members;
    if (q) {
      const param = `%${q}%`;
      members = db.prepare('SELECT * FROM members WHERE member_id LIKE ? OR name LIKE ? OR phone LIKE ? ORDER BY created_at DESC').all(param, param, param);
    } else {
      members = db.prepare('SELECT * FROM members ORDER BY created_at DESC').all();
    }
    return sendJson(res, 200, { success: true, count: members.length, members });
  }

  // 3. GET /api/members/:query — Lookup single member by ID or Phone
  if (req.method === 'GET' && pathname.startsWith('/api/members/')) {
    const query = decodeURIComponent(pathname.replace('/api/members/', '')).trim();
    const cleanPhone = query.replace(/\D/g, '');

    const member = db.prepare(`
      SELECT * FROM members 
      WHERE LOWER(member_id) = LOWER(?) 
         OR phone = ? 
         OR (LENGTH(?) >= 8 AND phone LIKE ?)
      LIMIT 1
    `).get(query, cleanPhone, cleanPhone, `%${cleanPhone}`);

    if (!member) {
      return sendJson(res, 404, { success: false, message: 'Member not found' });
    }

    const today = getTodayIST();
    const isExpired = member.expiry_date && member.expiry_date < today;
    const daysLeft = Math.round((new Date(member.expiry_date) - new Date(today)) / 86400000);

    return sendJson(res, 200, {
      success: true,
      member: {
        ...member,
        isExpired,
        daysLeft,
        isActive: !isExpired && member.payment_status === 'Paid'
      }
    });
  }

  // 4. POST /api/members/register — Automated Registration (Workflow 1)
  if (req.method === 'POST' && pathname === '/api/members/register') {
    try {
      const data = await parseBody(req);
      if (!data.name || !data.phone) {
        return sendJson(res, 400, { success: false, message: 'Name and phone are required' });
      }

      let phone = String(data.phone).replace(/\D/g, '');
      if (phone.length === 10) phone = '91' + phone;

      const plan = data.plan || 'Quarterly';
      const months = PLAN_MONTHS[plan] || 1;
      const fee = Number(data.fee) || PLAN_FEES[plan] || 1200;
      const startDate = data.startDate || getTodayIST();
      const expiryDate = addMonths(startDate, months);

      // Check if phone already registered (deduplication)
      const existing = db.prepare('SELECT * FROM members WHERE phone = ?').get(phone);

      let memberId;
      if (existing) {
        memberId = existing.member_id;
        db.prepare(`
          UPDATE members 
          SET name = ?, plan = ?, plan_months = ?, fee = ?, start_date = ?, expiry_date = ?, payment_status = 'Pending'
          WHERE member_id = ?
        `).run(data.name.trim(), plan, months, fee, startDate, expiryDate, memberId);

        db.prepare('INSERT INTO audit_logs (event_type, description) VALUES (?, ?)').run('MEMBER_UPDATE', `Updated member ${memberId} (${data.name.trim()})`);
      } else {
        memberId = 'GYM-' + String(Date.now()).slice(-6);
        db.prepare(`
          INSERT INTO members (member_id, name, phone, plan, plan_months, fee, start_date, expiry_date, payment_status, last_payment_date, last_reminder_date, last_payment_ref)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', '', '', '')
        `).run(memberId, data.name.trim(), phone, plan, months, fee, startDate, expiryDate);

        db.prepare('INSERT INTO audit_logs (event_type, description) VALUES (?, ?)').run('MEMBER_REGISTER', `New member ${memberId} (${data.name.trim()}) registered via tablet form`);
      }

      const saved = db.prepare('SELECT * FROM members WHERE member_id = ?').get(memberId);
      return sendJson(res, 201, {
        success: true,
        isNew: !existing,
        member: saved,
        message: existing ? `Updated existing profile for ${saved.name}` : `Welcome ${saved.name}! Member ID: ${saved.member_id}`
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, message: err.message });
    }
  }

  // 5. POST /api/members/renew — Automated Payment & Expiry Extension (Workflow 3)
  if (req.method === 'POST' && pathname === '/api/members/renew') {
    try {
      const data = await parseBody(req);
      const { memberId, paymentRef, method = 'UPI_Online' } = data;

      if (!memberId) {
        return sendJson(res, 400, { success: false, message: 'memberId is required' });
      }

      const member = db.prepare('SELECT * FROM members WHERE member_id = ?').get(memberId);
      if (!member) {
        return sendJson(res, 404, { success: false, message: 'Member not found' });
      }

      const refId = paymentRef || 'ref_' + Date.now();

      // Idempotency check: if this payment reference was already recorded, don't double extend
      if (member.last_payment_ref && member.last_payment_ref === refId) {
        return sendJson(res, 200, {
          success: true,
          idempotent: true,
          member,
          message: 'Payment already processed for this reference ID.'
        });
      }

      const today = getTodayIST();
      const firstPayment = !member.last_payment_date;
      const base = member.expiry_date > today ? member.expiry_date : today;
      const newExpiry = firstPayment ? member.expiry_date : addMonths(base, member.plan_months);

      // Update member in DB
      db.prepare(`
        UPDATE members 
        SET payment_status = 'Paid', last_payment_date = ?, expiry_date = ?, last_payment_ref = ?
        WHERE member_id = ?
      `).run(today, newExpiry, refId, memberId);

      // Record transaction log in payments table
      db.prepare(`
        INSERT INTO payments (member_id, amount, method, payment_ref, payment_date)
        VALUES (?, ?, ?, ?, ?)
      `).run(memberId, member.fee, method, refId, today);

      db.prepare('INSERT INTO audit_logs (event_type, description) VALUES (?, ?)').run('PAYMENT_RENEWAL', `Payment of ₹${member.fee} captured for ${member.name} (${memberId}). Expiry extended to ${newExpiry}`);

      const updated = db.prepare('SELECT * FROM members WHERE member_id = ?').get(memberId);
      return sendJson(res, 200, {
        success: true,
        member: updated,
        message: `Payment of ₹${member.fee} captured! Expiry extended to ${newExpiry}.`
      });
    } catch (err) {
      return sendJson(res, 500, { success: false, message: err.message });
    }
  }

  // 6. POST /api/cron/reminders — Scheduled 09:00 AM Expiry Reminders (Workflow 2)
  if (req.method === 'POST' && pathname === '/api/cron/reminders') {
    const today = getTodayIST();
    const REMIND_DAYS = [3, 0];

    function toUtc(iso) {
      const [y, m, d] = iso.split('-').map(Number);
      return Date.UTC(y, m - 1, d);
    }

    const members = db.prepare('SELECT * FROM members WHERE expiry_date IS NOT NULL AND phone IS NOT NULL').all();
    const dispatched = [];

    members.forEach(m => {
      if (m.last_reminder_date === today) return; // Skip if already reminded today

      const daysLeft = Math.round((toUtc(m.expiry_date) - toUtc(today)) / 86400000);
      if (REMIND_DAYS.includes(daysLeft)) {
        // Update member record with last_reminder_date
        db.prepare('UPDATE members SET last_reminder_date = ? WHERE member_id = ?').run(today, m.member_id);

        // Record in reminders log
        db.prepare(`
          INSERT INTO reminders_log (member_id, phone, template_name, sent_date, days_left)
          VALUES (?, ?, ?, ?, ?)
        `).run(m.member_id, m.phone, 'gym_membership_expiry_reminder', today, daysLeft);

        dispatched.push({
          member_id: m.member_id,
          name: m.name,
          phone: m.phone,
          expiry_date: m.expiry_date,
          daysLeft,
          message: `Namaste ${m.name}, aapki gym membership ${m.expiry_date} ko khatam ho rahi hai. Renew karne ke liye gym par aayein ya online renew karein. Dhanyavaad!`
        });
      }
    });

    db.prepare('INSERT INTO audit_logs (event_type, description) VALUES (?, ?)').run('CRON_REMINDERS', `Dispatched ${dispatched.length} WhatsApp expiry reminders.`);

    return sendJson(res, 200, {
      success: true,
      date: today,
      dispatchedCount: dispatched.length,
      dispatched
    });
  }

  // 7. POST /api/chat — Intelligent AI Gym Concierge Assistant
  if (req.method === 'POST' && pathname === '/api/chat') {
    try {
      const data = await parseBody(req);
      const query = (data.query || '').trim().toLowerCase();

      let reply = "I'm the GymDesk Concierge Bot! Ask me about **timings, membership fees, location, free trial, or personal training**.";

      if (query.includes('timing') || query.includes('hour') || query.includes('open') || query.includes('close') || query.includes('schedule')) {
        reply = "GymDesk is open **Monday to Saturday from 5:30 AM to 10:30 PM**. On Sundays, we are open **6:00 AM to 12:00 PM** for active recovery and open gym sessions.";
      } else if (query.includes('fee') || query.includes('price') || query.includes('cost') || query.includes('plan') || query.includes('rate') || query.includes('charge')) {
        reply = "Our transparent plans: **Monthly:** ₹1,200 | **Quarterly:** ₹3,000 (Most Popular — ₹1,000/mo) | **Half-Yearly:** ₹5,500 | **Yearly VIP:** ₹10,000 (includes free PT & merch). All plans include full 10,000 sq.ft floor access and locker facilities!";
      } else if (query.includes('where') || query.includes('location') || query.includes('address') || query.includes('map') || query.includes('reach')) {
        reply = "We are located at: **GymDesk, Plot 42, Kings Road, Nirman Nagar, Jaipur, Rajasthan 302019** (Near Metro Pillar 84, Above Organic Mart).";
      } else if (query.includes('trial') || query.includes('free') || query.includes('pass') || query.includes('demo') || query.includes('visit')) {
        reply = "Yes! We provide a **1-Day Free Trial Pass** for all first-time lifters. Come in workout attire and ask for floor induction at the front desk, or register right on this site!";
      } else if (query.includes('trainer') || query.includes('pt') || query.includes('coach') || query.includes('guide')) {
        reply = "Every membership includes complimentary general floor trainer guidance and posture corrections. Dedicated 1-on-1 Personal Training packages are available starting at ₹3,500/month with our certified physique coaches.";
      } else if (query.includes('steam') || query.includes('sauna') || query.includes('bath') || query.includes('recovery')) {
        reply = "Yes! Our Finnish heat sauna and eucalyptus steam baths operate every **Tuesday, Thursday, and Saturday evening (6:00 PM - 9:00 PM)**. Included free in Quarterly, Half-Yearly, and Annual plans.";
      } else if (query.includes('renew') || query.includes('pay') || query.includes('upi') || query.includes('card')) {
        reply = "You can renew your membership instantly online via UPI or card in the **Member Portal** section of this website. Just type your registered phone number or Member ID to check your due date and renew in 1 click!";
      }

      return sendJson(res, 200, { success: true, reply });
    } catch (err) {
      return sendJson(res, 500, { success: false, message: err.message });
    }
  }

  // 8. GET /api/export/csv — Export 12-column Google Sheet format
  if (req.method === 'GET' && pathname === '/api/export/csv') {
    const members = db.prepare('SELECT * FROM members ORDER BY member_id ASC').all();
    const headers = 'member_id,name,phone,plan,plan_months,fee,start_date,expiry_date,payment_status,last_payment_date,last_reminder_date,last_payment_ref\n';
    const rows = members.map(m => {
      return `"${m.member_id}","${m.name}","${m.phone}","${m.plan}",${m.plan_months},${m.fee},"${m.start_date}","${m.expiry_date}","${m.payment_status}","${m.last_payment_date || ''}","${m.last_reminder_date || ''}","${m.last_payment_ref || ''}"`;
    }).join('\n');

    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="gym_members_database.csv"'
    });
    return res.end(headers + rows);
  }

  // --------------------------------------------------------------------------
  // STATIC FILE SERVING
  // --------------------------------------------------------------------------
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        return res.end('<h1>404 Not Found</h1>');
      }
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Internal Server Error: ' + err.code);
    }
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`IronFit Gym Backend & Database running on http://localhost:${PORT}`);
  console.log(`Connected to SQLite Database: ${DB_PATH}`);
  console.log(`=======================================================`);
});
