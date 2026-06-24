/* =============================================================================
 * invest-signals.js — VERBATIM extracts from src/TAME_Investissement.html
 *
 * Goal: compute the "signals" {profil, allocationCible} WITHOUT the UI, plus the
 * fiscal engine entry function so its outputs can be FROZEN for a non-regression
 * test. Every block is copied EXACTLY from the source, line ranges noted.
 *
 * ── HOW TO COMPUTE {profil, allocationCible} headlessly ──────────────────────
 *   const answers = { horizon, tolerance, poids, experience }; // each 1..4
 *   const det = quizDetermineProfile(answers);   // -> { key, forced, reason }
 *   const profil = det.key;                       // 'prudent'|'equilibre'|'dynamique'|'offensif'
 *
 *   // Target allocation — TWO equivalent representations exist in the source:
 *   //  (A) Coarse 3-bucket %, hardcoded per profile (the "allocation cible"):
 *   const allocationCible = PROFILE_ALLOCATION_Q[profil]; // {actions, bonds, gold}
 *   //  (B) Full per-asset weights map (33 assets) used by the charts/sims:
 *   const targetWeights = PRESETS[profil];                // PROFILES[profil].preset === profil
 *   //      computeWeightsStats(PRESETS[profil]) -> { rate, vol }  (expected annual % & vol)
 *
 *   // In the running app these live at:
 *   //   STATE.investor.quiz.answers      <- the 4 quiz answers (1..4)
 *   //   STATE.investor.profile           <- { key, ...PROFILES[key] } set by quizShowResult()
 *   //   STATE.investor.weights           <- { ...PRESETS[profile.preset] } (per-asset target)
 *
 * NOTE: PROFILES[k].preset === k for all four keys, so PRESETS[profil] is the
 * target per-asset allocation. PROFILE_RATE_Q / PROFILE_PROBA give the headline
 * rate per profile, but the chart path uses computeWeightsStats(PRESETS[k]).rate
 * (slightly different blended number).
 * ===========================================================================*/


/* ═════════════════════════════════════════════════════════════════════════════
 * SECTION 1 — RISK PROFILE FROM QUIZ ANSWERS
 * ════════════════════════════════════════════════════════════════════════════*/

/* [SOURCE 9039]  the 4 quiz keys (order of questions) */
const QUIZ_KEYS = ['horizon', 'tolerance', 'poids', 'experience'];


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 9142-9181]  quizDetermineProfile(answers) — THE profile resolver.
 * Input: answers = { horizon, tolerance, poids, experience }, each integer 1..4.
 * Output: { key, forced, reason } where key ∈ prudent|equilibre|dynamique|offensif.
 * Weighted additive score, then "caps" (garde-fous) downgrade but never block.
 * ───────────────────────────────────────────────────────────────────────────*/
function quizDetermineProfile(answers) {
  // Score asymétrique : la tolérance pèse le plus, c'est la plus prédictive.
  // L'expérience modère sans dominer (poids modéré pour ne pas écraser les autres).
  const horizonMap    = { 1: -2, 2:  1, 3:  3, 4:  4 };
  const toleranceMap  = { 1: -5, 2: -1, 3:  3, 4:  5 };
  const poidsMap      = { 1: -3, 2:  0, 3:  2, 4:  3 };
  const experienceMap = { 1: -1, 2: -3, 3:  1, 4:  2 };

  const score =
    (horizonMap[answers.horizon]       || 0) +
    (toleranceMap[answers.tolerance]   || 0) +
    (poidsMap[answers.poids]           || 0) +
    (experienceMap[answers.experience] || 0);

  // Range réel : -13 (tout en 1 sauf tolérance=panique) à +14 (tout en 4)
  let key;
  if (score <= -4)      key = 'prudent';
  else if (score <= 6)  key = 'equilibre';
  else if (score <= 11) key = 'dynamique';
  else                  key = 'offensif';

  // Garde-fous (caps) : on dégrade mais on n'arrête jamais le user
  const order = ['prudent', 'equilibre', 'dynamique', 'offensif'];
  let reason = null;
  function cap(maxKey, r) {
    if (order.indexOf(key) > order.indexOf(maxKey)) {
      key = maxKey;
      if (!reason) reason = r;
    }
  }

  if (answers.tolerance === 1)                          { cap('prudent',   'panic_full');     }
  if (answers.horizon === 1)                            { cap('equilibre', 'short_horizon'); }
  if (answers.poids === 1)                              { cap('equilibre', 'concentration'); }
  if (answers.experience === 2)                         { cap('equilibre', 'past_panic');    }
  // Garde-fou sur-confiance : jamais investi + prétend racheter à -30 % → cap Dynamique
  if (answers.experience === 1 && answers.tolerance === 4) { cap('dynamique', 'overconfidence'); }

  return { key: key, forced: (reason !== null), reason: reason };
}


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 9205-9298]  quizShowResult() — where the resolved profile is COMMITTED
 * to STATE (UI-coupled, but shows exactly where profil lands in STATE):
 *   STATE.investor.profile = { key: det.key, ...PROFILES[det.key] };
 *   STATE.investor.quiz.completed = true;
 * Quoted in full so the persistence point is unambiguous.
 * ───────────────────────────────────────────────────────────────────────────*/
