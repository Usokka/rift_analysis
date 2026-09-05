# Rift Analyst — Blueprint V1

> Plateforme d'analyse de performance esport League of Legends orientée **Data Engineering + Data Analysis**, avec un frontend original inspiré de l'univers fantasy/compétitif de LoL sans reproduire l'interface officielle de Riot.

---

## 1. Vision du projet

### 1.1 Objectif

Construire une plateforme web capable de transformer des données brutes de matchs professionnels League of Legends en insights exploitables par une structure esport : performance d'équipe, performance individuelle, draft, early game, contrôle des objectifs, tendances et scouting.

Le projet doit démontrer trois choses :

1. **Data Engineering** — ingestion, nettoyage, modélisation, stockage, qualité des données, pipelines reproductibles.
2. **Data Analysis** — KPIs, analyses comparatives, tendances, détection des forces/faiblesses et génération d'insights.
3. **Data Product / Fullstack** — exposition des données via API et dashboard web utilisable par un analyste ou un coach.

### 1.2 Cas d'usage portfolio

Le produit doit permettre de produire une étude personnalisée pour une équipe donnée afin de contacter des structures esport avec autre chose qu'un simple CV.

Exemple :

> **Karmine Corp — Performance Review**
>
> Analyse des tendances de performance, de l'early game, des drafts, des objectifs et des joueurs sur un split donné.

### 1.3 Nom de travail

**Rift Analyst**

Tagline possible :

> Same Rift. Smarter Decisions.

---

# 2. Scope V1

La V1 doit être **petite, propre, démontrable et terminable**.

Elle ne doit pas essayer de couvrir tout l'écosystème League of Legends.

## 2.1 La V1 fait

- Import de données de matchs professionnels.
- Stockage des données brutes.
- Nettoyage et normalisation.
- Création d'un modèle analytique PostgreSQL.
- Calcul des KPIs principaux.
- Comparaison équipe vs ligue.
- Comparaison joueur vs rôle/ligue.
- Analyse des drafts.
- Analyse de l'early game.
- Analyse du contrôle des objectifs.
- Dashboard web.
- Filtres par :
  - compétition ;
  - split ;
  - équipe ;
  - joueur ;
  - période ;
  - side ;
  - patch lorsque disponible.

## 2.2 La V1 ne fait pas

- Authentification utilisateur.
- Paiement.
- SaaS multi-tenant.
- Live game analytics.
- Prédiction en temps réel.
- Machine Learning complexe.
- Recommandations de draft automatiques.
- Scraping fragile de dix sites différents.
- Application mobile.
- Chat IA.

Ces fonctionnalités pourront devenir des extensions après une V1 solide.

---

# 3. Sources de données

## 3.1 Source principale — Oracle's Elixir

Oracle's Elixir sert de source principale pour les données professionnelles.

Pourquoi :

- données pensées pour l'esport professionnel ;
- historique de matchs compétitifs ;
- joueurs, équipes et compétitions ;
- métriques de match ;
- données de draft ;
- données early game ;
- objectifs ;
- format adapté à une ingestion batch.

La V1 doit pouvoir fonctionner uniquement avec cette source.

## 3.2 Source secondaire — Riot Games API

La Riot Games API est une extension V1.5/V2.

Usage envisagé :

- enrichissement de données ;
- récupération de matchs supplémentaires ;
- données de timeline ;
- stats détaillées ;
- expérimentation avec `match-v5`.

Important : une clé de développement Riot expire régulièrement et les clés personnelles ont des limites de requêtes. L'architecture doit donc traiter Riot comme une source optionnelle et non comme une dépendance obligatoire pour la V1.

## 3.3 Règle de conception

Chaque source doit être implémentée derrière une interface commune.

Exemple conceptuel :

```python
class MatchDataSource:
    def fetch_matches(self, start_date, end_date): ...
```

Implémentations :

```text
OracleElixirSource
RiotApiSource
```

Cela évite de coupler toute l'application à une seule source.

---

# 4. Architecture générale

