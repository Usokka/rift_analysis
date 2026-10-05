import { useEffect, useMemo, useState } from 'react';

import type {
  Metadata,
  MatchSummary,
  MatchDetail,
  MatchBundle,
  Overview,
} from './types';
import {
  OverviewVisuals,
  TeamVisuals,
  PlayerVisuals,
  DraftVisuals,
  TrendVisuals,
  CompareVisuals,
  MatchVisuals,
  MatchDistribution,
} from './Visuals';
type View =
  'overview' | 'compare' | 'team' | 'players' | 'draft' | 'trends' | 'matches';
type LoadState = 'loading' | 'ready' | 'empty' | 'error';

const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';

const views: { id: View; label: string }[] = [
  { id: 'overview', label: 'Vue d’ensemble' },
  { id: 'compare', label: 'Comparer' },
  { id: 'team', label: 'Équipe' },
  { id: 'players', label: 'Joueurs' },
  { id: 'draft', label: 'Draft' },
  { id: 'trends', label: 'Tendances' },
  { id: 'matches', label: 'Matchs' },
];

function analyticsUrl(apiPath: string, demoFile: string) {
  return demoMode ? `${import.meta.env.BASE_URL}demo/${demoFile}` : apiPath;
}

function weekStart(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function duration(value: number | null) {
  if (value === null) return '—';
  const minutes = Math.floor(value / 60);
  return `${minutes}:${String(value % 60).padStart(2, '0')}`;
}

function number(value: number | null, signed = false) {
  if (value === null) return '—';
  const rounded = Math.round(value);
  return `${signed && rounded > 0 ? '+' : ''}${rounded.toLocaleString('fr-FR')}`;
}

function summaryFromDetail(
  match: MatchDetail,
  teamId: string,
): MatchSummary | null {
  const team = match.teams.find((item) => item.team_id === teamId);
  const opponent = match.teams.find((item) => item.team_id !== teamId);
  if (!team || !opponent) return null;
  return {
    game_id: match.game_id,
    played_at: match.played_at,
    split: match.split,
    game_number: match.game_number,
    patch: match.patch,
    duration_seconds: match.duration_seconds,
    team_id: team.team_id,
    team_name: team.team_name,
    opponent_id: opponent.team_id,
    opponent_name: opponent.team_name,
    side: team.side,
    result: team.result,
    kills: team.kills,
    deaths: team.deaths,
    gold_diff_at_15: team.gold_diff_at_15,
  };
}

function MatchExplorer({
  matches,
  detail,
  selectedGameId,
  selectedWeek,
  teamId,
  loading,
  onSelect,
  onClearWeek,
}: {
  matches: MatchSummary[];
  detail: MatchDetail | null;
  selectedGameId: string;
  selectedWeek: string;
  teamId: string;
  loading: boolean;
  onSelect: (gameId: string) => void;
  onClearWeek: () => void;
}) {
  const visibleMatches = selectedWeek
    ? matches.filter((item) => weekStart(item.played_at) === selectedWeek)
    : matches;
  const perspective = detail?.teams.find((item) => item.team_id === teamId);
  return (
    <section>
      <div className="page-heading match-heading">
        <div>
          <p className="eyebrow">Observations traçables</p>
          <h2>Exploration match par match</h2>
          <p>
            Du résultat agrégé aux deux équipes, dix joueurs et actions de draft
            sources.
          </p>
        </div>
        {selectedWeek ? (
          <button className="quiet-button" onClick={onClearWeek}>
            Semaine du {new Date(selectedWeek).toLocaleDateString('fr-FR')} ·
            Tout afficher
          </button>
        ) : null}
      </div>
      {!loading ? <MatchDistribution matches={visibleMatches} /> : null}
      <div className="match-layout">
        <aside className="match-list" aria-label="Liste des matchs">
          <div className="section-heading">
            <h2>Matchs</h2>
            <span>{visibleMatches.length} observations</span>
          </div>
          <div className="match-list-scroll">
            {visibleMatches.map((item) => (
              <button
                key={item.game_id}
                className={selectedGameId === item.game_id ? 'selected' : ''}
                onClick={() => onSelect(item.game_id)}
              >
                <span className={`result-mark ${item.result ? 'win' : 'loss'}`}>
                  {item.result ? 'V' : 'D'}
                </span>
                <span>
                  <strong>
                    {item.team_name} — {item.opponent_name}
                  </strong>
                  <small>
                    {item.played_at
                      ? new Date(item.played_at).toLocaleDateString('fr-FR')
                      : 'Date inconnue'}
                    {' · '}
                    {item.kills ?? '—'}–{item.deaths ?? '—'}
                    {' · '}GD@15 {number(item.gold_diff_at_15, true)}
                  </small>
                </span>
              </button>
            ))}
            {!visibleMatches.length ? (
              <p className="chart-empty">Aucun match pour cette semaine.</p>
            ) : null}
          </div>
        </aside>

        <div className="match-detail" aria-live="polite">
          {loading ? (
            <div className="notice" role="status">
              Chargement du match…
            </div>
          ) : null}
          {!loading && detail ? (
            <>
              <header className="match-context">
                <div>
                  <p className="eyebrow">
                    {detail.league} {detail.year}
                    {detail.split ? ` · ${detail.split}` : ''}
                  </p>
                  <h2>
                    {detail.teams[0].team_name} face à{' '}
                    {detail.teams[1].team_name}
                  </h2>
                </div>
                <dl>
                  <div>
                    <dt>Date</dt>
                    <dd>
                      {detail.played_at
                        ? new Date(detail.played_at).toLocaleDateString('fr-FR')
                        : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt>Patch</dt>
                    <dd>{detail.patch ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>Durée</dt>
                    <dd>{duration(detail.duration_seconds)}</dd>
                  </div>
                </dl>
              </header>

              <div className="scoreboard">
                {detail.teams.map((team) => (
                  <article
                    key={team.team_id}
                    className={team.team_id === teamId ? 'focus-team' : ''}
                  >
                    <p className="eyebrow">
                      {team.side === 'BLUE' ? 'Côté bleu' : 'Côté rouge'}
                    </p>
                    <h3>{team.team_name}</h3>
                    <strong>
                      {team.kills ?? '—'} <span>kills</span>
                    </strong>
                    <p className={team.result ? 'win-text' : 'loss-text'}>
                      {team.result ? 'Victoire' : 'Défaite'}
                    </p>
                    <dl>
                      <div>
                        <dt>GD@15</dt>
                        <dd>{number(team.gold_diff_at_15, true)}</dd>
                      </div>
                      <div>
                        <dt>Tours</dt>
                        <dd>{team.towers ?? '—'}</dd>
                      </div>
                      <div>
                        <dt>Dragons</dt>
                        <dd>{team.dragons ?? '—'}</dd>
                      </div>
                      <div>
                        <dt>Barons</dt>
                        <dd>{team.barons ?? '—'}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>

              {perspective ? (
                <div className="match-reading">
                  <p className="eyebrow">
                    Lecture descriptive · {perspective.team_name}
                  </p>
                  <p>{perspective.reading}</p>
                </div>
              ) : null}

              <MatchVisuals detail={detail} />

              <div className="draft-detail panel">
                <div className="section-heading">
                  <h2>Draft normalisée</h2>
                  <span>Picks et bans par côté</span>
                </div>
                <div className="draft-sides">
                  {detail.teams.map((team) => {
                    const actions = detail.draft.filter(
                      (item) => item.team_id === team.team_id,
                    );
                    return (
                      <article key={team.team_id}>
                        <h3>{team.team_name}</h3>
                        <p>
                          <span>Picks</span>
                          {actions
                            .filter((item) => item.action_type === 'PICK')
                            .map((item) => item.champion)
                            .join(' · ') || '—'}
                        </p>
                        <p>
                          <span>Bans</span>
                          {actions
                            .filter((item) => item.action_type === 'BAN')
                            .map((item) => item.champion)
                            .join(' · ') || '—'}
                        </p>
                      </article>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function csvCell(value: string | number) {
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function exportReport(primary: Overview, comparison: Overview | null) {
  const selected = comparison ? [primary, comparison] : [primary];
  const rows: (string | number)[][] = [
    [
      'ligue',
      'saison',
      'équipe',
      'kpi',
      'libellé',
      'valeur',
      'unité',
      'benchmark_ligue',
      'échantillon',
      'éligibles',
    ],
  ];
  for (const overview of selected) {
    for (const item of overview.team_metrics) {
      rows.push([
        overview.filters.league,
        overview.filters.year,
        overview.filters.team_name,
        item.id,
        item.label,
        item.value ?? '',
        item.unit,
        item.benchmark ?? '',
        item.sample_size,
        item.eligible_sample_size,
      ]);
    }
  }
  const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(';')).join('\n')}\n`;
  const names = selected.map((item) => item.filters.team_name).join('-vs-');
  return {
    href: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
    filename: `rift-analyst-${names.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.csv`,
  };
}

export function App() {
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [comparison, setComparison] = useState<Overview | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [view, setView] = useState<View>('overview');
  const [leagueKey, setLeagueKey] = useState('');
  const [teamId, setTeamId] = useState('');
  const [comparisonTeamId, setComparisonTeamId] = useState('');
  const [split, setSplit] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [matchSummaries, setMatchSummaries] = useState<MatchSummary[]>([]);
  const [demoMatchDetails, setDemoMatchDetails] = useState<MatchDetail[]>([]);
  const [selectedGameId, setSelectedGameId] = useState('');
  const [selectedMatch, setSelectedMatch] = useState<MatchDetail | null>(null);
  const [selectedWeek, setSelectedWeek] = useState('');
  const [matchesLoading, setMatchesLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(analyticsUrl('/api/v1/analytics/metadata', 'metadata.json'), {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('metadata unavailable');
        return (await response.json()) as Metadata;
      })
      .then((body) => {
        setMetadata(body);
        if (!body.leagues.length) {
          setState('empty');
          return;
        }
        const initial = body.default_selection ?? body.leagues[0];
        setLeagueKey(`${initial.year}|${initial.league}`);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          setState('error');
      });
    return () => controller.abort();
  }, [attempt]);

  const [yearText, league = ''] = leagueKey.split('|');
  const year = Number(yearText);
  const teams = useMemo(
    () =>
      metadata?.teams.filter(
        (team) => team.year === year && team.league === league,
      ) ?? [],
    [metadata, year, league],
  );
  const splits = useMemo(
    () =>
      metadata?.splits.filter(
        (item) => item.year === year && item.league === league,
      ) ?? [],
    [metadata, year, league],
  );

  useEffect(() => {
    if (!teams.length) {
      setTeamId('');
      setComparisonTeamId('');
      return;
    }
    const defaultPrimary = metadata?.default_selection?.team_id;
    const nextPrimary = teams.some((team) => team.team_id === teamId)
      ? teamId
      : (teams.find((team) => team.team_id === defaultPrimary)?.team_id ??
        teams[0].team_id);
    const defaultComparison = metadata?.default_selection?.comparison_team_id;
    const nextComparison = teams.some(
      (team) =>
        team.team_id === comparisonTeamId && team.team_id !== nextPrimary,
    )
      ? comparisonTeamId
      : (teams.find(
          (team) =>
            team.team_id === defaultComparison && team.team_id !== nextPrimary,
        )?.team_id ??
        teams.find((team) => team.team_id !== nextPrimary)?.team_id ??
        '');
    setTeamId(nextPrimary);
    setComparisonTeamId(nextComparison);
    setSplit('');
  }, [comparisonTeamId, metadata, teamId, teams]);

  useEffect(() => {
    if (!league || !year || !teamId) return;
    const controller = new AbortController();
    const loadOverview = async (selectedTeamId: string) => {
      const team = teams.find((item) => item.team_id === selectedTeamId);
      let url: string;
      if (demoMode) {
        url = analyticsUrl('', team?.snapshot ?? 'overview.json');
      } else {
        const params = new URLSearchParams({
          league,
          year: String(year),
          team_id: selectedTeamId,
        });
        if (split) params.set('split', split);
        if (startDate) params.set('start_date', startDate);
        if (endDate) params.set('end_date', endDate);
        url = `/api/v1/analytics/overview?${params}`;
      }
      const response = await fetch(url, { signal: controller.signal });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('overview unavailable');
      return (await response.json()) as Overview;
    };

    setState('loading');
    Promise.all([
      loadOverview(teamId),
      comparisonTeamId && comparisonTeamId !== teamId
        ? loadOverview(comparisonTeamId)
        : Promise.resolve(null),
    ])
      .then(([primaryBody, comparisonBody]) => {
        setOverview(primaryBody);
        setComparison(comparisonBody);
        setState(primaryBody ? 'ready' : 'empty');
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError'))
          setState('error');
      });
    return () => controller.abort();
  }, [
    league,
    year,
    teamId,
    comparisonTeamId,
    split,
    startDate,
    endDate,
    teams,
    attempt,
  ]);

  useEffect(() => {
    if (!league || !year || !teamId || !metadata) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      league,
      year: String(year),
      team_id: teamId,
    });
    if (split) params.set('split', split);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    const leagueMetadata = metadata.leagues.find(
      (item) => item.league === league && item.year === year,
    );
    const url = demoMode
      ? analyticsUrl(
          '',
          leagueMetadata?.match_snapshot ?? `matches/${year}/${league}.json`,
        )
      : `/api/v1/analytics/matches?${params}`;
    setMatchesLoading(true);
    setMatchSummaries([]);
    setSelectedWeek('');
    fetch(url, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('matches unavailable');
        if (demoMode) {
          const bundle = (await response.json()) as MatchBundle;
          const details = bundle.matches.filter((match) =>
            match.teams.some((team) => team.team_id === teamId),
          );
          return {
            summaries: details
              .map((match) => summaryFromDetail(match, teamId))
              .filter((item): item is MatchSummary => item !== null),
            details,
          };
        }
        const body = (await response.json()) as { matches: MatchSummary[] };
        return { summaries: body.matches, details: [] as MatchDetail[] };
      })
      .then(({ summaries, details }) => {
        setMatchSummaries(summaries);
        setDemoMatchDetails(details);
        const initial = summaries[0]?.game_id ?? '';
        setSelectedGameId(initial);
        setSelectedMatch(
          demoMode
            ? (details.find((item) => item.game_id === initial) ?? null)
            : null,
        );
        setMatchesLoading(false);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setMatchSummaries([]);
          setDemoMatchDetails([]);
          setSelectedMatch(null);
          setMatchesLoading(false);
        }
      });
    return () => controller.abort();
  }, [league, year, teamId, split, startDate, endDate, metadata, attempt]);

  useEffect(() => {
    if (!selectedGameId) {
      setSelectedMatch(null);
      return;
    }
    if (demoMode) {
      setSelectedMatch(
        demoMatchDetails.find((item) => item.game_id === selectedGameId) ??
          null,
      );
      return;
    }
    const controller = new AbortController();
    setMatchesLoading(true);
    fetch(
      `/api/v1/analytics/match?${new URLSearchParams({ game_id: selectedGameId })}`,
      {
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error('match unavailable');
        return (await response.json()) as MatchDetail;
      })
      .then((body) => {
        setSelectedMatch(body);
        setMatchesLoading(false);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setSelectedMatch(null);
          setMatchesLoading(false);
        }
      });
    return () => controller.abort();
  }, [selectedGameId, demoMatchDetails]);

  const title =
    view === 'compare' && comparison
      ? `${overview?.filters.team_name ?? ''} vs ${comparison.filters.team_name}`
      : (overview?.filters.team_name ?? 'Performance Review');
  const report = useMemo(
    () => (overview ? exportReport(overview, comparison) : null),
    [overview, comparison],
  );

  return (
    <div className="workspace">
      <a className="skip" href="#main">
        Aller au contenu
      </a>
      <aside className="sidebar" aria-label="Rift Analyst">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ◇
          </span>
          <span>
            RIFT
            <br />
            ANALYST
          </span>
        </div>
        <p className="eyebrow">Data fuels greater teams</p>
        <nav aria-label="Navigation principale">
          {views.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'current' : ''}
              onClick={() => setView(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          ANALYZE
          <br />
          ADAPT
          <br />
          ACHIEVE
        </div>
      </aside>
      <main id="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">LEAGUE OF LEGENDS · ESPORTS</p>
            <h1>{title}</h1>
          </div>
          <div className="top-actions">
            {report ? (
              <a
                className="export-button"
                href={report.href}
                download={report.filename}
              >
                Exporter CSV
              </a>
            ) : null}
            <div className="corpus-count">
              <strong>
                {metadata?.data_status.matches.toLocaleString('fr-FR') ?? '—'}
              </strong>
              <span>matchs vérifiés</span>
            </div>
          </div>
        </header>

        {demoMode ? (
          <aside className="demo-banner">
            <strong>Démo publique interactive</strong>
            <span>
              {metadata?.leagues.length ?? 0} ligues ·{' '}
              {metadata?.teams.length ?? 0} équipes · instantanés calculés sur
              le corpus complet.
            </span>
            <a href="https://github.com/Usokka/rift_analysis">Voir le dépôt</a>
          </aside>
        ) : null}

        {metadata?.leagues.length ? (
          <section
            className={`filters${demoMode ? ' demo-filters' : ''}`}
            aria-label="Filtres d’analyse"
          >
            <label>
              Ligue et saison
              <select
                value={leagueKey}
                onChange={(event) => setLeagueKey(event.target.value)}
              >
                {metadata.leagues.map((item) => (
                  <option
                    key={`${item.year}|${item.league}`}
                    value={`${item.year}|${item.league}`}
                  >
                    {item.league} · {item.year} ({item.matches})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Équipe analysée
              <select
                value={teamId}
                onChange={(event) => setTeamId(event.target.value)}
              >
                {teams.map((team) => (
                  <option key={team.team_id} value={team.team_id}>
                    {team.team_name} ({team.matches})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Comparer à
              <select
                value={comparisonTeamId}
                onChange={(event) => setComparisonTeamId(event.target.value)}
                disabled={teams.length < 2}
              >
                {teams.map((team) => (
                  <option
                    key={team.team_id}
                    value={team.team_id}
                    disabled={team.team_id === teamId}
                  >
                    {team.team_name} ({team.matches})
                  </option>
                ))}
              </select>
            </label>
            {!demoMode ? (
              <>
                <label>
                  Split
                  <select
                    value={split}
                    onChange={(event) => setSplit(event.target.value)}
                  >
                    <option value="">Tous</option>
                    {splits.map((item) => (
                      <option key={item.split} value={item.split}>
                        {item.split}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Du
                  <input
                    type="date"
                    value={startDate}
                    max={endDate || undefined}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </label>
                <label>
                  Au
                  <input
                    type="date"
                    value={endDate}
                    min={startDate || undefined}
                    onChange={(event) => setEndDate(event.target.value)}
                  />
                </label>
              </>
            ) : null}
          </section>
        ) : null}

        {state === 'loading' ? (
          <section className="notice" role="status">
            Calcul du rapport…
          </section>
        ) : null}
        {state === 'error' ? (
          <section className="notice error" role="alert">
            <p>Le rapport n’a pas pu être chargé.</p>
            <button onClick={() => setAttempt((value) => value + 1)}>
              Réessayer
            </button>
          </section>
        ) : null}
        {state === 'empty' ? (
          <section className="notice">
            <h2>Aucune donnée disponible</h2>
            <p>
              Importe un export Oracle’s Elixir avec la commande documentée dans
              le README.
            </p>
          </section>
        ) : null}

        {state === 'ready' && overview ? (
          <>
            {view === 'overview' ? (
              <OverviewVisuals
                overview={overview}
                matches={matchSummaries}
                loading={matchesLoading}
                onMatch={(id) => {
                  setSelectedGameId(id);
                  setSelectedWeek('');
                  setView('matches');
                }}
              />
            ) : null}
            {view === 'compare' ? (
              comparison ? (
                <CompareVisuals primary={overview} comparison={comparison} />
              ) : (
                <section className="notice">
                  Sélectionne une deuxième équipe pour comparer les profils.
                </section>
              )
            ) : null}
            {view === 'team' ? (
              <TeamVisuals
                overview={overview}
                matches={matchSummaries}
                loading={matchesLoading}
              />
            ) : null}
            {view === 'players' ? <PlayerVisuals overview={overview} /> : null}
            {view === 'draft' ? <DraftVisuals overview={overview} /> : null}
            {view === 'trends' ? (
              <TrendVisuals
                overview={overview}
                matches={matchSummaries}
                loading={matchesLoading}
                onWeek={(week) => {
                  const first = matchSummaries.find(
                    (m) => weekStart(m.played_at) === week,
                  );
                  setSelectedWeek(week);
                  if (first) setSelectedGameId(first.game_id);
                  setView('matches');
                }}
                onMatch={(id) => {
                  setSelectedGameId(id);
                  setSelectedWeek('');
                  setView('matches');
                }}
              />
            ) : null}

            {view === 'matches' ? (
              <MatchExplorer
                matches={matchSummaries}
                detail={selectedMatch}
                selectedGameId={selectedGameId}
                selectedWeek={selectedWeek}
                teamId={teamId}
                loading={matchesLoading}
                onSelect={setSelectedGameId}
                onClearWeek={() => setSelectedWeek('')}
              />
            ) : null}
          </>
        ) : null}
        <footer>
          <span>
            Source : Oracle’s Elixir{demoMode ? ' · instantanés statiques' : ''}
          </span>
          <span>Same Rift. Smarter Decisions.</span>
        </footer>
      </main>
    </div>
  );
}