function quizShowResult() {
  const a = STATE.investor.quiz.answers;
  const det = quizDetermineProfile(a);
  const p = PROFILES[det.key];

  // Persist
  STATE.investor.profile = { key: det.key, ...p };
  STATE.investor.quiz.completed = true;

  // Cache les questions
  document.querySelectorAll('.qs-question').forEach(q => q.classList.remove('active'));

  // Affiche result card
  const result = document.getElementById('qs-result');
  if (result) { result.hidden = false; result.classList.add('show'); }

  // Tagline + card
  setText('qsr-tagline', PROFILE_TAGLINES_Q[det.key] || '');

  // ─── Nouvelle carte d'identité d'investisseur ───
  setText('pc-name', p.name);
  setText('pc-mention', PROFILE_MENTIONS[det.key] || '');
  setText('pc-keyphrase', PROFILE_KEYPHRASES[det.key] || '');
  setText('pc-stat-return', p.return);
  setText('pc-stat-vol', p.vol);
  setText('pc-stat-drawdown', p.drawdown);
  setText('pc-stat-horizon', p.horizon);

  // Signature : 3 axes calculés en live depuis les réponses individuelles (Feature 2)
  const axes = computeProfileAxes(a);
  ['risque','horizon','conviction'].forEach(axis => {
    const fill = document.getElementById('pc-axis-' + axis + '-fill');
    const pct  = document.getElementById('pc-axis-' + axis + '-pct');
    const note = document.getElementById('pc-axis-' + axis + '-note');
    const v = axes[axis] || 0;
    // Reset puis anime
    if (fill) { fill.style.width = '0%'; requestAnimationFrame(() => { fill.style.width = v + '%'; }); }
    if (pct)  pct.textContent = v + '%';
    if (note) note.textContent = axisComment(axis, v);
  });

  // Stress-test rétrospectif
  const stress = PROFILE_STRESSTEST[det.key];
  if (stress) {
    setText('pc-stresstest-event', stress.event);
    setText('pc-stresstest-loss', '-' + stress.loss + ' %');
    setText('pc-stresstest-recovery', stress.recovery + ' mois');
  }

  // Compat anciens IDs (au cas où des références traînent ailleurs)
  setText('qsrd-name', p.name);
  setHTML('qsrd-desc', p.desc);
  setText('qsrd-return', p.return);
  setText('qsrd-vol', p.vol);
  setText('qsrd-drawdown', p.drawdown);
  setText('qsrd-horizon', p.horizon);

  // Note discrète si caps déclenchés
  const noteEl = document.getElementById('qsr-note');
  if (noteEl) {
    if (det.forced && PROFILE_NOTES_Q[det.reason]) {
      noteEl.textContent = PROFILE_NOTES_Q[det.reason];
      noteEl.style.display = 'block';
    } else {
      noteEl.style.display = 'none';
    }
  }

  // Synthèses externes
  setText('synth-invest-val', p.name);
  setText('synth-invest-sub', `${p.return}/an · vol ${p.vol}`);
  setText('passerelle-profile', p.name);

  // Legacy synth ids (au cas où d'autres parties du doc s'y accrochent)
  const oldResult = document.getElementById('i-profile-result');
  if (oldResult) oldResult.classList.add('show');
  setText('i-profile-name', p.name);
  setHTML('i-profile-desc', p.desc);
  setText('i-trait-return', p.return);
  setText('i-trait-vol', p.vol);
  setText('i-trait-drawdown', p.drawdown);
  setText('i-trait-horizon', p.horizon);

  // Progress dots = done
  document.querySelectorAll('.qsp-dot').forEach((dot) => {
    dot.classList.remove('active');
    dot.classList.add('done');
  });

  // Met à jour le portefeuille (étape 3+)
  if (typeof investorRenderPortfolio === 'function') investorRenderPortfolio();

  saveState();
}


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 9301-9328]  quizAnswer(key, value) — records an answer & advances.
 * After step 4 it calls quizShowResult(). Writes both:
 *   STATE.investor.quiz.answers[key] = value;  (canonical)
 *   STATE.investor.answers[key]      = value;  (legacy compat mirror)
 * ───────────────────────────────────────────────────────────────────────────*/
function quizAnswer(key, value) {
  STATE.investor.quiz.answers[key] = value;
  // Legacy compat
  STATE.investor.answers[key] = value;

  // Update la sélection visuelle
  const question = document.querySelector(`.qs-question[data-quiz-key="${key}"]`);
  if (question) {
    question.querySelectorAll('.qq-opt').forEach(opt => {
      opt.classList.toggle('selected', parseInt(opt.dataset.val, 10) === value);
    });
    const chosen = question.querySelector(`.qq-opt[data-val="${value}"]`);
    if (chosen) {
      chosen.classList.add('pulse');
      setTimeout(() => chosen.classList.remove('pulse'), 380);
    }
  }

  // Avance à la question suivante (ou au résultat)
  const currentStep = STATE.investor.quiz.currentStep;
  if (currentStep < 4) {
    setTimeout(() => quizShowStep(currentStep + 1), 450);
  } else {
    setTimeout(() => quizShowResult(), 450);
  }

  saveState();
}


/* ═════════════════════════════════════════════════════════════════════════════
 * SECTION 2 — TARGET ALLOCATION (allocation cible) FROM PROFILE
 * ════════════════════════════════════════════════════════════════════════════*/

/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 9132-9137]  PROFILE_ALLOCATION_Q — the coarse 3-bucket "allocation
 * cible" per profile (%actions / %obligations / %or). This is the simplest
 * {profil -> allocationCible} mapping.
 * ───────────────────────────────────────────────────────────────────────────*/
const PROFILE_ALLOCATION_Q = {
  prudent:   { actions: 26, bonds: 69, gold: 5 },
  equilibre: { actions: 58, bonds: 37, gold: 5 },
  dynamique: { actions: 77, bonds: 18, gold: 5 },
  offensif:  { actions: 87, bonds: 8,  gold: 5 }
};

/* [SOURCE 9139]  PROFILE_RATE_Q — headline expected annual rate per profile */
const PROFILE_RATE_Q = { prudent: 0.041, equilibre: 0.062, dynamique: 0.076, offensif: 0.086 };


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 9000-9029]  PROFILES — single source of truth for the 4 strategies.
 * Each profile's .preset names its PRESETS key (preset === key for all four).
 * (Long .desc/.thesis strings retained verbatim.)
 * ───────────────────────────────────────────────────────────────────────────*/
