// Comprehensive verification harness for Le Petit Livre Rouge.
// Drives each profile through quiz completion and asserts every rendered DOM
// value == value recomputed from the canonical engine. Also checks: console
// errors, duplicate ids, env-enum coverage (producer==consumer), F-001 pill.
const { loadDoc } = require('./harness-lib');

let PASS = 0, FAIL = 0;
const fails = [];
function check(name, cond, detail) {
  if (cond) { PASS++; }
  else { FAIL++; fails.push(name + (detail ? '  [' + detail + ']' : '')); }
}

const { window, errors } = loadDoc();
const E = (expr) => window.eval(expr);
const J = (expr) => JSON.parse(window.eval('JSON.stringify(' + expr + ')'));
const doc = window.document;
const txt = (id) => { const el = doc.getElementById(id); return el ? el.textContent.trim() : '<<missing:' + id + '>>'; };

// ── 0. No load errors ──
check('no console/jsdom errors at load', errors.length === 0, errors.join(' | '));

// ── 1. No duplicate ids ──
(() => {
  const seen = {}, dups = [];
  doc.querySelectorAll('[id]').forEach(el => { const id = el.id; seen[id] = (seen[id]||0)+1; });
  for (const id in seen) if (seen[id] > 1) dups.push(id + '×' + seen[id]);
  check('no duplicate HTML ids', dups.length === 0, dups.join(', '));
})();

// ── 2. env enum coverage: every asset.env recognized (envCls != default-fallthrough unless truly CTO) ──
//    and computeEnvelopeSplit agrees with envCls family (PEA/AV/CTO/mixed).
(() => {
  const ASSETS = J('ASSETS');
  const KNOWN = { 'PEA':'env-pill-pea','AV':'env-pill-av','CTO':'env-pill-cto','CTO/AV':'env-pill-mixed','AV/CTO':'env-pill-mixed' };
  ASSETS.forEach(a => {
    const cls = E('envCls(' + JSON.stringify(a.env) + ')');
    const expected = KNOWN[a.env];
    check('envCls coherent for env="' + a.env + '" (' + a.id + ')',
      expected !== undefined && cls === expected,
      'got ' + cls + ' expected ' + expected + ' (unknown env not in {PEA,AV,CTO,CTO/AV,AV/CTO})');
  });
  // Cross-check: an asset flagged "mixed" by envCls must land in computeEnvelopeSplit.mixed (and vice-versa).
  ASSETS.forEach(a => {
    const w = {}; w[a.id] = 100;
    const split = J('computeEnvelopeSplit(' + JSON.stringify(w) + ')');
    const cls = E('envCls(' + JSON.stringify(a.env) + ')');
    const bucket = split.pea===100?'pea':split.av===100?'av':split.mixed===100?'mixed':split.cto===100?'cto':'?';
    const clsBucket = ({'env-pill-pea':'pea','env-pill-av':'av','env-pill-mixed':'mixed','env-pill-cto':'cto'})[cls];
    check('envCls bucket == computeEnvelopeSplit bucket for ' + a.id,
      bucket === clsBucket, a.id + ' env=' + a.env + ': split=' + bucket + ' vs envCls=' + clsBucket);
  });
})();

// ── 3. Per-profile: drive quiz, assert rendered == engine ──
const PROFILE_ANSWERS = {
  prudent:   {horizon:1,tolerance:1,poids:1,experience:1,situation:1},
  equilibre: {horizon:2,tolerance:2,poids:2,experience:2,situation:2},
  dynamique: {horizon:3,tolerance:3,poids:3,experience:3,situation:3},
  offensif:  {horizon:4,tolerance:4,poids:4,experience:4,situation:4},
};

function driveProfile(key) {
  const ans = PROFILE_ANSWERS[key];
  E(`
    STATE.investor.quiz.answers = ${JSON.stringify(ans)};
    STATE.investor.quiz.completed = true;
    STATE.investor.quiz.currentStep = 5;
  `);
  const detKey = E(`quizDetermineProfile(${JSON.stringify(ans)}).key`);
  check('answers->profile yields ' + key, detKey === key, 'got ' + detKey);
  E('quizShowResult()');
}

