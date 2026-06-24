# Prompt — Fondre les deux outils finance DANS le socle « Tout au même endroit »

> À coller tel quel dans Claude Code. Les trois fichiers sont dans le dossier du projet. Ce document contient tout ce qu'il te faut. Objectif non négociable : **une seule application**, où la finance est intégrée **proprement, de manière évidente et logique**, dans le socle — pas juxtaposée.

---

## 1. Mission

Tu es un ingénieur front senior. Trois fichiers :

- `Tout_au_meme_endroit.html` — **le socle** (coquille principale, React bundlé).
- `TAME_-_Comptes_et_Budget.html` — **outil 1** (à fondre dans le socle).
- `TAME_-_Investissement.html` — **outil 2** (à fondre dans le socle).

Tu produis **un seul artefact final** : le socle, dans lequel « Comptes & Budget » et « Investissement » sont devenus des **domaines natifs**, au même titre que Identité / Santé / Logement, etc. Une seule identité, un seul thème, un seul écran d'accueil qui voit tout.

Tu travailles **de bout en bout, sans t'arrêter pour validation**, jusqu'à ce que **chaque** critère de la section 9 soit ✅. Tu ne poses une question (QCM court) **que** si tu es réellement bloqué sur un choix non couvert par les défauts de la section 7.

---

## 2. Logique d'ensemble (l'esprit du socle, à étendre)

Le socle est un **coffre personnel calme** qui range la vie par **domaines** et dont l'accueil dit « ce qui requiert ton attention » (échéances, retards). Police Geist, fond sablé `#faf9f5`, accent or `#b3892f`, cartes arrondies, tutoiement FR.

La finance doit **prolonger cette logique, pas s'y coller** :

- « Comptes & Budget » et « Investissement » deviennent **deux domaines** dans la même grille que les rubriques documentaires existantes. On y entre par les mêmes tuiles, on en sort par la même nav.
- L'**accueil unique** agrège les signaux de tous les domaines : à côté des échéances de documents, il fait remonter les signaux finance clés — solde / découvert du mois, budget restant, prochain prélèvement, profil & allocation cible de l'investisseur.
- Tout partage le **même langage visuel et le même état d'identité**. L'utilisateur ne doit jamais sentir qu'il change d'application. Si, en naviguant, on dirait « trois sites différents », c'est raté.

---

## 3. Fait CRITIQUE n°1 : le socle est un artefact compilé (gzip + base64)

`Tout_au_meme_endroit.html` **n'est pas éditable à la main**. C'est un *bundle* :

- `<script type="__bundler/manifest">` = JSON `{ uuid: { data: <base64>, compressed: bool, mime } }`. Assets compressés = **gzip puis base64**.
- `<script type="__bundler/template">` = HTML applicatif (chaîne JSON), contenant `<x-dc>` (le template, avec les `@font-face` Geist) et `<script data-dc-script>` (le composant `class Component extends DCLogic`, monté en **React via `window.React`** par le runtime `dc-runtime`).
- Le vrai code applicatif vit dans `data-dc-script`. Le reste n'est que runtime + polices.

**Procédure obligatoire :** (1) écris un script Node/Python qui décompresse le manifeste (base64 → gunzip) et extrait template + `data-dc-script` ; (2) travaille sur ces **sources décompressées** ; (3) **re-bundle** à l'identique (re-gzip + re-base64 + reconstruction des deux `<script> __bundler/*`). Jamais d'édition du base64 à la main. Garde ce script dans le repo.

Faits du socle (vérifie, puis réutilise) : stockage `localStorage` **`ecrin.app.v1`** → `{profile:{name}, docs:[…]}`, 13 docs démo « Camille Laurent » ; 6 rubriques (`COLLS`) ; **incohérence de marque** « Écrin » (clé + pictogramme) vs « Repère » (marque par défaut affichée) → à trancher ; **aucune dépendance externe** (à préserver).

---

## 4. Fait CRITIQUE n°2 : les deux outils tournent en PORTÉE GLOBALE → ils collisionnent

Vérifié dans le code : **aucun des deux outils n'est isolé** (pas d'IIFE, pas de `type=module`). Comptes débute par `const DATA = {…}` et pose `window.DATA`, `const MONTHS`, `const LS`, `function eur(…)`, etc. **au niveau global**. Investissement déclare lui aussi ses propres globaux (`STATE`, `STORAGE_KEY`, `ASSETS`, ses helpers…).

Conséquences que tu DOIS traiter :

