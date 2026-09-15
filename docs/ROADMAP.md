# Roadmap — du socle à une analyse démontrable

État vérifié au 15 septembre 2026, départ `bba0212`. Le blueprint décrit la cible ; cette feuille de route décrit les incréments à livrer. Chaque version doit démarrer et passer la CI. Aucun chiffre de match ou résultat analytique ne doit être inventé pour remplir une interface.

## État actuel

| Partie | État |
|---|---|
| Socle FastAPI, React, PostgreSQL, Compose et Alembic | Livré |
| Ingestion raw idempotente et rapport de pipeline | Implémenté |
| Modèle matchs/équipes/joueurs/drafts et qualité | Implémenté |
| API avec 28 KPIs, filtres et benchmark ligue | Implémenté |
| Dashboard Overview/Team/Players/Draft/Trends | Implémenté |
| Corpus mesuré | 20 871 matchs acceptés sur 20 901 `gameid` distincts |
| Démo publique et étude d’équipe | Snapshot T1 / LCK 2025 et déploiement GitHub Pages automatisés |

## Ordre des versions

| Version | Livraison | Critère de sortie |
|---|---|---|
| 0.1.1 — fiabilisation | Readiness de schéma, périmètre Alembic, reconnexion du proxy, audit | Livré |
| 0.2 — ingestion reproductible | Inspection Oracle’s Elixir, migration raw + pipeline_runs, import CSV par lots, checksum, journal des rejets | Implémenté ; validation corpus complet en CI |
| 0.3 — modèle et qualité | Matchs, équipes, joueurs, stats équipe/joueur et drafts | Implémenté ; 30 matchs invalides exclus et conservés en raw |
| 0.4 — première verticale | 15 KPIs équipe, endpoint Overview, filtres et comparaison ligue | Implémenté |
| 0.5 — couverture analytique | 28 contrats, joueurs par rôle, drafts, sides et tendances | Implémenté |
| 1.0 — portfolio | Vues Team/Players/Draft/Trends, corpus reproductible et preuves chiffrées | Livré ; démo statique reproductible et étude T1 publiées |
| 1.1 — confort analyste | Comparaison de deux équipes, export de rapport, détail d’un match | Cas d’usage validé sur données réelles et comparaison cohérente de filtres |
| 2.0 — analyses approfondies | Analyse par patch, conversion d’avance, scouting ; Riot uniquement si l’accès aux matchs visés est vérifié | Provenance et couverture de chaque enrichissement ; aucune dépendance Riot obligatoire |
| 3.0 — expérimentation | Similarité joueurs/équipes, clustering, éventuellement prédiction | Baselines, séparation temporelle entraînement/test, absence de fuite et limites documentées |

Pas de LLM, Airflow, Redis ou infrastructure supplémentaire avant un besoin mesuré. Importer par lots pour rester compatible avec une machine à 4 Go de RAM. Les calculs de référence restent côté SQL/backend.

## Prochain incrément : confort analyste

1. Comparer deux équipes avec le même périmètre de filtres.
2. Exporter un rapport et ouvrir le détail d’un match.
3. Ajouter une analyse par patch et mesurer la conversion d’un avantage à 15 minutes.
4. Déployer le backend complet uniquement si un hébergement PostgreSQL pérenne est disponible ; la démo GitHub Pages reste un snapshot sans coût ni secret.

## Première verticale livrée : 0.4

La verticale peut analyser toute équipe d’une ligue et d’une période réellement présentes. Elle affiche : taux de victoire, durée moyenne, kills/match, deaths/match, GD@15, first blood, first tower, dragons/match, barons/match, tours/match. Si une source ne fournit pas un champ, afficher indisponible et sa couverture ; ne pas remplacer par zéro.

L’API reçoit ligue, saison, split, période et équipe, valide les identifiants et les dates, et renvoie filtres appliqués, valeurs, unités et effectifs. Le benchmark garde la même période et la même ligue mais retire le filtre équipe. Les joueurs sont comparés au même rôle ; les rôles/équipes historiques appartiennent au joueur-match, pas uniquement à la fiche actuelle du joueur.

## Preuves nécessaires pour la phrase de CV

Phrase visée : « Analyse de 18 000+ matchs professionnels sur League of Legends avec calcul de 25+ KPIs équipe/joueur/draft et dashboard comparatif par ligue. »

Les éléments suivants sont maintenant présents ou contrôlés par la CI de livraison :

- Un manifeste des fichiers : origine, date de récupération, années, ligues, checksum et sélection des compétitions professionnelles. Définir le périmètre des ligues académiques/amateurs et ne pas les qualifier automatiquement de professionnelles.
- Une requête reproductible comptant les **identifiants canoniques distincts de matchs acceptés**, après exclusions et dédoublonnage ; seuil visé ≥ 18 000. Les observations joueur et équipe d’une même partie ne sont pas des matchs différents.
- Un registre d’au moins 25 indicateurs effectivement implémentés, testés et exposés, avec couverture non vide. Les classements top picks, variantes de filtres et copies d’un même indicateur ne gonflent pas artificiellement le total.
- Un rapport horodaté lié au commit : matchs distincts bruts/acceptés/rejetés, ligues, période, KPIs disponibles, taux de valeurs manquantes. Les comptes doivent se réconcilier ; préciser les éventuels matchs sans identifiant exploitable séparément.
- Une démonstration des filtres et du benchmark par ligue, accompagnée d’une petite étude interprétée, avec limites et taille d’échantillon.

Le volume mesuré est de 20 871 matchs acceptés et le catalogue contient 28 KPIs. La formulation de CV à conserver reste volontairement arrondie : « Analyse de 18 000+ matchs professionnels sur League of Legends avec calcul de 25+ KPIs équipe/joueur/draft et dashboard comparatif par ligue. »
