# Journal des changements — « Légèreté » (divulgation progressive)

Objectif : réduire le **poids ressenti à la lecture** d'un document déjà bon, **sans toucher ni la forme ni le fond**. Niveau « Moyen » : résumé compact par défaut + détail replié, **scroll éditorial continu conservé**.

> Approche **additive et réversible** : un bloc CSS + un script en fin de page + 4 attributs `data-lplr-fold` sur les blocs lourds. **Aucun contenu réécrit ou supprimé** (les blocs sont *pliés*, jamais retirés du DOM). Tout est dans l'identité existante (palette, polices, composants).

## Ce qui a été ajouté

1. **Composant de repli accessible** (`<style>` + `<script>` en fin de page) :
   - En-tête = vrai `<button>` avec `aria-expanded` + `aria-controls`, **opérable au clavier** (focus visible).
   - **Animation de hauteur fluide** via `grid-template-rows: 0fr → 1fr` (jamais de `display:none` qui saute).
   - **`prefers-reduced-motion`** respecté (transition neutralisée).
   - Le contenu replié **reste dans le DOM** (le JS qui le lit continue de fonctionner).

2. **4 nouveaux replis** posés sur les seuls blocs encore « toujours ouverts » (cf. `CARTE-HIERARCHISATION.md`) :
   - i-sec3 — « Le pas-à-pas concret pour passer à l'action — 7 étapes » (`concrete-box-rich`).
   - i-sec3 — « Les questions qu'on n'ose pas poser » (FAQ, `faq-block`).
   - i-sec4 — « Une nuance sur le scénario pessimiste » (`book-note` guidé).
   - i-sec4 — « À propos du « meilleur » rendement » (`book-note` comparateur).
   - *(Notions, cartes FAQ, accordéons d'allocation, quiz pas-à-pas, `<details>` : déjà repliés — inchangés.)*

3. **Contrôle global** « ⇕ Tout déplier / Tout replier » dans la `stepper-bar`.

4. **Progression de lecture** : fine barre dorée sous la `stepper-bar` (suit le scroll). La navigation par sauts / scroll-spy de la `stepper-bar` (section active + ancre fluide via `navTo`) **existait déjà** — conservée.

5. **Persistance** dans le **schéma existant** (`STATE.investor.folds`, persisté par `saveState`/`loadState`, cohérent avec `STORAGE_KEY`/`schemaVersion`). **1re visite = tout compact.**

## Robustesse (pièges traités)

- **Chart.js dans un conteneur replié** : aucun des 4 graphiques n'est plié (donut + 3 charts de simulation restent dans la partie *essentielle, ouverte*). Filet de sécurité : à l'ouverture d'un repli, `Chart.getChart(canvas).resize()` est appelé sur tout canvas contenu (zéro bug de taille nulle). Vérifié sur les 4 instances.
- **Aucune init de chart à l'état caché** (les charts sont créés par l'app dans la zone visible, pas dans un repli).
- **Aucune animation décorative** : seule la transition de hauteur du repli existe.
- **Aucun `id`/classe/`data-*` existant renommé** ; le composant *enveloppe* les blocs (re-parentage), sans casser les recherches par `id`.

## Trade-off assumé

- **Position de scroll non persistée** (le « si possible » de la spec) : elle entrerait en conflit avec le comportement demandé précédemment « le document s'ouvre toujours sur le questionnaire ». L'**état ouvert/fermé des replis**, lui, est bien persisté.

## Vérification (tous les états)

Harnais reproductible (`audit-harness/`) :
- `render-folds.js` (Chromium) : **16/16** — 4 replis créés, **compacts par défaut**, contenu conservé dans le DOM, `aria-expanded`/`aria-controls`, **ouverture au clavier (Entrée)**, donut non plié, **persistance** (écriture + restauration au rechargement), **0 erreur console**.
- `render-behavior.js` : **8/8** (entrée par le questionnaire intacte).
- `verify.js` **135/0**, `smoke.js` 0 erreur (quiz, 4 profils, 3 modes, 16 paires comparateur, planificateur) — **interactivité existante intacte**.
- Chargement propre, 0 `id` dupliqué.

## Réversibilité

Retirer un attribut `data-lplr-fold` = le bloc redevient toujours ouvert. Retirer le `<style>`/`<script>` « LÉGÈRETÉ » = retour à l'état précédent. Rien d'irréversible, rien de supprimé.
