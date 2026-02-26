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
