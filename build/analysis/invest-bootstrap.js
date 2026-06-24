/* =============================================================================
 * invest-bootstrap.js — VERBATIM extracts from src/TAME_Investissement.html
 *
 * Purpose: the top-level init/bootstrap surface needed to (re)render the app
 * after its markup is injected into a container.
 *
 * Every block below is copied EXACTLY (no edits) from the source, with the
 * source line range noted above it. These are NOT meant to run as-is from this
 * file — they reference module-scope globals (STATE, ASSETS, PRESETS, init(),
 * the bind* functions, render* functions, etc.) defined across the 4 <script>
 * blocks of the original document. To re-render after injecting markup, call
 * the MASTER FUNCTION  init()  (and, for the BETA planner sub-tool,
 * initPlannerWiring() + setupPlanStepper()). initFearPrelude() must run too
 * (it is the knowledge-barometer pre-quiz init).
 *
 * MASTER (re)RENDER ENTRYPOINT = init()        (source line 11389)
 *   - init() calls: bindBudgetEvents(), bindInvestorEvents(), bindFiscalEvents(),
 *     bindGlobalNav(), restoreUIFromState(), budgetCompute(), fiscalCompute(),
 *     renderGuidedDetail()/renderBuilder()/updateGuidedSim()/updateExpertSim()/
 *     updateCompareSim() (or investorRenderPortfolio() if a profile exists),
 *     updatePortfolioProjection(), updateStepper(), initContextualTips(),
 *     initBilan(), and finally sets window.__bootstrapped = true.
 *
 * NOTE ON RE-MOUNT: init() ADDS listeners every call (bind* use addEventListener
 * with fresh closures and head.onclick=). It is idempotent only against a FRESH
 * DOM. Re-injecting fresh markup each time the view opens is safe. Re-running
 * init() against the SAME nodes would double-bind. Also the document-level and
 * window-level listeners (see DOCUMENT/WINDOW LISTENERS block) are registered at
 * SCRIPT-EVAL time, not inside init() — running the script body twice in the
 * same window double-registers them. Wrap-all-blocks-in-one-IIFE + run-once is
 * the clean approach; re-render via init() only.
 * ===========================================================================*/


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 8384-8434]  STATE object (module-global; shared by all script blocks)
 * ───────────────────────────────────────────────────────────────────────────*/
const STATE = {
  schemaVersion: 1,   // version du schéma persisté — bump => reset/migration propre au load (Feature 1)
  budget: {
    incomeTotal: 0,
    fixedTotal: 0,
    varTotal: 0,
    debtTotal: 0,
    funPct: 60,
    libre: 0,
    funAmt: 0,
    invAmt: 0,
    cr: 0, dr: 0, sr: 0, funR: 0
  },
  investor: {
    // ── Quiz step-by-step (Étape 2) ──
    quiz: {
      currentStep: 1,             // 1..5
      answers: {},                // { horizon: 1..4, filet: 1..4, concentration: 1..4, tolerance: 1..4, experience: 1..4 }
      stopped: null,              // 'horizon' | 'filet' | null
      completed: false
    },
    // ── Legacy compat ──
    answers: {},
    priorities: new Set(),
    profile: null,
    // Mode Guidé (par défaut)
    guided:  { capital: 0, dca: 0, horizon: 20, strategy: null, dcaManual: false },
    // Mode Expert (builder par actif)
    expert:  { capital: 0, dca: 0, horizon: 20, mode: 'dca', activePreset: null, dcaManual: false },
    // Pondérations actuelles du builder
    weights: null,  // initialisé à PRESETS.equilibre au bootstrap (mais non affiché tant qu'aucun preset choisi)
    // Mode Comparateur
    compare: { capital: 0, dca: 0, horizon: 20, a: null, b: null },
    // Mode actif
    activeMode: 'guided'
  },
  fisc: {
    situation: 1,
    enfants: 0,
    salaires: 0,
    retraite: 0,
    chomage: 0,
    foncier: 0,
    bnc: 0,
    per: 0,
    pension: 0,
    cap: { dividendes: 0, pv: 0, av: 0, interets: 0, scpi: 0 },
    leviers: { perLev: 0, donGen: 0, donPers: 0, dom: 0, frInput: 0, scoColl: 0, scoLyc: 0, scoSup: 0, ifi: 0 },
    ir_net_final: 0, tmi: 0, teff: 0
  }
};


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 8507-8511]  SYNCHRONOUS state restore at script-eval time
 * (runs BEFORE any DOMContentLoaded handler — STATE needs no DOM)
 * ───────────────────────────────────────────────────────────────────────────*/