```text
                         +-----------------------+
                         |    Oracle's Elixir    |
                         +-----------+-----------+
                                     |
                                     |
                                     v
+----------------+        +-----------------------+
| Riot API       | -----> |     Ingestion Layer   |
| optional V1.5  |        |       Python          |
+----------------+        +-----------+-----------+
                                     |
                                     v
                         +-----------------------+
                         |      RAW STORAGE      |
                         |      PostgreSQL       |
                         +-----------+-----------+
                                     |
                                     v
                         +-----------------------+
                         | Transform / Quality   |
                         | Python + SQL          |
                         +-----------+-----------+
                                     |
                                     v
                         +-----------------------+
                         |   Analytics Schema    |
                         |     PostgreSQL        |
                         +-----------+-----------+
                                     |
                     +---------------+---------------+
                     |                               |
                     v                               v
          +----------------------+        +----------------------+
          | Analytics Service    |        | Backend REST API     |
          | KPIs / comparisons   |        | FastAPI              |
          +----------------------+        +----------+-----------+
                                                   |
                                                   v
                                        +----------------------+
                                        | React / TypeScript   |
                                        | Dashboard            |
                                        +----------------------+
```

---

# 5. Stack technique recommandée

## Data Engineering

- Python 3.12+
- Pandas
- SQLAlchemy
- PostgreSQL
- Alembic
- Pydantic
- HTTPX
- Pytest

## Data Analysis

- Pandas
- NumPy
- SQL
- Jupyter pour exploration uniquement
- SciPy éventuellement

## Backend

- FastAPI
- Pydantic
- SQLAlchemy
- Uvicorn

## Frontend

- React
- TypeScript
- Vite
- TanStack Query
- React Router
- Recharts ou Apache ECharts

## DevOps

- Docker
- Docker Compose
- GitHub Actions
- `.env`
- Makefile ou Taskfile

## Plus tard

- dbt
- Airflow / Prefect
- Redis
- object storage

Ces technologies ne doivent être ajoutées que lorsqu'elles apportent une vraie valeur au projet.

---

# 6. Structure du repository

Monorepo recommandé :

```text
rift-analyst/
│
├── apps/
│   ├── api/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   ├── core/
│   │   │   ├── services/
│   │   │   ├── repositories/
│   │   │   ├── schemas/
│   │   │   └── main.py
│   │   └── tests/
│   │
│   └── web/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   ├── pages/
│       │   ├── hooks/
│       │   ├── lib/
│       │   ├── types/
│       │   └── assets/
│       └── tests/
│
├── data/
│   ├── ingestion/
│   │   ├── sources/
│   │   ├── loaders/
│   │   └── jobs/
│   │
│   ├── transforms/
│   ├── quality/
│   └── analytics/
│
├── notebooks/
│   └── exploration/
│
├── database/
│   ├── migrations/
│   ├── seeds/
│   └── sql/
│
├── scripts/
│
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── metrics.md
│   └── screenshots/
│
├── tests/
│   ├── integration/
│   └── data_quality/
│
├── .github/
│   └── workflows/
│
├── docker-compose.yml
├── Makefile
├── .env.example
├── README.md
└── pyproject.toml
```

---

# 7. Modèle de données

Le projet doit séparer au minimum :

```text
raw
staging
analytics
```

## 7.1 RAW

Les données importées doivent être conservées aussi proches que possible de leur forme source.

Exemple :

```text
raw.oracle_elixir_matches
```

Champs techniques :

```text
source
source_file
loaded_at
row_hash
```

Pourquoi conserver la raw data :

- reproductibilité ;
- debugging ;
- réexécution des transformations ;
- audit ;
- correction de bugs sans retélécharger les données.

---

# 8. Entités métier

## 8.1 Competition

```text
competition_id
name
region
season
split
```

## 8.2 Team

```text
team_id
name
short_name
region
```

## 8.3 Player

```text
player_id
handle
team_id
role
```

Rôles :

```text
TOP
JUNGLE
MID
ADC
SUPPORT
```

## 8.4 Match

```text
match_id
competition_id
date
patch
game_number
duration_seconds
blue_team_id
red_team_id
winner_team_id
```

## 8.5 TeamMatchStats

Une ligne = une équipe dans un match.

```text
match_id
team_id
side
win
kills
deaths
assists
team_gold
first_blood
first_tower
first_dragon
first_herald
first_baron
dragons
heralds
barons
towers
```

## 8.6 PlayerMatchStats

Une ligne = un joueur dans un match.

```text
match_id
player_id
team_id
role
champion
kills
deaths
assists
cs
gold
damage_to_champions
vision_score
wards_placed
wards_cleared
```

