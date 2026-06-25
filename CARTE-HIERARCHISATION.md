# Carte de hiérarchisation — « Légèreté » (divulgation progressive)

> Principe : *essentiel = reste ouvert* · *détail = se replie* (jamais supprimé, juste plié).
> Niveau « Moyen » : scroll éditorial continu conservé ; chaque section montre une surface compacte, le détail se tire à la demande.
> **Constat clé** : le document était **déjà très replié** (cartes Notions, FAQ, accordéons d'allocation, `<details>`, quiz pas-à-pas, stepper). La lourdeur résiduelle venait des **rares blocs encore toujours ouverts**. Ce sont eux qu'on plie.

## Par section

| Section | RESTE OUVERT (essentiel / résumé) | SE REPLIE (détail) | Déjà replié avant ? |
|---|---|---|---|
| **Header / Hero / Synthèse** | tout (promesse, navigation) | — | — |
| **Couverture Chap II** | tout (les 4 étapes) | — | — |
| **#i-sec1 Notions** | titres des 6 `notion-card` (+ taglines) | corps de chaque notion | ✅ oui (`.notion-card.open`) — inchangé |
| **Enveloppes (Fiscalité)** | les 3 cartes PEA/CTO/AV (titre + atouts clés + courtiers) | — (déjà compactes) | compactes |
| **#i-sec2 Profil** | baromètre, quiz (1 question à la fois), carte-résultat (verdict, appétit/capacité, radar, rendement & risque) | « C'est quoi, ces chiffres ? » | ✅ oui (quiz pas-à-pas + `<details>`) — inchangé |
| **#i-sec3 Allocation** | entête (nom, stats), macro-bandeau, bandeau enveloppes, **donut + légende**, détail d'allocation (accordéon), table de projection | **« Le pas-à-pas concret » (7 étapes)** → **NOUVEAU repli** · **« Les questions qu'on n'ose pas poser » (FAQ)** → **NOUVEAU repli** | partiellement (accordéon alloc, FAQ cards) |
| **#i-sec4 Simulation** | sélecteur de mode, contrôles + résultats + **graphique** du mode actif | **2 `book-note`** (« Une nuance… », « À propos du meilleur ») → **NOUVEAU repli** | partiellement |
| **Bilan / plan d'action** | = le pas-à-pas concret (replié, ci-dessus) | idem | — |

## Nouveaux replis posés (4)
1. `concrete-box-rich` (i-sec3) → **« Le pas-à-pas concret pour passer à l'action — 7 étapes »** (replié par défaut)
2. `faq-block` (i-sec3) → **« Les questions qu'on n'ose pas poser »** (replié)
3. `book-note` guidé (i-sec4) → **« Une nuance sur le scénario pessimiste »** (replié)
4. `book-note` comparateur (i-sec4) → **« À propos du « meilleur » rendement »** (replié)

## Ce qui RESTE OUVERT par principe (jamais replié)
- Tous les **chiffres clés** (entêtes, stats de profil, macro, projection).
- La **carte-résultat** du profil et l'**allocation active** (donut + répartition) — les graphiques restent visibles (zéro bug de taille nulle).
- Les contrôles interactifs (quiz, sliders, sélecteurs de mode/stratégie).

## Affordance
- 1ʳᵉ visite = **tout compact** (replié). Bouton **« ⇕ Tout déplier / replier »** dans la stepper.
- Les replis déjà existants (Notions, FAQ cards, accordéons) gardent leur comportement (inchangés).

## Révisable
Cette carte est faite pour être ajustée : déplacer un bloc « ouvert↔replié » = ajouter/retirer `data-lplr-fold` sur l'élément (le composant fait le reste). Aucun contenu n'est touché.
