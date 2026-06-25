// F-005 proof: does a validly completed quiz survive a reload?
// We simulate completing the quiz, persist, then re-load a SECOND document
// pre-seeded with that exact localStorage payload, and check survival.
const { loadDoc } = require('./harness-lib');

// --- Pass 1: complete the quiz and capture the saved localStorage payload ---
const d1 = loadDoc();
const w1 = d1.window;
w1.eval(`
  STATE.investor.quiz.answers = { horizon:4, tolerance:4, poids:4, experience:4, situation:4 };
  STATE.investor.quiz.currentStep = 5;
  STATE.investor.quiz.completed = true;
  STATE.investor.answers = { horizon:4, tolerance:4, poids:4, experience:4, situation:4 };
  // mimic quizShowResult setting a profile
  var det = quizDetermineProfile(STATE.investor.quiz.answers);
  STATE.investor.profile = { key: det.key, ...PROFILES[det.key] };
  saveState();
`);
const payload = w1.localStorage.getItem('lplr-v5');
console.log('Pass1 saved profile key:', w1.eval('STATE.investor.profile && STATE.investor.profile.key'));
console.log('Pass1 quiz.completed:', w1.eval('STATE.investor.quiz.completed'));
console.log('Payload present:', !!payload);

// --- Pass 2: fresh document, pre-seed localStorage, then run the real init path ---
// We inject the payload by overriding localStorage BEFORE scripts run is hard;
// instead we load fresh, set localStorage, re-run loadState()+restoreUIFromState()
// exactly as init does, and observe.
const d2 = loadDoc();
const w2 = d2.window;
w2.localStorage.setItem('lplr-v5', payload);
const res = w2.eval(`
  // Replicate the real boot sequence after a reload:
  const restored = loadState();            // reads our seeded payload into STATE.investor
  const before = JSON.parse(JSON.stringify({
    answers: STATE.investor.quiz.answers,
    completed: STATE.investor.quiz.completed,
    profileKey: STATE.investor.profile && STATE.investor.profile.key
  }));
  restoreUIFromState();                     // the function under test
  const after = JSON.parse(JSON.stringify({
    answers: STATE.investor.quiz.answers,
    completed: STATE.investor.quiz.completed,
    profileKey: STATE.investor.profile && STATE.investor.profile.key
  }));
  JSON.stringify({ restored, before, after });
`);
const parsed = JSON.parse(res);
console.log('\n--- Pass2 (reload) ---');
console.log('loadState() returned (restored?):', parsed.restored);
console.log('BEFORE restoreUIFromState:', JSON.stringify(parsed.before));
console.log('AFTER  restoreUIFromState:', JSON.stringify(parsed.after));
const wiped = parsed.before.completed === true && parsed.after.completed === false;
console.log('\n>>> QUIZ WIPED ON RELOAD (couche restoreUIFromState):', wiped ? 'YES (BUG CONFIRMED)' : 'no');
console.log('NB : ce test isole restoreUIFromState (détection legacy F-005, qui ne doit PAS effacer à tort).');
console.log('    Le comportement utilisateur au rechargement (retour au questionnaire, voulu) est prouvé par render-behavior.js.');
