# Architecture V1

Rift Analyst reste un monorepo simple : un pipeline Python charge PostgreSQL, FastAPI expose les agrégats SQL et React les présente. Le navigateur ne calcule aucune statistique métier.

```text
Export Oracle’s Elixir
        ↓ vérification SHA-256, CSV lu par groupes de matchs
raw.source_files ─ raw.oracle_elixir_rows ─ raw.pipeline_runs
        ↓ validation structurelle et projection transactionnelle
analytics.matches
   ├── analytics.team_match_stats
   ├── analytics.player_match_stats
   └── analytics.draft_actions
        ↓ AnalyticsRepository → AnalyticsService → FastAPI
React : Overview / Compare / Team / Players / Draft / Trends / Matches
```

## Ingestion et idempotence

Chaque fichier est identifié par son SHA-256. Le raw conserve le payload JSONB et son numéro de ligne. Une relance avec le même checksum crée un run `SKIPPED` sans dupliquer les données. Un fichier corrigé obtient une nouvelle entrée raw ; ses matchs remplacent transactionnellement les projections analytiques portant le même `gameid`.

Le lecteur garde un seul groupe de match à la fois et écrit par lots. Le jeu d’identifiants déjà rencontré tient en mémoire pour détecter un `gameid` non contigu. Cette organisation évite de charger un CSV complet dans les 4 Go de RAM de la machine cible.

Un match est projeté s’il contient exactement deux lignes équipe, les côtés BLUE/RED, un seul vainqueur et cinq rôles distincts par côté. Les lignes rejetées restent dans le raw. Les valeurs statistiques absentes restent nulles et sont reflétées dans la couverture de chaque KPI.

Les actions PICK viennent des dix lignes joueurs ; leur `action_slot` représente le rôle normalisé et pas l’ordre réel de sélection. Les BAN viennent une seule fois de chaque ligne équipe. Les taux de draft utilisent les parties marquées complètes.

## API analytique

`GET /api/v1/analytics/metadata` fournit le corpus, les ligues, saisons, splits et équipes. `GET /api/v1/analytics/overview` applique les filtres, agrège 15 KPIs équipe, 9 KPIs par joueur/rôle, 4 KPIs draft par champion et des tendances hebdomadaires. `GET /api/v1/analytics/matches` liste les parties du périmètre et `GET /api/v1/analytics/match` restitue les deux équipes, dix joueurs et actions de draft d’un `gameid` accepté.

Les benchmarks équipe conservent ligue, saison, split et période, puis retirent seulement le filtre équipe. Les pourcentages renvoient des points de pourcentage comme delta. Chaque métrique expose valeur, unité, effectif valide et effectif éligible.

La version GitHub Pages reste statique : le même pipeline génère un catalogue par ligue pour les équipes publiées juste avant le déploiement, sans versionner ces fichiers volumineux. React filtre ces observations sans recalculer les KPIs de référence. La version locale utilise les endpoints PostgreSQL équivalents.

## Exécution

Alembic applique les migrations avant FastAPI. La readiness vérifie les schémas et la révision attendue. PostgreSQL reste privé dans Compose ; Nginx relaie `/api/` sous l’origine du frontend et réévalue l’adresse Docker de l’API après une recréation.

La CI possède trois niveaux : tests et build, démarrage Compose avec migrations et proxy, puis contrôle ponctuel du corpus complet lorsque le titre de PR contient `[full-data]`.
