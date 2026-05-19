/* ─────────────────────────────────────────────────
   app.js  —  SPA routing, modal engine, rendering
   ───────────────────────────────────────────────── */

const today = () => new Date().toISOString().split('T')[0];

const SUBJECTS = ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English'];
const CONF_OPTS = ['Very Weak', 'Weak', 'Average', 'Good', 'Strong'];
const STATUS_CLASS = ['Completed', 'Incomplete', 'Revision Needed'];
const PRIORITY = ['Critical', 'High', 'Medium', 'Low'];
const GOAL_TYPES = ['MCQ Practice', 'Revision', 'Homework', 'Backlog Completion', 'Formula Revision', 'Lecture Revision'];

function sel(id) { return document.getElementById(id); }
function val(id) { return (sel(id) || {}).value || ''; }

function options(arr, selected = '') {
  return arr.map(o => `<option value="${o}"${o === selected ? ' selected' : ''}>${o}</option>`).join('');
}

/* ── badge helpers ───────────────────────────────── */
const CONF_MAP = { 'Very Weak': 'badge-red', 'Weak': 'badge-red', 'Average': 'badge-amber', 'Good': 'badge-blue', 'Strong': 'badge-green' };
const PRI_MAP = { 'Critical': 'badge-red', 'High': 'badge-amber', 'Medium': 'badge-blue', 'Low': 'badge-green' };
const STA_MAP = {
  'Completed': 'badge-green', 'Incomplete': 'badge-red', 'Revision Needed': 'badge-amber',
  'Pending': 'badge-blue', 'In Progress': 'badge-amber', 'Skipped': 'badge-red'
};
const badge = (map, text) => `<span class="badge ${map[text] || 'badge-blue'}">${text || '—'}</span>`;
const confBadge = l => badge(CONF_MAP, l);
const priBadge = p => badge(PRI_MAP, p);
const statusBadge = s => badge(STA_MAP, s);

/* ── date formatting (respects setting) ──────────── */
function fd(adDate) {
  if (!adDate) return '—';
  return NepaliCal.formatDate(adDate);
}

/* Date preview chip HTML — placed below a date input */
function bsChip(inputId) {
  return `<div class="bs-chip" id="chip-${inputId}"></div>`;
}

/* Attach live BS preview to a date input */
function attachChip(inputId) {
  NepaliCal.attachBSPreview(inputId, `chip-${inputId}`);
}

/* ── empty state ─────────────────────────────────── */
function empty(icon, msg) {
  return `<div class="empty-state"><span class="material-symbols-rounded">${icon}</span>${msg}</div>`;
}

/* ── modal engine ────────────────────────────────── */
let _handler = null;
function openModal(title, bodyHTML, onSave) {
  sel('modal-title').textContent = title;
  sel('dynamic-fields').innerHTML = bodyHTML;
  const bd = sel('modal-backdrop');
  bd.style.display = 'flex';
  void bd.offsetWidth;
  bd.classList.add('active');
  const form = sel('add-form');
  if (_handler) form.removeEventListener('submit', _handler);
  _handler = e => { e.preventDefault(); onSave(); closeModal(); renderAll(); };
  form.addEventListener('submit', _handler);
}
window.openModal = openModal;

function closeModal() {
  const bd = sel('modal-backdrop');
  bd.classList.remove('active');
  const saveBtn = sel('add-form').querySelector('[type=submit]');
  const cancelBtn = sel('btn-cancel2');
  if (saveBtn) saveBtn.style.display = '';
  if (cancelBtn) cancelBtn.style.display = '';
  setTimeout(() => { if (!bd.classList.contains('active')) bd.style.display = 'none'; }, 280);
}

