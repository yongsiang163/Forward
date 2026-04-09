# Build Session 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement PWA hardening (phases 9 & 10), full item editing, inbox swipe triage, and AI daily brief for the Forward ADHD productivity app.

**Architecture:** All features added to the existing vanilla JS/HTML/CSS codebase. No new persistent files except icon assets. Changes distributed across `js/actions.js`, `js/render.js`, `css/layout.css`, `index.html`, `manifest.json`, and `sw.js`. A temporary icon-generation script creates the missing PNG assets and is then deleted.

**Tech Stack:** Vanilla JS (ES5/ES6, no optional chaining `?.` or nullish coalescing `??`), HTML5 Canvas, CSS3 transitions, Node.js (icon generation only, no npm required), Firebase Hosting/PWA

---

## File Map

| File | What changes |
|------|-------------|
| `scripts/generate-icons.js` | **Create** (temp) — Node.js script to produce icon PNGs |
| `icon-192.png` | **Create** — 192×192 PWA icon |
| `icon-512.png` | **Create** — 512×512 PWA icon |
| `manifest.json` | **Modify** — add `id`, `orientation`, `purpose` on icons |
| `sw.js` | **Modify** — add offline fallback for navigate requests |
| `index.html` | **Modify** — add `#ia-edit-panel` HTML inside item action sheet |
| `js/actions.js` | **Modify** — `toggleRewindMode` animation; `enterItemEditMode`, `saveItemEdit`, `cancelItemEdit`; edit button in `openItemAction` |
| `js/render.js` | **Modify** — swipe triage in `renderInbox`; `renderDailyBrief` called from `renderWork` |
| `css/layout.css` | **Modify** — edit panel styles, swipe triage visual, daily brief text |

---

## Task 1: Generate PWA Icon Assets

**Files:**
- Create: `scripts/generate-icons.js`
- Create: `icon-192.png` (output)
- Create: `icon-512.png` (output)

The manifest references `icon-192.png` and `icon-512.png` but neither exists. This causes PWA install to fail silently on iOS and Android. We generate them with a Node.js script using only built-in modules (no npm).

- [ ] **Step 1.1: Create icon generation script**

Create `scripts/generate-icons.js`:

```javascript
// scripts/generate-icons.js
// Generates icon-192.png and icon-512.png using only Node built-ins.
// Design: #0e0b09 background, amber circle (#c4956a) centred.
// Run: node scripts/generate-icons.js  (from project root)

var zlib = require('zlib');
var fs   = require('fs');
var path = require('path');

// ── CRC32 ──────────────────────────────────────────────────────────
function makeCrcTable() {
  var t = new Uint32Array(256);
  for (var i = 0; i < 256; i++) {
    var c = i;
    for (var k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    t[i] = c;
  }
  return t;
}
var CRC_TABLE = makeCrcTable();
function crc32(buf) {
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG chunk builder ──────────────────────────────────────────────
function buildChunk(type, data) {
  var len  = Buffer.alloc(4);  len.writeUInt32BE(data.length, 0);
  var typeB = Buffer.from(type, 'ascii');
  var crcIn = Buffer.concat([typeB, data]);
  var crcB  = Buffer.alloc(4);  crcB.writeUInt32BE(crc32(crcIn), 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

// ── Draw icon at given size ────────────────────────────────────────
function createIcon(size, outPath) {
  var w = size, h = size;
  var cx = w / 2, cy = h / 2;
  var radius = Math.round(w * 0.208); // ~40px at 192, ~107px at 512

  // Build raw scanline data (RGBA, filter byte 0 per row)
  var rowBytes = 1 + w * 4; // 1 filter byte + RGBA per pixel
  var raw = Buffer.alloc(h * rowBytes);
  for (var y = 0; y < h; y++) {
    var rowOff = y * rowBytes;
    raw[rowOff] = 0; // filter type: None
    for (var x = 0; x < w; x++) {
      var dx = x - cx, dy = y - cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      var px = rowOff + 1 + x * 4;
      if (dist <= radius) {
        raw[px]   = 196; // R #c4956a
        raw[px+1] = 149; // G
        raw[px+2] = 106; // B
        raw[px+3] = 255; // A
      } else {
        raw[px]   = 14;  // R #0e0b09
        raw[px+1] = 11;  // G
        raw[px+2] = 9;   // B
        raw[px+3] = 255; // A
      }
    }
  }

  var compressed = zlib.deflateSync(raw, { level: 9 });

  // IHDR
  var ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8]  = 8; // bit depth
  ihdrData[9]  = 6; // colour type: RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  var sig  = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  var ihdr = buildChunk('IHDR', ihdrData);
  var idat = buildChunk('IDAT', compressed);
  var iend = buildChunk('IEND', Buffer.alloc(0));

  fs.writeFileSync(outPath, Buffer.concat([sig, ihdr, idat, iend]));
  console.log('Created ' + outPath + ' (' + size + 'x' + size + ')');
}

var root = path.join(__dirname, '..');
createIcon(192, path.join(root, 'icon-192.png'));
createIcon(512, path.join(root, 'icon-512.png'));
console.log('Done.');
```