## 8.7 DraftPick

```text
match_id
team_id
side
pick_order
champion
player_id
role
```

## 8.8 DraftBan

```text
match_id
team_id
side
ban_order
champion
```

---

# 9. Tables analytiques

Le frontend ne doit pas interroger directement les tables raw.

Créer des vues ou tables analytiques spécialisées.

## 9.1 team_performance_summary

```text
team_id
competition_id
matches_played
wins
losses
win_rate
avg_game_duration
avg_kills
avg_deaths
avg_gold_diff_15
first_blood_rate
first_tower_rate
first_dragon_rate
first_herald_rate
first_baron_rate
objective_control_score
```

## 9.2 player_performance_summary

```text
player_id
team_id
role
matches_played
kda
kill_participation
cs_per_min
gold_per_min
damage_per_min
vision_per_min
avg_gold_diff_15
champion_pool_size
```

## 9.3 team_draft_summary

```text
team_id
champion
pick_count
ban_count
pick_rate
ban_rate
win_rate_when_picked
```

## 9.4 team_side_summary

```text
team_id
side
matches
wins
win_rate
avg_gold_diff_15
objective_control_score
```

## 9.5 team_trend_weekly

```text
team_id
week
matches
win_rate
avg_gold_diff_15
avg_kills
objective_control_score
```

---

# 10. KPIs V1

## 10.1 Team KPIs

Minimum :

- Win Rate
- Average Game Duration
- Kills / Game
- Deaths / Game
- Gold Difference @15
- First Blood Rate
- First Tower Rate
- First Dragon Rate
- First Herald Rate
- First Baron Rate
- Dragons / Game
- Barons / Game
- Towers / Game
- Blue Side Win Rate
- Red Side Win Rate

## 10.2 Player KPIs

- KDA
- Kill Participation
- CS / min
- Gold / min
- Damage / min
- Vision / min
- Gold Difference @15
- Champion Pool Size
- Win Rate

## 10.3 Draft KPIs

- Pick Rate
- Ban Rate
- Pick/Ban Presence
- Champion Win Rate
- Most Picked Champions
- Most Banned Champions
- Draft Diversity

---

# 11. Métriques dérivées

## 11.1 KDA

```text
(Kills + Assists) / max(1, Deaths)
```

## 11.2 Kill Participation

```text
(Kills + Assists) / Team Kills
```

## 11.3 Objective Control Score

Créer un score maison simple et transparent.

Exemple V1 :

```text
Objective Control Score =
    0.20 * First Dragon
  + 0.15 * First Herald
  + 0.20 * First Baron
  + 0.20 * Dragon Control
  + 0.15 * Baron Control
  + 0.10 * Tower Control
```

Toutes les composantes doivent être ramenées sur une échelle 0-100.

Important : documenter la formule dans `docs/metrics.md`.

## 11.4 Early Game Score

Version V1 :

```text
Early Game Score =
    normalized(Gold Diff @15)
  + First Blood
  + First Tower
  + First Herald
```

Ne pas créer un score opaque.

---

# 12. Analyse comparative

Un nombre seul n'est pas un insight.

Chaque KPI important doit pouvoir être comparé avec :

- moyenne de la ligue ;
- split précédent ;
- N derniers matchs ;
- même rôle ;
- même side.

Exemple :

```text
Gold Diff @15
KC       +1 237
LEC avg    +84
Delta    +1 153
```

Le dashboard doit privilégier ce type de lecture.

---

# 13. Insight Engine V1

Pas de LLM nécessaire.

Créer un moteur déterministe basé sur des règles.

Exemple :

```python
if team.gold_diff_15 > league.gold_diff_15 + threshold:
    insight = "Strong early-game gold generation"
```

Exemples d'insights :

- Strong early-game performance.
- High First Herald conversion.
- Weak Red Side performance.
- Strong objective control.
- High reliance on a small champion pool.
- Leads frequently fail to convert into wins.

Les insights doivent être :

- expliquables ;
- basés sur des données ;
- accompagnés du KPI responsable.

---

# 14. API REST

Base :

```text
/api/v1
```

## 14.1 Metadata

```http
GET /competitions
GET /teams
GET /players
```

## 14.2 Overview

```http
GET /teams/{teamId}/overview
```

Query params :

```text
competitionId
split
startDate
endDate
```

