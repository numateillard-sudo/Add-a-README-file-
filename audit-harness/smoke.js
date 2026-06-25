// Interaction smoke test: exercise every interactive subsystem and assert
// zero console errors throughout. Also re-checks the legacy-migration still fires.
const { loadDoc } = require('./harness-lib');
let problems = [];

// --- A. legacy migration still resets on truly-old keys ---
(() => {
  const { window } = loadDoc();
  const res = window.eval(`
    STATE.investor.quiz.answers = { horizon:3, filet:2, concentration:1 }; // OLD format
    STATE.investor.quiz.completed = true;
    STATE.investor.profile = { key:'dynamique' };
    restoreUIFromState();
    JSON.stringify({ completed: STATE.investor.quiz.completed, profile: STATE.investor.profile, answers: STATE.investor.quiz.answers });
  `);
  const r = JSON.parse(res);
  if (r.completed !== false || r.profile !== null || Object.keys(r.answers).length !== 0)
    problems.push('legacy migration FAILED to reset old filet/concentration state: ' + res);
  else console.log('A. legacy migration still resets old format ✓');
})();

// --- B. full interaction sweep, zero console errors ---
(() => {
  const { window, errors } = loadDoc();
  const E = (x) => window.eval(x);
  function step(label, code) {
    const before = errors.length;
    try { E(code); } catch (e) { problems.push('THREW in [' + label + ']: ' + e.message); }
    if (errors.length > before) problems.push('console error in [' + label + ']: ' + errors.slice(before).join(' | '));
  }

  // Complete quiz -> offensif, render portfolio
  step('quiz+result', `
    STATE.investor.quiz.answers={horizon:4,tolerance:4,poids:4,experience:4,situation:4};
    STATE.investor.quiz.completed=true; quizShowResult();`);

  // Mode switches
  step('switchMode guided', `switchMode('guided')`);
  step('switchMode compare', `switchMode('compare')`);
  step('switchMode expert', `switchMode('expert')`);

  // Guided: pick each strategy + move sliders
  ['prudent','equilibre','dynamique','offensif'].forEach(s => {
    step('guided '+s, `STATE.investor.guided.strategy='${s}'; renderGuidedDetail(); updateGuidedSim();`);
  });
  step('guided sliders', `STATE.investor.guided.capital=10000; STATE.investor.guided.dca=300; STATE.investor.guided.horizon=25; updateGuidedSim();`);

  // Comparator: every A×B pair
  ['prudent','equilibre','dynamique','offensif'].forEach(a => ['prudent','equilibre','dynamique','offensif'].forEach(b => {
    step('compare '+a+'/'+b, `STATE.investor.compare.a='${a}'; STATE.investor.compare.b='${b}'; STATE.investor.compare.capital=5000; STATE.investor.compare.dca=200; STATE.investor.compare.horizon=20; updateCompareSim();`);
  }));

  // Planner: each profile, each goal, each lever
  ['prudent','equilibre','dynamique','offensif'].forEach(p => step('planner profile '+p, `applyProfile('${p}')`));
  ['retraite','fire','immo','personnel'].forEach(g => step('planner goal '+g, `applyGoalType('${g}')`));
  ['dca-plus','horizon-plus','capital-plus','profile-up'].forEach(l => step('planner lever '+l, `applyLever('${l}')`));
  step('planner inputs', `PLANNER_STATE.target=300000; PLANNER_STATE.horizon=30; updatePlannerView();`);

  // Envelope split render for each preset (exercises the F-001 path directly)
  ['prudent','equilibre','dynamique','offensif'].forEach(k => step('envSplit '+k, `renderEnvelopeSplit(PRESETS['${k}'])`));

  // Quiz reset
  step('quizReset', `quizReset()`);

  if (errors.length) problems.push('TOTAL console errors during sweep: ' + errors.length + ' :: ' + errors.join(' | '));
  else console.log('B. full interaction sweep: zero console errors ✓ (charts created: ' + E('window.__charts.length') + ')');
})();

console.log('\n================ SMOKE TEST ================');
if (problems.length) { console.log('PROBLEMS:'); problems.forEach(p => console.log('  ✗ ' + p)); process.exit(1); }
else { console.log('ALL SMOKE CHECKS GREEN ✓'); process.exit(0); }
