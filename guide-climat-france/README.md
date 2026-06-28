# Climat & météo en France : ce qui a changé

Fiche PDF imprimable (A4, 2 pages) qui explique, pour le grand public, comment le
climat et la météo ont évolué en **France métropolitaine** — l'observé (haute
confiance) et la trajectoire de planification à 2100.

**Livrable :** [`climat-meteo-france.pdf`](climat-meteo-france.pdf) — A4 exact (210 × 297 mm), 2 pages.

## Ce que dit la fiche

- **Météo ≠ climat** : la météo, c'est le temps qui change chaque jour ; le climat,
  c'est sa statistique sur ~30 ans. Un coup de froid ne contredit pas le réchauffement.
- **Tendance de fond** : +1,7 °C en France depuis 1900, plus vite que la moyenne
  mondiale ; l'Europe est le continent qui se réchauffe le plus rapidement.
- **Signes observés** : canicules plus fréquentes, nuits tropicales en hausse, gel en
  recul, année record 2022 (14,5 °C), sécheresses des sols.
- **Eau** : cumul annuel à peu près stable mais redistribué (plus incertain que la
  température).
- **Où va-t-on** : trajectoire de référence pour l'adaptation (TRACC) — +4 °C en
  métropole en 2100, présentée comme un **scénario de planification**, pas une prévision.

## Données et sources (toutes vérifiées)

Chaque chiffre provient d'une source faisant autorité. Aucune donnée inventée ;
aucune courbe fabriquée.

| Élément | Source |
|---|---|
| Réchauffement +1,7 °C depuis 1900 ; +2,2 °C sur 2015–2024 vs début XXe | Météo-France / ecologie.gouv.fr |
| Courbe maîtresse (température annuelle France 1900–2020) | **Berkeley Earth**, moyennes nationales (réf. 1961–1990, licence CC-BY-NC) |
| Europe ≈ 2× plus vite, continent au réchauffement le plus rapide | Copernicus / C3S |
| Repère mondial (+1,2 °C) | GIEC, 6ᵉ rapport (AR6) |
| 2022 = année la plus chaude depuis 1900 (14,5 °C) ; bilans climatiques | Météo-France |
| Vagues de chaleur (52 depuis 1947 ; 1,7 → 9,4 jours/an) | Météo-France (indicateur thermique national) |
| Trajectoire +4 °C en 2100 (TRACC, PNACC-3) | ecologie.gouv.fr |

Le graphique de température repose sur de **vraies mesures** : la série mensuelle
Berkeley Earth pour la France (`sources/france-berkeley-earth.csv`) est agrégée en
moyennes annuelles, puis exprimée en écart à la normale 1961–1990. La hausse
1900 → 2011–2020 calculée sur ces données (+1,8 °C) corrobore le chiffre Météo-France.

## Régénérer le PDF

```bash
cd sources
pip install matplotlib weasyprint
python charts.py                 # produit fig_temp.svg et fig_canicules.svg
python -c "from weasyprint import HTML; HTML('doc.html').write_pdf('../climat-meteo-france.pdf')"
```

`sources/` contient le HTML/CSS de mise en page (`doc.html`), le script des
graphiques (`charts.py`), la donnée brute Berkeley Earth et les deux figures SVG
(vectorielles).
