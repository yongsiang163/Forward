# Forward + Rewind — Mobile UI Design Spec
**Date:** 2026-04-05
**Scope:** Mobile-first visual and interaction upgrade for both Forward (task/check-in) and Rewind (mood journal/AI reflection)
**Status:** Approved — ready for implementation

---

## 1. Design Direction

**Deepened Warmth** — richer blacks, more luminous amber, stronger glows, coarser grain. The existing warm amber language is kept but intensified. No cool or neutral direction.

Both apps share the same token foundation and colour family. Their identity distinction is expressed through their central orb:
- **Forward = solid sun orb** — opaque, radiating, active energy
- **Rewind = ghost moon orb** — translucent, warm-tinted, meditative

---

## 2. Design Tokens (both apps)

All values updated in `css/main.css` (Forward) and inline `<style>` block in `rewind/index.html`.

### Colour
| Token | New Value | Old Value | Notes |
|---|---|---|---|
| `--bg` | `#080603` | `#0e0b09` | Deeper black |
| `--surface` | `#141008` | `#1a1410` | Card base |
| `--surface2` | `#1e160c` | `#221c16` | Raised element |
| `--surface3` | `#281e10` | `#2a2018` | Active / selected |
| `--surface4` | `#342616` | *(new)* | Highlight layer |
| `--warm` | `#d4a472` | `#c4956a` | Brighter amber |
| `--warm-soft` | `#a06840` | `#8b6540` | Secondary accent |
| `--warm-glow` | `rgba(212,164,114,0.18)` | `rgba(196,149,106,0.12)` | +50% intensity |
| `--warm-glow-strong` | `rgba(212,164,114,0.28)` | `rgba(196,149,106,0.22)` | Selected states |
| `--border` | `rgba(212,164,114,0.22)` | `rgba(196,149,106,0.15)` | More visible |
| `--border-soft` | `rgba(255,255,255,0.07)` | `rgba(255,255,255,0.05)` | Card dividers |

### Easing
| Token | Value | Use |
|---|---|---|
| `--ease-spring` | `cubic-bezier(0.34,1.56,0.64,1)` | Node snap, pill bounce, tap release |
| `--ease-breathe` | `cubic-bezier(0.4,0,0.2,1)` | Orb morph, screen fade |
| `--ease-out` | `cubic-bezier(0,0,0.2,1)` | Sheet slide-in |
| `--ease-reveal` | `cubic-bezier(0.25,0.46,0.45,0.94)` | Calendar detail expand |

### Typography
All font sizes use `clamp()` for fluid scaling:
- Display: Cormorant Garamond 300, `clamp(40px, 9vw, 56px)`, letter-spacing 6px
- Hero question: Cormorant Garamond 300i, `clamp(22px, 5vw, 30px)`
- Body: DM Sans 300, `clamp(13px, 3vw, 15px)`, letter-spacing 0.3px
- Label/caps: DM Sans 400, 10–11px, letter-spacing 2px

### Grain texture
- `baseFrequency`: 0.75 (was 0.9) — coarser
- `opacity`: 0.055 (was 0.03) — more visible
- `background-size`: 160px

---

## 3. Forward App

### 3.1 Sun Orb — Home Hero

The central orb represents daily energy. Its state maps to the user's arriving mood (set during check-in).

**Visual spec:**
```css
width: 88px; height: 88px; border-radius: 50%;
background: radial-gradient(circle at 32% 28%,
  rgba(240,190,130,0.98),
  rgba(200,130,50,0.8) 45%,
  rgba(120,60,10,0.6) 75%
);
box-shadow:
  0 0 32px rgba(212,164,114,0.55),
  0 0 80px rgba(212,164,114,0.18),
  0 0 120px rgba(212,164,114,0.06),
  inset 0 1px 2px rgba(255,220,170,0.6);
```
3 rings at `inset: -12px / -24px / -38px`, opacity `0.22 / 0.08 / 0.03`.

**Idle animation:**
```css
@keyframes orbBreathe {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.06); }
}
animation: orbBreathe 3.5s ease-in-out infinite;
```

**Sun state system — rise / descent:**

The home orb remains 88px as the hero element. During the check-in flow, the orb display transitions to a **state indicator** (smaller, positioned on a sky horizon) whose size and glow encode the user's arriving energy. After check-in, the home orb reflects the committed state via glow intensity and a subtle `translateY` shift.

| State | Mood | Indicator size | Glow opacity | Vertical position | Metaphor |
|---|---|---|---|---|---|
| Rising | Alive | 54px, bright gold | 0.65 | High (margin-top: 0) | Morning sun, full energy |
| Steady | Okay | 46px, balanced | 0.45 | Mid (margin-top: 8px) | Midday, grounded |
| Setting | Tired | 42px, warm orange | 0.30 | Lower (margin-top: 14px) | Afternoon, running low |
| Below horizon | Heavy | 34px, dim amber | 0.12 | Near horizon (margin-top: 22px) | Barely above the line |

Horizon glow (radial ellipse at bottom of screen) also dims/warms with each state.

### 3.2 Floating Pill Navigation

