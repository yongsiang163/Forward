// ── CAPTURE ──────────────────────────────────────────────
let activeCaptureProjectId = null;
let editingProjectId = null;
let npPhase = 'concept';
let psPhase = null;

// ── ORB LONG-PRESS → VOICE CAPTURE ──────────────────────
let _orbTimer = null;
let _orbFired = false;

function orbTouchStart(e) {
  _orbFired = false;
  _orbTimer = setTimeout(() => {
    _orbFired = true;
    // Haptic feedback on supported devices
    if (navigator.vibrate) navigator.vibrate(30);
    // Open capture + start voice
    openCapture();
    setTimeout(() => toggleVoiceCapture(), 450);
  }, 500);
}

function orbTouchEnd(e) {
  clearTimeout(_orbTimer);
  if (!_orbFired) {
    // Short tap — normal text capture
    openCapture();
  }
  e.preventDefault(); // prevent double-fire on touch devices
}

// ── VOICE CAPTURE (Web Speech API) ───────────────────────
let _recognition = null;
let _voiceActive = false;

function toggleVoiceCapture() {
  if (_voiceActive) {
    stopVoiceCapture();
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    showToast('Voice capture not supported in this browser');
    return;
  }

  const ta = document.getElementById('capture-textarea');
  const micBtn = document.getElementById('capture-mic-btn');
  const hint = document.getElementById('capture-voice-hint');

  _recognition = new SpeechRecognition();
  _recognition.continuous = true;
  _recognition.interimResults = true;
  _recognition.lang = 'en-US';

  let finalTranscript = ta.value; // preserve existing text
  let separator = finalTranscript.length > 0 ? ' ' : '';

  _recognition.onstart = () => {
    _voiceActive = true;
    micBtn.classList.add('listening');
    hint.textContent = 'listening…';
    hint.classList.add('visible');
  };

  _recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += separator + transcript;
        separator = ' ';
      } else {
        interim = transcript;
      }
    }
    ta.value = finalTranscript + (interim ? separator + interim : '');
    onCaptureType();
  };

  _recognition.onerror = (event) => {
    console.warn('Speech recognition error:', event.error);
    if (event.error === 'not-allowed') {
      showToast('Microphone access denied');
    } else if (event.error !== 'aborted') {
      showToast('Voice capture ended');
    }
    stopVoiceCapture();
  };

  _recognition.onend = () => {
    // Finalise the transcript
    const ta2 = document.getElementById('capture-textarea');
    if (ta2 && ta2.value) onCaptureType();
    stopVoiceCapture();
  };

  try {
    _recognition.start();
  } catch (e) {
    showToast('Could not start voice capture');
    stopVoiceCapture();
  }
}

function stopVoiceCapture() {
  _voiceActive = false;
  if (_recognition) {
    try { _recognition.stop(); } catch (e) { }
    _recognition = null;
  }
  const micBtn = document.getElementById('capture-mic-btn');
  const hint = document.getElementById('capture-voice-hint');
  if (micBtn) micBtn.classList.remove('listening');
  if (hint) { hint.textContent = ''; hint.classList.remove('visible'); }
}

function openCapture() {
  const sheet = document.getElementById('capture-sheet');
  const ta = document.getElementById('capture-textarea');
  sheet.classList.add('active');
  ta.value = '';
  activeCaptureProjectId = null;
  document.getElementById('capture-project-btn').textContent = '@ Project';
  document.getElementById('capture-project-btn').style.borderColor = '';
  onCaptureType();
  stopVoiceCapture();
  setTimeout(() => ta.focus(), 380);
}

function onCaptureType() {
  const ta = document.getElementById('capture-textarea');
  document.getElementById('capture-char').textContent = ta.value.length;
}

function trashCapture() {
  stopVoiceCapture();
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
    // Sort by longest name first to match "Master Bedroom" before "Master"
    const sortedProjects = [...projects].sort((a, b) => (b.name || '').length - (a.name || '').length);
    for (let p of sortedProjects) {
      if (p.name && rawText.toLowerCase().includes('@' + p.name.toLowerCase())) {
        finalProjectId = p.id;
        break;
      }
    }
  }

  if (finalProjectId) finalCategory = 'task';

  // Brain dump detection: if text is long (>80 chars), treat as single item
  const isBrainDump = rawText.length > 80;
  const lines = isBrainDump
    ? [rawText]  // keep as one item
    : rawText.split(/\r?\n/).filter(l => l.trim().length > 0);

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
      aiPending: !finalProjectId && !navigator.onLine,
      // Brain dump fields
      rawContent: null,
      aiTitle: null,
      aiSummary: null,
      aiActions: null
    };

    items.unshift(item);
    itemsSaved++;

    if (!finalProjectId && navigator.onLine) {
      categoriseItem(item);
    }

    // Trigger brain dump summarisation in background for long captures
    if (isBrainDump && navigator.onLine && typeof aiSummarise === 'function') {
      summariseItem(item);
    }
  }

  if (itemsSaved > 0) {
    save();
    showToast(isBrainDump ? 'Captured — AI is summarising ✦' : (itemsSaved > 1 ? `Captured ${itemsSaved} items ✦` : 'Captured ✦'));
    updateStats();
    if (S.screen === 'inbox') renderInbox();
  }

  // Dismiss
  ta.value = '';
  document.getElementById('capture-sheet').classList.remove('active');
}

