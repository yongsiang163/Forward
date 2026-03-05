const fs = require('fs');
const f = 'C:/Users/User/AI Project/FORWARD/VERSION/Forward/js/render.js';
let c = fs.readFileSync(f, 'utf8');

const NL = '\r\n';
const marker = NL + '  renderMomentum();' + NL + '  updateStats();' + NL + '}' + NL + NL + 'function renderMomentum()';
const inject = NL + NL + 
  '  // Apply mood state to orb, bg-glow, beam for visual state awareness' + NL +
  '  const moodState = session ? ((MOOD_MAP[session.mood] || MOOD_MAP.Okay).state || \'drifting\') : \'none\';' + NL +
  '  const _orbWrap = document.getElementById(\'hero-orb-wrap\');' + NL +
  '  const _bgGlow = document.querySelector(\'.hero-bg-glow\');' + NL +
  '  const _beam = document.querySelector(\'.hero-orb-beam\');' + NL +
  '  if (_orbWrap) _orbWrap.dataset.mood = moodState;' + NL +
  '  if (_bgGlow) _bgGlow.dataset.mood = moodState;' + NL +
  '  if (_beam) _beam.dataset.mood = moodState;';

console.log('marker found:', c.includes(marker));
c = c.replace(marker, inject + marker);
fs.writeFileSync(f, c, 'utf8');
console.log('done');