Replaces invisible swipe gestures. Mode toggle (Work / Plan) stays on the top bar.

**Visual spec:**
```css
position: fixed;
bottom: calc(14px + env(safe-area-inset-bottom));
left: 50%; transform: translateX(-50%);
background: rgba(20,16,8,0.88);
backdrop-filter: blur(20px);
border: 1px solid rgba(212,164,114,0.2);
border-radius: 40px;
padding: 5px 6px;
box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(212,164,114,0.06);
```

- 4 buttons (32px circles) inside pill
- Active button: amber dot + glow (`rgba(212,164,114,0.4)`, box-shadow)
- Home button: 22px mini sun orb icon
- Entrance: slides up from below on load, 400ms `--ease-out`
- Button tap: `scale(0.92)`, spring release

### 3.3 Inbox Items

- Row min-height: 44px (touch target rule)
- Lead dot: 6px, `rgba(212,164,114,0.6)` + glow
- Category chip: 8px text, `rgba(212,164,114,0.08)` fill, amber border
- Divider: `rgba(255,255,255,0.04)`

**Swipe interaction:**
- Threshold: 80px to reveal action
- Actions: defer (swipe left) / complete (swipe right)
- Spring-back on cancel: `--ease-spring`
- Haptic: 8ms on threshold cross

### 3.4 Capture Sheet

- Handle: 36px wide, `rgba(212,164,114,0.2)` + glow
- Sheet bg: `#141008`, border-top `rgba(212,164,114,0.16)`
- Input: Cormorant Garamond italic, amber border tint
- Border-radius: 20px top corners

### 3.5 Task Cards

Three action button styles:
- Primary (complete): `rgba(212,164,114,0.12)` fill, amber border
- Secondary (plan): `rgba(126,184,164,0.1)` fill, teal border
- Ghost (defer): transparent, `rgba(255,255,255,0.07)` border

### 3.6 CTA Button

Replaces plain text chamfered box.

```html
<button class="cta-btn">
  <span class="cta-icon"><!-- CSS chevron --></span>
  <span class="cta-label">Begin</span>
</button>
```

```css
.cta-btn {
  display: flex; align-items: center; gap: 9px;
  padding: 10px 22px 10px 12px;
  border-radius: 40px; min-height: 44px;
  border: 1px solid rgba(212,164,114,0.28);
  background: rgba(212,164,114,0.06);
  box-shadow: 0 0 18px rgba(212,164,114,0.1);
}
.cta-icon {
  width: 26px; height: 26px; border-radius: 50%;
  background: rgba(212,164,114,0.16);
  /* chevron: ::after with border-right + border-top, 8px, rotate 45deg */
}
.cta-label { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; }
```

Rewind variant: `rgba(220,200,155,0.22)` border, softer tint, label "Reflect".

---

## 4. Rewind App

### 4.1 Ghost Moon Orb — Welcome

Visually distinct from Forward's solid sun. Translucent, warm-tinted, ethereal.

```css
width: 80px; height: 80px; border-radius: 50%;
background: radial-gradient(circle at 38% 34%,
  rgba(240,220,180,0.32),
  rgba(215,190,145,0.18) 45%,
  rgba(190,165,120,0.08) 70%,
  transparent 88%
);
border: 1px solid rgba(225,200,155,0.28);
box-shadow:
  0 0 28px rgba(215,190,145,0.18),
  0 0 55px rgba(200,175,130,0.08),
  inset 0 0 22px rgba(235,210,165,0.1),
  inset 0 1px 2px rgba(245,230,195,0.25);
```

2 rings at `-4px` / `-12px`, halo at `-20px`. Subtle inner glow at centre.

**Idle animation:**
```css
@keyframes moonBreathe {
  0%, 100% { transform: scale(1); }
  50%       { transform: scale(1.05); }
}
animation: moonBreathe 4.5s ease-in-out infinite;
```

