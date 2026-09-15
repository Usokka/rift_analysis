# Étude portfolio — Karmine Corp, LEC 2025

Cette étude est générée à partir des mêmes règles de transformation et contrats de KPI que l’application. Elle ne remplace pas une analyse causale : elle décrit un échantillon de matchs et rend visibles sa taille et sa couverture.

## Synthèse

- **87 matchs observés** pour Karmine Corp ; taux de victoire de **63.2 %**, contre **50.0 %** pour l’ensemble des observations équipe de LEC.
- Avantage moyen à 15 minutes de **+26**, soit un écart de **+26 or** par rapport à la ligue.
- Premier dragon dans **51.7 %** des matchs et première tour dans **57.5 %**.
- Taux de victoire de **69.4 %** côté bleu contre **55.3 %** côté rouge. Cet écart est descriptif et dépend notamment des adversaires et de la sélection de côté.
- Priorité de draft la plus fréquente : **Vi**, présent dans **44.8 %** des drafts de l’équipe.

## Méthode et périmètre

- Corpus global affiché dans le dashboard : **20 871 matchs acceptés** sur **250 812 lignes raw**.
- Périmètre de l’étude : `league=LEC`, `year=2025`, `team=Karmine Corp`.
- Un match accepté contient deux équipes, un seul vainqueur et cinq rôles distincts par côté.
- Les valeurs absentes ne sont pas remplacées par zéro ; la colonne couverture indique le nombre de matchs effectivement utilisables.

Fichiers sources :

- `2023_LoL_esports_match_data_from_OraclesElixir.csv` — SHA-256 `14b832026c559a8d4a72b1f7a98d64ee46fe9b50b7d1aa834af098c8d3fe7831`
- `2025_LoL_esports_match_data_from_OraclesElixir.csv` — SHA-256 `1adfa81d8ea54cd62b332d18f8a4089cb64331da448b11f0ff7084fac55ed406`

## 15 KPI équipe et benchmark de ligue

| KPI | Karmine Corp | Benchmark LEC | Écart brut | Couverture |
|---|---:|---:|---:|---:|
| T01 · Taux de victoire | 63.2 % | 50.0 % | +13.2 | 87/87 |
| T02 · Durée moyenne | 33.39 | 33.59 | -0.2 | 87/87 |
| T03 · Kills par match | 14.93 | 13.54 | +1.4 | 87/87 |
| T04 · Deaths par match | 11.94 | 13.57 | -1.6 | 87/87 |
| T05 · Différence d’or à 15 min | +26 | +0 | +26.4 | 87/87 |
| T06 · Premier sang | 43.7 % | 50.0 % | -6.3 | 87/87 |
| T07 · Première tour | 57.5 % | 50.0 % | +7.5 | 87/87 |
| T08 · Premier dragon | 51.7 % | 50.0 % | +1.7 | 87/87 |
| T09 · Premier héraut | 50.6 % | 50.0 % | +0.6 | 87/87 |
| T10 · Premier Baron | 52.9 % | 45.3 % | +7.6 | 87/87 |
| T11 · Dragons par match | 2.85 | 2.39 | +0.5 | 87/87 |
| T12 · Barons par match | 0.69 | 0.62 | +0.1 | 87/87 |
| T13 · Tours par match | 7.21 | 6.19 | +1.0 | 87/87 |
| T14 · Victoire côté bleu | 69.4 % | 55.9 % | +13.5 | 49/87 |
| T15 · Victoire côté rouge | 55.3 % | 44.1 % | +11.1 | 38/87 |

Le benchmark garde la même ligue et la même saison, puis retire seulement le filtre équipe. Les écarts n’ont donc pas tous la même unité : points de pourcentage pour les taux, or pour GD@15 et unité propre pour les moyennes.

## Cinq profils principaux par rôle

| Rôle | Joueur | Matchs | KDA | KP | CS/min | Dégâts/min | GD@15 | Win rate |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| ADC | Caliste | 87 | 5.96 | 70.7 % | 9.90 | 750.61 | +16 | 63.2 % |
| JUNGLE | Yike | 87 | 4.14 | 72.9 % | 6.01 | 438.61 | -68 | 63.2 % |
| MID | Vladi | 87 | 4.71 | 68.2 % | 8.77 | 702.91 | -78 | 63.2 % |
| SUPPORT | Targamas | 87 | 3.55 | 74.4 % | 1.11 | 190.00 | -30 | 63.2 % |
| TOP | Canna | 87 | 3.64 | 54.9 % | 8.01 | 617.85 | +187 | 63.2 % |

Le profil principal est celui qui possède le plus grand nombre de matchs dans le rôle. Les remplacements restent disponibles dans la vue Joueurs du dashboard.

## Top 10 des priorités de draft

| Champion | Pick rate | Ban rate | Présence | Win rate en pick | Picks |
|---|---:|---:|---:|---:|---:|
| Vi | 13.8 % | 31.0 % | 44.8 % | 58.3 % | 12 |
| Maokai | 10.3 % | 27.6 % | 37.9 % | 77.8 % | 9 |
| Azir | 14.9 % | 17.2 % | 32.2 % | 53.8 % | 13 |
| Varus | 12.6 % | 19.5 % | 32.2 % | 63.6 % | 11 |
| Taliyah | 10.3 % | 19.5 % | 29.9 % | 77.8 % | 9 |
| Nautilus | 5.7 % | 20.7 % | 26.4 % | 80.0 % | 5 |
| Pantheon | 5.7 % | 20.7 % | 26.4 % | 40.0 % | 5 |
| Rumble | 14.9 % | 9.2 % | 24.1 % | 76.9 % | 13 |
| Viktor | 16.1 % | 6.9 % | 23.0 % | 78.6 % | 14 |
| Gwen | 2.3 % | 20.7 % | 23.0 % | 50.0 % | 2 |

La présence mesure les picks et bans effectués par Karmine Corp, dédupliqués par partie. Un taux de victoire sur peu de picks doit rester interprété comme un signal exploratoire.

## Limites

- Oracle’s Elixir agrège des compétitions de niveaux différents ; cette étude se limite explicitement à LEC.
- Le benchmark n’ajuste pas la force des adversaires, le patch, les changements de roster ou la phase de compétition.
- Les corrélations entre early game, objectifs, draft et victoire ne démontrent pas de causalité.
- Les KPI dont la couverture est incomplète conservent leur dénominateur réel dans l’interface.