- [ ] **Step 1.2: Run the script**

```bash
cd "/c/Users/User/AI Project/FORWARD/VERSION/Forward"
node scripts/generate-icons.js
```

Expected output:
```
Created /…/icon-192.png (192x192)
Created /…/icon-512.png (512x512)
Done.
```

- [ ] **Step 1.3: Verify icons exist and are non-zero**

```bash
ls -lh icon-192.png icon-512.png
```

Expected: both files present, sizes roughly 3–6 KB (192px) and 40–80 KB (512px).

- [ ] **Step 1.4: Commit icons and script**

```bash
git add icon-192.png icon-512.png scripts/generate-icons.js
git commit -m "feat(pwa): generate amber-on-dark icon assets (192 + 512)"
```

---

## Task 2: Manifest & Service Worker Hardening (Phase 9)

**Files:**
- Modify: `manifest.json`
- Modify: `sw.js`

- [ ] **Step 2.1: Update manifest.json**

Replace the full contents of `manifest.json` with:

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
        {
            "src": "icon-192.png",
            "sizes": "192x192",
            "type": "image/png",
            "purpose": "any maskable"
        },
        {
            "src": "icon-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any maskable"
        }
    ]
}
```

- [ ] **Step 2.2: Add offline fallback to sw.js navigate branch**

In `sw.js`, find the navigate handler (the first branch in the fetch event listener):

```javascript
    // Network First strategy for HTML to ensure latest app wrapper
    if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }
```

Replace it with (adds `|| caches.match('./404.html')` as final fallback):

```javascript
    // Network First strategy for HTML to ensure latest app wrapper
    if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseClone));
                    return response;
                })
                .catch(() => caches.match(event.request).then(function(cached) {
                    return cached || caches.match('./404.html');
                }))
        );
        return;
    }
```

- [ ] **Step 2.3: Bump the service worker cache version**

In `sw.js`, change:

```javascript
const CACHE_NAME = 'forward-cache-v22';
```

to:

```javascript
const CACHE_NAME = 'forward-cache-v23';
```

This forces the new SW to activate and re-cache with the correct icon files.

- [ ] **Step 2.4: Verify manifest is valid JSON**

```bash
node -e "require('./manifest.json'); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 2.5: Commit PWA hardening**

```bash
git add manifest.json sw.js
git commit -m "feat(pwa): add id/orientation/purpose to manifest, offline fallback in SW"
```

---

## Task 3: Rewind Transition Animation (Phase 10)

**Files:**
- Modify: `js/actions.js` (lines around `toggleRewindMode`)

When the user taps "check in with yourself →", `toggleRewindMode()` is called. Currently it instantly shows the Rewind iframe container with no transition. We add an ~800ms CSS opacity animation on the home orb and home content before revealing Rewind.

The orb element is `#hero-orb-wrap`. The home screen content wrapper containing the orb + text is the `#home-screen` element (or its inner content div). We fade the orb and screen content out, then show the Rewind container.

- [ ] **Step 3.1: Add `animateIntoRewind` helper before `toggleRewindMode`**

In `js/actions.js`, immediately before the `function toggleRewindMode()` definition, insert:

```javascript
function animateIntoRewind(callback) {
  var orbWrap   = document.getElementById('hero-orb-wrap');
  var homeScreen = document.getElementById('home-screen');

  // Transition: orb descends + fades; home screen fades out
  if (orbWrap) {
    orbWrap.style.transition  = 'opacity 0.8s ease, transform 0.8s ease';
    orbWrap.style.opacity     = '0';
    orbWrap.style.transform   = 'translateY(60px)';
  }
  if (homeScreen) {
    homeScreen.style.transition = 'opacity 0.7s ease';
    homeScreen.style.opacity    = '0';
  }

  setTimeout(function() { callback(); }, 820);
}

function resetFromRewind() {
  var orbWrap    = document.getElementById('hero-orb-wrap');
  var homeScreen = document.getElementById('home-screen');

  if (orbWrap) {
    orbWrap.style.transition = '';
    orbWrap.style.opacity    = '';
    orbWrap.style.transform  = '';
  }
  if (homeScreen) {
    homeScreen.style.transition = '';
    homeScreen.style.opacity    = '';
  }
}
```

- [ ] **Step 3.2: Wire animation into `toggleRewindMode`**

Find the current `toggleRewindMode` function:

```javascript
function toggleRewindMode() {
  const container = document.getElementById('rewind-mode-container');
  const forwardNav = document.getElementById('forward-bottom-nav');
  if (!container) return;

  const isShown = container.style.display !== 'none';
  if (isShown) {
    if (typeof showScreen === 'function') {
      showScreen(S.screen || 'home');
    }
    if (forwardNav) forwardNav.style.display = 'flex';
    container.style.display = 'none';
  } else {
    // Hide all Forward screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    // Un-highlight nav buttons except the rewind one
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    // Hide Forward nav entirely
    if (forwardNav) forwardNav.style.display = 'none';

    // Reset Rewind iframe to welcome screen when entering
    const iframe = document.getElementById('rewind-iframe');
    if (iframe && iframe.contentWindow && iframe.contentWindow.navigate) {
      iframe.contentWindow.navigate('welcome');
    }

    container.style.display = 'flex';
  }
}
```

Replace it with:

```javascript
function toggleRewindMode() {
  var container  = document.getElementById('rewind-mode-container');
  var forwardNav = document.getElementById('forward-bottom-nav');
  if (!container) return;

  var isShown = container.style.display !== 'none';
  if (isShown) {
    // Closing Rewind → restore Forward UI
    resetFromRewind();
    if (typeof showScreen === 'function') {
      showScreen(S.screen || 'home');
    }
    if (forwardNav) forwardNav.style.display = 'flex';
    container.style.display = 'none';
  } else {
    // Opening Rewind → animate out then show
    animateIntoRewind(function() {
      // Hide all Forward screens
      document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
      document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });

      if (forwardNav) forwardNav.style.display = 'none';

      // Reset Rewind iframe to welcome screen when entering
      var iframe = document.getElementById('rewind-iframe');
      if (iframe && iframe.contentWindow && iframe.contentWindow.navigate) {
        iframe.contentWindow.navigate('welcome');
      }

      container.style.display = 'flex';
    });
  }
}
```

- [ ] **Step 3.3: Verify in browser**

Open the app preview at `http://localhost:3456`. Tap "CHECK IN WITH YOURSELF →" on the home screen. Confirm:
- The orb fades out and slides downward over ~800ms
- The home screen content fades out
- The Rewind container appears after the animation completes
- Tapping back from Rewind shows the home screen at full opacity with orb restored

- [ ] **Step 3.4: Commit Rewind transition**

```bash
git add js/actions.js
git commit -m "feat(rewind): orb descent + fade animation on Forward→Rewind transition"
```

---

## Task 4: Full Item Editing — HTML & CSS

**Files:**
- Modify: `index.html` (inside `#item-action-sheet`)
- Modify: `css/layout.css`

- [ ] **Step 4.1: Add edit panel HTML to item action sheet**

In `index.html`, find the item action sheet modal div — just before the closing `</div>` of `.item-action-modal`:

```html
      <div class="item-action-divider"></div>
      <button class="item-action-main-btn archive" onclick="iaArchive()">Archive</button>
      <button class="item-action-main-btn cancel" onclick="closeItemAction()">Cancel</button>
    </div>
```

