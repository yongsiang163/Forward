// Core Gemini call path: serial queue + retry + proxy/local routing.
// Depends on: state.js (probeAIState, _functions), constants.js (GEMINI_MODEL).

let _geminiQueue = Promise.resolve();

async function callGemini(systemPrompt, userPrompt, options = {}) {
  // Queue requests sequentially to avoid 429s on free tier.
  // IMPORTANT: the .catch(() => {}) on _geminiQueue is intentional — without it,
  // a single rejected call poisons the entire promise chain and all future AI calls
  // silently become no-ops until the page is reloaded.
  const result = new Promise((resolve, reject) => {
    _geminiQueue = _geminiQueue
      .then(async () => {
        try {
          const r = await _callGeminiDirect(systemPrompt, userPrompt, options);
          resolve(r);
        } catch (e) {
          reject(e);
          // Re-throw so the chain tail knows this slot finished (even badly)
          throw e;
        }
      })
      .catch(() => {
        // Absorb the error on the CHAIN itself so the next queued .then() still runs.
        // The individual promise (result) above has already been rejected correctly.
      });
  });
  return result;
}

async function _callGeminiDirect(systemPrompt, userPrompt, options = {}, attempt = 0) {
  const state = await probeAIState();
  if (!state || state.mode === 'none' || !state.hasKey) return null;

  // Proxy path: callable function handles the Gemini request server-side with
  // the stored key. The browser never sees the key.
  if (state.mode === 'proxy') {
    try {
      const fns = _functions();
      const callable = fns.httpsCallable('geminiProxy');
      const res = await callable({ systemPrompt, userPrompt, options });
      const text = res && res.data && res.data.text;
      if (!text) throw new Error('Empty response from API');
      return text.trim();
    } catch (e) {
      // Firebase callable errors expose a `code` like 'resource-exhausted'.
      const code = e && e.code;
      if (code === 'resource-exhausted' && attempt < 3) {
        const waitSec = Math.pow(2, attempt + 2); // 4s, 8s, 16s
        console.warn(`[Gemini] Rate limited via proxy, retrying in ${waitSec}s (${attempt + 1}/3)`);
        await new Promise(r => setTimeout(r, waitSec * 1000));
        return _callGeminiDirect(systemPrompt, userPrompt, options, attempt + 1);
      }
      if (code === 'permission-denied') {
        throw new Error('API key invalid or quota exceeded — update it in Settings.');
      }
      if (code === 'failed-precondition') {
        throw new Error('No API key stored — add one in Settings.');
      }
      if (code === 'unauthenticated') {
        throw new Error('Sign in required to use AI.');
      }
      throw new Error((e && e.message) || 'AI proxy error');
    }
  }

  // Local path: direct call from browser with key held in localStorage.
  const key = localStorage.getItem('gemini_api_key');
  if (!key) return null;
  const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: options.temperature ?? 0.7,
      maxOutputTokens: options.maxOutputTokens ?? 400
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  // Auto-retry on rate limit (429) with exponential backoff
  if (res.status === 429 && attempt < 3) {
    const waitSec = Math.pow(2, attempt + 2); // 4s, 8s, 16s
    console.warn(`[Gemini] Rate limited, retrying in ${waitSec}s (attempt ${attempt + 1}/3)`);
    await new Promise(r => setTimeout(r, waitSec * 1000));
    return _callGeminiDirect(systemPrompt, userPrompt, options, attempt + 1);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message || `API error ${res.status}`;
    // Surface key-restriction errors clearly so the user knows to get a fresh key
    if (res.status === 400 && /no longer available|new user|update your code/i.test(msg)) {
      throw new Error('API key not supported — generate a new key at aistudio.google.com/apikey and update it in Settings.');
    }
    if (res.status === 403) {
      throw new Error('API key invalid or quota exceeded — check your key in Settings.');
    }
    throw new Error(msg);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Empty response from API');
  return text.trim();
}
