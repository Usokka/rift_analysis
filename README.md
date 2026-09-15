# Rift Analyst

Plateforme d’analyse de performances esport League of Legends construite avec un pipeline reproductible, PostgreSQL, FastAPI et React. Elle transforme les exports Oracle’s Elixir en 28 KPIs équipe, joueur et draft, puis compare une équipe à sa ligue sur la même période.

**[Ouvrir la démo publique](https://usokka.github.io/rift_analysis/)** · instantané T1 / LCK 2025 calculé sur le corpus vérifié. La [courte étude d’équipe](docs/case-study-t1-2025.md) documente les observations, les échantillons et les limites.

## Résultats vérifiés

Le rapport reproductible [`docs/data-report.json`](docs/data-report.json) mesure les exports 2023 et 2025 épinglés par checksum :

- 250 812 lignes sources ;
- 20 901 `gameid` distincts ;
- 20 871 matchs acceptés après validation structurelle ;
- 30 matchs rejetés ;
- 28 contrats de KPIs implémentés : 15 équipe, 9 joueur et 4 draft.

Une partie Oracle’s Elixir contient normalement 12 lignes (10 joueurs et 2 équipes). Le volume annoncé compte donc les identifiants de parties distincts après validation, jamais les lignes du CSV. Les fichiers complets ne sont pas versionnés dans Git.

## Ce que l’application fait

- Téléchargement vérifié des exports par SHA-256.
- Conservation du raw en JSONB et journal de chaque pipeline run.
- Ingestion par lots compatible avec une machine disposant de 4 Go de RAM.
- Relance idempotente : un fichier identique est ignoré, une nouvelle version conserve son raw et remplace les projections des matchs concernés.
- Contrôles : 2 équipes, 1 vainqueur, 5 joueurs et 5 rôles distincts par côté.
- Modèle analytique matchs, statistiques équipe/joueur et actions de draft.
- 28 KPIs avec unité, effectif, couverture et benchmark de ligue.
- Filtres par ligue, saison, split, équipe et période.
- Vues Overview, Team, Players, Draft et Trends, sans valeur analytique codée en dur dans React.

## Démarrage

Prérequis : Git, Docker et Docker Compose v2 récent.

```bash
git clone https://github.com/Usokka/rift_analysis.git
cd rift_analysis
cp .env.example .env
docker compose up --build -d --wait
```

- Dashboard : http://localhost:3000
- API / Swagger : http://localhost:8000/docs
- Liveness : http://localhost:8000/api/v1/health
- Readiness PostgreSQL et migrations : http://localhost:8000/api/v1/ready

Au premier démarrage, le dashboard affiche un état vide explicite. Pour charger le corpus vérifié :

```bash
make download-data
make ingest SOURCE="/data/raw/2023_LoL_esports_match_data_from_OraclesElixir.csv /data/raw/2025_LoL_esports_match_data_from_OraclesElixir.csv"
make verify-data
```

`make download-data` télécharge environ 150 Mo. PostgreSQL conserve davantage d’espace parce que les lignes raw et les projections analytiques sont toutes deux stockées. `make ingest` accepte aussi tout export Oracle’s Elixir compatible placé dans `data/raw`.

Pour le développement hors conteneurs :

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f compose.dev.yml up -d postgres
make install
make migrate
make ingest-local SOURCE="data/fixtures/oracle_elixir_sample.csv"
make api
# Second terminal
make web
```

## API

```text
GET /api/v1/analytics/metadata
GET /api/v1/analytics/overview?league=LCK&year=2025&team_id=...
```

L’endpoint Overview renvoie les filtres appliqués, 15 KPIs équipe avec benchmark, 9 KPIs par profil joueur/rôle, 4 KPIs par champion draft et les tendances hebdomadaires.

## Architecture

```text
Oracle’s Elixir CSV
        ↓ checksum + lecture par lots
raw.source_files / raw.oracle_elixir_rows / raw.pipeline_runs
        ↓ validation et projection idempotente
analytics.matches / team_match_stats / player_match_stats / draft_actions
        ↓ SQL analytique + FastAPI
React : Overview / Team / Players / Draft / Trends
```

PostgreSQL est la source analytique de vérité. Alembic est l’unique mécanisme de création et d’évolution du schéma. Nginx relaie l’API sous la même origine que le frontend.

## Qualité et limites

Les valeurs manquantes restent nulles et la couverture est affichée. Les données partielles peuvent alimenter un KPI lorsque ses champs sont présents. Les 30 parties structurellement invalides du corpus mesuré restent auditables dans le raw et sont exclues des projections analytiques.

Le dataset provient d’[Oracle’s Elixir](https://oracleselixir.com/), qui publie des fichiers de matchs de nombreuses ligues. Les URL automatiques sont des miroirs publics épinglés par checksum afin de rendre cette version reproductible ; l’attribution reste Oracle’s Elixir. Le dépôt ne prétend pas mesurer l’effet causal d’une draft et les petits échantillons doivent être interprétés avec prudence.

## Vérification

```bash
make check
```

Cette commande exécute Ruff, pytest, ESLint, TypeScript et le build frontend. La CI ajoute PostgreSQL réel, le cycle Alembic, l’ingestion idempotente, Docker Compose et le test de reprise du proxy après recréation de l’API. La PR de livraison exécute aussi un contrôle complet sur les deux exports et publie la preuve comme artefact.

`make portfolio-demo` régénère l’instantané public et l’étude T1 à partir des deux exports épinglés. La CI full-data refuse toute divergence entre les fichiers publiés et ce calcul reproductible.

- [Contrats des métriques](docs/metrics.md)
- [Architecture](docs/architecture.md)
- [Étude T1 / LCK 2025](docs/case-study-t1-2025.md)
- [Roadmap](docs/ROADMAP.md)
- [Migrations](docs/migrations.md)
