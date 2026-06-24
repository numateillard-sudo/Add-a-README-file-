#!/usr/bin/env node
// smoke.mjs — Evaluate each module in a minimal DOM shim and call getSignals().
// Catches define-time errors and validates the read-only signals API + the
// Comptes non-regression anchors, without a browser.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeSandbox() {
  const store = {};
  const el = () => ({
    style: {}, dataset: {}, classList: { add(){}, remove(){}, contains(){ return false; } },
    setAttribute(){}, removeAttribute(){}, appendChild(){}, removeChild(){}, remove(){},
    addEventListener(){}, removeEventListener(){}, querySelector(){ return null; }, querySelectorAll(){ return []; },
    getContext(){ return {}; }, set innerHTML(_v){}, get innerHTML(){ return ''; }, set textContent(_v){}, get textContent(){ return ''; },
    insertBefore(){}, cloneNode(){ return el(); }, closest(){ return null; }, focus(){}, getBoundingClientRect(){ return { width:0,height:0,top:0,left:0 }; },
  });
  const documentShim = {
    addEventListener(){}, removeEventListener(){}, dispatchEvent(){},
    createElement(){ return el(); }, createElementNS(){ return el(); },
    getElementById(){ return null; }, querySelector(){ return null; }, querySelectorAll(){ return []; },
    head: el(), body: el(), documentElement: el(), readyState: 'complete',
  };
  const win = {
    location: { href: '', reload(){}, hash: '' }, addEventListener(){}, removeEventListener(){},
    matchMedia(){ return { matches:false, addEventListener(){}, addListener(){} }; },
    requestAnimationFrame(cb){ return setTimeout(()=>cb(Date.now?0:0), 0); }, cancelAnimationFrame(){},
    scrollTo(){}, getComputedStyle(){ return { getPropertyValue(){ return ''; } }; },
    innerWidth: 1200, innerHeight: 800, devicePixelRatio: 1, navigator: { userAgent: 'node' },
    setTimeout, clearTimeout, setInterval, clearInterval, console,
  };
  function Obs(){ return { observe(){}, unobserve(){}, disconnect(){}, takeRecords(){ return []; } }; }
  win.IntersectionObserver = Obs; win.ResizeObserver = Obs; win.MutationObserver = Obs;
  function Chart(){ return { destroy(){}, update(){}, resize(){}, data:{ datasets:[{}] } }; }
  Chart.defaults = { font:{}, plugins:{ legend:{ labels:{} }, tooltip:{} }, scales:{ linear:{ grid:{}, ticks:{}, border:{} }, category:{ grid:{}, ticks:{}, border:{} } } };
  Chart.register = () => {}; Chart.getChart = () => null;
  const ls = { getItem: (k)=> (k in store ? store[k] : null), setItem: (k,v)=>{ store[k]=String(v); }, removeItem: (k)=>{ delete store[k]; }, clear: ()=>{ for (const k in store) delete store[k]; } };

  win.window = win; win.document = documentShim; win.localStorage = ls; win.Chart = Chart;
  win.globalThis = win;
  return { sandbox: win, store };
}

function run(name, file, signalCheck) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const { sandbox } = makeSandbox();
  const ctx = vm.createContext(sandbox);
  let ok = true;
  try {
    vm.runInContext(code, ctx, { filename: file });
  } catch (e) {
    console.log(`  ${name}: DEFINE ERROR -> ${e.message}`); return false;
  }
  const api = sandbox.window[name.includes('CB') ? 'ECRIN_CB' : 'ECRIN_INV'];
  if (!api || typeof api.getSignals !== 'function') { console.log(`  ${name}: API missing`); return false; }
  let sig;
  try { sig = api.getSignals(); } catch (e) { console.log(`  ${name}: getSignals ERROR -> ${e.message}`); return false; }
  console.log(`  ${name}: defines OK; getSignals() ->`, JSON.stringify(sig));
  if (signalCheck) ok = signalCheck(sig) && ok;
  // confirm mount/unmount are at least callable against a shim element
  try { api.mount(sandbox.document.createElement()); api.unmount(); } catch (e) { console.log(`  ${name}: mount/unmount threw -> ${e.message}`); }
  return ok;
}

console.log('SMOKE TEST — modules in DOM shim');
let allOk = true;

allOk = run('ECRIN_CB', 'build/modules/ecrin-cb.js', (s) => {
  const a = s.analytics || {};
  // NOTE: the prompt lists avgIncome=2345.45, but that is the STALE STORED literal
  // in DATA.analytics/DATA.goals.baseMonthly. The original tool runs
  // recomputeAnalytics() at bootstrap, which OVERWRITES it with the live value
  // 2315.70 (Σ monthIncome / 6). Verified against the UNMODIFIED original script.
  // Faithful non-regression therefore asserts the live value, identical pre/post.
  const checks = [
    ['opening', a.opening, 1500.0], ['endBalance', a.endBalance, 1521.21],
    ['odDaysTotal', a.odDaysTotal, 85], ['avgIncome (live recompute)', a.avgIncome, 2315.70],
    ['soldeMois', s.soldeMois, 1521.21],
  ];
  let good = true;
  for (const [k, got, exp] of checks) { const ok = Math.abs((got??NaN) - exp) < 0.005; if (!ok) good = false; console.log(`    anchor ${k}: ${got} ${ok ? '==' : '!='} ${exp} ${ok?'✅':'❌'}`); }
  const meb = (a.monthEndBalances || []).join(',');
  const expMeb = '1405.82,1305.55,1320.76,1637.81,1188.68,1521.21';
  const mebOk = meb === expMeb; if (!mebOk) good = false;
  console.log(`    anchor monthEndBalances: [${meb}] ${mebOk?'✅':'❌'}`);
  return good;
}) && allOk;

allOk = run('ECRIN_INV', 'build/modules/ecrin-inv.js', (s) => {
  const ok = 'profil' in s && 'allocationCible' in s;
  console.log(`    invest signals shape (profil/allocationCible present): ${ok ? '✅' : '❌'}`);
  return ok;
}) && allOk;

console.log(allOk ? '\nSMOKE: PASS' : '\nSMOKE: (some checks failed)');
process.exit(allOk ? 0 : 1);
