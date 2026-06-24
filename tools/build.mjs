#!/usr/bin/env node
// build.mjs — Turn each standalone finance tool into an isolated, mountable
// module (window.ECRIN_CB / window.ECRIN_INV) that the socle drives.
//
// Each module:
//   * keeps the tool's logic VERBATIM (calculations untouched);
//   * is wrapped in ONE IIFE so its ~70–200 globals never leak/collide;
//   * ships its stylesheet scoped to a root container (#cb-root / #inv-root)
//     with design tokens remapped to the socle (Geist, sand, gold, rounded);
//   * exposes exactly { mount(el), unmount(), getSignals() } (+ Invest's inline
//     onclick handlers re-routed onto the same object — no stray globals);
//   * renders only on mount() (define-time stays DOM-free), so the lone
//     eval-time listeners register once and never duplicate across re-mounts.
//
// Output: build/modules/ecrin-cb.js, build/modules/ecrin-inv.js

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractParts } from './lib/extract.mjs';
import { scopeCss } from './lib/scope-css.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'build', 'modules');
fs.mkdirSync(OUT, { recursive: true });

// Neutralize "</script" so the embedded module survives DOMParser re-parsing of
// the template (the app's scripts are re-tokenized after JSON.parse). "<\/script"
// is identical in JS/JSON but the HTML tokenizer no longer sees a closing tag.
const scriptSafe = (s) => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

// ───────────────────────── COMPTES & BUDGET ─────────────────────────

const CB_TOKEN_OVERRIDES = `
/* ===== ECRIN: socle design tokens (Geist · sable · or · cartes arrondies) ===== */
#cb-root{
  --sans:'Geist',system-ui,-apple-system,sans-serif;
  --display:'Geist','Newsreader',Georgia,serif;
  --paper:#f4f1ea; --card:#ffffff; --card-2:#faf7f0;
  --ink:#211d17; --ink-2:#6e675b; --ink-3:#948c7e;
  --line:rgba(30,26,18,.12); --line-2:rgba(30,26,18,.07);
  --green:#b3892f; --green-2:#9c7327; --green-soft:#f3ecd9;
  --gold:#b3892f; --gold-soft:#f3ecd9;
  --r-card:16px; --r-ctrl:12px;
  font-family:'Geist',system-ui,sans-serif;
  background:transparent; color:var(--ink);
}
#cb-root .topbar{ display:none; }            /* socle header carries the title; removes "Julien" */
#cb-root .tabs{ top:-1px; background:#f4f1ea; }
#cb-root .foot{ opacity:.7; }
`;

