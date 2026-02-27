
# Forward

**An intentional, attention-aware productivity companion.**

Forward is a mobile-first web prototype designed to rethink how we interact with our tasks and projects. Built as a companion to "Rewind," Forward moves away from overwhelming backlogs and instead adapts to your current energy levels, offering right-sized next steps and gentle focus protection.

Currently, this repository contains a high-fidelity frontend prototype utilizing HTML, CSS, and Vanilla JavaScript with `localStorage` and simulated AI interactions.

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
* **PWA & Offline First:** Full Progressive Web App support allows installation to the home screen. Data is kept locally via `localStorage`.
* **Data Sync (Preview):** Initial integration with Firebase/Firestore is laid out (currently commented out/disabled) to prepare for cross-device syncing via anonymous and email-linked accounts.
* **AI Integration:** Currently uses simulated delays (`setTimeout`) to mock LLM categorization and advice generation.

### ✦ Roadmap

* [x] Split monolithic architecture into modular CSS/JS files.
* [x] Implement full PWA (Progressive Web App) support for offline use.
* [ ] Reactivate and finalize **Firebase/Firestore** integration to enable reliable cross-device cloud syncing.
* [ ] Wire up live LLM integration (e.g., Claude or Gemini APIs) for the categorisation and "Help Me Start" features.
* [ ] Refactor into a modern component-based framework (e.g., React/Next.js or SvelteKit) for long-term scalability.
