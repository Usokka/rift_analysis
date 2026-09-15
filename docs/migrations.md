# Migrations PostgreSQL

Alembic est l’unique mécanisme de création et d’évolution du schéma. Aucun `create_all` n’est exécuté au démarrage de FastAPI.

## Révisions

- `0001` crée les namespaces `raw`, `staging` et `analytics` ainsi que `public.alembic_version`.
- `0002` crée `raw.source_files`, `raw.oracle_elixir_rows`, `raw.pipeline_runs`, puis `analytics.matches`, `team_match_stats`, `player_match_stats` et `draft_actions` avec leurs contraintes et index.

La readiness exige la révision `REQUIRED_REVISION` de `app.core.database`. Un test vérifie qu’elle correspond à la tête Alembic. Les tables de `public` autres que la table de version restent hors du périmètre d’autogénération.

## Avec Docker Compose

`docker compose up --build -d --wait` démarre PostgreSQL, exécute le service ponctuel `migrate`, puis démarre l’API si la migration réussit. Le frontend attend ensuite la disponibilité de l’API.

```bash
docker compose run --rm migrate
docker compose run --rm migrate .venv/bin/alembic current
```

Le service de migration réutilise l’image et les identifiants de l’API. Il ne redémarre pas en boucle. Une production future devra séparer le compte de migration du compte applicatif.

## Développement sur l’hôte

```bash
uv sync --frozen
make migrate
make migration-status
make migration-check
uv run alembic history
uv run alembic upgrade head --sql
```

La connexion vient de `DATABASE_URL` dans l’environnement ou `.env`. L’URL n’est pas interpolée dans `alembic.ini`, ce qui préserve les mots de passe encodés contenant `%`.

Pour ajouter une évolution : importer les modèles, générer avec `uv run alembic revision --autogenerate -m "description"`, examiner la révision, mettre à jour `REQUIRED_REVISION`, puis tester upgrade, deuxième upgrade, `alembic check`, downgrade et nouvel upgrade sur PostgreSQL.

La révision `0001` ne supprime que des schémas vides et refuse `CASCADE`. La révision `0002` supprime ses propres tables en ordre inverse avant le retour à `0001`. Le test de cycle utilise une transaction annulée à la fin et refuse une base de test déjà initialisée.
