# CHANGELOG — Coffre

Format : par lot vérifié (édité → syntaxe → e2e navigateur → tests fonctions pures).

## Lot 1 — Souveraineté & Sécurité

**Souveraineté prouvée**
- CSP stricte inline : `default-src 'none'`, `connect-src 'none'` (réseau fermé),
  `object-src 'none'`, `base-uri 'none'`, `form-action 'none'`.
- Test automatisé « zéro réseau » : échoue si un fetch/XHR/WebSocket/CDN/ressource
  externe apparaît dans le fichier.

**Sécurité de session**
- Verrouillage automatique sur inactivité (5 min) et sur onglet caché (> 1 min).
- Effacement centralisé des clés en mémoire (`lockVault`) — un seul chemin.
- Effacement automatique du presse-papiers 25 s après copie d'un secret.
- Anti-force-brute au déverrouillage : délai croissant persistant après 3 échecs.

**Fiabilité / outillage**
- Harness de tests lançable d'une commande : `node tests/run.mjs`
  (syntaxe `node --check` + zéro réseau + enveloppe crypto réelle extraite du fichier).
- E2E navigateur réel : `node tests/e2e.mjs` (Playwright/Chromium) — onboarding
  complet **et** cycle chiffrement → save → reload → déverrouillage, zéro violation CSP.
- Documents : `THREAT-MODEL.md`, `DECISIONS.md`.

**Aucune régression** : rendu et flux existants vérifiés en e2e (captures dans `tests/`).