Réponse :

```json
{
  "team": {},
  "filters": {},
  "metrics": {},
  "leagueComparison": {},
  "recentTrend": [],
  "insights": []
}
```

## 14.3 Players

```http
GET /teams/{teamId}/players
GET /players/{playerId}/performance
```

## 14.4 Draft

```http
GET /teams/{teamId}/draft
```

## 14.5 Trends

```http
GET /teams/{teamId}/trends
```

## 14.6 Matches

```http
GET /teams/{teamId}/matches
GET /matches/{matchId}
```

---

# 15. Frontend — direction artistique

L'objectif n'est PAS de produire un dashboard SaaS générique.

## 15.1 Direction

L'interface doit évoquer :

- stratégie ;
- compétition ;
- fantasy ;
- cartes tactiques ;
- manuscrits / codex ;
- métal gravé ;
- encre ;
- éléments dessinés à la main.

## 15.2 À éviter absolument

- glassmorphism ;
- énormes border-radius ;
- cartes flottantes partout ;
- gradient violet/rose générique ;
- glow néon permanent ;
- shadows excessives ;
- faux rendu 3D ;
- composants qui ressemblent à un template AI SaaS.

## 15.3 Important — propriété intellectuelle Riot

L'interface peut reprendre une **ambiance fantasy compétitive**, mais ne doit pas copier fidèlement le client League of Legends ou une interface Riot existante.

Créer :

- notre propre iconographie ;
- nos propres bordures ;
- notre propre logo ;
- nos propres textures ;
- notre propre système visuel.

Éviter d'utiliser des assets Riot non autorisés dans le produit final.

---

# 16. Design System

## Couleurs

Base :

```text
Ink Navy      #07141D
Deep Navy     #0B202B
Muted Teal    #123A43
Antique Gold  #C89B3C
Warm Gold     #E4C46B
Parchment     #E7D8B5
Ink Black     #171717
Positive      #4F9A77
Negative      #A9544D
```

Ces valeurs sont un point de départ, pas un contrat strict.

## Typographie

Deux familles maximum :

- titres : serif éditoriale / fantasy élégante ;
- UI et chiffres : sans-serif très lisible.

Exemples libres :

```text
Cinzel / Cormorant Garamond / Libre Baskerville
Inter / Source Sans / IBM Plex Sans
```

## Formes

Préférer :

- angles ;
- cadres dessinés ;
- séparateurs fins ;
- ornements ponctuels ;
- médaillons ;
- panneaux type carte / parchemin.

---

# 17. Pages frontend V1

Navigation principale :

```text
Overview
Team
Players
Draft
Trends
Scouting
```

Scouting peut être présent visuellement mais marqué `Coming soon` en V1.

---

# 18. Page Overview

C'est la page principale de démonstration.

## Bloc 1 — Header

Afficher :

```text
Karmine Corp
Performance Review
LEC 2026
```

Filtres :

```text
Competition
Split
Period
```

## Bloc 2 — Key Metrics

3 métriques majeures :

```text
Win Rate
Gold Diff @15
Objective Control
```

Chaque métrique affiche :

- valeur ;
- delta vs league average ;
- delta vs période précédente.

## Bloc 3 — Roster

5 joueurs.

Afficher :

```text
Role
Player
KDA
Gold Diff @15
Kill Participation
```

## Bloc 4 — Draft Snapshot

Afficher :

- top picks ;
- top bans ;
- draft win rate ;
- champion diversity.

## Bloc 5 — Trends

Graphiques :

```text
Win Rate over time
Gold Difference @15 over time
```

## Bloc 6 — Analyst Notes

3 insights automatiques maximum :

```text
Strength
Watch
Weakness
```

---

# 19. Page Team

Sections :

## Early Game

- GD@15
- First Blood
- First Tower
- First Herald

## Objectives

- Dragons
- Barons
- Towers

## Sides

Comparaison :

```text
Blue Side vs Red Side
```

## Conversion

Exemple d'analyse :

```text
Win rate when ahead @15
Win rate when behind @15
```

Cette métrique est particulièrement intéressante pour un analyste.

---

# 20. Page Players

## Vue roster

5 joueurs.

Cliquer sur un joueur ouvre sa page.

## Player Detail

Afficher :

- KDA
- KP
- CS/min
- Gold/min
- Damage/min
- Vision/min
- GD@15
- Win Rate

