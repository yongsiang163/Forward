// AI-powered task functions: categorise, summarise, MVNA (Help Me Start),
// project companion, weekly insight, plus the in-thread step UI.
// Depends on: client.js (callGemini), key.js (getGeminiKey), prompts.js,
// constants.js (SYSTEM_PROMPT_*, PROJECT_CATS), data.js (projects, S),
// actions.js (editingProjectId), render.js (esc, showToast).

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

// ── BRAIN DUMP SUMMARISER ────────────────────────────────
async function aiSummarise(rawText) {
  // Only summarise longer captures
  if (!rawText || rawText.length < 80) {
    console.warn('[Summarise] Text too short:', rawText?.length, 'chars');
    return { error: 'Text too short (' + (rawText?.length || 0) + ' chars, need 80+)' };
  }
  if (!getGeminiKey()) {
    console.warn('[Summarise] No API key');
    return { error: 'No API key — add one in Settings' };
  }

  try {
    console.log('[Summarise] Calling API with', rawText.length, 'chars...');
    const result = await callGemini(SYSTEM_PROMPT_SUMMARISE, rawText, { maxOutputTokens: 1024, temperature: 0.5 });
    console.log('[Summarise] Raw result:', result);
    if (!result) return { error: 'API returned empty response' };

    // Parse JSON — strip any markdown fences Gemini may add
    let cleaned = result
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) cleaned = jsonMatch[0];

    const parsed = JSON.parse(cleaned);

    if (parsed && typeof parsed.title === 'string' && typeof parsed.summary === 'string') {
      return {
        title: parsed.title.trim(),
        summary: parsed.summary.trim(),
        actions: Array.isArray(parsed.actions) ? parsed.actions.filter(a => typeof a === 'string' && a.trim()) : []
      };
    }
    return { error: 'AI response missing title/summary fields' };
  } catch (e) {
    console.error('[Summarise] Error:', e);
    return { error: e.message };
  }
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
      try {
        const steps = JSON.parse(cleaned);
        if (Array.isArray(steps) && steps.length > 0) {
          return steps.slice(0, maxSteps);
        }
        console.warn('[MVNA] API returned valid JSON but not an array:', cleaned);
      } catch (parseErr) {
        console.warn('[MVNA] Could not parse JSON from API response. Raw result:', result, '\nError:', parseErr.message);
      }
    }
  } catch (e) {
    console.warn('[MVNA] Gemini call failed, using fallback:', e.message);
    if (getGeminiKey()) showToast('AI Error: ' + e.message);
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

  const pn = esc(p.name);
  const ph = esc(phase);
  const na = esc(p.nextAction);
  const vs = p.vision ? esc(p.vision.substring(0, 80)) : '';
  const reads = {
    idwork: `<em>${pn}</em> is in ${ph}. ${na ? `The declared next step is: "${na}".` : 'No next step set yet.'}`,
    life: `<em>${pn}</em> — you placed this in ${ph}. ${vs ? `You wrote: "${vs}…"` : ''} Let's find what's true right now.`,
    business: `<em>${pn}</em> is at ${ph}. ${na ? `You said the next move was: "${na}".` : 'No move declared yet.'} What's the actual blocker?`,
    learning: `<em>${pn}</em> — you're in the ${ph} stage. The question is always: what's the one thing to do with the next 20 minutes?`,
    open: `<em>${pn}</em> — ${ph}. What's true about where this sits right now?`
  };
  return { text: reads[p.projectCat] || reads.open, maxSteps, trustedHtml: true };
}

function appendAIMessage(response, p) {
  const msgs = document.getElementById('ai-messages');
  if (!msgs) return;
  const div = document.createElement('div');
  div.className = 'ai-message';
  // Trusted-html flag is set only by our own fallback responses that include <em>.
  // All other text (e.g. API output) is escaped to prevent XSS.
  const raw = response.text || '';
  const safe = response.trustedHtml ? raw : esc(raw);
  const formatted = safe.replace(/•\s*/g, '<br>• ');
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

  const phEsc = esc(phase);
  const moodEsc = mood ? esc(mood.toLowerCase()) : '';
  if (/stuck|block|can't|not sure|don't know/i.test(msg)) {
    replyText = `Being stuck in ${phEsc} usually means one of two things: the next action is too large, or there's a decision underneath it that hasn't been made. Which feels more true?`;
  } else if (/next|what|do|start|begin/i.test(msg)) {
    replyText = `Given you're in ${phEsc} and ${moodEsc ? `feeling ${moodEsc}` : 'where you are today'}, here are the right-sized next steps:`;
    steps = fatigued
      ? ['Do just one thing — the very first physical action you can take right now']
      : ['Open whatever you need to start', 'Do the first action only — decide nothing else yet', 'Note what you learn or what shifts'];
  } else {
    replyText = `Noted. Given where <em>${(p && p.name) ? esc(p.name) : 'this project'}</em> is — ${phEsc} — what would make the next hour count?`;
  }

  const response = { text: replyText, steps: steps.slice(0, maxSteps), trustedHtml: true };
  appendAIMessage(response, p);
  if (steps.length) renderAISteps(steps.slice(0, maxSteps));
}

function showAIThinking(show) {
  const el = document.getElementById('ai-thinking-inline');
  if (el) el.classList.toggle('visible', show);
}

// ── WEEKLY REVIEW AI INSIGHT ──────────────────────────────
async function aiWeeklyInsight(completed, staleProjects, freshItems) {
  if (!getGeminiKey()) return null;

  const context = `Completed this week: ${completed.length > 0 ? completed.map(i => i.content).join('; ') : 'Nothing'}.
Stale projects (7+ days untouched): ${staleProjects.length > 0 ? staleProjects.map(p => p.name).join(', ') : 'None'}.
Fresh items awaiting attention: ${freshItems.length > 0 ? freshItems.map(i => i.content).join('; ') : 'None'}.`;

  const prompt = `You are a gentle weekly reflection assistant for an ADHD productivity app.
Given the user's week summary below, write 2 sentences:
1. One observation about their pattern (positive, never judgmental)
2. One gentle suggestion for next week

Keep it warm, short, grounded. Never use corporate language. Never shame inactivity.
Respond with ONLY the 2 sentences, nothing else.`;

  try {
    const insight = await callGemini(prompt, context, { maxOutputTokens: 200, temperature: 0.7 });
    return insight || null;
  } catch (e) {
    console.warn('[WeeklyInsight] API call failed:', e.message);
    // Surface key/quota errors to the user; swallow network-level noise
    if (e.message && (e.message.includes('invalid') || e.message.includes('quota') || e.message.includes('key'))) {
      showToast('AI: ' + e.message);
    }
    return null;
  }
}
