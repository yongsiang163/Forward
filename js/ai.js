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