// Feature 1 — restauration SYNCHRONE au plus tôt, avant tout handler DOMContentLoaded.
// initFearPrelude (baromètre) et d'autres init se déclenchent sur DOMContentLoaded AVANT init() et
// appellent saveState(). Si loadState() n'a pas encore tourné, ils écraseraient l'état persisté avec
// les valeurs par défaut. On charge donc ici, à l'exécution du script (STATE n'a pas besoin du DOM).
const STATE_RESTORED_ON_LOAD = loadState();


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 11389-11474]  MASTER INIT — the function to call to (re)render the app
 * ───────────────────────────────────────────────────────────────────────────*/
function init() {
  const stateRestored = STATE_RESTORED_ON_LOAD;   // déjà chargé en synchrone (cf. STATE_RESTORED_ON_LOAD)

  // Pondérations par défaut : si un profil existe et pas de poids saisis → preset du profil
  // Sinon → tout à zéro (l'utilisateur saisit manuellement ou clique sur un preset)
  if (!STATE.investor.weights) {
    if (STATE.investor.profile) {
      STATE.investor.weights = { ...PRESETS[STATE.investor.profile.preset] };
      STATE.investor.expert.activePreset = STATE.investor.profile.preset;
    } else {
      // Tout à zéro — l'utilisateur saisira manuellement ou cliquera sur un preset
      const empty = {};
      ASSETS.forEach(a => empty[a.id] = 0);
      STATE.investor.weights = empty;
    }
  }

  bindBudgetEvents();
  bindInvestorEvents();
  bindFiscalEvents();
  bindGlobalNav();

  // Reveal observer (animation seulement — l'opacity de base est à 1)
  document.querySelectorAll('.reveal').forEach(el => revealObs.observe(el));

  // Restaurer l'UI depuis le state
  restoreUIFromState();

  // Feature 1 : si on a vraiment restauré un état, saluer discrètement le retour.
  if (stateRestored) showWelcomeBack();

  // Calculs initiaux
  budgetUpdateSliders();
  budgetCompute();
  fiscalCompute();

  // Investisseur : profil + portefeuille + 3 simulateurs
  // Aucun profil par défaut : l'utilisateur doit répondre au questionnaire pour révéler sa stratégie.
  // Les vues du chapitre II (donut, projection, scénarios) restent vides tant qu'aucun profil n'est défini.
  // Propage le DCA du budget vers les modes guidé/expert (avant que __bootstrapped soit posé)
  const _initDCA = Math.min(3000, Math.round(STATE.budget.invAmt || 0));
  if (_initDCA > 0) {
    if (STATE.investor.guided && !STATE.investor.guided.dcaManual) STATE.investor.guided.dca = _initDCA;
    if (STATE.investor.expert && !STATE.investor.expert.dcaManual) STATE.investor.expert.dca = _initDCA;
  }
  if (STATE.investor.profile) {
    investorRenderPortfolio();  // appelle renderBuilder + les 3 updateSims
  } else {
    // Le quiz ne pré-attribue pas de profil. L'utilisateur doit répondre aux 5 questions.
    // Si state restauré complet, restoreUIFromState appellera quizShowResult automatiquement.
    renderGuidedDetail();
    renderBuilder();
    updateGuidedSim();
    updateExpertSim();
    updateCompareSim();
  }
  // Force la mise à jour de la projection patrimoniale (image 3 du Chap II)
  try { updatePortfolioProjection(); } catch(e) { console.error('[init] updatePortfolioProjection:', e); }
  // Met à jour les valeurs des sliders DCA/capital côté DOM après le profil par défaut
  try {
    const gDcaOut = document.getElementById('i-g-dca-out');
    const gDcaSlider = document.getElementById('i-g-dca');
    if (gDcaSlider && _initDCA > 0) gDcaSlider.value = _initDCA;
    if (gDcaOut && _initDCA > 0) gDcaOut.textContent = fmt(_initDCA);
  } catch(e) { console.error('[init] sync DCA sliders:', e); }
  updateAllDCAResetBtns();

  window.__bootstrapped = true;
  try { updateStepper(); } catch(e) { console.error('[init] updateStepper:', e); }
  try { initContextualTips(); } catch(e) { console.error('[init] initContextualTips:', e); }
  try { initFeedbackForm(); } catch(e) { console.error('[init] initFeedbackForm:', e); }
  try { initBilan(); } catch(e) { console.error('[init] initBilan:', e); }

  // ─── FORCE CLEAN STATE INVESTISSEUR AU CHARGEMENT ───
  // Le quiz step-by-step gère son propre état persistant (STATE.investor.quiz).
  // On garantit ici que rien de legacy ne pollue le DOM.
  try {
    STATE.investor.answers = {};
    STATE.investor.priorities = new Set();
    // Le quiz n'est PAS reset ici — sa persistance est gérée par localStorage normalement
    if (!STATE.investor.quiz) STATE.investor.quiz = { currentStep: 1, answers: {}, stopped: null, completed: false };
    const portfolioEmpty = document.getElementById('i-portfolio-empty');
    if (portfolioEmpty && !STATE.investor.profile) portfolioEmpty.style.display = 'block';
  } catch(e) { console.error('[init] force-clean investor state:', e); }

}


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 11286-11387]  restoreUIFromState() — re-hydrates DOM from STATE
 *   (called by init(); will auto re-run quizShowResult() via setTimeout if the
 *    quiz was completed — see line 11308)
 * ───────────────────────────────────────────────────────────────────────────*/
