/* ============================================================================
 * comptes-signals.js — VERBATIM extract from TAME_Comptes_et_Budget.html
 * Functions/expressions to compute "signals" WITHOUT the UI.
 * Copied exactly from source; line numbers noted per block.
 *
 * DEPENDENCIES (all module-level, defined earlier in the source):
 *   DATA, MONTHS=DATA.monthOrder, SPEND=DATA.spendOrder, currentMonth,
 *   INCOME_CATS, TRANSFER_CATS, REFUND_CATS, budgets, FIXED_CATS,
 *   effCat(m,t), effStatus(m,t), keyOf(m,t), round2(x), monthLabel(k).
 * ========================================================================== */

/* === category sets + helpers used by every signal (lines 625-628, 651-654) === */
const INCOME_CATS = new Set(DATA.incomeCats.filter(c=>c!=='Remboursements'));
const REFUND_CATS = new Set(['Remboursements']);
const TRANSFER_CATS = new Set(DATA.transferCats);
const CATCOLOR = {}; DATA.categories.forEach(c=>CATCOLOR[c.name]=c.color); CATCOLOR['Autres']='#c6c0b4';
function keyOf(m,t){ return t.uid || (yearOf(t)+'|'+m+'|'+t.raw+'|'+t.amount.toFixed(2)); }
function effCat(m,t){ const k=keyOf(m,t); return categoryByKey[k]||t.category; }
function effStatus(m,t){ const k=keyOf(m,t); return statusByKey[k]||t.status||''; }
function allTxns(){ const out=[]; MONTHS.forEach(m=>DATA.months[m].transactions.forEach(t=>out.push({m,t}))); return out; }

/* === per-month money aggregates (lines 656-662) === */
function monthIncome(m){ let s=0; DATA.months[m].transactions.forEach(t=>{ if(INCOME_CATS.has(effCat(m,t))&&t.amount>0) s+=t.amount; }); return s; }
function monthSpend(m){ let s=0; DATA.months[m].transactions.forEach(t=>{ const c=effCat(m,t); if(!INCOME_CATS.has(c)&&!TRANSFER_CATS.has(c)&&t.amount<0) s+=-t.amount; }); return s; }
function monthTransfer(m){ let s=0; DATA.months[m].transactions.forEach(t=>{ if(TRANSFER_CATS.has(effCat(m,t))&&t.amount<0) s+=-t.amount; }); return s; }
function monthRefund(m){ let s=0; DATA.months[m].transactions.forEach(t=>{ if(REFUND_CATS.has(effCat(m,t))&&t.amount>0) s+=t.amount; }); return s; }
function monthInflow(m){ return monthIncome(m)+monthRefund(m); } /* encaissements hors virements */
function monthNet(m){ return monthInflow(m)-monthSpend(m); } /* reste après dépenses, hors virements d'épargne */
function catSpend(m,cat){ let s=0; DATA.months[m].transactions.forEach(t=>{ if(effCat(m,t)===cat&&t.amount<0) s+=-t.amount; }); return s; }

/* === FIXED_CATS list (line 1104) — the scheduled/fixed charges (loyer, credit, etc.) === */
const FIXED_CATS=['Loyer','Crédit auto','Factures & énergie','Abonnements','Assurance & santé'];

/* ============================================================================
 * (5) THE ANALYTICS FUNCTION — yields opening, endBalance, odDaysTotal,
 *     avgIncome, monthEndBalances, balByMonth{start,end,trough,odDays,variation},
 *     fixedM, ravM, avgFixed, avgRav, fixedPct. Writes result to DATA.analytics.
 *     (lines 881-911)  recomputeAnalytics() + recomputeGoalEur()
 * ========================================================================== */
