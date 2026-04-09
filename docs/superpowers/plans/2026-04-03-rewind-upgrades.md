# Rewind Upgrades Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add AI reflection (B1/B2), spark capture (B3), mood timeline (C1), word cloud (C3), Forward context (C4), and custom SVG mood icons to Rewind.

**Architecture:** All client changes go into `rewind/index.html` (single-file app, 2145 lines). AI features route through a new Firebase Cloud Function `rewindReflect` in a new `functions/` directory — the Gemini API key lives server-side only. Pattern screen gets a timeline + word cloud replacing the flat log list. Mood icons are inlined SVG via a `moodIcon(mood, size)` helper.

**Tech Stack:** Vanilla JS, Firebase Functions v1 (Node 18), `@google/generative-ai` SDK, localStorage for all data, no build step.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `rewind/index.html` | Modify | All client features: icons, reflection AI, spark, timeline, word cloud |
| `functions/index.js` | Create | `rewindReflect` Cloud Function — calls Gemini, returns reflection + followUp |
| `functions/package.json` | Create | Node 18, firebase-functions, @google/generative-ai dependencies |
| `firebase.json` | Modify | Add `functions` key pointing to `functions/` source directory |

---

## Task 1: Mood Icon System

**Files:**
- Modify: `rewind/index.html` — add `moodIcon()` helper, replace emoji in HTML and JS

### What changes

Replace all emoji mood icons (`🌧`, `🌫`, `⚡`, `🌤`, `🌊`, `✨`) with inline SVG. Four usage points:
1. Mood selector grid buttons (HTML, 6 buttons)
2. Reflection screen header icon (JS, `renderReflection`)
3. History entries (JS, `renderHistory`)
4. Insight card "most present mood" (JS, `renderHistory`)

The `moodIcon(mood, size)` function returns an SVG string. All other changes reference it.

---

- [ ] **Step 1: Add `moodIcon()` helper function**

In `rewind/index.html`, find the `<script>` tag opening (line ~1452). Add the helper at the very top of the script block, before `const REWIND_VERSION`:

```javascript
// ── MOOD ICONS ──
function moodIcon(mood, size) {
  var s = size || 32;
  var defs = {
    Heavy: '<path d="M4 30 Q12 25 20 30 Q28 35 36 30 Q44 25 56 30" stroke-linecap="round"/>' +
           '<path d="M18 30 A12 12 0 0 1 42 30" stroke-linecap="round"/>' +
           '<path d="M12 34 Q30 28 48 34" stroke-opacity="0.65" stroke-linecap="round"/>' +
           '<path d="M6 39 Q30 31 54 39" stroke-opacity="0.35" stroke-linecap="round"/>' +
           '<path d="M18 30 A12 12 0 0 0 42 30" stroke-opacity="0.2" stroke-linecap="round"/>',
    Tired: '<line x1="30" y1="52" x2="30" y2="30" stroke-linecap="round"/>' +
           '<path d="M30 30 Q34 23 27 16" stroke-linecap="round"/>' +
           '<circle cx="26" cy="14" r="3"/>' +
           '<path d="M30 42 Q20 37 20 44" stroke-linecap="round"/>' +
           '<path d="M30 38 Q40 33 39 40" stroke-linecap="round"/>',
    Restless: '<path d="M12 22 Q26 17 42 22" stroke-linecap="round"/>' +
              '<path d="M8 30 Q26 24 46 29" stroke-linecap="round"/>' +
              '<path d="M10 38 Q26 32 44 37" stroke-linecap="round"/>' +
              '<path d="M14 46 Q28 40 42 45" stroke-linecap="round"/>' +
              '<path d="M43 27 L46 29 L43 31" stroke-linecap="round"/>',
    Okay: '<line x1="10" y1="30" x2="50" y2="30" stroke-linecap="round"/>' +
          '<path d="M12 22 Q30 16 48 22" stroke-linecap="round"/>' +
          '<path d="M12 38 Q30 44 48 38" stroke-linecap="round"/>',
    Calm: '<circle cx="30" cy="30" r="5"/>' +
          '<circle cx="30" cy="30" r="11" stroke-opacity="0.7"/>' +
          '<circle cx="30" cy="30" r="17" stroke-opacity="0.4"/>' +
          '<circle cx="30" cy="30" r="23" stroke-opacity="0.2"/>',
    Alive: '<line x1="8" y1="42" x2="52" y2="42" stroke-linecap="round"/>' +
           '<path d="M22 42 A8 8 0 0 1 38 42" stroke-linecap="round"/>' +
           '<line x1="30" y1="30" x2="30" y2="26" stroke-linecap="round"/>' +
           '<line x1="38" y1="33" x2="41" y2="30" stroke-linecap="round"/>' +
           '<line x1="22" y1="33" x2="19" y2="30" stroke-linecap="round"/>' +
           '<line x1="40" y1="40" x2="44" y2="38" stroke-linecap="round"/>' +
           '<line x1="20" y1="40" x2="16" y2="38" stroke-linecap="round"/>' +
           '<line x1="24" y1="46" x2="36" y2="46" stroke-opacity="0.55" stroke-linecap="round"/>' +
           '<line x1="27" y1="50" x2="33" y2="50" stroke-opacity="0.25" stroke-linecap="round"/>'
  };
  var paths = defs[mood] || defs['Okay'];
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 60 60" fill="none" ' +
         'stroke="#c4956a" stroke-width="1.5" stroke-linejoin="round" ' +
         'style="display:inline-block;vertical-align:middle;">' + paths + '</svg>';
}
```

- [ ] **Step 2: Replace emoji in mood selector HTML**

Find the 6 mood buttons in `rewind/index.html` (~lines 1284–1307). Replace each `<span class="mood-icon">EMOJI</span>` with the SVG equivalent. Replace all 6:

