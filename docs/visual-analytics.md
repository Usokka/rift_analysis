# Lecture visuelle du dashboard

Le dashboard ne contient plus de tableaux HTML. Les chiffres exacts restent accessibles dans les fiches, légendes, sélections de points et exports CSV existants. Les visuels utilisent les filtres de l'API et les instantanés vérifiés de la démo.

## Questions et encodages

| Vue | Question | Représentation et données |
| --- | --- | --- |
| Ensemble | Quel résultat, quelle avance, quel premier objectif se distingue ? | Trois constats calculés : T01, T05, plus grand delta parmi T06–T10. Aucun score composite. |
| Ensemble | Quand gagne-t-on ? | Ruban chronologique V/D, sélection d'un match ; un bouton par observation. |
| Ensemble | Convertit-on l'avance ? | Taux de victoire conditionnels à GD@15 négatif, nul ou positif. Effectifs explicites ; null exclu, pas assimilé à zéro. |
| Ensemble | Que deviennent les avances et les retards ? | Nuage GD@15 / durée ; couleur du résultat ; sélection d'un match. |
| Équipe | Quel profil par rapport à la ligue ? | 15 bullet charts, valeurs brutes et repères de ligue. Échelles individuelles avec origine zéro ; pourcentages sur 0–100. |
| Équipe / Matchs | Quel rythme, selon le résultat ? | Histogramme d'effectifs empilés V/D ; tranches [0,20), [20,25), … [40,+∞) minutes. Bornes extrêmes ouvertes signalées. |
| Comparer | Où se creusent les écarts ? | Dumbbells des huit taux sur la même échelle 0–100, puis 15 comparaisons unitaires. |
| Joueurs | Ressources et production, participation et vision, farm et lane ? | Trois projections bivariées, filtre de rôle, bulles sélectionnables, fiches couvrant P01–P09. Couleur du rôle ; taille selon le plus petit effectif des deux variables, avec rayon minimal. |
| Draft | Pick ou ban ? | Nuage D01/D02, taille selon présence ; sélection et recherche sur l'ensemble des champions. |
| Draft | Quelle précision du win rate ? | D04 accompagné d'un intervalle binomial de Wilson à 95 %, effectif, seuil de présentation n<5. Hypothèses et limites affichées. |
| Tendances | Quelle dynamique et quel volume ? | Mosaïque hebdomadaire datée, courbe sélectionnable parmi quatre mesures, ruban de résultats, nuage GD@15 / win rate avec volume. |
| Match | Qui a produit dans chaque rôle ? | Duels côte bleu/rouge pour dégâts, or, CS, vision, GD@15, kills, deaths et assists. Même échelle pour les dix joueurs ; axe symétrique pour GD@15. |

Les axes temporels utilisent les dates. Les mesures nulles et les interruptions de plus de huit jours ne sont pas reliées. Les graphiques annoncent les valeurs au clavier et proposent un détail textuel sélectionnable. Les distributions ne sont jamais déduites d'une moyenne.

## Corpus et complétude

La limite arbitraire de 15 champions a été retirée du repository API et du générateur statique. Les instantanés versionnés ont été enrichis à partir des catalogues de matchs déjà publiés : même effectif de matchs par équipe, validation des effectifs et valeurs des anciens champions avant remplacement. Les catalogues eux-mêmes restent générés par le workflow Pages.

Les six équipes LPL n'ont pas de draft éligible dans ces instantanés : l'interface explique cette absence et ne fabrique pas de taux. Les autres équipes offrent entre 75 et 111 champions selon le périmètre. Le tri, la recherche et le minimum de picks s'appliquent au corpus complet ; les longues listes se déplient à la demande.

## Vérification

- `npm --prefix apps/web run build`
- `npm --prefix apps/web run lint`
- `node --experimental-strip-types --test apps/web/tests/analytics.test.ts` (Node 22.12+)
- `uv run pytest apps/api/tests/test_portfolio_demo.py -q`

Les tests couvrent les partitions avec valeurs nulles, les bornes d'histogramme, les intervalles de Wilson et la conservation des champions au-delà du top 15.
