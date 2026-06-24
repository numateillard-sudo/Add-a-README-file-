# CHANGELOG — Coffre

Format : par lot vérifié (édité → syntaxe → e2e navigateur → tests fonctions pures).

## Lot 2 — Mots de passe en masterclass

- **Audit des accès** : panneau en tête du module qui repère les mots de passe
  **faibles** et **réutilisés** (groupes de doublons), chaque ligne cliquable
  ouvre l'accès concerné. Message rassurant quand tout est solide et unique.
- **Jauge de force honnête** : estimation par entropie (longueur × log2(jeu de
  caractères)) corrigée des répétitions/séquences, plus une liste des mots de
  passe les plus éventés déclassés d'office. Remplace le simple comptage de classes.
- **Générateur enrichi** : popover avec longueur réglable (8–32) et deux modes —
  mot de passe aléatoire fort, ou **phrase mémorisable** (mots français BIP39 +
  nombre), tirés au sort sur l'appareil.
- Copie d'un accès **sans ouvrir la fiche** (déjà là) désormais couplée à
  l'effacement auto du presse-papiers (Lot 1).
- Tests : fonctions pures `pwScore`/`pwEntropyBits`/`auditPasswords` extraites et
  vérifiées ; e2e navigateur qui crée des accès et valide l'audit (faibles + doublon).

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
