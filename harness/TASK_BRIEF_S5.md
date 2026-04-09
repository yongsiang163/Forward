# TASK BRIEF — Forward Build Session 5
**Session:** FWD-20260402-0300 (planned)
**Date:** TBD — after Session 4 passes evaluation

---

## Product Context
- **Product:** Forward — ADHD-first PWA, companion app to Rewind
- **Stack:** Pure HTML + CSS + Canvas 2D / localStorage / Gemini BYOK (ai.js)
- **Generator Skill:** senior-app-developer
- **Config:** `C:\Users\User\AI Project\FORWARD\FOUNDATION\FWD.HARNESS.config.md`

---

## Phases Completed by End of Session 4
- ✅ Phases 1–8 (core product, mood bridge, AI companion, living projects, data aging)
- ✅ Phase 9: PWA audit (icons, manifest, offline)
- ✅ Phase 10: Rewind transition animation
- ✅ New A: Full item editing
- ✅ New B: Inbox swipe triage
- ✅ New C: AI Daily Brief

---

## Session 5 Scope: Intelligence Depth + Notification Intelligence + Rewind Patterns

**Three deliverables — Group B from the feature selection:**
- **New D** — Weekly Review: Interactive (upgrade read-only panels to actionable)
- **New E** — Smarter Notifications (mood-aware timing, uncategorised item resurfacing)
- **New F** — Deeper Rewind Bridge (7-day energy patterns, peak-time surfacing)

These form a coherent unit: the app learns your patterns and nudges you at the right moments, not just when it's Sunday.

---

## Task

**Title:** Intelligence Depth — Patterns, Nudges, and the Deeper Rewind Bridge

**Scope — 3 deliverables:**

---

### Deliverable 1: Weekly Review — Interactive
**Files:** `js/actions.js` (openWeeklyReview), `js/render.js`, `index.html`

**Current state:** Weekly review shows three read-only panels:
- What Moved (completed items this week)
- What's Stale (projects untouched 7+ days)
- What's Next (5 fresh/alive items)
Plus an AI insight block (2 sentences if key set).

**Upgrade — make each panel actionable:**

**What Moved panel:**
- Each completed item gets a small "undo" link (restore to alive) inline.
- No change to current undo-from-done-log flow — just expose it in the review context.

**What's Stale panel:**
- Each stale project row gets two inline actions:
  - "archive project" — sets project status to archived, saves, re-renders panel.
  - "touch it" — sets project `touchedAt = new Date().toISOString()`, saves, removes from stale list. This resets its staleness clock.

**What's Next panel:**
- Each item gets a small "→ start" button that closes the weekly review and navigates to Work mode with that item pre-selected as the candidate (set `S.forcedWorkItem = item.id` before calling `showScreen('work')`).

**AI Insight upgrade:**
- Instead of just showing the 2-sentence summary, add a single follow-up input:
  ```
  [AI insight text]

  → add a thought   [small text input, inline]
  ```
- When the user types and presses Enter (or taps a "→" send button), send their note + the AI's insight back to Gemini as a conversational follow-up. Render the reply below.
- This makes the weekly review feel like a brief check-in conversation, not a report.
- Guard: only show if key is set.

---

### Deliverable 2: Smarter Notifications
**Files:** `js/app.js` (notification logic), `sw.js`

**Current state:** Two notification types:
1. Sunday 9am–8pm → weekly review nudge.
2. Projects untouched 7+ days → stale project nudge.
One per category per day.

**Upgrade 1 — Mood-aware suppression:**
When the Rewind mood state is `heavy`, `low`, or `overwhelmed`, suppress all nudge notifications for the day. The user is already struggling — don't add to the pile.

Implementation: before scheduling or showing any notification, read `rewind_sessions` from localStorage, get the most recent session's `moodState`. If it's in `['heavy', 'low', 'overwhelmed']`, skip all notifications that day.

**Upgrade 2 — Uncategorised item resurfacing:**
Add a new notification type: "you have [N] uncategorised items from this week — when you have a moment."

Trigger conditions:
- User has 3+ items with `category === null` or `category === 'unsorted'` AND `createdAt` within the last 7 days.
- Notification has not been sent today (track with `localStorage.getItem('forward_notif_triage_date')`).
- Mood is not heavy/low/overwhelmed.
- Time is between 10am–7pm local time.

Notification copy: "a few things are waiting to be sorted — no rush, when the moment's right."
Action: tapping opens Forward to All Captures filtered to Unsorted.

**Upgrade 3 — Smarter Sunday review timing:**
Instead of a fixed 9am trigger on Sunday, check the most recent Rewind session's time and trigger the review nudge 2–3 hours after a positive check-in (`alive` or `calm`). This catches the user when they're in a reflective state, not just when it's morning.