## Champion Pool

Pour chaque champion :

```text
Games
Win Rate
KDA
Pick Share
```

## Comparison

Comparer le joueur à la moyenne de son rôle dans la ligue.

Exemple :

```text
Caliste vs LEC ADC average
```

---

# 21. Page Draft

## Pick/Ban Presence

Table :

```text
Champion
Picks
Bans
Presence
Win Rate
```

## Favorite Picks

## Most Banned Against

## Draft Diversity

Nombre de champions uniques utilisés.

## Draft evolution

Évolution du pool entre plusieurs semaines.

---

# 22. Page Trends

Graphiques :

- win rate ;
- gold diff @15 ;
- kills ;
- deaths ;
- objective score ;
- first objective rates.

Granularité :

```text
week
```

Le but est de voir si une équipe progresse ou régresse.

---

# 23. Scouting — V2

Ne pas implémenter dans la première version.

Prévoir l'architecture pour permettre plus tard :

```text
Team A vs Team B
```

Comparaisons :

- early game ;
- objective control ;
- champion pools ;
- draft priorities ;
- side performance ;
- joueurs par rôle.

---

# 24. Pipeline Data Engineering

## Étape 1 — Extract

Commande :

```bash
make ingest
```

Le job :

1. récupère la source ;
2. valide le format ;
3. calcule un checksum ;
4. conserve les données brutes ;
5. enregistre le run d'ingestion.

## Étape 2 — Load RAW

Insertion dans :

```text
raw.oracle_elixir_matches
```

Ne jamais modifier une ligne raw existante silencieusement.

## Étape 3 — Staging

- renommage des colonnes ;
- normalisation des types ;
- conversion dates ;
- nettoyage noms ;
- suppression des doublons ;
- validation side/role ;
- null handling.

## Étape 4 — Core Model

Créer les entités :

```text
competition
team
player
match
team_match_stats
player_match_stats
draft_pick
draft_ban
```

## Étape 5 — Analytics

Calculer les tables/vues destinées au frontend.

---

# 25. Data Quality

Cette partie doit être visible dans le portfolio.

Créer des tests automatiques.

## Contraintes

```text
match_id != NULL
team_id != NULL
player_id != NULL
role IN allowed_roles
side IN ('BLUE', 'RED')
win IN (0, 1)
duration_seconds > 0
```

## Tests relationnels

```text
player.team_id -> team.team_id
team_match_stats.match_id -> match.match_id
player_match_stats.player_id -> player.player_id
```

## Tests métier

Pour chaque match :

```text
exactly 2 teams
exactly 1 winner
5 player rows per team when data is complete
```

Créer un rapport simple :

```text
rows_loaded
rows_rejected
duplicates
null_rates
quality_status
```

---

# 26. Idempotence

Relancer l'ingestion deux fois ne doit pas dupliquer les données.

Utiliser :

- natural key ;
- match id ;
- hash ;
- upsert maîtrisé.

C'est une vraie compétence Data Engineering à montrer.

---

# 27. Observabilité minimale

Chaque pipeline run doit enregistrer :

```text
job_name
started_at
finished_at
status
rows_read
rows_inserted
rows_updated
rows_rejected
error_message
```

Table :

```text
pipeline_runs
```

---

# 28. Backend Architecture

Utiliser une architecture simple :

```text
Route
  ↓
Service
  ↓
Repository
  ↓
Database
```

Éviter la surarchitecture.

## Exemple

```text
TeamOverviewRouter
      ↓
TeamOverviewService
      ↓
TeamAnalyticsRepository
      ↓
PostgreSQL
```

Les calculs complexes doivent être réalisés côté SQL/Data Layer lorsque pertinent, pas recalculés dans React.

---

# 29. Frontend Architecture

Organisation par features :

```text
features/
├── overview/
├── teams/
├── players/
├── draft/
└── trends/
```

Chaque feature contient :

```text
api
components
hooks
types
utils
```

Pas de dossier `components` contenant 150 fichiers sans domaine métier.

---

# 30. Graphiques

Tous les graphiques doivent répondre à une question.

Éviter les graphiques décoratifs.

Exemples :

### Question

> L'équipe progresse-t-elle dans son early game ?

Graphique :

```text
GD@15 par semaine
```

### Question

