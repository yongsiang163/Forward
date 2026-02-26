    // ═══════════════════════════════════════════════════════
    // FORWARD v1.0 · Core Logic
    // ═══════════════════════════════════════════════════════

    // ── CONSTANTS ──────────────────────────────────────────
    const CAT_LABELS = { task: 'Task', project: 'Project', spark: 'Spark', reminder: 'Reminder', uncategorised: 'Uncategorised' };

    // Differentiated lifecycle by category — the core graveyard prevention logic
    const LIFECYCLE = {
      task: { freshHrs: 48, quietDays: 7, archiveDays: 30 },
      project: { freshHrs: Infinity, quietDays: 9, archiveDays: Infinity }, // never auto-archived
      spark: { freshHrs: 48, quietDays: null, archiveDays: 7 },        // goes straight to archive at 7 days
      reminder: { freshHrs: 48, quietDays: null, archiveDays: null },     // handled by date
      uncategorised: { freshHrs: 48, quietDays: 7, archiveDays: 30 }
    };

    // Rewind mood → attention state map
    const MOOD_MAP = {
      Alive: { state: 'focused', label: 'You\'re alive and ready.', maxSteps: 3 },
      Calm: { state: 'drifting', label: 'Calm today. One steady thing.', maxSteps: 3 },
      Okay: { state: 'drifting', label: 'Okay is enough. One step.', maxSteps: 2 },
      Restless: { state: 'drifting', label: 'Restless energy. One channel.', maxSteps: 2 },
      Tired: { state: 'fatigued', label: 'Tired. One very small thing.', maxSteps: 1 },
      Heavy: { state: 'fatigued', label: 'Running heavy. Just one thing.', maxSteps: 1 }
    };

    // Interior design phase context — sent to AI for domain-aware suggestions
    const PHASE_CONTEXT = {
      concept: 'Concept phase: mood boards, spatial direction, client brief alignment, reference gathering. Suggestions should be exploratory and creative.',
      development: 'Development phase: drawings, specifications, material selections, design presentations. Suggestions should be precise and document-oriented.',
      procurement: 'Procurement phase: supplier sourcing, quotes, purchase orders, lead times, follow-ups. Suggestions should be administrative and sequential.',
      site: 'Site phase: site visits, contractor coordination, installation supervision, punch lists. Suggestions should be immediate, physical, and time-aware.',
      delivery: 'Delivery phase: client handover, final documentation, photography, snagging. Suggestions should be completionist and detail-oriented.'
    };

    // ── APP STATE ───────────────────────────────────────────
    const S = {
      screen: 'home',
      filter: 'all',
      rewindSession: null,
      attentionState: null,
      maxSteps: 3,
      quietExpanded: false,
      currentWorkItem: null,
      mvnaSteps: [],
      mvnaStep: 0,
      focusActive: false,
      focusStart: null,
      focusTimer: null
    };

    let items = [];
    let projects = [];

    // ── STORAGE ─────────────────────────────────────────────
    function save() {
      try { localStorage.setItem('forward_items', JSON.stringify(items)); } catch (e) { }
    }

    function load() {
      try {
        const d = localStorage.getItem('forward_items');
        if (d) items = JSON.parse(d);
      } catch (e) { items = []; }
    }

    function saveProjects() {
      try { localStorage.setItem('forward_projects', JSON.stringify(projects)); } catch (e) { }
    }

    function loadProjects() {
      try {
        const d = localStorage.getItem('forward_projects');
        if (d) projects = JSON.parse(d);
      } catch (e) { projects = []; }
    }

    function loadRewind() {
      try {
        const d = localStorage.getItem('rewind_sessions');
        if (!d) return null;
        const arr = JSON.parse(d);
        if (!arr.length) return null;
        const last = arr[arr.length - 1];
        const ageHrs = (Date.now() - new Date(last.date)) / 3600000;
        return ageHrs <= 24 ? last : null;
      } catch (e) { return null; }
    }

    // ── LIFECYCLE ENGINE ─────────────────────────────────────
    function computeStatus(item) {
      if (item.status === 'archived') return 'archived';
      const now = Date.now();
      const created = new Date(item.createdAt).getTime();
      const touched = new Date(item.touchedAt || item.createdAt).getTime();
      const ageHrs = (now - created) / 3600000;
      const touchedDays = (now - touched) / 86400000;
      const lc = LIFECYCLE[item.category] || LIFECYCLE.uncategorised;

      if (lc.archiveDays !== null && lc.archiveDays !== Infinity && touchedDays > lc.archiveDays) return 'archived';
      if (lc.quietDays && touchedDays > lc.quietDays) return 'quiet';
      if (ageHrs <= (lc.freshHrs || 48)) return 'fresh';
      return 'alive';
    }

    function runLifecycle() {
      let changed = false;
      items.forEach(item => {
        const s = computeStatus(item);
        if (s !== item.status) { item.status = s; changed = true; }
      });
      if (changed) save();
    }

    // ── AI CATEGORISATION (placeholder — swap for Claude API) ──
    function aiCategorise(text) {
      return new Promise(resolve => {
        setTimeout(() => {
          const t = text.toLowerCase();
          let cat = 'task';
          if (/idea|thought|what if|maybe|imagine|feeling|noticed|spark/i.test(t)) cat = 'spark';
          else if (/client|project|phase|design|proposal|presentation|procurement|drawing|spec/i.test(t)) cat = 'project';
          else if (/remind|deadline|due|call|meeting|at \d|by \d/i.test(t)) cat = 'reminder';
          resolve({ category: cat });
        }, 700);
      });
    }

    // ── HELP ME START (placeholder — swap for Claude API) ────
    // Full payload shape is ready for real API: task, projectId, projectPhase, moodState, completedSteps
    function helpMeStartAI({ task, projectPhase, moodState, maxSteps, completedSteps = [] }) {
      return new Promise(resolve => {
        setTimeout(() => {
          const t = task.toLowerCase();
          let steps = [];

          // Phase-aware suggestions (simplified placeholder; real AI uses PHASE_CONTEXT)
          if (projectPhase === 'procurement') {
            steps = ['Open your supplier list', 'Find the first unconfirmed quote', 'Send one follow-up message'];
          } else if (projectPhase === 'site') {
            steps = ['Open your site checklist', 'Note the first unresolved item', 'Call or message the relevant contractor'];
          } else if (/email|send|reply|message/i.test(t)) {
            steps = ['Open your email and find the thread', 'Read the last message only', 'Type one sentence to start your reply'];
          } else if (/call|phone|ring/i.test(t)) {
            steps = ['Find the contact in your phone', 'Press call'];
          } else if (/document|write|draft|report|proposal/i.test(t)) {
            steps = ['Open the document', 'Read the last paragraph you wrote', 'Write one sentence — any sentence'];
          } else if (/research|find|look|search/i.test(t)) {
            steps = ['Open one browser tab', 'Type the first search term that comes to mind'];
          } else {
            steps = [
              `Open whatever you need for: "${task}"`,
              'Look at it for 30 seconds',
              'Do the single smallest first action'
            ];
          }

          // Enforce hard cap — maxSteps is 1 for Heavy/Fatigued states
          steps = steps.slice(0, maxSteps);
          resolve(steps);
        }, 1800); // deliberate delay — shows loading orb, proves latency handling
      });
    }

    // ── CAPTURE ──────────────────────────────────────────────
    let activeCaptureProjectId = null;

    function openCapture() {
      const sheet = document.getElementById('capture-sheet');
      const ta = document.getElementById('capture-textarea');
      sheet.classList.add('active');
      ta.value = '';
      activeCaptureProjectId = null;
      document.getElementById('capture-project-btn').textContent = '@ Project';
      document.getElementById('capture-project-btn').style.borderColor = '';
      onCaptureType();
      setTimeout(() => ta.focus(), 380);
    }

    function onCaptureType() {
      const ta = document.getElementById('capture-textarea');
      document.getElementById('capture-char').textContent = ta.value.length;
    }

    function trashCapture() {
      document.getElementById('capture-textarea').value = '';
      document.getElementById('capture-sheet').classList.remove('active');
    }

    function dismissCapture() {
      // Auto-discard accidental taps — under 2 chars
      const text = document.getElementById('capture-textarea').value.trim();
      if (text.length < 2) { trashCapture(); return; }
      saveCapture();
    }

    async function saveCapture() {
      const ta = document.getElementById('capture-textarea');
      const rawText = ta.value.trim();

      // Under 2 chars = accidental — discard silently
      if (rawText.length < 2) { trashCapture(); return; }

      // Look for inline @mentions of projects if no explicit project was selected
      let finalProjectId = activeCaptureProjectId;
      let finalCategory = 'uncategorised';

      if (!finalProjectId) {
        // Sort by longest name first to match "Master Bedroom" before "Master" // don't match substrings of shorter names
        const sortedProjects = [...projects].sort((a, b) => (b.name || '').length - (a.name || '').length);
        for (let p of sortedProjects) {
          if (p.name && rawText.toLowerCase().includes('@' + p.name.toLowerCase())) {
            finalProjectId = p.id;
            break;
          }
        }
      }

      if (finalProjectId) finalCategory = 'task';

      // Split text by lines to create independent items
      const lines = rawText.split(/\r?\n/).filter(l => l.trim().length > 0);
      let itemsSaved = 0;

      for (let lineText of lines) {
        const item = {
          id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
          content: lineText.trim(),
          category: finalCategory,
          status: 'fresh',
          createdAt: new Date().toISOString(),
          touchedAt: new Date().toISOString(),
          projectId: finalProjectId,
          projectPhase: null,
          aiCategory: finalProjectId ? finalCategory : null,
          confirmed: finalProjectId ? true : false,
          mvnaSteps: null,
          mvnaCurrentStep: 0,
          aiPending: !finalProjectId && !navigator.onLine
        };

        items.unshift(item);
        itemsSaved++;

        if (!finalProjectId && navigator.onLine) {
          categoriseItem(item);
        }
      }

      if (itemsSaved > 0) {
        save();
        showToast(itemsSaved > 1 ? `Captured ${itemsSaved} items ✦` : 'Captured ✦');
        updateStats();
        if (S.screen === 'inbox') renderInbox();
      }

      // Dismiss
      ta.value = '';
      document.getElementById('capture-sheet').classList.remove('active');
    }

    // Capture Project Assignment Methods
    function toggleCaptureProjectSelect() {
      document.getElementById('capture-project-sheet').style.display = 'flex';
      const list = document.getElementById('capture-project-list');
      const activeProjects = projects.filter(p => p.status !== 'archived');

      if (activeProjects.length === 0) {
        list.innerHTML = '<p style="color:var(--text-muted); font-size:12px;">No active projects.</p>';
        return;
      }

      list.innerHTML = activeProjects.map(p => `
          <div onclick="selectCaptureProject('${p.id}', '${esc(p.name)}')" style="padding:16px; background:var(--surface2); border:1px solid var(--border-soft); border-radius:12px; margin-bottom:8px; display:flex; justify-content:space-between; cursor:pointer;">
             <span style="color:var(--text); font-size:14px;">${esc(p.name)}</span>
             ${p.id === activeCaptureProjectId ? '<span style="color:var(--teal)">✓</span>' : ''}
          </div>
       `).join('');
    }

    function selectCaptureProject(id, name) {
      activeCaptureProjectId = id;
      const btn = document.getElementById('capture-project-btn');
      btn.textContent = `@ ${name}`;
      btn.style.borderColor = 'var(--teal)';
      closeCaptureProjectSelect();
    }

    function clearCaptureProject() {
      activeCaptureProjectId = null;
      const btn = document.getElementById('capture-project-btn');
      btn.textContent = '@ Project';
      btn.style.borderColor = '';
      closeCaptureProjectSelect();
    }

    function closeCaptureProjectSelect() {
      document.getElementById('capture-project-sheet').style.display = 'none';
      document.getElementById('capture-textarea').focus();
    }

    async function categoriseItem(item) {
      try {
        const result = await aiCategorise(item.content);
        const idx = items.findIndex(i => i.id === item.id);
        if (idx === -1) return;
        items[idx].aiCategory = result.category;
        items[idx].aiPending = false;
        save();
        if (S.screen === 'inbox') renderInbox();
        updateStats();
      } catch (e) { }
    }

    // Offline → online: process queued items
    window.addEventListener('online', () => {
      items.filter(i => i.aiPending).forEach(item => categoriseItem(item));
    });

    function confirmCategory(itemId) {
      const idx = items.findIndex(i => i.id === itemId);
      if (idx === -1) return;
      items[idx].category = items[idx].aiCategory || items[idx].category;
      items[idx].confirmed = true;
      items[idx].touchedAt = new Date().toISOString();
      runLifecycle();
      save();
      renderInbox();
    }

    function archiveItem(itemId) {
      const idx = items.findIndex(i => i.id === itemId);
      if (idx === -1) return;
      items[idx].status = 'archived';
      save();
      renderInbox();
      updateStats();
      showToast('Archived');
    }

    // ── INBOX RENDER ─────────────────────────────────────────
    function setFilter(btn, filter) {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      S.filter = filter;
      renderInbox();
    }

    function renderInbox() {
      runLifecycle();
      const list = document.getElementById('inbox-list');
      const title = document.getElementById('inbox-title');

      const active = items.filter(i => i.status !== 'archived');
      const filtered = S.filter === 'all'
        ? active
        : active.filter(i => (i.aiCategory || i.category) === S.filter);

      const fresh = filtered.filter(i => i.status === 'fresh' || i.status === 'alive');
      const quiet = filtered.filter(i => i.status === 'quiet');

      // Dynamic title
      const freshCount = items.filter(i => i.status === 'fresh').length;
      if (title) title.textContent = freshCount > 0
        ? `${freshCount} fresh item${freshCount !== 1 ? 's' : ''}`
        : 'Everything';

      if (filtered.length === 0) {
        list.innerHTML = `
      <div class="inbox-empty">
        <div class="inbox-empty-orb"></div>
        <p class="inbox-empty-text">Nothing here yet.<br>Capture something.</p>
      </div>`;
        return;
      }

      let html = fresh.map(renderItemHTML).join('');

      // Quiet items — collapsed block, not dimmed text
      if (quiet.length > 0) {
        html += `
      <div class="quiet-block ${S.quietExpanded ? 'open' : ''}" onclick="toggleQuiet()">
        <span class="quiet-block-label">${quiet.length} quiet item${quiet.length !== 1 ? 's' : ''}</span>
        <span class="quiet-block-chevron">↓</span>
      </div>`;
        if (S.quietExpanded) {
          html += quiet.map(i => renderItemHTML(i, true)).join('');
        }
      }

      list.innerHTML = html;
    }

    function toggleQuiet() {
      S.quietExpanded = !S.quietExpanded;
      renderInbox();
    }

    function renderItemHTML(item, isQuiet = false) {
      const cat = item.aiCategory || item.category;
      const label = CAT_LABELS[cat] || 'Uncategorised';
      const isPending = item.aiCategory && !item.confirmed;
      const isConfirmed = item.confirmed;
      const tagClass = isPending ? 'pending' : (isConfirmed ? 'confirmed' : '');
      const tagAction = isPending ? `onclick="confirmCategory('${item.id}')"` : '';
      const pendingHint = isPending ? `<span class="ai-suggest-hint">AI suggests · tap to confirm</span>` : '';
      const offlineDot = item.aiPending ? `<span class="ai-pending-dot"></span>` : '';

      const developBtn = (cat === 'project')
        ? `<button class="inbox-item-develop" onclick="promoteToProject('${item.id}')">Develop →</button>`
        : '';

      return `
    <div class="inbox-item cat-${cat}${isQuiet ? ' status-quiet' : ''}" onclick="openItemAction('${item.id}')">
      <div class="inbox-item-bar"></div>
      <p class="inbox-item-content">${esc(item.content)}</p>
      <div class="inbox-item-footer">
        <span class="inbox-item-time">${offlineDot}${timeAgo(item.createdAt)}</span>
        <span class="cat-tag ${tagClass}" ${tagAction}>${label}</span>
        ${pendingHint}
        ${developBtn}
        <button class="inbox-item-archive" onclick="archiveItem('${item.id}')" title="Archive">↓</button>
      </div>
    </div>`;
    }

    // ── WORK MODE ─────────────────────────────────────────────
    function renderWork() {
      runLifecycle();
      const eyebrow = document.getElementById('work-eyebrow');
      const headline = document.getElementById('work-headline');
      const area = document.getElementById('work-area');
      const thinking = document.getElementById('ai-thinking');

      thinking.classList.remove('visible');

      const session = S.rewindSession;
      const moodInfo = session ? (MOOD_MAP[session.mood] || MOOD_MAP.Okay) : null;
      S.maxSteps = moodInfo ? moodInfo.maxSteps : 3;
      S.attentionState = moodInfo ? moodInfo.state : null;

      headline.textContent = moodInfo ? moodInfo.label : 'Ready when you are.';

      const candidate = pickWorkItem(moodInfo);

      if (!candidate) {
        area.innerHTML = `
      <div class="work-empty">
        <p class="work-empty-text">Your inbox is clear.<br>Nothing to surface right now.</p>
        <p class="work-empty-cta" onclick="openCapture()">+ Capture something new</p>
      </div>`;
        return;
      }

      S.currentWorkItem = candidate;
      S.mvnaSteps = [];
      S.mvnaStep = 0;

      const cat = candidate.aiCategory || candidate.category;
      const label = CAT_LABELS[cat] || '';

      // If it's a project, show phase + next action as the work card
      const isProject = cat === 'project';
      const linkedProject = isProject ? projects.find(p => p.name && candidate.content.toLowerCase().includes(p.name.toLowerCase())) : null;
      const projectContext = linkedProject
        ? `<div class="task-project-context">
        <span class="project-phase-pill" style="margin-right:8px">${PHASE_LABELS[linkedProject.phase] || ''}</span>
        ${linkedProject.nextAction ? `<span class="task-card-context">${esc(linkedProject.nextAction)}</span>` : ''}
       </div>`
        : '';

      area.innerHTML = `
    <div class="task-card">
      <p class="task-card-context">${label}</p>
      ${projectContext}
      <p class="task-card-title">${esc(candidate.content)}</p>
      <div class="task-card-btns">
        <button class="task-btn primary" onclick="enterFocus()">Begin →</button>
        <button class="task-btn muted" onclick="skipTask()">Not now</button>
      </div>
    </div>
    <div class="mvna-wrap" id="mvna-wrap"></div>`;

      // Help Me Start button
      const helpBtn = document.createElement('button');
      helpBtn.className = 'help-btn';
      helpBtn.textContent = 'Help me start →';
      helpBtn.onclick = () => runHelpMeStart(candidate);
      area.appendChild(helpBtn);
    }

    function pickWorkItem(moodInfo) {
      const available = items.filter(i =>
        i.status !== 'archived' &&
        i.category !== 'spark' // sparks go to library, not work queue
      );
      if (!available.length) return null;

      // Heavy/Fatigued: prefer shortest/freshest only
      if (moodInfo && moodInfo.state === 'fatigued') {
        const fresh = available.filter(i => i.status === 'fresh');
        return fresh[0] || available[0];
      }
      const fresh = available.filter(i => i.status === 'fresh');
      return fresh[0] || available[0];
    }

    async function runHelpMeStart(item) {
      const helpBtn = document.querySelector('.help-btn');
      const thinking = document.getElementById('ai-thinking');
      const wrap = document.getElementById('mvna-wrap');

      if (helpBtn) helpBtn.style.display = 'none';
      thinking.classList.add('visible');

      try {
        const steps = await helpMeStartAI({
          task: item.content,
          projectId: item.projectId,
          projectPhase: item.projectPhase,
          moodState: S.attentionState,
          maxSteps: S.maxSteps,
          completedSteps: []
        });

        S.mvnaSteps = steps;
        S.mvnaStep = 0;

        const idx = items.findIndex(i => i.id === item.id);
        if (idx !== -1) {
          items[idx].mvnaSteps = steps;
          items[idx].mvnaCurrentStep = 0;
          save();
        }

        thinking.classList.remove('visible');
        wrap.classList.add('visible');
        renderMvna(wrap, steps);
      } catch (e) {
        thinking.classList.remove('visible');
        if (helpBtn) helpBtn.style.display = '';
        showToast('Could not connect. Try again.');
      }
    }

    function renderMvna(container, steps) {
      container.innerHTML = steps.map((step, i) => {
        const current = i === S.mvnaStep;
        const done = i < S.mvnaStep;
        return `
      <div class="mvna-step ${current ? 'current' : ''} ${done ? 'done' : ''}">
        <div class="mvna-step-num">${done ? '✓' : i + 1}</div>
        <p class="mvna-step-text">${esc(step)}</p>
        ${current ? `<button class="mvna-done-btn" onclick="completeStep(${i})">✓</button>` : ''}
      </div>`;
      }).join('');
    }

    function completeStep(idx) {
      S.mvnaStep = idx + 1;
      const wrap = document.getElementById('mvna-wrap');
      if (wrap) renderMvna(wrap, S.mvnaSteps);
      if (S.mvnaStep >= S.mvnaSteps.length) {
        showToast('All steps done. That counts.');
        setTimeout(() => { touchItem(S.currentWorkItem.id); renderWork(); }, 1200);
      }
    }

    function skipTask() {
      if (S.currentWorkItem) touchItem(S.currentWorkItem.id);
      S.currentWorkItem = null;
      renderWork();
    }

    function touchItem(id) {
      const idx = items.findIndex(i => i.id === id);
      if (idx !== -1) { items[idx].touchedAt = new Date().toISOString(); items[idx].status = 'alive'; save(); }
    }

    // ── FOCUS STATE ───────────────────────────────────────────
    function enterFocus() {
      const item = S.currentWorkItem;
      if (!item) return;

      document.getElementById('focus-task-text').textContent = item.content;
      document.getElementById('focus-overlay').classList.add('active');

      S.focusActive = true;
      S.focusStart = Date.now();
      clearInterval(S.focusTimer);
      S.focusTimer = setInterval(checkFocusTime, 60000);
    }

    function checkFocusTime() {
      if (!S.focusActive || !S.focusStart) return;
      const mins = (Date.now() - S.focusStart) / 60000;
      const ring = document.getElementById('focus-time-ring');
      const msg = document.getElementById('focus-gentle-msg');

      if (mins >= 120) {
        ring.className = 'focus-time-ring glow-90';
        msg.classList.add('visible');
      } else if (mins >= 90) {
        ring.className = 'focus-time-ring glow-90';
      } else if (mins >= 45) {
        ring.className = 'focus-time-ring glow-45';
      }
    }

    function completeFocus() {
      if (S.currentWorkItem) { archiveItem(S.currentWorkItem.id); S.currentWorkItem = null; }
      exitFocus();
      showToast('Done. That counts.');
      setTimeout(() => renderWork(), 400);
    }

    function exitFocus() {
      document.getElementById('focus-overlay').classList.remove('active');
      document.getElementById('focus-time-ring').className = 'focus-time-ring';
      document.getElementById('focus-gentle-msg').classList.remove('visible');
      S.focusActive = false;
      clearInterval(S.focusTimer);
    }

    // ── HOME SCREEN ───────────────────────────────────────────
    function renderHome() {
      const line = document.getElementById('home-state-line');
      // rewind card is now inline in hero state line — no separate slot
      const session = S.rewindSession;

      const ICONS = { Heavy: '🌧', Tired: '🌫', Restless: '⚡', Okay: '🌤', Calm: '🌊', Alive: '✨' };

      if (!session) {
        line.className = 'home-state-line no-session';
        line.innerHTML = `Open <strong style="color:var(--warm)">Rewind</strong> to check in for a better experience.`;
        // no slot to update
      } else {
        const moodInfo = MOOD_MAP[session.mood] || MOOD_MAP.Okay;
        const icon = ICONS[session.mood] || '';
        line.className = 'home-state-line';
        line.innerHTML = `${icon} <em>${session.mood}</em> &middot; ${moodInfo.label}`;
        // mood shown inline in state line
        S.attentionState = moodInfo.state;
      }

      updateStats();
    }

    function updateStats() {
      runLifecycle();
      const active = items.filter(i => i.status !== 'archived');
      const fresh = items.filter(i => i.status === 'fresh');
      document.getElementById('stat-inbox').textContent = active.length;
      document.getElementById('stat-fresh').textContent = fresh.length;
      updateOrbPulse();
    }

    // ── ORIENTATION PILL ──────────────────────────────────────
    let pillTimer = null;
    function showPill(mode) {
      const pill = document.getElementById('mode-pill');
      if (!pill) return;
      clearTimeout(pillTimer);
      const pillMode = (mode === 'projects' || mode === 'inbox') ? 'plan' : mode;
      pill.className = 'mode-pill ' + pillMode;
      pill.textContent = mode === 'projects' ? 'Projects' : mode === 'inbox' ? 'Inbox' : 'Work';
      // Force reflow then show
      pill.getBoundingClientRect();
      pill.classList.add('visible');
      pillTimer = setTimeout(() => pill.classList.remove('visible'), 2200);
    }

    // ── NAVIGATION ────────────────────────────────────────────
    function showScreen(id) {
      document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
      document.getElementById('screen-' + id).classList.add('active');

      // Ambient colour shift
      document.body.classList.remove('mode-plan', 'mode-work');
      if (id === 'projects' || id === 'inbox') document.body.classList.add('mode-plan');

      // Orb state — shift colour on Plan, return to amber on Work/Home
      const orb = document.getElementById('hero-orb-wrap');
      if (orb) {
        orb.classList.remove('state-plan');
        if (id === 'projects') orb.classList.add('state-plan');
      }

      // Orientation pill — only on plan/work entry
      if (id === 'projects' || id === 'inbox' || id === 'work') showPill(id);

      // Bottom nav active state
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      const navMap = { home: 'nav-home', projects: 'nav-projects', inbox: 'nav-inbox', settings: 'nav-settings' };
      if (navMap[id]) { const nb = document.getElementById(navMap[id]); if (nb) nb.classList.add('active'); }

      S.screen = id;

      // Manage body class for home-specific fixed elements
      document.body.classList.toggle('on-home', id === 'home');
      // Hide stats drawer when leaving home
      if (id !== 'home') revealStats(false);

      if (id === 'projects') renderProjects();
      if (id === 'inbox') renderInbox();
      if (id === 'work') renderWork();
      if (id === 'home') renderHome();
    }

    // ── DATA EXPORT ───────────────────────────────────────────
    function exportData() {
      const payload = {
        exported: new Date().toISOString(),
        app: 'Forward', version: '1.0',
        totalItems: items.length, items
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `forward-backup-${new Date().toISOString().slice(0, 10)}.json` });
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup downloaded');
    }

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
    // PROJECT CATEGORIES + PHASES
    // ══════════════════════════════════════════════════════════
    const PROJECT_CATS = {
      idwork: { label: 'ID Work', badgeClass: 'cat-badge-idwork', phases: ['concept', 'development', 'procurement', 'site', 'delivery'], phaseLabels: { concept: 'Concept', development: 'Development', procurement: 'Procurement', site: 'Site', delivery: 'Delivery' } },
      life: { label: 'Life', badgeClass: 'cat-badge-life', phases: ['seed', 'shaping', 'inmotion', 'integrating'], phaseLabels: { seed: 'Seed', shaping: 'Shaping', inmotion: 'In Motion', integrating: 'Integrating' } },
      business: { label: 'Business', badgeClass: 'cat-badge-business', phases: ['idea', 'validating', 'building', 'operating'], phaseLabels: { idea: 'Idea', validating: 'Validating', building: 'Building', operating: 'Operating' } },
      learning: { label: 'Learning', badgeClass: 'cat-badge-learning', phases: ['curious', 'exploring', 'practising', 'embedding'], phaseLabels: { curious: 'Curious', exploring: 'Exploring', practising: 'Practising', embedding: 'Embedding' } },
      open: { label: 'Open', badgeClass: 'cat-badge-open', phases: ['start', 'middle', 'end'], phaseLabels: { start: 'Start', middle: 'Middle', end: 'End' } }
    };

    const AI_PERSONAS = {
      idwork: 'You are a calm, experienced interior design project coordinator. You understand design phases deeply — concept, development, procurement, site, delivery. Your suggestions are specific, physical, and sequenced.',
      life: 'You are a warm, grounded personal coach. You help people move through life projects with clarity and self-compassion. Your suggestions are gentle, honest, and sized to what feels possible today.',
      business: 'You are a sharp, lean thinking partner for business and entrepreneurial work. You help cut through noise, find the real next move, and keep momentum without overwhelm.',
      learning: 'You are a patient, curious learning guide. You help people build knowledge and skill progressively. You know that learning compounds — you always suggest the smallest step that builds on what\'s already known.',
      open: 'You are a thoughtful, adaptive thinking partner. You meet the person where they are and help them find the clearest next step.'
    };

    // ── PROJECT CATEGORY FILTER ──────────────────────────────
    let activeCatFilter = 'all';

    function setCatFilter(btn, cat) {
      activeCatFilter = cat;
      document.querySelectorAll('.cat-filter-chip').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));
      renderProjects();
    }

    // ── RENDER PROJECTS ──────────────────────────────────────
    function renderProjects() {
      const container = document.getElementById('project-cards');
      if (!container) return;
      const filtered = projects.filter(p => p.status !== 'archived' && (activeCatFilter === 'all' || p.projectCat === activeCatFilter));

      const addBtn = '<button class="add-project-btn" onclick="openNewProject(null)">+ new project</button>';

      if (filtered.length === 0) {
        container.innerHTML = `<div style="padding:40px 0;text-align:center"><p style="color:var(--text-muted);font-size:13px;margin-bottom:20px">No projects yet.</p></div>` + addBtn;
        return;
      }
      const cards = filtered.map(p => {
        const catInfo = PROJECT_CATS[p.projectCat] || PROJECT_CATS.open;
        const phaseLabel = catInfo.phaseLabels[p.phase] || p.phase || '';
        return `
    <div class="project-card" onclick="openProjectSheet('${p.id}')">
      <span class="cat-badge ${catInfo.badgeClass}">${catInfo.label}</span>
      <p class="project-card-name">${esc(p.name)}</p>
      ${p.vision ? `<p class="project-card-vision">${esc(p.vision)}</p>` : ''}
      <div class="project-card-footer">
        <span class="project-phase-pill">${phaseLabel}</span>
        ${p.nextAction ? `<span class="project-next-preview">${esc(p.nextAction)}</span>` : '<span style="font-size:11px;color:var(--text-muted);opacity:0.5">No next action</span>'}
      </div>
    </div>`;
      }).join('');
      container.innerHTML = cards + addBtn;
    }

    // ── PROJECT DETAIL SHEET ─────────────────────────────────
    function openProjectSheet(id) {
      const p = projects.find(x => x.id === id);
      if (!p) return;
      editingProjectId = id;
      psPhase = p.phase || Object.keys((PROJECT_CATS[p.projectCat] || PROJECT_CATS.open).phaseLabels)[0];

      document.getElementById('ps-name').value = p.name || '';
      document.getElementById('ps-vision').textContent = p.vision || 'No vision captured.';
      document.getElementById('ps-next-action').value = p.nextAction || '';
      document.getElementById('ps-notes').value = p.notes || '';

      // Rebuild phase pills for this category
      const catInfo = PROJECT_CATS[p.projectCat] || PROJECT_CATS.open;
      const pillsEl = document.querySelector('.project-sheet .phase-pills');
      if (pillsEl) {
        pillsEl.innerHTML = catInfo.phases.map(ph =>
          `<button class="phase-pill-btn${ph === psPhase ? ' active' : ''}" data-phase="${ph}" onclick="setProjectPhase('${ph}')">${catInfo.phaseLabels[ph]}</button>`
        ).join('');
      }

      // Reset AI thread
      document.getElementById('project-ai-thread').classList.remove('open');
      document.getElementById('ai-messages').innerHTML = '';
      document.getElementById('project-ai-btn-label').textContent = 'Talk to AI →';

      document.getElementById('project-sheet').classList.add('active');

      // Auto-suggest next action if empty
      if (!p.nextAction) setTimeout(() => autoSuggestNextAction(p), 800);
    }

    function setProjectPhase(phase) {
      psPhase = phase;
      document.querySelectorAll('.project-sheet .phase-pill-btn').forEach(b => b.classList.toggle('active', b.dataset.phase === phase));
    }

    function saveProjectSheet() {
      if (!editingProjectId) return;
      const p = projects.find(x => x.id === editingProjectId);
      if (!p) return;
      const newName = document.getElementById('ps-name').value.trim();
      p.name = newName || p.name;
      p.phase = psPhase;
      p.nextAction = document.getElementById('ps-next-action').value.trim();
      p.notes = document.getElementById('ps-notes').value.trim();
      p.touchedAt = new Date().toISOString();
      saveProjects();
      renderProjects();
      closeProjectSheet();
      showToast('Project saved');
    }

    function closeProjectSheet() {
      document.getElementById('project-sheet').classList.remove('active');
      editingProjectId = null;
    }

    // ── AUTO-SUGGEST NEXT ACTION ─────────────────────────────
    async function autoSuggestNextAction(p) {
      const nextInput = document.getElementById('ps-next-action');
      if (!nextInput || nextInput.value.trim()) return;
      nextInput.placeholder = 'AI is thinking…';
      // Simulate for now — swap for Claude API
      await new Promise(r => setTimeout(r, 1400));
      const catInfo = PROJECT_CATS[p.projectCat] || PROJECT_CATS.open;
      const phase = catInfo.phaseLabels[p.phase] || p.phase;
      const suggestions = {
        idwork: { concept: 'Pull three reference images that capture the feeling', development: 'Review the last drawing set and mark one decision', procurement: 'Follow up on the longest outstanding quote', site: 'Check the punch list and call the first contractor', delivery: 'Send the client the final documentation checklist' },
        life: { seed: 'Write one sentence about why this matters', shaping: 'Name the first real action that would move this', inmotion: 'Check in on where this sits today', integrating: 'Notice what has already shifted' },
        business: { idea: 'Write the problem you\'re solving in one sentence', validating: 'Talk to one person who has this problem', building: 'Identify the one thing blocking progress', operating: 'Review last week\'s numbers' },
        learning: { curious: 'Find one resource and save it', exploring: 'Spend 20 minutes with the material', practising: 'Do one exercise without notes', embedding: 'Teach this to someone or write it out' }
      };
      const catSuggestions = suggestions[p.projectCat];
      const suggestion = (catSuggestions && catSuggestions[p.phase]) ? catSuggestions[p.phase] : 'Identify the one smallest next step';
      nextInput.placeholder = suggestion;
    }

    // ── AI COMPANION IN PROJECT ──────────────────────────────
    function toggleProjectAI() {
      const thread = document.getElementById('project-ai-thread');
      const label = document.getElementById('project-ai-btn-label');
      const isOpen = thread.classList.contains('open');
      if (!isOpen) {
        thread.classList.add('open');
        label.textContent = 'AI active ·';
        // Auto-read project on first open
        if (document.getElementById('ai-messages').children.length === 0) {
          const p = projects.find(x => x.id === editingProjectId);
          if (p) setTimeout(() => aiReadProject(p), 400);
        }
      } else {
        thread.classList.remove('open');
        label.textContent = 'Talk to AI →';
      }
    }

    async function aiReadProject(p) {
      const catInfo = PROJECT_CATS[p.projectCat] || PROJECT_CATS.open;
      const phase = catInfo.phaseLabels[p.phase] || p.phase || '';
      const mood = (S.rewindSession && S.rewindSession.mood) ? S.rewindSession.mood : null;
      showAIThinking(true);
      await new Promise(r => setTimeout(r, 1800));
      showAIThinking(false);
      const moodLine = mood ? ` You're coming in feeling ${mood.toLowerCase()} today.` : '';
      const response = buildAIReadResponse(p, phase, mood);
      appendAIMessage(response, p);
    }

    function buildAIReadResponse(p, phase, mood) {
      const fatigued = ['Heavy', 'Tired'].includes(mood);
      const alive = ['Alive', 'Calm'].includes(mood);
      const maxSteps = fatigued ? 1 : alive ? 3 : 2;
      const catInfo = PROJECT_CATS[p.projectCat] || PROJECT_CATS.open;

      // Phase-aware read for each category
      const reads = {
        idwork: `<em>${p.name}</em> is in ${phase}. ${p.nextAction ? `The declared next step is: "${p.nextAction}".` : 'No next step set yet.'}`,
        life: `<em>${p.name}</em> — you placed this in ${phase}. ${p.vision ? `You wrote: "${p.vision.substring(0, 80)}…"` : ''} Let's find what's true right now.`,
        business: `<em>${p.name}</em> is at ${phase}. ${p.nextAction ? `You said the next move was: "${p.nextAction}".` : 'No move declared yet.'} What's the actual blocker?`,
        learning: `<em>${p.name}</em> — you're in the ${phase} stage. The question is always: what's the one thing to do with the next 20 minutes?`,
        open: `<em>${p.name}</em> — ${phase}. What's true about where this sits right now?`
      };
      const read = reads[p.projectCat] || reads.open;
      return { text: read, maxSteps };
    }

    function appendAIMessage(response, p) {
      const msgs = document.getElementById('ai-messages');
      if (!msgs) return;
      const div = document.createElement('div');
      div.className = 'ai-message';
      div.innerHTML = `<p class="ai-message-text">${response.text}</p>`;
      msgs.appendChild(div);

      // Auto-generate steps if maxSteps available
      if (response.steps && response.steps.length) {
        renderAISteps(response.steps);
      }
      msgs.scrollTop = msgs.scrollHeight;
    }

    function renderAISteps(steps) {
      const msgs = document.getElementById('ai-messages');
      if (!msgs) return;
      const wrap = document.createElement('div');
      wrap.className = 'ai-message';
      wrap.innerHTML = steps.map((s, i) => `
    <div class="ai-step-item" id="ai-step-${i}">
      <button class="ai-step-check" id="ai-step-check-${i}" onclick="toggleAIStep(${i})"></button>
      <span class="ai-step-text" id="ai-step-text-${i}">${esc(s)}</span>
    </div>`).join('');
      msgs.appendChild(wrap);
    }

    function toggleAIStep(i) {
      const check = document.getElementById(`ai-step-check-${i}`);
      const text = document.getElementById(`ai-step-text-${i}`);
      if (check && text) {
        check.classList.toggle('done');
        text.classList.toggle('done');
      }
    }

    async function sendProjectAI() {
      const input = document.getElementById('project-ai-input');
      const msg = input ? input.value.trim() : '';
      if (!msg) return;
      input.value = '';

      // Show user message
      const msgs = document.getElementById('ai-messages');
      const userDiv = document.createElement('div');
      userDiv.className = 'ai-message';
      userDiv.style.background = 'rgba(196,149,106,0.08)';
      userDiv.style.borderLeft = '2px solid rgba(196,149,106,0.3)';
      userDiv.innerHTML = `<p class="ai-message-text" style="color:var(--text)">${esc(msg)}</p>`;
      msgs.appendChild(userDiv);
      msgs.scrollTop = msgs.scrollHeight;

      showAIThinking(true);
      const p = projects.find(x => x.id === editingProjectId);
      await new Promise(r => setTimeout(r, 1600));
      showAIThinking(false);

      // Generate response based on category persona and message
      const mood = S.rewindSession ? S.rewindSession.mood : null;
      const fatigued = ['Heavy', 'Tired'].includes(mood);
      const maxSteps = fatigued ? 1 : 2;
      const catInfo = (p && p.projectCat && PROJECT_CATS[p.projectCat]) ? PROJECT_CATS[p.projectCat] : PROJECT_CATS.open;
      const phase = p ? (catInfo.phaseLabels[p.phase] || p.phase) : '';

      let replyText = '';
      let steps = [];

      if (/stuck|block|can't|not sure|don't know/i.test(msg)) {
        replyText = `Being stuck in ${phase} usually means one of two things: the next action is too large, or there's a decision underneath it that hasn't been made. Which feels more true?`;
      } else if (/next|what|do|start|begin/i.test(msg)) {
        replyText = `Given you're in ${phase} and ${mood ? `feeling ${mood.toLowerCase()}` : 'where you are today'}, here are the right-sized next steps:`;
        steps = fatigued
          ? ['Do just one thing — the very first physical action you can take right now']
          : ['Open whatever you need to start', 'Do the first action only — decide nothing else yet', 'Note what you learn or what shifts'];
      } else {
        replyText = `Noted. Given where <em>${(p && p.name) ? p.name : 'this project'}</em> is — ${phase} — what would make the next hour count?`;
      }

      const response = { text: replyText, steps: steps.slice(0, maxSteps) };
      appendAIMessage(response, p);
      if (steps.length) renderAISteps(steps.slice(0, maxSteps));
    }

    function showAIThinking(show) {
      const el = document.getElementById('ai-thinking-inline');
      if (el) el.classList.toggle('visible', show);
    }

    // ── ITEM ACTION SHEET ────────────────────────────────────
    let activeItemId = null;
    let iaCurrentCat = null;

    function openItemAction(itemId) {
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      activeItemId = itemId;
      iaCurrentCat = item.aiCategory || item.category;

      document.getElementById('ia-content').textContent = item.content;
      document.querySelectorAll('.item-action-cat-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === iaCurrentCat);
      });

      const syncBtn = document.getElementById('ia-sync-btn');
      if (syncBtn) {
        syncBtn.style.display = (iaCurrentCat === 'reminder') ? 'block' : 'none';
      }

      document.getElementById('item-action-sheet').classList.add('active');
    }

    function iaSetCat(cat) {
      iaCurrentCat = cat;
      document.querySelectorAll('.item-action-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat === cat));

      const syncBtn = document.getElementById('ia-sync-btn');
      if (syncBtn) {
        syncBtn.style.display = (cat === 'reminder') ? 'block' : 'none';
      }

      // Save immediately
      const item = items.find(i => i.id === activeItemId);
      if (item) { item.category = cat; item.aiCategory = cat; item.confirmed = true; save(); }
    }

    function iaPromote() {
      const item = items.find(i => i.id === activeItemId);
      if (item) {
        closeItemAction();
        setTimeout(() => openNewProject(item.content), 200);
      }
    }

    function iaArchive() {
      if (activeItemId) archiveItem(activeItemId);
      closeItemAction();
    }

    function closeItemAction() {
      document.getElementById('item-action-sheet').classList.remove('active');
      activeItemId = null;
      renderInbox();
    }

    // ── ARCHIVE RECOVERY ─────────────────────────────────────
    let archiveOpen = false;
    function toggleArchive() {
      archiveOpen = !archiveOpen;
      const toggle = document.getElementById('archive-toggle');
      const list = document.getElementById('archive-list');
      toggle.classList.toggle('open', archiveOpen);
      list.classList.toggle('open', archiveOpen);
      if (archiveOpen) renderArchive();
    }

    function renderArchive() {
      const list = document.getElementById('archive-list');
      if (!list) return;
      const archived = items.filter(i => i.status === 'archived');
      if (!archived.length) { list.innerHTML = '<p style="padding:16px 4px;font-size:12px;color:var(--text-muted)">Nothing archived.</p>'; return; }
      list.innerHTML = archived.map(item => `
    <div class="archived-item">
      <span class="archived-item-text">${esc(item.content)}</span>
      <button class="archived-item-restore" onclick="restoreItem('${item.id}')">Restore</button>
    </div>`).join('');
    }

    function restoreItem(id) {
      const item = items.find(i => i.id === id);
      if (item) { item.status = 'fresh'; item.touchedAt = new Date().toISOString(); save(); renderArchive(); renderInbox(); showToast('Restored'); }
    }

    // ── NEW PROJECT — category selection ─────────────────────
    let npCat = 'idwork';
    function npSetCat(cat) {
      npCat = cat;
      document.querySelectorAll('.np-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.npcat === cat));
    }



    // ── NEW PROJECT FLOW ─────────────────────────────────────
    function openNewProject(prefillText) {
      npCat = 'idwork';
      npPhase = 'concept';
      document.getElementById('np-name').value = '';
      document.getElementById('np-vision').value = prefillText || '';
      document.querySelectorAll('.np-cat-btn').forEach(b => b.classList.toggle('active', b.dataset.npcat === 'idwork'));
      document.querySelectorAll('#np-phase-pills .phase-pill-btn').forEach(b => b.classList.remove('active'));
      const firstPill = document.querySelector('#np-phase-pills .phase-pill-btn');
      if (firstPill) firstPill.classList.add('active');
      document.getElementById('np-step-1').classList.add('active');
      document.getElementById('np-step-2').classList.remove('active');
      document.getElementById('new-project-sheet').classList.add('active');
      setTimeout(() => document.getElementById('np-name').focus(), 400);
    }

    function npBackStep() {
      document.getElementById('np-step-2').classList.remove('active');
      document.getElementById('np-step-1').classList.add('active');
    }

    function npSetPhase(phase) {
      npPhase = phase;
      document.querySelectorAll('#np-phase-pills .phase-pill-btn').forEach(b => b.classList.toggle('active', b.dataset.phase === phase));
    }

    function npCreate() {
      const name = document.getElementById('np-name').value.trim();
      const vision = document.getElementById('np-vision').value.trim();
      if (!name) { npBackStep(); return; }
      const catInfo = PROJECT_CATS[npCat] || PROJECT_CATS.open;
      const defaultPhase = catInfo.phases[0];
      const project = {
        id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2),
        name, vision,
        projectCat: npCat,
        phase: npPhase || defaultPhase,
        nextAction: '', notes: '',
        status: 'active',
        createdAt: new Date().toISOString(),
        touchedAt: new Date().toISOString()
      };
      projects.unshift(project);
      saveProjects();
      closeNewProject();
      renderProjects();
      showToast('Project created');
      setTimeout(() => openProjectSheet(project.id), 350);
    }

    function closeNewProject() {
      document.getElementById('new-project-sheet').classList.remove('active');
    }

    function promoteToProject(itemId) {
      const item = items.find(i => i.id === itemId);
      if (!item) return;
      closeItemAction();
      setTimeout(() => openNewProject(item.content), 250);
    }


    function npNextStep() {
      const name = document.getElementById('np-name').value.trim();
      if (!name) { document.getElementById('np-name').focus(); return; }
      const catInfo = PROJECT_CATS[npCat] || PROJECT_CATS.open;
      npPhase = catInfo.phases[0];
      const pillsEl = document.getElementById('np-phase-pills');
      if (pillsEl) {
        pillsEl.innerHTML = catInfo.phases.map((ph, i) =>
          `<button class="phase-pill-btn${i === 0 ? ' active' : ''}" data-phase="${ph}" onclick="npSetPhase('${ph}')">${catInfo.phaseLabels[ph]}</button>`
        ).join('');
      }
      document.getElementById('np-step-1').classList.remove('active');
      document.getElementById('np-step-2').classList.add('active');
    }

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