function restoreUIFromState() {
  // ── Investisseur : restaurer le quiz (réponses + step) ──
  const q = STATE.investor.quiz;
  if (q && q.answers) {
    const keys = Object.keys(q.answers);
    // Si on détecte un ancien format (5 questions : filet/concentration/experience),
    // on reset proprement — incompatible avec le quiz 3 questions actuel
    const hasLegacy = keys.some(k => ['filet', 'concentration', 'experience'].includes(k));
    if (hasLegacy) {
      STATE.investor.quiz = { currentStep: 1, answers: {}, stopped: null, completed: false };
      STATE.investor.answers = {};
      STATE.investor.profile = null;
      saveState();
    } else {
      Object.entries(q.answers).forEach(([key, val]) => {
        const question = document.querySelector(`.qs-question[data-quiz-key="${key}"]`);
        if (!question) return;
        question.querySelectorAll('.qq-opt').forEach(opt => {
          opt.classList.toggle('selected', parseInt(opt.dataset.val, 10) === val);
        });
      });
      if (q.completed) {
        setTimeout(() => quizShowResult(), 50);
      } else if (q.currentStep && q.currentStep > 1) {
        quizShowStep(q.currentStep);
      }
      quizUpdateProgress();
    }
  }

  // Mode actif
  document.querySelectorAll('.mode-switch-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === STATE.investor.activeMode);
  });
  document.querySelectorAll('.sim-view').forEach(v => v.classList.remove('active'));
  const tgt = document.getElementById('i-view-' + STATE.investor.activeMode);
  if (tgt) tgt.classList.add('active');

  // ── Mode Guidé : sliders + stratégie ──
  if (STATE.investor.guided) {
    const g = STATE.investor.guided;
    const cap = document.getElementById('i-g-capital');
    const dca = document.getElementById('i-g-dca');
    const hor = document.getElementById('i-g-horizon');
    if (cap) cap.value = g.capital;
    if (dca) dca.value = Math.min(3000, g.dca);
    if (hor) hor.value = g.horizon;
    setText('i-g-capital-out', fmt(g.capital));
    setText('i-g-dca-out',     fmt(g.dca));
    setText('i-g-horizon-out', g.horizon + ' ans');
    document.querySelectorAll('.strategy-card').forEach(c => {
      c.classList.toggle('selected', c.dataset.strategy === g.strategy);
    });
  }

  // ── Mode Expert : sliders + toggle DCA/lump + preset actif ──
  if (STATE.investor.expert) {
    const e = STATE.investor.expert;
    const cap = document.getElementById('i-e-capital');
    const dca = document.getElementById('i-e-dca');
    const hor = document.getElementById('i-e-horizon');
    if (cap) cap.value = e.capital;
    if (dca) dca.value = Math.min(3000, e.dca);
    if (hor) hor.value = e.horizon;
    setText('i-e-capital-out', fmt(e.capital));
    setText('i-e-dca-out',     fmt(e.dca));
    setText('i-e-horizon-out', e.horizon + ' ans');
    document.querySelectorAll('#i-e-mode-toggle .toggle-opt').forEach(o => {
      o.classList.toggle('active', o.dataset.mode === e.mode);
    });
    if (e.activePreset) {
      document.querySelectorAll('.preset-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.preset === e.activePreset);
      });
    }
  }
  // Pondérations par défaut si non initialisées
  if (!STATE.investor.weights) STATE.investor.weights = { ...PRESETS.equilibre };

  // ── Mode Comparateur : sélections + sliders ──
  if (STATE.investor.compare) {
    const c = STATE.investor.compare;
    const cap = document.getElementById('i-c-capital');
    const dca = document.getElementById('i-c-dca');
    const hor = document.getElementById('i-c-horizon');
    if (cap) cap.value = c.capital;
    if (dca) dca.value = Math.min(3000, c.dca);
    if (hor) hor.value = c.horizon;
    setText('i-c-capital-out', fmt(c.capital));
    setText('i-c-dca-out',     fmt(c.dca));
    setText('i-c-horizon-out', c.horizon + ' ans');
    document.querySelectorAll('#i-compare-options-a .compare-opt').forEach(o => {
      o.classList.toggle('selected-a', o.dataset.compProfile === c.a);
    });
    document.querySelectorAll('#i-compare-options-b .compare-opt').forEach(o => {
      o.classList.toggle('selected-b', o.dataset.compProfile === c.b);
    });
  }

  // ── Fiscaliste : enfants ──
  if (STATE.fisc.enfants > 0) fiscalSetEnfants(STATE.fisc.enfants);
}


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 10966-10974]  navTo() — the ONLY "router": scroll-to-section.
 * There is NO show/hide router and NO hash routing. All sections coexist in one
 * long scroll page; "navigation" is smooth-scroll to a section id.
 * ───────────────────────────────────────────────────────────────────────────*/
