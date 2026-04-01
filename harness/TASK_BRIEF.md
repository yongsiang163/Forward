# TASK BRIEF — Forward Build Session 4
**Session:** FWD-20260402-0200
**Iteration:** 1
**Date:** 2026-04-02

---

## Product Context
- **Product:** Forward — ADHD-first PWA, companion app to Rewind
- **Stack:** Pure HTML + CSS + Canvas 2D / localStorage / Gemini BYOK (ai.js)
- **Generator Skill:** senior-app-developer
- **Config:** `C:\Users\User\AI Project\FORWARD\FOUNDATION\FWD.HARNESS.config.md`

---

## Phases Completed (Sessions 1–3)
- ✅ Phase 1: 2-mode nav (Plan/Work top bar)
- ✅ Phase 2: Mood bridge (orb position, mood-aware greeting, task surfacing)
- ✅ Phase 3: Capture omnipresence (global FAB, 50ms auto-focus)
- ✅ Phase 4: Return state + empty states (>4hr intercept, warm copy)
- ✅ Phase 5: AI Companion integration polish (onboarding, graceful states, in-task affordance)
- ✅ Phase 6: Living Projects emotional framing (vision field, "what you believed" label)
- ✅ Phase 7: Sparks ↔ Rewind cross-reference (rewind_sparks localStorage bridge)
- ✅ Phase 8: Data aging (quiet archive of 14+ day items, reminder guard)

---

## Session 4 Scope: Platform, Polish & Daily Presence

**Phases targeted this session:**
- **Phase 9** — PWA audit (installable on iPhone, offline-capable)
- **Phase 10** — Rewind transition (orb descent animation)
- **New A** — Full item editing (edit captured text after save)
- **New B** — Inbox swipe triage (swipe to archive / promote)
- **New C** — AI Daily Brief (first-open orientation card)

These form a coherent unit: make the app solid to install, alive with personality on every open, and frictionless to use day-to-day.

---

## Task

**Title:** PWA Hardening + Daily Presence + Inbox Friction Removal

**Scope — 5 concrete deliverables:**

---

### Deliverable 1: PWA Audit (Phase 9)
**Files:** `manifest.json`, `sw.js`, `index.html`, new icon assets

**Problem:** `manifest.json` references `icon-192.png` and `icon-512.png` but neither file exists on disk. The app cannot be installed on iPhone home screen.

**Required changes:**

**1a — Icon assets.** Create two PNG icon files at the project root:
- `icon-192.png`: 192×192px. Background `#0e0b09`. Centred amber dot (radius ~40px, fill `#c4956a`) with a subtle outer glow ring (rgba(196,149,106,0.2), radius ~55px). Use an HTML Canvas script to generate and save as PNG, or create as a static placeholder. Must be a real PNG (not an empty file).
- `icon-512.png`: 512×512px. Same design scaled proportionally.

**1b — Manifest improvements.** Update `manifest.json`:
```json
{
  "name": "Forward",
  "short_name": "Forward",
  "id": "/",
  "description": "An intentional, attention-aware productivity companion.",
  "start_url": "./index.html",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0e0b09",
  "theme_color": "#0e0b09",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

**1c — apple-touch-icon href.** Verify the `<link rel="apple-touch-icon">` in `index.html` has a correct `href="icon-192.png"`. If missing or broken, fix it.

**1d — Service worker cache list audit.** In `sw.js`, verify `urlsToCache` includes all files that actually exist. Remove any references to files that don't exist (e.g. `css/main.css` if not present). Add any missing critical files. The install step must not fail.

**1e — Offline fallback.** `404.html` already exists. Confirm the service worker returns it for navigate requests that fail on network AND cache miss. If not already handled, add:
```javascript
.catch(() => caches.match('./404.html'))
```
to the navigate branch in the fetch handler.

---

### Deliverable 2: Rewind Transition Animation (Phase 10)
**Files:** `js/actions.js`, `js/app.js` or `js/render.js` (canvas access)

Rewind opens via `toggleRewindMode()` in `actions.js`. Currently it instantly shows the Rewind container with no transition. Add an orb descent animation before the container appears.

**Behaviour:**
When `toggleRewindMode()` is called to OPEN Rewind (the `!isShown` branch):
1. Call `animateOrbDescent(function() { /* show container */ })` instead of showing container directly.
2. Pass the existing show-container logic as the callback.

**`animateOrbDescent(callback)` — implementation:**
- Find the home screen orb canvas (`#orb-canvas` or the canvas element in `#home-screen`).
- Over 900ms using `requestAnimationFrame`:
  - Translate the orb's Y position downward (out of view below the horizon line).
  - Simultaneously reduce canvas opacity from 1.0 to 0.
  - Fade the entire home screen content (`.home-content` or the parent div) from opacity 1 to 0.