async function summariseItem(item) {
  try {
    const result = await aiSummarise(item.content);
    if (!result) return;

    const idx = items.findIndex(i => i.id === item.id);
    if (idx === -1) return;

    items[idx].rawContent = items[idx].content;
    items[idx].aiTitle = result.title;
    items[idx].aiSummary = result.summary;
    items[idx].content = result.summary; // display summary as main content
    items[idx].aiActions = result.actions.length > 0 ? result.actions : null;

    save();
    if (S.screen === 'inbox') renderInbox();
  } catch (e) {
    console.warn('Summarise item failed:', e.message);
  }
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
  } catch (e) {
    console.error("AI categorization failed:", e);
    const idx = items.findIndex(i => i.id === item.id);
    if (idx !== -1) {
      items[idx].aiPending = false;
      save();
    }
  }
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
  if (items[idx].category === 'task') {
    showToast('Moved to Tasks');
    if (typeof renderTasks === 'function') renderTasks();
  }
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

// ── PROJECT DETAIL SHEET ─────────────────────────────────
function openProjectSheet(id) {
  const p = projects.find(x => x.id === id);
  if (!p) return;
  editingProjectId = id;
  psPhase = p.phase || Object.keys((PROJECT_CATS[p.projectCat] || PROJECT_CATS.open).phaseLabels)[0];

  document.getElementById('ps-name').value = p.name || '';
  // Vision lock — frozen after 48 hours from creation
  const visionEl = document.getElementById('ps-vision');
  const visionLockLabel = document.getElementById('ps-vision-lock');
  const visionLocked = p.visionLockedAt && Date.now() > new Date(p.visionLockedAt).getTime();
  if (visionLocked) {
    visionEl.textContent = p.vision || 'No vision captured.';
    visionEl.contentEditable = 'false';
    if (visionLockLabel) visionLockLabel.textContent = 'captured when you believed in this · cannot be edited';
  } else {
    visionEl.textContent = p.vision || '';
    visionEl.contentEditable = 'true';
    visionEl.style.cursor = 'text';
    const hoursLeft = p.visionLockedAt ? Math.max(0, Math.ceil((new Date(p.visionLockedAt).getTime() - Date.now()) / 3600000)) : 0;
    if (visionLockLabel) visionLockLabel.textContent = hoursLeft > 0 ? `editable for ${hoursLeft} more hours` : 'editable — will lock after 48 hours';
  }
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

  // Render Linked Captured Items
  renderProjectItems(p.name);

  // Reset AI thread
  document.getElementById('project-ai-thread').classList.remove('open');
  document.getElementById('ai-messages').innerHTML = '';
  document.getElementById('project-ai-btn-label').textContent = 'Talk to AI →';

  document.getElementById('project-sheet').classList.add('active');

  // Auto-suggest next action if empty
  if (!p.nextAction) setTimeout(() => autoSuggestNextAction(p), 800);
}

