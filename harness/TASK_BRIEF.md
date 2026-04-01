# TASK BRIEF — Forward Build Session 3
**Session:** FWD-20260402-0139  
**Iteration:** 1  
**Date:** 2026-04-02

---

## Product Context
- **Product:** Forward — ADHD-first PWA, companion app to Rewind
- **Stack:** Pure HTML + CSS + Canvas 2D / localStorage / Gemini BYOK (ai.js)
- **Generator Skill:** senior-app-developer
- **Config:** `C:\Users\User\AI Project\FORWARD\FOUNDATION\FWD.HARNESS.config.md`

---

## Phases Completed (Sessions 1 & 2)
- ✅ Phase 1: 2-mode nav (Plan/Work top bar, no bottom tabs)
- ✅ Phase 2: Mood bridge (renderHome reads rewind_sessions, orb position, greeting copy)
- ✅ Phase 3: Capture omnipresence (global FAB, 50ms auto-focus, hides in focus mode)
- ✅ Phase 4: Return state + empty states (>4hr intercept, warm copy throughout)

---

## Session 3 Scope: The Intelligence Layer

**Phases targeted this session:**
- **Phase 5** — AI Companion integration polish (onboarding, graceful states, in-task companion UX)
- **Phase 6** — Living Projects emotional framing (vision field prominence, belief-restoring companion)
- **Phase 7** — Sparks ↔ Rewind cross-reference (read `rewind_sparks` localStorage)

These three phases form a coherent unit: deepening Forward's emotional intelligence and making the AI feel present, warm, and contextually aware — not a feature bolted on.

---

## Task

**Title:** AI Companion Onboarding + Sparks Bridge + Living Projects

**Scope — 5 concrete deliverables:**

### Deliverable 1: AI Companion First-Use Onboarding Card
**File:** `js/render.js`, `index.html`, `css/`

On first Work mode open (when `gemini_api_key` is not set), before rendering tasks, show a warm introductory card explaining the companion:

```
[card — surface2 background, amber left border]

your AI companion

Forward's AI reads your mood and project context before 
it speaks. It won't interrupt — it waits until you ask.

→ Set up in Settings         [maybe later]
```