- Si tu colles les deux scripts dans le même document sans isolation, **leurs globaux entrent en collision** (redéclarations, `window.DATA` écrasé). Inacceptable.
- **Règle :** chaque outil est encapsulé dans son **propre module/closure (IIFE ou ES module)**. Aucun global ne fuit, sauf une **petite API en lecture seule** explicitement exposée (voir §5).
- Les deux outils attendent **Chart.js comme global `window.Chart`** : en intégration native, un seul Chart.js partagé (voir D4). Vérifie qu'aucune config `Chart.defaults` d'un outil ne casse l'autre (Comptes modifie `Chart.defaults`) — isole les options par instance de graphe.
- Les espaces de nav diffèrent (`data-tab` pour Comptes, `data-section` pour Investissement) donc pas de collision de ce côté, **mais** je n'ai pas pu lister les collisions d'**`id`** entre les deux (58 ids dans Comptes, 292 dans Investissement) : **tu dois vérifier et préfixer les `id` par outil** (`cb-…`, `inv-…`) avant montage commun.

---

## 5. Stratégie d'intégration : native, mais calculs RÉUTILISÉS VERBATIM

Le risque n°1 est de **casser les calculs** (soldes, moteur fiscal, projections) en réécrivant. Donc :

- **Tu ne réécris pas la logique.** Tu **lèves telles quelles** (verbatim) les fonctions de calcul de chaque outil — analytics/soldes de Comptes, moteur fiscal + projections + simulateur de portefeuille d'Investissement — dans des **modules isolés**. Tu n'y touches pas la logique.
- **Tu réécris uniquement la présentation** (markup + styles) pour qu'elle adopte les tokens du socle (Geist, `#faf9f5`, `#b3892f`, cartes arrondies), et tu la branches sur les mêmes fonctions de calcul.
- Chaque module expose une **petite API de lecture** consommée par l'accueil du socle, ex. `getComptesSignals() → {soldeMois, decouvertMois, budgetRestant, prochainPrelevement}` et `getInvestSignals() → {profil, allocationCible}`. C'est le seul pont ; pas de variables globales partagées.
- L'iframe est **interdit comme cible** (il empêche l'accueil de voir les signaux et le design de fusionner). Tu peux t'en servir au plus comme échafaudage temporaire de test, jamais dans le livrable final.

Ancres de non-régression (doivent rester identiques) — Comptes : `analytics.opening=1500.0`, `analytics.endBalance=1521.21`, `analytics.odDaysTotal=85`, `analytics.avgIncome=2345.45`, `monthEndBalances=[1405.82,1305.55,1320.76,1637.81,1188.68,1521.21]`.

---

## 6. Faits des deux outils (vérifiés)

**Comptes & Budget** — vanilla JS (~197 Ko), **Chart.js 4.4.1 CDN**, fonts Hanken Grotesk + Newsreader. 5 onglets : Aperçu / Transactions / Mois par mois / Budget / Analyses. `const DATA` en dur (user « Julien », 6 mois 2026-01→06, 21 catégories, relevés complets `date/raw/disp/amount/category/status/sol`, `goals` épargne 20 % / invest 10 % / `baseMonthly` 2345.45). Surcouche utilisateur persistée sous **`jl-fin:*`** (`status`, `cat`, `budgets`, `month`, `tmonth`, `check`, `goals`).

**Investissement** — vanilla JS (~13 000 lignes), Chart.js, fonts Google. « Le Petit Livre Rouge — Budget · Investissement · Fiscalité (barème 2026 / revenus 2025) ». Parcours : Ton budget → Ta fiscalité → Ta projection / plan → Ton portefeuille. Quiz profil 5 étapes (`horizon, filet, concentration, tolerance, experience`, 1..4) ; simulateur fiscal FR (IR/TMI/quotient familial/PER/dons) ; univers `ASSETS` (PEA/CTO, `rate`, `vol`) ; constructeur `guided/expert/compare`. Stockage **`lplr-v5`**, migrations `lplr-v1..v4`, `schemaVersion:1`. **`fisc` n'est volontairement PAS persisté** (salaires sensibles, mémoire de session) — ne change pas ça.

---

## 7. Décisions → paramètres (défauts à appliquer sauf indication contraire)

| # | Décision | Défaut |
|---|----------|--------|
| D1 | **Profondeur** | **Intégration native** : domaines finance natifs dans le socle, **logique réutilisée verbatim** (§5). Iframe interdit en cible. |
| D2 | **Identité / données** | **Une seule persona de démo** (remplace Camille ET Julien par un même prénom), données démo **conservées** ; prénom surchargeable via l'onboarding du socle ; bouton « vider la démo / saisir mes données ». |
| D3 | **Marque** | Trancher Écrin vs Repère et l'appliquer partout (UI, `<title>`, pictogramme). Défaut : **« Écrin »** (cohérent avec `ecrin.app.v1`). |
| D4 | **Chart.js** | **Bundlé une seule fois** dans l'artefact (autonomie hors-ligne). Pas deux copies. |
| D5 | **localStorage** | **Ne pas fusionner** : garder `ecrin.app.v1`, `jl-fin:*`, `lplr-v5` intacts (préserve logique + migrations). Ajouter **une** clé pour le profil/identité unifié, lue par les trois domaines. |
| D6 | **Ton** | Tutoiement FR partout. |

