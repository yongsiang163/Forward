// ── INBOX RENDER ─────────────────────────────────────────
let _searchQuery = '';
let _searchDebounce = null;
let _activeTag = null;

function setFilter(btn, filter) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  S.filter = filter;
  renderInbox();
}

function onSearchInput(val) {
  clearTimeout(_searchDebounce);
  _searchDebounce = setTimeout(() => {
    _searchQuery = val.toLowerCase().trim();
    renderInbox();
  }, 200);
}

function setTagFilter(tag) {
  _activeTag = _activeTag === tag ? null : tag;
  renderInbox();
}

function renderTagChips() {
  const tagsEl = document.getElementById('inbox-tags');
  if (!tagsEl) return;

  // Collect all unique #tags from active items
  const tagSet = new Set();
  items.forEach(item => {
    if (item.status === 'archived') return;
    const matches = (item.content || '').match(/#[a-zA-Z0-9_]+/g);
    if (matches) matches.forEach(t => tagSet.add(t.toLowerCase()));
  });

  if (tagSet.size === 0) {
    tagsEl.innerHTML = '';
    return;
  }

  const tags = [...tagSet].sort();
  tagsEl.innerHTML = tags.map(t =>
    `<button class="tag-chip ${_activeTag === t ? 'active' : ''}" onclick="setTagFilter('${t}')">${t}</button>`
  ).join('');
}

function renderInbox() {
  runLifecycle();
  const list = document.getElementById('inbox-list');
  const title = document.getElementById('inbox-title');

  let active = items.filter(i =>
    i.status !== 'archived' &&
    i.status !== 'done' &&
    !(i.confirmed && (i.category === 'task' || i.aiCategory === 'task'))
  );

  // Category filter
  const filtered = S.filter === 'all'
    ? active
    : active.filter(i => (i.aiCategory || i.category) === S.filter);

  // Search filter
  let searched = filtered;
  if (_searchQuery) {
    searched = filtered.filter(i => {
      const haystack = [i.content, i.aiTitle, i.aiSummary, i.rawContent].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(_searchQuery);
    });
  }

  // Tag filter
  if (_activeTag) {
    searched = searched.filter(i => (i.content || '').toLowerCase().includes(_activeTag));
  }

  const fresh = searched.filter(i => i.status === 'fresh' || i.status === 'alive');
  const cold = searched.filter(i => i.status === 'cold');

  // Dynamic title
  const freshCount = items.filter(i => i.status === 'fresh').length;
  if (title) title.textContent = freshCount > 0
    ? `${freshCount} fresh item${freshCount !== 1 ? 's' : ''}`
    : 'Everything';

  // Render tags
  renderTagChips();

  if (searched.length === 0) {
    list.innerHTML = `
      <div class="inbox-empty">
        <div class="inbox-empty-orb"></div>
        <p class="inbox-empty-text">${_searchQuery || _activeTag ? 'No matches.' : 'Nothing here yet.<br>Capture something.'}</p>
      </div>`;
    return;
  }

  let html = fresh.map(i => renderItemHTML(i)).join('');

  // Cold items — collapsed block
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

  // Brain dump title
  const titleHTML = item.aiTitle
    ? `<p class="inbox-item-title">${esc(item.aiTitle)}</p>`
    : '';

  // Raw text toggle (only if summarised)
  const rawToggleHTML = item.rawContent
    ? `<button class="inbox-item-raw-toggle" onclick="event.stopPropagation(); toggleRawContent('${item.id}')">Show original</button>
       <div class="inbox-item-raw" id="raw-${item.id}" style="display:none;">
         <p>${esc(item.rawContent)}</p>
       </div>`
    : '';

  // Extracted actions
  let actionsHTML = '';
  if (item.aiActions && item.aiActions.length > 0) {
    actionsHTML = `<div class="inbox-item-actions">${item.aiActions.map((a, i) =>
      `<div class="inbox-action-item">
        <span class="inbox-action-bullet">•</span>
        <span class="inbox-action-text">${esc(a)}</span>
      </div>`
    ).join('')}</div>`;
  }

  return `
    <div class="inbox-item cat-${cat}${isCold ? ' status-cold' : ''}" onclick="openItemAction('${item.id}')">
      <div class="inbox-item-bar"></div>
      ${titleHTML}
      <p class="inbox-item-content">${esc(item.content)}</p>
      ${actionsHTML}
      ${rawToggleHTML}
      <div class="inbox-item-footer">
        <span class="inbox-item-time">${offlineDot}${timeAgo(item.createdAt)}</span>
        <span class="cat-tag ${tagClass}" ${tagAction}>${label}</span>
        ${pendingHint}
        ${developBtn}
        <button class="inbox-item-archive" onclick="archiveItem('${item.id}')" title="Archive">↓</button>
      </div>
    </div>`;
}

function toggleRawContent(id) {
  const el = document.getElementById(`raw-${id}`);
  if (!el) return;
  if (el.style.display === 'none') {
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
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

  // Overwhelmed state — redirect to Rewind, don't surface tasks
  if (moodInfo && moodInfo.state === 'overwhelmed') {
    area.innerHTML = `
      <div class="work-empty" style="text-align:center;">
        <p class="work-empty-text" style="margin-bottom:16px;">
          Right now isn't for doing.<br>
          Go inward first. Come back when you're ready.
        </p>
        <a href="https://yongsiang163.github.io/Rewind/" target="_blank" rel="noopener"
           style="display:inline-block; padding:14px 28px; background:rgba(196,149,106,0.1);
           border:1px solid rgba(196,149,106,0.25); border-radius:14px; color:var(--warm);
           text-decoration:none; font-family:var(--ui-font); font-size:14px; letter-spacing:0.5px;">
          Open Rewind →
        </a>
        <p class="work-empty-cta" onclick="S.rewindSession=null; renderWork();"
           style="margin-top:20px; font-size:12px; color:var(--text-muted);">
          or continue anyway
        </p>
      </div>`;
    return;
  }

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
        <span class="project-phase-pill" style="margin-right:8px">${(PROJECT_CATS[linkedProject.projectCat || 'open']?.phaseLabels?.[linkedProject.phase] || linkedProject.phase) || ''}</span>
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

  // Quick Wins — for low-energy moods, show 3 shortest tasks as gentle alternatives
  if (moodInfo && (moodInfo.state === 'fatigued' || session?.mood === 'Restless')) {
    const quickWins = items
      .filter(i => i.category === 'task' && i.status !== 'archived' && i.status !== 'done' && i.id !== candidate.id)
      .sort((a, b) => a.content.length - b.content.length)
      .slice(0, 3);

    if (quickWins.length > 0) {
      const qwHtml = `
        <div class="quick-wins-card">
          <p class="quick-wins-label">Or try a quick win</p>
          ${quickWins.map(t => `
            <div class="quick-win-item" onclick="S.currentWorkItem=items.find(i=>i.id==='${t.id}');enterFocus();">
              <span class="quick-win-dot"></span>
              <span class="quick-win-text">${esc(t.content)}</span>
            </div>
          `).join('')}
        </div>`;
      area.insertAdjacentHTML('beforeend', qwHtml);
    }
  }
}

function pickWorkItem(moodInfo) {
  const now = Date.now();
  const state = moodInfo ? moodInfo.state : 'drifting';

  // Base filter: exclude archived, done, and sparks
  let pool = items.filter(i =>
    i.status !== 'archived' &&
    i.status !== 'done' &&
    i.category !== 'spark'
  );
  if (!pool.length) return null;

  // Heavy/Fatigued: only short items (< 80 chars), prefer tasks over projects
  if (state === 'fatigued') {
    const short = pool.filter(i => i.content.length < 80 && i.category === 'task');
    if (short.length) pool = short;
    else {
      const anyShort = pool.filter(i => i.content.length < 80);
      if (anyShort.length) pool = anyShort;
    }
  }

  // Score each candidate
  const scored = pool.map(item => {
    let score = 0;

    // 1. Freshness — fresh items get a boost
    if (item.status === 'fresh') score += 30;
    else if (item.status === 'alive') score += 15;
    // cold items get no boost — but are still eligible

    // 2. Recency — newer items surface first (max 20 pts)
    const ageHrs = (now - new Date(item.createdAt).getTime()) / 3600000;
    score += Math.max(0, 20 - ageHrs * 0.5); // decays over ~40 hours

    // 3. Recently touched items are deprioritised (avoid repetition)
    if (item.touchedAt) {
      const touchHrs = (now - new Date(item.touchedAt).getTime()) / 3600000;
      if (touchHrs < 2) score -= 15; // recently seen — push down
    }

    // 4. Project urgency — items linked to quiet projects get a boost
    if (item.projectId) {
      const proj = projects.find(p => p.id === item.projectId);
      if (proj && proj.touchedAt) {
        const projQuietDays = (now - new Date(proj.touchedAt).getTime()) / 86400000;
        if (projQuietDays >= 9) score += 25; // "this one has been quiet"
        else if (projQuietDays >= 5) score += 10;
      }
    }

    // 5. Mood-appropriate sizing
    if (state === 'focused') {
      // Focused: slight preference for meatier tasks
      if (item.content.length > 40) score += 5;
    } else if (state === 'fatigued') {
      // Fatigued: strong preference for tiny tasks
      if (item.content.length < 40) score += 15;
    }

    // 6. Category priorities — tasks > reminders > projects
    if (item.category === 'task') score += 5;
    else if (item.category === 'reminder') score += 8; // reminders are time-sensitive

    return { item, score };
  });

  // Sort by score descending, pick the best
  scored.sort((a, b) => b.score - a.score);
  return scored[0].item;
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
  let html = '';
  for (let i = 0; i < steps.length; i++) {
    const done = i < S.mvnaStep;
    const current = i === S.mvnaStep;
    const future = i > S.mvnaStep;
    if (future) continue; // withheld — never shown until previous is done
    html += `
      <div class="mvna-step ${current ? 'current' : ''} ${done ? 'done' : ''}">
        <div class="mvna-step-num">${done ? '✓' : ''}</div>
        <p class="mvna-step-text">${esc(steps[i])}</p>
        ${current ? `<button class="mvna-done-btn" onclick="completeStep(${i})">✓</button>` : ''}
      </div>`;
  }
  // Progress hint — e.g. "step 1 of 3" without revealing what's next
  if (S.mvnaStep < steps.length) {
    html += `<p style="font-size:11px; color:var(--text-muted); text-align:center; margin-top:12px; letter-spacing:1px;">step ${S.mvnaStep + 1} of ${steps.length}</p>`;
  }
  container.innerHTML = html;
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
  const session = S.rewindSession;

  const ICONS = { Heavy: '🌧', Tired: '🌫', Restless: '⚡', Okay: '🌤', Calm: '🌊', Alive: '✨' };

  if (!session) {
    line.className = 'home-state-line no-session';
    line.innerHTML = `Open <strong style="color:var(--warm)">Rewind</strong> to check in for a better experience.`;
  } else {
    const moodInfo = MOOD_MAP[session.mood] || MOOD_MAP.Okay;
    const icon = ICONS[session.mood] || '';
    line.className = 'home-state-line';
    line.innerHTML = `${icon} <em>${session.mood}</em> &middot; ${moodInfo.label}`;
    S.attentionState = moodInfo.state;
  }

  renderMomentum();
  updateStats();
}

function renderMomentum() {
  const wrap = document.getElementById('momentum-wrap');
  const bar = document.getElementById('momentum-bar');
  const label = document.getElementById('momentum-label');
  const dotsEl = document.getElementById('momentum-dots');
  if (!wrap || !bar || !label || !dotsEl) return;

  const activityDays = getActivityDays();
  const count = activityDays.size;

  // 7-day dot row — filled for active days, empty for rest
  const today = new Date();
  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  let dotsHtml = '';
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const active = activityDays.has(iso);
    const isToday = i === 0;
    dotsHtml += `<div class="momentum-dot ${active ? 'active' : ''} ${isToday ? 'today' : ''}">
      <span class="momentum-day-label">${dayLabels[d.getDay()]}</span>
    </div>`;
  }
  dotsEl.innerHTML = dotsHtml;

  // Glow bar fill + label
  const pct = Math.round((count / 7) * 100);
  bar.style.width = pct + '%';

  if (count >= 5) {
    bar.className = 'momentum-bar warm';
    label.textContent = "You've been showing up";
    label.className = 'momentum-label warm';
  } else if (count >= 2) {
    bar.className = 'momentum-bar amber';
    label.textContent = 'Momentum building';
    label.className = 'momentum-label amber';
  } else if (count === 1) {
    bar.className = 'momentum-bar soft';
    label.textContent = '';
    label.className = 'momentum-label';
  } else {
    bar.className = 'momentum-bar soft';
    // Check if user has any items at all (returning user vs new user)
    if (items.length > 0) {
      label.textContent = 'Welcome back. Pick up wherever feels right.';
    } else {
      label.textContent = '';
    }
    label.className = 'momentum-label';
  }
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

  if (!container) return;

  // Separate tasks into categories
  const allTasks = items.filter(i => i.category === 'task' && i.status !== 'archived');

  // Recurring tasks — due (active) and done today
  const recurringDue = allTasks.filter(i => i.recurring && i.status !== 'done');
  const recurringDone = allTasks.filter(i => i.recurring && i.status === 'done');

  // One-off tasks
  const oneOffActive = allTasks.filter(i => !i.recurring && i.status !== 'done');
  const oneOffDone = allTasks.filter(i => !i.recurring && i.status === 'done');

  // 1) Recurring — Due Today section
  if (recurringDue.length > 0 || recurringDone.length > 0) {
    if (recurringHeader) recurringHeader.style.display = 'block';

    if (recurringContainer) {
      let rhtml = '';

      // Due now
      if (recurringDue.length > 0) {
        rhtml += recurringDue.map(t => {
          const rLabel = t.recurring === 'daily' ? 'D' : t.recurring === 'weekly' ? 'W' : 'M';
          return `
          <div class="task-list-item">
            <div class="task-ring-toggle" onclick="toggleTaskCompletion('${t.id}')"></div>
            <div class="task-content">${t.content}</div>
            <div class="task-item-actions">
               <button class="recurring-btn active" title="Recurrence: ${t.recurring}">${rLabel}</button>
            </div>
          </div>`;
        }).join('');
      }

      // Done today (recurring)
      if (recurringDone.length > 0) {
        const resetLabel = { daily: 'resets tomorrow', weekly: 'resets next week', monthly: 'resets next month' };
        rhtml += recurringDone.map(t => {
          const rLabel = t.recurring === 'daily' ? 'D' : t.recurring === 'weekly' ? 'W' : 'M';
          return `
          <div class="task-list-item status-done">
            <div class="task-ring-toggle completed" onclick="toggleTaskCompletion('${t.id}')"></div>
            <div class="task-content">${t.content}</div>
            <div class="task-item-actions">
               <span style="font-size:9px; color:var(--text-muted); letter-spacing:0.5px;">${resetLabel[t.recurring] || 'resets'}</span>
               <button class="recurring-btn active" title="Recurrence: ${t.recurring}">${rLabel}</button>
            </div>
          </div>`;
        }).join('');
      }

      recurringContainer.innerHTML = rhtml;
    }
  } else {
    if (recurringHeader) recurringHeader.style.display = 'none';
    if (recurringContainer) recurringContainer.innerHTML = '';
  }

  // 2) One-off Tasks
  if (oneOffActive.length === 0 && oneOffDone.length === 0) {
    container.innerHTML = `<p class="inbox-empty-text" style="font-size:16px;">No one-off tasks... yet.</p>`;
  } else {
    oneOffActive.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    let html = oneOffActive.map(t => `
      <div class="task-list-item">
        <div class="task-ring-toggle" onclick="toggleTaskCompletion('${t.id}')"></div>
        <div class="task-content">${t.content}</div>
      </div>
    `).join('');

    if (oneOffDone.length > 0) {
      html += `<p style="font-size:11px; color:var(--text-muted); letter-spacing:1px; margin:20px 0 8px; text-transform:uppercase;">Done today · dismissed after 24h</p>`;
      html += oneOffDone.map(t => `
        <div class="task-list-item status-done">
          <div class="task-ring-toggle completed" onclick="toggleTaskCompletion('${t.id}')"></div>
          <div class="task-content">${t.content}</div>
        </div>
      `).join('');
    }

    container.innerHTML = html;
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
  const screenEl = document.getElementById('screen-' + id);
  if (!screenEl) { console.warn('Screen not found:', id); return; }
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  screenEl.classList.add('active');

  // If we navigated to a Forward screen via Bottom Nav, ensuring Rewind is hidden
  const rewindEl = document.getElementById('rewind-mode-container');
  if (rewindEl) rewindEl.style.display = 'none';

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
  if (id === 'tasks') renderTasks();
  if (id === 'home') renderHome();
}

function renderAllViews() {
  renderInbox();
  renderProjects();
  renderWork();
  renderArchive();
  if (typeof renderTasks === 'function') renderTasks();
}

// ── DATA EXPORT ───────────────────────────────────────────
function exportData() {
  const payload = {
    exported: new Date().toISOString(),
    app: 'Forward', version: '1.0',
    totalItems: items.length, items, projects
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `forward-backup-${new Date().toISOString().slice(0, 10)}.json` });
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded');
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const payload = JSON.parse(ev.target.result);
        if (!payload.items || !Array.isArray(payload.items)) {
          showToast('Invalid backup file');
          return;
        }
        items = payload.items;
        save();
        if (payload.projects && Array.isArray(payload.projects)) {
          projects = payload.projects;
          saveProjects();
        }
        renderAllViews();
        showToast(`Restored ${items.length} items`);
      } catch (err) {
        console.error('Import failed:', err);
        showToast('Import failed — invalid file');
      }
    };
    reader.readAsText(file);
  };
  input.click();
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