const PROFILES = {
  prudent: {
    name: 'Prudent',
    thesis: "Capital protégé. Majoritairement fonds euro garanti et obligations européennes, complété d'un peu de Bourse et d'une touche d'or. Zéro action individuelle.",
    desc: "<strong>Pour qui privilégie la tranquillité d'esprit avant tout.</strong> Le portefeuille tient sur trois piliers solides : fonds euro à capital garanti, obligations européennes, et une touche d'or pour couvrir les grandes crises. À côté, une part minoritaire d'ETF mondiaux empêche l'inflation d'éroder ton pouvoir d'achat. <strong>Aucune action individuelle, aucun pari spéculatif.</strong><br><br><strong>Idéal pour</strong> : préparer un achat immobilier à 5-10 ans, financer les études d'un enfant, sécuriser un capital proche de la retraite, ou démarrer sereinement avant d'éventuellement monter en risque plus tard.<br><br><strong>À quoi t'attendre</strong> : autour de 4 %/an en moyenne — soit plus du double du Livret A, pour un risque qui reste très contenu. Dans les pires moments historiques, ce type de portefeuille a baissé d'environ 15 % avant de se ressaisir en quelques mois.",
    return: '~4,2%', vol: '~5,6%', drawdown: '~ -15%', horizon: '5 ans minimum',
    preset: 'prudent'
  },
  equilibre: {
    name: 'Équilibré',
    thesis: "L'allocation « 60/40 » du conseil patrimonial, modernisée. Deux tiers en actions mondiales (avec plafonds stricts), un tiers en supports défensifs.",
    desc: "<strong>Le classique « 60/40 » modernisé</strong> — l'allocation que les gestionnaires de patrimoine recommandent depuis des décennies, et pour cause : elle a traversé toutes les crises majeures des 50 dernières années en remontant à chaque fois. <strong>Deux tiers en actions mondiales</strong> (un socle d'ETF diversifié monde/Europe/émergents + une sélection de grandes entreprises solides), <strong>un tiers en supports défensifs</strong> (obligations européennes + fonds euro garanti), une touche d'or. <strong>Aucune action individuelle ne pèse plus de 2 %</strong> du portefeuille : aucun mauvais choix isolé ne peut faire dérailler l'ensemble.<br><br><strong>Idéal pour</strong> : actifs avec 8 à 15 ans devant eux qui veulent construire un vrai patrimoine sans surveiller les marchés — le compromis le plus éprouvé entre performance et sommeil tranquille.<br><br><strong>À quoi t'attendre</strong> : autour de 6 %/an en moyenne, soit quatre fois le Livret A. Lors des grandes crises (2008, 2020), ce type de portefeuille a baissé d'environ 25 % avant de retrouver son niveau en 2 à 5 ans — comme à chaque fois depuis 50 ans.",
    return: '~6,1%', vol: '~9,3%', drawdown: '~ -23%', horizon: '8 ans minimum',
    preset: 'equilibre'
  },
  dynamique: {
    name: 'Dynamique',
    thesis: "Croissance long terme avec garde-fous. Trois quarts en actions (ETF mondiaux + géants tech + thématiques porteuses), un quart en filet de sécurité.",
    desc: "<strong>Le pari de la croissance long terme, avec garde-fous.</strong> Trois quarts du portefeuille en actions : un large socle d'<strong>ETF mondiaux</strong>, des positions ciblées sur les <strong>géants technologiques qui structurent l'économie</strong> (Microsoft, Nvidia, Google, Amazon, ASML), et des paris diversifiés sur les <strong>thématiques porteuses</strong> (IA, cybersécurité, nucléaire, santé). Un quart en filet de sécurité (obligations, fonds euro, or). <strong>Aucune action individuelle ne dépasse 3 %</strong> : même la pire surprise reste absorbable.<br><br><strong>Idéal pour</strong> : 30-45 ans avec un horizon de 15 à 25 ans (retraite, achat important, projet long terme) — et la capacité de regarder son portefeuille passer plusieurs mois dans le rouge sans cliquer sur « vendre ».<br><br><strong>À quoi t'attendre</strong> : autour de 7,5 %/an en moyenne. Lors des grandes crises, ce portefeuille a baissé d'environ 30 % avant de remonter sur 1 à 3 ans. La récompense de la patience : sur 25 ans, le rendement composé multiplie le capital par 6.",
    return: '~7,3%', vol: '~11,8%', drawdown: '~ -29%', horizon: '10 ans minimum',
    preset: 'dynamique'
  },
  offensif: {
    name: 'Offensif',
    thesis: "Maximisation de la croissance pour horizon long. Près de 90 % en actions, exposition appuyée aux leaders mondiaux de la tech et aux grandes thématiques structurantes.",
    desc: "<strong>La maximisation du potentiel de croissance sur très long terme.</strong> Près de 90 % en actions, avec une exposition appuyée sur les <strong>leaders technologiques mondiaux</strong> (Microsoft, Nvidia, Google, Amazon, ASML) et des paris ciblés sur les <strong>grandes thématiques structurantes</strong> : IA, cybersécurité, infrastructures critiques (satellites, énergie, nucléaire). Une <strong>petite réserve obligataire (~14 %)</strong> gardée comme dry powder pour racheter pendant les chutes du marché.<br><br><strong>Idéal pour</strong> : 20-35 ans avec un horizon de 15 ans et plus, qui ont déjà une épargne de précaution séparée et qui veulent maximiser l'effet boule de neige des intérêts composés sur la durée.<br><br><strong>À quoi t'attendre</strong> : autour de 8 %/an en moyenne. Lors des crises majeures, ce portefeuille peut chuter jusqu'à -36 %. <strong>Tu dois pouvoir voir ton capital temporairement divisé par deux sans paniquer.</strong> La contrepartie de cette discipline : sur 25 ans, le rendement composé multiplie le capital par environ 7.",
    return: '~8,2%', vol: '~14,4%', drawdown: '~ -36%', horizon: '15 ans minimum',
    preset: 'offensif'
  }
};


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 8932-8993]  PRESETS — full per-asset target weights per profile
 * (33 asset ids; total = 100; 0 if unallocated). PRESETS[profil] IS the target
 * allocation that drives the donut/sims. (preset key === profile key.)
 * ───────────────────────────────────────────────────────────────────────────*/
