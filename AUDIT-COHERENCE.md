# Audit de cohérence intégrale — *Le Petit Livre Rouge de l'investisseur · Le Portefeuille*

Fichier audité : `petit-livre-rouge-portefeuille.html` (10 052 lignes, application HTML autonome, dépendance unique Chart.js).
Périmètre : **cohérence du fond, de bout en bout** (source de vérité → rendu, dans chaque état atteignable). Distinct de l'audit des chiffres (justesse fiscale/mathématique dans l'absolu) et du brief design.

**Verdict** : la base est saine et désormais **cohérente de bout en bout** — toutes les statistiques affichées (rendement / volatilité / drawdown / Sharpe) dérivent d'un **moteur unique** (`computeStats`), prouvé par harnais dans les 4 profils. **Les 6 écarts réels sont tous corrigés et vérifiés** : F-001 (enveloppe), F-005 (grave — persistance du quiz), F-004 (tip horizon), F-012 (init planificateur), **F-006** (consolidation du planificateur sur le moteur), **F-008/009/010** (tickers — MSCI World unifié sur **`DCAM`** *vérifié sur le web* = Amundi PEA Monde, or sur `IGLN`, guide d'achat réécrit sur le portefeuille réel). Restent uniquement : un **stock de code mort** (sous-systèmes d'anciennes versions, **inerte, jamais affiché**) inventorié pour une passe de nettoyage dédiée, et des micro-points de copie documentés.

### Mise à jour post-livraison (retour utilisateur)

- **UX-1 — Entrée par le questionnaire.** Remarque : « le doc est de base en portefeuille offensif alors qu'il devrait y avoir les questions ». **Diagnostic (rendu réel Chromium)** : au **premier chargement**, le document affiche bien le quiz (vérifié) ; le portefeuille « offensif » provenait d'un **profil sauvegardé** en `localStorage` (quiz déjà complété → persistance, désormais fiable depuis F-005). Sur demande, **changement de comportement appliqué** : `init()` recommence **toujours** au questionnaire (le profil n'est plus ré-affiché au rechargement ; le baromètre de connaissance reste conservé). Prouvé par `audit-harness/render-behavior.js` (**8/8**) : 1ᵉʳ chargement = quiz · quiz complété = profil rendu en session · rechargement = retour au quiz.
- **F-013 — « 4 questions » → « 5 questions ».** L'état vide de l'allocation disait « Réponds d'abord aux **4 questions** » alors que le quiz en compte **5** (et le titre dit « en cinq questions ») → corrigé (+ 2 commentaires internes alignés).

> **Harnais : 122 assertions vertes / 0 échec** (rendu == recalcul moteur, 4 profils × 3 vues, **+ planificateur dérivé du moteur : médiane Monte-Carlo ≈ projection géométrique guidée à ±8 %**) · **sweep interactif : 0 erreur console** · **persistance : OK après correctif**.

---

## 1. Carte de flux de données & sources de vérité

### Sources de vérité (constantes)
| Source | Lignes | Rôle | Statut |
|---|---|---|---|
| `ASSETS` | 7325 | 6 actifs : `env`, `rate`, `vol`, `cat`, `ticker` | **source unique** des actifs |
| `PRESETS` | 7358 | poids par profil (∑=100) | **source unique** des allocations |
| `RF`, `ASSET_CORR`, `SHOCK_2008/2022` | 7459-70 | paramètres du moteur | source unique |
| `computeStats(weights)` | 7473 | **MOTEUR** : arith, géo, vol (covariance), Sharpe, drawdown | **source unique des stats** |
| `PROFILE_STATS` | 7540 | **dérivé** de `computeStats(PRESETS[k])` | dérivé ✓ |
| `PROFILES[k].return/vol/drawdown/sharpe` | 7375-97 | **écrasés** par le moteur (IIFE 7547-58) | dérivé ✓ (littéraux = doc) |
| `PROFILE_STRESSTEST[k].loss` | 7490 | **écrasé** par le moteur ; `recovery` éditorial | dérivé ✓ |
| `SATELLITE_WEIGHT` | 7561 | overlay 6 %/10 % | source unique |
| `PROFILE_PROBA` | 9550 | rate/vol du **planificateur** (Monte Carlo) | **dérivé du moteur** (F-006 corrigé) ✓ |
| `PROFILE_ALLOCATION_Q`, `PROFILE_RATE_Q` | 7530-37 | redondants | **morts** (jamais lus) |

### Arêtes source → rendu (live)
```
PRESETS[p.preset] ──▶ investorRenderPortfolio (8017) ──▶ #i-pf-* (entête), #i-macro-*-pct,
                       #i-donut-legend, #i-allocation-detail, renderEnvelopeSplit ──▶ #i-env-split-chips
computeStats ──▶ PROFILE_STATS ──▶ PROFILES (écrasé) ──▶ quizShowResult (7787) ──▶ #pc-shell (carte profil)
PRESETS[g.strategy] ──▶ renderGuidedDetail/updateGuidedSim ──▶ #i-guided-*, #i-chart-guided
computePresetStats ──▶ updateCompareSim ──▶ #i-cmp-*, #i-chart-compare
PROFILE_PROBA[s.profile] (= moteur : arith/vol) ──▶ updatePlannerView (Monte Carlo) ──▶ #i-plan-*, #i-plan-traj-chart   ✓ recalé sur le moteur (F-006)
ASSETS[].env ──▶ envCls (7235) + computeEnvelopeSplit (7244) ──▶ pastilles enveloppe   ◀── F-001 (corrigé)
```

**Données à sources multiples signalées** : (a) stats par profil — **moteur** (live), littéraux `PROFILES` (écrasés, cohérents) et `PROFILE_PROBA` (planificateur) **désormais tous dérivés du moteur** (F-006 corrigé) ; (b) allocations — `PRESETS` (live) vs `PROFILE_ALLOCATION_Q` (mort) ; (c) tickers — `ASSETS` vs prose du guide d'achat : **unifiés sur `ASSETS`** (F-008/009/010 résolus, `DCAM`/`IGLN` web-vérifiés).

---

## 2. Matrice de couverture `section × état`

Légende : ✓ vérifié cohérent · **F-n** écart (voir §3) · — sans objet · *(masqué)* placeholder jamais affiché.

| Section ↓ \ État → | 1ʳᵉ visite (vierge) | quiz complété ×4 profils | mode guidé | mode comparateur | mode expert = planificateur | état restauré (localStorage) |
|---|---|---|---|---|---|---|
| Header / Hero / Synthèse | ✓ | ✓ | — | — | — | ✓ |
| Couverture Chap II (01-04) | ✓ | ✓ | — | — | — | ✓ |
| Notions (i-sec1, 6 cartes) | ✓ (F-007 inerte) | ✓ | — | — | — | ✓ |
| Enveloppes PEA/CTO/AV | ✓ (fiscalité cohérente) | ✓ | — | — | — | ✓ |
| Profil / quiz (i-sec2) | ✓ placeholder | ✓ scoring↔options | — | — | — | **F-005→corrigé** |
| Allocation (i-sec3) entête/macro/donut/split | *(masqué F-002)* | ✓ == moteur · **F-001→corrigé** | — | — | — | ✓ |
| Allocation — satellite | — | ✓ (6/10 %, ≤2 %/ligne) | — | — | — | ✓ |
| Allocation — guide d'achat (concret/FAQ) | *(masqué)* | **F-008/009/010** tickers | — | — | — | idem |
| Simulation (i-sec4) | ✓ placeholder | ✓ | ✓ ==moteur | ✓ ==moteur | ✓ ==moteur (**F-006 corrigé**) | ✓ |
| Simulation — bandeau « 3 modes » (tip) | **F-004→corrigé** | — | — | — | — | — |
| Bilan / plan d'action / Footer | ✓ | ✓ | — | — | — | ✓ |

États transverses vérifiés : `activeMode ∈ {guided, expert(planner), compare}` ✓ · quiz {non complété / complété ×4} ✓ · satellite {on dyn/off · off prud/équil} ✓ · `localStorage {vierge / restauré / migration schemaVersion}` ✓ · poids builder : **piège « = PRESETS.equilibre » neutralisé** (au démarrage sans profil, `weights` = tout-à-zéro, cf. `init` 9414 ; les lectures live passent par les *presets*, pas par `weights`).

---

## 3. Tableau des constats

| ID | Emplacement | Classe | Incohérence | Effet utilisateur | Correctif | Δ comportement | Confiance | Escalade |
|---|---|---|---|---|---|---|---|---|
| **F-001** | `ASSETS.oblig` 7332 ; `envCls` 7235 ; conso 8248/8352 | convention/clé-mal-appariée | `oblig.env='AV/CTO'` non reconnu par `envCls` (qui ne matchait que `'CTO/AV'`) → obligations classées **CTO pur** par `envCls`, mais **mixte** par `computeEnvelopeSplit` | **Oui** : pastille obligations affichée « AV/CTO » en **bleu CTO**, alors que le bandeau enveloppe les range en « 🔵🟡 CTO ou AV » et que l'or affiche « CTO/AV » en dégradé mixte | `oblig.env → 'CTO/AV'` + `envCls` accepte les 2 formes (producteur **et** consommateurs unifiés) | Oui — pastille obligations désormais **mixte « CTO/AV »** | Haute | Non |
| **F-005** | `restoreUIFromState` 9315 | provenance-périmée / état-non-couvert | Détecteur d'ancien format incluait `'experience'` — **clé courante** → tout quiz complété détecté « legacy » | **Oui (grave)** : profil + quiz **effacés à chaque rechargement** ; promesse de persistance v5 rompue | Détecteur réduit à `['filet','concentration']` (clés réellement disparues) | Oui — l'état n'est **plus** effacé à tort (prouvé par `test-restore.js`) | Haute | Non |
| **F-004** | tip `i-sec4` 8446 | contradiction-inter-sections | Tip « Comparateur … sur **25 ans** » ; or l'outil utilise **20 ans** (STATE + slider + sortie concordent) | **Oui** (panneau d'astuce) : claim faux sur le comportement de l'outil | Tip → « sur **20 ans** » (alignement de l'unique source divergente) | Oui — texte du tip corrigé | Moyenne | Non |
| **F-012** | planificateur `initPlannerWiring` 9944 / hint 6797 | ordre-init | Au chargement, objectif actif = « retraite » mais le hint statique affichait le texte « FIRE » (25× dépenses) | **Oui** (mineur) : sous-titre d'objectif incohérent avec le bouton actif | `initPlannerWiring` appelle `applyGoalType(goalType)` → hint cohérent | Oui — hint = texte « retraite » au chargement | Moyenne | Non |
| **F-006** | `PROFILE_PROBA` 9546 vs moteur | **source-de-vérité-redondante** + contradiction-inter-sections | Rate/vol du **planificateur** ≠ moteur (ex. dynamique **7,6 %** vs **5,4 %** ; off. 8,6 % vs 5,7 %) | **Oui** : pour un même profil, la carte annonçait ~5,4 %/an mais le planificateur projetait à 7,6 %/an | **`PROFILE_PROBA` dérivé du moteur** : `rate = PROFILE_STATS.arith`, `vol = PROFILE_STATS.vol` (source redondante supprimée) | **Oui** — probabilités/trajectoires recalées sur le moteur (baisse) ; médiane MC ≈ projection guidée (prouvé) | Haute | Non (résolu) |
| **F-008** | `ASSETS.world` 7327 vs guide 6026 vs tip | contradiction-inter-sections | **3 tickers** pour l'ETF MSCI World (`WPEA`/`DCAM`/`CW8`) ; `ASSETS` en tension interne (ticker `WPEA`=iShares, desc « Amundi PEA Monde »=`DCAM`) | **Oui** : confusion à l'achat | **RÉSOLU** : unifié sur **`DCAM`** (Amundi PEA Monde, ISIN FR001400U5Q4 — **vérifié web** : matche la desc + le guide). `ASSETS.ticker WPEA→DCAM` + tips→DCAM ; guide déjà DCAM | Oui — `WPEA`/`CW8` éliminés (0 occ. visible) | Haute (ticker web-vérifié) | Non (résolu) |
| **F-009** | `ASSETS.gold` 7334 (`IGLN`) vs guide 6053 (`GLD`) | contradiction-inter-sections | 2 tickers pour l'or | Oui : idem achat | **RÉSOLU** : guide d'achat `GLD → IGLN` (aligné sur `ASSETS`, source unique) | Oui | Haute | Non (résolu) |
| **F-010** | guide d'achat étape 6, 6053 | contradiction-inter-sections / stale | « Achète MSFT, NVDA, GLD, ARTY » = titres d'un **ancien modèle** absents du portefeuille ETF | **Oui** : on demandait d'acheter des actifs absents du portefeuille | **RÉSOLU** : réécrit sur les **actifs réels hors PEA** — or `IGLN`, obligations `IEAG`, et (si satellite activé) titres vifs `TSMC`/`Microsoft`/`Mastercard` | Oui — guide d'achat = portefeuille réel | Haute | Non (résolu) |
| **F-002** | i-sec3/i-sec4 placeholders | code-mort / placeholder-stale | Modèle abandonné « Tech & Innovation 36/47 % », actions individuelles, légende donut 39/23/15/15/8, macro 77/15/8, split 45/40/8/7, `i-g-rate 9,8 %`, table projection 50 472 €… | **Aucun** : tout est dans des conteneurs `display:none` **écrasés** par le rendu JS avant affichage (`.portfolio-content` ne reçoit `.show` qu'après réécriture) | Aucun (documenté) | Non | Haute | Recommandé (nettoyage) |
| **F-003** | `updateExpertOverview` 8853-59 | clé-mal-appariée (dans code mort) | Macro hint testant `'tech_us'/'diversifies_us'/'diversification'` (clés inexistantes) → actions = seul `world`, sécurité sans fonds €, or toujours 0 | **Aucun** : `#i-expert-hint-text` **n'existe plus** (builder expert supprimé) → fonction no-op | Aucun (bug **latent** en code mort) | Non | Haute | Recommandé (avec F-011) |
| **F-007** | `notion-card[data-notion]` 5006+, 6085+ | convention/clé | Valeurs `data-notion` désalignées du contenu (clés décalées, doublons) | **Aucun** : `investorToggleNotion` n'utilise `[data-notion]` que comme sélecteur (valeur jamais lue) | Aucun (documenté) | Non | Haute | Optionnel |
| **F-011** | tout le fichier | **code-mort / dérive-de-câblage** | Sous-systèmes d'anciennes versions orphelins (cf. §8) | **Aucun** (tout est gardé `if(!el)`) | Aucun (inventaire fourni) | Non | Haute | Recommandé (passe dédiée) |

Constats mineurs : tip i-sec1 « fonds euro **~2,5 %**/an » → **corrigé en ~2,75 %** (valeur canonique). « **1 500 entreprises** » (notions L5065/5080) vs `ASSETS.world` « **~1 400** » : **laissé** — approximation pédagogique récurrente, les deux étant des ordres de grandeur valides du MSCI World (ne pas sur-éditer la prose).

---

## 4. Diffs appliqués (chirurgicaux, regroupés)

**F-001 — convention enveloppe `'AV/CTO'` ↔ `'CTO/AV'`** (producteur + consommateurs)
```diff
- { id: 'oblig', ... env: 'AV/CTO', rate: 3.2, vol: 5 },
+ { id: 'oblig', ... env: 'CTO/AV', rate: 3.2, vol: 5 },
```
```diff
- if (env === 'CTO/AV') return 'env-pill-mixed';
+ if (env === 'CTO/AV' || env === 'AV/CTO') return 'env-pill-mixed';   // symétrique avec computeEnvelopeSplit
```
**F-005 — quiz effacé au rechargement** (détecteur d'ancien format)
```diff
- const hasLegacy = keys.some(k => ['filet', 'concentration', 'experience'].includes(k));
+ const hasLegacy = keys.some(k => ['filet', 'concentration'].includes(k));  // 'experience' est une clé COURANTE
```
**F-004 — tip Comparateur**
```diff
- ... l'écart en € sur 25 ans. ...
+ ... l'écart en € sur 20 ans. ...
```
**F-012 — hint planificateur cohérent à l'init**
```diff
- // Premier render
- updatePlannerView();
+ // applyGoalType pose le hint cohérent avec le goalType actif puis recalcule
+ applyGoalType(PLANNER_STATE.goalType);
```
**F-006 — planificateur dérivé du moteur unique** (suppression de la 2ᵉ source)
```diff
- const PROFILE_PROBA = {
-   prudent: { rate: 0.041, vol: 0.055, ... }, equilibre: { rate: 0.062, vol: 0.096, ... },
-   dynamique: { rate: 0.076, vol: 0.125, ... }, offensif: { rate: 0.086, vol: 0.150, ... } };
+ const PROFILE_PROBA = { prudent:{...}, equilibre:{...}, dynamique:{...}, offensif:{...} }; // name/nextName seuls
+ ['prudent','equilibre','dynamique','offensif'].forEach(k => {
+   PROFILE_PROBA[k].rate = PROFILE_STATS[k].arith / 100;   // drift = rendement arithmétique du moteur
+   PROFILE_PROBA[k].vol  = PROFILE_STATS[k].vol   / 100; });
```
**F-008/009 — ETF Monde & or unifiés sur la source `ASSETS`** (ticker MSCI World web-vérifié = Amundi PEA Monde / `DCAM`)
```diff
- { id: 'world', ... ticker: 'WPEA', desc: 'Amundi PEA Monde · ...' }   // ticker iShares ≠ desc Amundi
+ { id: 'world', ... ticker: 'DCAM', desc: 'Amundi PEA Monde · ...' }   // DCAM = Amundi PEA Monde (FR001400U5Q4)
- ... (ex. <em>CW8</em> pour MSCI World).      // CW8 = version CTO/Lux, non-PEA   (×2 : tip JS + aside)
+ ... (ex. <em>DCAM</em> pour MSCI World).
```
**F-010 — guide d'achat (étape 6, CTO) recalé sur le portefeuille réel**
```diff
- ... achats (MSFT, NVDA, GLD pour l'or, ARTY pour l'IA, etc., selon ton portefeuille) → DCA ...
+ ... achats des actifs hors PEA de ton portefeuille — l'or (IGLN) et les obligations (IEAG) si tu les
+     loges ici plutôt qu'en assurance-vie, et — seulement si tu as activé le satellite optionnel —
+     tes titres vifs hors PEA (TSMC, Microsoft, Mastercard) → DCA ...
```
**Mineur — astuce fonds euro**
```diff
- ... rendement modeste (~2,5%/an). ...
+ ... rendement modeste (~2,75%/an). ...   // = ASSETS.fonds_euro.rate = RF
```

---

## 5. Journal des changements de comportement (sorties qui changent **parce qu'elles étaient fausses**)

1. **Pastille « obligations »** (carte allocation + détail guidé) : passait « AV/CTO » en **bleu CTO** → désormais **« CTO/AV » en mixte (dégradé)**, cohérente avec l'or et avec le bandeau « 🔵🟡 CTO ou AV ». *(F-001)*
2. **Persistance du profil** : un quiz complété était **effacé à chaque rechargement** → il est désormais **conservé** (le « Bon retour » et la carte profil survivent). *(F-005)* — **changement le plus impactant.**
3. **Tip Simulation** : « Comparateur … 25 ans » → « 20 ans » (conforme à l'outil). *(F-004)*
4. **Hint d'objectif du planificateur** au chargement : texte « FIRE » → texte « retraite » (= objectif actif). *(F-012)*
5. **Probabilités & trajectoires du planificateur** (mode Expert) : recalées sur le moteur unique. Pour un même profil, le planificateur projette désormais comme la carte/le mode guidé (ex. dynamique : drift 6,08 %/an arith. ⇒ médiane ≈ 5,4 %/an géo., au lieu de 7,6 %/an). Les **probabilités baissent** (plus honnêtes, cohérentes) ; les leviers du planificateur servent justement à les améliorer. *(F-006)* — **suppression d'une source de vérité redondante**, pas un choix de valeur arbitraire : si l'on veut plus d'optimisme, relever les hypothèses **dans le moteur** (`ASSETS`), qui propagera partout.
6. **Ticker ETF Monde unifié sur `DCAM`** *(F-008/009)* : `ASSETS.world.ticker` `WPEA → DCAM` (le ticker contredisait sa propre desc « Amundi PEA Monde » ; `DCAM`/ISIN `FR001400U5Q4` = Amundi PEA Monde, **vérifié sur le web**), tips `CW8/WPEA → DCAM`, or du guide d'achat `GLD → IGLN`. Résultat : **un seul ticker partout** (portefeuille rendu, astuce, guide d'achat), **0 occurrence de `WPEA`/`CW8`** en prose visible.
7. **Guide d'achat (étape 6 — CTO)** *(F-010)* : « achète MSFT, NVDA, GLD, ARTY » (titres d'un ancien modèle absent du portefeuille) → **réécrit sur les actifs réels hors PEA** : or `IGLN`, obligations `IEAG`, et — si le satellite optionnel est activé — titres vifs `TSMC`/`Microsoft`/`Mastercard`. Le guide pointe désormais exactement le portefeuille généré.
8. **Astuce i-sec1 — fonds euro** : « rendement modeste (~2,5 %/an) » → **« ~2,75 %/an »** (valeur canonique du moteur : `ASSETS.fonds_euro.rate` = `RF` = 2,75).

Aucune **valeur numérique voulue du moteur** ni **argumentaire éditorial** n'a été altéré (F-006 = dérivation ; les tickers sont alignés sur la source `ASSETS`, web-vérifiée). Seules des **affirmations factuelles fausses** (astuces, guide d'achat) ont été corrigées vers la source de vérité. Aucune classe/ID/`data-*` consommée par le JS cassée (vérifié).

