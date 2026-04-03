# Rewind Upgrades — Design Spec
**Date:** 2026-04-03
**Status:** Approved for implementation

---

## Overview

Six upgrades to Rewind, Forward's emotional check-in companion. The work spans three areas: smarter AI reflection (B1–B3), richer pattern screens (C1, C3, C4), and a new custom mood icon system. All features are built into the existing single-file Rewind architecture (`rewind/index.html`), with one new Firebase Cloud Function for server-side AI calls.

---

## 1. Architecture

### AI Calls — Firebase Cloud Function Proxy

AI-powered features (B1, B2) route through a new Firebase Cloud Function named `rewindReflect`, deployed to the existing `forward-163fr` project in `asia-southeast1`.

**Why:** Keeps the Gemini API key server-side. Users do not need their own key for Rewind features — this is built-in ambient intelligence, not BYOK.

**Function contract:**
```
POST /rewindReflect
Body: { mood, feeling, history, forwardContext }
Response: { reflection, followUp }
```

- `reflection` — single sentence for B1 (AI-personalised reflection). Null if not applicable.
- `followUp` — single question string for B2 (evolved follow-up prompt). Null if not applicable.
- Both fields are optional; the client falls back gracefully if either is null or if the function call fails.

**Fallback:** If the function is unavailable or returns an error, Rewind silently falls back to the existing hardcoded reflection responses. No error state is shown to the user.

**Client call:** Plain `fetch()` with a 5-second timeout. If it times out, fall back. No retry logic.

### Data Sources (read-only from Forward)

Rewind reads the following from `localStorage`, same as today:
- `rewind_sessions` — check-in history
- `forward_items` — active Forward captures (for B1/C4 context)
- `rewind_sparks` — spark captures (B3 writes here; Forward reads)

No new data contracts are introduced.

---

## 2. Features — Smarter Reflection (B1, B2, B3)

### B1 — AI-Personalised Reflection

**Where:** Reflection screen, replaces the current hardcoded response paragraph.

**Behaviour:**
1. After mood + feeling are submitted, Rewind calls `rewindReflect` with `{ mood, feeling, history, forwardContext }` — one call handles both B1 and B2 together.
2. `forwardContext` is a short summary: count of active Forward items + the name of the most-recently-touched project (if any). Example: `"3 active captures · building Forward"`.
3. On response, the reflection sentence fades in where the hardcoded response currently sits.
4. While the call is in flight (up to 5s), show the existing hardcoded response as a placeholder — replace it on arrival if the call succeeds.
5. If the call fails or times out, keep the hardcoded response. No visible error.

**AI voice directive (system prompt sent to Gemini):**
> "You are not an AI assistant. You are a quiet inner voice. Respond in one sentence. Second person, present tense. No productivity language, no advice, no questions. Acknowledge what is true right now."

**Example output:** `"You've been building something big and feeling heavy — that often means you care deeply about it."`

### B2 — Evolved Follow-up Prompts

**Where:** Reflection screen, below the reflection text. One optional follow-up question.

**Behaviour:**
1. `rewindReflect` also returns a `followUp` field based on `history` (last 7 sessions passed in the request).
2. The follow-up is rendered as a single quiet line of italic text below the reflection.
3. It is not a form field — it is a prompt to sit with, not to answer in-app.
4. Adapts to patterns: first occurrence of a mood → open question; recurring (3+ times in 7 days) → more specific/targeted question.
5. If `followUp` is null, nothing is rendered. No placeholder, no empty space.

**Example outputs:**
- First heavy week: `"what's weighing on you most?"`
- Recurring heaviness: `"what would one small release look like?"`

### B3 — Spark Capture in Reflection

**Where:** Reflection screen, below the reflection content. A single optional field.

**Behaviour:**
1. A minimal text input appears with placeholder: `"anything surface while you were here?"`.
2. On submit (enter or a small send icon), the text is written to `rewind_sparks` in localStorage as `{ text, timestamp, source: 'rewind' }`.
3. Forward already reads `rewind_sparks` into its inbox — no Forward changes needed.
4. After sending, the field clears and shows a one-line confirmation: `"captured."` that fades out after 2 seconds.
5. The field is entirely optional. If not used, it takes no space in the visual hierarchy beyond its quiet presence.

---

## 3. Features — Richer Patterns (C1, C3, C4)

### C1 — Mood Timeline (Visual)

**Where:** Pattern screen. Replaces the current flat log list.

**Behaviour:**
1. A horizontally-scrollable 30-day timeline. Each check-in is a dot, coloured by mood (using the mood colour map), with dot size proportional to intensity (1–10 scale already stored in `rewind_sessions`; default mid-size if no intensity value).
2. Dots are positioned on a horizontal axis by date. Days with no check-in show no dot.
3. Tapping a dot expands that session inline (same data as the current log item).
4. The timeline replaces the flat list visually but uses the same `rewind_sessions` data source.