Insert an "edit" button and edit panel **before** the Archive and Cancel buttons (after the last divider):

```html
      <div class="item-action-divider"></div>
      <button class="item-action-main-btn ia-edit-trigger" onclick="enterItemEditMode()"
        style="border-color:rgba(196,149,106,0.2); color:rgba(232,221,212,0.5); margin-bottom:12px;">edit capture</button>

      <!-- Edit panel — hidden until enterItemEditMode() is called -->
      <div id="ia-edit-panel" style="display:none; margin-bottom:12px;">
        <textarea id="ia-edit-content" class="ia-edit-textarea"
          placeholder="what did you capture?"></textarea>
        <div class="ia-edit-actions">
          <button class="item-action-main-btn ia-edit-save" onclick="saveItemEdit()">save</button>
          <button class="item-action-main-btn ia-edit-cancel" onclick="cancelItemEdit()"
            style="background:transparent; border-color:transparent; color:rgba(232,221,212,0.4);">cancel</button>
        </div>
      </div>

      <div class="item-action-divider"></div>
      <button class="item-action-main-btn archive" onclick="iaArchive()">Archive</button>
      <button class="item-action-main-btn cancel" onclick="closeItemAction()">Cancel</button>
    </div>
```

- [ ] **Step 4.2: Add edit panel CSS to css/layout.css**

Append to `css/layout.css`:

```css
/* ── Item Edit Panel ─────────────────────────────────────── */
.ia-edit-textarea {
  width: 100%;
  min-height: 110px;
  background: rgba(30, 25, 20, 0.6);
  border: 1px solid rgba(196, 149, 106, 0.25);
  border-radius: 10px;
  color: #e8ddd4;
  font-family: var(--ui-font, 'DM Sans', sans-serif);
  font-size: 0.95rem;
  font-weight: 300;
  padding: 12px 14px;
  resize: none;
  box-sizing: border-box;
  line-height: 1.5;
  outline: none;
  display: block;
  margin-bottom: 10px;
}
.ia-edit-textarea::placeholder {
  color: rgba(138, 131, 124, 0.6);
}
.ia-edit-actions {
  display: flex;
  gap: 8px;
}
.ia-edit-actions .ia-edit-save {
  flex: 1;
  background: rgba(196, 149, 106, 0.12);
  border-color: rgba(196, 149, 106, 0.35);
  color: #c4956a;
}
```

- [ ] **Step 4.3: Commit HTML/CSS**

```bash
git add index.html css/layout.css
git commit -m "feat(edit): add item edit panel HTML and CSS to action sheet"
```

---

## Task 5: Full Item Editing — JavaScript

**Files:**
- Modify: `js/actions.js`

- [ ] **Step 5.1: Add `enterItemEditMode`, `saveItemEdit`, `cancelItemEdit` functions**

In `js/actions.js`, add these three functions after the `iaSummarise` function (search for `async function iaSummarise`):

```javascript
function enterItemEditMode() {
  if (!activeItemId) return;
  var item = items.find(function(i) { return i.id === activeItemId; });
  if (!item) return;

  var editPanel   = document.getElementById('ia-edit-panel');
  var editContent = document.getElementById('ia-edit-content');
  var editTrigger = document.querySelector('.ia-edit-trigger');
  if (!editPanel || !editContent) return;

  // Populate with raw content if available, else current content
  editContent.value = (item.rawContent && item.rawContent.trim())
    ? item.rawContent
    : (item.content || '');

  editPanel.style.display  = 'block';
  if (editTrigger) editTrigger.style.display = 'none';
  editContent.focus();
}

function saveItemEdit() {
  if (!activeItemId) return;
  var idx = items.findIndex(function(i) { return i.id === activeItemId; });
  if (idx === -1) return;

  var editContent = document.getElementById('ia-edit-content');
  if (!editContent) return;
  var newText = editContent.value.trim();
  if (!newText) { showToast('nothing to save'); return; }

  items[idx].content    = newText;
  items[idx].rawContent = '';
  items[idx].aiTitle    = '';
  items[idx].aiSummary  = '';
  items[idx].aiActions  = [];
  items[idx].aiPending  = false;
  items[idx].confirmed  = false;
  items[idx].touchedAt  = new Date().toISOString();

  save();
  closeItemAction();
  showToast('updated');
}

function cancelItemEdit() {
  var editPanel   = document.getElementById('ia-edit-panel');
  var editTrigger = document.querySelector('.ia-edit-trigger');
  if (editPanel) editPanel.style.display = 'none';
  if (editTrigger) editTrigger.style.display = 'block';
}
```

