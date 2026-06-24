# INTEGRATION_NOTES — Écrin : la finance fondue dans le socle

Ce document explique comment les deux outils finance (« Comptes & Budget » et
« Investissement ») ont été **fondus comme domaines natifs** dans le socle
« Tout au même endroit », les décisions prises (D1–D6), l'isolation des deux
outils, l'emplacement des calculs réutilisés **verbatim**, et la vérification.

Livrable final : **`Ecrin.html`** — un seul fichier, ouvrable au double-clic,
sans serveur, **hors-ligne**, sans erreur console.

---

## 1. Architecture

Le socle est un artefact auto-extractible (`<script type="__bundler/manifest">`
= assets gzip+base64, `<script type="__bundler/template">` = HTML JSON). À
l'ouverture, son *loader* décode les assets en blob URLs, substitue les uuids
dans le template, parse et monte le tout. Le code applicatif vit dans
`<script type="text/x-dc" data-dc-script>` (classe `Component extends DCLogic`)
+ le template `<x-dc>`, compilés en **React** par le runtime `dc-runtime`.

Les deux outils finance restent du **vanilla JS** ; ils sont **encapsulés
chacun dans un module isolé** (`window.ECRIN_CB`, `window.ECRIN_INV`) chargé
comme asset, et **montés à la demande** par le socle dans un hôte stable
(`#cb-host` / `#inv-host`) via les hooks de cycle de vie de `DCLogic`
(`componentDidMount` / `componentDidUpdate` / `componentWillUnmount`).

```
ouverture → loader décompresse → <head> charge (ordre, awaited) :
   react → react-dom → chart.js → ECRIN_CB → ECRIN_INV → dc-runtime
dc-runtime monte React(socle) → accueil agrège les signaux finance (API)
clic « Comptes & Budget » → setState → componentDidUpdate → ECRIN_CB.mount(#cb-host)
clic « Investissement »   → setState → componentDidUpdate → ECRIN_INV.mount(#inv-host)
retour accueil            → componentDidUpdate → ECRIN_*.unmount()
```

Un seul module est monté à la fois. React ne rend **aucun enfant** dans
`#cb-host`/`#inv-host`, donc il laisse intact le DOM injecté par le module
(échappatoire React classique pour héberger du DOM non-React).

`mount(el)` injecte le markup **enveloppé dans l'élément racine du scope**
(`<div id="cb-root">…</div>` / `<div id="inv-root">…</div>`) : c'est
indispensable pour que la feuille de style scopée (`#cb-root …`) matche réellement
les éléments. (Sans cette racine, le CSS ne s'applique pas — bug corrigé,
désormais couvert par un test qui vérifie que les sélecteurs scopés matchent le
DOM rendu, et par un rendu Chromium réel.)

---

## 2. Décisions (paramètres §7 du prompt)

| # | Décision | Choix appliqué |
|---|----------|----------------|
| **D1** | Profondeur | **Intégration native.** Logique de calcul **réutilisée verbatim** (modules isolés) ; seule la présentation a été re-tokenisée. **Aucune iframe.** |
| **D2** | Identité / données | **Une seule persona de démo : « Camille ».** « Julien » (Comptes) supprimé du DOM ; Investissement n'avait pas de persona. **Comptes & Budget démarre VIERGE** : parcours *accueil → import d'un relevé bancaire (CSV) → tableau de bord* ; le relevé démo de l'outil devient un « relevé d'exemple » accessible d'un clic. Prénom surchargeable via l'onboarding du socle. |
| **D3** | Marque | **« Écrin »** partout : marque par défaut de la barre latérale, `<title>`, pictogramme « É » (thumbnail + étoile or), copies (`Ajouter à Écrin`, etc.). L'ancien « Repère » a été unifié. |
| **D4** | Chart.js | **Bundlé une seule fois** comme asset compressé (`chart.umd.js` 4.4.1), partagé par les deux domaines. **Aucun CDN.** |
| **D5** | localStorage | **Non fusionné.** `ecrin.app.v1`, `jl-fin:*`, `lplr-v5` (+ legacy) restent intacts. **Une** clé ajoutée : `ecrin.identity.v1` `{name}`, écrite par le socle, disponible pour les 3 domaines. |
| **D6** | Ton | Tutoiement FR partout. |

