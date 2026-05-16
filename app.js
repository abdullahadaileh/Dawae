// ═══════════════════════════════════════════════
//  دوائي – Medication Manager
//  app.js – Core Logic
// ═══════════════════════════════════════════════

'use strict';

// ── State ──────────────────────────────────────
let currentUser = null;    // { email, name, joinedAt }
let reminderTimes = [];    // temp for add-form
let selectedUseMethod = 'قبل الأكل';

// ── Storage Helpers ─────────────────────────────
const KEY_USERS     = 'dawae_users';           // global: all users
const KEY_SESSION   = 'dawae_session';         // global: current logged-in email

function usersDB() {
  return JSON.parse(localStorage.getItem(KEY_USERS) || '{}');
}
function saveUsersDB(db) {
  localStorage.setItem(KEY_USERS, JSON.stringify(db));
}
function userKey(email) {
  // Each user gets their own key for medications
  return `dawae_meds_${email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}
function getUserMeds(email) {
  return JSON.parse(localStorage.getItem(userKey(email)) || '[]');
}
function saveUserMeds(email, meds) {
  localStorage.setItem(userKey(email), JSON.stringify(meds));
}

// ── Auth ────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (i === 0 && tab === 'login') || (i === 1 && tab === 'register'));
  });
  document.getElementById('loginForm').classList.toggle('active', tab === 'login');
  document.getElementById('registerForm').classList.toggle('active', tab === 'register');
}

function register() {
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim().toLowerCase();
  const password = document.getElementById('regPassword').value;
  const confirm  = document.getElementById('regConfirm').value;
  const errEl    = document.getElementById('registerError');

  const showErr = (msg) => { errEl.textContent = msg; errEl.classList.add('show'); };
  errEl.classList.remove('show');

  if (!name)               return showErr('الرجاء إدخال الاسم الكامل');
  if (!email || !email.includes('@')) return showErr('الرجاء إدخال بريد إلكتروني صحيح');
  if (password.length < 6) return showErr('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
  if (password !== confirm) return showErr('كلمتا المرور غير متطابقتين');

  const db = usersDB();
  if (db[email]) return showErr('هذا البريد الإلكتروني مسجل مسبقاً');

  db[email] = { name, email, password, joinedAt: new Date().toLocaleDateString('ar-JO') };
  saveUsersDB(db);

  // Auto-login
  loginAs(db[email]);
}

function login() {
  const email    = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');

  errEl.classList.remove('show');

  const db = usersDB();
  const user = db[email];
  if (!user || user.password !== password) {
    errEl.classList.add('show');
    return;
  }
  loginAs(user);
}

function loginAs(user) {
  currentUser = user;
  localStorage.setItem(KEY_SESSION, user.email);
  showApp();
}

function logout() {
  localStorage.removeItem(KEY_SESSION);
  currentUser = null;
  document.getElementById('app').classList.remove('active');
  document.getElementById('authScreen').style.display = 'flex';
  // Clear form
  ['loginEmail','loginPassword'].forEach(id => document.getElementById(id).value = '');
}

function checkSession() {
  const email = localStorage.getItem(KEY_SESSION);
  if (!email) return;
  const db = usersDB();
  if (db[email]) loginAs(db[email]);
}

function showApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').classList.add('active');
  updateHeader();
  renderDashboard();
  navigate(0);
}

function updateHeader() {
  const initials = currentUser.name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  document.getElementById('headerAvatar').textContent = initials;
  document.getElementById('profileAvatar').textContent = initials;
  document.getElementById('profileName').textContent = currentUser.name;
  document.getElementById('profileEmail').textContent = currentUser.email;
  document.getElementById('profileJoined').textContent = currentUser.joinedAt;

  const hour = new Date().getHours();
  const gr = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء النور' : 'مساء الخير';
  document.getElementById('greetingText').textContent = `${gr}، ${currentUser.name.split(' ')[0]} 👋`;
  document.getElementById('greetingDate').textContent = new Date().toLocaleDateString('ar-JO', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });
}

// ── Navigation ──────────────────────────────────
const PAGES = ['pageDashboard','pageMeds','pageAdd','pageCompare','pageProfile'];

function navigate(idx) {
  PAGES.forEach((id, i) => {
    document.getElementById(id).classList.toggle('active', i === idx);
  });
  document.querySelectorAll('.nav-item').forEach((btn, i) => {
    btn.classList.toggle('active', i === idx);
  });
  if (idx === 0) renderDashboard();
  if (idx === 1) renderMedsList();
  if (idx === 2) resetAddForm();
  if (idx === 3) renderInventory();
  if (idx === 4) renderProfile();
}

// ── Medications CRUD ─────────────────────────────
function getMeds() { return getUserMeds(currentUser.email); }
function saveMeds(meds) { saveUserMeds(currentUser.email, meds); }

function addMedication() {
  const name    = document.getElementById('medName').value.trim();
  const dose    = document.getElementById('medDose').value.trim();
  const form    = document.getElementById('medForm').value;
  const expiry  = document.getElementById('medExpiry').value;
  const qtyTotal= parseInt(document.getElementById('medQtyTotal').value) || 0;
  const qtyLeft = parseInt(document.getElementById('medQtyLeft').value) || qtyTotal;
  const notes   = document.getElementById('medNotes').value.trim();

  if (!name)   return showToast('⚠️ الرجاء إدخال اسم الدواء');
  if (!dose)   return showToast('⚠️ الرجاء إدخال الجرعة');
  if (!expiry) return showToast('⚠️ الرجاء إدخال تاريخ الانتهاء');

  const med = {
    id: Date.now().toString(),
    name, dose, form,
    useMethod: selectedUseMethod,
    expiry,
    qtyTotal: qtyTotal || 0,
    qtyLeft:  qtyLeft  || 0,
    reminderTimes: [...reminderTimes],
    notes,
    addedAt: new Date().toISOString(),
    taken: {}   // { 'YYYY-MM-DD': count }
  };

  const meds = getMeds();
  meds.push(med);
  saveMeds(meds);

  showToast('✅ تم إضافة الدواء بنجاح');
  resetAddForm();
  navigate(1);
}

function deleteMed(id) {
  if (!confirm('هل تريد حذف هذا الدواء؟')) return;
  const meds = getMeds().filter(m => m.id !== id);
  saveMeds(meds);
  renderMedsList();
  renderDashboard();
  showToast('🗑️ تم حذف الدواء');
}

function confirmDose(id) {
  const meds = getMeds();
  const med = meds.find(m => m.id === id);
  if (!med) return;

  if (med.qtyLeft > 0) {
    med.qtyLeft -= 1;
    const today = todayStr();
    med.taken[today] = (med.taken[today] || 0) + 1;
    saveMeds(meds);
    renderDashboard();
    renderMedsList();
    showToast(`✅ تم تسجيل جرعة ${med.name}`);
  } else {
    showToast('⚠️ الكمية المتبقية صفر');
  }
}

function clearAllMeds() {
  if (!confirm('هل أنت متأكد من حذف جميع الأدوية؟')) return;
  saveMeds([]);
  renderProfile();
  renderDashboard();
  showToast('🗑️ تم حذف جميع الأدوية');
}

// ── Add Form Helpers ────────────────────────────
function resetAddForm() {
  document.getElementById('medName').value    = '';
  document.getElementById('medDose').value    = '';
  document.getElementById('medExpiry').value  = '';
  document.getElementById('medQtyTotal').value= '';
  document.getElementById('medQtyLeft').value = '';
  document.getElementById('medNotes').value   = '';
  document.getElementById('medForm').value    = '💊';
  reminderTimes = [];
  renderReminderChips();
  selectedUseMethod = 'قبل الأكل';
  document.querySelectorAll('#useMethodGroup .tag-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === selectedUseMethod);
  });
}

function selectTag(btn, group) {
  const parent = btn.closest('.tag-group');
  parent.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (group === 'useMethod') selectedUseMethod = btn.dataset.val;
}

function addReminderTime() {
  const t = document.getElementById('reminderTimeInput').value;
  if (!t) return showToast('اختر وقتاً أولاً');
  if (reminderTimes.includes(t)) return showToast('هذا الوقت مضاف مسبقاً');
  reminderTimes.push(t);
  reminderTimes.sort();
  renderReminderChips();
  document.getElementById('reminderTimeInput').value = '';
}

function removeReminderTime(t) {
  reminderTimes = reminderTimes.filter(x => x !== t);
  renderReminderChips();
}

function renderReminderChips() {
  const el = document.getElementById('reminderChips');
  el.innerHTML = reminderTimes.map(t =>
    `<div class="time-chip">
      <span>🕐 ${t}</span>
      <button onclick="removeReminderTime('${t}')">×</button>
    </div>`
  ).join('');
}

// ── Dashboard ───────────────────────────────────
function todayStr() { return new Date().toISOString().slice(0,10); }
function daysUntil(dateStr) {
  const diff = new Date(dateStr) - new Date(todayStr());
  return Math.ceil(diff / (1000*60*60*24));
}
function pctLeft(med) {
  if (!med.qtyTotal) return 100;
  return Math.max(0, Math.round((med.qtyLeft / med.qtyTotal) * 100));
}

function renderDashboard() {
  const meds = getMeds();
  const today = todayStr();
  const lowMeds      = meds.filter(m => m.qtyTotal > 0 && pctLeft(m) <= 25 && m.qtyLeft > 0);
  const expiringMeds = meds.filter(m => { const d = daysUntil(m.expiry); return d >= 0 && d <= 30; });
  const todayMeds    = meds.filter(m => m.reminderTimes && m.reminderTimes.length > 0);
  const expiredMeds  = meds.filter(m => daysUntil(m.expiry) < 0);

  document.getElementById('statTotal').textContent    = meds.length;
  document.getElementById('statToday').textContent    = todayMeds.length;
  document.getElementById('statLow').textContent      = lowMeds.length;
  document.getElementById('statExpiring').textContent = expiringMeds.length + expiredMeds.length;

  // Alerts
  const alerts = [];
  expiredMeds.forEach(m => alerts.push({ type:'danger', icon:'❌', title: m.name, sub: 'انتهت صلاحيته' }));
  expiringMeds.forEach(m => {
    const d = daysUntil(m.expiry);
    alerts.push({ type:'warning', icon:'⚠️', title: m.name, sub: `ينتهي خلال ${d} يوم` });
  });
  lowMeds.forEach(m => alerts.push({ type:'info', icon:'📦', title: m.name, sub: `متبقي ${m.qtyLeft} وحدة` }));

  document.getElementById('alertCount').textContent = alerts.length;
  const alertsEl = document.getElementById('alertsList');
  if (alerts.length === 0) {
    alertsEl.innerHTML = `<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:0.9rem;">✅ لا توجد تنبيهات</div>`;
  } else {
    alertsEl.innerHTML = alerts.map(a =>
      `<div class="alert-card ${a.type}">
        <div class="alert-icon">${a.icon}</div>
        <div class="alert-body">
          <strong>${a.title}</strong>
          <span>${a.sub}</span>
        </div>
      </div>`
    ).join('');
  }

  // Today meds
  document.getElementById('todayCount').textContent = todayMeds.length;
  const todayEl = document.getElementById('todayMeds');
  if (todayMeds.length === 0) {
    todayEl.innerHTML = `<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:0.9rem;">لا توجد أدوية مجدولة اليوم</div>`;
  } else {
    todayEl.innerHTML = todayMeds.map(m => medCardHTML(m, true)).join('');
  }
}