- [ ] **Step 5.2: Verify edit flow in browser**

Open the app. Capture an item (tap +, type "test item for editing"). Open the item action sheet. Confirm:
1. "edit capture" button is visible at the bottom of the sheet
2. Tapping it shows the textarea, pre-populated with the item text
3. Changing the text and tapping "save" closes the sheet and shows "updated" toast
4. Opening the item again confirms the text was changed
5. Tapping "cancel" hides the textarea and restores the "edit capture" button

- [ ] **Step 5.3: Commit edit JS**

```bash
git add js/actions.js
git commit -m "feat(edit): enterItemEditMode / saveItemEdit / cancelItemEdit — edit captured text in place"
```

---

## Task 6: Inbox Swipe Triage

**Files:**
- Modify: `js/render.js` (inside `renderInbox`)
- Modify: `css/layout.css`

- [ ] **Step 6.1: Add swipe CSS to css/layout.css**

Append to `css/layout.css`:

```css
/* ── Inbox Swipe Triage ──────────────────────────────────── */
.inbox-item {
  position: relative;
  transition: transform 0.15s ease, opacity 0.15s ease;
}
.inbox-item.swipe-dismiss-right {
  transform: translateX(110%) !important;
  opacity: 0;
  transition: transform 0.25s ease, opacity 0.2s ease;
}
.inbox-item.swipe-dismiss-left {
  transform: translateX(-110%) !important;
  opacity: 0;
  transition: transform 0.25s ease, opacity 0.2s ease;
}
.inbox-item-swipe-bg {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.1s ease;
}
.inbox-item-swipe-bg.right {
  background: rgba(196, 149, 106, 0.18);
}
.inbox-item-swipe-bg.left {
  background: rgba(126, 184, 164, 0.18);
}
```

- [ ] **Step 6.2: Add swipe handler attachment to `renderInbox` in js/render.js**

In `js/render.js`, find the `renderInbox` function. After the line that sets `list.innerHTML = ...` (after the inbox items are rendered), add a call to `attachInboxSwipe(list)`.

Find the pattern that ends the inbox rendering (where items are mapped to HTML and set on the list). It looks something like:

```javascript
  list.innerHTML = visibleItems.map(i => renderItemHTML(i)).join('') + archiveDrawer + doneDrawer;
```

After that line, add:

```javascript
  attachInboxSwipe(list);
```

- [ ] **Step 6.3: Add `attachInboxSwipe` function to js/render.js**

Add this function just before `renderInbox` in `js/render.js`:

```javascript
function attachInboxSwipe(list) {
  // Use a delegated listener on the list container.
  // Clone to remove any previous listeners from a prior render.
  var fresh = list.cloneNode(true);
  list.parentNode.replaceChild(fresh, list);

  var _startX = 0;
  var _target = null;
  var _bgEl   = null;

  fresh.addEventListener('touchstart', function(e) {
    var item = e.target.closest('.inbox-item');
    if (!item) return;
    // Skip done/archived items
    var id = item.dataset.id;
    var it = id && items.find(function(i) { return i.id === id; });
    if (it && (it.status === 'archived' || it.status === 'done')) return;

    _startX  = e.touches[0].clientX;
    _target  = item;

    // Inject swipe background element if not already there
    _bgEl = item.querySelector('.inbox-item-swipe-bg');
    if (!_bgEl) {
      _bgEl = document.createElement('div');
      _bgEl.className = 'inbox-item-swipe-bg';
      item.insertBefore(_bgEl, item.firstChild);
    }
  }, { passive: true });

  fresh.addEventListener('touchmove', function(e) {
    if (!_target) return;
    var dx = e.touches[0].clientX - _startX;
    _target.style.transform = 'translateX(' + dx + 'px)';

    if (_bgEl) {
      if (dx > 20) {
        _bgEl.className = 'inbox-item-swipe-bg right';
        _bgEl.style.opacity = Math.min(dx / 100, 0.8).toString();
      } else if (dx < -20) {
        _bgEl.className = 'inbox-item-swipe-bg left';
        _bgEl.style.opacity = Math.min(-dx / 100, 0.8).toString();
      } else {
        _bgEl.style.opacity = '0';
      }
    }
  }, { passive: true });

  fresh.addEventListener('touchend', function(e) {
    if (!_target) return;
    var dx = e.changedTouches[0].clientX - _startX;
    var item = _target;
    var id   = item.dataset.id;
    var it   = id && items.find(function(i) { return i.id === id; });

    _target = null;
    _bgEl   = null;

    if (!it) {
      item.style.transform = '';
      return;
    }

    if (dx > 80) {
      // Swipe right → archive
      item.classList.add('swipe-dismiss-right');
      setTimeout(function() {
        it.status     = 'archived';
        it.archivedAt = new Date().toISOString();
        save();
        if (navigator.vibrate) navigator.vibrate(30);
        renderInbox();
        showToast('archived — tap to undo');
      }, 260);
    } else if (dx < -80) {
      // Swipe left → promote to task
      item.classList.add('swipe-dismiss-left');
      setTimeout(function() {
        it.category  = 'task';
        it.confirmed = true;
        it.touchedAt = new Date().toISOString();
        save();
        if (navigator.vibrate) navigator.vibrate(30);
        renderInbox();
        showToast('moved to tasks');
      }, 260);
    } else {
      // Spring back
      item.style.transition = 'transform 0.22s ease';
      item.style.transform  = 'translateX(0)';
      setTimeout(function() { item.style.transition = ''; }, 240);
      var bg = item.querySelector('.inbox-item-swipe-bg');
      if (bg) bg.style.opacity = '0';
    }
  }, { passive: true });

  // Return the replacement node so callers can re-reference if needed
  return fresh;
}
```

**Note:** `attachInboxSwipe` returns the cloned list node. The `list.innerHTML = ...` line in `renderInbox` sets content before `attachInboxSwipe` is called, so the clone happens after content is set — this is correct.

- [ ] **Step 6.4: Ensure inbox items have `data-id` attribute**

Swipe triage uses `item.dataset.id` to look up the item. Check `renderItemHTML` (or the inline HTML in `renderInbox`) to confirm each inbox item row has `data-id="${item.id}"` on the root element with class `inbox-item`.

If the root element is like:
```html
<div class="inbox-item" onclick="openItemAction('${i.id}')">
```

Add `data-id="${i.id}"` to it:
```html
<div class="inbox-item" data-id="${i.id}" onclick="openItemAction('${i.id}')">
```

Search `renderItemHTML` in `js/render.js` for the `inbox-item` class root element and confirm or add `data-id`.

- [ ] **Step 6.5: Verify swipe in browser (touch simulation)**

Open `http://localhost:3456`. Capture 2–3 test items. Switch to Plan → Inbox. In browser DevTools, enable touch emulation (or test on device). Confirm:
- Dragging right >80px shows amber tint then archives with "archived — tap to undo" toast
- Dragging left >80px shows teal tint then moves to tasks with "moved to tasks" toast
- Short drag <80px springs back smoothly
- Already-archived items don't trigger swipe

- [ ] **Step 6.6: Commit swipe triage**

```bash
git add js/render.js css/layout.css
git commit -m "feat(inbox): swipe right=archive, swipe left=task — touch triage with spring-back"
```

---

## Task 7: AI Daily Brief

**Files:**
- Modify: `js/render.js`
- Modify: `css/layout.css`

`callGemini` in `ai.js` is `async` and returns a `Promise`. The daily brief calls it and updates the DOM when the promise resolves. The function is triggered from `renderWork()`.

- [ ] **Step 7.1: Add daily brief CSS to css/layout.css**

Append to `css/layout.css`:

