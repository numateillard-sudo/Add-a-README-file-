# CHANGELOG — Coffre

Format : par lot vérifié (édité → syntaxe → e2e navigateur → tests fonctions pures).

## Lot 9 — Échéances : groupées par urgence

- La vue agrégée passe de 2 à **3 paliers d’urgence** : **En retard** (rouge),
  **Bientôt** (ambre), **Plus tard** — chacun avec son compteur, le plus pressant
  d’abord. Chaque ligne ouvre toujours sa source.
- Vérifié en e2e (une échéance passée remonte bien sous « En retard »).

## Lot 8 — Documents : vue « à compléter » + « expire bientôt »

- Deux **filtres rapides** dans Mes documents : **À compléter** (fiches sans
  aucune info ni date) et **Expire bientôt** (au moins une échéance proche), avec
  compteur. Un clic isole exactement ce qui demande de l’attention.
- `aria-pressed` sur ces filtres. Vérifié en e2e (fiche incomplète → filtre
  proposé et appliqué).

## Lot 7 — Patrimoine & biens : inventaire pour l’assureur

- **Inventaire imprimable** : un tableau propre (désignation, catégorie, n° de
  série, assurance, valeur, nb de pièces jointes) + total, prêt à présenter à un
  assureur en cas de sinistre/vol. Généré localement, rien ne transite.
- Champ **Assurance** (compagnie / n° de contrat) par bien — le lien vers
  l’assurance correspondante.
- Vérifié en e2e (valeur totale affichée + génération de l’inventaire avec n° de
  série et assurance).

## Lot 6 — Documents : copier un numéro, appeler un téléphone

- Chaque « info clé » d'un document a un **bouton Copier** — copier un numéro
  (sécurité sociale, fiscal, contrat) **d'un geste** (Administratif & Identité).
- Quand la valeur est un **téléphone**, un **bouton Appeler** (`tel:`) apparaît —
  un tap appelle l'assistance (Assurances). Détection live à la saisie.
- `aria-label` sur ces boutons-icônes. Vérifié en e2e (téléphone → appeler,
  valeur quelconque → pas d'appel, copier toujours présent).

## Lot 5 — Santé : carte d’urgence imprimable + README

- **Carte d’urgence imprimable** : bouton « Imprimer » qui génère une feuille
  propre (groupe sanguin, allergies, pathologies, traitements, personne à
  prévenir) à présenter aux secours. Vérifié en e2e (pop-up d’impression).
- **Téléphone cliquable** (`tel:`) sur la carte d’urgence — un tap appelle.
- **README.md** : présentation, pacte local, sécurité, modules, stockage et
  commandes de test (le dépôt portait bien son nom).

## Lot 4 — Accessibilité (WCAG 2.2 AA)

- **Noms accessibles** sur tous les contrôles visibles (boutons, champs, options) —
  ajout d'`aria-label` aux champs de recherche et aux zones de note. Vérifié par
  un scan e2e sur 6 vues + l'éditeur (critère WCAG 4.1.2).
- **Contraste AA** : `--muted-2` relevé de `#6C808B` (3,93:1 sur carte, sous le
  seuil) à `#808F9A` (≥ 4,86:1 partout). Vérification automatisée des ratios de
  contraste du design system dans `tests/run.mjs` (texte 4,5:1, accents 3:1).
- (Rappel Lot 3 : palette accessible, focus restitué, `prefers-reduced-motion`.)

## Lot 3 — Recherche globale ⌘K & navigation clavier

- **Palette de commandes** (Ctrl/⌘ K, plus un bouton « Rechercher » visible dans
  la barre) : recherche **transverse** à tous les modules — documents, accès,
  patrimoine, santé, transmission, comptes et rappels d'argent — plus « Aller à »
  (chaque module/écran) et actions (nouveau document, verrouiller).
- Navigation **100 % clavier** : flèches ↑/↓, Entrée pour ouvrir l'élément
  directement, Échap pour fermer ; sélection à la souris au survol.
- **Confidentialité** : les valeurs secrètes (mots de passe) sont **exclues de
  l'index** — prouvé par un test e2e (rechercher « azerty » ne retourne rien).
- Accessibilité : `role="dialog"`/`listbox`/`option`, `aria-selected`, restitution
  du focus à la fermeture, `aria-keyshortcuts`, respect de `prefers-reduced-motion`.

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