['prudent','equilibre','dynamique','offensif'].forEach(key => {
  driveProfile(key);
  const eng = J(`PROFILES['${key}']`);             // engine-overwritten return/vol/dd/sharpe/horizon
  const preset = J(`PRESETS['${key}']`);
  const split = J(`computeEnvelopeSplit(PRESETS['${key}'])`);

  // 3a. profile result card is the LIVE #pc-shell (the old #i-trait-* ids were removed).
  const shell = (doc.getElementById('pc-shell')||{}).innerHTML || '';
  check(`[${key}] #pc-shell shows return ${eng.return}`,   shell.includes(eng.return),   'return '+eng.return+' not in card');
  check(`[${key}] #pc-shell shows vol ${eng.vol}`,         shell.includes(eng.vol),      'vol '+eng.vol+' not in card');
  check(`[${key}] #pc-shell shows drawdown ${eng.drawdown}`, shell.includes(eng.drawdown), 'dd '+eng.drawdown+' not in card');
  check(`[${key}] #pc-shell shows sharpe ${eng.sharpe}`,   shell.includes(eng.sharpe),   'sharpe '+eng.sharpe+' not in card');
  check(`[${key}] #i-pf-return == engine`,      txt('i-pf-return')      === eng.return,   txt('i-pf-return')+' vs '+eng.return);
  check(`[${key}] #i-pf-vol == engine`,         txt('i-pf-vol')         === eng.vol,      txt('i-pf-vol')+' vs '+eng.vol);
  check(`[${key}] #i-pf-drawdown == engine`,    txt('i-pf-drawdown')    === eng.drawdown, txt('i-pf-drawdown')+' vs '+eng.drawdown);
  check(`[${key}] #i-pf-horizon == engine`,     txt('i-pf-horizon')     === eng.horizon,  txt('i-pf-horizon')+' vs '+eng.horizon);

  // 3b. macro bar == preset actions/stable(reel)
  const actions = preset.world+preset.europe+preset.emerging;
  const stable  = preset.fonds_euro+preset.oblig;
  const reel    = preset.gold;
  check(`[${key}] macro actions% == ${actions}`, txt('i-macro-actions-pct') === actions+'%', txt('i-macro-actions-pct'));
  check(`[${key}] macro stable% == ${stable}`,   txt('i-macro-stable-pct')  === stable+'%',  txt('i-macro-stable-pct'));
  check(`[${key}] macro reel% == ${reel}`,       txt('i-macro-reel-pct')    === reel+'%',    txt('i-macro-reel-pct'));

  // 3c. env-split chips contain the computed pea/cto/av/mixed integers with correct labels
  const chipsHtml = (doc.getElementById('i-env-split-chips')||{}).innerHTML || '';
  if (split.pea>0)   check(`[${key}] env-split PEA ${Math.round(split.pea)}%`,   chipsHtml.includes('split-pea') && chipsHtml.includes(Math.round(split.pea)+'%'), chipsHtml);
  if (split.mixed>0) check(`[${key}] env-split mixed ${Math.round(split.mixed)}% labeled "CTO ou AV"`, chipsHtml.includes('split-mixed') && chipsHtml.includes('CTO ou AV'), chipsHtml);
  check(`[${key}] env-split has NO pure-CTO chip (oblig+gold are mixed)`, split.cto===0 ? !chipsHtml.includes('split-cto') : true, 'cto='+split.cto);

  // 3d. donut legend rows: one per non-zero category, pct matches
  const legHtml = (doc.getElementById('i-donut-legend')||{}).innerHTML || '';
  const catTotals = {};
  Object.entries(preset).forEach(([id,w])=>{ if(w>0){ const a=J(`ASSETS.find(a=>a.id==='${id}')`); catTotals[a.cat]=(catTotals[a.cat]||0)+w; } });
  Object.entries(catTotals).forEach(([cat,v])=>{
    check(`[${key}] donut legend ${cat} ${v}%`, legHtml.includes(v+'%'), 'legend missing '+v+'% for '+cat);
  });

  // 3e. F-001 EVIDENCE: obligations row env-tag in #i-allocation-detail (oblig weight>0 for all profiles)
  const allocHtml = (doc.getElementById('i-allocation-detail')||{}).innerHTML || '';
  // find the IEAG (oblig) asset-line env-tag class + text
  const m = allocHtml.match(/env-tag (env-pill-\w+)">([^<]*)</g) || [];
  // locate the one near 'IEAG'
  const ieagIdx = allocHtml.indexOf('IEAG');
  let obligTag = null;
  if (ieagIdx >= 0) {
    const after = allocHtml.slice(ieagIdx, ieagIdx + 400);
    const mm = after.match(/env-tag (env-pill-\w+)">([^<]*)</);
    if (mm) obligTag = { cls: mm[1], text: mm[2] };
  }
  // The split files oblig as MIXED → the per-asset pill SHOULD also be mixed and the text should match gold's ordering.
  check(`[${key}] obligations pill class == env-pill-mixed (matches env-split "CTO ou AV")`,
    obligTag && obligTag.cls === 'env-pill-mixed',
    obligTag ? ('cls='+obligTag.cls+' text="'+obligTag.text+'"') : 'IEAG row not found');
  check(`[${key}] obligations pill text == "CTO/AV" (same convention as gold)`,
    obligTag && obligTag.text === 'CTO/AV',
    obligTag ? ('text="'+obligTag.text+'"') : 'IEAG row not found');
});

// ── 4. Satellite weight only for dynamique/offensif, ≤2%/line ──
(() => {
  const SW = J('SATELLITE_WEIGHT'); const n = E('SATELLITE.length');
  ['prudent','equilibre'].forEach(k => check(`satellite hidden for ${k}`, SW[k] === undefined, JSON.stringify(SW)));
  ['dynamique','offensif'].forEach(k => check(`satellite ${k} ≤2%/line`, (SW[k]/n) <= 2, (SW[k]/n)+''));
})();

// ── Summary ──
console.log('================ VERIFICATION HARNESS ================');
console.log('PASS: ' + PASS + '   FAIL: ' + FAIL);
if (fails.length) { console.log('\n--- FAILURES ---'); fails.forEach(f => console.log('  ✗ ' + f)); }
else console.log('ALL CHECKS GREEN ✓');
console.log('======================================================');
process.exit(FAIL ? 1 : 0);
