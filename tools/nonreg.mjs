#!/usr/bin/env node
// nonreg.mjs — Non-regression freeze (prompt §8). Proves the integrated artifact
// reproduces the ORIGINAL tools' computations EXACTLY:
//   Comptes : analytics (opening, endBalance, odDaysTotal, avgIncome, monthEndBalances)
//             — original verbatim run  ==  built module getSignals().analytics
//   Invest  : fiscal engine (single, 40 000 €, 1 part) -> IR / TMI / taux effectif
//             — engine block from SOURCE  ==  engine block from MODULE  ==  frozen
//
// The fiscal engine is run from BOTH the original source and the shipped module
// (same text, executed independently), so equality proves the build never touched it.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { extractParts } from './lib/extract.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let pass = 0, fail = 0;
const eqNum = (a, b) => Math.abs(a - b) < 0.005;
const check = (name, ok, got, exp) => { if (ok) { pass++; console.log(`  ✅ ${name}` + (got !== undefined ? ` (${got})` : '')); } else { fail++; console.log(`  ❌ ${name} — got ${got}, expected ${exp}`); } };

// ── DOM-less shim to evaluate tool scripts (engine + analytics are pure) ──
function shimSandbox() {
  const store = {};
  const el = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, contains: () => false }, setAttribute() {}, appendChild() {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getContext: () => ({}) });
  const win = { console, setTimeout, clearTimeout, setInterval, clearInterval };
  win.window = win; win.globalThis = win;
  win.document = { addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el, head: el(), body: el(), documentElement: el(), dispatchEvent() {}, readyState: 'complete' };
  win.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  function Obs() { return { observe() {}, unobserve() {}, disconnect() {} }; }
  win.IntersectionObserver = Obs; win.ResizeObserver = Obs; win.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {} }); win.scrollTo = () => {};
  function Chart() { return { destroy() {}, update() {}, resize() {}, data: { datasets: [{}] } }; }
  Chart.defaults = { font: {}, plugins: { legend: { labels: {} }, tooltip: {} }, scales: { linear: { grid: {}, ticks: {}, border: {} }, category: { grid: {}, ticks: {}, border: {} } } };
  Chart.register = () => {}; Chart.getChart = () => null; win.Chart = Chart; win.addEventListener = () => {};
  return win;
}

console.log('NON-REGRESSION FREEZE (before == after)\n');

// ═══ A. COMPTES analytics ═══
console.log('[A] Comptes & Budget — analytics');
const FROZEN_CB = { opening: 1500.0, endBalance: 1521.21, odDaysTotal: 85, avgIncome: 2315.70, monthEndBalances: '1405.82,1305.55,1320.76,1637.81,1188.68,1521.21' };

// BEFORE: original tool script, verbatim, with its own bootstrap (recomputeAnalytics).
const cbJs = extractParts(R('src/TAME_Comptes_et_Budget.html'), {}).js;
const ctxBefore = vm.createContext(shimSandbox());
vm.runInContext(cbJs + '\n;globalThis.__A = (typeof DATA!=="undefined")?DATA.analytics:null;', ctxBefore, { filename: 'comptes-before.js' });
const before = ctxBefore.__A || {};
const beforeVals = { opening: before.opening, endBalance: before.endBalance, odDaysTotal: before.odDaysTotal, avgIncome: before.avgIncome, monthEndBalances: (before.monthEndBalances || []).join(',') };

// AFTER: built module. It now starts EMPTY (onboarding "import first"), so load
// the example (= the same baked statements) to compare like-for-like.
const ctxAfter = vm.createContext(shimSandbox());
vm.runInContext(R('build/modules/ecrin-cb.js'), ctxAfter, { filename: 'ecrin-cb.js' });
check('Comptes starts empty (ready=false) before import', ctxAfter.window.ECRIN_CB.getSignals().ready === false);
ctxAfter.window.ECRIN_CB.loadExample();
const after = ctxAfter.window.ECRIN_CB.getSignals().analytics;

for (const k of ['opening', 'endBalance', 'odDaysTotal', 'avgIncome']) {
  const b = beforeVals[k], a = after[k], f = FROZEN_CB[k];
  check(`${k}: before==after==frozen`, eqNum(b, a) && eqNum(a, f), `before ${b} / after ${a}`, f);
}
const aMeb = (after.monthEndBalances || []).join(',');
check('monthEndBalances: before==after==frozen', beforeVals.monthEndBalances === aMeb && aMeb === FROZEN_CB.monthEndBalances, aMeb, FROZEN_CB.monthEndBalances);

// ═══ B. INVEST fiscal engine ═══
console.log('\n[B] Investissement — fiscal engine (single, 40 000 €, 1 part)');
// Engine block: TRANCHES + constants + calcIR_brut/getTMI/decote/calcIR_net/getParts.
function extractEngine(src) {
  const m = src.match(/const TRANCHES = \[[\s\S]*?function getParts[\s\S]*?return Math\.max\(1, p\);\s*\n\}/);
  if (!m) throw new Error('engine block not found');
  return m[0];
}
function runEngine(block) {
  const fn = new vm.Script(block + '\n;({ getParts, calcIR_net, getTMI, calcIR_brut, decote })');
  const E = fn.runInContext(vm.createContext({ Math, parseFloat, Infinity }));
  const revenuNet = 40000, ri = Math.round(revenuNet * 0.9), parts = E.getParts(1, 0), isCouple = false; // 10% abattement -> 36000
  const ir = E.calcIR_net(ri, parts, isCouple);
  const tmi = E.getTMI(ri / parts);
  return { ri, parts, ir: Math.round(ir), tmi, teff: ir / revenuNet };
}
const engSource = extractEngine(R('src/TAME_Investissement.html'));
const engModule = extractEngine(R('build/modules/ecrin-inv.js'));
check('engine block byte-identical (source vs module)', engSource === engModule);
const fbefore = runEngine(engSource);
const fafter = runEngine(engModule);
const FROZEN_FISC = { ir: 3904, tmi: 0.30, teffPct: '9,8%' };
const pct = (x) => (x * 100).toFixed(1).replace('.', ',') + '%';
check('parts (getParts(1,0)) = 1', fbefore.parts === 1, fbefore.parts, 1);
check('IR net: before==after==frozen', fbefore.ir === fafter.ir && fafter.ir === FROZEN_FISC.ir, `before ${fbefore.ir} / after ${fafter.ir}`, FROZEN_FISC.ir);
check('TMI: before==after==frozen 30%', eqNum(fbefore.tmi, fafter.tmi) && eqNum(fafter.tmi, FROZEN_FISC.tmi), `${(fafter.tmi*100)}%`, '30%');
check('taux effectif: before==after==frozen ≈9,8%', pct(fbefore.teff) === pct(fafter.teff) && pct(fafter.teff) === FROZEN_FISC.teffPct, pct(fafter.teff), FROZEN_FISC.teffPct);

console.log(`\nNON-REGRESSION: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