function buildComptes() {
  const html = fs.readFileSync(path.join(SRC, 'TAME_Comptes_et_Budget.html'), 'utf8');
  const parts = extractParts(html, { emptyIds: ['txn-cards'] });
  const { css, js } = parts;
  // Drop the standalone persona string entirely (topbar is also hidden via CSS).
  const markup = parts.markup.replace(/Julien Finance Dashboard/g, 'Comptes &amp; Budget');

  const scoped = scopeCss(css, '#cb-root', 'cb-') + CB_TOKEN_OVERRIDES;

  // --- Surgical JS transforms (logic preserved) ---
  let code = js;

  // 1) Drop the only window leak (window.DATA is written but never read).
  code = code.replace(/window\.DATA\s*=\s*DATA\s*;/, '/* ECRIN: window.DATA leak removed */');

  // 2) Unify chart typography with the socle (Hanken Grotesk -> Geist) without
  //    touching the rest of the shared Chart.defaults mutation.
  code = code.replace(/'"Hanken Grotesk",system-ui,sans-serif'/g, "'Geist,system-ui,sans-serif'");

  // 3) Split the end-of-body bootstrap IIFE: data prep runs ONCE at define
  //    (DOM-safe, populates analytics for signals); render+wire becomes the
  //    per-mount entrypoint __cbRender().
  const BOOT_OPEN = '(function(){\n  try{ loadStoredStatements();';
  const idx = code.indexOf(BOOT_OPEN);
  if (idx < 0) throw new Error('Comptes: bootstrap IIFE anchor not found');
  const before = code.slice(0, idx);
  const CB_BOOT_REPLACEMENT = `
/* ===== ECRIN: prep once at define (no DOM needed) ===== */
(function(){
  try{ loadStoredStatements(); }catch(e){ console.error('load imports:',e); }
  try{ allTxns().forEach(function(x){ KEY2DEF[keyOf(x.m,x.t)]=x.t.category; }); }catch(e){}
  try{ computeSavings(); }catch(e){}
  try{ recomputeAnalytics(); }catch(e){}
  try{ applyGoalsOverride(); }catch(e){}
})();
/* ===== ECRIN: render + wire on every mount ===== */
function __cbRender(){
  const fns=[
    wireTabs,
    ()=>renderMonthPills('ov-month-pills',LS.month,renderOverview),
    renderOverview,
    renderTxnMonthPills, renderTxnAll, wireImport, wireTxnControls,
    renderMvM,
    renderBudget, renderInsights
  ];
  fns.forEach(fn=>{ try{ fn(); }catch(e){ console.error('CB render '+(fn.name||'')+':',e); } });
  try{ const tm=ls_get(LS.tmonth,'all'); if(tm){ txnMonthFilter=tm; renderTxnMonthPills(); renderTxnAll(); } }catch(e){}
}
function __cbCleanup(){
  try{ if(typeof donutChart!=='undefined' && donutChart){ donutChart.destroy(); donutChart=null; } }catch(e){}
  try{ if(typeof budgetDonutChart!=='undefined' && budgetDonutChart){ budgetDonutChart.destroy(); budgetDonutChart=null; } }catch(e){}
}
`;
  code = before + CB_BOOT_REPLACEMENT;

  const CB_SIGNALS = `
  function eur2(n){ return Math.round(n*100)/100; }
  try{ recomputeAnalytics(); }catch(e){}
  var cm = currentMonth;
  var bm = (DATA.analytics && DATA.analytics.balByMonth && DATA.analytics.balByMonth[cm]) || {};
  var soldeMois = (bm.end!=null) ? bm.end : (DATA.analytics? DATA.analytics.endBalance : null);
  var decouvertJours = (bm.odDays!=null) ? bm.odDays : 0;
  var trough = (bm.trough!=null) ? bm.trough : null;
  // Budget variable restant (méthode renderBudget : moyenne 6 mois)
  var avgInc=0, fixesReal=0;
  try{
    avgInc = MONTHS.reduce(function(s,m){ return s+monthIncome(m); },0)/MONTHS.length;
    fixesReal = FIXED_CATS.reduce(function(s,cat){
      return s + MONTHS.reduce(function(a,m){ return a+catSpend(m,cat); },0)/MONTHS.length;
    },0);
  }catch(e){}
  var goalBase = (DATA.goals && DATA.goals.baseMonthly) || avgInc;
  var sPct = (DATA.goals && DATA.goals.savingsPct) || 0, iPct = (DATA.goals && DATA.goals.investPct) || 0;
  var savingsGoal = eur2(goalBase*(sPct+iPct)/100);
  var budgetRestant = eur2((avgInc - fixesReal) - savingsGoal);
  // Prochain prélèvement (charges fixes négatives, prochaine occurrence après aujourd'hui)
  var prochain = null;
  try{
    var today = new Date(); today.setHours(0,0,0,0);
    var txns = (DATA.months[cm] && DATA.months[cm].transactions) || [];
    var fixed = txns.filter(function(t){ return t.amount<0 && FIXED_CATS.indexOf(effCat(cm,t))>=0; })
      .map(function(t){
        var day = parseInt(String(t.date).slice(8,10),10) || 1;
        var label = (typeof simplifyJS==='function'? simplifyJS(t.raw): (t.disp||t.raw||'Prélèvement'));
        return { label:label, amount:t.amount, day:day };
      });
    // dédup par libellé, garder le plus gros
    var byLabel={}; fixed.forEach(function(f){ if(!byLabel[f.label] || Math.abs(f.amount)>Math.abs(byLabel[f.label].amount)) byLabel[f.label]=f; });
    var cands = Object.keys(byLabel).map(function(k){ return byLabel[k]; });
    var soonest=null, soonestDate=null;
    cands.forEach(function(f){
      var d = new Date(today.getFullYear(), today.getMonth(), f.day);
      if (d < today) d = new Date(today.getFullYear(), today.getMonth()+1, f.day);
      if (!soonestDate || d < soonestDate){ soonestDate=d; soonest=f; }
    });
    if (soonest){
      var iso = soonestDate.getFullYear()+'-'+String(soonestDate.getMonth()+1).padStart(2,'0')+'-'+String(soonestDate.getDate()).padStart(2,'0');
      prochain = { label:soonest.label, amount:soonest.amount, date:iso };
    }
  }catch(e){}
  var A = DATA.analytics || {};
  return {
    soldeMois: soldeMois,
    decouvertJours: decouvertJours,
    trough: trough,
    budgetRestant: budgetRestant,
    prochainPrelevement: prochain,
    devise: (DATA.symbol || '€'),
    analytics: { opening:A.opening, endBalance:A.endBalance, odDaysTotal:A.odDaysTotal, avgIncome:A.avgIncome, monthEndBalances:A.monthEndBalances }
  };`;

  const module = assembleModule({
    key: 'cb', api: 'ECRIN_CB',
    css: scoped, markup, code,
    mountCalls: `__cbRender();`,
    cleanup: `try{ __cbCleanup(); }catch(e){}`,
    signals: CB_SIGNALS,
    extraExports: '',
  });
  fs.writeFileSync(path.join(OUT, 'ecrin-cb.js'), module);
  return { bytesCss: scoped.length, bytesMarkup: markup.length, bytesJs: code.length, bytesModule: module.length };
}

