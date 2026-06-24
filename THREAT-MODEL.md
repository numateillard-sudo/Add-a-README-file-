# Modèle de menace — Coffre

Coffre est un coffre-fort personnel **100 % local**. Aucune donnée ne quitte la
machine. Ce document liste les menaces prises en compte, ce qui les contre
aujourd'hui dans le fichier, et les limites assumées.

## Actifs à protéger
- Le contenu déchiffré (documents, mots de passe, finances, santé, transmission).
- La **DEK** (clé de données AES-GCM 256) et les clés dérivées (KEKp, KEKr).
- Les pièces jointes (chiffrées une par une).

## Invariants de sécurité (vérifiés par les tests)
1. **Zéro réseau.** CSP `connect-src 'none'` + `default-src 'none'` ferment toute
   sortie ; `tests/run.mjs` échoue si un puits réseau apparaît dans le fichier.
2. **Aucun secret en clair.** Le payload et les blobs sont chiffrés (AES-GCM 256) ;
   `tests/run.mjs` vérifie qu'aucun secret ne figure en clair dans le vault.
3. **La clé ne survit pas au verrouillage.** Tout verrouillage passe par
   `lockVault()`, qui met `App.dek` et `App.payload` à `null`.

## Menaces et parades

| Menace | Parade actuelle | Limite assumée |
|---|---|---|
| **Vol du fichier vault** (clé USB perdue, sauvegarde exfiltrée) | Chiffrement à enveloppe AES-GCM 256 ; clés dérivées par PBKDF2-SHA256 **600 000** itérations (OWASP). Sans le mot de passe **ou** les 12 mots, le contenu est inexploitable. | Résistance au brute-force hors-ligne bornée par la force du mot de passe. Voir `DECISIONS.md` (PBKDF2 vs Argon2id). |
| **Appareil déverrouillé laissé sans surveillance** | **Verrouillage auto** après 5 min d'inactivité ; verrouillage si l'onglet reste caché > 1 min ; bouton « Verrouiller » manuel. La DEK quitte la mémoire à chaque fois. | Une fenêtre ≤ 5 min reste exploitable par un attaquant physiquement présent. |
| **Regard par-dessus l'épaule** | Champs secrets masqués par défaut (type=password, bouton Afficher) ; pas d'affichage en clair non sollicité. | L'utilisateur peut volontairement révéler un champ. |
| **Fuite par le presse-papiers** | Copie d'un mot de passe → **effacement automatique du presse-papiers après 25 s** (`copySecret`), annulé si une autre copie intervient ; le presse-papiers est aussi vidé au verrouillage. | Un gestionnaire de presse-papiers tiers peut historiser avant l'effacement. Best-effort par nature (l'API ne permet pas de garantir). |
| **Force brute sur l'écran de déverrouillage** | Délai croissant après 3 échecs (5 s, 10 s, 20 s… plafonné à 5 min), **persistant** par navigateur (IndexedDB). | Contournable en copiant le fichier ailleurs : la vraie défense reste alors le coût KDF (600k). |
| **Corruption / altération du fichier hors session** | AES-GCM fournit l'**authentification** : toute altération du ciphertext fait échouer le déchiffrement (rejet propre, pas de données corrompues acceptées). | Détection, pas réparation : une sauvegarde reste nécessaire (rappels intégrés). |
| **Malware / extension lisant le DOM** | Hors périmètre d'une app web pure : si la machine exécute un malware avec accès au navigateur, aucune app web ne peut garantir le secret. CSP réduit la surface (aucun script tiers chargeable). | Menace non entièrement couverte — limite intrinsèque au modèle navigateur. |
| **Injection XSS** | Échappement systématique (`escapeHtml`/`escapeAttr`) ; CSP `script-src` sans `'unsafe-eval'` ni source externe (seul l'inline du fichier s'exécute). | `'unsafe-inline'` est nécessaire (app mono-fichier) ; compensé par l'absence totale de source externe et l'échappement. |
| **Perte des secrets de l'utilisateur** | Double voie de récupération (mot de passe **ou** 12 mots BIP39) ; feuille de secours imprimable ; sauvegarde/restauration chiffrée. | Si l'utilisateur perd **et** le mot de passe **et** les 12 mots, la récupération est impossible *par conception*. |

## Hors périmètre (assumé)
- Sécurité physique de la machine et du système d'exploitation.
- Keyloggers matériels / malware avec privilèges.
- Confidentialité de l'impression de la feuille de secours (responsabilité de l'utilisateur).
