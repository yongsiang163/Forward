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

// ── SAVE ─────────────────────────────────────────────────
function save() {
  // Mirror to localStorage (fast, synchronous reads on next load)
  try { localStorage.setItem('forward_items', JSON.stringify(items)); } catch (e) { }
  // Write to IndexedDB in background (durable local storage)
  forwardDB.items.bulkPut(items).catch(e => console.warn('IndexedDB save failed:', e));
  // Write to Firestore cloud if user is signed in
  if (typeof currentUser !== 'undefined' && currentUser) {
    const batch = db.batch();
    items.forEach(item => {
      const ref = db.collection('users').doc(currentUser.uid).collection('items').doc(item.id);
      batch.set(ref, item, { merge: true });
    });
    batch.commit().catch(e => console.warn('Firestore save failed:', e));
  }
}

function saveProjects() {
  try { localStorage.setItem('forward_projects', JSON.stringify(projects)); } catch (e) { }
  forwardDB.projects.bulkPut(projects).catch(e => console.warn('IndexedDB saveProjects failed:', e));
  // Write to Firestore cloud if user is signed in
  if (typeof currentUser !== 'undefined' && currentUser) {
    const batch = db.batch();
    projects.forEach(p => {
      const ref = db.collection('users').doc(currentUser.uid).collection('projects').doc(p.id);
      batch.set(ref, p, { merge: true });
    });
    batch.commit().catch(e => console.warn('Firestore saveProjects failed:', e));
  }
}

// ── LOAD ─────────────────────────────────────────────────
// Synchronous load from localStorage first (instant boot),
// then async IndexedDB load with merge (durable source of truth)
// Firestore onSnapshot listener keeps data live while user is signed in
let itemsUnsubscribe = null;
let projectsUnsubscribe = null;

function load() {
  let localItems = [];
  try {
    const d = localStorage.getItem('forward_items');
    if (d) localItems = JSON.parse(d);
  } catch (e) { localItems = []; }

  // Set initial state to local while waiting for cloud
  if (localItems.length > 0 && items.length === 0) {
    items = localItems;
  }

  // Attach Firestore real-time listener (only when signed in)
  if (typeof currentUser !== 'undefined' && currentUser && typeof db !== 'undefined') {
    if (itemsUnsubscribe) itemsUnsubscribe();
    itemsUnsubscribe = db.collection('users').doc(currentUser.uid).collection('items')
      .onSnapshot(snapshot => {
        const cloudItems = [];
        snapshot.forEach(doc => cloudItems.push(doc.data()));

        // Merge Strategy: Combine local and cloud, keeping the newest
        const mergedMap = new Map();

        // 1. Add all local items to map
        items.forEach(i => mergedMap.set(i.id, i));

        // 2. Overwrite with cloud if cloud is newer
        cloudItems.forEach(ci => {
          const local = mergedMap.get(ci.id);
          if (!local) {
            mergedMap.set(ci.id, ci); // Cloud has it, we don't
          } else {
            // Both have it, compare timestamps
            const cloudTime = new Date(ci.touchedAt || ci.createdAt || 0).getTime();
            const localTime = new Date(local.touchedAt || local.createdAt || 0).getTime();
            if (cloudTime >= localTime) {
              mergedMap.set(ci.id, ci);
            }
          }
        });

        const mergedArray = Array.from(mergedMap.values());

        // If the resulting merge is different from what we had, or cloud gave us stuff
        if (mergedArray.length > 0) {
          items = mergedArray;
          try { localStorage.setItem('forward_items', JSON.stringify(items)); } catch (e) { }

          // Re-save to cloud to ensure any local-only items are pushed up
          save();

          if (typeof renderInbox === 'function') renderInbox();
        }
      }, err => console.warn('Firestore items listener error:', err));
  }
}

function loadProjects() {
  let localProjects = [];
  try {
    const d = localStorage.getItem('forward_projects');
    if (d) localProjects = JSON.parse(d);
  } catch (e) { localProjects = []; }

  // Set initial state to local while waiting for cloud
  if (localProjects.length > 0 && projects.length === 0) {
    projects = localProjects;
  }

  // Attach Firestore real-time listener
  if (typeof currentUser !== 'undefined' && currentUser && typeof db !== 'undefined') {
    if (projectsUnsubscribe) projectsUnsubscribe();
    projectsUnsubscribe = db.collection('users').doc(currentUser.uid).collection('projects')
      .onSnapshot(snapshot => {
        const cloudProjects = [];
        snapshot.forEach(doc => cloudProjects.push(doc.data()));

        // Merge Strategy: Combine local and cloud, keeping the newest
        const mergedMap = new Map();

        // 1. Add all local projects to map
        projects.forEach(p => mergedMap.set(p.id, p));

        // 2. Overwrite with cloud if cloud is newer
        cloudProjects.forEach(cp => {
          const local = mergedMap.get(cp.id);
          if (!local) {
            mergedMap.set(cp.id, cp); // Cloud has it, we don't
          } else {
            // Both have it, compare timestamps
            const cloudTime = new Date(cp.updatedAt || cp.createdAt || 0).getTime();
            const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
            if (cloudTime >= localTime) {
              mergedMap.set(cp.id, cp);
            }
          }
        });

        const mergedArray = Array.from(mergedMap.values());

        // If the resulting merge is different from what we had, or cloud gave us stuff
        if (mergedArray.length > 0) {
          projects = mergedArray;
          try { localStorage.setItem('forward_projects', JSON.stringify(projects)); } catch (e) { }

          // Re-save to cloud to ensure any local-only items are pushed up
          saveProjects();

          if (typeof renderProjects === 'function') renderProjects();
        }
      }, err => console.warn('Firestore projects listener error:', err));
  }
}

// Async IndexedDB load — runs after init, merges with localStorage data
async function loadFromIndexedDB() {
  try {
    const dbItems = await forwardDB.items.toArray();
    const dbProjects = await forwardDB.projects.toArray();

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

function runLifecycle() {
  let changed = false;
  const now = Date.now();
  items.forEach(item => {
    const s = computeStatus(item);
    if (s !== item.status) { item.status = s; changed = true; }

    // Recurring tasks: reset when period elapses
    if (item.status === 'done' && item.recurring && item.lastCompletedAt) {
      const elapsed = now - new Date(item.lastCompletedAt).getTime();
      const periods = { daily: 86400000, weekly: 604800000, monthly: 2592000000 };
      if (elapsed >= (periods[item.recurring] || 86400000)) {
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
        days.add(new Date(d).toISOString().slice(0, 10));
      }
    });
  });

  // Check projects — touches
  projects.forEach(p => {
    if (p.touchedAt && new Date(p.touchedAt).getTime() >= sevenDaysAgo) {
      days.add(new Date(p.touchedAt).toISOString().slice(0, 10));
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