const PRESETS = {
  prudent: {
    world: 17, sp500: 2, voo: 0, pceu: 7, paeem: 4,
    asml: 0, msft: 0, nvda: 0, googl: 0, amzn: 0, crwd: 0, panw: 0, qcom: 0, mu: 0,
    amkr: 0, lscc: 0, syna: 0, nbis: 0, rbrk: 0, arty: 0, botz: 0, asts: 0,
    unh: 0, nvo: 0, alny: 0, rog: 0, hli: 0, orcl: 0, ibm: 0, nke: 0,
    pwr: 0, flnc: 0, len: 0, dtcr: 0, remx: 0, nlr: 0, nukz: 0, ufo: 0,
    acfn: 0, wve: 0, pgy: 0, p: 0, jepq: 0,
    oblig_eur: 26, fonds_euro: 39,
    gold: 5
  },
  equilibre: {
    world: 17, sp500: 3, voo: 0, pceu: 11, paeem: 5,
    asml: 2, msft: 2, nvda: 2, googl: 2, amzn: 2, crwd: 0, panw: 0, qcom: 0, mu: 0,
    amkr: 0, lscc: 0, syna: 0, nbis: 0, rbrk: 0, arty: 3, botz: 0, asts: 0,
    unh: 2, nvo: 2, alny: 0, rog: 2, hli: 0, orcl: 0, ibm: 0, nke: 0,
    pwr: 0, flnc: 0, len: 0, dtcr: 3, remx: 0, nlr: 0, nukz: 0, ufo: 0,
    acfn: 0, wve: 0, pgy: 0, p: 0, jepq: 0,
    oblig_eur: 19, fonds_euro: 18,
    gold: 5
  },
  dynamique: {
    world: 16, sp500: 4, voo: 0, pceu: 12, paeem: 5,
    asml: 3, msft: 3, nvda: 3, googl: 3, amzn: 3, crwd: 2, panw: 2, qcom: 0, mu: 0,
    amkr: 0, lscc: 0, syna: 0, nbis: 0, rbrk: 0, arty: 3, botz: 0, asts: 0,
    unh: 2, nvo: 3, alny: 0, rog: 0, hli: 0, orcl: 2, ibm: 0, nke: 0,
    pwr: 0, flnc: 0, len: 0, dtcr: 3, remx: 0, nlr: 3, nukz: 0, ufo: 0,
    acfn: 0, wve: 0, pgy: 0, p: 0, jepq: 0,
    oblig_eur: 12, fonds_euro: 11,
    gold: 5
  },
  offensif: {
    world: 14, sp500: 4, voo: 0, pceu: 11, paeem: 5,
    asml: 3, msft: 3, nvda: 3, googl: 3, amzn: 3, crwd: 3, panw: 2, qcom: 0, mu: 0,
    amkr: 0, lscc: 0, syna: 0, nbis: 3, rbrk: 0, arty: 4, botz: 0, asts: 1,
    unh: 2, nvo: 3, alny: 0, rog: 1, hli: 2, orcl: 3, ibm: 0, nke: 0,
    pwr: 2, flnc: 0, len: 0, dtcr: 3, remx: 0, nlr: 3, nukz: 0, ufo: 0,
    acfn: 0, wve: 0, pgy: 0, p: 0, jepq: 0,
    oblig_eur: 7, fonds_euro: 7,
    gold: 5
  }
};


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 9547-9576]  computeWeightsStats(weights) — blended expected {rate, vol}
 * for a per-asset weights map (uses ASSETS[].rate / ASSETS[].vol, avgCorr 0.4).
 * This is what the charts use:  computeWeightsStats(PRESETS[profil]).rate
 * (ASSETS is defined at SOURCE 8855-8911 — not duplicated here; required dep.)
 * ───────────────────────────────────────────────────────────────────────────*/
function computeWeightsStats(weights) {
  let total = 0;
  Object.values(weights).forEach(w => total += w);
  if (total === 0) return { rate: 0, vol: 0 };
  let weightedRate = 0;
  Object.entries(weights).forEach(([id, w]) => {
    const a = ASSETS.find(x => x.id === id);
    if (!a || w === 0) return;
    weightedRate += (w/total) * a.rate;
  });
  const avgCorr = 0.4;
  let varSum = 0;
  const ids = Object.keys(weights).filter(id => weights[id] > 0);
  ids.forEach(id => {
    const a = ASSETS.find(x => x.id === id);
    const w = weights[id]/total;
    varSum += w*w * a.vol*a.vol;
  });
  let crossSum = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i+1; j < ids.length; j++) {
      const ai = ASSETS.find(a => a.id === ids[i]);
      const aj = ASSETS.find(a => a.id === ids[j]);
      const wi = weights[ids[i]]/total;
      const wj = weights[ids[j]]/total;
      crossSum += 2 * wi * wj * ai.vol * aj.vol * avgCorr;
    }
  }
  return { rate: weightedRate, vol: Math.sqrt(varSum + crossSum) };
}


/* ═════════════════════════════════════════════════════════════════════════════
 * SECTION 3 — FISCAL ENGINE (IR / TMI / taux effectif) — ANCHOR FOR FREEZING
 *
 * Pure core (no DOM): calcIR_brut, getTMI, decote, calcIR_net, getParts.
 * Bareme constant TRANCHES. The DOM entry that orchestrates them is
 * fiscalCompute() (SOURCE 10623-10959); it READS inputs from #f-* fields and
 * WRITES STATE.fisc.{ir_net_final, tmi, teff} + #f-ir-display etc. For a headless
 * non-regression freeze, prefer the pure functions below with explicit inputs.
 *
 * ── CONCRETE SAMPLE (single person, no children) ──────────────────────────────
 *   Input: salaires_brut = 40000 €, situation = 1 (célibataire), enfants = 0,
 *          no other income, no PER/levers.
 *   abatt_sal  = clamp(40000*0.10, 503, 14171) = 4000
 *   ri         = 40000 - 4000 = 36000          (revenu imposable)
 *   parts      = getParts(1,0) = 1
 *   ir (brut)  = calcIR_net(36000, 1, false):
 *                rp = 36000; calcIR_brut(36000) =
 *                  (29579-11600)*0.11 + (36000-29579)*0.30
 *                  = 1977.69 + 1926.30 = 3903.99 ; decote(3903.99,false)=0 (>=1982)
 *                => 3903.99  -> ir_brut = Math.round(3903.99) = 3904 €
 *   TMI        = getTMI(36000/1) = 0.30  -> 30%
 *   teff       = 3904 / 40000 = 0.0976  -> "9,8%" via pctF
 *   Freeze these three: IR=3904 €, TMI=30%, taux effectif≈9,8%.
 *   (Re-derive with the engine before & after the port; they must match.)
 * ════════════════════════════════════════════════════════════════════════════*/

/* [SOURCE 10531-10537]  TRANCHES — barème 2026 (revenus 2025) */
const TRANCHES = [
  { min:0,      max:11600,   taux:0.00, label:'0%'  },
  { min:11600,  max:29579,   taux:0.11, label:'11%' },
  { min:29579,  max:84577,   taux:0.30, label:'30%' },
  { min:84577,  max:181917,  taux:0.41, label:'41%' },
  { min:181917, max:Infinity, taux:0.45, label:'45%' }
];

