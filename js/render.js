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

  const active = items.filter(i => i.status !== 'archived' && i.status !== 'done');
  const filtered = S.filter === 'all'
    ? active
    : active.filter(i => (i.aiCategory || i.category) === S.filter);

  const fresh = filtered.filter(i => i.status === 'fresh' || i.status === 'alive');
  const cold = filtered.filter(i => i.status === 'cold');

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

  let html = fresh.map(i => renderItemHTML(i)).join('');

  // Cold items — collapsed block, not dimmed text
  if (cold.length > 0) {
    html += `
      <div class="cold-block ${S.coldExpanded ? 'open' : ''}" onclick="toggleCold()">
        <span class="cold-block-label">${cold.length} going cold</span>
        <span class="cold-block-chevron">↓</span>
      </div>`;
    if (S.coldExpanded) {
      html += cold.map(i => renderItemHTML(i, true)).join('');
    }
  }

  list.innerHTML = html;
}

function toggleCold() {
  S.coldExpanded = !S.coldExpanded;
  renderInbox();
}

function renderItemHTML(item, isCold = false) {
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
    <div class="inbox-item cat-${cat}${isCold ? ' status-cold' : ''}" onclick="openItemAction('${item.id}')">
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

// ── ON-DEMAND / INITIAL ──────────────────────────────────
// Instead of rendering all immediately in global scope, app.js calls these when data is loaded.

// ── TASKS RENDER ─────────────────────────────────────────

function renderTasks() {
  const container = document.getElementById('tasks-list-container');
  const recurringContainer = document.getElementById('recurring-list-container');
  const recurringHeader = document.getElementById('tasks-recurring-header');

  if (!container) return; // fail gracefully if element doesn't exist

  // Find all items belonging to 'task' category that aren't purely archived/deleted
  const tasks = items.filter(i => i.category === 'task' && i.status !== 'archived' && !i.recurring);
  const recurringTasks = items.filter(i => i.category === 'task' && i.status !== 'archived' && i.recurring);

  // 1) Standard Tasks
  if (tasks.length === 0) {
    container.innerHTML = `<p class="inbox-empty-text" style="font-size:16px;">No one-off tasks... yet.</p>`;
  } else {
    // Sort: active tasks first, then done tasks
    tasks.sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    container.innerHTML = tasks.map(t => {
      const isDone = t.status === 'done';
      return `
        <div class="task-list-item ${isDone ? 'status-done' : ''}">
          <div class="task-ring-toggle ${isDone ? 'completed' : ''}" onclick="toggleTaskCompletion('${t.id}')"></div>
          <div class="task-content">${t.content}</div>
        </div>
      `;
    }).join('');
  }

  // 2) Recurring Tasks
  if (recurringTasks.length === 0) {
    if (recurringHeader) recurringHeader.style.display = 'none';
    if (recurringContainer) recurringContainer.innerHTML = '';
  } else {
    if (recurringHeader) recurringHeader.style.display = 'block';
    recurringTasks.sort((a, b) => {
      if (a.status === 'done' && b.status !== 'done') return 1;
      if (a.status !== 'done' && b.status === 'done') return -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    if (recurringContainer) {
      recurringContainer.innerHTML = recurringTasks.map(t => {
        const isDone = t.status === 'done';
        const rLabel = t.recurring === 'daily' ? 'D' : t.recurring === 'weekly' ? 'W' : t.recurring === 'monthly' ? 'M' : '↻';
        return `
          <div class="task-list-item ${isDone ? 'status-done' : ''}">
            <div class="task-ring-toggle ${isDone ? 'completed' : ''}" onclick="toggleTaskCompletion('${t.id}')"></div>
            <div class="task-content">${t.content}</div>
            <div class="task-item-actions">
               <button class="recurring-btn active" title="Recurrence: ${t.recurring}">${rLabel}</button>
            </div>
          </div>
        `;
      }).join('');
    }
  }
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

function renderAllViews() {
  renderInbox();
  renderProjects();
  renderWorkScreen();
  renderArchived();
  renderTasks();
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

// ── DONE LOG ─────────────────────────────────────────────
let doneOpen = false;
function toggleDone() {
  doneOpen = !doneOpen;
  const toggle = document.getElementById('done-toggle');
  const list = document.getElementById('done-list');
  if (toggle) toggle.classList.toggle('open', doneOpen);
  if (list) list.classList.toggle('open', doneOpen);
  if (doneOpen) renderDone();
}

function renderDone() {
  const list = document.getElementById('done-list');
  if (!list) return;
  const doneItems = items.filter(i => i.status === 'done');
  if (!doneItems.length) { list.innerHTML = '<p style="padding:16px 4px;font-size:12px;color:var(--text-muted)">No completed items.</p>'; return; }
  list.innerHTML = doneItems.map(item => `
    <div class="archived-item">
      <span class="archived-item-text">${esc(item.content)}</span>
      <button class="archived-item-restore" onclick="restoreItem('${item.id}')">Undo</button>
    </div>`).join('');
}

function restoreItem(id) {
  const item = items.find(i => i.id === id);
  if (item) {
    item.status = 'fresh';
    item.touchedAt = new Date().toISOString();
    save();
    if (archiveOpen) renderArchive();
    if (doneOpen) renderDone();
    renderInbox();
    showToast('Restored');
  }
}