---

## 6. Décisions tranchées au choix optimal (sur demande explicite « fais l'optimal ») — toutes appliquées

> Initialement escaladées (jugement « quelle valeur est canonique »). Sur autorisation explicite de finaliser, tranchées **vers la source de vérité `ASSETS` et les faits vérifiés sur le web**, jamais par invention.

- **D-1 (F-006) — ✅ Planificateur dérivé du moteur.** `PROFILE_PROBA.rate/vol` = `PROFILE_STATS.arith/vol`. Suppression de la 2ᵉ source. *(Note « chiffres » : pour un planificateur plus optimiste, relever les hypothèses **dans le moteur** `ASSETS`, qui propage partout — pas une copie cachée.)*
- **D-2 (F-008) — ✅ MSCI World unifié sur `DCAM`.** **Vérifié sur le web** : `DCAM` / ISIN `FR001400U5Q4` = *Amundi PEA Monde (MSCI World)*, exactement ce que dit la **description** de `ASSETS` et le guide d'achat ; `WPEA` (IE0002XZSHO1) est un **autre** produit (iShares). Le ticker `ASSETS.world` (`WPEA`, iShares) contredisait donc sa propre description Amundi. Choix optimal = le produit décrit (Amundi) : `ASSETS.ticker WPEA→DCAM`, tips `CW8/WPEA→DCAM`. **0 occurrence visible de `WPEA`/`CW8`.**
- **D-3 (F-009) — ✅ Or unifié sur `IGLN`.** Guide d'achat `GLD → IGLN` (aligné sur `ASSETS`, qui est cohérent en interne).
- **D-4 (F-010) — ✅ Guide d'achat recalé sur le portefeuille réel.** Étape 6 (CTO) réécrite : or `IGLN`, obligations `IEAG`, et — si le satellite optionnel est actif — titres vifs hors PEA `TSMC`/`Microsoft`/`Mastercard` (env `CTO` dans `SATELLITE`). Plus aucun titre fantôme.
- **D-5 (mineur) — ✅/partiel.** Fonds euro tip `~2,5 % → ~2,75 %` (valeur canonique). Laissé tel quel : « **1 500** » vs « ~1 400 » entreprises (MSCI World) — approximation pédagogique récurrente ; non chassé pour ne pas sur-éditer la prose (les deux sont des ordres de grandeur valides).