---

## 3. Isolation des deux outils (§4 du prompt)

Le risque réel = **collision** entre les deux outils (redéclarations de globaux,
`window.DATA` écrasé) et fuite de styles. Traité ainsi :

- **Globaux JS** : chaque outil est enveloppé dans **une IIFE** (`tools/build.mjs`).
  Ses ~70 (Comptes) / ~200 (Investissement) déclarations top-level deviennent
  locales → **aucune redéclaration**. Vérifié : les seuls `window.*` exposés sont
  `window.ECRIN_CB` et `window.ECRIN_INV` (test dans `tools/build.mjs` + grep).
  - `window.DATA = DATA` (Comptes, jamais relu) : **retiré**.
  - Handlers inline d'Investissement (`navTo`, `showBilan`, `closeBilan`,
    `downloadBilanHTML`, `handleBilanCopy/Gmail/Print/Send`, `resetAllData`,
    `switchMode`) : déplacés du `window.*` vers des locales, **ré-routés** dans le
    markup en `ECRIN_INV.<name>(…)` et exposés sur l'objet `ECRIN_INV`.
  - Drapeaux internes `__bootstrapped` / `__bilanShowFisc` : déplacés sur un objet
    de module privé (`__ecrinFlags`).
- **CSS** : chaque feuille de style est **scopée à sa racine** (`#cb-root` /
  `#inv-root`) via PostCSS (`tools/lib/scope-css.mjs`) — `body`→`#root`,
  `*`→`#root *`, sélecteurs préfixés en descendant, et **noms de `@keyframes`
  namespacés** (`cb-` / `inv-`) avec réécriture des références `animation`. Plus
  de fuite de style entre outils ni vers le socle.
- **Collisions d'`id`** : 58 ids (Comptes) vs 292 ids (Investissement). Le socle
  React n'utilise **aucun `id`**. Comme **un seul module est monté à la fois**,
  `document.getElementById('overview')` (Comptes) et les ids `b-*`/`i-*`/`f-*`
  (Investissement) ne coexistent jamais → **aucune collision runtime**. Les
  conteneurs hôtes sont préfixés (`cb-host`, `inv-host`) et le scope CSS
  (`#cb-root` / `#inv-root`) sépare les deux espaces. Liste des ids génériques à
  risque si on montait les deux en même temps (on ne le fait pas) :
  - Comptes : `overview, transactions, mvm, budget, insights, toast, proj, truths, …`
  - Investissement : `hero, main-content, stepper, quiz-stage, score-*, plan-step-*, contextual-tip, …`
- **Chart.js partagé** : Comptes mute `Chart.defaults` (police → **Geist**, repassé
  des valeurs neutres). Investissement **ne touche pas** `Chart.defaults` et passe
  ses options **par instance** → la mutation de Comptes ne casse pas ses graphes.
  Chaque module nettoie ses instances de graphe au démontage (`unmount()` met les
  variables de chart à `null` et appelle `.destroy()`), ce qui évite les graphes
  orphelins / le bug du chart « réutilisé » (`compareChart`) au re-montage.

---

## 4. Présentation re-tokenisée (sans toucher la logique)

Chaque module reçoit, **après** sa CSS scopée, un bloc d'override mappant ses
tokens vers ceux du socle (`tools/build.mjs`) :

- Police → **Geist** (au lieu de Hanken Grotesk/Newsreader pour Comptes, Inter/
  Fraunces pour Investissement).
- Fond → sable du socle (`#f4f1ea`, `--paper`/`--bg` transparent pour hériter du
  dégradé), cartes blanches arrondies, accent **or `#b3892f`**.