/* ── Settings panel ────────────────────────────────*/
function openSettings() {
  const curr = db.getSettings().dateDisplay;
  openModal('Date Display Format', `
    <p style="font-size:13px;color:var(--text-2);margin-bottom:16px;">
      Choose how dates are shown throughout the app.
    </p>
    <div class="fg">
      <label>Date Format</label>
      <select id="set-date">
        <option value="both" ${curr === 'both' ? 'selected' : ''}>Both BS + AD (default)</option>
        <option value="bs"   ${curr === 'bs' ? 'selected' : ''}>Bikram Sambat (BS) only</option>
        <option value="ad"   ${curr === 'ad' ? 'selected' : ''}>English (AD) only</option>
      </select>
    </div>
    <div style="margin-top:8px;padding:12px;background:var(--surface-2);border-radius:var(--radius-md);font-size:12px;color:var(--text-2)">
      <b>Example (BS+AD):</b> 2083 Jestha 05 (2026 May 19)<br>
      <b>Example (BS only):</b> 2083 Jestha 05<br>
      <b>Example (AD only):</b> May 19, 2026
    </div>
  `, () => {
    db.saveSettings({ dateDisplay: val('set-date') });
    renderAll();
  });
}

/* ── boot ────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const navItems = document.querySelectorAll('.nav-item');
  const views = document.querySelectorAll('.view');
  let activeView = 'view-dashboard';

  navItems.forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      views.forEach(v => v.classList.remove('active'));
      activeView = item.dataset.target;
      sel(activeView).classList.add('active');
      updateFab(activeView);
      refreshView(activeView);
    });
  });

  ['btn-cancel', 'btn-cancel2'].forEach(id => sel(id)?.addEventListener('click', closeModal));
  sel('modal-backdrop')?.addEventListener('click', e => { if (e.target === sel('modal-backdrop')) closeModal(); });

  // Settings gear icon
  sel('settings-btn')?.addEventListener('click', openSettings);

  updateFab('view-dashboard');
  renderAll();
});

/* ── FAB ─────────────────────────────────────────── */
function updateFab(viewId) {
  const fab = sel('global-fab');
  fab.style.display = viewId === 'view-analytics' ? 'none' : 'flex';
  fab.onclick = () => {
    if (viewId === 'view-dashboard' || viewId === 'view-classes') openAddClass();
    else if (viewId === 'view-goals') openAddGoal();
    else if (viewId === 'view-queue') openQueueMenu();
  };
}

function openQueueMenu() {
  openModal('Add to Queue', `
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button type="button" class="btn btn-primary" style="justify-content:center;"
        onclick="closeModal();setTimeout(openAddBacklog,120)">+ Backlog Item</button>
      <button type="button" class="btn btn-ghost" style="justify-content:center;"
        onclick="closeModal();setTimeout(openAddRevision,120)">+ Schedule Revision</button>
    </div>
  `, () => { });
  sel('add-form').querySelector('[type=submit]').style.display = 'none';
  sel('btn-cancel2').style.display = 'none';
}

/* ── render pipeline ─────────────────────────────── */
function renderAll() {
  renderDashboard(); renderClasses(); renderGoals();
  renderBacklogs(); renderRevisions(); renderAnalytics();
}
function refreshView(v) {
  if (v === 'view-dashboard') renderDashboard();
  if (v === 'view-classes') renderClasses();
  if (v === 'view-goals') renderGoals();
  if (v === 'view-queue') { renderBacklogs(); renderRevisions(); }
  if (v === 'view-analytics') renderAnalytics();
}

/* ── DASHBOARD ──────────────────────────────────── */
function renderDashboard() {
  const { pendingGoalsCount, classesTodayCount } = db.getDashboardStats();
  const todayBS = NepaliCal.todayBS();
  const el = sel('dashboard-grid');
  if (el) el.innerHTML = `
    <div class="stat-card">
      <span class="label">Pending Goals</span>
      <span class="value">${pendingGoalsCount}</span>
    </div>
    <div class="stat-card">
      <span class="label">Classes Today</span>
      <span class="value">${classesTodayCount}</span>
    </div>
    <div class="stat-card" style="grid-column:1/-1;text-align:center;">
      <span class="label">Today</span>
      <span style="font-size:14px;font-weight:700;color:var(--text-1);">${NepaliCal.formatBoth(today())}</span>
    </div>`;
  renderAnalyticsStats('dash-streaks');
  renderHeatmap('mini-heatmap', true);
}

