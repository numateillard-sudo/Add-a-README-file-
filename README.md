# Le Petit Livre Rouge de l'investisseur — outils

Petite collection d'outils pédagogiques **autonomes** (un seul fichier HTML chacun,
zéro dépendance, zéro CDN, zéro tracking). Il suffit d'**ouvrir le fichier dans un
navigateur** — rien à installer.

| Outil | Fichier | Ce qu'il fait |
|---|---|---|
| **Profil investisseur** | [`profil-investisseur.html`](profil-investisseur.html) | 5 questions → un profil parmi 4, le portefeuille recommandé, le rendement/risque attendu. |
| **Instrument viager** | [`instrument-viager.html`](instrument-viager.html) | Estimation viager (bouquet/rente), aléa probabiliste et fiscalité. |

---

## Profil investisseur

Un module de **profilage + recommandation**. À partir de 5 questions courtes et
concrètes, il diagnostique honnêtement le profil de l'utilisateur et le réoriente
vers le bon portefeuille — pour l'utilisateur **comme pour un conseiller**.

### La philosophie

- **Capacité ≠ appétit.** On mesure séparément ce que la personne *peut* se
  permettre (horizon, poids dans le patrimoine + matelas, stabilité) et ce qu'elle
  *supporte* (réaction à une perte de −30 %, comportement passé).
- **Le profil = le MINIMUM des deux.** Un appétit élevé ne rachète pas une capacité
  faible, et inversement.
- **Le pire réflexe plafonne le profil.** Des garde-fous durs rétrogradent le profil
  quand une réponse révèle un risque rédhibitoire (vendrait tout dans une baisse,
  horizon court, pas de matelas, situation précaire, a déjà paniqué, débutant
  surconfiant). Ces plafonds priment sur le score.
- **Honnêteté > flatterie.** Le module peut dire « tu te crois Offensif mais ton
  horizon te place en Équilibré ». En cas de doute, on rétrograde (*suitability*).

### Le moteur (résumé)

```
appetit  = round(0.65 · tolérance + 0.35 · niveau_expérience)   // 1..4
capacite = round((horizon + poids + situation) / 3)             // 1..4
base     = min(appetit, capacite)
final    = min(base, ...garde-fous)                             // 1 Prudent … 4 Offensif
```

### Les 4 sorties

1. Le **profil** (Prudent / Équilibré / Dynamique / Offensif) et le « pourquoi » en une phrase.
2. **Appétit** et **Capacité** affichés séparément, avec la contrainte active et les garde-fous déclenchés.
3. Le **portefeuille** ligne à ligne (PEA / assurance-vie / CTO), moteur actions 70/20/10, satellite titres vifs en Dynamique/Offensif.
4. Le **rendement et le risque attendus** (rendement annualisé, volatilité, perte max type, Sharpe).

> ⚠️ Outil **pédagogique** d'aide à la décision. Aucun conseil en investissement au
> sens réglementaire. Les performances passées et les hypothèses prospectives ne
> préjugent pas des résultats futurs.

### Détails techniques

- Fichier HTML unique, **vanilla JS**, polices système, aucune dépendance externe.
- **Persistance `localStorage`** : recharger la page conserve le profil ; un bouton
  « Refaire le test » réinitialise.
- **Accessible au clavier** : flèches pour choisir, `1`–`4` en direct, `Entrée` pour
  valider, `←` pour revenir. Focus visible.