- After animation completes, run `callback()` to show the Rewind container.
- When `toggleRewindMode()` is called to CLOSE Rewind (the `isShown` branch), reset canvas opacity and home content opacity to 1 before calling `showScreen()`.

**Implementation note:** The orb is drawn on a Canvas element via `requestAnimationFrame` in `app.js`. Rather than intercepting the canvas draw loop, the simplest approach is to apply `style.transition` and `style.opacity` directly to the canvas DOM element and the home content wrapper, then use a `setTimeout(callback, 900)` after triggering the CSS transition.

**Safari compat:** Use `element.style.transition = 'opacity 0.9s ease'` and `element.style.opacity = '0'`. No optional chaining. No CSS custom properties in JS.

---

### Deliverable 3: Full Item Editing
**Files:** `js/actions.js`, `index.html`, `css/`

Currently there is no way to edit the text of a captured item after saving. This is a critical gap for voice capture errors.

**Add an Edit button to the item action sheet:**

In `openItemAction()` in `actions.js`, after the existing action buttons are rendered, add an "edit" button row.

**New HTML in `index.html` (inside `#item-action-sheet`):**
Add an edit panel div (hidden by default):
```html
<div id="ia-edit-panel" style="display:none;">
  <textarea id="ia-edit-content" class="ia-edit-textarea" placeholder="what did you capture?"></textarea>
  <div class="ia-edit-actions">
    <button class="ia-btn ia-btn-primary" onclick="saveItemEdit()">save</button>
    <button class="ia-btn ia-btn-muted" onclick="cancelItemEdit()">cancel</button>
  </div>
</div>
```

**New functions in `actions.js`:**

`enterItemEditMode()`:
- Hide the normal action sheet button area.
- Show `#ia-edit-panel`.
- Populate `#ia-edit-content` with the raw item content (use `item.rawContent` if present, else `item.content`).
- Focus the textarea.

`saveItemEdit()`:
- Read value from `#ia-edit-content`.
- If empty, show toast "nothing to save" and return.
- Update `item.content` and clear `item.rawContent`, `item.aiTitle`, `item.aiSummary`, `item.aiActions` (user has overridden the AI summary).
- Set `item.aiPending = false`, `item.confirmed = false`.
- Call `save()`.
- Call `closeItemAction()`.
- Show toast "updated".

`cancelItemEdit()`:
- Hide `#ia-edit-panel`, show the normal action buttons.

**Add "edit" affordance:**
In `openItemAction()`, add a small "edit" text button (not primary — muted style) to the sheet that calls `enterItemEditMode()`. Place it below the main action buttons, above the close row.

**CSS:** `.ia-edit-textarea` — full width, min-height 100px, background surface2 (`rgba(30,25,20,0.6)`), border `1px solid rgba(196,149,106,0.2)`, color `#e8ddd4`, font DM Sans weight 300, padding 12px, border-radius 8px. No resize handle (`resize: none`).

---

### Deliverable 4: Inbox Swipe Triage
**Files:** `js/render.js`, `js/actions.js`, `css/layout.css`

Add horizontal swipe gestures to inbox items for rapid triage without opening the action sheet.

