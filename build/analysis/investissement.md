# Investissement tool — wiring analysis (`src/TAME_Investissement.html`)

Single-file vanilla-JS app: "Le Petit Livre Rouge de l'investisseur". 13 139 lines, ~630 KB.
Journey: **Budget (Chap I) → Profil/Portefeuille (Chap II) → Fiscalité (Chap III)**, plus a
hero "Synthèse" and a BETA Monte-Carlo "Planificateur". One long **scroll** page (no SPA routing).

Layout map:
- L25 Chart.js 4.4.1 CDN (UMD min). L22–24 Google Fonts (Inter/Fraunces/Caveat).
- L26–4776 `<style>` (main CSS). L4778–8342 `<body>` markup. L8343–8362 second `<style>` (toast).
- **4 author script blocks**: **B1** 8376–8849 (state/persist/utils + BUDGET), **B2** 8850–10524 (INVESTISSEUR: assets/presets/profiles/quiz/sims/builder/compare + contextual tips), **B3** 10525–10960 (FISCALISTE), **B4** 10961–13128 (NAV/STEPPER/INIT + BILAN + PLANNER).
- Verbatim extracts live in `invest-bootstrap.js` and `invest-signals.js` (this folder).

---

## 1. BOOTSTRAP — exact start mechanism & master render fn

**Master (re)render function = `init()`** (defined **L11389–11474**). Calling `init()` after the
markup is in the DOM wires every listener and renders every chapter. Its tail sets the bootstrap flag:

```
11456:  window.__bootstrapped = true;
```

`init()` is triggered once via:
```
12628: document.addEventListener('DOMContentLoaded', init);
```
Three more independent eval-time triggers exist (they each guard on `readyState`):
```
8511:  const STATE_RESTORED_ON_LOAD = loadState();   // SYNCHRONOUS state restore (no DOM needed)
11012: window.addEventListener('scroll', updateStepper, { passive: true });
11527: if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initFearPrelude); } else { initFearPrelude(); }
13036: if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initPlannerWiring); } else { setTimeout(initPlannerWiring, 100); }
13111: (function(){ ... if (loading) DOMContentLoaded->setTimeout(initV19,80) else setTimeout(initV19,80) })();  // setupPlanStepper + updatePlannerView
```

**To (re)render after injecting markup**, call in order:
1. (state is already in `localStorage`; `loadState()`/`STATE` are module-global)
2. `init()` — the master init (binds + renders Budget/Investisseur/Fiscaliste + Synthèse/Bilan).
3. `initFearPrelude()` — knowledge-barometer slider (pre-quiz). *(init() does NOT call it.)*
4. `initPlannerWiring()` and `setupPlanStepper()` + `updatePlannerView()` — the BETA planner sub-tool. *(init() does NOT call these.)*

**Multiple blocks, must they run in order?** They share ONE global scope (classic non-module
`<script>`s). Order matters only for **eval-time top-level statements**, the main one being
`const STATE_RESTORED_ON_LOAD = loadState();` (B1, L8511) which must execute before any handler runs
`saveState()`. Function *definitions* are hoisting-independent because all top-level callbacks fire on
`DOMContentLoaded`/scroll, i.e. after all four blocks have evaluated. So later blocks DO depend on
earlier-block globals at *call* time (e.g. B4's `init` uses `STATE`, `ASSETS`, `PRESETS`, `fmt`,
`budgetCompute`, `fiscalCompute` from B1–B3), but NOT at *define* time.

---

## 2. GLOBALS — top-level declarations across all blocks + `window.X=`

All four blocks declare into the same global scope. Wrapping **all four blocks together in ONE IIFE
preserves behavior** — every cross-block reference is a shared lexical/global binding, so a single
enclosing function scope is equivalent. The only requirement is that the IIFE body keeps the **same
statement order** (so `loadState()` at the top still runs first) and that the handful of `window.*`
members stay on `window` (see below) because inline `onclick=""` HTML attributes resolve against the
global object, not the IIFE closure.