> L'équipe dépend-elle du Blue Side ?

Graphique :

```text
Win Rate Blue vs Red
```

### Question

> Le champion pool du joueur est-il diversifié ?

Graphique :

```text
games per champion
```

---

# 31. Responsive

Priorité :

```text
Desktop 1440px+
Laptop 1280px
```

Mobile non prioritaire pour V1.

La cible est un outil d'analyse, pas une application consommée principalement sur téléphone.

---

# 32. Docker

`docker-compose.yml` :

```text
postgres
api
web
```

Optionnel :

```text
pgadmin
```

Commande attendue :

```bash
docker compose up
```

Le projet doit pouvoir démarrer localement avec le minimum d'étapes manuelles.

---

# 33. Variables d'environnement

Créer `.env.example`.

Exemple :

```text
DATABASE_URL=
POSTGRES_DB=
POSTGRES_USER=
POSTGRES_PASSWORD=
RIOT_API_KEY=
CORS_ORIGINS=
```

Jamais de secret dans Git.

---

# 34. GitHub Actions

Pipeline minimum :

```text
Install
Lint
Type check
Tests
Build
```

Backend :

```text
ruff
pytest
```

Frontend :

```text
eslint
tsc
npm build
```

Ajouter éventuellement un test d'intégration PostgreSQL.

---

# 35. Seed / Demo Data

Le repository doit pouvoir charger un dataset de démonstration.

Commande :

```bash
make seed-demo
```

Le frontend doit ensuite afficher immédiatement une équipe préconfigurée.

C'est essentiel pour que quelqu'un qui clone le repo puisse comprendre le projet rapidement.

---

# 36. README final

Le README GitHub doit contenir :

1. Screenshot hero.
2. Pitch en 3 lignes.
3. Features.
4. Architecture diagram.
5. Data pipeline.
6. KPIs.
7. Stack.
8. Installation.
9. Demo.
10. Screenshots.
11. Data sources.
12. Limitations.
13. Roadmap.

Le README est une partie du produit.

---

# 37. Roadmap de développement

## Phase 0 — Bootstrap

Objectif : repository propre.

- monorepo ;
- backend FastAPI ;
- frontend React ;
- PostgreSQL ;
- Docker Compose ;
- lint ;
- tests ;
- `.env.example` ;
- README initial.

### Done lorsque

```bash
docker compose up
```

lance DB + backend + frontend.

---

# 38. Phase 1 — Data ingestion

- téléchargement/import Oracle's Elixir ;
- raw table ;
- pipeline run table ;
- idempotence ;
- logging ;
- tests ingestion.

### Done lorsque

On peut lancer :

```bash
make ingest
```

et charger plusieurs milliers de lignes sans doublon.

---

# 39. Phase 2 — Data model

Créer :

```text
competition
team
player
match
team_match_stats
player_match_stats
draft_pick
draft_ban
```

### Done lorsque

Une requête SQL permet de récupérer tous les matchs d'une équipe proprement.

---

# 40. Phase 3 — Analytics

Implémenter :

- team KPIs ;
- player KPIs ;
- draft KPIs ;
- side comparison ;
- trends ;
- league benchmark.

### Done lorsque

Une requête permet de produire une fiche complète de performance d'équipe.

---

# 41. Phase 4 — REST API

Endpoints :

```text
/competitions
/teams
/teams/:id/overview
/teams/:id/players
/teams/:id/draft
/teams/:id/trends
```

### Done lorsque

Swagger permet de parcourir toutes les données nécessaires au frontend.

---

# 42. Phase 5 — Frontend shell

Créer :

- sidebar ;
- header ;
- routing ;
- filters ;
- design tokens ;
- typography ;
- layout.

Aucune fake metric hardcodée dans le résultat final.

---

# 43. Phase 6 — Overview

Implémenter la page principale :

- Key Metrics ;
- roster ;
- draft snapshot ;
- trends ;
- insights.

C'est la première vraie version montrable.

---

# 44. Phase 7 — Team + Players

Créer les pages détaillées.

---

# 45. Phase 8 — Draft + Trends

Créer les pages analytiques spécialisées.

---

# 46. Phase 9 — Polish

- loading states ;
- empty states ;
- error states ;
- tooltips ;
- responsive laptop ;
- performance ;
- accessibility ;
- screenshots ;
- README.

---