**Swipe right → archive.** Swipe left → promote to task (set `item.category = 'task'`).

**Implementation — touch event delegation on `#inbox-list`:**

In `renderInbox()`, after setting `list.innerHTML`, attach delegated touch handlers to the `list` element. Use a single listener pair (touchstart + touchend) to avoid stacking listeners on re-renders.

```javascript
// Remove old listeners by replacing the node (clone trick)
// Then attach fresh ones on the new list
```

**Touch handler logic:**
- `touchstart`: record `_swipeStartX` and the target `.inbox-item` element.
- `touchmove`: compute `deltaX = currentX - _swipeStartX`. Apply `transform: translateX(${deltaX}px)` to the item. Show a colour hint behind it: amber (`rgba(196,149,106,0.15)`) on right, teal (`rgba(126,184,164,0.15)`) on left.
- `touchend`:
  - If `deltaX > 80`: archive the item. Animate it fully off-screen right, then call the archive logic (`item.status = 'archived'; item.archivedAt = new Date().toISOString(); save(); renderInbox()`). Show toast "archived" with undo.
  - If `deltaX < -80`: promote to task. Set `item.category = 'task'; item.confirmed = true; save(); renderInbox()`. Show toast "moved to tasks".
  - Otherwise: spring back — set `transition: transform 0.2s ease` then `transform: translateX(0)`.
  - In all cases, remove the colour hint background.

**Undo for archive:** The existing archive undo pattern in `renderInbox()` already supports undo. Hook into that.

**No swipe on done/archived items.** Guard: only attach swipe on items with `status !== 'archived' && status !== 'done'`.

**Safari compat:** `touchstart`, `touchmove`, `touchend` are all supported. Use `event.touches[0].clientX`. No pointer events API.

---

### Deliverable 5: AI Daily Brief
**Files:** `js/render.js`, `js/ai.js`, `css/layout.css`

On the first open of each new day, when the user arrives at Work mode and a Gemini key is set, show a brief AI-generated orientation sentence below the mood greeting — before the task card.

