# Étude portfolio — T1, LCK 2025

Cette étude est générée à partir des mêmes règles de transformation et contrats de KPI que l’application. Elle ne remplace pas une analyse causale : elle décrit un échantillon de matchs et rend visibles sa taille et sa couverture.

## Synthèse

- **115 matchs observés** pour T1 ; taux de victoire de **62.6 %**, contre **50.0 %** pour l’ensemble des observations équipe de LCK.
- Avantage moyen à 15 minutes de **+527**, soit un écart de **+527 or** par rapport à la ligue.
- Premier dragon dans **60.9 %** des matchs et première tour dans **58.3 %**.
- Taux de victoire de **65.5 %** côté bleu contre **60.0 %** côté rouge. Cet écart est descriptif et dépend notamment des adversaires et de la sélection de côté.
- Priorité de draft la plus fréquente : **Taliyah**, présent dans **41.7 %** des drafts de l’équipe.

## Méthode et périmètre

- Corpus global affiché dans le dashboard : **20 871 matchs acceptés** sur **250 812 lignes raw**.
- Périmètre de l’étude : `league=LCK`, `year=2025`, `team=T1`.
- Un match accepté contient deux équipes, un seul vainqueur et cinq rôles distincts par côté.
- Les valeurs absentes ne sont pas remplacées par zéro ; la colonne couverture indique le nombre de matchs effectivement utilisables.

Fichiers sources :

- `2023_LoL_esports_match_data_from_OraclesElixir.csv` — SHA-256 `14b832026c559a8d4a72b1f7a98d64ee46fe9b50b7d1aa834af098c8d3fe7831`
- `2025_LoL_esports_match_data_from_OraclesElixir.csv` — SHA-256 `1adfa81d8ea54cd62b332d18f8a4089cb64331da448b11f0ff7084fac55ed406`

## 15 KPI équipe et benchmark de ligue

| KPI | T1 | Benchmark LCK | Écart brut | Couverture |
|---|---:|---:|---:|---:|
| T01 · Taux de victoire | 62.6 % | 50.0 % | +12.6 | 115/115 |
| T02 · Durée moyenne | 32.21 | 32.26 | -0.0 | 115/115 |
| T03 · Kills par match | 16.30 | 14.40 | +1.9 | 115/115 |
| T04 · Deaths par match | 13.19 | 14.43 | -1.2 | 115/115 |
| T05 · Différence d’or à 15 min | +527 | +0 | +526.8 | 115/115 |
| T06 · Premier sang | 56.5 % | 50.0 % | +6.5 | 115/115 |
| T07 · Première tour | 58.3 % | 50.0 % | +8.3 | 115/115 |
| T08 · Premier dragon | 60.9 % | 50.0 % | +10.9 | 115/115 |
| T09 · Premier héraut | 51.3 % | 50.0 % | +1.3 | 115/115 |
| T10 · Premier Baron | 60.0 % | 42.8 % | +17.2 | 115/115 |
| T11 · Dragons par match | 2.27 | 2.20 | +0.1 | 115/115 |
| T12 · Barons par match | 0.67 | 0.52 | +0.1 | 115/115 |
| T13 · Tours par match | 6.66 | 5.72 | +0.9 | 115/115 |
| T14 · Victoire côté bleu | 65.5 % | 51.0 % | +14.5 | 55/115 |
| T15 · Victoire côté rouge | 60.0 % | 49.0 % | +11.0 | 60/115 |

Le benchmark garde la même ligue et la même saison, puis retire seulement le filtre équipe. Les écarts n’ont donc pas tous la même unité : points de pourcentage pour les taux, or pour GD@15 et unité propre pour les moyennes.

## Cinq profils principaux par rôle

| Rôle | Joueur | Matchs | KDA | KP | CS/min | Dégâts/min | GD@15 | Win rate |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| ADC | Gumayusi | 91 | 5.13 | 70.7 % | 9.74 | 778.94 | +184 | 62.6 % |
| JUNGLE | Oner | 115 | 4.64 | 73.8 % | 6.85 | 493.28 | +137 | 62.6 % |
| MID | Faker | 115 | 4.34 | 62.3 % | 8.53 | 681.00 | -126 | 62.6 % |
| SUPPORT | Keria | 115 | 4.41 | 76.4 % | 1.07 | 245.30 | +87 | 62.6 % |
| TOP | Doran | 115 | 2.86 | 56.9 % | 8.03 | 625.77 | +172 | 62.6 % |

Le profil principal est celui qui possède le plus grand nombre de matchs dans le rôle. Les remplacements restent disponibles dans la vue Joueurs du dashboard.

## Top 10 des priorités de draft

| Champion | Pick rate | Ban rate | Présence | Win rate en pick | Picks |
|---|---:|---:|---:|---:|---:|
| Taliyah | 7.0 % | 34.8 % | 41.7 % | 75.0 % | 8 |
| Yone | 2.6 % | 30.4 % | 33.0 % | 0.0 % | 3 |
| Azir | 9.6 % | 21.7 % | 31.3 % | 81.8 % | 11 |
| Alistar | 8.7 % | 22.6 % | 31.3 % | 60.0 % | 10 |
| Rumble | 15.7 % | 14.8 % | 30.4 % | 66.7 % | 18 |
| Vi | 5.2 % | 23.5 % | 28.7 % | 50.0 % | 6 |
| Xin Zhao | 18.3 % | 9.6 % | 27.8 % | 76.2 % | 21 |
| Pantheon | 11.3 % | 16.5 % | 27.8 % | 53.8 % | 13 |
| Gwen | 13.9 % | 11.3 % | 25.2 % | 75.0 % | 16 |
| Rakan | 13.0 % | 12.2 % | 25.2 % | 73.3 % | 15 |

La présence mesure les picks et bans effectués par T1, dédupliqués par partie. Un taux de victoire sur peu de picks doit rester interprété comme un signal exploratoire.

## Limites

- Oracle’s Elixir agrège des compétitions de niveaux différents ; cette étude se limite explicitement à LCK.
- Le benchmark n’ajuste pas la force des adversaires, le patch, les changements de roster ou la phase de compétition.
- Les corrélations entre early game, objectifs, draft et victoire ne démontrent pas de causalité.
- Les KPI dont la couverture est incomplète conservent leur dénominateur réel dans l’interface.