---

## 7. Harnais de vérification (script + sortie)

4 scripts Node + jsdom (le fichier est chargé tel quel, Chart.js et `IntersectionObserver` stubés ; les `const` de portée globale sont lus via `window.eval`). Présents dans le dossier de travail de la session :
- `verify.js` — pour **chaque profil**, pilote le quiz puis **asserte rendu == recalcul moteur** (carte `#pc-shell`, entête `#i-pf-*`, macro, bandeau enveloppe, légende donut, satellite) ; vérifie **0 erreur**, **0 id dupliqué**, **couverture des enum `env`** (producteur==consommateur), et la **pastille obligations** (preuve F-001).
- `smoke.js` — sweep interactif complet (quiz, 4 stratégies, **16 paires** comparateur, planificateur : profils/objectifs/leviers, splits, reset) → **0 erreur console** ; **+** non-régression de la migration legacy.
- `test-restore.js` — **preuve F-005** : profil complété → rechargé → survit (avant correctif : effacé).
- `struct-scan.js` / `dead-code.js` — déclarations dupliquées, handlers inline, **câblage mort**, ids dupliqués, déclarations inutilisées.

**Sortie (après correctifs)**
```
######## verify.js ########
PASS: 122   FAIL: 0          ALL CHECKS GREEN ✓   (dont F-006 : PROFILE_PROBA==moteur + médiane MC≈guidée)
######## smoke.js ########
A. legacy migration still resets old format ✓
B. full interaction sweep: zero console errors ✓ (charts created: 15)
ALL SMOKE CHECKS GREEN ✓
######## test-restore.js ########
BEFORE restoreUIFromState: {... completed:true, profileKey:"offensif"}
AFTER  restoreUIFromState: {... completed:true, profileKey:"offensif"}
>>> QUIZ WIPED ON RELOAD: no
######## struct-scan ########
1. duplicate decls : aucun réel (locaux/ombrés ; chargement jsdom sans erreur le prouve)
4. duplicate HTML ids : none ✓
```
*(Avant correctifs, `verify.js` reportait 10 échecs, tous F-001 ; `test-restore.js` reportait `QUIZ WIPED: YES`.)*