**Reliance on true `window` (global) scope** — these MUST remain global (referenced by inline HTML
`onclick=`/`onmouseover=` or cross-tool checks):
```
11456: window.__bootstrapped = true;            // gate used by budgetCompute() to propagate DCA
11635: window.__bilanShowFisc = showFisc;       // read at 12384 by generateBilanText()
12428: window.downloadBilanHTML = function(){…}; // (also onclick)  + alias 12497 downloadBilanHTML()
12506: window.handleBilanSend  = function(ev){…} // onclick inline
12542: window.handleBilanGmail = function(ev){…} // onclick inline
12575: window.handleBilanCopy  = async function(ev){…} // onclick inline
12616: window.handleBilanPrint = function(ev){…} // onclick inline
```
Also inline `onclick="navTo('…')"` / `onclick="window.scrollTo(...)"` exist in markup (header chap
buttons L4792–4795, stepper L4831–4846, TOC L8373). `navTo`, `showBilan`, `closeBilan`, `resetAllData`,
`switchMode`, `applyPreset`, `quizReset`, etc. are plain `function` decls → already global in
non-module scope; inside an IIFE they would need to be re-exposed on `window` to keep inline handlers
working. **Recommendation for embedding: either keep blocks in true global scope, or in the IIFE assign
the inline-referenced names onto `window`** (navTo, showBilan, closeBilan, resetAllData, and the
`window.handleBilan*`/`downloadBilanHTML` already are).

**Top-level declarations (name @ source line)** — consts/lets/vars + every `function`:

Block 1 (8376–8849): `STATE`@8384, `STORAGE_KEY`@8436, `LEGACY_KEYS`@8437, `saveState`@8439,
`loadState`@8453, `resetAllData`@8490, `showWelcomeBack`@8500, `STATE_RESTORED_ON_LOAD`@8511,
`fmt`@8515, `fmtS`@8520, `pct`@8528, `pctF`@8529, `setText`@8530, `envCls`@8532,
`computeEnvelopeSplit`@8541, `renderEnvelopeSplit`@8557, `setHTML`@8595, `getSum`@8596, `SEG`@8605,
`budgetDonut`@8613, `budgetSegsRef`@8614, `budgetAddRow`@8616, `budgetCompute`@8632,
`budgetUpdateSliders`@8843. *(+ document click delegate @8587)*

Block 2 (8850–10524): `ASSETS`@8855, `CATEGORIES`@8913, `CAT_EXPLANATIONS`@8921, `PRESETS`@8932,
`PROFILES`@9000, `investorDonut`@9031, `QUIZ_KEYS`@9039, `PROFILE_TAGLINES_Q`@9041,
`PROFILE_KEYPHRASES`@9049, `clamp100`@9059, `computeProfileAxes`@9062, `axisComment`@9091,
`PROFILE_STRESSTEST`@9109, `PROFILE_MENTIONS`@9117, `PROFILE_NOTES_Q`@9124, `PROFILE_ALLOCATION_Q`@9132,
`PROFILE_RATE_Q`@9139, `quizDetermineProfile`@9142, `quizUpdateProgress`@9184, `quizShowStep`@9194,
`quizShowResult`@9205, `quizAnswer`@9301, `quizReset`@9331, `quizInit`@9352, `investorComputeProfile`@9370,
`quizUpdateMeter`@9371, `quizComputeMeterScore`@9372, `quizShowStop`@9373, `updatePortfolioProjection`@9375,
`investorRenderPortfolio`@9405, `simulate`@9533, `computeWeightsStats`@9547, `computePortfolioStats`@9578,
`computePresetStats`@9579, `drawGrowthChart`@9582, `buildAssetsListHTML`@9629, `attachAccordionListeners`@9694,
`updateToggleAllBtnLabel`@9722, `buildAllocationDetailHTML`@9734, `attachAllocMergedListeners`@9807,
`updateAllocMergedBtnLabel`@9835, `CONTEXTUAL_TIPS`@9845, `__ctCurrentSection`@9866, `__ctDismissed`@9867,
`initContextualTips`@9869, `guidedChart`@9930, `renderGuidedDetail`@9932, `updateGuidedSim`@9968,
`expertChart`@10010, `builderFilter`@10011, `buildAssetRow`@10013, `renderBuilder`@10050,
`updateBuilderUI`@10109, `resetWeights`@10148, `applyPreset`@10158, `updateExpertOverview`@10181,
`updateExpertSim`@10304, `compareChart`@10356, `updateCompareSim`@10358, `updateDCAResetBtn`@10441,
`updateAllDCAResetBtns`@10459, `resetDCAToBudget`@10464, `switchMode`@10486, `resetQuiz`@10503,
`investorAnswerQuestion`@10508, `investorToggleNotion`@10519.

