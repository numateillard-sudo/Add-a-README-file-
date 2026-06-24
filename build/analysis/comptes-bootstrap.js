/* ============================================================================
 * comptes-bootstrap.js  — VERBATIM extract from TAME_Comptes_et_Budget.html
 * Top-level init/bootstrap: the master render orchestrators + tab wiring +
 * the end-of-script IIFE that kicks everything off on load.
 * Source line numbers are noted in comments; code below is copied exactly.
 * ========================================================================== */

/* ---- line 752: master OVERVIEW render orchestrator ---- */
function renderOverview(){ renderHealth(); renderKPI(); renderDonut(); renderTransfers(); renderSavings(); renderOvInsights(); }

/* ---- lines 950-958: rerenderAll() — full re-render of every tab (used after CSV import) ---- */
function rerenderAll(){
  allTxns().forEach(function(x){ KEY2DEF[keyOf(x.m,x.t)]=x.t.category; });
  if(DATA.monthOrder.indexOf(currentMonth)<0) currentMonth=DATA.monthOrder[DATA.monthOrder.length-1];
  computeSavings();
  renderMonthPills('ov-month-pills',LS.month,renderOverview); renderOverview();
  renderTxnMonthPills(); renderTxnAll();
  renderMvM(); renderBudget(); renderInsights();
  document.dispatchEvent(new CustomEvent('dataChanged'));
}

/* ---- line 1035: refreshDependents() — recompute + re-render dependents after an edit ---- */
function refreshDependents(){ computeSavings(); renderOverview(); renderBudget(); renderInsights(); renderMvM(); document.dispatchEvent(new CustomEvent('dataChanged')); }

/* ---- line 1027: renderTxnAll() — Transactions tab master render ---- */
function renderTxnAll(){ txnLimit=60; renderTxnCats(); updateClearChip(); renderTxnCards(); }

/* ---- line 1253: wireTabs() — tab switching (click handlers on .tab buttons) ---- */
function wireTabs(){ document.querySelectorAll('.tab').forEach(t=>{ t.onclick=()=>{ document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active')); document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active')); t.classList.add('active'); const p=document.getElementById(t.dataset.tab); if(p) p.classList.add('active'); const id=t.dataset.tab; try{ if(id==='budget') renderBudget(); else if(id==='mvm'){ renderMvM(); } else if(id==='overview') renderDonut(); }catch(e){ console.warn('tab render',e); } }; }); }

/* ---- lines 1255-1275: THE BOOTSTRAP IIFE (runs immediately at end of <script>; NO DOMContentLoaded) ---- */
(function(){
  try{ loadStoredStatements(); }catch(e){ console.error('load imports:',e); }
  allTxns().forEach(function(x){ KEY2DEF[keyOf(x.m,x.t)]=x.t.category; });
  computeSavings();
  recomputeAnalytics();
  applyGoalsOverride();
  const fns=[
    wireTabs,
    ()=>renderMonthPills('ov-month-pills',LS.month,renderOverview),
    renderOverview,
    renderTxnMonthPills, renderTxnAll, wireImport, wireTxnControls,
    renderMvM,
    renderBudget, renderInsights
  ];
  fns.forEach(fn=>{ try{ fn(); }catch(e){ console.error('Init error in '+fn.name+':',e); } });
  // restore txn month filter
  try{ const tm=ls_get(LS.tmonth,'all'); if(tm){ txnMonthFilter=tm; renderTxnMonthPills(); renderTxnAll(); } }catch(e){}
  // self-check
  ['overview','transactions','mvm','budget','insights'].forEach(id=>{ if(!document.getElementById(id)) console.error('Missing panel:',id); });
  if(!document.getElementById('import-csv-btn')) console.error('Missing import button');
})();