4.5s (slower than Forward's 3.5s) — more meditative.

### 4.2 Mood Wheel — Drag-to-Spin

Replaces the 2-column grid. 6 moods in a radial wheel, drag gesture to select.

**6 moods and their SVG icons (from `rewind/index.html`):**
| Mood | SVG motif | Colour |
|---|---|---|
| alive | Horizon sun with rays | `rgba(212,164,114,0.88)` |
| calm | Concentric rings | `rgba(126,184,164,0.75)` |
| okay | Balanced horizontal lines | `rgba(212,164,114,0.52)` |
| restless | Flowing lines with arrow | `rgba(140,160,196,0.65)` |
| tired | Drooping stem | `rgba(160,140,196,0.55)` |
| heavy | Layered waves | `rgba(220,130,100,0.55)` |

All SVGs use `stroke="currentColor"` — dim (`~45% opacity`) at rest, full brightness on active.

**Node spec:**
```css
.wh-node {
  width: 48px; height: 48px; border-radius: 50%;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(212,164,114,0.1);
  color: rgba(180,145,100,0.45); /* default SVG colour */
}
.wh-node.active {
  border-color: var(--mood-col);
  box-shadow: 0 0 16px var(--mood-col);
  transform: translate(-50%,-50%) scale(1.18);
  color: rgba(232,210,170,0.92);
}
```

**Drag interaction:**
1. Touch anywhere within 130px of centre activates the wheel
2. Continuously compute angle from centre → nearest node within ±30° highlights
3. On crossing a threshold: haptic 8ms + node `scale(1.18)` + spoke brightens + centre orb animates
4. Release: last highlighted node commits, spring bounce `1.08 → 1.0`
5. Cancel: drag outside 140px radius, no commit, all reset
6. Easing: nodes use `--ease-spring`; orb morph uses `--ease-breathe`

**Centre orb — animated SVG on active:**

When a mood is active, the centre (52px ghost moon) hides its default dot and shows that mood's animated SVG:

| Mood | Animation | Duration |
|---|---|---|
| alive | `scale(1 → 1.18)` pulse, rays expand | 1.6s |
| calm | `scale(0.85 → 1.15)` ripple, fade out | 2.0s |
| okay | `scaleX` oscillation, gentle wave | 2.2s |
| restless | `translateX ±2px` jitter | 0.85s (fastest) |
| tired | `rotate(-5deg) + translateY(2px)` droop | 3.0s (slowest) |
| heavy | `scaleY(0.9) + translateY(2px)` press | 2.5s |

### 4.3 Calendar Heat Map — History

Replaces the horizontal overflow dot strip (critical mobile bug: 30 × 18px = ~700px overflows 375px).

**Layout:**
```css
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
}
.cc { border-radius: 3px; aspect-ratio: 1; }
```

**5 intensity levels:**
| Level | Background | Represents |
|---|---|---|
| 0 (empty) | `rgba(255,255,255,0.04)` | No entry |
| 1 | `rgba(220,130,100,0.22)` | Heavy |
| 2 | `rgba(212,164,114,0.28)` | Okay |
| 3 | `rgba(212,164,114,0.45)` | Good |
| 4 | `rgba(212,164,114,0.65)` | Alive |
| 5 | `rgba(126,184,164,0.45)` | Calm |

Today cell: `box-shadow: 0 0 0 1px rgba(212,164,114,0.6)`

Tap any cell → session detail slides in below (250ms, `--ease-reveal`).

### 4.4 AI Reflection Card

```css
.refl-card {
  background: #141008;
  border: 1px solid rgba(212,164,114,0.14);
  border-radius: 14px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(212,164,114,0.04);
}
/* Corner glow */
.refl-card::before {
  content: ''; position: absolute;
  width: 80px; height: 80px; border-radius: 50%;
  background: radial-gradient(circle, rgba(212,164,114,0.1), transparent 70%);
  top: -20px; right: -20px;
}
```

Spark input: Cormorant Garamond italic, `rgba(212,164,114,0.12)` bg, amber border.

Buttons: Done = `rgba(212,164,114,0.12)` fill; New session = ghost. Both min-height 38px.

---

## 5. Shared Motion Rules

### Screen transitions
```css
@keyframes screenEnter {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
animation: screenEnter 500ms var(--ease-breathe) forwards;
/* Exit: opacity 0, 300ms */
```

No horizontal slide — vertical drift only, preserves spatial calm.

### Tap feedback (all interactive elements)
```css
:active { transform: scale(0.96); transition: transform 150ms; }
/* Release: spring back via --ease-spring, 300ms */
```

### Touch targets
**All interactive elements: min-height 44px, no exceptions.**

### Haptic
8ms impulse on:
- Mood wheel node threshold cross
- Swipe action threshold
- Floating pill button tap

---

## 6. Bug Fixes (UX)

These are pre-existing issues resolved by the redesign:

| Issue | File | Fix |
|---|---|---|
| Timeline overflow (~700px on 375px) | `rewind/index.html` | Calendar grid (7-col, no overflow) |
| Mood grid cramped at 375px | `rewind/index.html` | Radial wheel, no grid |
| Touch targets < 44px everywhere | both | Enforced min-height 44px |
| Hardcoded font sizes (no fluid type) | both | `clamp()` on all display sizes |
| Zero media queries | both | Mobile-first, no breakpoints needed |
| Invisible nav (swipe-only) | `css/layout.css` | Floating pill with visible buttons |

---

## 7. Out of Scope

- Tablet / desktop breakpoints (mobile-first only, this cycle)
- Dark / light mode toggle
- New AI reflection features
- Backend / data layer changes
- Onboarding flows

---

## 8. Implementation Notes

- `rewind/index.html` is a ~2100-line self-contained file (inline CSS + JS). The mood wheel and calendar are complete rewrites of their respective sections.
- Forward's CSS is split: `css/main.css` (tokens), `css/layout.css` (layout), `js/firebase-config.js` (data).
- The drag wheel interaction requires a single `touchmove` / `mousemove` handler tracking angle from centre — no existing library needed.
- SVG icons in the mood wheel already exist in `rewind/index.html`; they need `stroke="currentColor"` substituted for the hardcoded `stroke="#c4956a"`.
- Moon orb animations use pure CSS keyframes — no JS animation library needed.
