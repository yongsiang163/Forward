// Gemini key management: get/set/clear/test + status row in Settings.
// Depends on: state.js (_aiState, _probing, _functions, probeAIState,
// invalidateAIState), client.js (callGemini for testGeminiKey).

// Synchronous "do we have a key?" — used to gate UI. May be stale for a tick
// after sign-in, but triggers a probe in the background.
function getGeminiKey() {
  if (_aiState) return _aiState.hasKey ? 'present' : null;
  probeAIState().then(updateAIKeyStatus).catch(() => {});
  const legacy = localStorage.getItem('gemini_api_key');
  return legacy || null;
}

async function setGeminiKey(key) {
  const trimmed = (key || '').trim();
  const fns = _functions();
  if (fns && typeof currentUser !== 'undefined' && currentUser) {
    try {
      if (trimmed) {
        await fns.httpsCallable('setGeminiKey')({ key: trimmed });
      } else {
        await fns.httpsCallable('clearGeminiKey')();
      }
      localStorage.removeItem('gemini_api_key');
      invalidateAIState();
      await probeAIState();
      updateAIKeyStatus();
      return;
    } catch (e) {
      console.warn('[AI] proxy setGeminiKey failed, falling back to local:', e && e.message);
    }
  }
  if (trimmed) localStorage.setItem('gemini_api_key', trimmed);
  else localStorage.removeItem('gemini_api_key');
  invalidateAIState();
  updateAIKeyStatus();
}

function updateAIKeyStatus() {
  const status = document.getElementById('ai-key-status');
  const input = document.getElementById('ai-key-input');
  if (!status) return;
  const state = _aiState;
  if (state && state.mode === 'proxy') {
    status.textContent = state.hasKey ? '✓ connected (secure)' : '○ not set';
    status.className = state.hasKey ? 'settings-row-action on' : 'settings-row-action';
    if (input) input.value = '';
    if (input) input.placeholder = state.hasKey ? 'Key stored on server — enter to replace' : 'Paste your API key here…';
  } else {
    const legacy = localStorage.getItem('gemini_api_key');
    if (legacy) {
      status.textContent = '✓ connected (local)';
      status.className = 'settings-row-action on';
    } else {
      status.textContent = '○ not set';
      status.className = 'settings-row-action';
    }
    if (input && !legacy) input.value = '';
  }
}

async function testGeminiKey() {
  try {
    const result = await callGemini('Respond with exactly: ok', 'Test');
    if (result) showToast('✓ API key works');
    else showToast('Key test failed — check the key');
  } catch (e) {
    showToast((e && e.message) || 'Key test failed — check the key');
  }
}

async function clearGeminiKey() {
  const fns = _functions();
  if (fns && typeof currentUser !== 'undefined' && currentUser) {
    try { await fns.httpsCallable('clearGeminiKey')(); } catch (e) { /* best-effort */ }
  }
  localStorage.removeItem('gemini_api_key');
  invalidateAIState();
  await probeAIState();
  updateAIKeyStatus();
  showToast('API key removed');
}
