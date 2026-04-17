// Forward — shared constants.
//
// Phase 2 of the ES-module refactor: constants extracted from data.js and
// ai.js into a single location. Loaded as a classic <script> before the
// other project scripts, so `const` bindings declared here are visible to
// every subsequent script on the page via the shared Script Record.
// (Classic-script `const` is NOT a property of `window`, but other classic
// scripts can still read it — that's how data.js, ai.js, etc. work today.)

// ── GEMINI API ────────────────────────────────────────────
// v1beta is restricted for new API keys; use stable v1.
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_API_VERSION = 'v1';

// ── PROJECT CATEGORIES + PHASES ──────────────────────────
const PROJECT_CATS = {
  idwork: { label: 'ID Work', badgeClass: 'cat-badge-idwork', phases: ['concept', 'development', 'procurement', 'site', 'delivery'], phaseLabels: { concept: 'Concept', development: 'Development', procurement: 'Procurement', site: 'Site', delivery: 'Delivery' } },
  life: { label: 'Life', badgeClass: 'cat-badge-life', phases: ['seed', 'shaping', 'inmotion', 'integrating'], phaseLabels: { seed: 'Seed', shaping: 'Shaping', inmotion: 'In Motion', integrating: 'Integrating' } },
  business: { label: 'Business', badgeClass: 'cat-badge-business', phases: ['idea', 'validating', 'building', 'operating'], phaseLabels: { idea: 'Idea', validating: 'Validating', building: 'Building', operating: 'Operating' } },
  learning: { label: 'Learning', badgeClass: 'cat-badge-learning', phases: ['curious', 'exploring', 'practising', 'embedding'], phaseLabels: { curious: 'Curious', exploring: 'Exploring', practising: 'Practising', embedding: 'Embedding' } },
  open: { label: 'Open', badgeClass: 'cat-badge-open', phases: ['start', 'middle', 'end'], phaseLabels: { start: 'Start', middle: 'Middle', end: 'End' } }
};

const AI_PERSONAS = {
  idwork: 'You are a calm, experienced interior design project coordinator. You understand design phases deeply — concept, development, procurement, site, delivery. Your suggestions are specific, physical, and sequenced.',
  life: 'You are a warm, grounded personal coach. You help people move through life projects with clarity and self-compassion. Your suggestions are gentle, honest, and sized to what feels possible today.',
  business: 'You are a sharp, lean thinking partner for business and entrepreneurial work. You help cut through noise, find the real next move, and keep momentum without overwhelm.',
  learning: 'You are a patient, curious learning guide. You help people build knowledge and skill progressively. You know that learning compounds — you always suggest the smallest step that builds on what\'s already known.',
  open: 'You are a thoughtful, adaptive thinking partner. You meet the person where they are and help them find the clearest next step.'
};

// ── SYSTEM PROMPTS ───────────────────────────────────────
const SYSTEM_PROMPT_CATEGORISE = `You are a classification engine for a personal capture app designed for someone with ADHD.

Classify the user's captured thought into exactly ONE category:
- task — something with a clear next action
- project — something with multiple steps, a client context, or a larger initiative
- spark — an idea, observation, creative thought, or "what if"
- reminder — time-sensitive, date-sensitive, or something to remember

Respond with ONLY the single lowercase category word. Nothing else.`;

const SYSTEM_PROMPT_SUMMARISE = `You are a thought-cleanup engine for an ADHD productivity app called Forward.

The user has captured a raw thought — often via voice, often messy, rambling, or stream-of-consciousness. Your job is to extract clarity from chaos.

Return ONLY valid JSON with this exact shape:
{
  "title": "3-8 word scannable title",
  "summary": "1-2 sentence cleaned-up version of the core thought",
  "actions": ["extracted next action 1", "extracted next action 2"]
}

RULES:
1. The title must be short, specific, and scannable — like a good email subject line
2. The summary must preserve the user's INTENT, not their exact words. Remove filler, repetition, and verbal noise
3. Extract concrete next-actions ONLY if they are clearly implied or stated. If the capture is purely an idea or observation, return an empty actions array []
4. Never add actions the user didn't imply. Do not invent tasks
5. Keep the user's voice and meaning — do not make it sound corporate or robotic
6. Respond with ONLY the JSON object. No markdown, no code fences, no explanation`;
