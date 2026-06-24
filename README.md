# Coffre — ton coffre-fort personnel, 100 % local

**Coffre** est un coffre-fort numérique personnel : documents, mots de passe,
finances, patrimoine, santé, transmission. **Tout est chiffré localement ; rien ne
quitte ta machine, jamais.** Pas de cloud, pas de serveur, pas de CDN, pas de
télémétrie. Il fonctionne entièrement hors-ligne et le restera pour toujours, même
si plus personne ne le maintient.

Le produit tient dans **un seul fichier** : [`coffre.html`](./coffre.html). Un
double-clic l'ouvre dans le navigateur. C'est tout.

## Le pacte

- Tes données **vivent sur ta machine** et **n'en sortent jamais**.
- L'app marche **hors-ligne**, câble réseau débranché, en avion.
- Tu gardes le **contrôle total** : tu sais où vit ton coffre, tu peux le copier,
  le sauvegarder, le déplacer, le détruire. Aucun verrou propriétaire.
- Aucune dépendance réseau. C'est **prouvé**, pas promis : une CSP `connect-src
  'none'` ferme toute sortie, et un test échoue si un appel réseau apparaît.

## Sécurité en bref

- **Chiffrement à enveloppe** : une clé de données aléatoire (DEK, AES-GCM 256)
  chiffre tout le contenu. Elle est emballée à la fois par une clé dérivée du
  **mot de passe maître** et par une clé dérivée d'une **phrase de récupération**
  de 12 mots français (BIP39). L'un OU l'autre rouvre le coffre.
- Dérivation **PBKDF2-SHA256, 600 000 itérations** (recommandation OWASP). Voir
  [`DECISIONS.md`](./DECISIONS.md) (D6) pour le choix PBKDF2 vs Argon2id.
- **Verrouillage automatique** (inactivité, onglet caché), **effacement des clés
  en mémoire**, **presse-papiers auto-effacé** après copie d'un secret,
  **anti-force-brute** au déverrouillage.
- Modèle de menace complet : [`THREAT-MODEL.md`](./THREAT-MODEL.md).

Aucun secret n'est jamais stocké en clair. Même en ouvrant le fichier à la main, on
ne voit rien d'exploitable.

## Modules

Documents · Finances (import de relevés, récurrences, patrimoine net) · Mots de
passe (générateur + audit des faibles/réutilisés) · Patrimoine & biens · Santé
(carte d'urgence) · Transmission · Assurances · Administratif & Identité ·
Échéances & rappels (agrège toutes les dates de tous les modules).

Recherche transverse partout via **⌘K / Ctrl-K**.

## Stockage

- **Chrome / Edge** : File System Access API — le coffre est enregistré
  automatiquement dans le dossier que tu choisis (`coffre.vault.json` + un
  sous-dossier `files/` pour les pièces jointes chiffrées).
- **Autres navigateurs** : « mode fichier » — tu télécharges et recharges
  toi-même `coffre.vault.json`.
- Une **sauvegarde** exporte tout le coffre, déjà chiffré, en un seul fichier.

## Développement & tests

Tout est vérifié, sans aucune dépendance réseau. Deux commandes :

```sh
node tests/run.mjs    # syntaxe (node --check) + zéro réseau + crypto + audit + contraste AA
node tests/e2e.mjs    # navigateur réel (Playwright/Chromium) : onboarding, cycle
                      # chiffrement→save→reload→déverrouillage, audit des accès,
                      # palette ⌘K, accessibilité, zéro violation CSP
```

`tests/run.mjs` **extrait** les fonctions réelles du fichier (entre marqueurs) et
les exécute — on teste le code livré, pas une copie.

## Documentation

- [`CHANGELOG.md`](./CHANGELOG.md) — l'évolution, par lot vérifié.
- [`DECISIONS.md`](./DECISIONS.md) — chaque choix d'architecture, avec son pourquoi.
- [`THREAT-MODEL.md`](./THREAT-MODEL.md) — menaces prises en compte et parades.

## Langue

Tout est en français, tutoiement, ton chaleureux. C'est un choix de produit.