**Trigger conditions (all must be true):**
- `getGeminiKey()` returns a truthy value.
- `localStorage.getItem('forward_daily_brief_date') !== new Date().toDateString()`.
- The mood state is NOT `overwhelmed` or `heavy` (don't add cognitive load on bad days).
- At least 1 alive/fresh item exists.

**Implementation:**

New function `renderDailyBrief(area, candidate, session)` called from `renderWork()` after the task card is rendered (before the `companion-onboard-card` block):

```javascript
function renderDailyBrief(area, candidate, session) {
  var today = new Date().toDateString();
  if (localStorage.getItem('forward_daily_brief_date') === today) return;
  var key = typeof getGeminiKey === 'function' && getGeminiKey();
  if (!key) return;
  var mood = session && session.moodState ? session.moodState : null;
  if (mood === 'overwhelmed' || mood === 'heavy') return;

  // Mark as shown for today immediately (prevents double-fire on re-render)
  localStorage.setItem('forward_daily_brief_date', today);

  var briefCard = document.createElement('div');
  briefCard.className = 'daily-brief-card';
  briefCard.innerHTML = '<p class="daily-brief-text">...</p>';
  area.insertBefore(briefCard, area.firstChild);

  // Build context
  var moodLine = mood ? ('mood: ' + mood) : 'no check-in today';
  var topItems = items
    .filter(function(i) { return i.status === 'fresh' || i.status === 'alive'; })
    .slice(0, 3)
    .map(function(i) { return (i.aiTitle || i.content || '').substring(0, 60); })
    .join('; ');
  var prompt = 'You are a calm, warm companion for someone with ADHD. ' +
    'In one sentence (max 20 words), orient them for today. ' +
    'Do not mention ADHD. Do not use the word "today". No emojis. Lowercase. No terminal punctuation. ' +
    'Context — ' + moodLine + '. Top items: ' + topItems;

  callGemini(prompt, function(text) {
    var el = briefCard.querySelector('.daily-brief-text');
    if (el && text) el.textContent = text.trim().toLowerCase().replace(/\.$/, '');
  });
}
```

**CSS for `.daily-brief-card`:**
```css
.daily-brief-card {
  margin: 0 0 16px 0;
  padding: 0;
}
.daily-brief-text {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.1rem;
  font-weight: 400;
  color: rgba(232, 221, 212, 0.55);
  letter-spacing: 0.03em;
  text-align: center;
  font-style: italic;
}
```

No card border, no background. The brief floats as ambient text — felt, not seen. It disappears on re-render (which is fine — it shows once per day on first Work mode open).

**Note on `callGemini`:** Verify the signature of `callGemini` in `ai.js` before implementing. If it returns a Promise rather than accepting a callback, adapt accordingly. Do not rewrite `ai.js`.

---

## Acceptance Criteria

- [ ] `icon-192.png` and `icon-512.png` exist and are valid PNG files
- [ ] `manifest.json` has `id`, `orientation`, `purpose: "any maskable"` on icons
- [ ] `apple-touch-icon` href points to an existing file
- [ ] Service worker installs without errors (no missing cache files)
- [ ] App loads and shows cached content when network is offline
- [ ] Entering Rewind triggers orb descent + fade animation (~900ms) before container appears
- [ ] Exiting Rewind restores home screen opacity to 1
- [ ] Item action sheet has an "edit" button
- [ ] Tapping edit shows a textarea populated with item content
- [ ] Saving updates content, clears AI summary fields, closes sheet, shows toast
- [ ] Inbox items respond to horizontal swipe
- [ ] Right swipe >80px archives item with undo toast
- [ ] Left swipe >80px promotes item to task with toast
- [ ] Swipe spring-back works when threshold not reached
- [ ] Daily brief appears on first Work mode open of new day (when key set, mood not heavy)
- [ ] Daily brief does NOT appear on subsequent Work mode opens same day
- [ ] Daily brief does NOT appear if mood is heavy or overwhelmed
- [ ] All existing features still function (projects, focus, backup, auth)
- [ ] No optional chaining (`?.`) or nullish coalescing (`??`) in new code

---

## Stack Notes (must-read before writing code)

```
SAFARI COMPAT — HARD REQUIREMENT
  No optional chaining: obj?.prop → obj && obj.prop
  No nullish coalescing: val ?? def → val !== null && val !== undefined ? val : def
  No Array.at() — use array[array.length - 1]
  No top-level await

DESIGN TOKENS
  New cards: background rgba(30,25,20,0.6), border 1px solid rgba(196,149,106,0.2)
  Teal accent for Sparks/Rewind bridge: #7eb8a4
  Amber accent: #c4956a
  Text: #e8ddd4 primary, #8a837c muted
  Font: DM Sans weight 300 for body, Cormorant Garamond for display

COPY CONVENTIONS
  All copy lowercase, no terminal punctuation on short lines
  "archive" not "delete", "moved to tasks" not "categorised as task"
  Brief text should feel like a breath, not a summary

FILES THAT MUST NOT BE MODIFIED
  forward-load.html
  The 4-layer orb in forward-load.html
  js/ai.js core functions (read and use, do not rewrite)
  Any existing working feature (projects persist, focus timer, backup/restore all work)
```

---

## Evaluator Grading — Session 4 Focus

Session 4 primarily moves:
- **PWA & Technical Quality** (icon assets, manifest, SW audit)
- **Feature Completeness** (item editing, swipe triage, daily brief)
- **Emotional Tone** (daily brief copy quality, transition animation feel)
- **Design DNA Fidelity** (animation stays on-brand, new elements match system)

---

## Delta Notes from Previous Iterations
*(Empty — iteration 1)*

---

## Session Goal

A user installs Forward on their iPhone home screen. They open it in the morning and see one quiet sentence that orients them. They capture something, realise they made a voice error, edit it in place. They work through their inbox with a swipe. At the end of the day, they tap "check in with yourself" and watch the orb descend into Rewind.