/* [SOURCE 10539-10543]  fiscal constants 2026 */
const ABATT_SAL_PLANCHER = 503;     // Plancher abattement 10% salaires 2026
const ABATT_SAL_PLAFOND  = 14171;   // Plafond abattement 10% salaires 2026
const ABATT_RETR_PLAFOND = 4321;    // Plafond abattement 10% retraites 2026
const PER_PLAFOND_ABS    = 35194;   // Plafond absolu PER 2026
const PLAFOND_DEMI_PART  = 1807;    // Plafonnement par demi-part QF 2026

/* [SOURCE 10547-10555]  calcIR_brut(rev) — IR brut sur le barème (par part déjà appliquée à l'appelant) */
function calcIR_brut(rev) {
  if (rev <= 0) return 0;
  let imp = 0;
  for (const t of TRANCHES) {
    if (rev <= t.min) break;
    imp += (Math.min(rev, t.max) - t.min) * t.taux;
  }
  return Math.max(0, imp);
}

/* [SOURCE 10557-10562]  getTMI(revParPart) — tranche marginale (taux) */
function getTMI(revParPart) {
  for (let i = TRANCHES.length - 1; i >= 0; i--) {
    if (revParPart > TRANCHES[i].min) return TRANCHES[i].taux;
  }
  return 0;
}

/* [SOURCE 10564-10569]  decote(impBrut, isCouple) — décote 2026 */
function decote(impBrut, isCouple) {
  const seuil = isCouple ? 3277 : 1982;
  if (impBrut >= seuil) return 0;
  const limite = isCouple ? 1483 : 897;
  return Math.max(0, limite - impBrut * 0.4525);
}

/* [SOURCE 10571-10577]  calcIR_net(ri, parts, isCouple) — IR net (quotient familial + décote) */
function calcIR_net(ri, parts, isCouple) {
  if (ri <= 0) return 0;
  const rp = ri / parts;
  const brut = calcIR_brut(rp) * parts;
  const dec = decote(brut, isCouple);
  return Math.max(0, brut - dec);
}

/* [SOURCE 10579-10585]  getParts(situation, enfants) — nombre de parts QF */
function getParts(situation, enfants) {
  let p = parseFloat(situation);
  if (enfants >= 1) p += 0.5;
  if (enfants >= 2) p += 0.5;
  if (enfants >= 3) p += (enfants - 2);  // 1 part par enfant à partir du 3e
  return Math.max(1, p);
}


/* ───────────────────────────────────────────────────────────────────────────
 * [SOURCE 10623-10959]  fiscalCompute() — THE fiscal engine ENTRY (DOM-coupled).
 * Reads all #f-* inputs, runs the full pipeline (abattements, PER déductible,
 * RI, plafonnement QF, capital taxes, réductions/crédits, IFI, CERFA, synthèse),
 * and at the END persists ONLY summary fields into STATE.fisc:
 *     STATE.fisc.salaires     = salaires_brut;
 *     STATE.fisc.ir_net_final = ir_net_final;
 *     STATE.fisc.tmi          = tmi;
 *     STATE.fisc.teff         = teff;
 * then calls saveState() — but saveState() does NOT serialize STATE.fisc (see
 * investissement.md §7). Quoted in full as the fiscal anchor.
 * ───────────────────────────────────────────────────────────────────────────*/