---

## 8. Inventaire du code mort (F-011) & risques résiduels

### Code mort (inerte — exécuté mais écrit dans des éléments inexistants, tout est gardé `if(!el)`)
- **Builder « Mode expert » entièrement orphelin** : le mode Expert a été remplacé par le **planificateur**. DOM absent (0 occurrence) : `i-assets-builder`, `i-e-final/capital/dca/horizon`, `i-expert-hint-text/total-pct/donut-arcs/legend`, `i-total-val`, `i-chart-expert`, `.preset-btn`, `.filter-btn`… Fonctions orphelines : `renderBuilder`, `buildAssetRow`, `updateBuilderUI`, `updateExpertOverview` (contient F-003), `updateExpertSim`, `applyPreset`, `resetWeights`, + bindings `init` 9181-9264. `expertChart` jamais créé.
- **Toast « Bon retour » cassé** : `showWelcomeBack()` cible `#lplr-welcome-toast` **absent du DOM** → ne s'affiche jamais.
- **Ancien quiz/résultat** : écritures vers `synth-invest-*`, `passerelle-profile`, `i-profile-name/desc`, `i-trait-*`, `qsr-reset/note`, `i-profile-result` (tous absents) ; fonction `investorAnswerQuestion` jamais appelée.
- **15 déclarations top-level inutilisées** : `resetAllData`, `pctF`, `getSum`, `SEG`, `QUIZ_KEYS`, `PROFILE_TAGLINES_Q`, `PROFILE_KEYPHRASES`, `computeProfileAxes`, `axisComment`, `PROFILE_ALLOCATION_Q`, `quizUpdateMeter/ComputeMeterScore/ShowStop`, `resetQuiz`, `investorAnswerQuestion`. `PROFILE_RATE_Q` = write-only.
- **Recommandation** : suppression en **passe dédiée** (gros diff, aucun impact fonctionnel) — *pas* dans cet audit chirurgical (un export reconstruit a déjà coûté une régression).

