# Harnais de vérification — audit de cohérence

Scripts Node + [jsdom](https://github.com/jsdom/jsdom) qui chargent
`../petit-livre-rouge-portefeuille.html` *tel quel* (Chart.js et quelques
globales manquantes de jsdom sont stubées) et **prouvent** que chaque valeur
rendue est égale au recalcul depuis le moteur unique — voir `../AUDIT-COHERENCE.md`.

## Lancer

```bash
cd audit-harness
npm install jsdom        # dépendance de test uniquement (non embarquée dans le fichier livré)
node verify.js           # rendu == recalcul moteur, 4 profils × 3 vues  → 110 PASS / 0 FAIL
node smoke.js            # sweep interactif complet → 0 erreur console
node test-restore.js     # persistance du quiz au rechargement (preuve F-005)
node struct-scan.js      # déclarations dupliquées, handlers, câblage mort, ids dupliqués
node dead-code.js        # déclarations top-level inutilisées
node dump-engine.js      # dump des valeurs moteur (vérité terrain)

# Comportement en vrai navigateur (Chromium pré-installé sous PLAYWRIGHT_BROWSERS_PATH) :
npm install playwright-core
node render-behavior.js  # 1er chargement = quiz · quiz complété = profil rendu · rechargement = retour au quiz  → 8/8
```

Surcharger la cible : `LPLR_FILE=/chemin/vers/fichier.html node verify.js`.

## Fichiers
| Script | Rôle |
|---|---|
| `harness-lib.js` | chargeur jsdom commun (stubs Chart/IntersectionObserver/canvas) |
| `verify.js` | assertions rendu == moteur + ids dupliqués + couverture enum `env` + pastille obligations (F-001) |
| `smoke.js` | sweep interactif (quiz, 4 stratégies, 16 paires comparateur, planificateur, reset) + non-régression migration |
| `test-restore.js` | preuve F-005 (quiz conservé au rechargement) |
| `struct-scan.js` | balayage structurel |
| `dead-code.js` | déclarations inutilisées |
| `dump-engine.js` | dump vérité terrain du moteur |
| `render-behavior.js` | **rendu réel Chromium** : entrée par le questionnaire + flux quiz→profil→rechargement |
| `harness-output.txt` | sortie de référence (après correctifs) |

> jsdom n'exécute pas de *layout* : le harnais prouve la cohérence des **valeurs et du câblage**, pas l'apparence pixel (ressort du brief design).
