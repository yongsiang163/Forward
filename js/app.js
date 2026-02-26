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
    }

    init();
  </script>

  <!-- PROJECT DETAIL SHEET -->
  <div class="project-sheet" id="project-sheet">
    <div class="project-sheet-modal">
      <div class="project-sheet-handle"></div>
      <div class="project-sheet-scroll">

        <!-- Name -->
        <div class="project-sheet-section">
          <p class="project-sheet-eyebrow">Project</p>
          <input class="project-sheet-name" id="ps-name" type="text" placeholder="Project name" />
        </div>

        <!-- Vision — locked -->
        <div class="project-sheet-section">
          <p class="project-sheet-eyebrow">The Vision</p>
          <div class="project-vision-text" id="ps-vision"></div>
          <p class="project-vision-locked">captured when you believed in this · cannot be edited</p>
        </div>

        <!-- Phase -->
        <div class="project-sheet-section">
          <p class="project-sheet-eyebrow">Phase</p>
          <div class="phase-pills">
            <button class="phase-pill-btn" data-phase="concept" onclick="setProjectPhase('concept')">Concept</button>
            <button class="phase-pill-btn" data-phase="development"
              onclick="setProjectPhase('development')">Development</button>
            <button class="phase-pill-btn" data-phase="procurement"
              onclick="setProjectPhase('procurement')">Procurement</button>
            <button class="phase-pill-btn" data-phase="site" onclick="setProjectPhase('site')">Site</button>
            <button class="phase-pill-btn" data-phase="delivery" onclick="setProjectPhase('delivery')">Delivery</button>
          </div>
        </div>

        <!-- Next action -->
        <div class="project-sheet-section">
          <p class="project-sheet-eyebrow">Next Action</p>
          <input class="project-input" id="ps-next-action" type="text" placeholder="The one small next step…" />
        </div>

        <!-- Notes -->
        <div class="project-sheet-section">
          <p class="project-sheet-eyebrow">Notes</p>
          <textarea class="project-input" id="ps-notes" rows="4" placeholder="Anything else worth holding…"></textarea>
        </div>

        <button class="project-save-btn" onclick="saveProjectSheet()">Save</button>
      </div>
    </div>
    <div style="flex:1" onclick="closeProjectSheet()"></div>
  </div>

  <!-- NEW PROJECT SHEET — 2 steps -->
  <div class="new-project-sheet" id="new-project-sheet">
    <div class="new-project-modal">
      <div class="new-project-handle"></div>

      <!-- Step 1: Name + Category + Vision -->
      <div class="new-project-step active" id="np-step-1">
        <p class="new-project-label">New Project — Step 1 of 2</p>
        <p class="new-project-title">Name it, place it, capture the vision</p>
        <input class="project-input" id="np-name" type="text" placeholder="Project name…" style="margin-bottom:14px" />
        <div class="np-category-grid" id="np-category-grid">
          <button class="np-cat-btn active" data-npcat="idwork" onclick="npSetCat('idwork')">
            <div class="np-cat-btn-name">ID Work</div>
            <div class="np-cat-btn-desc">Interior design project</div>
          </button>
          <button class="np-cat-btn" data-npcat="life" onclick="npSetCat('life')">
            <div class="np-cat-btn-name">Life</div>
            <div class="np-cat-btn-desc">Personal, family, home</div>
          </button>
          <button class="np-cat-btn" data-npcat="business" onclick="npSetCat('business')">
            <div class="np-cat-btn-name">Business</div>
            <div class="np-cat-btn-desc">Ideas, ventures, freelance</div>
          </button>
          <button class="np-cat-btn" data-npcat="learning" onclick="npSetCat('learning')">
            <div class="np-cat-btn-name">Learning</div>
            <div class="np-cat-btn-desc">Courses, skills, reading</div>
          </button>
          <button class="np-cat-btn" data-npcat="open" onclick="npSetCat('open')" style="grid-column:span 2">
            <div class="np-cat-btn-name">Open</div>
            <div class="np-cat-btn-desc">I'll define my own path</div>
          </button>
        </div>
        <textarea class="project-input" id="np-vision" rows="3"
          placeholder="What did you see when you believed in this? Capture it now, while it's alive…"
          style="margin-top:14px"></textarea>
        <button class="new-project-next" onclick="npNextStep()">Next →</button>
        <button class="new-project-back" onclick="closeNewProject()">Cancel</button>
      </div>

      <!-- Step 2: Phase -->
      <div class="new-project-step" id="np-step-2">
        <p class="new-project-label">New Project — Step 2 of 2</p>
        <p class="new-project-title">Where is it right now?</p>
        <div class="phase-pills" id="np-phase-pills">
          <button class="phase-pill-btn" data-phase="concept" onclick="npSetPhase('concept')">Concept</button>
          <button class="phase-pill-btn" data-phase="development"
            onclick="npSetPhase('development')">Development</button>
          <button class="phase-pill-btn" data-phase="procurement"
            onclick="npSetPhase('procurement')">Procurement</button>
          <button class="phase-pill-btn" data-phase="site" onclick="npSetPhase('site')">Site</button>
          <button class="phase-pill-btn" data-phase="delivery" onclick="npSetPhase('delivery')">Delivery</button>
        </div>
        <button class="new-project-next" onclick="npCreate()"
          style="background:rgba(196,149,106,0.1);border-color:rgba(196,149,106,0.25);color:var(--warm)">Create
          project</button>
        <button class="new-project-back" onclick="npBackStep()">← Back</button>
      </div>
    </div>
    <div style="flex:1" onclick="closeNewProject()"></div>
  </div>


  <!-- INBOX ITEM ACTION SHEET -->
  <div class="item-action-sheet" id="item-action-sheet">
    <div class="item-action-modal">
      <div class="item-action-handle"></div>
      <p class="item-action-content" id="ia-content"></p>
      <p class="item-action-label">Category</p>
      <div class="item-action-row" id="ia-cat-row">
        <button class="item-action-cat-btn" data-cat="task" onclick="iaSetCat('task')">Task</button>
        <button class="item-action-cat-btn" data-cat="spark" onclick="iaSetCat('spark')">Spark</button>
        <button class="item-action-cat-btn" data-cat="reminder" onclick="iaSetCat('reminder')">Reminder</button>
        <button class="item-action-cat-btn" data-cat="uncategorised"
          onclick="iaSetCat('uncategorised')">Unsorted</button>
      </div>
      <div class="item-action-divider"></div>
      <button class="item-action-main-btn" id="ia-sync-btn" onclick="iaSyncToReminders()"
        style="display:none; background:rgba(0,122,255,0.08); border-color:rgba(0,122,255,0.25); color:#0a84ff; margin-bottom:12px;">Sync
        to Apple Reminders ↑</button>
      <button class="item-action-main-btn promote" onclick="iaPromote()">Develop into project →</button>
      <button class="item-action-main-btn archive" onclick="iaArchive()">Archive</button>
      <button class="item-action-main-btn cancel" onclick="closeItemAction()">Cancel</button>
    </div>
    <div style="flex:1" onclick="closeItemAction()"></div>
  </div>

  <script>
    // ── NATIVE SYNC ──────────────────────────────────────────
    function iaSyncToReminders() {
      if (!activeItemId) return;
      const item = items.find(i => i.id === activeItemId);
      if (!item) return;

      if (navigator.share) {
        navigator.share({
          title: 'Reminder',
          text: item.content
        }).then(() => {
          showToast('Synced & Archived');

          item.status = 'archived';
          item.touchedAt = new Date().toISOString();
          save();
          renderInbox();

          closeItemAction();
        }).catch((err) => {
          console.log('Share error:', err);
          // User cancelled or it failed
        });
      } else {
        showToast('Share API not supported on this browser');
      }
    }
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(registration => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
          })
          .catch(err => {
            console.log('ServiceWorker registration failed: ', err);
          });
      });
    }