// ── Meds List ───────────────────────────────────
function renderMedsList() {
  const meds = getMeds();
  document.getElementById('medsCount').textContent = meds.length;
  const el = document.getElementById('medsList');
  if (meds.length === 0) {
    el.innerHTML = `<div class="empty-state">
      <div class="empty-icon">💊</div>
      <h3>لا توجد أدوية مسجلة</h3>
      <p>اضغط على تبويب "إضافة" لتسجيل أدويتك</p>
    </div>`;
    return;
  }
  el.innerHTML = meds.map(m => medCardHTML(m, false)).join('');
}

function medCardHTML(med, compact) {
  const pct  = pctLeft(med);
  const days = daysUntil(med.expiry);
  const barClass = pct <= 10 ? 'critical' : pct <= 25 ? 'low' : '';
  const expText = days < 0
    ? `<span style="color:var(--danger)">⛔ انتهت الصلاحية</span>`
    : days <= 7
    ? `<span style="color:var(--danger)">⚠️ ينتهي خلال ${days} أيام</span>`
    : days <= 30
    ? `<span style="color:var(--warning)">⚠️ ينتهي خلال ${days} يوم</span>`
    : `<span>انتهاء: ${new Date(med.expiry).toLocaleDateString('ar-JO')}</span>`;

  const timesText = med.reminderTimes && med.reminderTimes.length
    ? `🕐 ${med.reminderTimes.join(' | ')}`
    : 'لا يوجد تذكير';

  return `
  <div class="med-card">
    <div class="med-icon">${med.form || '💊'}</div>
    <div class="med-body">
      <div class="med-name">${med.name}</div>
      <div class="med-meta">
        ${med.dose} &nbsp;·&nbsp; ${med.useMethod}<br/>
        ${timesText}<br/>
        ${expText}
        ${med.notes ? `<br/><span>📝 ${med.notes}</span>` : ''}
      </div>
      ${med.qtyTotal > 0 ? `
      <div class="qty-bar-wrap">
        <div class="qty-bar-label">
          <span>المتبقي: ${med.qtyLeft} / ${med.qtyTotal}</span>
          <span>${pct}%</span>
        </div>
        <div class="qty-bar">
          <div class="qty-bar-fill ${barClass}" style="width:${pct}%"></div>
        </div>
      </div>` : ''}
    </div>
    <div class="med-actions">
      ${med.qtyTotal > 0 ? `<button class="med-btn confirm" onclick="confirmDose('${med.id}')">✅ جرعة</button>` : ''}
      <button class="med-btn delete" onclick="deleteMed('${med.id}')">🗑️</button>
    </div>
  </div>`;
}

