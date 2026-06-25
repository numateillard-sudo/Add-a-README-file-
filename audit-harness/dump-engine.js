// Dump the engine-computed values so we can verify all prose against them.
const { loadDoc } = require('./harness-lib');
const { window, errors } = loadDoc();
const E = (expr) => window.eval(expr);

function j(expr){ try { return JSON.parse(window.eval('JSON.stringify(' + expr + ')')); } catch(e){ return '<<ERR '+e.message+'>>'; } }

console.log('=== CONSOLE/JSDOM ERRORS AT LOAD ===');
console.log(errors.length ? errors.join('\n') : '(none)');

console.log('\n=== ASSETS ===');
console.log(JSON.stringify(j('ASSETS'), null, 1));

console.log('\n=== PRESETS ===');
const PRESETS = j('PRESETS');
console.log(JSON.stringify(PRESETS));
for (const k of Object.keys(PRESETS)) {
  const sum = Object.values(PRESETS[k]).reduce((a,b)=>a+b,0);
  console.log(`  ${k}: sum=${sum}`);
}

console.log('\n=== computeStats(PRESETS[k]) (raw engine) ===');
for (const k of ['prudent','equilibre','dynamique','offensif']) {
  const s = j(`computeStats(PRESETS['${k}'])`);
  console.log(`${k}: arith=${s.arith?.toFixed(3)} geo=${s.geo?.toFixed(3)} vol=${s.vol?.toFixed(3)} sharpe=${s.sharpe?.toFixed(4)} dd=${s.drawdown?.toFixed(3)}`);
}

console.log('\n=== PROFILE_STATS (derived, stored) ===');
console.log(JSON.stringify(j('PROFILE_STATS'), null, 1));

console.log('\n=== PROFILES return/vol/drawdown/sharpe (after IIFE overwrite) ===');
const PROFILES = j('PROFILES');
for (const k of Object.keys(PROFILES)) {
  const p = PROFILES[k];
  console.log(`${k}: return=${p.return} vol=${p.vol} drawdown=${p.drawdown} sharpe=${p.sharpe} horizon=${p.horizon}`);
}

console.log('\n=== PROFILES hardcoded literals (from source, for drift check) ===');
// (read separately below)

console.log('\n=== PROFILE_STRESSTEST (after overwrite) ===');
console.log(JSON.stringify(j('PROFILE_STRESSTEST')));

console.log('\n=== PROFILE_ALLOCATION_Q vs PRESETS-derived ===');
const ALLOC = j('PROFILE_ALLOCATION_Q');
for (const k of ['prudent','equilibre','dynamique','offensif']) {
  const p = PRESETS[k];
  const actions = p.world+p.europe+p.emerging;
  const bonds = p.fonds_euro+p.oblig;
  const gold = p.gold;
  const a = ALLOC[k];
  const ok = (a.actions===actions && a.bonds===bonds && a.gold===gold);
  console.log(`${k}: ALLOC=${JSON.stringify(a)} derived={actions:${actions},bonds:${bonds},gold:${gold}} ${ok?'OK':'*** MISMATCH ***'}`);
}

console.log('\n=== PROFILE_RATE_Q ===');
console.log(JSON.stringify(j('PROFILE_RATE_Q')));

console.log('\n=== SATELLITE_WEIGHT / per-line ===');
const SW = j('SATELLITE_WEIGHT');
const SAT = j('SATELLITE');
console.log('SATELLITE_WEIGHT=', JSON.stringify(SW), 'count=', SAT.length);
for (const k of Object.keys(SW)) console.log(`  ${k}: ${SW[k]}% / ${SAT.length} = ${(SW[k]/SAT.length).toFixed(4)} %/ligne`);

console.log('\n=== computeEnvelopeSplit for each preset ===');
for (const k of ['prudent','equilibre','dynamique','offensif']) {
  const s = j(`computeEnvelopeSplit(PRESETS['${k}'])`);
  console.log(`${k}: pea=${s.pea} cto=${s.cto} av=${s.av} mixed=${s.mixed} (sum=${s.pea+s.cto+s.av+s.mixed})`);
  console.log(`    tickersMixed=${JSON.stringify(s.tickersMixed)} tickersCto=${JSON.stringify(s.tickersCto)} tickersAv=${JSON.stringify(s.tickersAv)}`);
}

console.log('\n=== envCls per asset (pill class) ===');
const ASSETS = j('ASSETS');
for (const a of ASSETS) {
  const cls = E(`envCls(${JSON.stringify(a.env)})`);
  console.log(`  ${a.id} env='${a.env}' -> envCls='${cls}'`);
}
