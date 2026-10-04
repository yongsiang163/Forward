// ── CONSTANTS ──────────────────────────────────────────
const CAT_LABELS = { task: 'Task', project: 'Project', spark: 'Spark', reminder: 'Reminder', uncategorised: 'Uncategorised' };

// Differentiated lifecycle by category — the core graveyard prevention logic
const LIFECYCLE = {
  task: { freshHrs: 48, coldDays: 30, archiveDays: 90 },
  project: { freshHrs: Infinity, coldDays: 30, archiveDays: Infinity }, // never auto-archived
  spark: { freshHrs: 48, coldDays: null, archiveDays: Infinity },       // never auto-archived
  reminder: { freshHrs: 48, coldDays: null, archiveDays: null },        // handled by date
  uncategorised: { freshHrs: 48, coldDays: 30, archiveDays: 90 }
};

// Rewind mood → attention state map
const MOOD_MAP = {
  Alive: { state: 'focused', label: 'You\'re alive and ready.', maxSteps: 3 },
  Calm: { state: 'drifting', label: 'Calm today. One steady thing.', maxSteps: 3 },
  Okay: { state: 'drifting', label: 'Okay is enough. One step.', maxSteps: 2 },
  Restless: { state: 'drifting', label: 'Restless energy. One channel.', maxSteps: 2 },
  Tired: { state: 'fatigued', label: 'Tired. One very small thing.', maxSteps: 1 },
  Heavy: { state: 'fatigued', label: 'Running heavy. Just one thing.', maxSteps: 1 },
  Overwhelmed: { state: 'overwhelmed', label: 'Overwhelmed. Regulate first.', maxSteps: 0 }
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
  coldExpanded: false,
  currentWorkItem: null,
  mvnaSteps: [],
  mvnaStep: 0,
  focusActive: false,
  focusStart: null,
  focusTimer: null
};

let items = [];
let projects = [];

// ── STORAGE (IndexedDB via Dexie.js + localStorage mirror) ──
// Primary: IndexedDB (robust, large capacity, survives iOS eviction)
// Mirror: localStorage kept in sync for compatibility
// Migration: existing localStorage data auto-imported on first run

const forwardDB = new Dexie('ForwardDB');
forwardDB.version(1).stores({
  items: 'id, category, status, projectId, createdAt',
  projects: 'id, status, projectCat, createdAt'
});

// Request persistent storage to prevent iOS eviction
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then(granted => {
    if (granted) console.log('Persistent storage granted');
  });
}

// ── SYNC BOOKKEEPING ─────────────────────────────────────
// Only documents that actually changed are written to Firestore. Previously every save
// rewrote every item, which burned the free daily write quota and, past 500 items,
// exceeded Firestore's batch limit so cloud saves failed silently.
//
// Deletions are recorded as tombstones ({id, deleted:true}) so other devices — and this
// device's own local caches — learn about them instead of resurrecting the document.
const _synced = { items: new Map(), projects: new Map() }; // id → JSON last seen in cloud
const _snapReady = { items: false, projects: false };      // don't push before first snapshot
let _syncedUid = null;
let _unsubs = { items: null, projects: null };

let deletedIds = {}; // id → collection name
try { deletedIds = JSON.parse(localStorage.getItem('forward_deleted') || '{}') || {}; } catch (e) { deletedIds = {}; }
function _saveTombstones() {
  try { localStorage.setItem('forward_deleted', JSON.stringify(deletedIds)); } catch (e) { }
}

function _arr(col) { return col === 'items' ? items : projects; }
function _setArr(col, arr) { if (col === 'items') items = arr; else projects = arr; }
function _signedIn() { return typeof currentUser !== 'undefined' && currentUser && typeof db !== 'undefined'; }
function _docTime(d) { return new Date(d.touchedAt || d.updatedAt || d.createdAt || 0).getTime(); }
// Firestore rejects `undefined` field values — a JSON round-trip strips them
function _clean(d) { return JSON.parse(JSON.stringify(d)); }

function _pushChanges(col) {
  if (!_signedIn() || !_snapReady[col]) return;
  const synced = _synced[col];
  const ref = db.collection('users').doc(currentUser.uid).collection(col);
  const writes = [];
  _arr(col).forEach(d => {
    if (!d || !d.id || deletedIds[d.id]) return;
    const json = JSON.stringify(_clean(d));
    if (synced.get(d.id) !== json) writes.push({ id: d.id, data: JSON.parse(json), json });
  });
  Object.keys(deletedIds).forEach(id => {
    if (deletedIds[id] === col && synced.get(id) !== 'deleted') {
      writes.push({ id, data: { id, deleted: true, touchedAt: new Date().toISOString() }, json: 'deleted' });
    }
  });
  if (!writes.length) return;
  // Firestore batches hold max 500 writes
  for (let i = 0; i < writes.length; i += 400) {
    const chunk = writes.slice(i, i + 400);
    const batch = db.batch();
    chunk.forEach(w => batch.set(ref.doc(w.id), w.data));
    chunk.forEach(w => synced.set(w.id, w.json));
    batch.commit().catch(e => {
      console.warn(`Firestore ${col} save failed:`, e);
      chunk.forEach(w => synced.delete(w.id)); // retry these on the next save
    });
  }
}

