// ═══════════════════════════════════════════════════════
// FORWARD v1.0 · Core Logic
// ═══════════════════════════════════════════════════════

// ── UTILS ─────────────────────────────────────────────────
function timeAgo(iso) {
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function esc(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2700);
}

// ── SWIPE NAVIGATION ─────────────────────────────────────
// Horizontal: Work ← Home → Plan
// Vertical on home: swipe up → reveal stats, swipe down → hide stats
const SCREEN_ORDER = ['work', 'home', 'projects'];
let statsRevealed = false;

function revealStats(show) {
  const drawer = document.getElementById('home-below-fold');
  if (!drawer) return;
  statsRevealed = show;
  if (show) drawer.classList.add('revealed');
  else drawer.classList.remove('revealed');
}

function initSwipe() {
  let startX = 0, startY = 0, startTime = 0;

  // Show the handle hint after 1.8s on home
  setTimeout(() => {
    const handle = document.getElementById('stats-handle');
    if (handle) handle.classList.add('visible');
  }, 1800);

  document.addEventListener('touchstart', e => {
    if (e.target.closest('#capture-sheet, .focus-overlay')) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (e.target.closest('#capture-sheet, .focus-overlay')) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    const dt = Date.now() - startTime;
    if (dt > 500) return; // too slow

    const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.4 && Math.abs(dx) > 55;
    const isVertical = Math.abs(dy) > Math.abs(dx) * 1.4 && Math.abs(dy) > 48;

    if (isHorizontal) {
      // Don't fire horizontal swipe on scrollable inbox list
      if (e.target.closest('.inbox-list')) return;
      const cur = S.screen;
      const idx = SCREEN_ORDER.indexOf(cur);
      // If stats drawer is open, first swipe closes it
      if (statsRevealed && cur === 'home') { revealStats(false); return; }
      if (dx < 0 && idx < SCREEN_ORDER.length - 1) showScreen(SCREEN_ORDER[idx + 1]);
      else if (dx > 0 && idx > 0) showScreen(SCREEN_ORDER[idx - 1]);
    }

    if (isVertical && S.screen === 'home') {
      if (dy < 0) revealStats(true);  // swipe up → show stats
      else revealStats(false);         // swipe down → hide stats
    }
  }, { passive: true });
}

// ── ORB PULSE INTENSITY — reflects inbox activity ──────────
function updateOrbPulse() {
  const wrap = document.getElementById('hero-orb-wrap');
  if (!wrap) return;
  const freshCount = items.filter(i => i.status === 'fresh').length;
  const inner = wrap.querySelector('.hero-orb-inner');
  if (!inner) return;
  // Scale glow with freshness — more fresh items = warmer, stronger orb
  if (freshCount >= 5) {
    inner.style.background = 'radial-gradient(circle at 40% 38%, rgba(196,149,106,0.52), rgba(196,149,106,0.1) 70%)';
    inner.style.boxShadow = '0 0 44px rgba(196,149,106,0.22), inset 0 1px 1px rgba(255,255,255,0.08)';
  } else if (freshCount >= 2) {
    inner.style.background = 'radial-gradient(circle at 40% 38%, rgba(196,149,106,0.38), rgba(196,149,106,0.08) 70%)';
    inner.style.boxShadow = '0 0 32px rgba(196,149,106,0.16), inset 0 1px 1px rgba(255,255,255,0.07)';
  } else {
    inner.style.background = '';
    inner.style.boxShadow = '';
  }
}