function renderProjectItems(projectName) {
  const section = document.getElementById('ps-captured-section');
  const list = document.getElementById('ps-captured-list');
  if (!section || !list) return;

  // We find items linked to this project by checking if it contains @ProjectName
  const linkedItems = items.filter(i =>
    i.status !== 'archived' &&
    i.status !== 'done' &&
    i.content.includes('@' + projectName)
  );

  if (linkedItems.length === 0) {
    section.style.display = 'none';
    list.innerHTML = '';
    return;
  }

  section.style.display = 'block';
  list.innerHTML = linkedItems.map(i => {
    const cat = i.aiCategory || i.category;
    return `
      <div class="inbox-item cat-${cat}" style="margin-bottom:0;" onclick="openItemAction('${i.id}')">
        <div class="inbox-item-bar"></div>
        <p class="inbox-item-content">${esc(i.content)}</p>
      </div>`;
  }).join('');
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
  // Save vision if still editable (not locked)
  const visionLocked = p.visionLockedAt && Date.now() > new Date(p.visionLockedAt).getTime();
  if (!visionLocked) {
    const visionEl = document.getElementById('ps-vision');
    if (visionEl) p.vision = visionEl.textContent.trim();
  }
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

function archiveProject() {
  if (!editingProjectId) return;
  const p = projects.find(x => x.id === editingProjectId);
  if (!p) return;
  p.status = 'archived';
  p.touchedAt = new Date().toISOString();
  saveProjects();
  renderProjects();
  closeProjectSheet();
  showToast('Project archived');
}

function deleteProjectPrompt() {
  if (confirm("Are you sure you want to permanently delete this project? This cannot be undone.")) {
    if (!editingProjectId) return;
    const projectIndex = projects.findIndex(x => x.id === editingProjectId);
    if (projectIndex > -1) {
      projects.splice(projectIndex, 1);
      saveProjects();
      renderProjects();
      closeProjectSheet();
      showToast('Project deleted');
    }
  }
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

function changeCategoryStateAndDismiss(itemId, cat) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  item.category = cat;
  item.touchedAt = new Date().toISOString();

  // If we assigned it to task or active project, we can dismiss it from Inbox status 
  // It effectively remains in 'alive', or 'task' list
  if (cat === 'task') {
    item.status = 'active'; // Move it out of fresh inbox explicitly
    showToast('Sent to Tasks');
  }

  save();
  renderAllViews();
}

// ── TASK COMPLETION & RECURRENCE ─────────────────────────────
function toggleTaskCompletion(itemId) {
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  if (item.status === 'done') {
    item.status = 'active';
    item.completedAt = null;
  } else {
    item.status = 'done';
    item.completedAt = new Date().toISOString();

    // If it's recurring, keep active but note it was touched
    if (item.recurring) {
      item.status = 'active';
      item.lastCompletedAt = new Date().toISOString();
      showToast('Task marked done (Recurring)');
    }
  }
  item.touchedAt = new Date().toISOString();
  save();
  renderAllViews();
}

function iaToggleRecurring() {
  if (!activeItemId) return;
  const item = items.find(i => i.id === activeItemId);
  if (!item) return;

  const order = [null, 'daily', 'weekly', 'monthly'];
  const curIdx = order.indexOf(item.recurring || null);
  const nextIdx = (curIdx + 1) % order.length;
  item.recurring = order[nextIdx];

  item.touchedAt = new Date().toISOString();
  save();
  renderAllViews();

  const labelMap = { 'daily': 'Daily', 'weekly': 'Weekly', 'monthly': 'Monthly' };
  const btn = document.getElementById('ia-recurring-btn');
  if (btn) btn.textContent = item.recurring ? `Recurrence: ${labelMap[item.recurring]}` : 'Recurrence: None';

  showToast(item.recurring ? `Set ${labelMap[item.recurring]}` : 'Recurrence removed');
}

// ── ITEM ACTION SHEET (Edit/Categorise) ──────────────────
function iaDone() {
  if (activeItemId) {
    const item = items.find(i => i.id === activeItemId);
    if (item) { item.status = 'done'; item.touchedAt = new Date().toISOString(); save(); }
  }
  closeItemAction();
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

// ── ADD TO EXISTING PROJECT ──────────────────────────────────
function openAddToExistingProject() {
  closeItemAction();
  const epSheet = document.getElementById('existing-project-sheet');
  const list = document.getElementById('ep-list');
  const activeProjects = projects.filter(p => p.status === 'active');
  if (activeProjects.length === 0) {
    showToast('No active projects');
    return;
  }
  list.innerHTML = activeProjects.map(p => `
      <button class="ep-list-btn" onclick="addToProject('${p.id}', '${activeItemId}')">
        <strong>${p.name}</strong>
      </button>
   `).join('');
  epSheet.classList.add('active');
}

function closeExistingProjectSheet() {
  document.getElementById('existing-project-sheet').classList.remove('active');
}

// ── REWIND INTEGRATION ────────────────────────────────────
function toggleRewindMode() {
  const container = document.getElementById('rewind-mode-container');
  const forwardNav = document.getElementById('forward-bottom-nav');
  if (!container) return;

  const isShown = container.style.display !== 'none';
  if (isShown) {
    if (typeof showScreen === 'function') {
      showScreen(S.screen || 'home');
    }
    if (forwardNav) forwardNav.style.display = 'flex';
    container.style.display = 'none';
  } else {
    // Hide all Forward screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    // Un-highlight nav buttons except the rewind one
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    // Hide Forward nav entirely
    if (forwardNav) forwardNav.style.display = 'none';

    // Reset Rewind iframe to welcome screen when entering
    const iframe = document.getElementById('rewind-iframe');
    if (iframe && iframe.contentWindow && iframe.contentWindow.navigate) {
      iframe.contentWindow.navigate('welcome');
    }

    container.style.display = 'flex';
  }
}

function addToProject(projectId, itemId) {
  const p = projects.find(x => x.id === projectId);
  const item = items.find(i => i.id === itemId);
  if (p && item) {
    p.notes = (p.notes ? p.notes + "\n\n" : "") + item.content;
    p.touchedAt = new Date().toISOString();
    item.status = 'archived';
    save();
    saveProjects();
    renderAllViews();
    showToast(`Added to ${p.name}`);
  }
  closeExistingProjectSheet();
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
    touchedAt: new Date().toISOString(),
    visionLockedAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
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
  item.status = 'archived'; // Remove from inbox view after promotion
  save();
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
