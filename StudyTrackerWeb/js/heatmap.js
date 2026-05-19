/* ─────────────────────────────────────────────────
   heatmap.js  –  productivity scoring + heatmap grid
   ───────────────────────────────────────────────── */

/* ── scoring config ─────────────────────────────── */
const SCORE_CLASS = 2;
const SCORE_GOAL = 3;
const SCORE_REVISION = 2;
const SCORE_BACKLOG = 1;

/*  score → heat level (0–4) */
function scoreToLevel(s) {
    if (s <= 0) return 0;
    if (s <= 2) return 1;
    if (s <= 5) return 2;
    if (s <= 9) return 3;
    return 4;
}

/* ── date helpers ─────────────────────────────────*/
function dateStr(d) { return d.toISOString().split('T')[0]; }

function addDays(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
}

/* ── compute a full year of DailyProgress ──────── */
function computeYearlyProgress() {
    const data = db.data;
    const endD = new Date();
    const startD = addDays(endD, -364);

    // index every entity by date
    const classByDate = {};
    const goalByDate = {};
    const revByDate = {};
    const backlogByDate = {};

    data.classes.forEach(c => {
        const k = c.classDate;
        if (!classByDate[k]) classByDate[k] = [];
        classByDate[k].push(c);
    });
    data.goals.forEach(g => {
        const k = g.goalDate;
        if (!goalByDate[k]) goalByDate[k] = [];
        goalByDate[k].push(g);
    });
    data.revisions.forEach(r => {
        const k = r.revisionDate;
        if (!revByDate[k]) revByDate[k] = [];
        revByDate[k].push(r);
    });
    data.backlogs.forEach(b => {
        const k = dateStr(new Date(b.id));  // id is Date.now()
        if (!backlogByDate[k]) backlogByDate[k] = [];
        backlogByDate[k].push(b);
    });

    const map = {};   // date-string → DailyProgress object

    for (let d = new Date(startD); d <= endD; d = addDays(d, 1)) {
        const k = dateStr(d);
        const classes = classByDate[k] || [];
        const goals = goalByDate[k] || [];
        const revisions = revByDate[k] || [];
        const backlogs = backlogByDate[k] || [];

        const attendedClasses = classes.length;
        const completedGoals = goals.filter(g => g.status === 'Completed').length;
        const completedRevisions = revisions.filter(r => r.revised).length;
        const resolvedBacklogs = backlogs.filter(b => b.resolved).length;
        const pendingGoals = goals.filter(g => g.status !== 'Completed' && g.status !== 'Skipped').length;

        const score =
            attendedClasses * SCORE_CLASS +
            completedGoals * SCORE_GOAL +
            completedRevisions * SCORE_REVISION +
            resolvedBacklogs * SCORE_BACKLOG;

        const studyMinutes = classes.reduce((acc, c) => {
            if (c.startTime && c.endTime) {
                const [sh, sm] = c.startTime.split(':').map(Number);
                const [eh, em] = c.endTime.split(':').map(Number);
                return acc + Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
            }
            return acc;
        }, 0);

        map[k] = {
            date: k,
            totalStudyMinutes: studyMinutes,
            attendedClasses,
            completedGoals,
            completedRevisions,
            pendingGoals,
            backlogCount: backlogs.length,
            productivityScore: score,
            level: scoreToLevel(score)
        };
    }
    return map;
}

/* ── streak computation ──────────────────────────── */
function computeStreaks(map) {
    const endD = new Date();
    let current = 0, longest = 0, run = 0;

    // current streak — walk backwards from today
    for (let d = new Date(endD); ; d = addDays(d, -1)) {
        const k = dateStr(d);
        if (map[k] && map[k].productivityScore > 0) { current++; }
        else break;
        // stop after 365 days
        if (current > 365) break;
    }

    // longest streak — walk forward through whole year
    const startD = addDays(endD, -364);
    for (let d = new Date(startD); d <= endD; d = addDays(d, 1)) {
        const k = dateStr(d);
        if (map[k] && map[k].productivityScore > 0) {
            run++;
            if (run > longest) longest = run;
        } else {
            run = 0;
        }
    }

    return { current, longest };
}

/* ── monthly consistency ─────────────────────────── */
function computeMonthlyConsistency(map) {
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let active = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        const k = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (map[k] && map[k].productivityScore > 0) active++;
    }
    return Math.round((active / daysInMonth) * 100);
}

/* ── build display-ready week columns ───────────── */
function buildWeeks() {
    const endD = new Date();
    // go back to Monday of current week, then 52 full weeks
    const dow = endD.getDay();   // 0=Sun
    const msSun = endD - dow * 86400000;       // start of current week (Sun)
    const startD = new Date(msSun - 51 * 7 * 86400000); // 52 weeks ago

    const weeks = [];
    let col = [];
    for (let d = new Date(startD); d <= endD; d = addDays(d, 1)) {
        if (d.getDay() === 0 && col.length) { weeks.push(col); col = []; }
        col.push(dateStr(d));
    }
    if (col.length) weeks.push(col);
    return weeks;
}