function _persistLocal(col) {
  const key = col === 'items' ? 'forward_items' : 'forward_projects';
  try { localStorage.setItem(key, JSON.stringify(_arr(col))); } catch (e) { }
  forwardDB[col].bulkPut(_arr(col)).catch(e => console.warn(`IndexedDB ${col} save failed:`, e));
}

// ── SAVE ─────────────────────────────────────────────────
function save() { _persistLocal('items'); _pushChanges('items'); }
function saveProjects() { _persistLocal('projects'); _pushChanges('projects'); }

// Permanently delete a project (or item) on every device
function deleteDoc(col, id) {
  _setArr(col, _arr(col).filter(d => d.id !== id));
  deletedIds[id] = col;
  _saveTombstones();
  forwardDB[col].delete(id).catch(e => console.warn('IndexedDB delete failed:', e));
  if (col === 'items') save(); else saveProjects();
}

// ── LOAD ─────────────────────────────────────────────────
// Synchronous load from localStorage first (instant boot),
// then async IndexedDB load with merge (durable source of truth)
// Firestore onSnapshot listener keeps data live while user is signed in
function _loadLocal(col) {
  const key = col === 'items' ? 'forward_items' : 'forward_projects';
  let local = [];
  try { local = JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (e) { local = []; }
  local = local.filter(d => d && !deletedIds[d.id]);
  if (local.length > 0 && _arr(col).length === 0) _setArr(col, local);
}

function _onSnapshot(col, snapshot) {
  const synced = _synced[col];
  const merged = new Map();
  _arr(col).forEach(d => merged.set(d.id, d));
  let tombstonesLearned = false;

  snapshot.forEach(doc => {
    const cd = doc.data();
    const id = cd.id || doc.id;
    if (cd.deleted) {
      // Deleted on another device (or by us) — drop it everywhere locally
      synced.set(id, 'deleted');
      merged.delete(id);
      if (!deletedIds[id]) { deletedIds[id] = col; tombstonesLearned = true; }
      forwardDB[col].delete(id).catch(() => { });
      return;
    }
    synced.set(id, JSON.stringify(cd));
    if (deletedIds[id]) return; // deleted here; our tombstone push will win
    const local = merged.get(id);
    if (!local || _docTime(cd) >= _docTime(local)) merged.set(id, cd);
  });
  if (tombstonesLearned) _saveTombstones();

  _setArr(col, Array.from(merged.values()));
  _snapReady[col] = true;
  if (col === 'items') save(); else saveProjects(); // persists locally + pushes local-only changes

  if (col === 'items') { if (typeof renderInbox === 'function') renderInbox(); if (typeof updateStats === 'function') updateStats(); }
  else if (typeof renderProjects === 'function') renderProjects();
}

function _listen(col) {
  if (!_signedIn()) return;
  if (_syncedUid !== currentUser.uid) {
    // Different account → forget what we think the cloud holds
    _synced.items.clear(); _synced.projects.clear();
    _snapReady.items = false; _snapReady.projects = false;
    _syncedUid = currentUser.uid;
  }
  if (_unsubs[col]) _unsubs[col]();
  _unsubs[col] = db.collection('users').doc(currentUser.uid).collection(col)
    .onSnapshot(snap => _onSnapshot(col, snap), err => console.warn(`Firestore ${col} listener error:`, err));
}

function load() { _loadLocal('items'); _listen('items'); }
function loadProjects() { _loadLocal('projects'); _listen('projects'); }

// Async IndexedDB load — runs after init, merges with localStorage data
async function loadFromIndexedDB() {
  try {
    const dbItems = (await forwardDB.items.toArray()).filter(d => !deletedIds[d.id]);
    const dbProjects = (await forwardDB.projects.toArray()).filter(d => !deletedIds[d.id]);

    if (dbItems.length > 0 || dbProjects.length > 0) {
      // IndexedDB has data — use it as source of truth
      if (dbItems.length > 0) {
        // Merge: prefer IndexedDB, add any localStorage-only items
        const dbIds = new Set(dbItems.map(i => i.id));
        const localOnly = items.filter(i => !dbIds.has(i.id));
        items = [...dbItems, ...localOnly];
      }
      if (dbProjects.length > 0) {
        const dbProjIds = new Set(dbProjects.map(p => p.id));
        const localProjOnly = projects.filter(p => !dbProjIds.has(p.id));
        projects = [...dbProjects, ...localProjOnly];
      }
      // Re-mirror merged data
      save();
      saveProjects();
    } else if (items.length > 0 || projects.length > 0) {
      // First run: migrate localStorage → IndexedDB
      console.log('Migrating localStorage data to IndexedDB...');
      if (items.length) await forwardDB.items.bulkPut(items);
      if (projects.length) await forwardDB.projects.bulkPut(projects);
      console.log('Migration complete');
    }

    // Re-render with latest data
    if (typeof renderAllViews === 'function') renderAllViews();
  } catch (e) {
    console.warn('IndexedDB load failed, using localStorage:', e);
  }
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
  if (item.status === 'archived' || item.status === 'done') return item.status;
  const now = Date.now();
  const created = new Date(item.createdAt).getTime();
  const touched = new Date(item.touchedAt || item.createdAt).getTime();
  const ageHrs = (now - created) / 3600000;
  const touchedDays = (now - touched) / 86400000;
  const lc = LIFECYCLE[item.category] || LIFECYCLE.uncategorised;

  if (lc.archiveDays !== null && lc.archiveDays !== Infinity && touchedDays > lc.archiveDays) return 'archived';
  if (lc.coldDays && touchedDays > lc.coldDays) return 'cold';
  if (ageHrs <= (lc.freshHrs || 48)) return 'fresh';
  return 'alive';
}

// Local calendar helpers (toISOString() is UTC — in KL that shifts days at 8am)
function localDateKey(d) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
function _dayStart(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); }