/* ── ANALYTICS ──────────────────────────────────── */
function renderAnalytics() {
  renderAnalyticsStats('analytics-stats');
  renderHeatmap('heatmap-grid', false);
}

/* ── CLASSES ─────────────────────────────────────── */
function openAddClass() {
  const t = today();
  openModal('Log Class Session', `
    <div class="row2">
      <div class="fg"><label>Subject</label>
        <select id="ic-subject" required><option value="">Select</option>${options(SUBJECTS)}</select></div>
      <div class="fg"><label>Teacher</label>
        <input type="text" id="ic-teacher" placeholder="e.g. Sharma Sir" required></div>
    </div>
    <p class="form-section">Schedule</p>
    <div class="row3">
      <div class="fg"><label>Date (AD)</label>
        <input type="date" id="ic-date" required value="${t}">
        ${bsChip('ic-date')}</div>
      <div class="fg"><label>Start</label><input type="time" id="ic-start"></div>
      <div class="fg"><label>End</label><input type="time" id="ic-end"></div>
    </div>
    <p class="form-section">Content</p>
    <div class="fg"><label>Topics Studied</label>
      <textarea id="ic-topics" required placeholder="e.g. Rotational Motion, Torque"></textarea></div>
    <div class="row2">
      <div class="fg"><label>Difficult Topics</label>
        <textarea id="ic-difficult" placeholder="What was hard?"></textarea></div>
      <div class="fg"><label>Missed Concepts</label>
        <textarea id="ic-missed" placeholder="For backlog"></textarea></div>
    </div>
    <div class="fg"><label>Notes / Formulas / Homework</label>
      <textarea id="ic-notes" placeholder="Key formulas, reminders, assignments..."></textarea></div>
    <p class="form-section">Assessment</p>
    <div class="row2">
      <div class="fg"><label>Confidence</label>
        <select id="ic-conf">${options(CONF_OPTS, 'Average')}</select></div>
      <div class="fg"><label>Status</label>
        <select id="ic-status">${options(STATUS_CLASS, 'Completed')}</select></div>
    </div>
  `, () => {
    db.addClass({
      subject: val('ic-subject'), teacherName: val('ic-teacher'),
      classDate: val('ic-date'), startTime: val('ic-start'), endTime: val('ic-end'),
      topicsStudied: val('ic-topics'), difficultTopics: val('ic-difficult'),
      missedConcepts: val('ic-missed'), description: val('ic-notes'),
      confidenceLevel: val('ic-conf'), status: val('ic-status')
    });
  });
  requestAnimationFrame(() => attachChip('ic-date'));
}

function renderClasses() {
  const el = sel('classes-list');
  if (!el) return;
  const list = db.getClasses();
  if (!list.length) { el.innerHTML = empty('menu_book', 'No classes logged yet'); return; }
  el.innerHTML = list.map(c => `
    <div class="list-item">
      <div class="list-item-row" style="margin-bottom:6px;">
        <div style="flex:1; display:flex; align-items:center; gap:6px;">
          <h4>${c.subject}</h4>${statusBadge(c.status)}
        </div>
        <button class="delete-btn" onclick="deleteClass(${c.id})" title="Delete Class">
          <span class="material-symbols-rounded">delete</span>
        </button>
      </div>
      <p><b>Teacher:</b> ${c.teacherName || '—'} · <b>Date:</b> ${fd(c.classDate)}${c.startTime ? ' · ' + c.startTime + (c.endTime ? ' – ' + c.endTime : '') : ''}</p>
      <p style="margin-top:5px;"><b>Topics:</b> ${c.topicsStudied}</p>
      ${c.difficultTopics ? `<p style="margin-top:4px;color:var(--danger)"><b>Hard:</b> ${c.difficultTopics}</p>` : ''}
      ${c.description ? `<p style="margin-top:4px;"><b>Notes:</b> ${c.description}</p>` : ''}
      <div style="margin-top:8px;">${confBadge(c.confidenceLevel || 'Average')}</div>
    </div>`).join('');
}

