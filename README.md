# Rift Analyst

Plateforme d’analyse de performances esport League of Legends, pensée pour démontrer **Data Engineering + Data Analysis + Fullstack**.

> État : ticket 001 — fondations. Aucune donnée de match ni métrique fictive n’est affichée.

## Démarrage local

Prérequis : Git, Docker et Docker Compose v2 récent (support de `--wait`).

```bash
git clone https://github.com/Usokka/rift_analysis.git
cd rift_analysis
cp .env.example .env
docker compose up --build -d --wait
```

- Interface : http://localhost:3000
- API et documentation : http://localhost:8000/docs
- Liveness : http://localhost:8000/api/v1/health
- Readiness PostgreSQL : http://localhost:8000/api/v1/ready

Les trois services sont vérifiés au démarrage. PostgreSQL reste privé au réseau Compose. Les ports web/API sont liés à localhost. Les identifiants de `.env.example` servent uniquement au développement local ; utiliser un mot de passe compatible URL ou encoder ses caractères réservés dans `DATABASE_URL`.

```bash
docker compose logs -f
docker compose down
```

Les données PostgreSQL persistent dans le volume `postgres_data`. `down` conserve ce volume.

## Développement hors conteneurs

Prérequis supplémentaires : Python 3.12+, uv et Node.js 22.12+ / npm.

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f compose.dev.yml up -d postgres
make install
make api
# Dans un autre terminal :
make web
```

Vite est disponible sur http://localhost:5173 et relaie les appels API vers le port 8000. Les valeurs de `DATABASE_URL` doivent correspondre aux identifiants PostgreSQL de `.env`.

```bash
make check
```

Cette commande lance Ruff, les tests API, ESLint, TypeScript et le build frontend. Le test PostgreSQL réel est activé en CI via `TEST_DATABASE_URL`. Un second job CI construit et démarre les trois conteneurs et vérifie le proxy web → API → PostgreSQL.

## Livré

- FastAPI, configuration par environnement et contrôles de santé séparés.
- React / TypeScript / Vite, identité bleu nuit / or / parchemin.
- État vide, disponibilité du service et bouton de nouvelle vérification.
- PostgreSQL, volume persistant, images applicatives sans utilisateur root.
- Docker Compose, Makefile, dépendances verrouillées et GitHub Actions.

## Suite

1. SQLAlchemy + Alembic : migrations et schémas.
2. Inspection Oracle’s Elixir, stockage raw et ingestion idempotente.
3. Modèle métier, contrôles qualité et KPIs documentés.
4. API analytique et Overview connectée aux données réelles.

Le [plan complet](docs/RIFT_ANALYST_PLAN.md) décrit la cible V1. Les [décisions d’architecture](docs/architecture.md) distinguent la cible des fonctionnalités déjà livrées.

La démo publique, les données réelles et les pages analytiques ne sont pas encore livrées.