// ── WEEKLY REVIEW ────────────────────────────────────────
function openWeeklyReview() {
  const sheet = document.getElementById('weekly-review-sheet');
  if (!sheet) return;
  renderWeeklyReviewPanels();
  sheet.style.display = 'flex';
}

function closeWeeklyReview() {
  const sheet = document.getElementById('weekly-review-sheet');
  if (sheet) sheet.style.display = 'none';
}

function renderWeeklyReviewPanels() {
  const panels = document.getElementById('weekly-review-panels');
  const aiArea = document.getElementById('weekly-review-ai');
  if (!panels) return;

  const now = Date.now();
  const weekAgo = now - 7 * 86400000;

  // What moved — completed items this week
  const completed = items.filter(i =>
    (i.status === 'done' || i.status === 'archived') &&
    i.completedAt && new Date(i.completedAt).getTime() >= weekAgo
  );

  // What's stale — projects not touched in 7+ days
  const staleProjects = projects.filter(p => {
    if (p.status === 'archived') return false;
    const touched = p.touchedAt ? new Date(p.touchedAt).getTime() : new Date(p.createdAt).getTime();
    return (now - touched) > 7 * 86400000;
  });

  // What's next — fresh items that need attention
  const freshItems = items.filter(i => i.status === 'fresh' || i.status === 'alive')
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(0, 5);

  let html = '';

  // Panel 1: What Moved
  html += `<div class="wr-panel">
    <p class="wr-panel-label">What moved</p>
    ${completed.length > 0
      ? completed.map(i => `<p class="wr-item done">✓ ${esc(i.content)}</p>`).join('')
      : '<p class="wr-item muted">Nothing completed this week. That\'s okay.</p>'}
  </div>`;

  // Panel 2: What's Stale
  html += `<div class="wr-panel">
    <p class="wr-panel-label">What's stale</p>
    ${staleProjects.length > 0
      ? staleProjects.map(p => {
        const days = Math.floor((now - new Date(p.touchedAt || p.createdAt).getTime()) / 86400000);
        return `<p class="wr-item stale">${esc(p.name)} <span class="wr-days">${days}d</span></p>`;
      }).join('')
      : '<p class="wr-item muted">Everything\'s been touched recently.</p>'}
  </div>`;

  // Panel 3: What's Next
  html += `<div class="wr-panel">
    <p class="wr-panel-label">What's next</p>
    ${freshItems.length > 0
      ? freshItems.map(i => `<p class="wr-item">${esc(i.content)}</p>`).join('')
      : '<p class="wr-item muted">Inbox is clear. Nice.</p>'}
  </div>`;

  panels.innerHTML = html;

  // Optional AI insight
  if (aiArea && getGeminiKey && getGeminiKey()) {
    aiArea.innerHTML = '<p style="font-size:11px;color:var(--text-muted);text-align:center;">Generating insight…</p>';
    aiWeeklyInsight(completed, staleProjects, freshItems).then(insight => {
      if (insight) {
        aiArea.innerHTML = `<div class="wr-ai-insight"><p class="wr-panel-label">AI Insight</p><p class="wr-ai-text">${esc(insight)}</p></div>`;
      } else {
        aiArea.innerHTML = '';
      }
    }).catch(() => { aiArea.innerHTML = ''; });
  } else {
    if (aiArea) aiArea.innerHTML = '';
  }
}