// ───────────────────────── INVESTISSEMENT ─────────────────────────

const INV_HANDLERS = ['navTo','showBilan','closeBilan','downloadBilanHTML','handleBilanCopy','handleBilanGmail','handleBilanPrint','resetAllData','switchMode'];

const INV_TOKEN_OVERRIDES = `
/* ===== ECRIN: socle design tokens (Geist · sable · or · cartes arrondies) ===== */
#inv-root{
  --sans:'Geist',system-ui,-apple-system,sans-serif;
  --serif:'Geist','Fraunces',Georgia,serif;
  --bg:transparent; --bg-section:#efe9de; --bg-deep:#e8dfc9;
  --paper:#ffffff; --paper-soft:#faf7f0;
  --gold:#b3892f; --gold-dark:#9c7327; --gold-pale:#f3ecd9;
  --ink:#211d17; --ink-soft:#6e675b;
  font-family:'Geist',system-ui,sans-serif;
  background:transparent; color:var(--ink);
}
#inv-root .site-header{ display:none; }      /* socle header carries the title */
#inv-root .stepper-bar{ top:-1px; }
`;

function buildInvest() {
  const html = fs.readFileSync(path.join(SRC, 'TAME_Investissement.html'), 'utf8');
  const { css, markup: rawMarkup, js } = extractParts(html, {});

  const scoped = scopeCss(css, '#inv-root', 'inv-') + INV_TOKEN_OVERRIDES;

  // Re-route inline onclick handlers onto ECRIN_INV.* so no stray globals leak.
  const handlerRe = new RegExp('(?:window\\.)?\\b(' + INV_HANDLERS.join('|') + ')\\s*\\(', 'g');
  const markup = rawMarkup.replace(handlerRe, 'ECRIN_INV.$1(');

  // JS: localize the window-defined functions (so they can be exported on
  // ECRIN_INV and never touch the global scope) and route the two internal
  // flags onto a module-private object. Everything else stays verbatim.
  let code = js;
  const INV_LOCAL_FNS = ['downloadBilanHTML', 'handleBilanCopy', 'handleBilanGmail', 'handleBilanPrint', 'handleBilanSend'];
  code = code.replace(new RegExp('window\\.(' + INV_LOCAL_FNS.join('|') + ')\\b', 'g'), '$1');
  code = code.replace(/window\.(__bootstrapped|__bilanShowFisc)\b/g, '__ecrinFlags.$1');
  code = 'var __ecrinFlags = {};\nvar ' + INV_LOCAL_FNS.join(', ') + ';\n' + code;

  // Export the inline handlers + API on the single global object.
  const exportHandlers = INV_HANDLERS.map((n) =>
    `  try{ ECRIN_INV.${n} = ${n}; }catch(e){}`).join('\n');

  const INV_CLEANUP = `
  try{ if(typeof budgetDonut!=='undefined' && budgetDonut){ budgetDonut.destroy(); } budgetDonut=null; }catch(e){}
  try{ if(typeof investorDonut!=='undefined' && investorDonut){ investorDonut.destroy(); } investorDonut=null; }catch(e){}
  try{ if(typeof guidedChart!=='undefined' && guidedChart){ guidedChart.destroy(); } guidedChart=null; }catch(e){}
  try{ if(typeof expertChart!=='undefined' && expertChart){ expertChart.destroy(); } expertChart=null; }catch(e){}
  try{ if(typeof compareChart!=='undefined' && compareChart){ compareChart.destroy(); } compareChart=null; }catch(e){}
  try{ if(typeof plannerTrajChart!=='undefined' && plannerTrajChart){ plannerTrajChart.destroy(); } plannerTrajChart=null; }catch(e){}`;

  // Mount = replay exactly what the standalone page runs on DOMContentLoaded,
  // in registration order: initFearPrelude -> init -> initPlannerWiring -> initV19.
  const INV_MOUNT = `
  try{ if(typeof initFearPrelude==='function') initFearPrelude(); }catch(e){ console.error('INV initFearPrelude',e); }
  try{ if(typeof init==='function') init(); }catch(e){ console.error('INV init',e); }
  try{ if(typeof initPlannerWiring==='function') initPlannerWiring(); }catch(e){ console.error('INV initPlannerWiring',e); }
  try{ if(typeof setupPlanStepper==='function') setupPlanStepper(); }catch(e){}
  try{ if(typeof initV19==='function') setTimeout(function(){ try{ initV19(); }catch(e){} }, 80); }catch(e){}`;

  const INV_SIGNALS = `
  var prof = (STATE && STATE.investor) ? STATE.investor.profile : null;
  var key = prof && prof.key ? prof.key : null;
  var alloc = (key && typeof PROFILE_ALLOCATION_Q!=='undefined') ? PROFILE_ALLOCATION_Q[key] : null;
  var label = null;
  if (prof) label = prof.name || prof.label || prof.title || (key ? key.charAt(0).toUpperCase()+key.slice(1) : null);
  return {
    profil: label,
    profilKey: key,
    allocationCible: alloc ? { actions: alloc.actions, obligations: alloc.bonds, or: alloc.gold } : null,
    aProfil: !!prof
  };`;

  const module = assembleModule({
    key: 'inv', api: 'ECRIN_INV',
    css: scoped, markup, code,
    mountCalls: INV_MOUNT,
    cleanup: INV_CLEANUP,
    signals: INV_SIGNALS,
    extraExports: exportHandlers,
  });
  fs.writeFileSync(path.join(OUT, 'ecrin-inv.js'), module);
  return { bytesCss: scoped.length, bytesMarkup: markup.length, bytesJs: code.length, bytesModule: module.length };
}