```css
/* ── AI Daily Brief ──────────────────────────────────────── */
.daily-brief-card {
  margin: 0 0 18px 0;
  padding: 0 4px;
  text-align: center;
}
.daily-brief-text {
  font-family: 'Cormorant Garamond', serif;
  font-size: 1.05rem;
  font-weight: 400;
  font-style: italic;
  color: rgba(232, 221, 212, 0.5);
  letter-spacing: 0.025em;
  line-height: 1.5;
  margin: 0;
}
```

- [ ] **Step 7.2: Add `renderDailyBrief` function to js/render.js**

Add the following function just before `function renderWork()` in `js/render.js`:

```javascript
function renderDailyBrief(area, session) {
  var today = new Date().toDateString();
  if (localStorage.getItem('forward_daily_brief_date') === today) return;

  var key = typeof getGeminiKey === 'function' && getGeminiKey();
  if (!key) return;

  var mood = session && session.mood ? session.mood : null;
  if (mood === 'Heavy' || mood === 'Overwhelmed') return;

  var aliveItems = items.filter(function(i) {
    return i.status === 'fresh' || i.status === 'alive';
  });
  if (aliveItems.length === 0) return;

  // Mark shown for today immediately — prevents double-fire on rapid re-renders
  localStorage.setItem('forward_daily_brief_date', today);

  var briefCard = document.createElement('div');
  briefCard.className = 'daily-brief-card';
  var briefText = document.createElement('p');
  briefText.className = 'daily-brief-text';
  briefText.textContent = '…';
  briefCard.appendChild(briefText);
  area.insertBefore(briefCard, area.firstChild);

  var moodLine  = mood ? ('mood: ' + mood.toLowerCase()) : 'no check-in today';
  var topItems  = aliveItems.slice(0, 3).map(function(i) {
    return ((i.aiTitle || i.content) || '').substring(0, 55);
  }).join('; ');

  var systemPrompt = 'You are a calm, warm companion for someone with ADHD. ' +
    'In one sentence of at most 18 words, gently orient them for today. ' +
    'Do not mention ADHD, productivity, or efficiency. ' +
    'Do not use the word "today". No emojis. Lowercase only. No terminal punctuation.';
  var userPrompt = 'Context — ' + moodLine + '. Things on their mind: ' + topItems;

  callGemini(systemPrompt, userPrompt).then(function(text) {
    if (text && briefText && briefText.parentNode) {
      briefText.textContent = text.trim().toLowerCase().replace(/\.$/, '');
    }
  }).catch(function() {
    // Brief is best-effort — silent failure is correct
    if (briefCard && briefCard.parentNode) briefCard.parentNode.removeChild(briefCard);
    localStorage.removeItem('forward_daily_brief_date');
  });
}
```

- [ ] **Step 7.3: Call `renderDailyBrief` from `renderWork`**

In `js/render.js`, find `renderWork()`. Near the top of the function, `session` is already retrieved:

```javascript
  const session = S.rewindSession;
```

After the work area content is set (after `area.innerHTML = ...` for the task card, or after the `work-empty` check), add a call to `renderDailyBrief`.

Find the block that sets the task card content — it looks like:

```javascript
  area.innerHTML = `
    <div class="task-card">
    ...
    </div>
    <div class="mvna-wrap" id="mvna-wrap"></div>`;

  // AI Companion onboarding card
```

Insert the `renderDailyBrief` call immediately after `area.innerHTML = ...` and before the companion onboarding card block:

```javascript
  // AI Daily Brief — ambient orientation on first open of day
  renderDailyBrief(area, session);

  // AI Companion onboarding card — shown once when no key is configured
```

- [ ] **Step 7.4: Verify daily brief in browser**

To test without waiting for a real day:

```javascript
// Run in browser console to reset the date flag:
localStorage.removeItem('forward_daily_brief_date');
```

Then reload and navigate to Work mode. If a Gemini key is set and there are items, a soft italic sentence should appear above the task card within 1–2 seconds.

Confirm:
- The brief appears on first Work mode open (or after clearing the flag)
- It does NOT appear again on a second `renderWork` call same day (flag is set)
- If mood is Heavy or Overwhelmed, no brief appears (set `S.rewindSession = {mood:'Heavy'}` in console to test)
- If no API key is set, no brief appears

- [ ] **Step 7.5: Commit daily brief**

