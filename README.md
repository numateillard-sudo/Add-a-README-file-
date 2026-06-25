# Écrin — Tout au même endroit

Coffre personnel de documents, livré comme **un seul fichier HTML auto-déballant**
(`Tout_au_meme_endroit_2.html`, ≈ 707 Ko). **100 % local, hors-ligne** : aucune
dépendance, aucun appel réseau, aucune base distante. On ouvre le fichier dans un
navigateur, il se déballe tout seul et garde tes documents dans le `localStorage`.

> _« Toute ta vie, au même endroit. »_

## Ouvrir / utiliser

1. Télécharge `Tout_au_meme_endroit_2.html`.
2. Ouvre-le dans un navigateur moderne (Chrome, Edge, Firefox, Safari récents).
3. Saisis ton prénom → **Entrer dans mon espace**.
4. **Ajouter** un document → choisis un type → remplis la fiche.

Pré-requis : un navigateur supportant `DecompressionStream` (tous les navigateurs
récents). Rien à installer, aucune connexion requise — les polices et ressources
sont embarquées dans le fichier.

## Collections

| Domaine | Contenu |
|---|---|
| **Identité** | Passeport, carte d'identité, permis, titre de séjour |
| **Santé** | Carte d'assurance maladie, complémentaire santé, ordonnance, vaccination |
| **Logement** | Titre de propriété, prêt immobilier, bail, quittance, assurance, énergie |
| **Véhicule** | Carte grise, assurance auto, contrôle technique, constat |
| **Travail & argent** | Contrat, RIB, avis d'imposition… |
| **Famille & vie** | … |
| **Finance** | Comptes & Budget, Investissement (modules natifs) |

Les libellés de type sont **résolus à l'affichage** depuis la constante `TYPE_GROUPS` ;
ils ne sont jamais figés dans les documents stockés. Changer un libellé met donc à jour
le picker, le formulaire, l'affichage et la recherche — sans casser les documents existants.

## Cette branche — Logement & Santé universalisés (Occident)

Deux collections étaient trop spécifiques ; elles ont été rendues universelles **sans
aucune régression**, en n'éditant que **deux sous-chaînes** de `TYPE_GROUPS` :

- **Logement — agnostique au statut d'occupation (propriétaire _et_ locataire).**
  Ajout de deux types côté propriétaire : `propriete` (« Titre de propriété ») et
  `pret` (« Prêt immobilier »), devant les types locataire/communs conservés
  (`bail`, `quittance`, `asshab`, `energie`).
- **Santé — dé-francisation des intitulés d'institutions.**
  `vitale` : « Carte Vitale » → **« Carte d'assurance maladie »** ;
  `mutuelle` : « Mutuelle » → **« Assurance santé complémentaire »**.
  Les libellés génériques (« Ordonnance », « Carnet de vaccination ») restent inchangés.

### Règle d'or — IDs stables

Tous les `type-id` existants sont **conservés** (`bail, asshab, energie, quittance,
vitale, mutuelle, ordonnance, vaccin`). La modification est donc **purement additive**
pour Logement (2 nouveaux ids) et un **relibellage seul** pour Santé (mêmes ids).
Aucune donnée utilisateur ni document de démonstration n'est cassé : un coffre
`ecrin.app.v1` antérieur continue d'afficher chaque document avec un libellé de type résolu.

| Logement (6 types) | Santé (4 types) |
|---|---|
| `propriete` — Titre de propriété _(nouveau)_ | `vitale` — Carte d'assurance maladie _(relibellé)_ |
| `pret` — Prêt immobilier _(nouveau)_ | `mutuelle` — Assurance santé complémentaire _(relibellé)_ |
| `bail` — Bail / location | `ordonnance` — Ordonnance |
| `quittance` — Quittance de loyer | `vaccin` — Carnet de vaccination |
| `asshab` — Assurance habitation | |
| `energie` — Facture d'énergie | |

## Stockage & confidentialité

- `ecrin.app.v1` — le coffre (profil + documents).
- `ecrin.identity.v1` — l'identité (prénom).

Tout reste dans le `localStorage` du navigateur, sur l'appareil. Rien n'est envoyé nulle part.

## Sous le capot

Le fichier est un bundle auto-extractible :

- `<script type="__bundler/manifest">` — **17 assets** encodés base64 + gzip
  (polices, ressources), déballés à l'exécution en Blob URLs.
- `<script type="__bundler/template">` — le template (JSON-stringifié) qui contient,
  en **texte clair**, le payload applicatif `<script type="text/x-dc" data-dc-script>`.
- **dc-runtime** — un mini-framework déclaratif (`{{ }}`, `<sc-if>`, `<sc-for>`) ;
  la logique vit dans une classe `Component extends DCLogic`.
- `buildTypes()` reconstruit la table des types depuis `TYPE_GROUPS` au montage —
  d'où le fait qu'éditer `TYPE_GROUPS` suffit à propager le changement partout.

### Vérifications effectuées sur cette branche

- Diff strictement limité aux deux sous-chaînes (re-substitution → identique à l'origine).
- Intégrité bundler : 17/17 assets décodent+décompressent ; UUID du template == clés du manifeste.
- Seed (d2/d10/d7/d8) et coffres `localStorage` antérieurs : libellés de type toujours résolus.
- Runtime navigateur : le picker montre les nouveaux types, la création d'un document
  d'un type neuf fonctionne, **zéro erreur console**.
