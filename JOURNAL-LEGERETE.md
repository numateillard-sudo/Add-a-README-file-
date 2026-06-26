# Journal des changements — « Légèreté » (divulgation progressive)

Objectif : réduire le **poids ressenti à la lecture** d'un document déjà bon, **sans toucher ni la forme ni le fond**. Les blocs sont **pliés, jamais réécrits ni retirés** du DOM.

## Correctif d'allègement — passage au **niveau section**

La 1ʳᵉ tentative ne repliait que quelques **blocs** de la section Allocation (pas-à-pas, FAQ, 2 notes). Les **grandes sections de lecture restaient entièrement déployées** → le ressenti de lecture n'avait pas bougé. Ce correctif applique le repli **au niveau de chaque section** : on garde l'**ouverture** (eyebrow + titre + intro), on **replie tout le corps**.

> Approche **additive et réversible** : un bloc CSS + un script en fin de page + **5 attributs `data-lplr-section`** sur les `<section>` (et les 4 `data-lplr-fold` de bloc déjà posés). Tout est dans l'identité existante (palette, polices, composants).

## Ce qui a été fait

1. **6 zones repliées par défaut au niveau section** (cf. `CARTE-HIERARCHISATION.md`) :
   Notions (`sec-notions`), Enveloppes/Fiscalité (`sec-fisc`), Profil (`sec-profil`),
   Allocation (`sec-alloc`), Simulation (`sec-simu`), et le Bilan/plan d'action (= le pas-à-pas, dans Allocation).
   Mécanique unique : on garde `.section-head` / `.envelopes-intro` visibles, on déplace **tout le corps** dans une région repliable fermée.

2. **Replis de bloc imbriqués** : les 4 replis posés avant (pas-à-pas 7 étapes, FAQ, 2 `book-note`) sont maintenant **dans** le repli de leur section → double repli, encore plus compact.

3. **En-tête de section accessible** : vrai `<button>` avec `aria-expanded` + `aria-controls`, **opérable au clavier** (focus visible), libellé d'action (« Lire les 6 notions », « Répondre aux 5 questions »…). Style in-identité, **plus marqué** que les replis de bloc (liseré doré, taille).

4. **Animation de hauteur fluide** via `grid-template-rows: 0fr → 1fr` (jamais de `display:none` qui saute). **`prefers-reduced-motion`** respecté.

5. **Contrôle global « ⇕ Tout déplier / Tout replier »** dans la stepper-bar — porte sur **tout le document** (sections + blocs).

6. **Navigation** : `navTo` **enveloppé** → cliquer une étape (ou « Refaire le quiz », ou tout lien d'ancre) **déplie la section cible** puis scrolle. **Scroll-spy** conservé (étape active par `offsetTop`, robuste au repli). Barre de **progression de lecture** sous la stepper.

7. **Persistance** dans le **schéma existant** (`STATE.investor.folds`, persisté par `saveState`/`loadState`). **1re visite = tout replié.** L'état ouvert/fermé de chaque section est mémorisé ; le profil reste, lui, ré-initialisé au rechargement (entrée toujours par le questionnaire — comportement voulu, inchangé).

8. **Accordéon d'allocation** (`alloc-merged-card`) **fermé par défaut** : les cartes rendues portent `collapsed` (vérifié : 6/6 repliées sur profil Offensif). Les cartes statiques du DOM sont des placeholders **masqués** (remplacés par le rendu dès qu'un profil existe).

## Mesure — l'allègement, chiffré (viewport 1180×900)

| État (contenu identique) | Par défaut (replié) | Tout déployé | Gain |
|---|---|---|---|
| **1er chargement** (aucun profil) | **2 608 px** (2,9 écrans) | 5 565 px (6,2 écrans) | **−53 %** |
| **Profil complété** (allocation révélée) | **3 836 px** (4,3 écrans) | 11 852 px (13,2 écrans) | **−68 %** |

> Reproductible : `node audit-harness/measure-height.js`.

## Robustesse (pièges traités)

- **Chart.js dans un conteneur replié** : les 4 graphiques (donut + 3 simulations) vivent désormais dans des sections repliées. Aucun n'est **initialisé à l'état caché** par un chemin nouveau (l'app les crée comme avant) ; filet de sécurité : à l'**ouverture** d'une section, `Chart.getChart(canvas).resize()` est appelé sur chaque canvas révélé (zéro bug de taille nulle). Vérifié : donut rendu dans la section ouverte + `resize()` déclenché.
- **Re-parentage non destructeur** : déplacer le corps d'une section dans la région repliable ne casse aucune recherche `getElementById` / `querySelector` (descendant). Prouvé : `verify.js` 135/0 et `smoke.js` 0 erreur **après** repli.
- **Aucune animation décorative** : seule la transition de hauteur du repli existe.
- **Aucun `id`/classe/`data-*` existant renommé** ; le composant *enveloppe* / re-parente, sans casser le câblage.

## Trade-off assumé
- **Position de scroll non persistée** (le « si possible » de la spec) : entrerait en conflit avec l'entrée systématique par le questionnaire. L'**état des replis**, lui, est bien persisté.

## Vérification (tous les états) — `audit-harness/`
- `render-folds.js` (Chromium) : **20/20** — 5 replis de section + 4 de bloc imbriqués, **compacts par défaut**, têtes visibles, 6 notions repliées, **hauteur défaut < 70 % du déployé**, « Tout déplier/replier », accessibilité (`button`, `aria-*`, **clavier**), **navTo déplie la section**, **donut redimensionné** à l'ouverture, **scroll-spy** correct, **persistance** (écriture + restauration), **0 erreur console**.
- `render-behavior.js` (Chromium) : **8/8** — entrée compacte, aucun profil figé, l'ouverture du Profil révèle la question 1, quiz → profil en session, rechargement → retour au questionnaire.
- `measure-height.js` (Chromium) : preuve avant/après (−53 % / −68 %).
- `verify.js` **135/0**, `smoke.js` 0 erreur — **interactivité existante intacte** après repli.

## Réversibilité
Retirer un attribut `data-lplr-section` (ou `data-lplr-fold`) = la zone redevient toujours ouverte. Retirer le `<style>`/`<script>` « LÉGÈRETÉ » = retour à l'état précédent. Rien d'irréversible, rien de supprimé.