function navTo(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const headerH = (document.querySelector('.site-header')?.offsetHeight || 64)
                + (document.querySelector('.stepper-bar')?.offsetHeight  || 56)
                + 8;
  const top = el.getBoundingClientRect().top + window.scrollY - headerH;
  window.scrollTo({ top, behavior: 'smooth' });
}


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 10976-11010]  updateStepper() — scroll-spy that drives the sticky
 * stepper / chapter nav / floating TOC active states.
 * ───────────────────────────────────────────────────────────────────────────*/
function updateStepper() {
  const sections = [
    'chap1-cover','b-sec1','b-sec2','b-sec3',
    'chap2-cover','i-sec1','i-sec2','i-sec3','i-sec4',
    'chap3-cover','f-sec1','f-sec2','f-sec3','f-sec4'
  ];
  const midY = window.scrollY + window.innerHeight * 0.4;
  let activeIdx = -1;
  sections.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el && el.offsetTop <= midY) activeIdx = i;
  });
  document.querySelectorAll('.step-btn').forEach(btn => {
    const section = btn.dataset.section;
    const idx = sections.indexOf(section);
    btn.classList.toggle('active', idx === activeIdx);
    btn.classList.toggle('done', idx >= 0 && idx < activeIdx);
  });
  // Chapter nav (top header)
  let currentChap = 'hero';
  if (activeIdx >= 9) currentChap = 'chap3';
  else if (activeIdx >= 4) currentChap = 'chap2';
  else if (activeIdx >= 0) currentChap = 'chap1';
  document.querySelectorAll('.chap-btn').forEach(b => {
    b.classList.toggle('current', b.dataset.chap === currentChap);
  });
  // TOC flottant
  const toc = document.getElementById('toc-floating');
  if (window.scrollY > 400) toc.classList.add('show');
  else toc.classList.remove('show');
  document.querySelectorAll('.toc-btn[data-jump]').forEach(b => {
    const idx = sections.indexOf(b.dataset.jump);
    b.classList.toggle('active', idx === activeIdx);
  });
}