/* ── GOALS ───────────────────────────────────────── */
function openAddGoal() {
  const t = today();
  openModal('Add Study Goal', `
    <div class="fg"><label>Title</label>
      <input type="text" id="ig-title" required placeholder="e.g. Solve Mechanics MCQs"></div>
    <div class="fg"><label>Description</label>
      <textarea id="ig-desc" placeholder="Detailed plan..."></textarea></div>
    <p class="form-section">Details</p>
    <div class="row2">
      <div class="fg"><label>Subject</label>
        <select id="ig-sub"><option value="">Select</option>${options(SUBJECTS)}</select></div>
      <div class="fg"><label>Type</label>
        <select id="ig-type">${options(GOAL_TYPES)}</select></div>
    </div>
    <div class="fg"><label>Related Topic</label>
      <input type="text" id="ig-topic" placeholder="e.g. Electrostatics"></div>
    <p class="form-section">Schedule</p>
    <div class="row3">
      <div class="fg"><label>Date (AD)</label>
        <input type="date" id="ig-date" required value="${t}">
        ${bsChip('ig-date')}</div>
      <div class="fg"><label>Start</label><input type="time" id="ig-start"></div>
      <div class="fg"><label>End</label><input type="time" id="ig-end"></div>
    </div>
    <div class="fg"><label>Priority</label>
      <select id="ig-pri">${options(PRIORITY, 'High')}</select></div>
    <div class="fg"><label>Notes</label>
      <input type="text" id="ig-notes" placeholder="Extra reminders"></div>
  `, () => db.addGoal({
    title: val('ig-title'), description: val('ig-desc'), subject: val('ig-sub'),
    goalType: val('ig-type'), relatedTopic: val('ig-topic'), goalDate: val('ig-date'),
    startTime: val('ig-start'), endTime: val('ig-end'), priority: val('ig-pri'), notes: val('ig-notes')
  }));
  requestAnimationFrame(() => attachChip('ig-date'));
}

function renderGoals() {
  const el = sel('goals-list');
  if (!el) return;
  const list = db.getGoals(true);
  if (!list.length) { el.innerHTML = empty('task_alt', 'All caught up!'); return; }
  el.innerHTML = list.map(g => `
    <div class="list-item">
      <div class="list-item-row">
        <div style="flex:1;">
          <div class="list-item-row" style="gap:6px;margin-bottom:4px;">
            <h4>${g.title}</h4>${priBadge(g.priority)}
          </div>
          ${g.description ? `<p>${g.description}</p>` : ''}
          <p style="margin-top:4px;"><b>${g.goalType || 'Goal'}</b> · ${g.subject || '—'} · ${fd(g.goalDate)}</p>
          ${g.relatedTopic ? `<p style="margin-top:3px;">Topic: ${g.relatedTopic}</p>` : ''}
        </div>
        <div style="display:flex;gap:4px;">
          <button class="check-btn" onclick="toggleGoal(${g.id})">
            <span class="material-symbols-rounded">check_circle_outline</span>
          </button>
          <button class="delete-btn" onclick="deleteGoal(${g.id})" title="Delete Goal">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
      </div>
    </div>`).join('');
}

/* ── BACKLOG ─────────────────────────────────────── */
function openAddBacklog() {
  openModal('Add Backlog Item', `
    <div class="fg"><label>Title</label>
      <input type="text" id="ib-title" required placeholder="e.g. Missed NLM lecture"></div>
    <div class="row2">
      <div class="fg"><label>Subject</label>
        <select id="ib-sub"><option value="">Select</option>${options(SUBJECTS)}</select></div>
      <div class="fg"><label>Priority</label>
        <select id="ib-pri">${options(PRIORITY, 'Medium')}</select></div>
    </div>
  `, () => db.addBacklog({ title: val('ib-title'), subject: val('ib-sub'), priority: val('ib-pri') }));
}