Block 3 (10525–10960): `TRANCHES`@10531, `ABATT_SAL_PLANCHER`@10539, `ABATT_SAL_PLAFOND`@10540,
`ABATT_RETR_PLAFOND`@10541, `PER_PLAFOND_ABS`@10542, `PLAFOND_DEMI_PART`@10543, `calcIR_brut`@10547,
`getTMI`@10557, `decote`@10564, `calcIR_net`@10571, `getParts`@10579, `fiscalAddSalaryRow`@10587,
`fiscalSetEnfants`@10603, `cerfa_line`@10611, `fiscalCompute`@10623.

Block 4 (10961–13128): `navTo`@10966, `updateStepper`@10976, `revealObs`@11015, `bindBudgetEvents`@11025,
`bindInvestorEvents`@11065, `bindFiscalEvents`@11244, `bindGlobalNav`@11279, `restoreUIFromState`@11286,
`init`@11389, `initFeedbackForm`@11477, `FP_LABELS`@11480, `initFearPrelude`@11494, `EMAILJS_CONFIG`@11537,
`showBilan`@11544, `closeBilan`@11552, `hasFiscData`@11558, `computeBilanScore`@11565, `populateBilan`@11631,
`populateHeroKPIs`@11727, `populateBudgetBody`@11796, `buildBudgetDonutSVG`@11898, `populatePortfolioBody`@11930,
`populateProjectionBody`@12026, `populateFiscBody`@12071, `populatePlanBody`@12128, `generateScoreGaugeSVG`@12160,
`generateAllocationDonutSVG`@12199, `generateProjectionCurveSVG`@12243, `niceCeil`@12302, `fmtCompact`@12314,
`buildBudgetBar`@12320, `generateBilanText`@12376, `downloadBilanHTML`@12497, `initBilan`@12499,
`PROFILE_PROBA`@12633, `PLANNER_STATE`@12640, `plannerTrajChart`@12651, `planRandN`@12654, `planMonteCarlo`@12661,
`planTrajectoryMC`@12685, `planFmtCompact`@12712, `updatePlannerView`@12721, `updatePlannerLevers`@12776,
`updatePlannerTrajectory`@12835, `applyGoalType`@12919, `applyProfile`@12934, `applyLever`@12953,
`syncPlannerInputs`@12968, `initPlannerWiring`@12980, `setupPlanStepper`@13043.
*(+ the four `window.handleBilan*`/`window.downloadBilanHTML` @12428–12616.)*

No `let/const` name is declared twice across blocks (no collisions inside the file itself). The
duplicate-looking `applyPreset` (B2) vs `applyProfile`/`applyLever` (B4 planner) are distinct names.

---

## 3. SECTIONS / ROUTER

There is **no router and no hash navigation**. All chapters are sibling `<section>` elements that
coexist in one scrolling document inside `<main id="main-content">` (L4802). "Navigation" = smooth
scroll via **`navTo(id)`** (L10966) called from inline `onclick=` on the header chapter buttons and the
sticky stepper, and from `bindGlobalNav()` for the floating TOC.

- **Header chapter nav**: `<nav class="chapter-nav">` buttons `data-chap` = `hero|chap1|chap2|chap3` (L4792–4795).
- **Sticky stepper**: `<nav class="stepper-bar">` (L4828), buttons `.step-btn[data-section=…]` (L4831–4846).
- **Floating TOC**: `#toc-floating` (L8368), `.toc-btn[data-jump=…]` (L8369–8372).
- Active-state is driven by **scroll-spy** in `updateStepper()` (L10976) using `el.offsetTop` vs
  `scrollY + innerHeight*0.4`. Section order array is hardcoded there (L10977).

