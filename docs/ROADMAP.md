# Roadmap — du socle à une analyse démontrable

État vérifié au 15 septembre 2026, départ `bba0212`. Le blueprint décrit la cible ; cette feuille de route décrit les incréments à livrer. Chaque version doit démarrer et passer la CI. Aucun chiffre de match ou résultat analytique ne doit être inventé pour remplir une interface.

## État actuel

| Partie | État |
|---|---|
| Tickets 001–002 : monorepo, API, React, Compose, Alembic | Livrés |
| Tickets 015–016 : identité et coque | Partiels : pas de routes analytiques ni filtres |
| Tickets 003–014, 017–022 | À implémenter |
| Matchs importés vérifiables dans le dépôt | Aucun dataset ni chargeur livré |
| KPIs calculés / dashboard comparatif | Non implémentés |

## Ordre des versions

| Version | Livraison | Critère de sortie |
|---|---|---|
| 0.1.1 — fiabilisation | Readiness de schéma, périmètre Alembic, reconnexion du proxy, audit | Tests et build verts ; CI PostgreSQL et Compose |
| 0.2 — ingestion reproductible | Inspection Oracle’s Elixir, migration raw + pipeline_runs, import CSV par lots, checksum, journal des rejets | Même fichier importé deux fois : aucun doublon ; échec traçable ; raw conservé |
| 0.3 — modèle et qualité | Competitions, matchs, équipes, joueurs, stats équipe/joueur et drafts | 2 équipes, 1 vainqueur, 5 joueurs par équipe pour les matchs complets ; relations valides ; quarantaine explicite |
| 0.4 — première verticale | 1 équipe, 10 KPIs testés, endpoint Overview, filtre ligue/saison/période, comparaison ligue | Le navigateur affiche exclusivement les résultats de PostgreSQL ; cas vide et erreur utilisables |
| 0.5 — couverture analytique | Catalogue des 28 contrats cibles, joueurs par rôle, drafts, sides, tendances | Chaque KPI livré a formule, source réelle, unité, effectif et test sur résultat attendu |
| 1.0 — portfolio | Pages Team/Players/Draft/Trends, démonstration reproductible, étude réelle et preuves chiffrées | Rapport auditable des matchs et KPIs, CI verte, captures et démo utilisable |
| 1.1 — confort analyste | Comparaison de deux équipes, export de rapport, détail d’un match | Cas d’usage validé sur données réelles et comparaison cohérente de filtres |
| 2.0 — analyses approfondies | Analyse par patch, conversion d’avance, scouting ; Riot uniquement si l’accès aux matchs visés est vérifié | Provenance et couverture de chaque enrichissement ; aucune dépendance Riot obligatoire |
| 3.0 — expérimentation | Similarité joueurs/équipes, clustering, éventuellement prédiction | Baselines, séparation temporelle entraînement/test, absence de fuite et limites documentées |

Pas de LLM, Airflow, Redis ou infrastructure supplémentaire avant un besoin mesuré. Importer par lots pour rester compatible avec une machine à 4 Go de RAM. Les calculs de référence restent côté SQL/backend.

## Prochain incrément concret : 0.2 (tickets 003–005)

1. Obtenir un export Oracle’s Elixir réel et enregistrer provenance, date, checksum et conditions de réutilisation. Inspecter en-têtes, types, tailles, années, ligues et niveaux de complétude. Aucun nom de colonne du blueprint n’est une garantie du schéma source.
2. Rédiger le mapping source → modèle et préserver les en-têtes/valeurs bruts. Vérifier la stabilité de l’identifiant de match entre fichiers et saisons avant de choisir la clé naturelle.
3. Ajouter `pipeline_runs`, un registre des fichiers et `raw.oracle_elixir_matches` via Alembic. Conserver les versions de source et définir explicitement comment une correction du fournisseur remplace la version active sans effacer l’historique.
4. Livrer une commande `make ingest SOURCE=/chemin/export.csv` (future commande, absente aujourd’hui), lecture en flux/par lots, transaction et journal d’erreur sans secret. Séparer commit du run et transaction de données pour qu’un rollback n’efface pas le diagnostic.
5. Tester le premier chargement, la relance identique, les doublons entre fichiers, un fichier corrigé, une interruption, un CSV invalide et les champs essentiels manquants.
6. Produire un bilan : fichiers, lignes lues/chargées/rejetées, doublons, identifiants de matchs distincts, couverture et durée. Ne pas confondre lignes joueurs/équipes et matchs.

## Première verticale : 0.4

Commencer par une équipe d’une ligue et une période réellement présentes. Afficher : taux de victoire, durée moyenne, kills/match, deaths/match, GD@15, first blood, first tower, dragons/match, barons/match, tours/match. Si une source ne fournit pas un champ, afficher indisponible et sa couverture ; ne pas remplacer par zéro.

L’API reçoit ligue, saison, split, période et équipe, valide les identifiants et les dates, et renvoie filtres appliqués, valeurs, unités et effectifs. Le benchmark garde la même période et la même ligue mais retire le filtre équipe. Les joueurs sont comparés au même rôle ; les rôles/équipes historiques appartiennent au joueur-match, pas uniquement à la fiche actuelle du joueur.

## Preuves nécessaires pour la phrase de CV

Phrase visée : « Analyse de 18 000+ matchs professionnels sur League of Legends avec calcul de 25+ KPIs équipe/joueur/draft et dashboard comparatif par ligue. »

Pour l’utiliser comme réalisation terminée, la release 1.0 doit contenir :

- Un manifeste des fichiers : origine, date de récupération, années, ligues, checksum et sélection des compétitions professionnelles. Définir le périmètre des ligues académiques/amateurs et ne pas les qualifier automatiquement de professionnelles.
- Une requête reproductible comptant les **identifiants canoniques distincts de matchs acceptés**, après exclusions et dédoublonnage ; seuil visé ≥ 18 000. Les observations joueur et équipe d’une même partie ne sont pas des matchs différents.
- Un registre d’au moins 25 indicateurs effectivement implémentés, testés et exposés, avec couverture non vide. Les classements top picks, variantes de filtres et copies d’un même indicateur ne gonflent pas artificiellement le total.
- Un rapport horodaté lié au commit : matchs distincts bruts/acceptés/rejetés, ligues, période, KPIs disponibles, taux de valeurs manquantes. Les comptes doivent se réconcilier ; préciser les éventuels matchs sans identifiant exploitable séparément.
- Une démonstration des filtres et du benchmark par ligue, accompagnée d’une petite étude interprétée, avec limites et taille d’échantillon.

Si la couverture disponible est inférieure au seuil, afficher le chiffre mesuré. Le volume doit résulter du dataset, jamais du besoin d’atteindre la formule de CV.

Formulation provisoire cohérente avec le code actuel : « Développement d’une plateforme d’analyse de matchs League of Legends : socle FastAPI/React, PostgreSQL et migrations automatisées. »