# 47. Phase 10 — Portfolio release

Créer une étude réelle.

Exemple :

```text
Karmine Corp — LEC Performance Review
```

Produire :

- URL publique ;
- README ;
- 3 screenshots ;
- courte vidéo/GIF ;
- post LinkedIn ;
- message de prospection.

---

# 48. V1 — Definition of Done

La V1 est terminée lorsque :

- données réelles importées ;
- pipeline reproductible ;
- PostgreSQL normalisé ;
- tests qualité ;
- API documentée ;
- frontend connecté à l'API ;
- Overview fonctionnelle ;
- Team fonctionnelle ;
- Players fonctionnelle ;
- Draft fonctionnelle ;
- Trends fonctionnelle ;
- filtres fonctionnels ;
- aucun KPI principal hardcodé ;
- Docker fonctionne ;
- CI passe ;
- README propre ;
- démo déployée.

---

# 49. V2 potentielle

Une fois V1 terminée seulement.

## Riot API enrichment

Ajouter `match-v5` et éventuellement les timelines.

## Scouting

Comparaison de deux équipes.

## Match explorer

Analyse d'une game précise.

## Lead conversion

Détecter :

```text
lead @15 -> win
lead @15 -> loss
behind @15 -> comeback
```

## Champion synergy

Analyse duo/trio.

## Patch analysis

Comparer performance avant/après patch.

## Automated report

Export PDF d'une fiche équipe.

---

# 50. V3 potentielle — Advanced Analytics

Uniquement après avoir un dataset suffisamment fiable.

Idées :

- clustering de styles d'équipe ;
- player similarity ;
- champion pool similarity ;
- draft embeddings ;
- win probability ;
- anomaly detection ;
- opponent tendencies ;
- recommendation engine.

Ne pas commencer par ces features.

---

# 51. Questions analytiques auxquelles le produit doit répondre

Le produit est réussi s'il permet de répondre rapidement à des questions comme :

### Team

- Cette équipe est-elle forte en early game ?
- Convertit-elle ses leads ?
- Est-elle meilleure Blue ou Red Side ?
- Contrôle-t-elle bien les objectifs ?
- Sur quelles semaines a-t-elle progressé ?

### Player

- Qui génère le plus de lead en lane ?
- Qui participe le plus aux kills ?
- Quel joueur a le champion pool le plus large ?
- Comment un joueur se compare-t-il à son rôle dans la ligue ?

### Draft

- Quels champions sont prioritaires ?
- Quels champions sont systématiquement bannis contre l'équipe ?
- L'équipe gagne-t-elle avec ses picks prioritaires ?
- Son draft est-elle prévisible ?

---

# 52. Principes de vibe coding

L'IA peut générer beaucoup de code, mais elle doit respecter quelques règles.

## Rule 1

Ne pas coder une feature sans savoir quelle donnée elle utilise.

## Rule 2

Ne jamais inventer un champ de dataset.

Toujours vérifier le schéma réel.

## Rule 3

Ne pas mettre les règles métier dans les composants React.

## Rule 4

Ne pas dupliquer les calculs entre backend et frontend.

## Rule 5

Tout KPI doit avoir :

```text
name
definition
formula
source
unit
```

## Rule 6

Toute transformation importante doit être testable.

## Rule 7

Pas d'architecture enterprise inutile.

## Rule 8

Chaque phase doit produire quelque chose de runnable.

---

# 53. Convention de commits

```text
feat:
fix:
refactor:
data:
test:
docs:
chore:
```

Exemples :

```text
feat: add team overview endpoint
data: add oracle elixir ingestion pipeline
fix: prevent duplicate match ingestion
```

---

# 54. Branch strategy

Simple :

```text
main
feature/*
fix/*
```

Pas besoin de GitFlow.

---

# 55. Première série de tickets

## Ticket 001 — Bootstrap monorepo

Créer FastAPI + React + PostgreSQL + Docker Compose.

## Ticket 002 — Database setup

Ajouter SQLAlchemy + Alembic.

## Ticket 003 — Raw ingestion schema

Créer `raw.oracle_elixir_matches`.

## Ticket 004 — Oracle source adapter

Créer le connecteur d'import.

## Ticket 005 — Idempotent loader

Empêcher les doublons.

## Ticket 006 — Core entities

Créer competition/team/player/match.

