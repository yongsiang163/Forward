// ── GEMINI API — BYOK (Bring Your Own Key) ──────────────
// Key is stored in localStorage only — never in the codebase.
// When no key is set, pattern-matching fallback is used.

const GEMINI_MODEL = 'gemini-2.0-flash';

function getGeminiKey() {
  return localStorage.getItem('gemini_api_key') || null;
}

function setGeminiKey(key) {
  if (key && key.trim()) {
    localStorage.setItem('gemini_api_key', key.trim());
  } else {
    localStorage.removeItem('gemini_api_key');
  }
  updateAIKeyStatus();
}

function updateAIKeyStatus() {
  const status = document.getElementById('ai-key-status');
  const input = document.getElementById('ai-key-input');
  if (!status) return;
  const key = getGeminiKey();
  if (key) {
    status.textContent = '✓ connected';
    status.className = 'settings-row-action on';
    if (input && input.value !== key) input.value = key;
  } else {
    status.textContent = '○ not set';
    status.className = 'settings-row-action';
    if (input) input.value = '';
  }
}

async function testGeminiKey() {
  const key = getGeminiKey();
  if (!key) { showToast('Enter an API key first'); return; }
  try {
    const result = await callGemini('Respond with exactly: ok', 'Test');
    if (result) {
      showToast('✓ API key works');
    } else {
      showToast('Key test failed — check the key');
    }
  } catch (e) {
    showToast('Key test failed — ' + (e.message || 'check the key'));
  }
}

function clearGeminiKey() {
  localStorage.removeItem('gemini_api_key');
  updateAIKeyStatus();
  showToast('API key removed');
}