```html
<!-- Heavy -->
<button class="mood-btn" onclick="selectMood(this, 'Heavy')" data-mood="Heavy">
  <span class="mood-icon"><svg width="36" height="36" viewBox="0 0 60 60" fill="none" stroke="#c4956a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 30 Q12 25 20 30 Q28 35 36 30 Q44 25 56 30"/><path d="M18 30 A12 12 0 0 1 42 30"/><path d="M12 34 Q30 28 48 34" stroke-opacity="0.65"/><path d="M6 39 Q30 31 54 39" stroke-opacity="0.35"/><path d="M18 30 A12 12 0 0 0 42 30" stroke-opacity="0.2"/></svg></span>
  <span class="mood-label">Heavy</span>
</button>

<!-- Tired -->
<button class="mood-btn" onclick="selectMood(this, 'Tired')" data-mood="Tired">
  <span class="mood-icon"><svg width="36" height="36" viewBox="0 0 60 60" fill="none" stroke="#c4956a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="30" y1="52" x2="30" y2="30"/><path d="M30 30 Q34 23 27 16"/><circle cx="26" cy="14" r="3"/><path d="M30 42 Q20 37 20 44"/><path d="M30 38 Q40 33 39 40"/></svg></span>
  <span class="mood-label">Tired</span>
</button>

<!-- Restless -->
<button class="mood-btn" onclick="selectMood(this, 'Restless')" data-mood="Restless">
  <span class="mood-icon"><svg width="36" height="36" viewBox="0 0 60 60" fill="none" stroke="#c4956a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22 Q26 17 42 22"/><path d="M8 30 Q26 24 46 29"/><path d="M10 38 Q26 32 44 37"/><path d="M14 46 Q28 40 42 45"/><path d="M43 27 L46 29 L43 31"/></svg></span>
  <span class="mood-label">Restless</span>
</button>

<!-- Okay -->
<button class="mood-btn" onclick="selectMood(this, 'Okay')" data-mood="Okay">
  <span class="mood-icon"><svg width="36" height="36" viewBox="0 0 60 60" fill="none" stroke="#c4956a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="30" x2="50" y2="30"/><path d="M12 22 Q30 16 48 22"/><path d="M12 38 Q30 44 48 38"/></svg></span>
  <span class="mood-label">Okay</span>
</button>

<!-- Calm -->
<button class="mood-btn" onclick="selectMood(this, 'Calm')" data-mood="Calm">
  <span class="mood-icon"><svg width="36" height="36" viewBox="0 0 60 60" fill="none" stroke="#c4956a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="30" cy="30" r="5"/><circle cx="30" cy="30" r="11" stroke-opacity="0.7"/><circle cx="30" cy="30" r="17" stroke-opacity="0.4"/><circle cx="30" cy="30" r="23" stroke-opacity="0.2"/></svg></span>
  <span class="mood-label">Calm</span>
</button>

<!-- Alive -->
<button class="mood-btn" onclick="selectMood(this, 'Alive')" data-mood="Alive">
  <span class="mood-icon"><svg width="36" height="36" viewBox="0 0 60 60" fill="none" stroke="#c4956a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="42" x2="52" y2="42"/><path d="M22 42 A8 8 0 0 1 38 42"/><line x1="30" y1="30" x2="30" y2="26"/><line x1="38" y1="33" x2="41" y2="30"/><line x1="22" y1="33" x2="19" y2="30"/><line x1="40" y1="40" x2="44" y2="38"/><line x1="20" y1="40" x2="16" y2="38"/><line x1="24" y1="46" x2="36" y2="46" stroke-opacity="0.55"/><line x1="27" y1="50" x2="33" y2="50" stroke-opacity="0.25"/></svg></span>
  <span class="mood-label">Alive</span>
</button>
```

- [ ] **Step 3: Add reflection icon placeholder to HTML**

Find the reflection header block (around line 1338). Add `<div class="reflection-icon" id="reflection-icon"></div>` as the first child inside `.reflection-header`:

```html
<div class="reflection-header">
  <div class="reflection-icon" id="reflection-icon"></div>
  <p class="reflection-eyebrow">Your check-in</p>
  <h2 class="reflection-title" id="reflection-title">Here is where<br>you are.</h2>
</div>
```

Add CSS (find the existing `.reflection-header` rule and add after it):

```css
.reflection-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}
```

- [ ] **Step 4: Update `renderReflection()` to use SVG icons**

Find `renderReflection(session)` (~line 1734). Replace the emoji map and usage:

```javascript
function renderReflection(session) {
  // Icon in header (48px)
  var iconEl = document.getElementById('reflection-icon');
  if (iconEl) iconEl.innerHTML = moodIcon(session.mood, 48);

  // Mood + intensity line — use innerHTML now (SVG not compatible with textContent)
  document.getElementById('reflection-mood').innerHTML =
    moodIcon(session.mood, 20) + '&nbsp;&nbsp;' + session.mood + '&nbsp;&nbsp;·&nbsp;&nbsp;' + session.intensity + '/10';

  if (session.feeling) {
    document.getElementById('reflection-feeling').textContent = session.feeling;
    document.getElementById('reflection-feeling-card').style.display = 'block';
  } else {
    document.getElementById('reflection-feeling-card').style.display = 'none';
  }

  document.getElementById('reflection-focus').textContent = session.focus;
  document.getElementById('rewind-response').textContent = getResponse(session.mood, session.focus);

  var titles = { Heavy: 'Be gentle\nwith yourself.', Tired: 'You can rest\nhere first.', Restless: 'One thing.\nNot everything.', Okay: 'Here is where\nyou are.', Calm: 'Receive\nthis moment.', Alive: 'Hold onto\nthis.' };
  document.getElementById('reflection-title').textContent = titles[session.mood] || 'Here is where\nyou are.';
}
```

- [ ] **Step 5: Update `renderHistory()` to use SVG icons**