// ── Prescription Compare ─────────────────────────
function comparePrescription() {
  const raw = document.getElementById('prescriptionInput').value;
  const inputMeds = raw.split('\n').map(l => l.trim().toLowerCase()).filter(Boolean);
  if (inputMeds.length === 0) return showToast('أدخل أسماء الأدوية أولاً');

  const myMeds = getMeds();
  const myNames = myMeds.map(m => m.name.toLowerCase());

  const available    = [];
  const notAvailable = [];

  inputMeds.forEach(inputName => {
    const found = myMeds.find(m =>
      m.name.toLowerCase().includes(inputName) || inputName.includes(m.name.toLowerCase())
    );
    if (found) {
      const days = daysUntil(found.expiry);
      if (days >= 0) {
        available.push({ input: inputName, found: found.name, qty: found.qtyLeft, expiry: days });
      } else {
        notAvailable.push({ input: inputName, reason: 'منتهي الصلاحية' });
      }
    } else {
      notAvailable.push({ input: inputName, reason: 'غير موجود في المخزون' });
    }
  });

  const el = document.getElementById('compareResult');
  el.classList.add('show');

  if (notAvailable.length === 0) {
    el.className = 'compare-result show available';
    el.innerHTML = `<h4>✅ جميع أدوية الوصفة متوفرة لديك!</h4>
      <ul>${available.map(a => `<li><strong>${a.found}</strong> — متبقي ${a.qty} وحدة</li>`).join('')}</ul>`;
  } else {
    el.className = 'compare-result show not-available';
    let html = '';
    if (available.length > 0) {
      html += `<h4 style="color:var(--primary)">✅ متوفر (${available.length})</h4>
        <ul style="color:var(--primary)">
          ${available.map(a => `<li><strong>${a.found}</strong> — متبقي ${a.qty} وحدة</li>`).join('')}
        </ul>`;
    }
    html += `<h4 style="color:var(--danger);margin-top:${available.length?12:0}px">⛔ يحتاج شراء (${notAvailable.length})</h4>
      <ul style="color:var(--danger)">
        ${notAvailable.map(n => `<li><strong>${n.input}</strong> — ${n.reason}</li>`).join('')}
      </ul>`;
    el.innerHTML = html;
  }
}