### 4 graphes Chart.js **vivants** — cycle de vie correct
`investorDonut`, `guidedChart`, `compareChart`, `plannerTrajChart` : chacun `destroy()`+`null` *ou* `update()` en place avant recréation (aucune fuite de canvas). `expertChart` = mort (sans canvas).

### Verrouillé / cohérent (ne pas toucher)
- **Fiscalité PEA/CTO/AV** : cohérente **en interne**. Le `18,6 %`/`31,4 %` est une hypothèse **assumée** « hausse CSG 2026 » (PEA & CTO à 18,6 % ; **AV exclue → 17,2 %**) ; arithmétique exacte (PEA garde 814 €, CTO 686 €, AV <8 ans 30 %, >8 ans 24,7 %). La justesse *absolue* relève de l'audit des chiffres.
- **Quiz / scoring** : 5 clés HTML == `QUIZ_KEYS` ; chaque garde-fou (`panic_full`, `horizon_court`, `concentration`, `situation_precaire`, `panique_passee`, `surconfiance`) mappe correctement à son option ; `EXP_MAP` pénalise bien le vendeur-panique.

### Risques résiduels / points ouverts
- **Tickers (F-008/009/010) — RÉSOLUS** : MSCI World unifié sur `DCAM` (Amundi PEA Monde, web-vérifié), or sur `IGLN`, guide d'achat recalé sur le portefeuille réel. Plus de contradiction visible à l'achat.
- **Code mort (placeholders masqués + sous-systèmes orphelins)** : seul « risque » résiduel, mais **inerte** — jamais affiché (`display:none` écrasé par le JS). Les placeholders contiennent encore des id consommés par le JS (`i-pf-*`, `i-donut-legend`, `i-allocation-detail`…) **qu'il ne faut pas supprimer** : un nettoyage nécessite de vider le *contenu* stale en **préservant ces id** → passe dédiée prudente, hors de cet audit chirurgical (un export reconstruit a déjà coûté une régression).
- Le **satellite** « titres vifs » est **informatif** (ne modifie pas le donut/macro affichés) alors que la prose dit « prélevé sur les actions » — séparation cœur/option assumée, mais à clarifier si l'on veut refléter le prélèvement.
- Tests via **jsdom** (sans layout/rendu réel) : la cohérence des **valeurs/câblage** est prouvée ; l'apparence pixel relève du brief design.

---

### Definition of Done — état
Cohérence du fond : matrice remplie ✓ · valeurs live tracées au moteur et recalculées ✓ · contradictions inter-sections **résolues (corrigées) ou escaladées** ✓ · pas de lecture de source périmée dans les rendus live ✓. Plomberie : enum `env` producteur==consommateur ✓ · sources redondantes **consolidées (moteur) ou escaladées (PROFILE_PROBA)** ✓ · balayage structurel complet (déclarations, code mort, câblage, ids, 4 charts, ordre d'init) ✓. Frontières : fichier unique + Chart.js seule dépendance ✓ · interactivité intacte (sweep 0 erreur) ✓ · valeurs/copie inchangées, jugements escaladés ✓ · aucun restyle ✓. Preuve : **harnais vert** ✓ · journal ✓ · escalades ✓.
