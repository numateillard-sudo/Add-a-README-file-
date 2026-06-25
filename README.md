# Le Petit Livre Rouge de l'investisseur — outils

Collection d'outils pédagogiques en HTML. Il suffit d'**ouvrir le fichier dans un
navigateur** — rien à installer.

| Outil | Fichier | Ce qu'il fait |
|---|---|---|
| **Le Portefeuille** (le livre complet) | [`le-portefeuille.html`](le-portefeuille.html) | Le guide complet : notions, **profil investisseur** (refondu), allocation, projection patrimoniale. |
| **Profil investisseur** (module autonome) | [`profil-investisseur.html`](profil-investisseur.html) | Le seul module de profil, en **fichier autonome zéro dépendance / zéro CDN** — pour embed ou usage hors-ligne. |
| **Instrument viager** | [`instrument-viager.html`](instrument-viager.html) | Estimation viager (bouquet/rente), aléa probabiliste et fiscalité. |

> Les deux premiers partagent **exactement le même moteur de profil** (questionnaire,
> scoring, garde-fous, allocations, fiches rendement/risque). `le-portefeuille.html`
> l'intègre dans le livre complet ; `profil-investisseur.html` est la version isolée
> et 100 % autonome du module.

---

## Le module « Profil investisseur »

Un module de **profilage + recommandation**. À partir de **5 questions** courtes et
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

Les 4 profils mappent vers une allocation propre : **moteur actions 70/20/10**
(Monde / Europe / Émergents en ETF) + fonds euro, obligations et or, avec un
**satellite « titres vifs » optionnel** (6 % en Dynamique, 10 % en Offensif,
≤ 2 %/ligne, prélevé sur les actions). Fiches rendement/risque par profil
(rendement, volatilité, perte max = pire régime, Sharpe ~0,29 sur les 4).

### Les 4 sorties

1. Le **profil** (Prudent / Équilibré / Dynamique / Offensif) et le « pourquoi » en une phrase.
2. **Appétit** et **Capacité** affichés séparément, avec la contrainte active et les garde-fous déclenchés.
3. Le **portefeuille** ligne à ligne (PEA / assurance-vie / CTO), moteur 70/20/10, satellite en Dynamique/Offensif.
4. Le **rendement et le risque attendus** (rendement annualisé, volatilité, perte max type, Sharpe) + 2 points d'honnêteté.

> ⚠️ Outil **pédagogique** d'aide à la décision. Aucun conseil en investissement au
> sens réglementaire. Les performances passées et les hypothèses prospectives ne
> préjugent pas des résultats futurs.

### Note technique

`profil-investisseur.html` est **vanilla JS, polices système, aucune dépendance ni
CDN**, avec persistance `localStorage` et navigation clavier. `le-portefeuille.html`
réutilise les polices et la librairie de graphiques déjà chargées par le livre.
