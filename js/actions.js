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