**Mood colour map** (amber family, varying lightness):
- Heavy: `#6b7a8d` (muted blue-grey)
- Tired: `#8d7a6b` (muted warm brown)
- Restless: `#c4956a` (amber, full)
- Okay: `#a89880` (mid amber)
- Calm: `#7a9688` (muted teal)
- Alive: `#e8c170` (bright warm gold)

### C3 — Feeling Word Cloud

**Where:** Pattern screen, above the timeline.

**Behaviour:**
1. Aggregate all text from the `feeling` field across all sessions in `rewind_sessions`.
2. Tokenise into individual words, remove common stop words (a, the, and, I, am, so, etc.).
3. Render surviving words as soft proportionally-sized text — most frequent = largest. No chart, no axes. Just the words.
4. Tapping a word filters the timeline (C1) to sessions where that word appeared in the `feeling` field. A small active-filter indicator shows which word is active. Tap again to clear.
5. Maximum 20 words rendered. Minimum 2 sessions required for a word to appear.

### C4 — Forward Context in Pattern

**Where:** Pattern screen. A secondary line under each session in the expanded inline view (when a dot is tapped in C1).

**Behaviour:**
1. When a session dot or list item is expanded, show a quiet secondary line beneath the feeling text.
2. Content: snapshot of Forward activity at the time of check-in — read from `forward_items` filtered by `updatedAt` within ±12 hours of the check-in timestamp.
3. Format: `"3 active captures · building Forward"` or just `"2 active captures"` if no project name is available.
4. Read-only. No actions. If no Forward data correlates, the line is omitted.

---

## 4. Mood Icon System

### Summary

Six custom SVG icons replace emoji in all Rewind mood selectors and history displays. Thin-stroke, organic/nature-inspired, amber `#c4956a` on dark `#0e0b09`. No fills.

### Icon Set (Final)

| Mood | Icon | Description |
|---|---|---|
| Heavy | Stone sinking | Top arc of stone barely visible above a wavy waterline; ripples spreading outward, ghost arc below. |
| Tired | Wilting stem | Vertical stem, neck curves and droops, small bud at tip, two hanging leaves. |
| Restless | Wind lines | Four sweeping horizontal curves with directional chevron at right. |
| Okay | Horizon | Flat horizontal line with gentle curves above and below — sky and ground. |
| Calm | Ripples | Concentric circles fading outward from a central point. |
| Alive | Sunrise | Horizon line, semicircle arc cresting above, five rays above the horizon, two fading reflection lines below. |

### SVG Specification

- ViewBox: `0 0 60 60`
- Stroke: `#c4956a`
- Stroke-width: `1.5` (display sizes); `1.8` at small sizes (≤32px rendered)
- Stroke-linecap: `round`
- Stroke-linejoin: `round`
- Fill: `none`
- Opacity variations allowed for layered elements (ripples, reflections, ghost arcs) using `stroke-opacity`

### Usage Points

1. **Mood selector** (check-in screen) — 36×36px rendered, icons in a horizontal row with label beneath
2. **Check-in history rows** (pattern screen) — 28×28px rendered, icon left of mood label
3. **Timeline dots** (C1) — replaced by coloured dots, not icons (too small)
4. **Reflection screen header** — 48×48px, selected mood icon shown above reflection text

### Delivery

SVG paths are inlined directly in `rewind/index.html` as a helper function `moodIcon(mood, size)` that returns an SVG string. No external assets.

---

## 5. Implementation Boundaries

**In scope:**
- All six features above (B1, B2, B3, C1, C3, C4)
- Mood icon system across all Rewind usage points
- Firebase Cloud Function `rewindReflect` (new `functions/` directory in repo)

**Out of scope:**
- C2 (streak card) — deferred, not selected
- Any changes to Forward's main app (`index.html`, `js/`, `css/`) beyond what already exists
- Push notifications or scheduled check-in reminders
- Mood icon animation

**Existing behaviour preserved:**
- All existing Rewind screens, transitions, and animations
- `animateIntoRewind` / `resetFromRewind` orb transition
- Hardcoded reflection fallbacks remain as the default, replaced only if AI call succeeds

---

## 6. Open Questions Resolved

| Question | Decision |
|---|---|
| API key approach | Firebase Cloud Function proxy — key server-side, no BYOK required |
| AI voice | Match Rewind's existing tone. System prompt: quiet inner voice, one sentence, no advice |
| Mood icon style | Thin-stroke SVG, organic/nature-inspired, amber on dark, no fills |
| Timeline vs flat list | Timeline replaces flat list (C1); same data, readable shape |
| Word cloud interactivity | Tap word → filter timeline; tap again → clear |

---

*Spec written after full brainstorming session. Ready for implementation planning.*