---

## 8. Build / packaging

- Livrable = **un seul fichier**, ouvrable au double-clic, **sans serveur**, **sans CORS bloquant**, **sans erreur console**.
- Socle **re-bundlé proprement** (manifeste + runtime intacts).
- Garde dans le repo : sources décompressées du socle, script de (dé)bundle, et `INTEGRATION_NOTES.md` (choix D1–D6 + liste des `id` préfixés + emplacement des fonctions de calcul réutilisées).
- Tests de non-régression : **fige les valeurs AVANT** modification (soldes Comptes ; un jeu de saisie fiscale → IR/TMI/teff d'Investissement) et compare APRÈS.

---

## 9. Critères d'acceptation vérifiables — NE PAS CONCLURE TANT QUE TOUT N'EST PAS ✅

Avance sans demander de validation. **Avant de conclure, relis cette liste et coche chaque point un par un, en affichant ✅/❌ pour chacun.** Un ❌ → tu continues, tu ne rends pas la main.

**Pré-vérifications (à faire EN PREMIER, car non garanties)**
- [ ] Le round-trip de bundle fonctionne : décompresser → recompresser → le socil **se charge sans erreur** (loader `atob`+`DecompressionStream('gzip')`).
- [ ] Le runtime tolère le montage des domaines finance (DOM + scripts isolés) sans casser le rendu React du socle.
- [ ] Les collisions d'`id` entre les deux outils sont listées et **préfixées** (`cb-…` / `inv-…`).
- [ ] Aucun global ne fuit : chaque outil est en closure/module ; seule l'API de signaux est exposée.

**A. Intégrité fonctionnelle (zéro régression)**
- [ ] Comptes : 5 onglets OK, chiffres identiques (ouverture 1500 €, fin 1521,21 €, jours à découvert 85, revenu moyen 2345,45 €, `monthEndBalances` inchangés).
- [ ] Comptes : recatégorisations / statuts / budgets / objectifs persistés sous `jl-fin:*`, survivent au reload.
- [ ] Investissement : parcours complet OK (budget → quiz 5 étapes → fiscalité → projection → portefeuille).
- [ ] Investissement : moteur fiscal → mêmes IR/TMI/teff qu'avant pour la saisie figée.
- [ ] Investissement : `fisc` **toujours non persisté** (rien en `localStorage` ; champs vides après reload).
- [ ] Graphiques Chart.js OK dans les deux domaines ; `Chart.defaults` d'un outil ne dégrade pas l'autre.
- [ ] Socle : coffre documents intact (ajout/édition/suppression/recherche/rappels), `ecrin.app.v1` préservé.

**B. Intégration « évidente et logique dans le socle »**
- [ ] Un seul écran d'accueil donne accès aux domaines (Documents + Comptes & Budget + Investissement) via la **même nav**.
- [ ] **Une seule identité/prénom** partout (plus de Camille vs Julien).
- [ ] Design **unifié** : tokens du socle (Geist, `#faf9f5`, `#b3892f`, cartes arrondies) appliqués aux deux domaines finance — on ne voit plus la couture.
- [ ] L'accueil agrège **≥ 3 signaux finance** (solde/découvert, budget restant, prochain prélèvement, profil/allocation) à côté des échéances de documents, via l'API de signaux.
- [ ] **Marque unique** cohérente (Écrin vs Repère tranché) dans UI, `<title>`, pictogramme.
- [ ] Tutoiement FR cohérent partout.

**C. Build**
- [ ] Artefact = **un seul fichier**, double-clic, sans serveur, sans CORS, **sans erreur console**.
- [ ] Chart.js **bundlé une seule fois** (pas de CDN, pas de doublon).
- [ ] `INTEGRATION_NOTES.md` présent et à jour.

**D. Process**
- [ ] Toute modif du socle est passée par décompresser → éditer sources → re-bundler.
- [ ] Logique de calcul **réutilisée verbatim** (non réécrite) ; seule la présentation a été refaite.
- [ ] Cette checklist a été **relue et cochée point par point** dans le message de conclusion.

---

## 10. Démarrage

1. Lis les trois fichiers ; confirme les faits des §3–§6 (les ancres chiffrées surtout).
2. Écris le script de (dé)bundle ; valide le round-trip (pré-vérif).
3. Isole les deux outils en modules (closures, `id` préfixés, API de signaux).
4. Refais la présentation aux tokens du socle ; branche-la sur les calculs verbatim.
5. Construis l'accueil unifié qui agrège les signaux.
6. Déroule la section 9 jusqu'au bout, puis coche la liste.

Go.