// ── CORE API CALL ────────────────────────────────────────
async function callGemini(systemPrompt, userPrompt) {
  const key = getGeminiKey();
  if (!key) return null;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 400
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `API error ${res.status}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from API');
  return text.trim();
}

// ── SYSTEM PROMPTS ───────────────────────────────────────

const SYSTEM_PROMPT_CATEGORISE = `You are a classification engine for a personal capture app designed for someone with ADHD.

Classify the user's captured thought into exactly ONE category:
- task — something with a clear next action
- project — something with multiple steps, a client context, or a larger initiative
- spark — an idea, observation, creative thought, or "what if"
- reminder — time-sensitive, date-sensitive, or something to remember

Respond with ONLY the single lowercase category word. Nothing else.`;

function buildMVNASystemPrompt(projectPhase, moodState, maxSteps) {
  const phaseContext = projectPhase ?
    `The task belongs to a project currently in the "${projectPhase}" phase. Tailor your micro-actions to this phase.` : '';

  return `You are an ADHD task initiation assistant. Your job is to break a task into the smallest possible physical first actions.

RULES — these are clinical, not preferences:
1. Return a JSON array of strings. Each string is one micro-action.
2. HARD CAP: Return at most ${maxSteps} step(s). Never more.
3. The Child-Instruction Rule: every step must be PHYSICAL, IMMEDIATE, and require ZERO prior decisions. Not "draft the intro" — "open the document and read the last paragraph you wrote." The action begins in the body, not the mind.
4. Never use project-management language: no deliverables, milestones, action items.
5. Never number steps in a way that implies a long list.
6. ${moodState === 'fatigued' ? 'The user is in a fatigued/heavy state. Return EXACTLY 1 micro-action. Do not mention further steps exist.' : 'The user has moderate to good energy.'}
${phaseContext}

Respond with ONLY a valid JSON array of strings. No explanation, no markdown, no code fences. Example: ["Open the file", "Read the first paragraph"]`;
}

function buildCompanionSystemPrompt(project, phase, mood) {
  const catInfo = project ? (PROJECT_CATS[project.projectCat] || PROJECT_CATS.open) : PROJECT_CATS.open;
  const persona = AI_PERSONAS ? (AI_PERSONAS[project?.projectCat] || '') : '';

  return `You are an AI companion inside a personal productivity app called Forward, designed for someone with ADHD.

YOUR TONE: Warm, direct, non-judgmental. Short sentences. Never corporate. Never cheerful. Grounded.
YOUR ROLE: Bridge between planning and doing. You pull toward the smallest possible next action. You never overwhelm.

CONTEXT:
- Project: "${project?.name || 'Unknown'}"
- Category: ${catInfo.label || 'Open'}
- Phase: ${phase || 'Unknown'}
- Vision: "${project?.vision || 'Not captured'}"
- Next Action: "${project?.nextAction || 'Not set'}"
- Notes: "${project?.notes?.substring(0, 200) || 'None'}"
${mood ? `- Current mood: ${mood}` : '- No mood data today'}
${persona ? `\nDOMAIN PERSONA:\n${persona}` : ''}

CONSTRAINTS:
- Never return more than 3 micro-actions
- ${['Heavy', 'Tired'].includes(mood) ? 'User is fatigued. Return at most 1 action. Be extremely gentle.' : 'User has energy available.'}
- If the user asks "what should I do", give ONE concrete physical action, not a list
- If the user seems stuck, help identify whether the block is "action too large" or "undecided decision"
- Always pull toward possibility, never reflect negativity
- Keep responses under 3 sentences unless micro-actions are needed
- When suggesting steps, format them on separate lines starting with •`;
}

// ── AI CATEGORISATION ────────────────────────────────────
async function aiCategorise(text) {
  // Try Gemini first
  try {
    const result = await callGemini(SYSTEM_PROMPT_CATEGORISE, text);
    if (result) {
      const cat = result.toLowerCase().trim().replace(/[^a-z]/g, '');
      if (['task', 'spark', 'project', 'reminder'].includes(cat)) {
        return { category: cat };
      }
    }
  } catch (e) {
    console.warn('Gemini categorisation failed, using fallback:', e.message);
    if (getGeminiKey()) showToast('API Error: ' + e.message);
  }

  // Fallback: pattern matching
  const t = text.toLowerCase();
  let cat = 'task';
  if (/idea|thought|what if|maybe|imagine|feeling|noticed|spark/i.test(t)) cat = 'spark';
  else if (/client|project|phase|design|proposal|presentation|procurement|drawing|spec/i.test(t)) cat = 'project';
  else if (/remind|deadline|due|call|meeting|at \d|by \d/i.test(t)) cat = 'reminder';
  return { category: cat };
}

// ── HELP ME START (MVNA) ─────────────────────────────────
async function helpMeStartAI({ task, projectId, projectPhase, moodState, maxSteps, completedSteps = [] }) {
  // Try Gemini first
  try {
    const systemPrompt = buildMVNASystemPrompt(projectPhase, moodState, maxSteps);
    const completedContext = completedSteps.length > 0
      ? `\n\nAlready completed: ${completedSteps.join(', ')}`
      : '';
    const result = await callGemini(systemPrompt, task + completedContext);
    if (result) {
      // Parse JSON response — handle possible markdown fencing
      const cleaned = result.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const steps = JSON.parse(cleaned);
      if (Array.isArray(steps) && steps.length > 0) {
        return steps.slice(0, maxSteps);
      }
    }
  } catch (e) {
    console.warn('Gemini MVNA failed, using fallback:', e.message);
    if (getGeminiKey()) showToast('API Error: ' + e.message);
  }

  // Fallback: hardcoded phase-aware suggestions
  const t = task.toLowerCase();
  let steps = [];
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
    steps = [`Open whatever you need for: "${task}"`, 'Look at it for 30 seconds', 'Do the single smallest first action'];
  }
  return steps.slice(0, maxSteps);
}

// ── AI COMPANION IN PROJECT ──────────────────────────────
function toggleProjectAI() {
  const thread = document.getElementById('project-ai-thread');
  const label = document.getElementById('project-ai-btn-label');
  if (!thread) return;
  const isOpen = thread.classList.contains('open');
  if (!isOpen) {
    thread.classList.add('open');
    label.textContent = 'AI active ·';
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

  try {
    const systemPrompt = buildCompanionSystemPrompt(p, phase, mood);
    const userPrompt = `I just opened the project "${p.name}". Give me a brief read of where this project is and what the one next move could be.`;
    const result = await callGemini(systemPrompt, userPrompt);
    showAIThinking(false);
    if (result) {
      appendAIMessage({ text: result }, p);
      return;
    }
  } catch (e) {
    console.warn('Gemini project read failed, using fallback:', e.message);
    if (getGeminiKey()) showToast('API Error: ' + e.message);
  }

  // Fallback
  showAIThinking(false);
  const response = buildAIReadResponse(p, phase, mood);
  appendAIMessage(response, p);
}

function buildAIReadResponse(p, phase, mood) {
  const fatigued = ['Heavy', 'Tired'].includes(mood);
  const alive = ['Alive', 'Calm'].includes(mood);
  const maxSteps = fatigued ? 1 : alive ? 3 : 2;

  const reads = {
    idwork: `<em>${p.name}</em> is in ${phase}. ${p.nextAction ? `The declared next step is: "${p.nextAction}".` : 'No next step set yet.'}`,
    life: `<em>${p.name}</em> — you placed this in ${phase}. ${p.vision ? `You wrote: "${p.vision.substring(0, 80)}…"` : ''} Let's find what's true right now.`,
    business: `<em>${p.name}</em> is at ${phase}. ${p.nextAction ? `You said the next move was: "${p.nextAction}".` : 'No move declared yet.'} What's the actual blocker?`,
    learning: `<em>${p.name}</em> — you're in the ${phase} stage. The question is always: what's the one thing to do with the next 20 minutes?`,
    open: `<em>${p.name}</em> — ${phase}. What's true about where this sits right now?`
  };
  return { text: reads[p.projectCat] || reads.open, maxSteps };
}

