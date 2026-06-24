# Journal de décisions — Coffre

Chaque choix d'architecture, avec son *pourquoi*. Ordre chronologique.

## D1 — Versionner le coffre dans le dépôt (`coffre.html`)
**Choix.** Le fichier livrable unique est versionné tel quel dans le dépôt, sur la
branche de travail, et commité par lot vérifié.
**Pourquoi.** Historique réversible, diffs lisibles, possibilité de revenir à la
baseline à tout moment. Aucune perte silencieuse.

## D2 — Prouver le « tout-local » par une CSP stricte + un test
**Choix.** `<meta http-equiv="Content-Security-Policy">` avec `default-src 'none'`
et surtout `connect-src 'none'`, doublé d'un test (`tests/run.mjs`) qui échoue si un
puits réseau (fetch/XHR/WebSocket/CDN/ressource externe) apparaît.
**Pourquoi.** La souveraineté des données doit être *prouvée*, pas promise. Le
navigateur bloque toute fuite, et la CI échoue avant même qu'elle n'atteigne un
navigateur. `frame-ancestors` a été retiré du `<meta>` (ignoré hors en-tête HTTP,
il polluait la console — confirmé en e2e).
**Compromis.** `script-src 'unsafe-inline'` et `style-src 'unsafe-inline'` sont
nécessaires pour une app mono-fichier ; compensés par l'absence totale de source
externe (rien d'autre ne peut s'exécuter) et l'échappement systématique.

## D3 — Verrouillage automatique centralisé (`lockVault`)
**Choix.** Un seul chemin d'effacement des clés : inactivité (5 min, chien de garde
léger basé sur un horodatage d'activité), onglet caché (grâce 1 min), et bouton
manuel y passent tous. `App.dek`/`App.payload` → `null`, presse-papiers vidé.
**Pourquoi.** Un coffre déverrouillé et laissé sans surveillance est la faille la
plus courante. Centraliser évite les chemins d'effacement incohérents.
**Compromis.** Le chien de garde tourne toutes les 15 s (coût négligeable) plutôt
que de réarmer un timer à chaque mouvement de souris (plus de churn).

## D4 — Effacement automatique du presse-papiers pour les secrets
**Choix.** `copySecret()` copie puis efface le presse-papiers après 25 s ; toute
nouvelle copie annule l'effacement en attente ; le verrouillage vide aussi le
presse-papiers.
**Pourquoi.** Un mot de passe oublié dans le presse-papiers fuit vers la prochaine
app où l'on colle. 25 s laisse le temps de coller une fois.
**Compromis.** Best-effort : l'API presse-papiers ne permet pas de garantir
l'effacement si le focus est perdu ; documenté dans le modèle de menace.

## D5 — Anti-force-brute persistant
**Choix.** Délai croissant après 3 échecs (5 s, 10 s, 20 s… plafond 5 min),
stocké en IndexedDB (`unlockGate`) pour survivre au rechargement.
**Pourquoi.** Ralentit un attaquant opportuniste sur l'écran de déverrouillage.
**Compromis.** Local au navigateur : contournable en ouvrant le fichier ailleurs.
La défense de fond reste alors le coût KDF (voir D6). Assumé et documenté.

## D6 — Dérivation de clé : **garder PBKDF2 600k** pour l'instant, Argon2id en lot isolé
**Choix.** Conserver PBKDF2-SHA256 à 600 000 itérations (recommandation OWASP 2023)
pour ce lot. Argon2id (WASM inline) est planifié comme **son propre lot**,
migration-safe.
**Pourquoi.**
- PBKDF2 600k n'est **pas une faille critique** : c'est la recommandation OWASP
  courante et ça résiste raisonnablement au brute-force hors-ligne.
- Argon2id est supérieur (résistance mémoire-dure au GPU/ASIC), **mais** l'embarquer
  signifie : ~50–100 Ko de WASM base64 inline, un **changement de format** du vault,
  et une **migration réversible avec sauvegarde préalable** de tous les coffres
  existants. C'est un changement à fort enjeu qui ne doit pas être mêlé à un lot de
  durcissement : il mérite son propre cycle vérifié (création → save → reload sur
  ancien *et* nouveau format), sous peine de risquer le socle crypto le plus
  sensible de l'app.
**Plan.** Lot « Argon2id » dédié : bump `format`, détection de l'algo KDF par vault,
double-lecture (anciens vaults PBKDF2 toujours ouvrables), ré-emballage à la volée
au prochain changement de mot de passe, le tout précédé d'une sauvegarde. Zéro perte.

## D8 — Lire le .xlsx nativement, sans bibliothèque
**Choix.** Implémenter un mini-lecteur xlsx maison : parsing du répertoire central
du ZIP + décompression via `DecompressionStream('deflate-raw')` (API navigateur)
+ parsing XML via `DOMParser`. Aucune bibliothèque (type SheetJS) embarquée.
**Pourquoi.** Le pacte interdit toute dépendance réseau et privilégie un fichier
unique léger. `DecompressionStream` est disponible nativement dans les navigateurs
qui supportent déjà le coffre (Chrome/Edge). On évite ~200 Ko de lib pour ne lire
que ce dont on a besoin (feuille + chaînes partagées + formats de date).
**Compromis.** Couverture volontairement limitée au cas d'usage « relevé bancaire »
(première feuille, dates, nombres, texte). Repli explicite si `DecompressionStream`
est absent ou pour l'ancien `.xls` (OLE). Testé avec un vrai .xlsx généré dans la
suite (ZIP + deflate + dates sérielles).

## D9 — WebAuthn / passkey : LIVRÉ via l'extension PRF, vérifié
**Choix.** Déverrouillage par passkey en **3ᵉ enveloppe** : un secret PRF stable
(extension WebAuthn `prf`) dérive une clé AES-GCM qui emballe une copie de la DEK,
**en complément** du mot de passe et des 12 mots — jamais en remplacement.
**Pourquoi PRF.** C'est la seule façon correcte : l'authentificateur restitue un
secret reproductible (et seulement à lui), sans jamais exposer de clé privée ni
sortir de l'appareil. Pas de secret en clair, pas de réseau.
**Garde-fous.**
- **Origine.** WebAuthn exige une vraie origine (https/localhost/Tauri) : en
  double-clic `file://`, l'option est **masquée** proprement (`waSupported()`),
  vérifié en e2e.
- **PRF obligatoire.** Si l'appareil n'expose pas PRF (`prf.enabled` faux), on
  **refuse** d'activer — pas de repli affaibli, pas de théâtre de sécurité.
- **Jamais bloquant.** Perdre/retirer la passkey ne ferme aucune porte : mot de
  passe et 12 mots restent valides (prouvé en e2e).
**Vérification.** `tests/passkey.mjs` sert le coffre sur `http://localhost` et
branche un authentificateur virtuel CDP avec PRF : création → activation →
verrouillage → **réouverture par la passkey sans mot de passe** → le mot de passe
ouvre toujours → zéro violation CSP. Le doute de l'ancien report (PRF non testable)
est levé : le support PRF de l'authentificateur virtuel fonctionne.

## D7 — Tester la crypto sans la dupliquer (marqueurs d'extraction)
**Choix.** Le bloc crypto est délimité par des marqueurs `crypto` dans `coffre.html` ;
`tests/run.mjs` l'extrait et l'exécute réellement dans Node (WebCrypto natif).
**Pourquoi.** DRY : on teste *le code livré*, pas une copie qui dériverait. Round-trip
mot de passe, round-trip phrase, rejet `BAD_SECRET`, absence de secret en clair, aléa
des sels/IV — tout est vérifié sur le bloc réel.
