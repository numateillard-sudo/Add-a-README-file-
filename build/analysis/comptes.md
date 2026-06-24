# Wiring analysis — `TAME_Comptes_et_Budget.html` (Comptes & Budget)

Single-file vanilla-JS app. Goal: embed as a module after injecting its markup into a container.
File: `/home/user/Add-a-README-file-/src/TAME_Comptes_et_Budget.html` (1277 lines, ~1.9 MB).

Layout recap:
- L7: Chart.js 4.4.1 UMD (`cdn.jsdelivr.net`). L8–10: Google Fonts (Hanken Grotesk, Newsreader).
- L11–452: `<style>`. L454–618: `<body>`.
- **L546** = the `<div id="txn-cards" class="txn-cards">…</div>` — ~1.6 MB of PRE-RENDERED transaction cards. JS at L995 (`renderTxnCards`) wipes and regenerates this (`tb.innerHTML=''`), so the static content is disposable.
- L619 `<script>`; L620 `const DATA = {…}` (~130 KB literal). L621 `window.DATA = DATA;`. L622 `Chart.defaults` mutation. L623–1275 logic. L1255–1275 bootstrap IIFE. L1276 `</script>`.

Verbatim code for the two deliverables lives in `comptes-bootstrap.js` and `comptes-signals.js` (same folder).

---

## 1. BOOTSTRAP

The app starts via an **IIFE that runs immediately at the end of `<script>`** (L1255–1275). There is **NO `DOMContentLoaded`, no `window.onload`, no `defer`**. It works because the `<script>` sits at the very end of `<body>`, so the markup already exists when it runs. Re-running the script after injecting markup therefore Just Works (no event to wait for).

Bootstrap body (L1255–1275, verbatim in `comptes-bootstrap.js`):
```
1255 (function(){
1256   try{ loadStoredStatements(); }catch(e){ console.error('load imports:',e); }
1257   allTxns().forEach(function(x){ KEY2DEF[keyOf(x.m,x.t)]=x.t.category; });
1258   computeSavings();
1259   recomputeAnalytics();
1260   applyGoalsOverride();
1261   const fns=[
1262     wireTabs,
1263     ()=>renderMonthPills('ov-month-pills',LS.month,renderOverview),
1264     renderOverview,
1265     renderTxnMonthPills, renderTxnAll, wireImport, wireTxnControls,
1266     renderMvM,
1267     renderBudget, renderInsights
1268   ];
1269   fns.forEach(fn=>{ try{ fn(); }catch(e){ console.error('Init error in '+fn.name+':',e); } });
1270   try{ const tm=ls_get(LS.tmonth,'all'); if(tm){ txnMonthFilter=tm; renderTxnMonthPills(); renderTxnAll(); } }catch(e){}
1273   ['overview','transactions','mvm','budget','insights'].forEach(id=>{ if(!document.getElementById(id)) console.error('Missing panel:',id); });
1274   if(!document.getElementById('import-csv-btn')) console.error('Missing import button');
1275 })();
```

**Master function(s) to call to (re)render the whole app after injecting markup** — there is no single public entry point; reproduce the IIFE's sequence. The simplest reliable "render everything" call set (data prep first, then renders):
1. Prep state/data: `computeSavings(); recomputeAnalytics(); applyGoalsOverride();` (and `loadStoredStatements()` if you want persisted CSV imports re-applied; it must run **before** the others).
2. Wire + render: `wireTabs(); renderMonthPills('ov-month-pills', LS.month, renderOverview); renderOverview(); renderTxnMonthPills(); renderTxnAll(); wireImport(); wireTxnControls(); renderMvM(); renderBudget(); renderInsights();`

`rerenderAll()` (L950–958) is the closest single "redraw all tabs" helper, but it does **not** call the wiring functions (`wireTabs/wireImport/wireTxnControls`) or `renderMonthPills`. Use it for re-render after data edits **within** a live mount; use the full IIFE sequence for a fresh mount.

---

## 2. GLOBALS