**Main section container IDs** (all are `<section>`):
- Chap I: `chap1-cover`, `b-sec1`, `b-sec2`, `b-sec3`
- Chap II: `chap2-cover`, `i-sec1`, `i-sec2` (quiz; inner `#quiz-stage` L5426), `i-sec3`, `i-sec4`
- Chap III: `chap3-cover`, `f-sec1`, `f-sec2`, `f-sec3`, `f-sec4`
- Hero: `hero`; Bilan: `#bilan-section` (hidden until `showBilan()`).

Investisseur **mode switch** (within `i-sec4`, NOT page nav): `switchMode(mode)` (L10486) toggles
`.sim-view`/`#i-view-{guided|expert|compare}` `.active` classes — pure in-section show/hide.

---

## 4. GLOBAL LISTENERS (verbatim, with line numbers) — for re-mount dedup

`document`/`window`-level listeners registered at **eval time** (these are the ones that double up if
the whole script body is re-evaluated; per-element listeners inside `bind*` only double if you re-bind
the same nodes):

```
8587:  document.addEventListener('click', e => {            // .env-split-toggle delegation
11012: window.addEventListener('scroll', updateStepper, { passive: true });
11527: if (document.readyState === 'loading') {
11528:   document.addEventListener('DOMContentLoaded', initFearPrelude);
       } else { initFearPrelude(); }
12628: document.addEventListener('DOMContentLoaded', init);
13036: if (document.readyState === 'loading') {
13037:   document.addEventListener('DOMContentLoaded', initPlannerWiring);
       } else { setTimeout(initPlannerWiring, 100); }
13120: if (document.readyState === 'loading') {
13121:   document.addEventListener('DOMContentLoaded', function() { setTimeout(initV19, 80); });
       } else { setTimeout(initV19, 80); }
```
No `window.onX=` assignments, **no `hashchange`/`popstate`/`resize`** listeners anywhere.
`onclick`/`onmouseover`/`onkeydown` appear only as (a) inline HTML attributes in markup and (b)
`el.onclick=`/`el.onkeydown=` property assignments inside accordion helpers (`attachAccordionListeners`
L9703–9705, `attachAllocMergedListeners` L9816–9818, `head.onclick`/`head.onkeydown`) and
`initContextualTips` (`closeBtn.onclick` L9878) — those are idempotent (assignment, not addEventListener)
and are re-set on every render.

**IntersectionObservers created at eval/init time** (also duplicate on full re-eval): `revealObs`
(L11015, eval-time), the contextual-tips observer (inside `initContextualTips`, L9904), and the planner
stepper observer (inside `setupPlanStepper`, L13072).

---

## 5. CHARTS

Five `new Chart(...)` call sites; **every one passes per-instance `options`**:
```
8716:  budgetDonut       = new Chart(canvas, { type:'doughnut', … })   // budgetCompute()
9461:  investorDonut     = new Chart(canvas, { type:'doughnut', … })   // investorRenderPortfolio()
9594:  const chart       = new Chart(canvas, { type:'line', … })       // drawGrowthChart() → guided & expert
10414: compareChart      = new Chart(canvas, { type:'line', … })       // updateCompareSim()
12846: plannerTrajChart  = new Chart(canvas, { type:'line', … })       // updatePlannerTrajectory()
```
**`Chart.defaults` is NOT modified** anywhere (also no `Chart.register` / `Chart.overrides`). Confirmed
by full-file search → **0 matches**. So Chart.js global config is untouched; safe to share one Chart.js
instance with the host app.

**Charts needing `destroy()` before re-create** — the code already guards these:
- `budgetDonut` — destroyed before recreate (L8715).
- `investorDonut` — destroyed before recreate (L9458).
- `plannerTrajChart` — destroyed before recreate (L12845).
- `guidedChart`/`expertChart` (via `drawGrowthChart`) — NOT destroyed; reused via
  `existingChart.update('none')` when the module-level ref is already set (L9585–9592). On a fresh
  re-mount the refs (`guidedChart`,`expertChart`,`compareChart`) are `null` again, so first call creates
  fresh charts against fresh canvases — fine. The risk is only if you keep old refs alive while
  swapping the canvas DOM.