Find `renderHistory()`. Locate the two `moodIcons` / `moodIconsMap` objects and the insight card + history entry template. Replace:

In the insights section, change:
```javascript
// OLD:
const moodIcons = { Heavy: '🌧', Tired: '🌫', Restless: '⚡', Okay: '🌤', Calm: '🌊', Alive: '✨' };
// and usage: `${moodIcons[dominantMood[0]]} ${dominantMood[0]}`

// NEW — replace the insight value line:
`<p class="insight-value">${moodIcon(dominantMood[0], 22)} ${dominantMood[0]}</p>`
```

Replace the two `const moodIcons = {...}` and `const moodIconsMap = {...}` declarations with a single one. Then update the mood bar row and history entry template:

```javascript
// Mood bar rows — replace emoji with icon
${moodOrder.filter(function(m) { return moodCounts[m]; }).map(function(m) {
  return '<div class="mood-bar-row">' +
    '<span class="mood-bar-label">' + moodIcon(m, 18) + ' ' + m + '</span>' +
    '<div class="mood-bar-track"><div class="mood-bar-fill" style="width:' + (moodCounts[m] / maxMood * 100) + '%"></div></div>' +
    '<span class="mood-bar-count">' + moodCounts[m] + '</span>' +
    '</div>';
}).join('')}
```

History entry template (in the `reversed.map` block):
```javascript
// OLD: const icon = moodIconsMap[s.mood] || '○';
// NEW: use moodIcon(s.mood, 20) inline in the template
'<div class="history-entry">' +
  '<p class="history-date">' + dateStr + '  ·  ' + timeStr + '</p>' +
  '<p class="history-mood">' + moodIcon(s.mood, 20) + ' ' + s.mood + ' · ' + s.intensity + '/10</p>' +
  (s.focus ? '<p class="history-focus">"' + s.focus + '"</p>' : '') +
  (s.feeling ? '<p class="history-feeling">' + s.feeling.substring(0, 140) + (s.feeling.length > 140 ? '...' : '') + '</p>' : '') +
'</div>'
```

Note: because `renderHistory` uses template literals, convert those map callbacks to use concatenation (as shown above) so the SVG innerHTML doesn't need escaping.

- [ ] **Step 6: Verify in browser**

Open `rewind/index.html` (or navigate to Rewind within Forward). Check:
- Mood selector grid shows 6 SVG icons instead of emoji
- Select a mood, complete check-in → reflection screen shows SVG icon at top (48px) and inline (20px)
- Navigate to Pattern → history entries show SVG icons
- Insight card "Most present mood" shows SVG icon

- [ ] **Step 7: Commit**

```bash
git add rewind/index.html
git commit -m "feat(rewind): replace emoji mood icons with custom SVG icon set"
```

---

## Task 2: Firebase Cloud Function — `rewindReflect`

**Files:**
- Create: `functions/package.json`
- Create: `functions/index.js`
- Modify: `firebase.json`

**Prerequisite:** You need a Gemini API key. Get one at https://aistudio.google.com/app/apikey. It stays server-side — never in client code.

---

- [ ] **Step 1: Create `functions/package.json`**

```json
{
  "name": "rewind-functions",
  "version": "1.0.0",
  "description": "Firebase Cloud Functions for Rewind AI features",
  "engines": { "node": "18" },
  "main": "index.js",
  "dependencies": {
    "firebase-functions": "^4.9.0",
    "@google/generative-ai": "^0.21.0"
  }
}
```

- [ ] **Step 2: Create `functions/index.js`**

```javascript
'use strict';

var functions = require('firebase-functions');
var generativeai = require('@google/generative-ai');

exports.rewindReflect = functions.region('asia-southeast1').https.onRequest(function(req, res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  var body = req.body || {};
  var mood = body.mood || 'Okay';
  var feeling = body.feeling || '';
  var history = Array.isArray(body.history) ? body.history : [];
  var forwardContext = body.forwardContext || '';

  var apiKey;
  try {
    apiKey = functions.config().gemini.key;
  } catch (e) {
    apiKey = null;
  }

  if (!apiKey) {
    res.status(200).json({ reflection: null, followUp: null });
    return;
  }

  // Detect recurring mood pattern (3+ times in last 7 sessions)
  var recentMoods = history.slice(-7).map(function(s) { return s.mood; });
  var moodCount = recentMoods.filter(function(m) { return m === mood; }).length;
  var recurring = moodCount >= 3;

  var historySummary = recentMoods.length > 0
    ? 'Recent moods (oldest to newest): ' + recentMoods.join(', ') + '.'
    : '';

  var contextNote = forwardContext ? 'What they are working on: ' + forwardContext + '.' : '';

  var recurringNote = recurring
    ? 'This mood (' + mood + ') has appeared ' + moodCount + ' times in the last 7 sessions.'
    : '';

  var followUpInstruction = recurring
    ? 'followUp: One specific, gentle question that goes deeper for someone who has felt ' + mood + ' repeatedly. More targeted than a first-time question. Example for Heavy: "what would one small release look like?"'
    : 'followUp: One open, gentle question for someone feeling ' + mood + ' for the first time this week. Example for Heavy: "what is weighing on you most right now?"';

  var prompt = 'You are a quiet inner voice — not an AI assistant. You acknowledge without judging. ' +
    'You never give advice. You speak in second person, present tense.\n\n' +
    'Context:\n' +
    '- Current mood: ' + mood + '\n' +
    '- What they wrote: "' + (feeling || 'nothing') + '"\n' +
    (historySummary ? '- ' + historySummary + '\n' : '') +
    (contextNote ? '- ' + contextNote + '\n' : '') +
    (recurringNote ? '- ' + recurringNote + '\n' : '') +
    '\nReturn a JSON object with exactly two string fields:\n' +
    '{\n' +
    '  "reflection": "One sentence. Second person, present tense. Acknowledge what is true right now. No advice, no questions, no productivity language.",\n' +
    '  "' + followUpInstruction + '"\n' +
    '}\n\n' +
    'Return ONLY valid JSON. No markdown fences. No explanation.';

  var genAI = new generativeai.GoogleGenerativeAI(apiKey);
  var model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  model.generateContent(prompt)
    .then(function(result) {
      var text = result.response.text().trim();
      // Strip markdown fences if Gemini wrapped it anyway
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      var parsed = JSON.parse(text);
      res.json({
        reflection: parsed.reflection || null,
        followUp: parsed.followUp || null
      });
    })
    .catch(function(err) {
      console.error('rewindReflect Gemini error:', err.message);
      res.status(200).json({ reflection: null, followUp: null });
    });
});
```

