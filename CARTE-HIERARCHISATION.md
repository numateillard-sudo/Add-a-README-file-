# Carte de hiérarchisation — « Légèreté » (divulgation progressive, **niveau section**)

> Principe : *ouverture de section = reste ouverte* · *corps de section = se replie* (jamais supprimé, juste plié).
> **Correctif** : la 1ʳᵉ tentative ne repliait que quelques blocs de l'Allocation → le ressenti de lecture n'avait pas bougé. On replie désormais **le corps entier de chaque grande section de lecture**, par défaut. Résultat visé : une **pile compacte de têtes de section** à l'arrivée.

## Règle mécanique appliquée (identique pour les 6 zones)

Pour chaque section : on **garde visible son ouverture existante** — eyebrow + titre + intro (`.section-head` / `.envelopes-intro`). On **replie tout le reste du corps déjà présent** dans un dépliable **fermé par défaut**. Rien n'est réécrit ni retiré : le contenu est *déplacé* dans la région repliable (toujours dans le DOM).

## Les 6 zones repliées au niveau section (toutes obligatoires)

| # | Section | Reste visible (ouverture) | Se replie (corps) | Clé |
|---|---|---|---|---|
| 1 | **#i-sec1 Notions** | Étape 1 · « Les notions essentielles » + intro | **les 6 `notion-card`** (le plus gros gain) | `sec-notions` |
| 2 | **Enveloppes (Fiscalité)** | « Où mettre ton argent » + intro | les 3 cartes PEA · CTO · Assurance-vie | `sec-fisc` |
| 3 | **#i-sec2 Profil** | Étape 2 · « Ton profil en cinq questions » + intro | baromètre + quiz + carte-résultat (radar, verdict…) | `sec-profil` |
| 4 | **#i-sec3 Allocation** | Étape 3 · « Mon portefeuille personnalisé » + intro | macro, enveloppes, **donut**, accordéon d'alloc, projection, **pas-à-pas (7 étapes)**, **FAQ** | `sec-alloc` |
| 5 | **#i-sec4 Simulation** | Étape 4 · « Simule la croissance… » + intro | sélecteur de mode, contrôles, **3 graphiques**, 2 `book-note` | `sec-simu` |
| 6 | **Bilan / plan d'action** | = pas-à-pas concret (dans #i-sec3, replié ci-dessus) | idem | (via `sec-alloc`) |

> Les 4 replis de **bloc** posés à la tentative précédente (pas-à-pas, FAQ, 2 `book-note`) restent en place : ils sont désormais **imbriqués** dans le repli de leur section (double repli — encore plus compact une fois la section ouverte).

## Ce qui RESTE ouvert par principe (jamais replié)
- **Header / Hero / Synthèse** et les **couvertures de chapitre** : navigation et promesse, on n'y touche pas.
- Les **têtes** des 6 sections (eyebrow + titre + intro) : le lecteur garde la carte mentale du document.
- La **stepper-bar** (navigation par sauts + scroll-spy) et la barre de progression.

## Affordance & navigation
- 1ʳᵉ visite = **tout replié** → pile de têtes de section. Chaque tête est suivie d'un **bouton de section** in-identité (liseré doré, libellé « Lire les 6 notions », « Répondre aux 5 questions », …).
- Contrôle global **« ⇕ Tout déplier / Tout replier »** dans la stepper-bar — porte sur **tout le document** (sections + blocs), pas seulement l'allocation.
- **Cliquer une étape** de la stepper (ou tout lien `navTo`) **déplie la section cible puis scrolle** — l'entrée par le questionnaire (« Refaire le quiz ») ouvre et scrolle l'étape Profil.
- **Scroll-spy** conservé : l'étape active suit la section visible (calcul par `offsetTop`, robuste au repli).
- Accordéon d'allocation (`alloc-merged-card`) **fermé par défaut** (les cartes rendues portent `collapsed`).

## Mesure (preuve de l'allègement)
À contenu identique, repli vs déployé :
- **1er chargement (aucun profil)** : **2 608 px** vs 5 565 px → **−53 %**.
- **Profil complété (allocation révélée)** : **3 836 px** vs 11 852 px → **−68 %**.

## Révisable
Déplacer une zone « ouverte ↔ repliée » = ajouter/retirer `data-lplr-section="Libellé"` + `data-lplr-key="clé"` sur la `<section>` (le composant fait le reste). Aucun contenu n'est touché.