- `compareChart` — reused via `compareChart.update('none')` if ref set (L10404), else created.

**Re-mount rule for charts**: because the five chart refs (`budgetDonut`, `investorDonut`, `guidedChart`,
`expertChart`, `compareChart`, `plannerTrajChart`) are module-scope `let`s, if you re-run the script in a
**fresh function scope** per open, they reset to `null` and rebind cleanly to the new canvases. If you
instead keep one long-lived scope and re-inject markup, you must `destroy()` the stale instances (their
old canvases are gone) before re-rendering.

---

## 6. SIGNALS — compute `{profil, allocationCible}` without UI

**Quiz** = 4 questions, keys `['horizon','tolerance','poids','experience']` (L9039), each answered 1..4.
Markup: `.qs-question[data-quiz-key][data-quiz-step]`, options `.qq-opt[data-val=1..4]` (L5439–5560);
4 progress dots `.qsp-dot[data-step]` (L5431–5434).

**Scoring → profile** (`quizDetermineProfile(answers)`, L9142–9181, verbatim in `invest-signals.js`):
weighted additive score
`horizonMap{-2,1,3,4} + toleranceMap{-5,-1,3,5} + poidsMap{-3,0,2,3} + experienceMap{-1,-3,1,2}`,
then bucket: `score≤-4 prudent`, `≤6 equilibre`, `≤11 dynamique`, `else offensif`. Then **caps** downgrade
(never block): `tolerance==1→prudent` (`panic_full`), `horizon==1→equilibre` (`short_horizon`),
`poids==1→equilibre` (`concentration`), `experience==2→equilibre` (`past_panic`),
`experience==1 && tolerance==4→dynamique` (`overconfidence`). Returns `{ key, forced, reason }`.

**Where it lives in STATE**: answers at `STATE.investor.quiz.answers` (mirror `STATE.investor.answers`),
set by `quizAnswer(key,value)` (L9301). Committed profile object at
`STATE.investor.profile = { key, ...PROFILES[key] }` by `quizShowResult()` (L9211). Per-asset target at
`STATE.investor.weights = {...PRESETS[profile.preset]}` (set in `investorRenderPortfolio` L9513).

**Profile → target allocation** — two representations:
- **Coarse "allocation cible"** (3 buckets, hardcoded): `PROFILE_ALLOCATION_Q[profil]` (L9132–9137):
  prudent `{actions:26,bonds:69,gold:5}`, equilibre `{58,37,5}`, dynamique `{77,18,5}`, offensif `{87,8,5}`.
- **Full per-asset weights** (33 ids, sums to 100): `PRESETS[profil]` (L8932–8993). Since
  `PROFILES[k].preset === k`, `PRESETS[profil]` is the target allocation that drives the donut/sims.
  Blended expected return/vol = `computeWeightsStats(PRESETS[profil])` → `{rate, vol}` (L9547, needs
  `ASSETS` L8855). Headline per-profile rate also in `PROFILE_RATE_Q` (L9139) /
  `PROFILE_PROBA` (L12633).

Headless recipe:
```js
const det = quizDetermineProfile({horizon, tolerance, poids, experience}); // 1..4 each
const profil          = det.key;
const allocationCible  = PROFILE_ALLOCATION_Q[profil];   // coarse {actions,bonds,gold}
const targetWeights    = PRESETS[profil];                // full per-asset
const { rate, vol }    = computeWeightsStats(targetWeights);
```
(`computeProfileAxes` L9062 derives 3 cosmetic axis %s from the same answers; not part of the
profile decision.)

---

## 7. FISC NON-PERSIST — proof `fisc` is excluded from persistence

`STORAGE_KEY='lplr-v5'` (L8436). The serializer **only writes `budget` + `investor`** — `fisc` is
deliberately omitted:

```
8439: function saveState() {
8443:     const ser = {
8444:       schemaVersion: STATE.schemaVersion,
8445:       budget: STATE.budget,
8446:       investor: STATE.investor   // priorities (Set) devient {} en JSON …
8447:     };
8448:     localStorage.setItem(STORAGE_KEY, JSON.stringify(ser));
```
`loadState()` (L8453) only `Object.assign`s `STATE.budget` and `STATE.investor` (L8463–8464); it never
touches `STATE.fisc`. The v4→v5 migration copies **`budget` only** (L8473–8474). The B1 comment is
explicit (L8436, L8441–8442): *"fisc N'EST PLUS persisté … jamais écrits sur le disque"*.