function appendAIMessage(response, p) {
  const msgs = document.getElementById('ai-messages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = 'ai-message';
  // If response.text contains bullet points, format them
  const formatted = response.text.replace(/•\s*/g, '<br>• ');
  div.innerHTML = `<p class="ai-message-text">${formatted}</p>`;
  msgs.appendChild(div);

  if (response.steps && response.steps.length) {
    renderAISteps(response.steps);
  }
  msgs.scrollTop = msgs.scrollHeight;
}

let _aiSteps = [];
let _aiStepCurrent = 0;

function renderAISteps(steps) {
  _aiSteps = steps;
  _aiStepCurrent = 0;
  _renderCurrentAIStep();
}

function _renderCurrentAIStep() {
  const msgs = document.getElementById('ai-messages');
  if (!msgs) return;
  // Remove previous step container if exists
  const prev = document.getElementById('ai-step-container');
  if (prev) prev.remove();

  const wrap = document.createElement('div');
  wrap.className = 'ai-message';
  wrap.id = 'ai-step-container';
  let html = '';

  // Show completed steps
  for (let i = 0; i < _aiStepCurrent; i++) {
    html += `<div class="ai-step-item"><button class="ai-step-check done"></button><span class="ai-step-text done">${esc(_aiSteps[i])}</span></div>`;
  }
  // Show current step with done button
  if (_aiStepCurrent < _aiSteps.length) {
    html += `<div class="ai-step-item">
      <button class="ai-step-check" onclick="toggleAIStep()"></button>
      <span class="ai-step-text">${esc(_aiSteps[_aiStepCurrent])}</span>
    </div>`;
    if (_aiSteps.length > 1) {
      html += `<p style="font-size:10px; color:var(--text-muted); text-align:center; margin-top:8px; letter-spacing:0.5px;">step ${_aiStepCurrent + 1} of ${_aiSteps.length}</p>`;
    }
  }
  wrap.innerHTML = html;
  msgs.appendChild(wrap);
  msgs.scrollTop = msgs.scrollHeight;
}

function toggleAIStep() {
  _aiStepCurrent++;
  if (_aiStepCurrent >= _aiSteps.length) {
    // All done
    _renderCurrentAIStep();
    const msgs = document.getElementById('ai-messages');
    const doneDiv = document.createElement('div');
    doneDiv.className = 'ai-message';
    doneDiv.innerHTML = `<p class="ai-message-text" style="color:var(--warm); font-style:italic;">All steps done. That counts.</p>`;
    msgs.appendChild(doneDiv);
    msgs.scrollTop = msgs.scrollHeight;
  } else {
    _renderCurrentAIStep();
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
  const mood = S.rewindSession ? S.rewindSession.mood : null;
  const catInfo = (p && p.projectCat && PROJECT_CATS[p.projectCat]) ? PROJECT_CATS[p.projectCat] : PROJECT_CATS.open;
  const phase = p ? (catInfo.phaseLabels[p.phase] || p.phase) : '';

  // Try Gemini
  try {
    const systemPrompt = buildCompanionSystemPrompt(p, phase, mood);
    const result = await callGemini(systemPrompt, msg);
    showAIThinking(false);
    if (result) {
      appendAIMessage({ text: result }, p);
      return;
    }
  } catch (e) {
    console.warn('Gemini companion failed, using fallback:', e.message);
    if (getGeminiKey()) showToast('API Error: ' + e.message);
  }

  // Fallback
  showAIThinking(false);
  const fatigued = ['Heavy', 'Tired'].includes(mood);
  const maxSteps = fatigued ? 1 : 2;
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