/* ── month label positions ───────────────────────── */
function buildMonthLabels(weeks) {
    const pref = (typeof db !== 'undefined' && db.getSettings) ? db.getSettings().dateDisplay : 'both';
    const labels = [];
    let lastVal = -1;

    weeks.forEach((col, i) => {
        let label = '';
        if (pref === 'ad') {
            const firstDate = new Date(col[0]);
            const currentVal = firstDate.getMonth();
            if (currentVal !== lastVal) {
                label = firstDate.toLocaleString('default', { month: 'short' });
                lastVal = currentVal;
            }
        } else {
            const bs = (typeof NepaliCal !== 'undefined') ? NepaliCal.adToBS(col[0]) : null;
            if (bs) {
                const currentVal = bs.month;
                if (currentVal !== lastVal) {
                    label = NepaliCal.MONTH_ABBR[bs.month];
                    lastVal = currentVal;
                }
            } else {
                const currentVal = new Date(col[0]).getMonth();
                if (currentVal !== lastVal) {
                    label = new Date(col[0]).toLocaleString('default', { month: 'short' });
                    lastVal = currentVal;
                }
            }
        }
        labels.push({ col: i, label });
    });
    return labels;
}

/* ── FULL HEATMAP RENDER ─────────────────────────── */
function renderHeatmap(containerId, compact = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const progressMap = computeYearlyProgress();
    const weeks = buildWeeks();
    const monthLabels = buildMonthLabels(weeks);

    if (compact) {
        // Mini heatmap: last 16 weeks only, no labels, smaller cells
        const recent = weeks.slice(-16);
        const rows = 7;
        let html = '';
        for (let r = 0; r < rows; r++) {
            html += '<div class="mini-heatmap-row">';
            recent.forEach(wk => {
                const ds = wk[r];
                const lv = ds ? (progressMap[ds] || { level: 0 }).level : 0;
                html += `<div class="mini-cell heat-${lv}" title="${ds || ''}"></div>`;
            });
            html += '</div>';
        }
        container.innerHTML = html;
        return;
    }

    // Full heatmap
    // month label row
    let monthRow = '<div class="heatmap-months">';
    monthLabels.forEach(({ label }) => {
        monthRow += `<div class="month-label">${label}</div>`;
    });
    monthRow += '</div>';

    // grid columns
    let gridHtml = '<div class="heatmap-grid">';
    weeks.forEach((wk, wi) => {
        gridHtml += '<div class="heatmap-col">';
        wk.forEach(ds => {
            const lv = (progressMap[ds] || { level: 0 }).level;
            gridHtml += `<div class="heatmap-cell heat-${lv}"
        data-date="${ds}" data-level="${lv}"
        title="${ds}"></div>`;
        });
        gridHtml += '</div>';
    });
    gridHtml += '</div>';

    container.innerHTML = monthRow + gridHtml;

    // attach click handlers
    container.querySelectorAll('.heatmap-cell').forEach(cell => {
        cell.addEventListener('click', () => showDayDetail(cell.dataset.date, progressMap));
    });
}

/* ── day detail popup ────────────────────────────── */
function showDayDetail(date, map) {
    const old = document.getElementById('day-popup');
    if (old) old.remove();

    const p = map[date] || {
        productivityScore: 0, attendedClasses: 0, completedGoals: 0,
        completedRevisions: 0, totalStudyMinutes: 0, pendingGoals: 0
    };

    // Dual-date heading
    const adFmt = new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    const bs = (typeof NepaliCal !== 'undefined') ? NepaliCal.adToBS(date) : null;
    const bsFmt = bs ? bs.formatted : '';
    const pref = (typeof db !== 'undefined' && db.getSettings) ? db.getSettings().dateDisplay : 'both';
    let heading = adFmt;
    if (pref === 'bs') heading = bsFmt || adFmt;
    if (pref === 'both' && bsFmt) heading = `${bsFmt}<br><span style="font-weight:400;font-size:12px;color:var(--text-2)">${adFmt}</span>`;

    const popup = document.createElement('div');
    popup.id = 'day-popup';
    popup.className = 'day-popup';
    popup.innerHTML = `
    <button class="popup-close" onclick="document.getElementById('day-popup').remove()">
      <span class="material-symbols-rounded">close</span>
    </button>
    <h3>${heading}</h3>
    <p>Classes attended <span>${p.attendedClasses}</span></p>
    <p>Goals completed <span>${p.completedGoals}</span></p>
    <p>Revisions done <span>${p.completedRevisions}</span></p>
    <p>Study time <span>${p.totalStudyMinutes ? p.totalStudyMinutes + ' min' : '—'}</span></p>
    <p>Pending goals <span>${p.pendingGoals}</span></p>
    <p style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
      Productivity score <span style="color:var(--accent);font-size:16px;">${p.productivityScore}</span>
    </p>`;

    document.getElementById('app-container').appendChild(popup);

    setTimeout(() => {
        document.addEventListener('click', function dismiss(e) {
            if (!popup.contains(e.target)) { popup.remove(); document.removeEventListener('click', dismiss); }
        });
    }, 50);
}

/* ── analytics stats render ─────────────────────── */
function renderAnalyticsStats(containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const map = computeYearlyProgress();
    const { current, longest } = computeStreaks(map);
    const consistency = computeMonthlyConsistency(map);
    const totalDays = Object.values(map).filter(d => d.productivityScore > 0).length;

    el.innerHTML = `
    <div class="a-card">
      <div class="a-label">Streak</div>
      <div class="a-value">${current}</div>
      <div class="a-unit">days</div>
    </div>
    <div class="a-card">
      <div class="a-label">Best</div>
      <div class="a-value">${longest}</div>
      <div class="a-unit">days</div>
    </div>
    <div class="a-card">
      <div class="a-label">This Month</div>
      <div class="a-value">${consistency}%</div>
      <div class="a-unit">active</div>
    </div>`;
}