Implementation: store the last positive check-in timestamp in `forward_last_positive_checkin`. In the Sunday notification check, if this timestamp is today and current time is 2–3 hours after it, fire the review nudge.

---

### Deliverable 3: Deeper Rewind Bridge
**Files:** `js/app.js` (loadRewind / data loading), `js/render.js` (home screen), `js/data.js`

**Current state:** Forward reads `rewind_sessions` localStorage key to get the most recent mood state. It uses: `moodState`, `energyLevel`, `focusLevel`, `timestamp`.

**Upgrade — 7-day energy pattern analysis:**

New function `analyseRewindPatterns()` called during `init()`:

```javascript
function analyseRewindPatterns() {
  var raw = localStorage.getItem('rewind_sessions');
  if (!raw) return null;
  var sessions;
  try { sessions = JSON.parse(raw); } catch(e) { return null; }
  if (!sessions || sessions.length < 3) return null;

  // Sessions from the last 14 days only
  var cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  var recent = sessions.filter(function(s) {
    return s.timestamp && new Date(s.timestamp).getTime() > cutoff;
  });
  if (recent.length < 3) return null;

  // Find day-of-week + hour combinations with highest average energy
  var buckets = {}; // key: "DayHour" e.g. "2-9" (Tuesday 9am)
  recent.forEach(function(s) {
    if (!s.energyLevel) return;
    var d = new Date(s.timestamp);
    var key = d.getDay() + '-' + d.getHours();
    if (!buckets[key]) buckets[key] = { total: 0, count: 0 };
    buckets[key].total += s.energyLevel;
    buckets[key].count += 1;
  });

  var bestKey = null;
  var bestAvg = 0;
  Object.keys(buckets).forEach(function(k) {
    var avg = buckets[k].total / buckets[k].count;
    if (avg > bestAvg && buckets[k].count >= 2) {
      bestAvg = avg;
      bestKey = k;
    }
  });

  if (!bestKey) return null;
  var parts = bestKey.split('-');
  var dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  return {
    peakDay: dayNames[parseInt(parts[0])],
    peakHour: parseInt(parts[1]),
    avgEnergy: bestAvg
  };
}
```

Store result in `S.rewindPattern` during init.

**Surface in Home screen — "peak time" nudge:**

In `renderHome()`, if `S.rewindPattern` exists and current day + hour is within 1 hour of the peak pattern, add a quiet line below the mood greeting:

```
you tend to be most alive around now
```

This line uses muted text (`rgba(232,221,212,0.4)`), DM Sans 300, tiny font size (0.75rem). It appears only when the pattern matches — silence is the default.

**Surface in Work mode — AI context:**

In `renderWork()` (when building the `runHelpMeStart` prompt context or the daily brief), include the peak pattern as context:
`"note: user is typically most energised on [peakDay] around [peakHour]am — it is currently [current day/hour]."`

This allows the AI companion to say "you usually have good focus around now" when it's relevant, without it being hardcoded.

---

## Acceptance Criteria

- [ ] Weekly review stale projects have "archive project" and "touch it" inline actions
- [ ] Weekly review "what's next" items have "→ start" that pre-selects the item in Work mode
- [ ] AI insight in weekly review has a follow-up input that sends to Gemini
- [ ] Notifications are suppressed when most recent mood is heavy/low/overwhelmed
- [ ] Uncategorised item notification fires when 3+ unsorted items within 7 days (mood allowing)
- [ ] Sunday review nudge checks for post-positive-checkin timing, not just 9am
- [ ] `analyseRewindPatterns()` returns peak day/hour when 3+ sessions exist across 14 days
- [ ] "you tend to be most alive around now" appears on home screen when current time matches peak
- [ ] Peak pattern is included in AI context for daily brief and help-me-start
- [ ] All existing features still function
- [ ] No optional chaining (`?.`) or nullish coalescing (`??`) in new code

---

## Stack Notes
Same as all sessions — see `FWD.HARNESS.config.md`.

Key reminder for Session 5:
- `rewind_sessions` schema: array of `{ timestamp, moodState, energyLevel, focusLevel, ... }`.
  Read-only from Forward's perspective. Never write to this key.
- `S.rewindPattern` is a new field on the global state object S — initialise it as `null` in `app.js`
  where S is defined.

---

## Session Goal

The user opens Forward on a Tuesday morning at 9am. A quiet line says "you tend to be most alive around now." They run through their weekly review, archive two stale projects in two taps, and start on the one thing that actually matters. Later, their phone buzzes — not because it's Sunday, but because they just checked in with Rewind feeling calm, and it's been a week.