/* ═════════════════════════════════════════════════════════════════════════════
 * TOP-LEVEL BOOTSTRAP TRIGGERS (registered at SCRIPT-EVAL time, NOT inside init)
 * These are the DOMContentLoaded / readyState entrypoints. On re-mount you do
 * NOT re-run these — you call init() (+ planner inits) directly once markup is in.
 * ════════════════════════════════════════════════════════════════════════════*/

/* [SOURCE 11012]  scroll listener that drives updateStepper (WINDOW-level) */
window.addEventListener('scroll', updateStepper, { passive: true });

/* [SOURCE 11527-11531]  knowledge-barometer pre-quiz init */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFearPrelude);
} else {
  initFearPrelude();
}

/* [SOURCE 12628]  THE primary app init trigger */
document.addEventListener('DOMContentLoaded', init);

/* [SOURCE 13036-13040]  BETA planner (Monte-Carlo) init trigger */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPlannerWiring);
} else {
  setTimeout(initPlannerWiring, 100);
}

/* [SOURCE 13111-13126]  BETA planner stepper IIFE init trigger */
(function() {
  function initV19() {
    setupPlanStepper();
    // Premier rendu une fois que tout est en place
    if (typeof updatePlannerView === 'function') {
      try { updatePlannerView(); } catch (e) { /* silent */ }
    }
  }
  if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { setTimeout(initV19, 80); });
    } else {
      setTimeout(initV19, 80);
    }
  }
})();


/* ═════════════════════════════════════════════════════════════════════════════
 * DOCUMENT/WINDOW LISTENERS registered at SCRIPT-EVAL time (for re-mount dedup).
 * On a true re-mount where the script body is re-evaluated, these re-register
 * and must be guarded. Full inventory:
 *   - [8587]  document.addEventListener('click', …)   // .env-split-toggle delegate
 *   - [11012] window.addEventListener('scroll', updateStepper, {passive:true})
 *   - [11527/11528] document.addEventListener('DOMContentLoaded', initFearPrelude)
 *   - [12628] document.addEventListener('DOMContentLoaded', init)
 *   - [13037] document.addEventListener('DOMContentLoaded', initPlannerWiring)
 *   - [13121] document.addEventListener('DOMContentLoaded', () => setTimeout(initV19,80))
 *   (Plus IntersectionObservers created at eval time: revealObs[11015],
 *    contextual-tips obs[inside initContextualTips], plan-stepper obs[inside
 *    setupPlanStepper]. These observe nodes; re-eval creates duplicate observers.)
 * ════════════════════════════════════════════════════════════════════════════*/

