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
    inner.style.background = 'radial-gradient(circle at 40% 36%, rgba(240,185,115,0.96) 0%, rgba(215,162,92,0.82) 22%, rgba(175,118,52,0.52) 48%, rgba(120,75,20,0.18) 70%, transparent 86%)';
    inner.style.boxShadow = '0 0 70px rgba(196,149,106,0.52), 0 0 130px rgba(196,149,106,0.24), inset 0 2px 4px rgba(255,220,150,0.26)';
  } else if (freshCount >= 2) {
    inner.style.background = 'radial-gradient(circle at 40% 36%, rgba(240,185,115,0.78) 0%, rgba(210,158,90,0.62) 22%, rgba(165,110,42,0.36) 50%, rgba(115,70,18,0.12) 72%, transparent 88%)';
    inner.style.boxShadow = '0 0 52px rgba(196,149,106,0.36), 0 0 95px rgba(196,149,106,0.15), inset 0 2px 3px rgba(255,210,130,0.18)';
  } else {
    inner.style.background = '';
    inner.style.boxShadow = '';
  }
}


// ── HORIZON WAVE ANIMATION — mirrors launch screen motion ──────────────
(function () {
  const W = 375, SEGS = 52;

  // Bell-curve base: y=36 at edges, y=22 at centre (same as the static SVG path)
  function baseY(x) {
    return 36 - 14 * Math.pow(Math.sin(Math.PI * x / W), 2);
  }

  // Sinusoidal wave overlay — three harmonics like the launch horizon
  function waveY(x, t, amp) {
    return baseY(x)
      + Math.sin(x * 0.016 + t * 0.00028) * amp
      + Math.sin(x * 0.027 - t * 0.00046) * amp * 0.45
      + Math.sin(x * 0.050 + t * 0.00019) * amp * 0.22;
  }

  // Build an SVG polyline path string
  function buildPath(t, amp) {
    let d = '';
    for (let i = 0; i <= SEGS; i++) {
      const x = (i / SEGS) * W;
      const y = waveY(x, t, amp);
      d += i === 0 ? `M${x.toFixed(1)},${y.toFixed(2)}` : ` L${x.toFixed(1)},${y.toFixed(2)}`;
    }
    return d;
  }

  // Amplitude driven by current mood (read live each frame)
  function getAmp() {
    const orb = document.getElementById('hero-orb-wrap');
    switch (orb && orb.dataset.mood) {
      case 'focused':     return 4.5;
      case 'fatigued':    return 1.0;
      case 'overwhelmed': return 0.5;
      default:            return 2.8;   // drifting / none
    }
  }

  let _raf = null;
  window.startHorizonWave = function () {
    const hPath = document.getElementById('horizon-path');
    const hFill = document.getElementById('horizon-fill');
    if (!hPath) return;
    if (_raf) cancelAnimationFrame(_raf);
    const t0 = performance.now();
    let prev = 0;
    function frame(now) {
      const dt = Math.min(now - (prev || now), 50); // clamp after tab switch
      void dt; prev = now;
      const t = now - t0;
      const amp = getAmp();
      const linePath = buildPath(t, amp);
      hPath.setAttribute('d', linePath);
      if (hFill) hFill.setAttribute('d', linePath + ` L${W},60 L0,60 Z`);
      _raf = requestAnimationFrame(frame);
    }
    _raf = requestAnimationFrame(frame);
  };
})();

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

  // Horizon living wave — starts immediately, invisible until CSS fade-in at 0.9s
  startHorizonWave();

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