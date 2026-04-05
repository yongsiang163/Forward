'use strict';

var functions = require('firebase-functions');
var generativeai = require('@google/generative-ai');

exports.rewindReflect = functions.region('asia-southeast1').https.onRequest(function(req, res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  var body = req.body || {};
  var mood = body.mood || 'Okay';
  var feeling = body.feeling || '';
  var history = Array.isArray(body.history) ? body.history : [];
  var forwardContext = body.forwardContext || '';

  var apiKey;
  try {
    apiKey = functions.config().gemini.key;
  } catch (e) {
    apiKey = null;
  }

  if (!apiKey) {
    res.status(200).json({ reflection: null, followUp: null });
    return;
  }

  // Detect recurring mood pattern (3+ times in last 7 sessions)
  var recentMoods = history.slice(-7).map(function(s) { return s.mood; });
  var moodCount = recentMoods.filter(function(m) { return m === mood; }).length;
  var recurring = moodCount >= 3;

  var historySummary = recentMoods.length > 0
    ? 'Recent moods (oldest to newest): ' + recentMoods.join(', ') + '.'
    : '';

  var contextNote = forwardContext ? 'What they are working on: ' + forwardContext + '.' : '';

  var recurringNote = recurring
    ? 'This mood (' + mood + ') has appeared ' + moodCount + ' times in the last 7 sessions.'
    : '';

  var followUpInstruction = recurring
    ? 'followUp: One specific, gentle question that goes deeper for someone who has felt ' + mood + ' repeatedly. More targeted than a first-time question. Example for Heavy: "what would one small release look like?"'
    : 'followUp: One open, gentle question for someone feeling ' + mood + ' for the first time this week. Example for Heavy: "what is weighing on you most right now?"';

  var prompt = 'You are a quiet inner voice — not an AI assistant. You acknowledge without judging. ' +
    'You never give advice. You speak in second person, present tense.\n\n' +
    'Context:\n' +
    '- Current mood: ' + mood + '\n' +
    '- What they wrote: "' + (feeling || 'nothing') + '"\n' +
    (historySummary ? '- ' + historySummary + '\n' : '') +
    (contextNote ? '- ' + contextNote + '\n' : '') +
    (recurringNote ? '- ' + recurringNote + '\n' : '') +
    '\nReturn a JSON object with exactly two string fields:\n' +
    '{\n' +
    '  "reflection": "One sentence. Second person, present tense. Acknowledge what is true right now. No advice, no questions, no productivity language.",\n' +
    '  "' + followUpInstruction + '"\n' +
    '}\n\n' +
    'Return ONLY valid JSON. No markdown fences. No explanation.';

  var genAI = new generativeai.GoogleGenerativeAI(apiKey);
  var model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  model.generateContent(prompt)
    .then(function(result) {
      var text = result.response.text().trim();
      // Strip markdown fences if Gemini wrapped it anyway
      text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
      var parsed = JSON.parse(text);
      res.json({
        reflection: parsed.reflection || null,
        followUp: parsed.followUp || null
      });
    })
    .catch(function(err) {
      console.error('rewindReflect Gemini error:', err.message);
      res.status(200).json({ reflection: null, followUp: null });
    });
});