function recurringPeriodElapsed(period, last, now) {
  if (period === 'weekly') return Math.round((_dayStart(now) - _dayStart(last)) / 86400000) >= 7;
  if (period === 'monthly') return (now.getFullYear() * 12 + now.getMonth()) > (last.getFullYear() * 12 + last.getMonth());
  return _dayStart(now) > _dayStart(last); // daily (default)
}

function runLifecycle() {
  let changed = false;
  const now = Date.now();
  items.forEach(item => {
    const s = computeStatus(item);
    if (s !== item.status) { item.status = s; changed = true; }

    // Recurring tasks: reset at the start of the next local day / week / month.
    // (Previously "daily" meant 24h after ticking — done at 9pm, still done at 8am next day.)
    if (item.status === 'done' && item.recurring && item.lastCompletedAt) {
      if (recurringPeriodElapsed(item.recurring, new Date(item.lastCompletedAt), new Date(now))) {
        item.status = 'fresh'; // 'active' is not a valid lifecycle status — use 'fresh' to re-surface it
        item.completedAt = null;
        changed = true;
      }
    }
    // Non-recurring done tasks: auto-archive after 24 hours
    else if (item.status === 'done' && !item.recurring && item.completedAt && item.category === 'task') {
      const doneHrs = (now - new Date(item.completedAt).getTime()) / 3600000;
      if (doneHrs >= 24) {
        item.status = 'archived';
        item.archivedAt = new Date().toISOString();
        changed = true;
      }
    }
  });
  if (changed) save();
}

// ── MOMENTUM / ACTIVITY TRACKER ──────────────────────────
function getActivityDays() {
  const days = new Set();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86400000;

  // Check items — captures, touches, completions
  items.forEach(item => {
    [item.createdAt, item.touchedAt, item.completedAt, item.lastCompletedAt].forEach(d => {
      if (d && new Date(d).getTime() >= sevenDaysAgo) {
        days.add(localDateKey(d));
      }
    });
  });

  // Check projects — touches
  projects.forEach(p => {
    if (p.touchedAt && new Date(p.touchedAt).getTime() >= sevenDaysAgo) {
      days.add(localDateKey(p.touchedAt));
    }
  });

  return days;
}

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
    const phases = catInfo.phases || [];
    const currentIdx = phases.indexOf(p.phase);

    // Phase progress dots
    const progressHtml = phases.length > 0 ? `
      <div class="phase-progress">
        ${phases.map((ph, i) => `<div class="phase-seg ${i <= currentIdx ? 'filled' : ''}" title="${catInfo.phaseLabels[ph] || ph}"></div>`).join('')}
      </div>` : '';

    return `
    <div class="project-card" onclick="openProjectSheet('${p.id}')">
      <span class="cat-badge ${catInfo.badgeClass}">${catInfo.label}</span>
      <p class="project-card-name">${esc(p.name)}</p>
      ${p.vision ? `<p class="project-card-vision">${esc(p.vision)}</p>` : ''}
      <div class="project-card-footer">
        <span class="project-phase-pill">${phaseLabel}</span>
        ${p.nextAction ? `<span class="project-next-preview">${esc(p.nextAction)}</span>` : '<span style="font-size:11px;color:var(--text-muted);opacity:0.5">No next action</span>'}
      </div>
      ${progressHtml}
    </div>`;
  }).join('');
  container.innerHTML = cards + addBtn;
}