function renderInventory() {
  const meds = getMeds();
  const el = document.getElementById('inventoryList');
  document.getElementById('compareResult').classList.remove('show');
  if (meds.length === 0) {
    el.innerHTML = `<p style="color:var(--text-muted);font-size:0.9rem;text-align:center;padding:16px 0;">لا توجد أدوية في المخزون</p>`;
    return;
  }
  el.innerHTML = meds.map(m => {
    const days = daysUntil(m.expiry);
    const tag = days < 0 ? '❌' : days <= 30 ? '⚠️' : '✅';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);">
      <span>${m.form} <strong>${m.name}</strong></span>
      <span style="font-size:0.8rem;color:var(--text-muted);">${tag} ${m.qtyLeft} وحدة</span>
    </div>`;
  }).join('');
}

// ── Profile ─────────────────────────────────────
function renderProfile() {
  const meds = getMeds();
  const lowMeds      = meds.filter(m => m.qtyTotal > 0 && pctLeft(m) <= 25 && m.qtyLeft > 0);
  const expiringMeds = meds.filter(m => { const d = daysUntil(m.expiry); return d >= 0 && d <= 30; });

  document.getElementById('profileTotal').textContent    = meds.length;
  document.getElementById('profileLow').textContent      = lowMeds.length;
  document.getElementById('profileExpiring').textContent = expiringMeds.length;
}

// ── Toast ────────────────────────────────────────
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkSession();

  // Enter key on login
  ['loginEmail','loginPassword'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') login();
    });
  });

  // Set min date for expiry to today
  document.getElementById('medExpiry').min = todayStr();
});