function fiscalCompute() {
  /* ── Saisies ── */
  const situation = parseFloat(document.getElementById('f-sel-situation').value) || 1;
  const isCouple = situation === 2;
  const enfants = STATE.fisc.enfants;
  const parts = getParts(situation, enfants);

  const salaires_brut = getSum('f-salaire-input');
  const retraite = parseFloat(document.querySelector('.f-retraite-input').value) || 0;
  const chomage  = parseFloat(document.querySelector('.f-chomage-input').value) || 0;
  const foncier_brut = parseFloat(document.getElementById('f-foncier-input').value) || 0;
  const bnc = parseFloat(document.getElementById('f-bnc-input').value) || 0;

  const per_verse = parseFloat(document.getElementById('f-per-input').value) || 0;
  const pension = parseFloat(document.getElementById('f-pension-input').value) || 0;

  // Capital
  const dividendes = parseFloat(document.getElementById('f-cap-dividendes').value) || 0;
  const pv_mob     = parseFloat(document.getElementById('f-cap-pv').value) || 0;
  const av_gains   = parseFloat(document.getElementById('f-cap-av').value) || 0;
  const interets   = parseFloat(document.getElementById('f-cap-interets').value) || 0;
  const scpi       = parseFloat(document.getElementById('f-cap-scpi').value) || 0;

  // Leviers
  const per_lev    = parseFloat(document.getElementById('f-per-lev').value) || 0;
  const don_gen    = parseFloat(document.getElementById('f-don-general').value) || 0;
  const don_pers   = parseFloat(document.getElementById('f-don-personnes').value) || 0;
  const dom_dep    = parseFloat(document.getElementById('f-dom-depenses').value) || 0;
  const fr_input   = parseFloat(document.getElementById('f-fr-input').value) || 0;
  const sco_coll   = parseInt(document.getElementById('f-sco-college').value) || 0;
  const sco_lyc    = parseInt(document.getElementById('f-sco-lycee').value) || 0;
  const sco_sup    = parseInt(document.getElementById('f-sco-sup').value) || 0;
  const ifi_patr   = parseFloat(document.getElementById('f-ifi-input').value) || 0;

  /* ── Abattements ── */
  // Salaires : 10%, plancher 503€, plafond 14171€
  const abatt_sal = Math.min(Math.max(salaires_brut * 0.10, ABATT_SAL_PLANCHER), ABATT_SAL_PLAFOND);
  const abatt_effectif = fr_input > 0 ? Math.max(fr_input, abatt_sal) : abatt_sal;
  const salaires_ri = Math.max(0, salaires_brut - abatt_effectif);
  setText('f-t-salaires-ri', fmt(salaires_ri));

  // Retraites : 10%, plafond 4321€
  const abatt_retr = Math.min(retraite * 0.10, ABATT_RETR_PLAFOND);
  const retraite_ri = Math.max(0, retraite - abatt_retr);

  // Chômage : pas d'abattement
  const chomage_ri = chomage;

  // Foncier : micro-foncier ≤ 15000 → abattement 30%
  const foncier_imposable = foncier_brut <= 15000 ? foncier_brut * 0.70 : foncier_brut;
  // SCPI : revenus traités comme fonciers (déjà nets de charges fournis)
  const scpi_imposable = scpi <= 15000 ? scpi * 0.70 : scpi;

  /* ── PER déductible ── */
  const plafond_per_calc = Math.min(salaires_brut * 0.10, PER_PLAFOND_ABS);
  const plafond_per = Math.max(plafond_per_calc, 4710);  // Plancher PASS pour 2026 ≈ 4 710 €
  const per_total = per_verse + per_lev;
  const per_deductible = Math.min(per_total, plafond_per);

  /* ── Revenu imposable total ── */
  const ri = Math.max(0,
    salaires_ri + retraite_ri + chomage_ri +
    bnc + foncier_imposable + scpi_imposable -
    per_deductible - pension
  );

  /* ── IR brut & TMI ── */
  // On applique le plafonnement du quotient familial
  const ir_brut_avec_parts = calcIR_net(ri, parts, isCouple);
  const ir_brut_sans_parts = calcIR_net(ri, isCouple ? 2 : 1, isCouple);
  const demis_parts_supp = parts - (isCouple ? 2 : 1);
  let ir_brut;
  if (demis_parts_supp > 0) {
    const gain_max = demis_parts_supp * 2 * PLAFOND_DEMI_PART;  // 1807€ par demi-part
    const gain_reel = ir_brut_sans_parts - ir_brut_avec_parts;
    if (gain_reel > gain_max) ir_brut = ir_brut_sans_parts - gain_max;
    else ir_brut = ir_brut_avec_parts;
  } else {
    ir_brut = ir_brut_avec_parts;
  }
  ir_brut = Math.round(ir_brut);

  const tmi = getTMI(ri / parts);
  const tmiPct = Math.round(tmi * 100);
  const brut_total = salaires_brut + retraite + chomage + bnc + foncier_brut + scpi;
  const teff = brut_total > 0 ? ir_brut / brut_total : 0;

  /* ── Taxes capital ── */
  const tax_div    = Math.round(dividendes * 0.314);
  const tax_pv     = Math.round(pv_mob * 0.314);
  const tax_int    = Math.round(interets * 0.314);
  // AV après 8 ans (hypothèse) : abattement annuel 4 600 / 9 200, puis 7,5%+18,6% = 26,1%
  const abatt_av = isCouple ? 9200 : 4600;
  const av_imposable = Math.max(0, av_gains - abatt_av);
  const tax_av     = Math.round(av_imposable * 0.261);
  // Foncier : déjà dans IR via barème, on calcule juste l'affichage
  const tx_foncier_total = tmi + 0.186;
  const tax_foncier_aff  = Math.round(foncier_imposable * tx_foncier_total);
  const tax_scpi_aff     = Math.round(scpi_imposable * tx_foncier_total);

  setText('f-tax-dividendes', tax_div > 0 ? fmt(tax_div) : '0 €');
  setText('f-tax-pv',          tax_pv  > 0 ? fmt(tax_pv) : '0 €');
  setText('f-tax-foncier',     tax_foncier_aff > 0 ? fmt(tax_foncier_aff) : '0 €');
  setText('f-tax-av',          tax_av > 0 ? fmt(tax_av) : '0 €');
  setText('f-tax-interets',    tax_int > 0 ? fmt(tax_int) : '0 €');
  setText('f-tax-scpi',        tax_scpi_aff > 0 ? fmt(tax_scpi_aff) : '0 €');
  setText('f-rf-taux-display', pctF(tx_foncier_total * 100));
  setText('f-scpi-taux-display', pctF(tx_foncier_total * 100));

  /* ── Réductions & crédits ── */
  // Dons IG : 66%, plafond 20% du RI
  const red_don_ig = Math.min(don_gen * 0.66, ri * 0.20 * 0.66);
  // Dons aide aux personnes : 75% jusqu'à 1000€, 66% au-delà
  const don_pers_75 = Math.min(don_pers, 1000) * 0.75;
  const don_pers_66 = Math.max(don_pers - 1000, 0) * 0.66;
  const red_don_pers = don_pers_75 + don_pers_66;
  const red_dons = Math.round(red_don_ig + red_don_pers);

  // Emploi à domicile : 50% plafond 12000 + 1500 par enfant (max 15000)
  const dom_plafond = Math.min(12000 + 1500 * enfants, 15000);
  const cred_dom = Math.round(Math.min(dom_dep, dom_plafond) * 0.50);

  // Scolarité
  const red_sco = sco_coll * 61 + sco_lyc * 153 + sco_sup * 183;

  // Frais réels
  const gain_fr = fr_input > abatt_sal ? Math.round((fr_input - abatt_sal) * tmi) : 0;

  const total_reductions = red_dons + red_sco;
  const total_credits = cred_dom;

  // IR après réductions et crédits
  const ir_apres_red = Math.max(0, ir_brut - total_reductions);
  const ir_net_final = Math.max(0, ir_apres_red - total_credits);

  // IFI
  let ifi = 0;
  if (ifi_patr > 1300000) {
    const tranches_ifi = [
      [0, 800000, 0],
      [800000, 1300000, 0.005],
      [1300000, 2570000, 0.007],
      [2570000, 5000000, 0.01],
      [5000000, 10000000, 0.0125],
      [10000000, Infinity, 0.015]
    ];
    tranches_ifi.forEach(([mn, mx, tx]) => {
      if (ifi_patr > mn) ifi += (Math.min(ifi_patr, mx) - mn) * tx;
    });
  }

  /* ── Affichage leviers ── */
  setText('f-per-plafond', fmt(plafond_per));
  // Économie PER : différence d'IR sans et avec PER
  const ri_sans_per = ri + per_deductible;
  const ir_sans_per = calcIR_net(ri_sans_per, parts, isCouple);
  const eco_per = Math.max(0, Math.round(ir_sans_per - ir_brut));
  document.getElementById('f-per-eco').textContent = eco_per > 0 ? '-' + fmt(eco_per) : '0 €';

  document.getElementById('f-don-eco').textContent = red_dons > 0 ? '-' + fmt(red_dons) : '0 €';
  document.getElementById('f-dom-eco').textContent = cred_dom > 0 ? '-' + fmt(cred_dom) : '0 €';
  document.getElementById('f-sco-eco').textContent = red_sco > 0 ? '-' + fmt(red_sco) : '0 €';

  setText('f-fr-abattement', fmt(abatt_sal));
  document.getElementById('f-fr-eco').textContent = gain_fr > 0 ? '-' + fmt(gain_fr) : (fr_input > 0 ? 'Forfait supérieur' : '—');

  document.getElementById('f-ifi-eco').textContent = ifi > 0 ? fmt(Math.round(ifi)) : 'Non concerné';

  /* ── Hero IR ── */
  setText('f-ir-display', fmt(ir_brut));
  setText('f-ir-sub', `Taux effectif : ${pctF(teff*100)} · Taux marginal : ${tmiPct}%`);

  // Badge TMI
  const badge = document.getElementById('f-badge-tmi');
  badge.textContent = 'TMI ' + tmiPct + '%';
  if (tmiPct >= 41)      badge.className = 'status-badge bad';
  else if (tmiPct >= 30) badge.className = 'status-badge warn';
  else if (tmiPct >= 11) badge.className = 'status-badge info';
  else                   badge.className = 'status-badge ok';

  // KPIs
  setText('f-kpi-brut',  fmt(brut_total));
  setText('f-kpi-ri',    fmt(ri));
  setText('f-kpi-parts', (parts % 1 === 0) ? parts.toString() : parts.toFixed(1).replace('.', ','));
  setText('f-kpi-teff',  pctF(teff*100));

  /* ── Barème visuel ── */
  const ri_part = ri / parts;
  const colors = ['#B8AC95', '#B8893B', '#B7202E', '#8B3030', '#501313'];
  let baremeHTML = '';
  TRANCHES.forEach((t, i) => {
    const imp_t = ri_part > t.min ? Math.round((Math.min(ri_part, t.max) - t.min) * t.taux * parts) : 0;
    const fillW = ri_part > t.min ? Math.min(100, Math.round((Math.min(ri_part, t.max) - t.min) / (t.max === Infinity ? Math.max(ri_part - t.min, 1) : t.max - t.min) * 100)) : 0;
    const isActive = ri_part > t.min && ri_part <= t.max;
    const upTo = t.min === 0 ? 'jusqu\'à 11,6k €'
               : t.max === Infinity ? '> 181,9k €'
               : t.min/1000 + 'k → ' + Math.round(t.max/1000) + 'k';
    baremeHTML += `<div class="tranche-row">
      <span class="tranche-label">${upTo}</span>
      <div class="tranche-track"><div class="tranche-fill${isActive?' active-tranche':''}" style="width:${fillW}%;background:${colors[i]}"></div></div>
      <span class="tranche-taux${isActive?' active-taux':''}">${t.label}</span>
      <span class="tranche-montant">${imp_t > 0 ? fmt(imp_t) : '—'}</span>
    </div>`;
  });
  document.getElementById('f-bareme-bars').innerHTML = baremeHTML;

  /* ── Breakdown mensuel ── */
  const par_mois = Math.round(ir_brut / 12);
  const par_jour = Math.round(ir_brut / 365);
  const net_mens = Math.round((brut_total - ir_brut) / 12);
  const bkd = [
    { label:'Impôt / mois',          val:par_mois, color:'#B7202E', p: brut_total>0 ? ir_brut/brut_total : 0 },
    { label:'Impôt / jour',          val:par_jour, color:'#D97B2A', p: 0.04 },
    { label:'Revenus nets / mois',   val:net_mens, color:'#2D7D46', p: brut_total>0 ? (brut_total-ir_brut)/brut_total : 1 }
  ];
  document.getElementById('f-ir-breakdown').innerHTML = bkd.map(r => `
    <div class="ir-break-row">
      <span class="ir-break-label">${r.label}</span>
      <div class="ir-break-track"><div class="ir-break-fill" style="width:${Math.round(r.p*100)}%;background:${r.color}"></div></div>
      <span class="ir-break-amount">${fmt(r.val)}</span>
    </div>`).join('');

  /* ── CERFA ── */
  // Salaires
  const salInputs = Array.from(document.querySelectorAll('.f-salaire-input'));
  let cerfaSal = '';
  salInputs.forEach((inp, i) => {
    const v = parseFloat(inp.value) || 0;
    if (v === 0 && i > 0) return;
    cerfaSal += cerfa_line(i === 0 ? '1AJ' : '1BJ', `Salaires nets imposables${i>0?' (conjoint)':''}`, v);
  });
  if (retraite > 0) cerfaSal += cerfa_line('1AS', 'Pension de retraite', retraite);
  if (chomage  > 0) cerfaSal += cerfa_line('1AP', 'Allocations chômage', chomage);
  document.getElementById('f-cerfa-salaires').innerHTML = cerfaSal || cerfa_line('1AJ', 'Salaires nets imposables', 0);

  // Foncier
  const foncier_code = foncier_brut <= 15000 ? '4BE' : '4BA';
  const foncier_label = foncier_brut <= 15000 ? 'Micro-foncier (revenus bruts)' : 'Revenus fonciers (régime réel)';
  let cerfaFonc = cerfa_line(foncier_code, foncier_label, foncier_brut);
  if (scpi > 0) cerfaFonc += cerfa_line(scpi <= 15000 ? '4BE' : '4BA', 'Revenus de SCPI', scpi);
  document.getElementById('f-cerfa-foncier').innerHTML = cerfaFonc;

  // Capital
  let cerfaCap = '';
  if (dividendes > 0) cerfaCap += cerfa_line('2DC', 'Dividendes bruts', dividendes);
  if (interets > 0)   cerfaCap += cerfa_line('2TR', 'Intérêts imposables', interets);
  if (pv_mob > 0)     cerfaCap += cerfa_line('3VG', 'Plus-values mobilières', pv_mob);
  if (av_gains > 0)   cerfaCap += cerfa_line('2CH', 'Gains assurance-vie (+8 ans)', av_gains);
  if (!cerfaCap) cerfaCap = cerfa_line('—', 'Aucun revenu du capital', 0);
  document.getElementById('f-cerfa-capital').innerHTML = cerfaCap;

  // Déductions
  let cerfaDed = '';
  if (per_deductible > 0) cerfaDed += cerfa_line('6NS', 'Versements PER déductibles', -per_deductible);
  if (pension > 0)        cerfaDed += cerfa_line('6GI', 'Pension alimentaire versée', -pension);
  if (don_gen > 0)        cerfaDed += cerfa_line('7UF', 'Dons intérêt général (-66%)', -don_gen);
  if (don_pers > 0)       cerfaDed += cerfa_line('7UD', 'Dons aide aux personnes (-75%)', -don_pers);
  if (dom_dep > 0)        cerfaDed += cerfa_line('7DB', 'Emploi à domicile / garde (-50%)', -dom_dep);
  if (sco_coll > 0)       cerfaDed += cerfa_line('7EA', `Enfants au collège (×${sco_coll})`, -sco_coll * 61);
  if (sco_lyc > 0)        cerfaDed += cerfa_line('7EB', `Enfants au lycée (×${sco_lyc})`, -sco_lyc * 153);
  if (sco_sup > 0)        cerfaDed += cerfa_line('7EC', `Enfants supérieur (×${sco_sup})`, -sco_sup * 183);
  if (fr_input > abatt_sal) cerfaDed += cerfa_line('1AK', 'Frais réels déductibles', -fr_input);
  if (!cerfaDed) cerfaDed = cerfa_line('—', 'Aucune déduction', 0);
  document.getElementById('f-cerfa-deductions').innerHTML = cerfaDed;

  document.getElementById('f-cerfa-total').textContent = fmt(ir_net_final);
  document.getElementById('f-cerfa-total').className = 'cerfa-total-value' + (ir_net_final === 0 ? ' green' : '');

  /* ── Synthèse finale ── */
  const synRows = [
    { label:'Revenus bruts déclarés',     val:brut_total,    color:'#2D7D46' },
    { label:'Revenu imposable net',       val:ri,            color:'#B8893B' },
    { label:'IR avant optimisation',      val:ir_brut,       color:'#B7202E' },
    { label:'IR net après leviers',       val:ir_net_final,  color:'#8C1622' }
  ];
  document.getElementById('f-synthese-breakdown').innerHTML = synRows.map(r => `
    <div class="ir-break-row">
      <span class="ir-break-label">${r.label}</span>
      <div class="ir-break-track"><div class="ir-break-fill" style="width:${brut_total>0?Math.round(r.val/brut_total*100):0}%;background:${r.color}"></div></div>
      <span class="ir-break-amount">${fmt(r.val)}</span>
    </div>`).join('');

  setText('f-syn-ir-brut',    fmt(ir_brut));
  setText('f-syn-reductions', total_reductions > 0 ? '-' + fmt(total_reductions) : '0 €');
  setText('f-syn-credits',    total_credits > 0 ? '-' + fmt(total_credits) : '0 €');
  setText('f-syn-ir-net',     fmt(ir_net_final));

  /* ── Économies breakdown ── */
  const ecoRows = [];
  if (eco_per > 0)  ecoRows.push({ label:'PER → économie IR',     val:eco_per,         color:'#185FA5' });
  if (red_dons > 0) ecoRows.push({ label:'Dons → réduction IR',   val:red_dons,        color:'#2D7D46' });
  if (cred_dom > 0) ecoRows.push({ label:'Domicile → crédit IR',  val:cred_dom,        color:'#3A5418' });
  if (gain_fr > 0)  ecoRows.push({ label:'Frais réels → économie', val:gain_fr,         color:'#8B6520' });
  if (red_sco > 0)  ecoRows.push({ label:'Scolarité → réduction', val:red_sco,         color:'#B8893B' });

  const maxEco = ecoRows.length > 0 ? Math.max(...ecoRows.map(r => r.val)) : 1;
  document.getElementById('f-eco-breakdown').innerHTML = ecoRows.length > 0
    ? ecoRows.map(r => `
        <div class="ir-break-row">
          <span class="ir-break-label">${r.label}</span>
          <div class="ir-break-track"><div class="ir-break-fill" style="width:${Math.round(r.val/maxEco*100)}%;background:${r.color}"></div></div>
          <span class="ir-break-amount" style="color:${r.color}">-${fmt(r.val)}</span>
        </div>`).join('')
    : '<p style="font-size:13px;color:var(--muted);font-style:italic">Active les leviers ci-dessus pour voir tes économies ici.</p>';

  const ecoTotal = eco_per + red_dons + cred_dom + gain_fr + red_sco;
  const ecoBadge = document.getElementById('f-eco-badge');
  if (ecoTotal > 500)   { ecoBadge.className = 'status-badge ok';   ecoBadge.textContent = 'Bien optimisé'; }
  else if (ecoTotal > 0){ ecoBadge.className = 'status-badge info'; ecoBadge.textContent = 'En cours'; }
  else                  { ecoBadge.className = 'status-badge warn'; ecoBadge.textContent = 'À optimiser'; }

  /* ── Conseil personnalisé ── */
  let conseil = '';
  if (tmiPct >= 30 && per_total < plafond_per * 0.5) {
    conseil = `Avec une TMI de ${tmiPct}%, chaque euro versé sur ton PER te rapporte ${tmiPct} centimes d'économie fiscale. Tu utilises seulement une partie de ton plafond disponible (${fmt(plafond_per)}) — c'est le levier le plus efficace dans ta tranche.`;
  } else if (tmiPct >= 11 && ecoTotal === 0) {
    conseil = `Tu n'as activé aucun levier d'optimisation. Commence par vérifier ton plafond PER (${fmt(plafond_per)}) et si tu as des dépenses de services à domicile éligibles au crédit d'impôt à 50%.`;
  } else if (ecoTotal > 0) {
    conseil = `Tu économises déjà ${fmt(ecoTotal)} grâce aux leviers activés. Si tu n'as pas encore de PEA, c'est l'outil à ouvrir en priorité pour tes investissements futurs — les plus-values seront exonérées d'IR après 5 ans.`;
  } else if (tmiPct === 0) {
    conseil = `Ton revenu imposable est dans la tranche à 0% — tu ne paies pas d'IR. Concentre-toi sur la constitution d'un fonds d'urgence (3-6 mois de dépenses sur Livret A) et l'ouverture d'un PEA pour préparer l'avenir en franchise d'impôt.`;
  } else {
    conseil = `Ta situation est équilibrée. Pense à vérifier chaque année l'évolution de ton plafond PER et à conserver tes justificatifs de dons et dépenses de services à domicile.`;
  }
  setText('f-conseil-text', conseil);

  /* ── Persistance & synthèse hero ── */
  STATE.fisc.salaires = salaires_brut;
  STATE.fisc.ir_net_final = ir_net_final;
  STATE.fisc.tmi = tmi;
  STATE.fisc.teff = teff;

  setText('synth-tax-val', fmt(ir_net_final));
  setText('synth-tax-sub', `TMI ${tmiPct}% · ${pctF(teff*100)} effectif`);

  saveState();
}