**Confirmed: a reload leaves `fisc` empty** — it is re-initialized to the literal at L8420–8433
(`salaires:0, ir_net_final:0, tmi:0, teff:0, …`) on every page load, and only repopulated in-session by
`fiscalCompute()` (which writes `STATE.fisc.{salaires,ir_net_final,tmi,teff}` at L10950–10953 then calls
`saveState()` — but `saveState` still won't serialize it). `hasFiscData()` (L11558) uses exactly this:
fisc is "present" only if `salaires>0 || ir_net_final>0`, i.e. only after an in-session compute.

---

## 8. FISCAL ANCHOR — engine entry + concrete sample → freeze IR/TMI/taux effectif

**Engine entry (DOM-coupled): `fiscalCompute()`** (L10623–10959, quoted verbatim in
`invest-signals.js`). It reads all `#f-*` inputs, runs abattements → PER déductible → RI →
quotient-familial plafonnement → capital taxes → réductions/crédits → IFI → CERFA → synthèse, and writes
`STATE.fisc.{salaires, ir_net_final, tmi, teff}` + DOM (`#f-ir-display`, `#f-badge-tmi`, `#f-kpi-teff`…).

**Pure core (no DOM), preferable to freeze headlessly**: `calcIR_brut` (L10547), `getTMI` (L10557),
`decote` (L10564), `calcIR_net` (L10571), `getParts` (L10579) + const `TRANCHES` (L10531, barème 2026 /
revenus 2025) and the abatt/PER/QF constants (L10539–10543).

**Concrete sample (single person, no children, salary 40 000 €):**
- `abatt_sal = clamp(40000*0.10, 503, 14171) = 4000` → `ri = 36000`, `parts = getParts(1,0) = 1`.
- `calcIR_brut(36000) = (29579-11600)*0.11 + (36000-29579)*0.30 = 1977.69 + 1926.30 = 3903.99`;
  `decote(3903.99,false)=0` (≥1982). `ir_brut = Math.round(3903.99) = ` **3904 €**.
- `TMI = getTMI(36000) = 0.30` → **30 %**.
- `teff = 3904/40000 = 0.0976` → **≈ 9,8 %** (`pctF`).

**Freeze before/after the port: IR = 3904 €, TMI = 30 %, taux effectif ≈ 9,8 %** (single, 40 000 €, 0
PER/levers, parts=1). A second easy anchor: salary 30 000 €, parts=1 → ri=27000, IR brut on barème =
(27000-11600)*0.11 = 1694, but decote applies (1694<1982): `decote = 897 - 1694*0.4525 = 130.4` →
`ir_brut = round(1694 - 130.4) = 1564 €`, TMI 11 %, teff ≈ 5,2 %. (Use both to catch barème/décote
regressions.)

---

## 9. PERSONA — demo person name / prénom?

**None.** A full search for prénom/persona/common French first names / `defaultName`/`userName`/`demoName`
returned **0 matches**. The app is gender-/name-neutral and addresses the user with informal French "tu";
no default identity string is shown or read. There is one personal handle: the dev's email in
`EMAILJS_CONFIG` comment (L11535 "compte numa") and the Bilan email feature uses the address the user
types into `#bilan-email-input` (no stored prénom). Score/report uses a pseudo-random `refId`
(`PLR-YYYY-MMDD-####`, L11642) and the current date — not a name. **So there is no prénom to unify; if the
host app injects one, it has no existing slot to override.**

---

## 10. STORAGE — keys, what persists, migration

- **Current key**: `STORAGE_KEY = 'lplr-v5'` (L8436). **Legacy keys**: `LEGACY_KEYS = ['lplr-v1','lplr-v2','lplr-v3','lplr-v4']` (L8437). `schemaVersion: 1` (L8385).
- **Persisted shape**: `{ schemaVersion, budget, investor }` (L8444–8447). **NOT** `fisc` (§7).
  `STATE.investor` includes `quiz` (answers/step/completed), `profile`, `guided`/`expert`/`compare`
  sliders, `weights`, `activeMode`, and `financeKnowledge` (barometer, L11514). `investor.priorities`
  (a `Set`) serializes to `{}` and is reset to `new Set()` on load (L8465).
- **Migration / versioning** (`loadState`, L8453–8487):
  1. Read `lplr-v5`. If `schemaVersion` missing/≠ current (1) → `removeItem` and **clean reset**, return false.
  2. Else `Object.assign` `budget` + `investor`; reset `priorities`; return true.
  3. If no v5: soft-migrate from `lplr-v4` **budget only** (fisc abandoned), re-save as v5, return true.
  4. `finally`: always purge all `LEGACY_KEYS`.
  - `saveState()` is called by basically every compute/interaction. `resetAllData()` (L8490) clears v5 +
    legacy and `location.reload()`s. `STATE_RESTORED_ON_LOAD` (L8511) captures whether a real restore
    happened (used to show the "Bon retour" toast).
  - There is also a **legacy-quiz guard** in `restoreUIFromState` (L11293): if old 5-question keys
    (`filet`/`concentration`/`experience`) are found, the quiz/profile are reset.

---

## 11. IDS — distinct element-ID inventory (collision check)

**292 distinct `id="…"` values** in the file (full list in
`scratchpad/ids_markup.txt`). Many are script-targeted via `getElementById`/`setText`. Because the host
"Comptes & Budget" tool reportedly uses generic ids like `overview`, `txn-cards`, etc., note the
**prefix conventions** this tool uses (very few unprefixed ids):

- **Unprefixed/global ids (collision-risk surface, complete):** `hero`, `main-content`, `chapter-nav`,
  `stepper`, `toc-floating`, `quiz-stage`, `contextual-tip`, `ct-body`, `ct-icon`, `ct-label`,
  `ct-close`, `fp-input`, `fp-num`, `fp-label`, `fp-zone-dot`, `qs-result`, `qsr-note`, `qsr-reset`,
  `lplr-welcome-toast`, `score-gauge-wrap`, `score-value`, `score-max`, `score-verdict`,
  `score-breakdown`, `bilanGainGrad` (SVG gradient id), `plan-step-1..4`, `chap1-cover`, `chap2-cover`,
  `chap3-cover`.
- **Prefixed families:** `b-*` (budget, ~40), `i-*` (investisseur, ~120 incl. `i-sec*`, `i-g-*`,
  `i-e-*`, `i-c-*`, `i-plan-*`, `i-expert-*`, `i-view-*`, `i-cmp-*`, `i-macro-*`, `i-pf-*`, `i-proj-*`,
  `i-donut-*`, `i-guided-*`, `i-compare-*`, `i-env-split*`, `i-allocation-detail`, `i-assets-builder`,
  `i-total-*`, `i-filter-*`, `i-builder-reset`, `i-chart-*`), `f-*` (fiscaliste, ~70), `pc-*` (profile
  card, ~22), `bilan-*` (~30), `passerelle-*` (3), `synth-*` (referenced by JS, e.g. `synth-budget-val`,
  `synth-invest-*`, `synth-tax-*`).
- **No id named `overview` or `txn-cards`** appears here — but generic `hero`, `main-content`,
  `score-*`, `plan-step-*`, `stepper`, `quiz-stage`, and `contextual-tip` are the ones most likely to
  clash with another embedded tool. **Recommend namespacing on embed** (e.g. scope under a container and
  rewrite to `inv-*`, or shadow-DOM/iframe) since the JS uses bare `document.getElementById` (global
  lookup), which would grab the host's element if ids collide.

`<canvas>` ids needing isolation per Chart instance: `b-donut`, `i-donut-chart`, `i-chart-guided`,
`i-chart-expert`, `i-chart-compare`, `i-plan-traj-chart` (also `#i-expert-donut-arcs` is an inline-SVG
donut, not Chart.js).

---

## 12. OFFLINE — network dependencies

Only two **load-time** external deps: **Chart.js 4.4.1 CDN** (L25) and **Google Fonts** (L22–24).
Everything else is self-contained: the favicon is an inline `data:` SVG (L21); all charts/gauges are
canvas/SVG; all calculators are pure JS.

**No XHR/`fetch`/WebSocket anywhere.** Note `EMAILJS_CONFIG.enabled = true` (L11538) with keys, **but no
EmailJS SDK is loaded and `emailjs.send()` is never called** — the Bilan "send" goes through
`mailto:` (`window.location.href`, L12522/12527), a **Gmail compose URL** opened in a new tab
(`https://mail.google.com/mail/?view=cm…`, L12560, user-initiated `window.open`), or clipboard copy
(L12575). The `downloadBilanHTML` builds a Blob locally (L12470). So **runtime is fully offline-capable
once Chart.js + fonts are bundled/self-hosted**; the email/Gmail paths are user-triggered navigations,
not background requests. The generated standalone bilan HTML also re-links Google Fonts (L12456) but
that's only in the downloaded file.

---

## 13. RE-MOUNT SAFETY — fresh markup + re-run all blocks in a fresh scope each open

**Yes, it works** if: (a) you inject **fresh markup** each time, (b) you run the four blocks inside a
**fresh function scope per open** (so all `let` chart refs / module state reset), and (c) state lives in
`localStorage` (it does). Then call `init()` (+ `initFearPrelude()`, `initPlannerWiring()`,
`setupPlanStepper()`). What to watch:

1. **Document/window listeners (eval-time)** — `document click` (8587), `window scroll` (11012), and the
   four `DOMContentLoaded` registrations (11527/12628/13036/13120) **stack on every re-eval** because
   they attach to `document`/`window` which survive the markup swap. *Fix:* register these once
   (guard with a `window.__investWired` flag), or attach them to the tool's container instead of
   `document`, or remove+re-add. The scroll-spy + env-split-toggle delegate are the main offenders.
2. **`DOMContentLoaded` won't refire** on a SPA mount — if you re-inject after initial load,
   `readyState!=='loading'`, so the eval-time guards fall to the `else` branches and call
   `initFearPrelude()`/`initPlannerWiring()`/`initV19` immediately, but **`init` is only bound to the
   event (L12628) and will NOT run on its own** — you must call `init()` explicitly after injection.
3. **Charts** — module refs reset to `null` in a fresh scope → clean recreate. In a shared scope you
   must `destroy()` stale `budgetDonut`/`investorDonut`/`guidedChart`/`expertChart`/`compareChart`/
   `plannerTrajChart` (their old canvases are gone). `Chart.defaults` untouched (§5), so no global
   cleanup needed.
4. **IntersectionObservers** — `revealObs` (11015), contextual-tips obs (9904), plan-stepper obs (13072)
   are created fresh per scope; old ones (if scope persists) keep observing detached nodes → leak. Fine
   in a fresh scope.
5. **One-time animations / timers** — `quizAnswer` uses `setTimeout` (380/450 ms), `quizShowResult` uses
   `requestAnimationFrame` for axis bars, `switchMode`/donut use `setTimeout(...,50)` resizes, planner
   debounces with `setTimeout(280)`. All re-create cleanly; none are singletons. `showWelcomeBack` toast
   auto-hides at 5 s.
6. **`window.__bootstrapped`** gate (11456/8815): set true at end of `init()`. On re-mount it stays true
   from a prior run if the same `window` is reused — harmless (it only *enables* DCA propagation in
   `budgetCompute`). If you want first-render parity, reset `window.__bootstrapped=false` before `init()`.
7. **Inline `onclick=` handlers** — header/stepper/TOC/Bilan buttons call global `navTo`, `showBilan`,
   `closeBilan`, `resetAllData`, `window.handleBilan*`, etc. In a fresh **IIFE** scope these must be
   re-exposed on `window` or the inline handlers break (see §2). The `window.*` ones already are.

**Bottom line**: re-injecting fresh DOM + re-running the (single-IIFE-wrapped) script per open is safe
**provided the eval-time document/window listeners are de-duplicated** (guard-once or container-scoped)
and `init()` is invoked explicitly after injection. No hidden singletons beyond those listeners,
observers, and chart refs.
