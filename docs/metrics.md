# Contrats des KPIs V1

Ce catalogue définit les 28 indicateurs calculés par l’API. Le mapping Oracle’s Elixir est implémenté dans `app.ingestion.oracle_elixir`; les unités, effectifs et couvertures sont exposés avec chaque valeur.

## Règles communes

Le grain de référence est un match canonique, une observation équipe-match ou joueur-match selon le KPI. Appliquer les mêmes filtres de ligue/saison/split/période/side/patch à tous les termes d’un calcul. Les valeurs nulles ne deviennent pas zéro. Chaque résultat renvoie `value`, `unit`, `sample_size` (observations valides) et `eligible_sample_size` (observations dans le périmètre), afin de calculer la couverture.

Les pourcentages sont sur 0–100. Un dénominateur nul ou un échantillon vide donne `null`. Ne pas arrondir les valeurs intermédiaires. Les durées sont en minutes pour les débits. Pour ces débits, sommer uniquement des numérateurs/durées appariés sur les mêmes observations valides. Un taux de premier objectif ignore les valeurs non renseignées. Les matchs incomplets restent dans le raw et sont exclus ou signalés selon la métrique.

## Équipes

| ID | Indicateur | Définition / formule | Source métier requise | Unité |
|---|---|---|---|---|
| T01 | Taux de victoire | 100 × victoires / matchs valides | résultat équipe-match | % |
| T02 | Durée moyenne | moyenne(durée en secondes) / 60 | durée du match | min |
| T03 | Kills par match | moyenne(kills équipe) | kills équipe-match | kills/match |
| T04 | Deaths par match | moyenne(deaths équipe) | deaths équipe-match | deaths/match |
| T05 | GD@15 | moyenne(or équipe à 15 − or adverse à 15) | or des deux équipes à 15 min, ou différence source vérifiée | or |
| T06 | First blood | 100 × premières éliminations obtenues / observations valides | indicateur premier kill | % |
| T07 | First tower | 100 × premières tours obtenues / observations valides | indicateur première tour | % |
| T08 | First dragon | 100 × premiers dragons obtenus / observations valides | indicateur premier dragon | % |
| T09 | First herald | 100 × premiers hérauts obtenus / observations valides | indicateur premier héraut et disponibilité selon patch | % |
| T10 | First baron | 100 × premiers barons obtenus / observations valides | indicateur premier baron | % |
| T11 | Dragons par match | moyenne(dragons pris) | dragons équipe-match | dragons/match |
| T12 | Barons par match | moyenne(barons pris) | barons équipe-match | barons/match |
| T13 | Tours par match | moyenne(tours détruites) | tours équipe-match | tours/match |
| T14 | Victoire côté bleu | 100 × victoires côté bleu / matchs côté bleu | side et résultat | % |
| T15 | Victoire côté rouge | 100 × victoires côté rouge / matchs côté rouge | side et résultat | % |

## Joueurs

| ID | Indicateur | Définition / formule | Source métier requise | Unité |
|---|---|---|---|---|
| P01 | KDA agrégé | (somme kills + somme assists) / max(1, somme deaths), sur lignes complètes | kills/deaths/assists joueur-match | ratio |
| P02 | Participation aux kills | 100 × somme(kills + assists joueur) / somme(kills de son équipe), observations appariées | stats joueur et équipe du même match | % |
| P03 | CS/min | somme(CS) / somme(durée min) | CS total selon définition fournisseur et durée | CS/min |
| P04 | Or/min | somme(or) / somme(durée min) | or total et durée ; distinguer or gagné et or total si source différente | or/min |
| P05 | Dégâts/min | somme(dégâts aux champions) / somme(durée min) | dégâts aux champions et durée | dégâts/min |
| P06 | Vision/min | somme(score de vision) / somme(durée min) | véritable score de vision et durée ; les wards ne sont pas un substitut | points/min |
| P07 | GD@15 individuel | moyenne(or joueur à 15 − or adversaire du même rôle à 15) | or à 15 et rôle des deux joueurs, ou différence source vérifiée | or |
| P08 | Taille du pool | nombre de champions distincts joués | champion joueur-match | champions |
| P09 | Taux de victoire joueur | 100 × victoires / participations valides | joueur-match et résultat | % |

## Draft — par champion pour l’équipe sélectionnée

| ID | Indicateur | Définition / formule | Source métier requise | Unité |
|---|---|---|---|---|
| D01 | Pick rate | 100 × matchs distincts où le champion est choisi / matchs complets | picks et complétude | % |
| D02 | Ban rate | 100 × matchs distincts où le champion est banni / matchs complets | bans et complétude | % |
| D03 | Présence pick/ban | 100 × matchs distincts où le champion est choisi OU banni / matchs complets | union picks/bans dédupliquée par match/champion | % |
| D04 | Victoire avec le champion | 100 × matchs gagnés avec ce champion / matchs où il est joué, résultat valide | champion, équipe qui le joue, résultat | % |

Un export peut répéter les bans sur plusieurs lignes joueurs : normaliser à un événement match/équipe/slot avant agrégation. Ne pas déduire l’ordre de pick depuis l’ordre des rôles. Une absence de ban peut être une action valide ou une donnée manquante : vérifier le contrat fournisseur avant de décider la complétude. Restreindre ces formules aux formats compétitifs standard sans choix miroir, ou définir un contrat distinct.

Les vues top picks/top bans sont des classements de D01/D02, pas de nouveaux KPIs. « Draft win rate » ne mesure pas l’effet causal d’une draft. Les deux taux par side et les indicateurs homologues équipe/joueur sont des déclinaisons explicites ; publier le catalogue exact plutôt qu’un décompte de formules prétendument indépendantes.

## Benchmarks et tests d’acceptation

- Benchmark équipe : même ligue/saison/période et filtres compatibles, calcul sur l’ensemble des observations équipe-match (équipe sélectionnée incluse en V1). Éviter la moyenne non pondérée des moyennes d’équipes.
- Les joueurs sont agrégés par identité et rôle historique. Le benchmark joueur par rôle est prévu en V1.1 ; la V1 affiche leurs valeurs et couvertures.
- Delta de pourcentages : points de pourcentage. Delta d’un débit/différence : même unité que la valeur.
- Exemples minimaux calculés à la main : deux matchs de durées différentes, zéro death, zéro kill équipe, champ nul, changement d’équipe/rôle, ban dupliqué, période vide, filtre side, division par zéro.
- GD@15 : sur un match complet, somme des deux différences équipe = 0. Un match terminé avant 15 minutes sans mesure ne reçoit pas artificiellement GD@15 = 0.
- La comparaison de périodes doit afficher leurs effectifs. Pour un échantillon < 5 observations, montrer « échantillon faible » ; ce seuil de présentation ne représente pas une significativité statistique.

Les scores composites Objective Control / Early Game restent différés : les métriques atomiques sont plus faciles à auditer. Le rapport `data-report.json` et la commande `verify-data` contrôlent séparément le volume du corpus et le nombre de contrats implémentés.