Behaviour:
- Only appears once (track with `forward_companion_seen` in localStorage)
- "Set up in Settings" opens the Settings screen to the AI key input row
- "maybe later" dismisses the card permanently for this session (doesn't re-show on same open)
- If key is already set, card never shows — companion works silently
- Card must render ABOVE the task list area (between the orb/greeting and the work items)

### Deliverable 2: AI Companion Work Mode Surface
**File:** `js/render.js`, `index.html`

Currently `renderWork()` shows tasks but no path into the AI companion for the current task. Add a quiet "ask for help" affordance below the surfaced task card:

```
[task card]

→ help me start          [tiny, muted, below the task]
```

Tapping it calls `runHelpMeStart(candidate)` — which already exists in `render.js`. The AI companion is already built. This just connects it to Work mode's surfaced task.

If no Gemini key is set, tapping "help me start" shows the onboarding card instead of routing to Settings directly (softer).

### Deliverable 3: Vision Field Emotional Prominence
**File:** `js/actions.js` (openProjectSheet), `index.html` (project-sheet)

The vision field already exists with 48-hour lock logic. It needs an emotional reframe:

**Change 1 — The prompt text.** Replace the placeholder on the vision `contenteditable` from nothing to:
```
what did you believe when you started this?
```
(lowercase, no punctuation, as placeholder text via CSS `:empty::before`)

**Change 2 — Vision section header.** Change the section label from `vision` to:
```
what you believed
```

**Change 3 — First-open AI read.** When `openProjectSheet()` is called and the project has a `vision` field AND a Gemini key is set: after the existing `autoSuggestNextAction` call, also call `aiReadProject(p)` after a 600ms delay, but only if the AI thread is not already open and this is the first open of this project today (track with `p.lastAIReadDate`).

This makes the companion feel like it's paying attention to why you started, not just what's next.

### Deliverable 4: Sparks ↔ Rewind Cross-Reference
**File:** `js/render.js` (renderItemHTML), `js/actions.js` (openItemAction)

When a captured item has category `spark` (either `item.category === 'spark'` OR `item.aiCategory === 'spark'`):

1. **In the inbox list:** Add a subtle `[↯ Rewind]` echo indicator to the spark's footer if `rewind_sparks` localStorage key exists and contains any entry whose `text` substring-matches the item content (case-insensitive, first 30 chars).

2. **In the item detail sheet (openItemAction):** When a spark item is opened, read `rewind_sparks` from localStorage (key: `rewind_sparks`, value: JSON array of `{ text, date, tags }` objects). If a matching spark exists in Rewind (same 30-char substring match), show a quiet bridge card:

```
[card — teal left border, muted background]

this echoed in Rewind

"[matching rewind spark text — truncated to 80 chars]"

[time ago]     ↗ open Rewind
```

3. **If no matching spark:** No card shown. Silence is correct when there's no echo.

**Data contract (read-only, Forward never writes to rewind_sparks):**
```javascript
// Rewind writes:
localStorage.setItem('rewind_sparks', JSON.stringify([
  { text: "string", date: "ISO string", tags: ["optional"] }
]))

// Forward reads — safe read pattern:
const rawSparks = localStorage.getItem('rewind_sparks');
const rewindSparks = rawSparks ? JSON.parse(rawSparks) : [];
```

Safari compat note: Use `try/catch` around the JSON.parse. If parse fails, `rewindSparks = []`.

### Deliverable 5: Data Aging — Quiet Cold Archive (Phase 8 fold-in)
**File:** `js/data.js` (runLifecycle already exists)

The existing `runLifecycle()` already handles status transitions. Extend it:

Items with `status === 'fresh'` that have not been interacted with for **14+ days** (check `createdAt`) should automatically move to `status: 'cold'`. Items already `cold` for 30+ days move to `status: 'archived'` silently.

This keeps the Inbox feeling current without user action. It aligns with the "quiet archive" principle — the app curates itself.

**Guard:** Do NOT archive items with `category === 'reminder'` or `aiCategory === 'reminder'` automatically. Reminders must be explicitly dismissed.

---

## Acceptance Criteria

- [ ] First Work mode open without Gemini key shows the onboarding companion card
- [ ] Onboarding card does NOT appear if key is already set
- [ ] "help me start" link appears below the surfaced task in Work mode
- [ ] Tapping "help me start" with no key shows onboarding card, not Settings redirect
- [ ] Project vision field shows `what you believed` section label
- [ ] Vision `contenteditable` shows correct placeholder copy via CSS
- [ ] Opening a project with a `vision` field silently triggers `aiReadProject()` on first daily open (if key set)
- [ ] Spark items in inbox show `↯ Rewind` indicator when a matching rewind spark exists
- [ ] Opening a spark item shows the Rewind echo bridge card when a match exists
- [ ] Opening a spark item shows nothing extra when no match exists
- [ ] Items 14+ days old (not reminders) move to `cold` automatically
- [ ] Items 30+ days cold (not reminders) move to `archived` automatically
- [ ] All existing features still function (projects, focus, backup, Apple Reminders)
- [ ] No optional chaining (`?.`) or nullish coalescing (`??`) anywhere in new code

---

## Stack Notes (must-read before writing code)

```
SAFARI COMPAT — HARD REQUIREMENT
  No optional chaining: obj?.prop → obj && obj.prop
  No nullish coalescing: val ?? def → val !== null && val !== undefined ? val : def
  No Array.at() — use array[array.length - 1]
  No top-level await

DESIGN TOKENS for new UI
  New cards: background rgba(30,25,20,0.6), border 1px solid rgba(196,149,106,0.2)
  Teal accent for Sparks/Rewind bridge: #7eb8a4, border rgba(126,184,164,0.25)
  Amber accent for AI companion: #c4956a, border rgba(196,149,106,0.25)
  Text: #e8ddd4 primary, #8a837c muted
  Font: DM Sans weight 300 for body, Cormorant Garamond for any display headings

COPY CONVENTIONS
  All copy lowercase, no terminal punctuation on short lines
  No technical language visible to user
  "help me start" not "Get AI assistance"
  "what you believed" not "Project Vision"

FILES THAT MUST NOT BE MODIFIED
  forward-load.html
  The 4-layer orb in forward-load.html
  Any existing working feature (projects persist, focus timer, backup/restore all work)
```

---

## Evaluator Grading Rubric (from config)

| Criterion | Weight | Pass Score | Hard? |
|---|---|---|---|
| ADHD Capture Integrity | 0.20 | 7 | ✓ HARD |
| Mood/State Bridge | 0.18 | 7 | ✓ HARD |
| Navigation Architecture | 0.17 | 6 | — |
| Design DNA Fidelity | 0.15 | 6 | — |
| Feature Completeness | 0.15 | 6 | — |
| Emotional Tone & UX Copy | 0.10 | 6 | — |
| PWA & Technical Quality | 0.05 | 5 | — |

Session 3 primarily moves: **Feature Completeness** (+Sparks, +aging, +companion), **Emotional Tone** (+vision reframe, +warm copy), **Design DNA** (new cards match design system).

---

## Constraints

- `js/ai.js` is stable and comprehensive — do NOT rewrite it. Use its existing exports: `getGeminiKey()`, `callGemini()`, `helpMeStartAI()`, `aiReadProject()`, `toggleProjectAI()`
- `renderWork()` in `render.js` is the correct place to inject the onboarding card and "help me start" affordance — it is called from `renderHome()` already
- `runLifecycle()` in the existing codebase is the correct place to add aging logic — it already runs on every render cycle
- The Rewind spark matching must be loose (substring, 30 chars) — exact match will miss due to natural language variation
- `forward_companion_seen` key in localStorage controls whether onboarding has been shown

## Delta Notes from Previous Iterations
*(Empty — iteration 1)*

---

## Session Goal

A user with ADHD opens Forward, opens a Spark they captured 3 days ago, and sees — quietly — that they were thinking the same thing in Rewind. They open a project, and the AI reads their original belief back to them before surfacing what's next. The app has started to feel like it knows them.