// ══════════════════════════════════════════════════════════
// ── INIT ──────────────────────────────────────────────────
function init() {
  load();
  loadProjects();
  runLifecycle();
  S.rewindSession = loadRewind();
  // Ensure projects screen exists
  if (!document.getElementById('screen-projects')) console.warn('screen-projects missing');

  // Ambient orbs
  setTimeout(() => document.querySelectorAll('.ambient-orb').forEach(o => o.classList.add('visible')), 450);

  renderHome();
  if (typeof updateAIKeyStatus === 'function') updateAIKeyStatus();
  document.body.classList.add('on-home');

  // Swipe navigation
  initSwipe();

  // Backup nudge — once, after 7 days of use
  if (items.length > 0) {
    const oldest = items[items.length - 1];
    const days = (Date.now() - new Date(oldest.createdAt)) / 86400000;
    if (days >= 7 && !localStorage.getItem('forward_backup_nudged')) {
      setTimeout(() => {
        showToast('Tip: back up your data in Settings');
        localStorage.setItem('forward_backup_nudged', '1');
      }, 3200);
    }
  }

  // Async IndexedDB load
  if (typeof loadFromIndexedDB === 'function') loadFromIndexedDB();

  // Smart Notifications init
  if (localStorage.getItem('forward_notifications') === 'true') {
    updateNotificationToggleUI(true);
    scheduleSmartNotifications();
  } else {
    updateNotificationToggleUI(false);
  }
}

// ── SMART NOTIFICATIONS ──────────────────────────────────
let _notifyInterval;

async function toggleNotifications() {
  const isEnabled = localStorage.getItem('forward_notifications') === 'true';

  if (isEnabled) {
    localStorage.removeItem('forward_notifications');
    updateNotificationToggleUI(false);
    clearInterval(_notifyInterval);
    showToast('Notifications disabled');
    return;
  }

  if (!('Notification' in window)) {
    showToast('Notifications not supported on this device');
    return;
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    localStorage.setItem('forward_notifications', 'true');
    updateNotificationToggleUI(true);
    scheduleSmartNotifications();

    // Test notification
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification('Forward', {
          body: 'Gentle reminders are now active.',
          icon: './icon-192.png',
          badge: './icon-192.png'
        });
      });
    }
  } else {
    showToast('Permission denied');
  }
}

function updateNotificationToggleUI(enabled) {
  const statusEl = document.getElementById('setting-notify-status');
  if (statusEl) {
    statusEl.textContent = enabled ? '● on' : '○ off';
    statusEl.style.color = enabled ? 'var(--teal)' : 'var(--text-muted)';
  }
}

function scheduleSmartNotifications() {
  clearInterval(_notifyInterval);
  // Check every hour
  _notifyInterval = setInterval(checkNotificationTriggers, 60 * 60 * 1000);
  // Also check immediately on boot (with a slight delay)
  setTimeout(checkNotificationTriggers, 5000);
}

function checkNotificationTriggers() {
  if (localStorage.getItem('forward_notifications') !== 'true') return;

  const now = new Date();

  // 1. Sunday Review Nudge (Sundays between 9am and 8pm)
  if (now.getDay() === 0 && now.getHours() >= 9 && now.getHours() <= 20) {
    const lastReviewNudge = localStorage.getItem('forward_last_review_nudge');
    const todayStr = now.toISOString().slice(0, 10);

    if (lastReviewNudge !== todayStr) {
      sendLocalNotification('Your Week', 'Your weekly review is ready. Tap to reflect on what moved.');
      localStorage.setItem('forward_last_review_nudge', todayStr);
      return; // Only one notification per check cluster
    }
  }

  // 2. Stale Project Nudge (If haven't nudged today)
  const lastStaleNudge = localStorage.getItem('forward_last_stale_nudge');
  const todayStr = now.toISOString().slice(0, 10);

  if (lastStaleNudge !== todayStr) {
    const staleProjects = projects.filter(p => {
      if (p.status === 'archived') return false;
      const touched = p.touchedAt ? new Date(p.touchedAt).getTime() : new Date(p.createdAt).getTime();
      return (Date.now() - touched) > 7 * 86400000;
    });

    if (staleProjects.length > 0) {
      const p = staleProjects[0]; // Just nudge about one
      sendLocalNotification('Stale Project', `"${p.name}" hasn't been touched in a week. Drop it or pick a tiny next step?`);
      localStorage.setItem('forward_last_stale_nudge', todayStr);
    }
  }
}

function sendLocalNotification(title, body) {
  if ('serviceWorker' in navigator && Notification.permission === 'granted') {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, {
        body: body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        vibrate: [100, 50, 100],
        tag: 'forward-nudge' // Replaces old nudges
      });
    });
  }
}

init();