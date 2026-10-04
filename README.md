
# Forward

**An intentional, attention-aware productivity companion.**

Forward is a mobile-first web prototype designed to rethink how we interact with our tasks and projects. Built as a companion to "Rewind," Forward moves away from overwhelming backlogs and instead adapts to your current energy levels, offering right-sized next steps and gentle focus protection.

It's a vanilla HTML/CSS/JavaScript PWA with offline-first local storage (IndexedDB), Firebase sync across devices, and Gemini-powered AI (bring your own key).

### ✦ Core Features

* **Attention-Aware Work Mode:** Integrates with your current mood/energy state (Alive, Calm, Restless, Heavy, etc.) to curate your task list. If you are fatigued, the app surfaces only the smallest, freshest task and limits AI suggestions to a single step.
* **Frictionless Capture & AI Triage:** A quick-capture interface where raw thoughts are seamlessly processed. The app is built to use AI to automatically categorize inputs into Tasks, Projects, Sparks, or Reminders.
* **Living Projects:** Projects are categorized (e.g., ID Work, Business, Life) and tracked by specific, domain-aware phases rather than rigid checklists. You can now develop captured inbox items into new projects or add them to existing ones.
* **Recurring Tasks:** Built-in support for daily, weekly, or monthly repeatable routines, kept in a dedicated section.
* **Apple Reminders Sync:** Send "Reminder" category items directly to your native iOS/macOS Apple Reminders app.
* **"Help Me Start" (MVNA):** An AI assistant that generates Minimum Viable Next Actions—breaking down intimidating tasks into micro-steps to unblock momentum.
* **Gentle Focus Protection:** Instead of aggressive timers, Forward uses peripheral awareness. A soft ring glows on the edge of the screen at 45 minutes, with a gentle message appearing at 120 minutes to prevent burnout.
* **Lifecycle Engine (Graveyard Prevention):** Items have distinct lifespans. For example, actionable "Sparks" auto-archive after 7 days, ensuring your inbox remains a place of active momentum.

### ✦ Tech Stack & Current State

This project has evolved from a monolithic single file into a modular, highly interactive frontend application.

* **UI/UX:** Custom CSS with fluid animations, a dark ambient aesthetic, grain overlays, and breathing "orb" indicators.
* **Architecture:** Modular JavaScript setup (`app.js`, `actions.js`, `data.js`, `render.js`) for better maintainability.
* **PWA & Offline First:** Installable to the home screen. Data lives in IndexedDB (via Dexie) with a `localStorage` mirror, so the app works fully offline.
* **Data Sync:** Firebase Auth (anonymous by default, upgradable to email or Google) and Firestore keep devices in sync. Only changed records are written; deletions sync as tombstones so they don't reappear.
* **AI Integration:** Google Gemini via your own API key (Settings → AI). Models are tried in order (`gemini-2.5-flash-lite`, then `gemini-2.5-flash`) and the app falls back automatically if Google retires one. Without a key, simple pattern-matching fallbacks are used.

### ✦ Roadmap

* [x] Split monolithic architecture into modular CSS/JS files.
* [x] Implement full PWA (Progressive Web App) support for offline use.
* [x] Firebase/Firestore integration for cross-device cloud syncing.
* [x] Live LLM integration (Gemini) for categorisation, brain-dump summaries, "Help Me Start", the project companion, and the weekly review.
* [ ] Refactor into a modern component-based framework (e.g., React/Next.js or SvelteKit) for long-term scalability.
