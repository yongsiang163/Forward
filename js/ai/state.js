// AI proxy/local state probe + cache.
//
// _aiState shape: { mode: 'proxy'|'local'|'none', hasKey: bool }
// Memoized after first probe; invalidate via invalidateAIState() on auth change.

let _aiState = null;
let _probing = null;

function _functions() {
  return (typeof firebase !== 'undefined' && firebase.app && firebase.functions)
    ? firebase.app().functions('asia-southeast1')
    : null;
}

async function probeAIState() {
  if (_aiState) return _aiState;
  if (_probing) return _probing;
  _probing = (async () => {
    const fns = _functions();
    if (fns && typeof currentUser !== 'undefined' && currentUser) {
      try {
        const res = await fns.httpsCallable('hasGeminiKey')();
        _aiState = { mode: 'proxy', hasKey: !!(res && res.data && res.data.hasKey) };
        // Migrate any legacy localStorage key into the proxy automatically.
        const legacy = localStorage.getItem('gemini_api_key');
        if (legacy && !_aiState.hasKey) {
          try {
            await fns.httpsCallable('setGeminiKey')({ key: legacy });
            localStorage.removeItem('gemini_api_key');
            _aiState.hasKey = true;
          } catch (e) { /* leave localStorage alone if migration fails */ }
        } else if (legacy && _aiState.hasKey) {
          // Proxy already has a key — don't leave a second copy on the device.
          localStorage.removeItem('gemini_api_key');
        }
        return _aiState;
      } catch (e) {
        // Functions not deployed, offline, or blocked. Fall back.
        console.warn('[AI] proxy probe failed, using local fallback:', e && e.message);
      }
    }
    const localKey = localStorage.getItem('gemini_api_key');
    _aiState = { mode: localKey ? 'local' : 'none', hasKey: !!localKey };
    return _aiState;
  })();
  const r = await _probing; _probing = null; return r;
}

function invalidateAIState() { _aiState = null; }