- [ ] **Step 3: Update `firebase.json` to include functions**

Find `firebase.json` in the repo root. Add the `"functions"` key alongside the existing keys:

```json
{
  "firestore": {
    "database": "(default)",
    "location": "asia-southeast1",
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "hosting": {
    "public": ".",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  },
  "auth": {
    "providers": {
      "anonymous": true,
      "emailPassword": true,
      "googleSignIn": {
        "oAuthBrandDisplayName": "Forward",
        "supportEmail": "support@forward.firebaseapp.com"
      }
    }
  },
  "functions": {
    "source": "functions",
    "codebase": "default",
    "ignore": ["node_modules", ".git", "firebase-debug.log"]
  }
}
```

- [ ] **Step 4: Install dependencies**

```bash
cd functions
npm install
cd ..
```

Expected: `node_modules/` created inside `functions/`, no errors.

- [ ] **Step 5: Set the Gemini API key**

Replace `YOUR_GEMINI_API_KEY` with the actual key from https://aistudio.google.com/app/apikey:

```bash
firebase functions:config:set gemini.key="YOUR_GEMINI_API_KEY"
```

Expected output: `✔  Functions config updated.`

- [ ] **Step 6: Deploy the function**

```bash
firebase deploy --only functions
```

Expected: `✔  functions[rewindReflect(asia-southeast1)]: Successful`

Note the function URL from the output — it will be:
`https://asia-southeast1-forward-163fr.cloudfunctions.net/rewindReflect`

- [ ] **Step 7: Smoke-test the function**

Run this in your terminal (replace with your actual function URL if different):

```bash
curl -X POST https://asia-southeast1-forward-163fr.cloudfunctions.net/rewindReflect \
  -H "Content-Type: application/json" \
  -d '{"mood":"Heavy","feeling":"everything feels stuck","history":[],"forwardContext":"3 active captures"}'
```

Expected: `{"reflection":"...","followUp":"..."}` — two non-null strings.

- [ ] **Step 8: Commit**

```bash
git add functions/index.js functions/package.json functions/package-lock.json firebase.json
git commit -m "feat(rewind): add rewindReflect Firebase Cloud Function for AI reflection"
```

---

## Task 3: B1 + B2 — AI Reflection and Follow-up Prompts

**Files:**
- Modify: `rewind/index.html` — add `fetchAIReflection()`, update `renderReflection()`, add follow-up HTML element and CSS

---

- [ ] **Step 1: Add `fetchAIReflection()` helper**

Add this function in `rewind/index.html`'s `<script>` block, after `getResponse()`:

```javascript
// ── AI REFLECTION (B1 + B2) ──
var REWIND_REFLECT_URL = 'https://asia-southeast1-forward-163fr.cloudfunctions.net/rewindReflect';

function getForwardContextSummary() {
  try {
    var items = JSON.parse(localStorage.getItem('forward_items') || '[]');
    var active = items.filter(function(item) { return !item.archived && !item.completed; });
    if (active.length === 0) return '';
    var projects = JSON.parse(localStorage.getItem('forward_projects') || '[]');
    var recentItem = active.sort(function(a, b) {
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    })[0];
    var projectName = '';
    if (recentItem && recentItem.projectId) {
      var proj = projects.find(function(p) { return p.id === recentItem.projectId; });
      if (proj && proj.name) projectName = ' · ' + proj.name;
    }
    return active.length + ' active capture' + (active.length !== 1 ? 's' : '') + projectName;
  } catch (e) { return ''; }
}

function fetchAIReflection(session, callback) {
  var history = sessions.slice(-7).map(function(s) {
    return { mood: s.mood, feeling: s.feeling || '', date: s.date };
  });

  var payload = {
    mood: session.mood,
    feeling: session.feeling || '',
    history: history,
    forwardContext: getForwardContextSummary()
  };

  var done = false;
  var timeoutId = setTimeout(function() {
    if (!done) { done = true; callback(null); }
  }, 5000);

  fetch(REWIND_REFLECT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    if (!done) { done = true; clearTimeout(timeoutId); callback(data); }
  })
  .catch(function() {
    if (!done) { done = true; clearTimeout(timeoutId); callback(null); }
  });
}
```

- [ ] **Step 2: Add follow-up element to reflection screen HTML**

Find the reflection screen HTML. After `<p class="rewind-response" id="rewind-response">—</p>`, add:

```html
<p class="rewind-follow-up" id="rewind-follow-up"></p>
```

- [ ] **Step 3: Add CSS for follow-up prompt**

Find the CSS block in `rewind/index.html`. Add after the `.rewind-response` rule:

```css
.rewind-follow-up {
  font-size: 14px;
  font-style: italic;
  color: rgba(232, 221, 212, 0.4);
  text-align: center;
  margin: 12px 0 24px;
  min-height: 0;
  line-height: 1.6;
  transition: opacity 0.6s ease;
}
```

- [ ] **Step 4: Update `renderReflection()` to call AI and update response**

At the end of `renderReflection(session)` (after setting all the existing elements), add:

```javascript
  // Clear any previous follow-up
  var followUpEl = document.getElementById('rewind-follow-up');
  if (followUpEl) { followUpEl.textContent = ''; followUpEl.style.opacity = '0'; }

  // Attempt AI reflection — falls back to hardcoded response already set above
  fetchAIReflection(session, function(data) {
    if (!data) return;
    var responseEl = document.getElementById('rewind-response');
    if (data.reflection && responseEl) {
      responseEl.style.transition = 'opacity 0.5s ease';
      responseEl.style.opacity = '0';
      setTimeout(function() {
        responseEl.textContent = data.reflection;
        responseEl.style.opacity = '1';
      }, 300);
    }
    if (data.followUp && followUpEl) {
      setTimeout(function() {
        followUpEl.textContent = data.followUp;
        followUpEl.style.transition = 'opacity 0.6s ease';
        followUpEl.style.opacity = '1';
      }, 800);
    }
  });
```

- [ ] **Step 5: Verify in browser**

Complete a check-in. On the reflection screen:
- The hardcoded response appears immediately
- Within ~2–3 seconds, it fades out and the AI sentence fades in
- Below it, an italic follow-up question fades in
- Open DevTools Network tab → confirm a POST to `rewindReflect` was made

If the function call fails (e.g., offline), the hardcoded response stays — no error visible.

- [ ] **Step 6: Commit**

```bash
git add rewind/index.html
git commit -m "feat(rewind): B1+B2 AI personalised reflection and follow-up prompts"
```

---

## Task 4: B3 — Spark Capture in Reflection

**Files:**
- Modify: `rewind/index.html` — add spark input HTML, CSS, and `submitSpark()` JS

---

- [ ] **Step 1: Add spark capture HTML to reflection screen**

Find the reflection screen. After `<p class="rewind-follow-up" id="rewind-follow-up"></p>`, add:

```html
<div class="spark-capture" id="spark-capture">
  <input type="text" class="spark-input" id="spark-input"
    placeholder="anything surface while you were here?"
    onkeydown="if(event.key==='Enter') submitSpark()">
  <p class="spark-confirm" id="spark-confirm"></p>
</div>
```

- [ ] **Step 2: Add CSS for spark capture**

```css
.spark-capture {
  margin: 8px 0 28px;
}
.spark-input {
  width: 100%;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba(196, 149, 106, 0.2);
  color: rgba(232, 221, 212, 0.6);
  font-size: 13px;
  padding: 10px 0;
  font-family: inherit;
  outline: none;
  text-align: center;
  transition: border-color 0.2s ease;
  box-sizing: border-box;
}
.spark-input::placeholder {
  color: rgba(232, 221, 212, 0.25);
}
.spark-input:focus {
  border-bottom-color: rgba(196, 149, 106, 0.5);
  color: rgba(232, 221, 212, 0.85);
}
.spark-confirm {
  font-size: 12px;
  color: rgba(196, 149, 106, 0.6);
  text-align: center;
  margin-top: 8px;
  min-height: 18px;
  transition: opacity 0.6s ease;
  opacity: 0;
}
```

- [ ] **Step 3: Add `submitSpark()` function**

Add after `fetchAIReflection()` in the script block:

```javascript
// ── SPARK CAPTURE (B3) ──
function submitSpark() {
  var input = document.getElementById('spark-input');
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;

  try {
    var sparks = JSON.parse(localStorage.getItem('rewind_sparks') || '[]');
    sparks.push({ text: text, timestamp: new Date().toISOString(), source: 'rewind' });
    localStorage.setItem('rewind_sparks', JSON.stringify(sparks));
  } catch (e) {}

  input.value = '';

  var confirm = document.getElementById('spark-confirm');
  if (confirm) {
    confirm.textContent = 'captured.';
    confirm.style.opacity = '1';
    setTimeout(function() {
      confirm.style.opacity = '0';
      setTimeout(function() { confirm.textContent = ''; }, 600);
    }, 2000);
  }
}
```

- [ ] **Step 4: Verify in browser**

Complete a check-in. On the reflection screen:
- A text input appears below the response with placeholder "anything surface while you were here?"
- Type something, press Enter → field clears, "captured." fades in then fades out
- Open DevTools Console: `JSON.parse(localStorage.getItem('rewind_sparks'))` → shows the entry with `source: 'rewind'`

- [ ] **Step 5: Commit**

```bash
git add rewind/index.html
git commit -m "feat(rewind): B3 spark capture in reflection screen"
```

---

## Task 5: C1 — Mood Timeline

**Files:**
- Modify: `rewind/index.html` — replace `#reveal-log` section with timeline, add `renderTimeline()` and `expandTimelineDot()`, add CSS

---

- [ ] **Step 1: Replace the log section HTML with timeline + preserved log**

Find the Pattern screen HTML. Locate the `#reveal-log` section:
```html
<div class="reveal-section" id="reveal-log">
  <p class="pattern-section-label">Full log</p>
  <div id="history-list"></div>
  <div style="height:100px;"></div>
</div>
```

Replace it with:
```html
<!-- Word cloud placeholder (populated by C3 task) -->
<div class="reveal-section" id="reveal-wordcloud" style="display:none;">
  <p class="pattern-section-label">Your feeling vocabulary</p>
  <div class="word-cloud" id="word-cloud"></div>
</div>

<!-- Mood Timeline (C1) -->
<div class="reveal-section" id="reveal-timeline">
  <p class="pattern-section-label">30-day timeline</p>
  <div class="mood-timeline-wrap" id="mood-timeline-wrap">
    <div class="mood-timeline-track" id="mood-timeline-track"></div>
    <div class="mood-timeline-detail" id="mood-timeline-detail" style="display:none;"></div>
  </div>
  <div style="height:100px;"></div>
</div>
```