function recomputeAnalytics(){
  const order=DATA.monthOrder;
  const isFixed=function(l){ l=(l||'').toLowerCase(); return l.indexOf('prlv sepa')>=0||l.indexOf('echeance pret')>=0||l.indexOf('frais tenue de compte')>=0||l.indexOf('cotisation carte')>=0; };
  let opening=0;
  const firstM=order[0]; const fts=firstM&&DATA.months[firstM]?DATA.months[firstM].transactions:[];
  if(fts.length && fts[0].sol!=null) opening=round2(fts[0].sol-fts[0].amount);
  const balByMonth={},fixedM={},ravM={},monthEndBalances=[]; let prevEnd=opening,odTotal=0;
  order.forEach(function(m){
    const txns=(DATA.months[m]&&DATA.months[m].transactions)||[];
    const income=monthIncome(m);
    let fx=0; txns.forEach(function(t){ if(t.amount<0 && FIXED_CATS.indexOf(effCat(m,t))>=0) fx+=-t.amount; }); fx=round2(fx);
    fixedM[m]=fx; ravM[m]=round2(income-fx);
    const sols=txns.filter(function(t){return t.sol!=null;}).map(function(t){return t.sol;});
    let start=prevEnd,end=prevEnd,trough=prevEnd,odDays=0;
    if(sols.length){
      end=sols[sols.length-1]; trough=Math.min.apply(null,sols);
      const byd={}; txns.forEach(function(t){ if(t.sol!=null){ (byd[t.date]=byd[t.date]||[]).push(t.sol); } });
      odDays=Object.keys(byd).filter(function(d){return Math.min.apply(null,byd[d])<0;}).length;
    }
    balByMonth[m]={start:round2(start),end:round2(end),trough:round2(trough),odDays:odDays,variation:round2(end-start)};
    monthEndBalances.push(round2(end)); odTotal+=odDays; prevEnd=end;
  });
  const n=order.length||1;
  const avgIncome=round2(order.reduce(function(a,m){return a+monthIncome(m);},0)/n);
  const avgFixed=round2(order.reduce(function(a,m){return a+fixedM[m];},0)/n);
  const avgRav=round2(order.reduce(function(a,m){return a+ravM[m];},0)/n);
  DATA.analytics={opening:round2(opening),endBalance:round2(prevEnd),monthEndBalances:monthEndBalances,balByMonth:balByMonth,odDaysTotal:odTotal,fixedM:fixedM,ravM:ravM,avgFixed:avgFixed,avgRav:avgRav,fixedPct:(avgIncome>0?Math.round(1000*avgFixed/avgIncome)/10:null),avgIncome:avgIncome};
  if(DATA.goals) DATA.goals.baseMonthly=avgIncome;
  recomputeGoalEur();
}
function recomputeGoalEur(){ const g=DATA.goals; if(!g) return; const base=g.baseMonthly||0; g.savingsTargetEur=round2(base*(g.savingsPct||0)/100); g.investTargetEur=round2(base*(g.investPct||0)/100); }

/* ============================================================================
 * (1) CURRENT-MONTH SOLDE / END BALANCE
 *     Read from DATA.analytics after recomputeAnalytics():
 *       end-of-period balance ...... DATA.analytics.endBalance
 *       current month end .......... DATA.analytics.balByMonth[currentMonth].end
 *       month variation ............ DATA.analytics.balByMonth[currentMonth].variation
 *     The render that surfaces these is renderHealth() (lines 737-751):
 * ========================================================================== */
