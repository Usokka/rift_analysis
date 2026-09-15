# Architecture — état initial

Les tickets 001–002 fournissent le monorepo, les services locaux, la CI et les migrations Alembic. Le stockage des matchs et les calculs métier ne sont pas encore implémentés.

- `apps/api/app/api` : routes HTTP et contrats de réponse.
- `apps/api/app/core` : configuration et connexion PostgreSQL paresseuse.
- `apps/web/src/app` : coque React et état vide explicite.
- PostgreSQL : source de vérité prévue pour raw → staging → analytics.
- Nginx relaie `/api/` vers FastAPI : le navigateur utilise une origine unique.

`/api/v1/health` vérifie le processus ; `/api/v1/ready` vérifie les trois schémas et la révision Alembic attendue ; une base vide ou obsolète renvoie 503. Les attentes de connexion, de pool et les requêtes SQL ont chacune un délai maximal configuré de 3 secondes (ce ne sont pas une deadline globale). Aucun secret ni détail de connexion n'est renvoyé en cas d'échec.

Les schémas raw/staging/analytics sont créés par la révision Alembic 0001. Le service ponctuel `migrate` doit réussir avant le démarrage de l’API ; aucun `create_all` n’est exécuté. Les dossiers métier seront ajoutés avec leur implémentation, sans arborescence vide.

## Décisions à préciser avant les métriques

1. Inspecter le schéma réel d'Oracle's Elixir avant de définir les tables métier.
2. Conserver équipe et rôle au niveau joueur-match pour préserver les changements de roster.
3. Définir précisément les dénominateurs, les valeurs manquantes et la taille des échantillons.
4. Ne pas assimiler le « draft win rate » à un effet causal de la draft.
5. Ne pas afficher de score d'objectifs ou d'early game avant une formule documentée et testée.
6. L'image fournie est une référence artistique ; ses chiffres et son roster ne constituent pas des données.

Le prochain incrément est l’inspection du dataset puis l’ingestion raw idempotente (tickets 003–005). Voir [la roadmap](ROADMAP.md).

Nginx utilise le DNS Docker pour réévaluer l’adresse de l’API après recréation du conteneur. Alembic ne gère que raw/staging/analytics ; les tables applicatives externes de public sont exclues de l’autogénération.