Note: `#history-list` is removed. The timeline replaces it. `#reveal-wordcloud` is added here for C3 (next task) — it's hidden until C3 renders it.

- [ ] **Step 2: Add timeline CSS**

```css
/* ── MOOD TIMELINE (C1) ── */
.mood-timeline-wrap { width: 100%; }

.mood-timeline-track {
  display: flex;
  align-items: center;
  gap: 5px;
  overflow-x: auto;
  padding: 20px 4px 12px;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}
.mood-timeline-track::-webkit-scrollbar { display: none; }

.timeline-day {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  min-width: 18px;
  position: relative;
}

.timeline-dot {
  border-radius: 50%;
  cursor: pointer;
  flex-shrink: 0;
  transition: transform 0.15s ease, opacity 0.15s ease;
  opacity: 0.85;
}
.timeline-dot:hover { transform: scale(1.25); opacity: 1; }
.timeline-dot.filtered-out { opacity: 0.12; }
.timeline-dot.active-dot { outline: 2px solid rgba(196,149,106,0.7); outline-offset: 2px; }

.timeline-empty-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: rgba(196, 149, 106, 0.08);
  flex-shrink: 0;
}

.mood-timeline-detail {
  background: rgba(196, 149, 106, 0.05);
  border: 1px solid rgba(196, 149, 106, 0.18);
  border-radius: 10px;
  padding: 14px 18px;
  margin-top: 10px;
  font-size: 13px;
  color: rgba(232, 221, 212, 0.7);
  line-height: 1.6;
  animation: fadeUp 0.25s ease forwards;
}

/* ── WORD CLOUD (C3) placeholder CSS — full rules added in Task 6 ── */
.word-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  padding: 8px 0 16px;
  align-items: baseline;
}
.word-cloud-word {
  cursor: pointer;
  color: #c4956a;
  font-family: inherit;
  transition: opacity 0.2s ease, color 0.2s ease;
  user-select: none;
}
.word-cloud-word.active { color: #e8ddd4; }
.word-cloud-word:hover { opacity: 1 !important; }
```

- [ ] **Step 3: Add `renderTimeline()` function**

Add in the script block, after `renderHistory()`:

```javascript
// ── MOOD TIMELINE (C1) ──
var MOOD_COLORS = {
  Heavy: '#6b7a8d',
  Tired: '#8d7a6b',
  Restless: '#c4956a',
  Okay: '#a89880',
  Calm: '#7a9688',
  Alive: '#e8c170'
};

function renderTimeline() {
  var track = document.getElementById('mood-timeline-track');
  var detail = document.getElementById('mood-timeline-detail');
  if (!track) return;

  var now = new Date();
  var DAY_MS = 24 * 60 * 60 * 1000;

  // Index sessions by date string (YYYY-MM-DD)
  var byDate = {};
  sessions.forEach(function(s) {
    var d = new Date(s.date);
    var key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(s);
  });

  var html = '';
  for (var i = 29; i >= 0; i--) {
    var d = new Date(now.getTime() - i * DAY_MS);
    var key = d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
    var daySessions = byDate[key] || [];

    html += '<div class="timeline-day">';
    if (daySessions.length > 0) {
      daySessions.forEach(function(s) {
        // size: 8px (intensity 1) to 20px (intensity 10)
        var sz = Math.round(8 + ((s.intensity - 1) / 9) * 12);
        var color = MOOD_COLORS[s.mood] || '#a89880';
        html += '<div class="timeline-dot"' +
          ' style="width:' + sz + 'px;height:' + sz + 'px;background:' + color + ';min-width:' + sz + 'px;"' +
          ' data-session-date="' + s.date + '"' +
          ' onclick="expandTimelineDot(this)">' +
          '</div>';
      });
    } else {
      html += '<div class="timeline-empty-dot"></div>';
    }
    html += '</div>';
  }

  track.innerHTML = html;
  // Scroll to most recent (right)
  track.scrollLeft = track.scrollWidth;

  if (detail) { detail.style.display = 'none'; detail.innerHTML = ''; }
}
```

- [ ] **Step 4: Add `expandTimelineDot()` function**

Add after `renderTimeline()`:

```javascript
function expandTimelineDot(dot) {
  // Toggle off if clicking the same dot again
  var prev = document.querySelector('.timeline-dot.active-dot');
  if (prev === dot) {
    prev.classList.remove('active-dot');
    var detail = document.getElementById('mood-timeline-detail');
    if (detail) detail.style.display = 'none';
    return;
  }
  if (prev) prev.classList.remove('active-dot');
  dot.classList.add('active-dot');

  var dateStr = dot.getAttribute('data-session-date');
  var session = null;
  for (var i = 0; i < sessions.length; i++) {
    if (sessions[i].date === dateStr) { session = sessions[i]; break; }
  }
  if (!session) return;

  var d = new Date(session.date);
  var dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  var timeLabel = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  var fwdCtx = getForwardContextAt(session.date);

  var detail = document.getElementById('mood-timeline-detail');
  if (!detail) return;

  detail.innerHTML =
    '<p style="font-size:11px;color:rgba(232,221,212,0.3);margin-bottom:10px;">' + dateLabel + ' · ' + timeLabel + '</p>' +
    '<p style="margin-bottom:6px;">' + moodIcon(session.mood, 18) + '&nbsp;' + session.mood + '&nbsp;·&nbsp;' + session.intensity + '/10</p>' +
    (session.feeling ? '<p style="font-size:12px;color:rgba(232,221,212,0.5);margin-top:10px;line-height:1.6;">' + session.feeling + '</p>' : '') +
    (fwdCtx ? '<p style="font-size:11px;color:rgba(196,149,106,0.5);margin-top:8px;">' + fwdCtx + '</p>' : '');

  detail.style.display = 'block';
}
```

- [ ] **Step 5: Wire `renderTimeline()` into `renderHistory()`**