/* [SOURCE 8587-8594]  document-level click delegate (envelope-split toggle) */
document.addEventListener('click', e => {
  const t = e.target.closest('.env-split-toggle');
  if (!t) return;
  const details = t.parentElement.querySelector('.env-split-details');
  if (!details) return;
  details.classList.toggle('open');
  t.firstChild && (t.firstChild.textContent = details.classList.contains('open') ? '▾ Détail : quel actif va où' : '▸ Détail : quel actif va où');
});


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 11025-11063]  bindBudgetEvents()  (adds input/click listeners — call once per fresh DOM)
 * ───────────────────────────────────────────────────────────────────────────*/
function bindBudgetEvents() {
  // Inputs initiaux
  document.querySelectorAll('.b-income-input, .b-fixed-input, .b-var-input, .b-debt-input')
    .forEach(el => el.addEventListener('input', budgetCompute));
  // Slider
  document.getElementById('b-fun-slider').addEventListener('input', () => { budgetUpdateSliders(); budgetCompute(); });
  // Boutons supprimer initiaux
  document.querySelectorAll('#b-sec1 .f-del').forEach(btn => {
    btn.addEventListener('click', () => { btn.closest('.field-row').remove(); budgetCompute(); });
  });
  // Boutons "Ajouter"
  document.querySelectorAll('#b-sec1 .add-line').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.add;
      if (t === 'income') budgetAddRow('b-income-list', 'Revenu complémentaire', 0, 'b-income-input');
      else if (t === 'fixed') budgetAddRow('b-fixed-list', 'Charge fixe', 0, 'b-fixed-input');
      else if (t === 'var') budgetAddRow('b-var-list', 'Dépense variable', 0, 'b-var-input');
      else if (t === 'debt') budgetAddRow('b-debt-list', 'Crédit immo, conso…', 0, 'b-debt-input');
    });
  });
  // Hover legend ↔ donut
  const legend = document.getElementById('b-donut-legend');
  legend.addEventListener('mouseover', e => {
    const row = e.target.closest('.legend-row');
    if (!row || !budgetDonut || !budgetSegsRef.length) return;
    const idx = Array.from(row.parentElement.children).indexOf(row);
    const base = budgetSegsRef.map(s => SEG[s.key].color);
    budgetDonut.data.datasets[0].backgroundColor = base.map((c, i) => i === idx ? c : c + '55');
    budgetDonut.update('none');
    document.querySelectorAll('.legend-row').forEach(r => r.classList.remove('highlighted'));
    row.classList.add('highlighted');
  });
  legend.addEventListener('mouseleave', () => {
    if (!budgetDonut || !budgetSegsRef.length) return;
    budgetDonut.data.datasets[0].backgroundColor = budgetSegsRef.map(s => SEG[s.key].color);
    budgetDonut.update('none');
    document.querySelectorAll('.legend-row').forEach(r => r.classList.remove('highlighted'));
  });
}

/* NOTE: bindInvestorEvents() [11065-11242], bindFiscalEvents() [11244-11277],
 * and bindGlobalNav() [11279-11284] follow the same pattern (addEventListener
 * on the freshly-injected nodes). They are NOT duplicated here to keep this file
 * focused on the bootstrap/master-init surface; see invest-signals.js for the
 * signal/engine functions, and the source for the remaining bind* bodies. */


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 11494-11525]  initFearPrelude() — knowledge-barometer slider init
 * ───────────────────────────────────────────────────────────────────────────*/
