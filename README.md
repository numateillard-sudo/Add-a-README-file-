# Le Petit Livre Rouge de l'investisseur — *Le Portefeuille*

Guide pédagogique d'investissement **autonome, en un seul fichier HTML** : profil de risque,
allocation personnalisée et projection patrimoniale honnête. Sans pub, sans tracking commercial.

> **Fichier produit : [`petit-livre-rouge-portefeuille.html`](./petit-livre-rouge-portefeuille.html)** — ouvre-le simplement dans un navigateur, rien à installer.

## Ce que c'est

Un document interactif déroulé en 4 étapes (Chapitre « Portefeuille ») :

1. **Notions** — 6 concepts essentiels (action, inflation, intérêts composés, diversification, ETF, DCA) + les 3 enveloppes fiscales (PEA / CTO / AV).
2. **Profil** — un quiz en 5 questions (horizon, tolérance, poids, expérience, situation) qui détermine ton profil : Prudent / Équilibré / Dynamique / Offensif, avec garde-fous comportementaux.
3. **Allocation** — ton portefeuille personnalisé : cœur ETF (Monde / Europe / Émergents), coussins (fonds euro, obligations, or), satellite « titres vifs » optionnel, et la répartition concrète sur tes 3 comptes.
4. **Simulation** — 3 modes : **Guidé** (3 scénarios sur 20 ans), **Comparateur** (2 stratégies face à face), **Expert** (planificateur d'objectif probabiliste Monte-Carlo, leviers, stress-test).

## Caractéristiques techniques

- **Fichier unique autonome** : tout le HTML/CSS/JS dans un seul `.html`.
- **Dépendance unique** : Chart.js (chargé via CDN).
- **Persistance** : `localStorage` (budget, quiz, profil, pondérations) — aucune donnée envoyée nulle part.
- **Source de vérité unique** : un moteur quantitatif (`computeStats`) calcule rendement géométrique, volatilité (covariance réelle), Sharpe et drawdown ; **toutes** les cartes, simulations et le planificateur en dérivent.

## Audit de cohérence (juin 2026)

Le fichier ayant été assemblé en plusieurs sessions, un **audit de cohérence intégrale** (source de vérité → rendu, dans chaque état atteignable) a été mené. **6 écarts réels identifiés et tous corrigés**, vérifiés par un harnais automatisé :

| # | Correctif | Impact |
|---|---|---|
| F-001 | Convention enveloppe `'AV/CTO'` → `'CTO/AV'` (+ `envCls` symétrique) | Pastille obligations désormais cohérente avec le bandeau enveloppes |
| F-005 | Détecteur d'ancien format de quiz (`'experience'` retiré) | **Le quiz/profil n'est plus effacé au rechargement** (bug grave) |
| F-004 | Astuce « Comparateur » 25 → 20 ans | Conforme à l'outil |
| F-012 | Hint d'objectif du planificateur cohérent à l'init | — |
| F-006 | Planificateur dérivé du moteur unique (suppression d'une 2ᵉ source divergente) | Le planificateur projette comme les cartes / le mode guidé |
| F-008/009/010 | Tickers unifiés : MSCI World = **`DCAM`** (Amundi PEA Monde, vérifié), or = **`IGLN`**, guide d'achat recalé sur le portefeuille réel | Plus de ticker contradictoire au moment d'acheter |

📄 **Rapport détaillé : [`AUDIT-COHERENCE.md`](./AUDIT-COHERENCE.md)** (carte de flux de données, matrice section × état, tableau des constats, diffs, journal des changements, risques résiduels).

### Vérification reproductible

```bash
cd audit-harness
npm install jsdom
node verify.js        # rendu == recalcul moteur (4 profils × 3 vues) + tickers  → 135 PASS / 0 FAIL
node smoke.js         # sweep interactif complet                                  → 0 erreur console
node test-restore.js  # persistance du quiz au rechargement
```

Voir [`audit-harness/README.md`](./audit-harness/README.md) pour le détail.

## Structure du dépôt

```
petit-livre-rouge-portefeuille.html   ← le document final (à ouvrir dans un navigateur)
AUDIT-COHERENCE.md                    ← rapport d'audit complet
audit-harness/                        ← scripts de vérification (Node + jsdom) + sortie de référence
instrument-viager.html                ← autre document (indépendant)
```

## Note résiduelle

Le fichier conserve un **code mort** issu d'anciennes versions (placeholders « Tech & Innovation »), **inerte et jamais affiché** (`display:none`, écrasé par le JS avant tout rendu). Il est documenté dans le rapport pour une éventuelle passe de nettoyage dédiée — sans impact sur le document tel qu'il est vu et utilisé.
