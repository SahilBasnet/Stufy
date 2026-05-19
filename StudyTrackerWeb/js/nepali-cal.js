/* ─────────────────────────────────────────────────────────────────
   nepali-cal.js  —  Bikram Sambat ↔ Gregorian conversion
   Self-contained, no external dependencies.
   ───────────────────────────────────────────────────────────────── */

const NepaliCal = (() => {

    /* ── Month names ─────────────────────────────────────────────── */
    const MONTH_NAMES = [
        '', // 1-based index
        'Baisakh', 'Jestha', 'Ashadh', 'Shrawan',
        'Bhadra', 'Ashwin', 'Kartik', 'Mangsir',
        'Poush', 'Magh', 'Falgun', 'Chaitra'
    ];
    const MONTH_ABBR = [
        '',
        'Bai', 'Jes', 'Ash', 'Shr',
        'Bha', 'Asw', 'Kar', 'Man',
        'Pou', 'Mag', 'Fal', 'Cha'
    ];

    /* ── BS month-day table ──────────────────────────────────────────
       Each row: [year, m1,m2,m3,m4,m5,m6,m7,m8,m9,m10,m11,m12]
       Source: established Bikram Sambat reference tables.
    ─────────────────────────────────────────────────────────────── */
    const BS_DATA = [
        [2060, 30, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 31],
        [2061, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
        [2062, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
        [2063, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
        [2064, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
        [2065, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
        [2066, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
        [2067, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
        [2068, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
        [2069, 31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
        [2070, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
        [2071, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
        [2072, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
        [2073, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
        [2074, 31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
        [2075, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
        [2076, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
        [2077, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
        [2078, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
        [2079, 31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
        [2080, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
        [2081, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
        [2082, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
        [2083, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
        [2084, 31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
        [2085, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
        [2086, 31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
        [2087, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
        [2088, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
        [2089, 31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
        [2090, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
        [2091, 31, 31, 32, 32, 31, 30, 30, 29, 30, 29, 30, 30],
        [2092, 31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
        [2093, 31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
        [2094, 31, 31, 31, 32, 31, 31, 29, 30, 30, 29, 29, 31],
        [2095, 31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
    ];

    // Index by year for O(1) lookup
    const BS_MAP = {};
    BS_DATA.forEach(row => { BS_MAP[row[0]] = row.slice(1); });

    const BS_START_YEAR = 2060;
    const BS_END_YEAR = 2095;

    /* Reference: BS 2060 Baisakh 01 = AD 2003 April 14 */
    const REF_AD = new Date(2003, 3, 14);   // JS months 0-indexed
    const REF_BS = { year: 2060, month: 1, day: 1 };

    /* Total days in a BS year */
    function daysInBSYear(y) {
        const months = BS_MAP[y];
        if (!months) return 365;
        return months.reduce((a, b) => a + b, 0);
    }

    /* Total days from REF_BS to a given BS date */
    function daysSinceRefBS(year, month, day) {
        let days = 0;
        for (let y = REF_BS.year; y < year; y++) days += daysInBSYear(y);
        const months = BS_MAP[year];
        if (months) {
            for (let m = 1; m < month; m++) days += months[m - 1];
        }
        days += (day - REF_BS.day);
        return days;
    }

    /* ── adToBS ──────────────────────────────────────────────────── */
    function adToBS(adDateStr) {
        if (!adDateStr) return null;
        const [y, m, d] = adDateStr.split('-').map(Number);
        const adDate = new Date(y, m - 1, d);
        const diffMs = adDate - REF_AD;
        let remaining = Math.round(diffMs / 86400000) + 1; // days since ref

        let bsYear = REF_BS.year;
        // advance years
        while (remaining > daysInBSYear(bsYear)) {
            remaining -= daysInBSYear(bsYear);
            bsYear++;
            if (bsYear > BS_END_YEAR) break;
        }
        const months = BS_MAP[bsYear] || Array(12).fill(30);
        let bsMonth = 1;
        while (remaining > months[bsMonth - 1]) {
            remaining -= months[bsMonth - 1];
            bsMonth++;
            if (bsMonth > 12) break;
        }
        const bsDay = remaining;
        return {
            year: bsYear,
            month: bsMonth,
            day: bsDay,
            monthName: MONTH_NAMES[bsMonth] || '',
            formatted: `${bsYear} ${MONTH_NAMES[bsMonth]} ${String(bsDay).padStart(2, '0')}`
        };
    }

    /* ── bsToAD ──────────────────────────────────────────────────── */
    function bsToAD(year, month, day) {
        const totalDays = daysSinceRefBS(year, month, day);
        const adDate = new Date(REF_AD);
        adDate.setDate(adDate.getDate() + totalDays - 1);
        const y = adDate.getFullYear();
        const m = String(adDate.getMonth() + 1).padStart(2, '0');
        const d = String(adDate.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    /* ── formatters ──────────────────────────────────────────────── */
    function formatAD(adDateStr) {
        if (!adDateStr) return '—';
        const [y, m, d] = adDateStr.split('-').map(Number);
        const dt = new Date(y, m - 1, d);
        return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' });
    }

    function formatBS(adDateStr) {
        const bs = adToBS(adDateStr);
        if (!bs) return '—';
        return bs.formatted;
    }

    function formatBoth(adDateStr) {
        const bs = adToBS(adDateStr);
        if (!bs) return adDateStr || '—';
        return `${bs.formatted} (${formatAD(adDateStr)})`;
    }

    /* ── todayBS ─────────────────────────────────────────────────── */
    function todayBS() {
        const today = new Date();
        const iso = today.toISOString().split('T')[0];
        return adToBS(iso);
    }

    /* ── formatDate: respects global setting ─────────────────────── */
    function formatDate(adDateStr) {
        const pref = (db && db.getSettings) ? db.getSettings().dateDisplay : 'both';
        if (pref === 'bs') return formatBS(adDateStr);
        if (pref === 'ad') return formatAD(adDateStr);
        return formatBoth(adDateStr);
    }

    /* ── datePicker helper ───────────────────────────────────────────
       Call attachBSPreview('my-input-id', 'preview-chip-id') after
       inserting the form into the DOM.
    ─────────────────────────────────────────────────────────────── */
    function attachBSPreview(inputId, chipId) {
        const input = document.getElementById(inputId);
        const chip = document.getElementById(chipId);
        if (!input || !chip) return;
        const update = () => {
            const bs = adToBS(input.value);
            chip.textContent = bs ? `BS: ${bs.formatted}` : '';
        };
        input.addEventListener('change', update);
        input.addEventListener('input', update);
        update();
    }

    return {
        adToBS,
        bsToAD,
        formatAD,
        formatBS,
        formatBoth,
        formatDate,
        todayBS,
        attachBSPreview,
        MONTH_NAMES,
        MONTH_ABBR
    };
})();