function initFearPrelude() {
  const input = document.getElementById('fp-input');
  const numEl = document.getElementById('fp-num');
  const lblEl = document.getElementById('fp-label');
  const dotEl = document.getElementById('fp-zone-dot');
  if (!input || !numEl || !lblEl) return;

  function update() {
    const v = parseInt(input.value, 10);
    const safe = (isNaN(v) ? 5 : v);
    numEl.textContent = safe;
    lblEl.textContent = FP_LABELS[safe] || '';
    // Indicateur de zone chromatique : rouge (0-3) / or (4-7) / vert (8-10) — sens connaissance croissante
    if (dotEl) {
      const zone = (safe <= 3) ? 'red' : (safe <= 7) ? 'gold' : 'green';
      dotEl.classList.remove('zone-green', 'zone-gold', 'zone-red');
      dotEl.classList.add('zone-' + zone);
    }
    // Persiste dans le STATE investisseur (clé non utilisée par le scoring, juste contextuelle)
    if (typeof STATE !== 'undefined' && STATE.investor) {
      STATE.investor.financeKnowledge = safe;
      if (typeof saveState === 'function') saveState();
    }
  }

  // Restaure depuis le state si déjà rempli (compat : ancien nom financeAnxiety ignoré, c'était une autre dimension)
  if (typeof STATE !== 'undefined' && STATE.investor && typeof STATE.investor.financeKnowledge === 'number') {
    input.value = STATE.investor.financeKnowledge;
  }
  update();
  input.addEventListener('input', update);
}


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 12980-13033]  initPlannerWiring() — BETA Monte-Carlo planner wiring
 * (independent sub-tool; needs its own re-init after markup injection)
 * ───────────────────────────────────────────────────────────────────────────*/
function initPlannerWiring() {
  if (!document.getElementById('i-plan-target')) return;

  // Pre-fill depuis quiz/profile si disponible
  if (STATE.investor && STATE.investor.profile && STATE.investor.profile.preset) {
    PLANNER_STATE.profile = STATE.investor.profile.preset;
  }
  if (STATE.investor && STATE.investor.expert) {
    if (typeof STATE.investor.expert.capital === 'number' && STATE.investor.expert.capital > 0) PLANNER_STATE.capital = STATE.investor.expert.capital;
    if (typeof STATE.investor.expert.dca === 'number' && STATE.investor.expert.dca > 0)         PLANNER_STATE.dca = STATE.investor.expert.dca;
    if (typeof STATE.investor.expert.horizon === 'number' && STATE.investor.expert.horizon > 0) PLANNER_STATE.horizon = STATE.investor.expert.horizon;
  }
  // Set active profile button
  document.querySelectorAll('.ppr-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.profile === PLANNER_STATE.profile);
  });
  syncPlannerInputs();

  // Goal type buttons
  document.querySelectorAll('.plan-goal-btn').forEach(function(b) {
    b.addEventListener('click', function() { applyGoalType(b.dataset.goalType); });
  });
  // Profile buttons
  document.querySelectorAll('.ppr-btn').forEach(function(b) {
    b.addEventListener('click', function() { applyProfile(b.dataset.profile); });
  });
  // Apply lever buttons
  document.querySelectorAll('[data-apply-lever]').forEach(function(b) {
    b.addEventListener('click', function() { applyLever(b.dataset.applyLever); });
  });
  // Stress controls
  // Inputs (debounced)
  let recalcTimer = null;
  function scheduleRecalc() {
    if (recalcTimer) clearTimeout(recalcTimer);
    recalcTimer = setTimeout(updatePlannerView, 280);
  }
  function bindNumInput(id, key) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', function() {
      const v = parseFloat(el.value) || 0;
      PLANNER_STATE[key] = v;
      scheduleRecalc();
    });
  }
  bindNumInput('i-plan-target', 'target');
  bindNumInput('i-plan-horizon', 'horizon');
  bindNumInput('i-plan-capital', 'capital');
  bindNumInput('i-plan-dca', 'dca');

  // Premier render
  updatePlannerView();
}
