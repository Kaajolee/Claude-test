// 1. Configuration
window.alertDelaySeconds = 60;
window.soundEnabled = true;
window.activeEntries = window.activeEntries || new Map();
window.audioCtx = window.audioCtx || new (window.AudioContext || window.webkitAudioContext)();

// 2. Inject Persistent CSS (This creates the timer look without breaking the DOM)
if (!document.getElementById('automation-styles')) {
    const style = document.createElement('style');
    style.id = 'automation-styles';
    style.innerHTML = `
        tr[data-timer-text]::after {
            content: attr(data-timer-text);
            position: absolute;
            right: 20px;
            background: #444;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-family: monospace;
            font-weight: bold;
            font-size: 14px;
            z-index: 10;
            pointer-events: none;
        }
        tr[data-overdue="true"] {
            background-color: rgba(255, 0, 0, 0.15) !important;
            border-left: 6px solid red !important;
        }
        tr[data-overdue="true"]::after {
            background: red;
        }
    `;
    document.head.appendChild(style);
}

// 3. define alert tone
window.playChatBeep = function() {
    if (!window.soundEnabled) return;
    if (window.audioCtx.state === 'suspended') { window.audioCtx.resume(); }
    const osc = window.audioCtx.createOscillator();
    const gain = window.audioCtx.createGain();
    osc.connect(gain); gain.connect(window.audioCtx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, window.audioCtx.currentTime);
    gain.gain.setValueAtTime(0.1, window.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, window.audioCtx.currentTime + 0.8);
    osc.start(); osc.stop(window.audioCtx.currentTime + 0.8);
};

// Helper: a row has "no assignee" when the assignee column renders as an
// empty cell instead of `td[data-test-id="ticket-table-cells-assignee"]`.
window.rowHasNoAssignee = function(row) {
    return !row.querySelector('td[data-test-id="ticket-table-cells-assignee"]');
};

// 4. Main Logic
window.scanForNewBadges = function() {
    // "new" status chats are always unassigned, so track them all.
    const newBadges = document.querySelectorAll('div[data-test-id="status-badge-new"]');
    // "open" status chats only count when they have no assignee yet.
    const openBadges = document.querySelectorAll('div[data-test-id="status-badge-open"]');
    const seenThisPass = new Set();
    const now = Date.now();

    // Clear attributes from all rows first (cleanup for taken chats)
    document.querySelectorAll('tr[data-timer-text]').forEach(tr => {
        tr.removeAttribute('data-timer-text');
        tr.removeAttribute('data-overdue');
    });

    // Collect rows to track, deduped by row element.
    const rowsToTrack = new Set();

    newBadges.forEach(badge => {
        const row = badge.closest('tr');
        if (row) rowsToTrack.add(row);
    });

    openBadges.forEach(badge => {
        const row = badge.closest('tr');
        if (row && window.rowHasNoAssignee(row)) rowsToTrack.add(row);
    });

    rowsToTrack.forEach(row => {
        // We use the Ticket ID from the text or data-test-id to keep the ID stable
        const entryId = row.innerText.split('\n')[0].trim() || row.getAttribute('data-test-id');
        seenThisPass.add(entryId);

        // CASE 1: Brand New Detection
        if (!window.activeEntries.has(entryId)) {
            window.activeEntries.set(entryId, {
                detectedAt: now,
                alerted: false
            });
        }

        // CASE 2: Update Countdown State
        const entry = window.activeEntries.get(entryId);
        const elapsed = (now - entry.detectedAt) / 1000;
        const remaining = Math.max(0, window.alertDelaySeconds - elapsed).toFixed(0);

        // Apply visual state via attributes (stable against re-renders)
        row.setAttribute('data-timer-text', remaining + 's');

        if (remaining <= 0) {
            row.setAttribute('data-overdue', 'true');
            if (!entry.alerted) {
                window.playChatBeep();
                entry.alerted = true;
                console.log(`%c 🚨 BREACHED: ${entryId}`, 'color: red; font-weight: bold;');
            }
        }
    });

    // Cleanup internal memory
    for (const [id, data] of window.activeEntries) {
        if (!seenThisPass.has(id)) {
            window.activeEntries.delete(id);
        }
    }
};

// 5. Execution
if (window.badgeMonitorLoop) { clearInterval(window.badgeMonitorLoop); }
window.badgeMonitorLoop = setInterval(window.scanForNewBadges, 1000);

// 6. Global Control Functions
window.setTimer = (s) => {
    window.alertDelaySeconds = parseFloat(s);
    window.activeEntries.forEach(v => v.alerted = false);
    console.log(`⏱️ Threshold updated to ${s}s`);
};
window.stopsound = () => { window.soundEnabled = false; console.log("🔇 Muted"); };
window.startsound = () => { window.soundEnabled = true; console.log("🔊 Unmuted"); };

console.log("%c ✅ Stable CSS-Overlay Monitor Active (new + unassigned open).", 'color: #3D9FE0; font-weight: bold;');