```bash
git add js/render.js css/layout.css
git commit -m "feat(ai): daily brief — ambient one-sentence orientation on first work mode open"
```

---

## Task 8: Final Build Integration Check

**Files:** no changes — verification only

- [ ] **Step 8.1: Check for any `?.` or `??` in new code**

```bash
grep -n "\?\." js/render.js js/actions.js | grep -v "^Binary\|^css"
grep -n "??" js/render.js js/actions.js | grep -v "^Binary\|^css"
```

Expected: no results (or only pre-existing occurrences not introduced by this session).

- [ ] **Step 8.2: Verify full app load with no console errors**

Open `http://localhost:3456` in browser. Open DevTools console. Reload. Confirm no red errors.

- [ ] **Step 8.3: Smoke test all existing features**

Manually confirm the following still work:
- Capture (tap +, type text, confirm categorisation)
- Projects (open Projects tab, create a project, open its sheet)
- Focus mode (Work tab, tap "Begin →" on a task, enter focus, exit)
- Settings (open Settings, check AI key field, export data)

- [ ] **Step 8.4: Update HARNESS_STATE.json**

In `harness/HARNESS_STATE.json`, update:
- `"session_id"`: increment to next session
- `"phases_complete"`: add `9` and `10`
- `"phases_remaining"`: remove `9` and `10`
- `"current_phase"`: set to next phase (or null if all harness phases done)
- `"new_features_queued"`: remove the three features just implemented
- Add a Session 4 entry to `"task_history"`

```json
{
  "session_id": "FWD-20260402-0300",
  "product": "Forward",
  "iteration": 1,
  "max_iterations": 3,
  "task_history": [
    {
      "session": "Build Session 1",
      "notes": "Initial feature build — projects, inbox, focus timer, Gemini BYOK, Apple Reminders sync, backup/restore, PWA manifest."
    },
    {
      "session": "Build Session 2",
      "notes": "Nav restructure (2-mode Plan/Work), capture omnipresence, mood bridge, return state intercept, warm empty states."
    },
    {
      "session": "Build Session 3",
      "notes": "AI Companion onboarding, Living Projects vision reframe, Sparks↔Rewind bridge, data aging. Plus bug fixes."
    },
    {
      "session": "Build Session 4",
      "notes": "PWA audit (icon assets, manifest id/orientation/purpose, SW offline fallback), Rewind orb-descent transition animation, full item editing in action sheet, inbox swipe triage (right=archive, left=task), AI daily brief (ambient once-per-day orientation)."
    }
  ],
  "phases_complete": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  "phases_remaining": [],
  "current_phase": null,
  "new_features_queued": [],
  "status": "COMPLETE"
}
```

- [ ] **Step 8.5: Final commit**

```bash
git add harness/HARNESS_STATE.json
git commit -m "build-session-4: PWA audit, Rewind transition, item editing, swipe triage, AI daily brief"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Phase 9 PWA — icon creation (Task 1), manifest (Task 2.1), SW offline fallback (Task 2.2), cache version bump (Task 2.3)
- [x] Phase 10 Rewind transition — `animateIntoRewind` + `resetFromRewind` + wired into `toggleRewindMode` (Task 3)
- [x] Full item editing — HTML panel (Task 4), JS functions (Task 5), edit trigger button in sheet (Task 4.1)
- [x] Inbox swipe triage — CSS (Task 6.1), `attachInboxSwipe` function (Task 6.3), `data-id` check (Task 6.4)
- [x] AI daily brief — CSS (Task 7.1), `renderDailyBrief` function (Task 7.2), called from `renderWork` (Task 7.3)
- [x] No `?.` or `??` — all new code uses `&&` guards and explicit ternaries

**Type/name consistency:**
- `renderDailyBrief(area, session)` — both call site and definition use `(area, session)` ✓
- `attachInboxSwipe(list)` — call site and definition match ✓
- `enterItemEditMode` / `saveItemEdit` / `cancelItemEdit` — HTML `onclick` attributes match function names ✓
- `animateIntoRewind` / `resetFromRewind` — both called only from within `toggleRewindMode` ✓
- `ia-edit-panel` / `ia-edit-content` / `.ia-edit-trigger` — all IDs/classes consistent across HTML and JS ✓