Everything is declared with bare `const`/`let`/`var`/`function` at script top level → in a `<script>` these are global (lexical globals on the module/script scope; `var`/`function` also become `window` props). **Wrapping the entire script (L620–1275) in one IIFE fully contains them.** The only deliberate global is the explicit assignment, which you can keep or drop:

- **`window` assignments:** `window.DATA = DATA;` (L621). That is the ONLY `window.X=` write. Nothing in this file *reads* `window.DATA` (it always uses the local `DATA`), so it is optional — keep it only if the host app or the sibling Investissement module expects `window.DATA`. (Risk: a sibling module also writing `window.DATA` would collide — namespace it if so.)
- No other reliance on being global: no `eval`, no inline `onclick="fn()"` in the body markup (all handlers are attached via JS `el.onclick=`/`.onchange=`/`addEventListener`). So an IIFE wrapper is safe.

**Top-level declarations (script scope), in source order:**

Data/config consts: `DATA` (L620), `MONTHS`, `SPEND`, `INCOME_CATS`, `REFUND_CATS`, `TRANSFER_CATS`, `CATCOLOR`, `ALLCATS`, `MOIS_FR`, `MOIS_ABBR`, `LS` (L635), `KEY2DEF` (L765), `ICON`, `CAT_ICON`, `SALARY_MIN`, `KNOWN_SIMP`, `FIXED_CATS` (L1104), `netLabelPlugin` (L1041, **dead — never registered/used**).

Mutable state `let`: `statusByKey`, `categoryByKey`, `budgets`, `currentMonth` (L643–646); `donutChart` (L682); `txnSort, txnStatusFilter, txnSearch, txnMonthFilter` (L755); `txnCatFilter, txnSortMode, txnLimit` (L768); `mvmChart, trendChart, trendCat` (L1040, **all three never assigned a chart — dead**); `budgetDonutChart, budgetDonutMode` (L1103). `var _mvmRz` (L1099, debounce handle).

Functions (≈70): `_multiyear, monthLabel, monthShort, eur, eur0, sparkline, ls_get, ls_set, yearOf, normalizeTxns, keyOf, effCat, effStatus, allTxns, monthIncome, monthSpend, monthTransfer, monthRefund, monthInflow, monthNet, catSpend, computeSavings, renderMonthPills, renderKPI, kpi, renderDonut, monthSavings, renderTransfers, renderSavings, renderOvInsights, hstat, renderHealth, renderOverview, renderTxnMonthPills, hexA, onCatChange, onStatusChange, defaultCatForKey, svgIcon, round2, _has, splitCSV, parseDateFR, categorizeJS, titleCase, simplifyJS, _num, parseStatementCSV, recomputeAnalytics, recomputeGoalEur, applyGoalsOverride, applyParsed, getStored, persistStatement, loadStoredStatements, resetImports, showImportNote, updateImportStatus, handleImport, rerenderAll, txnCatData, updateClearChip, renderTxnCats, renderTxnSummary, renderTxnCards, renderTxnAll, wireImport, wireTxnControls, refreshDependents, toast, mvmStat, _mvmW, smoothPath, renderFlow, renderMvM, miniSpark, renderMovers, statusOf, renderBudget, diagStat, projCard, renderInsights, callout, wireTabs`.

Note the helper names `eur`, `round2`, `toast`, `kpi`, `callout`, `_num`, `_has` are generic and likely to collide with the sibling Investissement module → **IIFE-wrap each module** (separate scopes) is the safe integration.

---

## 3. TABS

5 nav buttons with `data-tab` (L460–466 markup):

| Label (FR) | `data-tab` / panel id |
|---|---|
| Aperçu | `overview` |
| Transactions | `transactions` |
| Mois par mois | `mvm` |
| Budget | `budget` |
| Analyses | `insights` |