## Ticket 007 — Team stats transform

Construire `team_match_stats`.

## Ticket 008 — Player stats transform

Construire `player_match_stats`.

## Ticket 009 — Data quality suite

Ajouter tests structurels et métier.

## Ticket 010 — Team analytics views

Créer les KPIs équipe.

## Ticket 011 — Player analytics views

Créer les KPIs joueurs.

## Ticket 012 — Draft analytics

Créer pick/ban summary.

## Ticket 013 — API metadata

Créer teams/players/competitions endpoints.

## Ticket 014 — API overview

Créer endpoint Overview.

## Ticket 015 — Frontend design system

Créer couleurs, typographie, cadres, layout.

## Ticket 016 — Dashboard shell

Sidebar + header + filters.

## Ticket 017 — Overview metrics

Connecter les Key Metrics.

## Ticket 018 — Roster performance

Connecter les joueurs.

## Ticket 019 — Trends charts

Créer graphiques.

## Ticket 020 — Draft snapshot

Créer section draft.

## Ticket 021 — Insight engine

Créer règles simples.

## Ticket 022 — README + screenshots

Préparer présentation portfolio.

---

# 56. Prompt de démarrage pour l'agent de code

Copier ce bloc lors du premier passage dans ChatGPT Work / Codex :

```text
You are implementing Rift Analyst, an esports League of Legends analytics platform.

Read RIFT_ANALYST_PLAN.md completely before modifying the repository.

The application must demonstrate Data Engineering + Data Analysis + Data Product engineering.

Core principles:
- Oracle's Elixir is the primary V1 data source.
- PostgreSQL is the analytical source of truth.
- Raw data must be preserved.
- Ingestion must be idempotent.
- Business metrics must be documented and tested.
- React must never contain authoritative metric calculations.
- Do not invent dataset fields: inspect the real source schema first.
- Prefer simple architecture over unnecessary abstractions.
- Every implementation phase must leave the project runnable.
- Do not add ML, authentication, payments, or unrelated infrastructure in V1.
- The frontend must be original and fantasy/competitive in spirit, but must not reproduce Riot's game client UI.

Before coding each ticket:
1. inspect the existing repository;
2. explain the intended change briefly;
3. implement the smallest coherent change;
4. add/update tests;
5. run relevant tests and builds;
6. report files changed and any follow-up work.

Start with Ticket 001 only.
```

---

# 57. Pitch CV final visé

Une fois le projet abouti :

> **Rift Analyst — Esports Data Analytics Platform | Python, SQL, PostgreSQL, FastAPI, React, TypeScript**
> Conception d'une plateforme d'analyse de performances League of Legends basée sur un pipeline de collecte, nettoyage, contrôle qualité et modélisation de données de matchs professionnels. Développement de KPIs équipe/joueur, analyses de draft et d'early game, benchmarks par ligue et dashboards interactifs exposés via API REST.

---

# 58. Ce que le projet doit prouver à un recruteur

## Data Engineering

- API/dataset ingestion ;
- Python ;
- PostgreSQL ;
- modélisation ;
- ETL/ELT ;
- idempotence ;
- data quality ;
- CI/CD ;
- Docker.

## Data Analysis

- SQL analytique ;
- Pandas ;
- KPIs ;
- benchmarks ;
- visualisation ;
- interprétation métier ;
- storytelling data.

## Software Engineering

- FastAPI ;
- REST ;
- React ;
- TypeScript ;
- tests ;
- architecture ;
- Git.

## Produit

- comprendre un besoin métier ;
- transformer des données en décision ;
- construire une interface exploitable ;
- présenter un résultat clairement.

---

# 59. Priorité absolue

L'ordre est :

```text
DATA FIABLE
    ↓
METRIQUES FIABLES
    ↓
API PROPRE
    ↓
FRONTEND BEAU
    ↓
FEATURES AVANCEES
```

Jamais l'inverse.

Le dashboard ne doit pas être une jolie façade sur des données fictives.

---

# 60. Première milestone

La première milestone concrète est très simple :

```text
Oracle's Elixir
      ↓
Python ingestion
      ↓
PostgreSQL
      ↓
1 équipe
      ↓
10 KPIs fiables
      ↓
1 endpoint
      ↓
1 page Overview
```

Une fois cette verticale complète fonctionnelle, élargir progressivement le reste du produit.
