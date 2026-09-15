# Audit Rift Analyst — 15 septembre 2026

Base inspectée : `main` / `bba0212`, synchronisée avec `Usokka/rift_analysis`. Lecture du code applicatif, configurations, migrations, tests, CI, documents et blueprint. Les lockfiles ont été utilisés pour la vérification de l’environnement ; le projet ne contient pas de pipeline ni de dataset de matchs.

## Où le développement s’était arrêté

Les tickets 001–002 sont livrés : monorepo FastAPI/React, PostgreSQL, contrôle de santé, migrations de trois schémas, Compose et CI. L’interface présente explicitement un état vide. Seuls `/api/v1/health` et `/api/v1/ready` sont implémentés ; aucune route analytique n’existe. Les bases ORM ne définissent encore aucune table métier.

Il ne s’agit pas d’une analyse de 18 000 matchs cassée à réparer : l’ingestion et le calcul n’ont pas encore été implémentés dans ce dépôt. Aucune base personnelle distante n’a été inspectée. La roadmap précise les preuves nécessaires avant d’afficher les chiffres du CV comme résultats terminés.

## Défauts corrigés

| Défaut | Conséquence | Correction / contrôle |
|---|---|---|
| Readiness limitée à SELECT 1 | Une base vide ou obsolète paraît prête, particulièrement hors Compose | Vérifier raw/staging/analytics et la révision attendue ; réponse 503 sinon ; tests PostgreSQL des états incomplets et complets |
| Attentes SQL/pool sans limite dédiée | Une vérification peut attendre longtemps sous contention | pool_timeout et statement_timeout configurés à 3 s, en plus du connect_timeout ; ces limites ne sont pas une deadline réseau totale |
| Autogénération autorisée sur public | Une table externe absente des modèles peut devenir candidate à suppression | Restreindre les schémas gérés aux trois namespaces métier ; test avec table externe dans public |
| Résolution Nginx statique de api | Risque de 502 persistants après changement d’IP du conteneur API | Résolution DNS Docker dynamique ; smoke test après recréation du service API en CI |
| Documentation d’architecture périmée | Proposait de refaire les migrations déjà livrées | Prochain incrément corrigé : inspection source et ingestion |

La révision requise doit évoluer avec les migrations ; un test garantit son égalité à la tête Alembic. La readiness confirme les namespaces et la version, pas chaque table future ni la qualité des données métier.

## Vérification

- Avant correction : `make check` réussit, 5 tests passent et 2 tests PostgreSQL sont ignorés faute de TEST_DATABASE_URL.
- Après correction : Ruff, pytest, ESLint, vérification TypeScript et build Vite exécutés localement. Les tests PostgreSQL et Compose doivent être confirmés par GitHub Actions, car Docker et PostgreSQL ne sont pas disponibles dans cet environnement.
- La CI dispose d’un PostgreSQL 17 vierge, teste les migrations transactionnellement, puis construit et démarre Compose et vérifie le proxy.
- Deux avertissements de dépréciation proviennent des dépendances TestClient ; ils ne bloquent pas les tests. Pas de mise à jour générale des dépendances sans besoin fonctionnel.

## Limites restant à traiter dans les versions data

Pas d’ingestion, pas de tables de matchs, pas de calculs, pas de filtre ligue, pas de dashboard comparatif, pas de démo publique livrée. Ce sont des fonctionnalités à construire, pas des bugs masqués par des chiffres de démonstration.

Voir [ROADMAP](docs/ROADMAP.md) pour les critères de sortie et [metrics](docs/metrics.md) pour les contrats analytiques cibles.

Références techniques consultées : [résolution dynamique Nginx](https://nginx.org/en/docs/http/ngx_http_upstream_module.html#server), [timeouts PostgreSQL](https://www.postgresql.org/docs/17/runtime-config-client.html#RUNTIME-CONFIG-CLIENT-STATEMENT).