- **Nav container:** `<div class="tabs">` (L460) — **no id**, selected by class `.tab`.
- **Panels:** `<div class="panel" id="…">` (L469, 512, 551, 569, 599). Active panel has class `panel active`.
- **Switching = `wireTabs()` (L1253)**, NOT event delegation on `document`. It does `document.querySelectorAll('.tab').forEach(t => t.onclick = …)` — i.e. it assigns `.onclick` to each `.tab` button. On click it removes `active` from all `.tab` + `.panel`, adds `active` to the clicked tab and to `document.getElementById(t.dataset.tab)`, then lazily renders: `budget`→`renderBudget()`, `mvm`→`renderMvM()`, `overview`→`renderDonut()` (canvas charts must render while visible).
- Because it uses `.onclick=` (not `addEventListener`) and queries the **whole document** for `.tab`/`.panel`, see §12 for the multi-instance caveat (a second mount's `.tab` selector matches buttons across BOTH mounts).

---

## 4. GLOBAL LISTENERS (document/window/onX)

Only **one** listener is attached to `window`/`document`. Everything else is per-element `.onclick`/`.onchange`/`.oninput` (re-assigned each render, so idempotent on that element).

- **L1099** — `window.addEventListener('resize', …)` (debounced flow redraw):
```
var _mvmRz; window.addEventListener('resize', function(){ clearTimeout(_mvmRz); _mvmRz=setTimeout(function(){ var p=document.getElementById('mvm'); if(p&&p.classList.contains('active')){ try{ renderFlow(); renderMovers(); }catch(e){} } }, 180); });
```
This is registered at **script top level (not inside a function)** → **each time the whole script re-runs it adds ANOTHER resize listener** (duplicate-bind on re-mount). See §12.

- The app **dispatches** (does not listen for, within itself) `document.dispatchEvent(new CustomEvent('dataChanged'))` at L957 (`rerenderAll`) and L1035 (`refreshDependents`). No `document.addEventListener` anywhere. No `window.onX=` (the only `window.X=` is `window.DATA=` data assignment, L621). No `beforeunload`/`hashchange`/keyboard listeners.

---

## 5. CHART

**L622 verbatim (global `Chart.defaults` mutation):**
```
if(window.Chart){try{var C=Chart.defaults;var mk=function(o,k){o[k]=o[k]||{};return o[k];};C.font=C.font||{};C.font.family='"Hanken Grotesk",system-ui,sans-serif';C.font.size=12;C.color='#6f685b';C.borderColor='#f0ebdf';var lg=mk(mk(mk(C,'plugins'),'legend'),'labels');lg.usePointStyle=true;lg.boxWidth=8;lg.padding=16;lg.font={size:12,weight:'500'};var tt=mk(mk(C,'plugins'),'tooltip');tt.backgroundColor='#26231d';tt.cornerRadius=8;tt.padding=11;tt.titleFont={weight:'600',size:12};tt.bodyFont={size:12};tt.displayColors=false;var sc=mk(C,'scales');['linear','category'].forEach(function(t){var s=mk(sc,t);mk(s,'grid');mk(s,'ticks');mk(s,'border');});sc.linear.grid.color='#f0ebdf';sc.linear.grid.drawTicks=false;sc.linear.border.display=false;sc.linear.ticks.padding=8;sc.category.grid.display=false;sc.category.border.display=false;sc.category.ticks.padding=6;}catch(e){console.warn('chart defaults',e);}}
```

**`new Chart(...)` calls — only 2, both pass their own `options`:**
- **L692** `donutChart = new Chart(cv.getContext('2d'), {type:'doughnut', …, options:{responsive:true,maintainAspectRatio:false,cutout:'67%',plugins:{legend:{display:false},tooltip:{…}}}})` — Overview spending donut (`#spending-donut`). Guarded by `if(donutChart) donutChart.destroy();` (L691).
- **L1166** `budgetDonutChart = new Chart(cv.getContext('2d'), {type:'doughnut', …, options:{cutout:'68%',responsive:true,maintainAspectRatio:false,plugins:{…}}})` — Budget donut (`#budget-donut`). Guarded by `if(budgetDonutChart) budgetDonutChart.destroy();`.

Both call `.destroy()` on their previous instance before re-creating → safe within a single live mount.

**Global side-effects affecting a DIFFERENT Chart.js app on the same page:** YES — **L622 mutates the shared `Chart.defaults` singleton** (font, color, borderColor, legend, tooltip, linear/category scale defaults). Any other Chart.js chart on the page (e.g. the sibling Investissement module) inherits these unless it overrides them per-chart. This runs every time the script runs (re-applies, idempotent values, harmless to repeat but globally shared). The Investissement module's own `Chart.defaults` mutation, if any, would race/overwrite depending on script order. **Mitigation:** keep both modules' per-chart `options` explicit, or set `Chart.defaults` once at host level. `netLabelPlugin` (L1041) is defined but **never `Chart.register`-ed** and never attached to a chart → zero side-effect (dead code). No `Chart.register(...)`, no `Chart.defaults` reset/teardown anywhere.

---

## 6. SIGNALS derivation (CURRENT month = `currentMonth`)

`currentMonth` defaults to the last month in `DATA.monthOrder` (here `"2026-06"`), overridable by `localStorage['jl-fin:month']` (L646–647). All four signals derive from `DATA` + persisted overrides (`categoryByKey`, `statusByKey`, `budgets`, goals). Run `recomputeAnalytics()` first to populate `DATA.analytics`.

**(a) `soldeMois` — month end balance.** After `recomputeAnalytics()`:
- whole-period end: `DATA.analytics.endBalance` (= last month's end).
- this month's end: `DATA.analytics.balByMonth[currentMonth].end`.
- this month's variation (what `renderHealth` shows as "Variation du solde"): `DATA.analytics.balByMonth[currentMonth].variation` (= `end − start`).
Computed inside `recomputeAnalytics` (L893–901): `sols = txns.filter(t=>t.sol!=null).map(t=>t.sol); end = sols[sols.length-1]` (or carries `prevEnd` if no `sol`). Surfaced by `renderHealth()` (L737–751).

**(b) `decouvertMois` — overdraft this month.** From `DATA.analytics.balByMonth[currentMonth]`:
- `odDays` = number of distinct dates whose min running balance `< 0` (L897–898): `const byd={}; txns.forEach(t=>{ if(t.sol!=null)(byd[t.date]=byd[t.date]||[]).push(t.sol); }); odDays = Object.keys(byd).filter(d=>Math.min(...byd[d])<0).length;`
- `trough` (low point amount) = `Math.min(...sols)` (L896).
- all-months total: `DATA.analytics.odDaysTotal`.
`renderHealth` (L748) displays `odd + ' j · bas ' + eur(tr)` when `odDays>0`, else `"jamais"`.

**(c) `budgetRestant` — remaining budget.** Computed inside `renderBudget()` (L1105–1208) from 6-month averages, not a single month:
- `avgInc = mean over MONTHS of monthIncome(m)` (L1108).
- per-category average spend `avg = mean over MONTHS of catSpend(m,cat)` (L1110).
- `fixesReal` = Σ avg over `FIXED_CATS` (L1104 = `['Loyer','Crédit auto','Factures & énergie','Abonnements','Assurance & santé']`) (L1114).
- `disposable` (reste à vivre) = `avgInc − fixesReal` (L1115).
- `savingsGoal = round2(goalBase*(savingsPct+investPct)/100)`, `goalBase = DATA.goals.baseMonthly` (= `avgIncome`) (L1116–1117).
- **`varBudget = disposable − savingsGoal`** = the headline "Budget variable" remaining (L1118).
- `allocLeft = varBudget − varTargeted` ("à allouer", L1124); `feasSurplus = disposable − varPlanned − savingsGoal` (plan finançable, L1123).
- per-envelope margin: `rest = it.target − it.avg` (L1184).
For a single-month "remaining vs budget" use `budgets[cat] − catSpend(currentMonth, cat)` (`budgets` = `Object.assign({}, DATA.budgets, ls_get('jl-fin:budgets',{}))`, L645; over-budget logic at L731–732 uses `catSpend(m,c) > budgets[c]*1.1`).

**(d) `prochainPrelevement` — next scheduled debit.** **No first-class function exists.** "Scheduled/fixed" is encoded two ways: `isFixed(label)` inside `recomputeAnalytics` (L883: label contains `prlv sepa` | `echeance pret` | `frais tenue de compte` | `cotisation carte`) and `FIXED_CATS` membership (L1104). To compute it without UI: scan `DATA.months[*].transactions` for negative txns where `FIXED_CATS.indexOf(effCat(m,t))>=0` (or `isFixed(t.raw)`), group by `simplifyJS(t.raw)` (label) / day-of-month, and project the next occurrence after "today". Fields: label = `simplifyJS(t.raw)` (L822) or `t.disp`; amount = `t.amount`; date = `t.date` (+ project forward by 1 month). This must be implemented; the source only provides the building blocks (extracted in `comptes-signals.js`).

---

## 7. ANCHORS (analytics values)

**These values are produced by `recomputeAnalytics()` (L881–910)** — and the literal `DATA.analytics` baked into L620 already holds the identical numbers (the file was saved after running it). The bootstrap calls `recomputeAnalytics()` at L1259, which **overwrites** `DATA.analytics` from the transactions. So both the stored DATA and a fresh recompute yield the same anchors.

How `recomputeAnalytics()` derives each:
- **`opening` = 1500.0** — L884–886: `opening = round2(firstTxn.sol − firstTxn.amount)` for the first month's first transaction (`2026-01`). First txn `sol=1497.85, amount=-2.15` → `1497.85−(−2.15)=1500.00`. ✓
- **`endBalance` = 1521.21** — L901/907: `prevEnd` after the loop = last month's `end` = last `sol` of `2026-06` (`1521.21`). ✓
- **`odDaysTotal` = 85** — L901: `odTotal += odDays` per month. balByMonth odDays = 16+14+17+15+6+17 = **85**. ✓
- **`avgIncome` = 2345.45** — L904: `round2(Σ monthIncome(m) / 6)`. ✓ (also written back to `DATA.goals.baseMonthly` at L908.)
- **`monthEndBalances` = [1405.82,1305.55,1320.76,1637.81,1188.68,1521.21]** — L901: `monthEndBalances.push(round2(end))` per month in `monthOrder`. ✓

Inputs: `DATA.monthOrder`, `DATA.months[m].transactions` (each txn's `.sol`, `.amount`, `.date`), `effCat` (via `monthIncome`), and `FIXED_CATS` (for `fixedM`). Invoked at bootstrap L1259 and after every CSV import (`applyParsed`→`recomputeAnalytics`, L923) and on currentMonth fallback. **Confirmed: the current `DATA` reproduces all five exact values.** (Verified against the L620 literal `analytics` block and the per-month `balByMonth` odDays/end values.)

Other analytics produced: `balByMonth[m]{start,end,trough,odDays,variation}`, `fixedM`, `ravM`, `avgFixed=1182.22`, `avgRav=1163.23`, `fixedPct=50.4`.

---

## 8. PERSONA

- **`DATA.user = "Julien"`** (L620, first key of the DATA literal). **It is NEVER read by the JS** (no code references `DATA.user`).
- The name "Julien" appears only as **hardcoded static text**, not bound to `DATA.user`:
  - L2: saved-from-url HTML comment (`…/Julien%20Finance%20Dashboard_5.html`) — cosmetic, ignorable.
  - **L6:** `<title>Julien — Tableau de bord financier</title>`.
  - **L457:** `<h1>Julien Finance Dashboard</h1>` (topbar).
- To unify under a profile name: change the `<h1>` at L457 (and optionally `<title>` L6); `DATA.user` itself is decorative and unused, so updating it has no effect — drive the displayed name from your profile and edit the markup/inject dynamically. No other per-user strings.

---

## 9. STORAGE (localStorage)

Key map `LS` at **L635**: `{status:'jl-fin:status', cat:'jl-fin:cat', budg:'jl-fin:budgets', month:'jl-fin:month', tmonth:'jl-fin:tmonth', check:'jl-fin:check', goals:'jl-fin:goals'}`. Plus a separate `'jlm:statements'` key for imported CSVs.

| Key | Written by | Stores |
|---|---|---|
| `jl-fin:status` | `onStatusChange`/L1025, L763 | `statusByKey` map: `{txnKey: 'could cancel'|'cancelled'}` (per-txn resiliation status overrides) |
| `jl-fin:cat` | `onCatChange`/L1024, L762 | `categoryByKey` map: `{txnKey: categoryName}` (per-txn category overrides; only when ≠ default) |
| `jl-fin:budgets` | `commit`/L1203 | user budget targets per category `{cat: number}` (deleted key ⇒ revert to `DATA.budgets[cat]`) |
| `jl-fin:month` | `renderMonthPills`/L669 | selected Overview month key (e.g. `"2026-06"`) |
| `jl-fin:tmonth` | `renderTxnMonthPills`/L758 | Transactions month filter (`'all'` or month key) |
| `jl-fin:goals` | `commitGoal`/L1147, L1203 area | `{savingsPct, investPct}` goal overrides |
| `jl-fin:check` | — | **declared in `LS` but never used** anywhere (dead key) |
| `jlm:statements` | `persistStatement`/L928, `resetImports`/L930 | array of raw CSV statement texts the user imported |

`txnKey` = `keyOf(m,t)` = `t.uid` (set by `normalizeTxns`, format `month|date|raw|amount#n`).

**Load/merge order at startup:**
1. L643–646: `statusByKey`, `categoryByKey` loaded raw from LS; `budgets = Object.assign({}, DATA.budgets, ls_get('jl-fin:budgets',{}))` (user overlays defaults); `currentMonth` from LS (fallback last month, validated L647).
2. Bootstrap L1256: `loadStoredStatements()` replays each saved CSV through `applyParsed` (mutates `DATA.months`/`monthOrder`, recomputes analytics).
3. L1257 rebuild `KEY2DEF`; L1258 `computeSavings()` (writes `DATA.savingsByMonth`); L1259 `recomputeAnalytics()`; L1260 `applyGoalsOverride()` (overlays `jl-fin:goals` onto `DATA.goals`, then `recomputeGoalEur`).
4. L1270–1271 restores `txnMonthFilter` from `jl-fin:tmonth`.
Overrides are applied **lazily at read time** via `effCat`/`effStatus` (they consult `categoryByKey`/`statusByKey` first, fall back to `t.category`/`t.status`) — DATA's own txn objects are not rewritten.

**Integration note:** keys are app-global (no per-user/per-mount prefix). To run multiple profiles or avoid cross-module collision, namespace these (e.g. prefix with a profile id).

---

## 10. IDS inventory (for collision-checking)

**Element ids present in markup AND/OR referenced by JS `getElementById`** (distinct set):

`overview, transactions, mvm, budget, insights` (the 5 panels) · `ov-month-pills, health-card, health-balance, health-spark, health-traj, health-stats, ov-kpis, ov-donut-month, spending-donut, spending-legend, ov-transfers, sc-could, sc-cancelled, sc-annual, ov-insights-title, ov-insights` · `import-csv-btn, import-csv-input, import-note, import-status, reset-imports, txn-month-pills, txn-cat-cards, txn-search, txn-status-filter, txn-sort, txn-clear-cat, txn-cat-label, txn-summary, txn-count, txn-cards` · `mvm-summary, mvm-flow, mvm-verdict, mvm-movers, movers-cap` · `plan-stats, goal-editor, prio-rows, prio-cap, donut-seg, budget-donut, donut-center, budget-donut-legend, nature-rows, bud-envelopes, env-cap` · `diag-verdict, diag-stats, truths, proj, proj-note` · `toast`.

Notes: `reset-imports` is created dynamically by `updateImportStatus` (L932). `donut-seg` contains two `data-mode` buttons (Réel/Cible). All ids are **plain/global** (no scoping) — high collision risk with the sibling module if it reuses generic names like `toast`, `proj`, `truths`, `budget`, `insights`, `overview`. **Recommend scoping** (wrap markup in a container and either prefix ids or switch JS to container-scoped `querySelector` during integration). The `.tabs` nav and `.wrap`/`.topbar`/`.foot`/`.toast` containers use classes, not ids (except `#toast`).

---

## 11. OFFLINE / network dependencies

**Only two external network deps, both in `<head>`:**
- L7: Chart.js 4.4.1 UMD — `https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js`.
- L8–10: Google Fonts CSS + font files (Hanken Grotesk, Newsreader) — `fonts.googleapis.com` / `fonts.gstatic.com`.

**No other network use:** no `fetch`, no `XMLHttpRequest`, no dynamic `import()`, no `<img>` / `background-image:url(http…)` / icon CDNs. All graphics are inline SVG (`svgIcon`, `sparkline`, `renderFlow`, `miniSpark`) or `<canvas>` (Chart.js). All data is the embedded `DATA` literal + `localStorage`. `FileReader` is used for local CSV import (L935, user-initiated, no upload). The app degrades gracefully without Chart.js (every chart call is guarded by `typeof Chart !== 'undefined'` / `if(window.Chart)`); without Google Fonts it falls back to `system-ui`. So it is offline-capable once Chart.js is bundled locally.

---

## 12. RE-MOUNT SAFETY

If you inject fresh markup and **re-run the whole script in a fresh function scope each time** the view opens (state living in `localStorage`), it will **render correctly** — bootstrap reads everything from `DATA`+LS, charts guard with `.destroy()`, and per-element handlers are `.onclick=`/`.onchange=` (overwrite, not accumulate). But there are real hazards:

1. **DUPLICATE `window` resize listener (the main bug).** L1099 runs at script top level and calls `window.addEventListener('resize', …)`. Every script re-run **adds another** listener (they are distinct closures → not deduped). After N mounts, N handlers fire on resize. **Fix:** move it inside the IIFE behind a guard, or wrap the module so the listener is registered once, or use a named function + `removeEventListener` on unmount.
2. **Charts need their old instances destroyed.** Within one mount, `donutChart`/`budgetDonutChart` are module-scoped and `.destroy()`-guarded → fine. But if you re-run in a **fresh scope**, those vars reset to `null`, so the *previous* Chart instances (bound to the OLD, now-removed canvases) are **orphaned, not destroyed**. If old canvases are removed from the DOM this is usually GC'd, but to be safe call `donutChart?.destroy(); budgetDonutChart?.destroy();` before discarding the old mount (or keep the module instance alive instead of re-running).
3. **`wireTabs()` / `renderMonthPills` query the whole `document`.** `wireTabs` does `document.querySelectorAll('.tab')` and toggles `.panel` globally; `renderMonthPills` uses `document.querySelectorAll('#'+containerId+' .pill')`. With **two simultaneous mounts** on one page, a click in mount A would match `.tab`/`.panel` in BOTH → cross-talk. Single-instance (one mount at a time) is fine. For multi-instance, scope these selectors to the mount root.
4. **`Chart.defaults` is re-mutated each run (L622)** — idempotent values, harmless to repeat, but it is a shared global affecting other charts on the page (see §5).
5. **`CustomEvent('dataChanged')` on `document`** (L957, L1035) — dispatched only; the app never listens. Safe, but if the host listens, every mount's edits will fire it.
6. **`location.reload()` in `resetImports()`** (L930) — reloads the entire page (not module-friendly). If "réinitialiser les imports" must stay, replace with a re-render in the embedded context.
7. **`DATA` is mutated in place** (CSV import via `applyParsed` pushes into `DATA.months`/`monthOrder`; `computeSavings`/`recomputeAnalytics` write `DATA.savingsByMonth`/`DATA.analytics`; `applyGoalsOverride` writes `DATA.goals`). If you re-create `DATA` fresh each mount (re-eval L620), prior in-memory edits are lost but `jlm:statements` replay + LS overrides restore them. If you **share one `DATA` across mounts**, the writes are cumulative/idempotent and fine. Decide on one ownership model.

**Bottom line:** A single embedded instance, re-mounted by re-running an IIFE-wrapped copy of the script with state in `localStorage`, works — provided you (a) register the resize listener once (or remove on unmount), (b) `.destroy()` charts before discarding the old mount, (c) avoid two simultaneous mounts unless you scope the `.tab`/`.panel`/`#id` lookups, and (d) replace `location.reload()`.