function renderBacklogs() {
  const el = sel('backlog-list');
  if (!el) return;
  const list = db.getBacklogs();
  if (!list.length) { el.innerHTML = empty('pending_actions', 'Backlog is clear!'); return; }
  el.innerHTML = list.map(i => `
    <div class="list-item">
      <div class="list-item-row">
        <div><h4>${i.title}</h4>${i.subject ? `<p>${i.subject}</p>` : ''}</div>
        <div style="display:flex;align-items:center;gap:4px;">
          ${priBadge(i.priority || 'Medium')}
          <button class="check-btn" onclick="toggleBacklog(${i.id})">
            <span class="material-symbols-rounded">check_circle_outline</span>
          </button>
          <button class="delete-btn" onclick="deleteBacklog(${i.id})" title="Delete Backlog">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
      </div>
    </div>`).join('');
}

/* ── REVISIONS ───────────────────────────────────── */
function openAddRevision() {
  const t = today();
  openModal('Schedule Revision', `
    <div class="fg"><label>Topic</label>
      <input type="text" id="ir-topic" required placeholder="e.g. Organic Chemistry"></div>
    <div class="row2">
      <div class="fg"><label>Subject</label>
        <select id="ir-sub"><option value="">Select</option>${options(SUBJECTS)}</select></div>
      <div class="fg"><label>Revision Date (AD)</label>
        <input type="date" id="ir-date" required value="${t}">
        ${bsChip('ir-date')}</div>
    </div>
  `, () => db.addRevision({ topic: val('ir-topic'), subject: val('ir-sub'), revisionDate: val('ir-date') }));
  requestAnimationFrame(() => attachChip('ir-date'));
}

function renderRevisions() {
  const el = sel('revisions-list');
  if (!el) return;
  const list = db.getRevisions();
  if (!list.length) { el.innerHTML = empty('sync', 'No pending revisions!'); return; }
  el.innerHTML = list.map(i => `
    <div class="list-item">
      <div class="list-item-row">
        <div><h4>${i.topic}</h4><p>${i.subject || ''} · ${fd(i.revisionDate)}</p></div>
        <div style="display:flex;gap:4px;">
          <button class="check-btn" onclick="toggleRevision(${i.id})">
            <span class="material-symbols-rounded">check_circle_outline</span>
          </button>
          <button class="delete-btn" onclick="deleteRevision(${i.id})" title="Delete Revision">
            <span class="material-symbols-rounded">delete</span>
          </button>
        </div>
      </div>
    </div>`).join('');
}

/* ── global toggles ──────────────────────────────── */
window.toggleGoal = id => { db.toggleGoal(id); renderGoals(); renderDashboard(); renderAnalytics(); };
window.toggleBacklog = id => {
  const d = db.data; const i = d.backlogs.find(b => b.id === id);
  if (i) i.resolved = true; db.save(d); renderBacklogs(); renderAnalytics();
};
window.toggleRevision = id => {
  const d = db.data; const i = d.revisions.find(r => r.id === id);
  if (i) i.revised = true; db.save(d); renderRevisions(); renderAnalytics();
};
window.deleteClass = id => {
  if (confirm('Are you sure you want to delete this class log?')) {
    db.deleteClass(id); renderClasses(); renderDashboard(); renderAnalytics();
  }
};
window.deleteGoal = id => {
  if (confirm('Are you sure you want to delete this goal?')) {
    db.deleteGoal(id); renderGoals(); renderDashboard(); renderAnalytics();
  }
};
window.deleteBacklog = id => {
  if (confirm('Are you sure you want to delete this backlog item?')) {
    db.deleteBacklog(id); renderBacklogs(); renderDashboard(); renderAnalytics();
  }
};
window.deleteRevision = id => {
  if (confirm('Are you sure you want to delete this scheduled revision?')) {
    db.deleteRevision(id); renderRevisions(); renderDashboard(); renderAnalytics();
  }
};
window.openAddBacklog = openAddBacklog;
window.openAddRevision = openAddRevision;