// ───────────────────────── module assembler ─────────────────────────

function assembleModule({ key, api, css, markup, code, mountCalls, cleanup, signals, extraExports }) {
  const body = `(function(){
  "use strict";
  if (window.${api} && window.${api}.__ready) return;
  var ${api} = (window.${api} = window.${api} || {});

  var __cssDone = false;
  function __injectCss(){
    if (__cssDone) return;
    var s = document.createElement('style');
    s.setAttribute('data-ecrin', '${key}');
    s.textContent = ${JSON.stringify(css)};
    (document.head || document.documentElement).appendChild(s);
    __cssDone = true;
  }

  var __MARKUP = ${JSON.stringify(markup)};

  /* ============================================================
     VERBATIM tool logic (wrapped, scoped — calculations untouched)
     ============================================================ */
${code}
  /* ===================== /verbatim tool logic ===================== */

  function __ecrinMount(el){
    try{
      __injectCss();
      el.innerHTML = __MARKUP;
${indent(mountCalls, 6)}
    }catch(e){ console.error('${api} mount:', e); }
  }
  function __ecrinUnmount(){
    try{
${indent(cleanup, 6)}
    }catch(e){ console.error('${api} unmount:', e); }
  }
  function __ecrinSignals(){
    try{
${indent(signals, 6)}
    }catch(e){ console.error('${api} getSignals:', e); return null; }
  }

  ${api}.mount = __ecrinMount;
  ${api}.unmount = __ecrinUnmount;
  ${api}.getSignals = __ecrinSignals;
${extraExports}
  ${api}.__ready = true;
})();`;
  return scriptSafe(body);
}

function indent(s, n) {
  const pad = ' '.repeat(n);
  return s.split('\n').map((l) => (l ? pad + l : l)).join('\n');
}

// ───────────────────────── run ─────────────────────────

const cb = buildComptes();
console.log('ecrin-cb.js :', JSON.stringify(cb));
const inv = buildInvest();
console.log('ecrin-inv.js:', JSON.stringify(inv));
console.log('Modules written to build/modules/');
