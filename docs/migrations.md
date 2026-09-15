# Migrations PostgreSQL

Alembic est l’unique mécanisme de création et d’évolution du schéma. Aucun `create_all` n’est exécuté au démarrage de FastAPI.

## Première révision : 0001

- `raw` : données sources conservées sans écrasement silencieux (tables au ticket 003).
- `staging` : normalisation et contrôles intermédiaires.
- `analytics` : modèle analytique et résultats destinés à l’API.
- `public.alembic_version` : révision appliquée par Alembic.

Aucune table métier n’est créée avant inspection du dataset. La base déclarative et les conventions de noms sont dans `app.core.models.Base`. La readiness exige la révision `REQUIRED_REVISION` de `app.core.database` ; la mettre à jour à chaque migration (un test vérifie sa cohérence avec la tête Alembic). Les tables de `public` autres que la table de version restent hors du périmètre d’autogénération. Importer les futurs modèles dans l’environnement Alembic avant toute génération de migration.

## Avec Docker Compose

`docker compose up --build -d --wait` démarre PostgreSQL, exécute le service ponctuel `migrate`, puis démarre l’API uniquement si la migration réussit. Le frontend attend ensuite la disponibilité de l’API. Une migration en échec bloque le démarrage plutôt que de laisser l’application utiliser une base obsolète.

```bash
docker compose run --rm migrate
# État courant :
docker compose run --rm migrate .venv/bin/alembic current
```

Le service de migration réutilise l’image et les identifiants de l’API. Il ne redémarre pas en boucle. Ne pas lancer plusieurs migrations simultanément. Pour une future production, le compte de migration devra être distinct du compte applicatif.

## Développement sur l’hôte

Depuis la racine du dépôt, avec `.env` renseigné et PostgreSQL lancé :

```bash
uv sync --frozen
make migrate
make migration-status
make migration-check
uv run alembic history
uv run alembic upgrade head --sql
```

La connexion vient de `DATABASE_URL` dans l’environnement ou `.env`. L’URL n’est jamais interpolée dans `alembic.ini`, ce qui préserve les mots de passe encodés contenant `%`.

Pour ajouter une évolution : importer les modèles, générer avec `uv run alembic revision --autogenerate -m "description"`, examiner et corriger le fichier produit, puis tester la migration. Alembic ne déduit pas automatiquement tous les changements, notamment les renommages et la création de schémas.

## Retour arrière et validation

`uv run alembic downgrade -1` revient à la révision précédente ; cette commande doit être utilisée sur une base de développement ou après analyse des conséquences sur les données. La révision 0001 ne supprime que des schémas vides, sans `CASCADE`. Des objets non gérés empêchent le rollback et sont conservés. Des schémas homonymes déjà présents avant la première migration provoquent également un échec explicite : aucune adoption silencieuse.

Les tests CI valident sur PostgreSQL : upgrade, deuxième upgrade sans effet, absence de dérive ORM, refus de supprimer un schéma contenant des données, downgrade et nouvel upgrade. Le test ouvre une transaction externe qui est annulée à la fin et refuse une base déjà initialisée ; `TEST_DATABASE_URL` doit viser une base de test vierge. Les tests sans PostgreSQL vérifient la génération SQL hors ligne.
