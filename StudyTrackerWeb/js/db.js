// db.js: Offline storage layer — localStorage + dual date (BS + AD)

const DB_KEY = 'study_tracker_db';
const SETTINGS_KEY = 'study_tracker_settings';

const defaultSchema = {
    classes: [],
    goals: [],
    backlogs: [],
    revisions: [],
    dailyProgress: []
};

const defaultSettings = {
    dateDisplay: 'both'   // 'bs' | 'ad' | 'both'
};

class LocalDB {
    constructor() { this._init(); }

    _init() {
        if (!localStorage.getItem(DB_KEY)) localStorage.setItem(DB_KEY, JSON.stringify(defaultSchema));
        if (!localStorage.getItem(SETTINGS_KEY)) localStorage.setItem(SETTINGS_KEY, JSON.stringify(defaultSettings));
    }

    get data() { return JSON.parse(localStorage.getItem(DB_KEY)); }
    save(data) { localStorage.setItem(DB_KEY, JSON.stringify(data)); }

    // ── Settings ──────────────────────────────────────────────────
    getSettings() { return JSON.parse(localStorage.getItem(SETTINGS_KEY)); }
    saveSettings(s) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); }

    // ── BS helper (safe: NepaliCal may not be loaded yet) ─────────
    _bs(adDate) {
        if (!adDate || typeof NepaliCal === 'undefined') return null;
        const bs = NepaliCal.adToBS(adDate);
        return bs ? bs.formatted : null;
    }

    // ── Classes ───────────────────────────────────────────────────
    getClasses() {
        return this.data.classes.sort((a, b) => new Date(b.classDate) - new Date(a.classDate));
    }

    addClass(entry) {
        const d = this.data;
        entry.id = Date.now();
        entry.englishDate = entry.classDate;
        entry.nepaliDate = this._bs(entry.classDate);
        entry.createdAt = new Date().toISOString();
        entry.updatedAt = entry.createdAt;
        d.classes.push(entry);
        this.save(d);
    }

    deleteClass(id) {
        const d = this.data;
        d.classes = d.classes.filter(c => c.id !== id);
        this.save(d);
    }

    // ── Goals ─────────────────────────────────────────────────────
    getGoals(pendingOnly = false) {
        const score = { Critical: 1, High: 2, Medium: 3, Low: 4 };
        let goals = this.data.goals.sort((a, b) => (score[a.priority] || 3) - (score[b.priority] || 3));
        if (pendingOnly) goals = goals.filter(g => g.status !== 'Completed' && g.status !== 'Skipped');
        return goals;
    }

    addGoal(goal) {
        const d = this.data;
        goal.id = Date.now();
        goal.status = 'Pending';
        goal.progressPercentage = 0;
        goal.englishDate = goal.goalDate;
        goal.nepaliDate = this._bs(goal.goalDate);
        goal.createdAt = new Date().toISOString();
        goal.updatedAt = goal.createdAt;
        d.goals.push(goal);
        this.save(d);
    }

    toggleGoal(id) {
        const d = this.data;
        const g = d.goals.find(g => g.id === id);
        if (g) {
            g.status = (g.status === 'Completed') ? 'Pending' : 'Completed';
            g.progressPercentage = g.status === 'Completed' ? 100 : 0;
            g.updatedAt = new Date().toISOString();
        }
        this.save(d);
    }

    deleteGoal(id) {
        const d = this.data;
        d.goals = d.goals.filter(g => g.id !== id);
        this.save(d);
    }

    // ── Backlogs ──────────────────────────────────────────────────
    getBacklogs() {
        return this.data.backlogs.filter(b => !b.resolved).sort((a, b) => {
            const score = { Critical: 1, High: 2, Medium: 3, Low: 4 };
            return (score[a.priority] || 3) - (score[b.priority] || 3);
        });
    }

    addBacklog(item) {
        const d = this.data;
        const today = new Date().toISOString().split('T')[0];
        item.id = Date.now();
        item.resolved = false;
        item.englishDate = today;
        item.nepaliDate = this._bs(today);
        d.backlogs.push(item);
        this.save(d);
    }

    deleteBacklog(id) {
        const d = this.data;
        d.backlogs = d.backlogs.filter(b => b.id !== id);
        this.save(d);
    }

    // ── Revisions ─────────────────────────────────────────────────
    getRevisions() {
        return this.data.revisions.filter(r => !r.revised).sort((a, b) =>
            new Date(a.revisionDate) - new Date(b.revisionDate));
    }

    addRevision(rev) {
        const d = this.data;
        rev.id = Date.now();
        rev.revised = false;
        rev.englishDate = rev.revisionDate;
        rev.nepaliDate = this._bs(rev.revisionDate);
        d.revisions.push(rev);
        this.save(d);
    }

    deleteRevision(id) {
        const d = this.data;
        d.revisions = d.revisions.filter(r => r.id !== id);
        this.save(d);
    }

    // ── Dashboard stats ───────────────────────────────────────────
    getDashboardStats() {
        const todayStr = new Date().toISOString().split('T')[0];
        return {
            pendingGoalsCount: this.getGoals(true).length,
            classesTodayCount: this.getClasses().filter(c => c.classDate === todayStr).length
        };
    }
}

const db = new LocalDB();