At the end of `renderHistory()` (after the existing `setTimeout(() => initScrollReveal(), 100)` call), add:

```javascript
renderTimeline();
```

Also remove the lines that build `list.innerHTML` for the old `#history-list` — that element no longer exists. Delete the `reversed.map()` block that generated `.history-entry` divs (it was feeding `#history-list`). The timeline replaces it.

- [ ] **Step 6: Verify in browser**

Navigate to Pattern screen with at least a few sessions in history. Check:
- A row of dots appears, scrollable horizontally
- Dot colour matches mood colour
- Dot size varies with intensity
- Tapping a dot shows an expanded detail card below the track
- Tapping the same dot again collapses it
- Tapping a different dot switches to that session

- [ ] **Step 7: Commit**

```bash
git add rewind/index.html
git commit -m "feat(rewind): C1 30-day mood timeline replacing flat log list"
```

---

## Task 6: C3 — Feeling Word Cloud

**Files:**
- Modify: `rewind/index.html` — add `renderWordCloud()` and `filterByWord()`, wire into `renderHistory()`

---

- [ ] **Step 1: Add stop word list and `renderWordCloud()` function**

Add in the script block, after `expandTimelineDot()`:

```javascript
// ── WORD CLOUD (C3) ──
var STOP_WORDS = ['a', 'an', 'the', 'and', 'or', 'but', 'i', 'me', 'my', 'am',
  'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does',
  'did', 'will', 'would', 'could', 'should', 'may', 'might', 'so', 'if', 'in',
  'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'as', 'it', 'its',
  'this', 'that', 'these', 'those', 'not', 'no', 'just', 'than', 'then', 'when',
  'what', 'how', 'very', 'really', 'like', 'feel', 'feeling', 'about', 'there',
  'their', 'they', 'into', 'all', 'been', 'him', 'her', 'out', 'one', 'can',
  'still', 'even', 'much', 'only', 'also', 'bit', 'kind', 'lot', 'bit', 'some'];

var activeWordFilter = null;

function renderWordCloud() {
  var el = document.getElementById('word-cloud');
  var wrap = document.getElementById('reveal-wordcloud');
  if (!el || !wrap) return;

  var wordCounts = {};
  sessions.forEach(function(s) {
    if (!s.feeling) return;
    var words = s.feeling.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
    words.forEach(function(w) {
      if (w.length < 3) return;
      if (STOP_WORDS.indexOf(w) !== -1) return;
      wordCounts[w] = (wordCounts[w] || 0) + 1;
    });
  });

  // Only words appearing in 2+ sessions
  var entries = [];
  for (var w in wordCounts) {
    if (wordCounts[w] >= 2) entries.push([w, wordCounts[w]]);
  }

  if (entries.length === 0) {
    wrap.style.display = 'none';
    return;
  }

  entries.sort(function(a, b) { return b[1] - a[1]; });
  var top = entries.slice(0, 20);
  var maxCount = top[0][1];
  var minCount = top[top.length - 1][1];

  el.innerHTML = top.map(function(e) {
    var word = e[0], count = e[1];
    var t = maxCount === minCount ? 1 : (count - minCount) / (maxCount - minCount);
    var fontSize = Math.round(11 + t * 11);   // 11–22px
    var opacity = (0.35 + t * 0.6).toFixed(2); // 0.35–0.95
    return '<span class="word-cloud-word" ' +
      'style="font-size:' + fontSize + 'px;opacity:' + opacity + ';" ' +
      'onclick="filterByWord(\'' + word.replace(/'/g, "\\'") + '\')">' +
      word + '</span>';
  }).join('');

  wrap.style.display = 'block';
}

function filterByWord(word) {
  var dots = document.querySelectorAll('.timeline-dot');
  var words = document.querySelectorAll('.word-cloud-word');

  if (activeWordFilter === word) {
    // Clear filter
    activeWordFilter = null;
    dots.forEach(function(d) { d.classList.remove('filtered-out'); });
    words.forEach(function(w) { w.classList.remove('active'); });
    return;
  }

  activeWordFilter = word;

  // Highlight active word
  words.forEach(function(w) {
    w.classList.toggle('active', w.textContent === word);
  });

  // Dim non-matching dots
  dots.forEach(function(dot) {
    var dateStr = dot.getAttribute('data-session-date');
    var session = null;
    for (var i = 0; i < sessions.length; i++) {
      if (sessions[i].date === dateStr) { session = sessions[i]; break; }
    }
    var matches = session && session.feeling &&
      session.feeling.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).indexOf(word) !== -1;
    dot.classList.toggle('filtered-out', !matches);
  });
}
```

- [ ] **Step 2: Call `renderWordCloud()` from `renderHistory()`**

In `renderHistory()`, alongside the existing `renderTimeline()` call at the bottom, add:

```javascript
renderWordCloud();
```

- [ ] **Step 3: Verify in browser**

Navigate to Pattern screen. With sessions that have feeling text:
- Above the timeline, word cloud appears (if 2+ sessions share a word)
- Words are sized proportionally — more frequent = larger
- Tapping a word highlights it and dims non-matching timeline dots
- Tapping the same word again clears the filter

With fewer than 2 sessions sharing any word: word cloud section stays hidden.

- [ ] **Step 4: Commit**

```bash
git add rewind/index.html
git commit -m "feat(rewind): C3 feeling word cloud with tap-to-filter timeline"
```

---

## Task 7: C4 — Forward Context in Pattern

**Files:**
- Modify: `rewind/index.html` — add `getForwardContextAt()`, already wired into `expandTimelineDot()` from Task 5

---

- [ ] **Step 1: Add `getForwardContextAt()` function**

This function was referenced in `expandTimelineDot()` (Task 5) but not yet defined. Add it in the script block, after `getForwardContextSummary()`:

