# Architecture — état initial

Les tickets 001–002 fournissent le monorepo, les services locaux, la CI et les migrations Alembic. Le stockage des matchs et les calculs métier ne sont pas encore implémentés.

- `apps/api/app/api` : routes HTTP et contrats de réponse.
- `apps/api/app/core` : configuration et connexion PostgreSQL paresseuse.
- `apps/web/src/app` : coque React et état vide explicite.
- PostgreSQL : source de vérité prévue pour raw → staging → analytics.
- Nginx relaie `/api/` vers FastAPI : le navigateur utilise une origine unique.

`/api/v1/health` vérifie le processus ; `/api/v1/ready` exécute `SELECT 1` et renvoie 503 si PostgreSQL est indisponible. Aucun secret ni détail de connexion n'est renvoyé en cas d'échec.

Les schémas raw/staging/analytics sont créés par la révision Alembic 0001. Le service ponctuel `migrate` doit réussir avant le démarrage de l’API ; aucun `create_all` n’est exécuté. Les dossiers métier seront ajoutés avec leur implémentation, sans arborescence vide.

## Décisions à préciser avant les métriques

1. Inspecter le schéma réel d'Oracle's Elixir avant de définir les tables métier.
2. Conserver équipe et rôle au niveau joueur-match pour préserver les changements de roster.
3. Définir précisément les dénominateurs, les valeurs manquantes et la taille des échantillons.
4. Ne pas assimiler le « draft win rate » à un effet causal de la draft.
5. Ne pas afficher de score d'objectifs ou d'early game avant une formule documentée et testée.
6. L'image fournie est une référence artistique ; ses chiffres et son roster ne constituent pas des données.

Le prochain incrément est la configuration Alembic et la première migration ; l'ingestion vient ensuite.