function renderHealth(){
  const A=DATA.analytics; if(!A) return;
  const bEl=document.getElementById('health-balance'); if(bEl) bEl.textContent=eur(A.endBalance);
  const sp=document.getElementById('health-spark'); if(sp) sp.innerHTML=sparkline(A.monthEndBalances||[],230,46,8);
  const tj=document.getElementById('health-traj'); if(tj){ const up=(A.endBalance||0)>=(A.opening||0); tj.innerHTML='Début '+eur(A.opening)+' \u2192 fin <b class="'+(up?'green':'red')+'">'+eur(A.endBalance)+'</b> sur 6 mois'; }
  const m=currentMonth, bm=(A.balByMonth&&A.balByMonth[m])||null;
  const st=document.getElementById('health-stats'); if(!st) return;
  const v=bm?bm.variation:0, odd=bm?bm.odDays:0, tr=bm?bm.trough:0;
  const fxPct=(A.fixedPct!=null)?A.fixedPct+'%':'\u2014';
  st.innerHTML=
    hstat('Variation du solde ('+monthLabel(m)+')',(v>=0?'+':'')+eur(v),v>=0?'green':'red','ce que la banque voit bouger')+
    hstat('À découvert ('+monthLabel(m)+')', odd>0?(odd+' j \u00B7 bas '+eur(tr)):'jamais', odd>0?'red':'green', odd>0?'avant la paie':'mois dans le vert')+
    hstat('Charges fixes', fxPct, 'orange', '\u2248 '+eur0(A.avgFixed)+'/mois engagés')+
    hstat('Reste à vivre', eur0(A.avgRav), 'blue', 'après charges fixes /mois');
}

/* ============================================================================
 * (2) DECOUVERT (overdraft) FOR THE MONTH
 *     odDays + trough are computed inside recomputeAnalytics (above) per month:
 *       days in red .... DATA.analytics.balByMonth[m].odDays
 *       low point ...... DATA.analytics.balByMonth[m].trough
 *       all-months ..... DATA.analytics.odDaysTotal
 *     Core expression (excerpt from recomputeAnalytics, lines 897-898):
 *       const byd={}; txns.forEach(t=>{ if(t.sol!=null){ (byd[t.date]=byd[t.date]||[]).push(t.sol);} });
 *       odDays = Object.keys(byd).filter(d=>Math.min.apply(null,byd[d])<0).length;
 *       trough = Math.min.apply(null, sols);   // sols = txns with t.sol != null
 * ========================================================================== */

/* ============================================================================
 * (3) BUDGET RESTANT (remaining budget) — derived inside renderBudget() (lines 1105-1208).
 *     Key expressions (verbatim excerpts):
 *       avgInc      = MONTHS.reduce((a,m)=>a+monthIncome(m),0)/MONTHS.length;        // line 1108
 *       avg(cat)    = MONTHS.map(m=>catSpend(m,cat)).reduce(...)/MONTHS.length;       // line 1110
 *       fixesReal   = sum of avg over FIXED_CATS items;                                // line 1114
 *       disposable  = avgInc - fixesReal;            // reste a vivre                  // line 1115
 *       reste       = avgInc - totReal;              // epargne possible               // line 1115
 *       savingsGoal = round2(goalBase*(savingsPct+investPct)/100);                     // line 1117
 *       varBudget   = disposable - savingsGoal;      // <== BUDGET VARIABLE RESTANT    // line 1118
 *       allocLeft   = varBudget - varTargeted;       // a allouer                      // line 1124
 *       feasSurplus = disposable - varPlanned - savingsGoal;                           // line 1123
 *     Per-envelope remaining margin (line 1184): rest = it.target - it.avg;
 * ========================================================================== */

/* ============================================================================
 * (4) PROCHAIN PRELEVEMENT (next upcoming scheduled debit)
 *     NOTE: there is NO first-class "next scheduled debit" function in this app.
 *     The notion of a scheduled/fixed charge is encoded two ways:
 *       (a) isFixed(label) inside recomputeAnalytics (line 883), and
 *       (b) FIXED_CATS membership (line 1104).
 *     isFixed() verbatim (line 883):
  const isFixed=function(l){ l=(l||'').toLowerCase(); return l.indexOf('prlv sepa')>=0||l.indexOf('echeance pret')>=0||l.indexOf('frais tenue de compte')>=0||l.indexOf('cotisation carte')>=0; };
 *     To compute prochainPrelevement you must derive it yourself from DATA.months
 *     (e.g. take recurring negative txns whose category is in FIXED_CATS or whose
 *      raw matches isFixed(), group by label, and project the next date). See
 *     comptes.md section 6 for the exact recipe. The label shown to users comes
 *     from simplifyJS(raw) (line 822) and the amount from t.amount.
 * ========================================================================== */
