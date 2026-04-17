// Forward — Gemini API proxy.
//
// The browser never sees the user's Gemini key after initial setup.
// The key is stored at users/{uid}/private/config, which is blocked from
// all client reads by firestore.rules. Only this Admin-SDK function can
// read it back, attach it to a Gemini request, and return the result.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10 });

const db = admin.firestore();
const KEY_DOC = (uid) => db.doc(`users/${uid}/private/config`);
const GEMINI_MODEL_DEFAULT = 'gemini-2.0-flash';

// Best-effort per-uid rate limit. In-memory per instance — not cluster-wide,
// but enough to deter casual abuse. Real hardening belongs in App Check.
const _rate = new Map();
function checkRate(uid, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const rec = _rate.get(uid) || { count: 0, resetAt: now + windowMs };
  if (now > rec.resetAt) { rec.count = 0; rec.resetAt = now + windowMs; }
  rec.count += 1;
  _rate.set(uid, rec);
  if (rec.count > limit) {
    throw new HttpsError('resource-exhausted', 'Too many AI requests. Wait a minute.');
  }
}

function requireAuth(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.');
  return uid;
}

async function loadKey(uid) {
  const snap = await KEY_DOC(uid).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  return data.geminiKey || null;
}

exports.setGeminiKey = onCall(async (request) => {
  const uid = requireAuth(request);
  const key = (request.data && request.data.key || '').trim();
  if (!key) throw new HttpsError('invalid-argument', 'Missing key.');
  if (key.length < 20 || key.length > 200) {
    throw new HttpsError('invalid-argument', 'Key length looks wrong.');
  }
  await KEY_DOC(uid).set({
    geminiKey: key,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true };
});

exports.clearGeminiKey = onCall(async (request) => {
  const uid = requireAuth(request);
  await KEY_DOC(uid).set({
    geminiKey: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true };
});

exports.hasGeminiKey = onCall(async (request) => {
  const uid = requireAuth(request);
  const key = await loadKey(uid);
  return { hasKey: !!key };
});

exports.geminiProxy = onCall({ timeoutSeconds: 60 }, async (request) => {
  const uid = requireAuth(request);
  checkRate(uid);

  const { systemPrompt, userPrompt, options } = request.data || {};
  if (typeof systemPrompt !== 'string' || typeof userPrompt !== 'string') {
    throw new HttpsError('invalid-argument', 'systemPrompt and userPrompt must be strings.');
  }
  if (systemPrompt.length > 8000 || userPrompt.length > 16000) {
    throw new HttpsError('invalid-argument', 'Prompt too long.');
  }

  const key = await loadKey(uid);
  if (!key) throw new HttpsError('failed-precondition', 'No Gemini key stored. Add one in Settings.');

  const model = GEMINI_MODEL_DEFAULT;
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: (options && typeof options.temperature === 'number') ? options.temperature : 0.7,
      maxOutputTokens: (options && typeof options.maxOutputTokens === 'number') ? options.maxOutputTokens : 400
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (res.status === 429) {
    throw new HttpsError('resource-exhausted', 'Gemini rate-limited. Try again shortly.');
  }
  if (res.status === 403) {
    throw new HttpsError('permission-denied', 'Gemini key invalid or quota exhausted. Update it in Settings.');
  }
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    const msg = (errJson && errJson.error && errJson.error.message) || `Gemini error ${res.status}`;
    throw new HttpsError('internal', msg);
  }

  const data = await res.json();
  const text = data && data.candidates && data.candidates[0] &&
    data.candidates[0].content && data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
  if (!text) throw new HttpsError('internal', 'Empty response from Gemini.');
  return { text: text.trim() };
});
