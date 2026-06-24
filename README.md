# Écrin — tout au même endroit, finance comprise

Un **seul** fichier HTML, ouvrable au double-clic, **hors-ligne**, qui range ta
vie par domaines : tes **documents** (identité, santé, logement…) **et** tes
**finances** — « Comptes & Budget » et « Investissement » — devenus des domaines
**natifs** du même socle, avec une seule identité, un seul thème, un seul accueil
qui voit tout.

> Livrable : [`Ecrin.html`](./Ecrin.html) — aucune dépendance réseau, aucun
> serveur, aucune erreur console.

## Ce que c'est

Trois applications d'origine ont été **fondues en une** :

- **Le socle** « Tout au même endroit » — coffre de documents, React bundlé.
- **Comptes & Budget** — soldes, transactions, mois par mois, budget, analyses.
- **Investissement** — budget → quiz profil → fiscalité → projection → portefeuille.

La logique de calcul des deux outils finance est **réutilisée verbatim** (zéro
régression) ; seule la présentation a été re-tokenisée aux couleurs du socle
(police Geist, fond sable, accent or, cartes arrondies). L'accueil agrège les
**signaux finance** (solde du mois, budget restant, prochain prélèvement, profil
& allocation cible) à côté des échéances de documents.

Détails d'architecture, décisions et isolation : **[INTEGRATION_NOTES.md](./INTEGRATION_NOTES.md)**.

## Utiliser

Ouvre `Ecrin.html` dans un navigateur (double-clic). Tout est stocké en local
(`localStorage`), rien ne sort de l'appareil.

## Construire depuis les sources

```bash
npm install          # postcss + jsdom (build/test uniquement ; l'artefact n'a aucune dépendance)
npm run build        # debundle → modules → assemble → rebundle → verify  ⇒  build/Ecrin.html
npm test             # smoke + non-régression + comportemental (jsdom)
```

### Arborescence

```
src/
  Tout_au_meme_endroit.html        socle d'origine (artefact auto-extractible)
  TAME_Comptes_et_Budget.html      outil 1 (source)
  TAME_Investissement.html         outil 2 (source)
  socle/data-dc-script.js          logique du socle + intégration finance (édité main)
tools/
  debundle.mjs / rebundle.mjs      (dé)compression du bundle (gzip+base64)
  build.mjs                        génère les modules ECRIN_CB / ECRIN_INV isolés
  assemble.mjs                     compose le template intégré + assets
  lib/extract.mjs, lib/scope-css.mjs
  verify-bundle.mjs, smoke.mjs, nonreg.mjs, test-jsdom.mjs, test-fullflow.mjs
vendor/                            chart.umd.js, react, react-dom (bundlés hors-ligne)
build/analysis/                    rapports d'analyse des deux outils
Ecrin.html                         ← le livrable
```

## Vérification (sans navigateur)

- **Round-trip** du bundle rejoué (atob → gunzip → substitution → contrôles).
- **Non-régression** : `avant == après == figé` pour les soldes Comptes et le
  moteur fiscal d'Investissement (moteur fiscal **byte-identique** source vs build).
- **Comportemental** (jsdom) : 23/23 — le socle monte, les domaines finance
  apparaissent dans la nav, l'accueil agrège les signaux, les clics montent
  chaque outil, aucune erreur console.
- **Loop closure** : `Ecrin.html` se déballe en un template + assets
  byte-identiques à ce qui a été testé.