- Le chrome propre à chaque outil (barre de titre « Julien… » de Comptes,
  `.site-header` d'Investissement) est masqué : le socle porte l'en-tête du
  domaine. On ne voit plus la couture.

La **logique de calcul n'est pas réécrite** : le `<script>` de chaque outil est
**copié verbatim** par le build (extraction programmatique, jamais de troncature),
puis seulement enveloppé/connecté.

---

## 5. Emplacement des calculs réutilisés verbatim

**Comptes & Budget** (dans `ECRIN_CB`, code source verbatim) :
- `recomputeAnalytics()` → `opening, endBalance, odDaysTotal, avgIncome,
  monthEndBalances, balByMonth[m]{end,odDays,trough,…}`.
- `monthIncome, catSpend, computeSavings, effCat, FIXED_CATS, DATA.goals.baseMonthly`
  → budget variable restant, prochain prélèvement.
- API : `ECRIN_CB.getSignals() → { soldeMois, decouvertJours, budgetRestant,
  prochainPrelevement{label,amount,date}, analytics{…} }`.

**Investissement** (dans `ECRIN_INV`, code source verbatim) :
- Quiz profil : `quizDetermineProfile(answers) → {key}`, `PROFILE_ALLOCATION_Q[key]`.
- Moteur fiscal : `TRANCHES`, `calcIR_brut`, `getTMI`, `decote`, `calcIR_net`,
  `getParts`, `fiscalCompute` (IR / TMI / taux effectif).
- API : `ECRIN_INV.getSignals() → { profil, profilKey, allocationCible{actions,
  obligations,or}, aProfil }`.

`fisc` reste **non persisté** : `saveState()` ne sérialise que
`{schemaVersion, budget, investor}`. Au reload, les champs fiscaux repartent à zéro
(données salaires sensibles, mémoire de session) — **inchangé**.

---

## 6. Découverte importante : React/ReactDOM étaient sur un CDN

Le runtime `dc-runtime` charge **React 18.3.1, ReactDOM 18.3.1 et Babel depuis
`unpkg.com`** à l'exécution (constantes `REACT_URL`, `REACT_DOM_URL`, `BABEL_URL`).
Le socle d'origine n'était donc **pas réellement hors-ligne**, malgré son libellé
« 100% local · hors ligne ».

`loadReactUmd()` contient un garde : `if (window.React && window.ReactDOM) return`.
On **bundle donc React + ReactDOM** localement (assets compressés) et on les charge
**avant** le runtime → le garde court-circuite l'appel CDN. L'artefact est
**vraiment hors-ligne**. Babel n'est sollicité que pour du JSX/`text/babel` (le
socle n'en a aucun), il n'est donc pas chargé — pas besoin de le bundler.

---

## 7. Build & (dé)bundle — `tools/`

| Script | Rôle |
|--------|------|
| `tools/debundle.mjs` | Décompresse le socle → `build/decompiled/` (manifest meta, assets, `template.html`, `x-dc.html`, `data-dc-script.js`). |
| `tools/lib/extract.mjs` | Extrait CSS / markup / JS d'un outil (robuste au `</body>`/`</script>` planqué dans une string). |
| `tools/lib/scope-css.mjs` | Scope la CSS d'un outil à sa racine (PostCSS) + namespace les `@keyframes`. |
| `tools/build.mjs` | Génère `build/modules/ecrin-cb.js` et `ecrin-inv.js` (IIFE + CSS scopée + tokens socle + `mount/unmount/getSignals`). |
| `tools/assemble.mjs` | Insère les fragments finance dans `x-dc`, enregistre les assets (react, react-dom, chart, cb, inv), recompose le template → `build/staged/`. |
| `tools/rebundle.mjs` | Re-gzip + re-base64 + reconstruit les 3 blocs `__bundler/*` → `build/Ecrin.html`. Échappe `</script` → `<\/script`. |

Source éditée à la main : **`src/socle/data-dc-script.js`** (logique du socle +
intégration finance). Tout le reste est **généré**. `npm run build` exécute la
chaîne complète et vérifie le round-trip.

> **Procédure obligatoire respectée** : toute modif du socle passe par
> *décompresser → éditer les sources → re-bundler*. Jamais d'édition du base64 à
> la main.

---

## 8. Vérification

`npm test` lance 4 suites (aucun navigateur n'étant disponible dans
l'environnement, la validation se fait sans Chromium mais reste rigoureuse) :

1. **`tools/verify-bundle.mjs`** — rejoue exactement la logique du *loader*
   (atob → gunzip → substitution uuid → contrôles structurels). Prouve que les 17
   assets se décompressent et que le template se réassemble. **PASS.**
2. **`tools/smoke.mjs`** — charge les modules dans un shim DOM, vérifie l'API et
   les ancres Comptes. **PASS.**
3. **`tools/nonreg.mjs`** — **avant == après == figé** : analytics Comptes
   (1500 / 1521,21 / 85 j / 2315,70 / `monthEndBalances`) et moteur fiscal
   Investissement (IR 3904 € / TMI 30 % / taux effectif 9,8 % pour
   célibataire, 40 000 €, 1 part). Le bloc moteur fiscal est **byte-identique**
   entre la source et le module. **10/10.**
4. **`tools/test-jsdom.mjs`** — monte le socle intégré **réel** (runtime + React +
   modules) dans jsdom : marque Écrin, nav finance, signaux agrégés à l'accueil,
   clics qui montent chaque module (`#cb-host` → onglets Comptes + `#overview`,
   `#inv-host`), documents intacts, **aucune erreur console**, et **le CSS
   s'applique** (racine de scope présente + sélecteurs scopés qui matchent le DOM :
   220/362 pour Comptes, 884/1373 pour Investissement). **30/30.**
5. **`tools/screenshot.mjs`** — rend le **vrai `Ecrin.html` auto-extractible dans
   Chromium headless** (binaire `/opt/pw-browsers`) : déballe le bundle, saisit un
   prénom, navigue dans les deux domaines, **capture des screenshots** et vérifie
   les **styles calculés** (`#cb-root .card` → fond blanc, rayon 16px, police
   Geist) + **0 erreur console**. **5/5.** C'est la validation visuelle + chemin
   auto-extractible complet (la seule couture que jsdom ne couvrait pas).
6. **`tools/test-fullflow.mjs`** — variante jsdom du chemin auto-extractible :
   **skip** (jsdom n'a ni `URL.createObjectURL` ni `<script src=blob:>` ; couvert
   par 1, 5 et la *loop closure*).

**Loop closure** : `Ecrin.html` re-décompressé redonne un `template.html`
**byte-identique** au `staged` et les 5 nouveaux assets (react, react-dom, chart,
cb, inv) **byte-identiques** → l'artefact se déballe exactement en l'app testée.

> Note ancre `avgIncome` : le prompt cite **2345,45**, mais c'est la valeur
> **stockée** dans `DATA.analytics`/`DATA.goals.baseMonthly`. L'outil d'origine
> exécute `recomputeAnalytics()` au démarrage, qui **l'écrase** par la valeur
> recalculée **2315,70** (Σ revenus mensuels / 6). Le module reproduit
> exactement ce comportement d'origine (vérifié sur le script non modifié) :
> il n'y a donc **aucune régression** — la valeur live est 2315,70 avant et après.

---

## 9. Réouverture / persistance

- Les recatégorisations, statuts, budgets, objectifs de Comptes survivent au
  reload (`jl-fin:*`). Le profil/quiz/poids d'Investissement aussi (`lplr-v5`,
  migrations `lplr-v1..v4`). Le coffre documents du socle reste sur `ecrin.app.v1`.
- Identité unifiée : le prénom de l'onboarding alimente `ecrin.app.v1.profile.name`
  **et** `ecrin.identity.v1`.