```javascript
// ── FORWARD CONTEXT AT TIME (C4) ──
function getForwardContextAt(dateStr) {
  try {
    var items = JSON.parse(localStorage.getItem('forward_items') || '[]');
    var checkinTime = new Date(dateStr).getTime();
    var WINDOW_MS = 12 * 60 * 60 * 1000; // ±12 hours

    var nearby = items.filter(function(item) {
      var updated = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      if (!updated) updated = item.createdAt ? new Date(item.createdAt).getTime() : 0;
      return Math.abs(updated - checkinTime) <= WINDOW_MS;
    });

    if (nearby.length === 0) return null;

    var projects = JSON.parse(localStorage.getItem('forward_projects') || '[]');
    var projectNames = [];
    nearby.forEach(function(item) {
      if (item.projectId) {
        var proj = projects.find(function(p) { return p.id === item.projectId; });
        if (proj && proj.name && projectNames.indexOf(proj.name) === -1) {
          projectNames.push(proj.name);
        }
      }
    });

    var count = nearby.length;
    var projectPart = projectNames.length > 0 ? ' · ' + projectNames[0] : '';
    return count + ' active capture' + (count !== 1 ? 's' : '') + projectPart;
  } catch (e) { return null; }
}
```

Note: `expandTimelineDot()` (Task 5) already calls `getForwardContextAt(session.date)` and renders the result as a muted line in the detail card. No further HTML changes needed — this task just provides the missing function.

- [ ] **Step 2: Verify in browser**

Tap a timeline dot for a session that occurred while Forward items were active. In the expanded detail card:
- A muted amber line appears: e.g. `"3 active captures · building Forward"`
- For sessions with no nearby Forward activity, the line is absent

If no Forward data exists yet (no `forward_items` in localStorage), the function returns null silently — no error, no UI change.

- [ ] **Step 3: Commit**

```bash
git add rewind/index.html
git commit -m "feat(rewind): C4 Forward context line in timeline session detail"
```

---

## Task 8: Final Integration Check + Version Bump

**Files:**
- Modify: `rewind/index.html` — bump `REWIND_VERSION`, add update card entry

---

- [ ] **Step 1: Bump version**

Find `const REWIND_VERSION = '1.2.0';` in the script block. Change to:

```javascript
const REWIND_VERSION = '1.3.0';
```

- [ ] **Step 2: Add update card for 1.3.0**

Find the `UPDATES` object. Add a new entry before the closing `};`:

```javascript
'1.3.0': {
  title: 'Rewind just got quieter and richer.',
  lines: [
    'New mood icons — natural, minimal.',
    'AI reflection shaped to this moment.',
    'A place to capture what surfaces.',
    'Your feeling vocabulary, mirrored back.',
    '30-day mood timeline with Forward context.'
  ]
}
```

- [ ] **Step 3: Full smoke-test checklist**

Run through each flow in the browser:

**Check-in flow:**
- [ ] Mood selector shows 6 SVG icons (not emoji)
- [ ] All 6 moods selectable, intensity slider works
- [ ] Complete check-in → reflection screen shows SVG icon (48px) at top
- [ ] Hardcoded response appears immediately
- [ ] Within 5s, AI sentence fades in (or hardcoded stays if function unavailable)
- [ ] Italic follow-up question fades in below
- [ ] Spark input accepts text, Enter saves to `rewind_sparks`, "captured." confirmation shows

**Pattern screen:**
- [ ] Timeline renders 30-day row of dots
- [ ] Dot colour matches mood, size varies with intensity
- [ ] Tapping a dot shows detail: mood icon, intensity, feeling text, Forward context (if available)
- [ ] Tapping same dot again collapses
- [ ] Word cloud appears above timeline (requires 2+ sessions sharing a word)
- [ ] Tapping a word filters timeline dots
- [ ] Tapping same word again clears filter

**Returning user:**
- [ ] Update card appears for existing users (version changed from 1.2.0 to 1.3.0)

- [ ] **Step 4: Final commit**

```bash
git add rewind/index.html
git commit -m "feat(rewind): v1.3.0 — mood icons, AI reflection, spark capture, timeline, word cloud"
```

---

## Self-Review Notes

**Spec coverage check:**
- B1 (AI reflection): Tasks 2 + 3 ✓
- B2 (Follow-up prompts): Tasks 2 + 3 ✓
- B3 (Spark capture): Task 4 ✓
- C1 (Mood timeline): Task 5 ✓
- C3 (Word cloud): Task 6 ✓
- C4 (Forward context): Task 7 ✓
- Mood icons — all 4 usage points: Task 1 ✓
- Firebase Cloud Function: Task 2 ✓

**Type/name consistency:**
- `moodIcon(mood, size)` — defined Task 1, used Tasks 1, 5, 7
- `getForwardContextAt(dateStr)` — defined Task 7, called Task 5 (define before calling: add Task 7's function before Task 5's `expandTimelineDot` in the file)
- `getForwardContextSummary()` — defined Task 3, standalone
- `fetchAIReflection(session, callback)` — defined Task 3, called in `renderReflection()`
- `MOOD_COLORS` — defined Task 5, used only in `renderTimeline()`
- `activeWordFilter` — defined Task 6, used in `filterByWord()`
- `sessions` — existing global array, read by all new functions

**Order note for implementation:** In `rewind/index.html`, add functions in this order:
1. `moodIcon()` — top of script
2. `getForwardContextSummary()` — after existing storage functions
3. `getForwardContextAt()` — immediately after `getForwardContextSummary()`
4. `fetchAIReflection()` — after `getForwardContextAt()`
5. `submitSpark()` — after `fetchAIReflection()`
6. `MOOD_COLORS`, `renderTimeline()`, `expandTimelineDot()` — after `renderHistory()`
7. `STOP_WORDS`, `activeWordFilter`, `renderWordCloud()`, `filterByWord()` — after `expandTimelineDot()`
