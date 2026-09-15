import { useEffect, useMemo, useState } from 'react';

type Metric = {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  sample_size: number;
  eligible_sample_size: number;
  benchmark?: number | null;
  delta?: number | null;
};

type TeamMetadata = {
  team_id: string;
  team_name: string;
  league: string;
  year: number;
  matches: number;
  snapshot?: string;
};

type Metadata = {
  data_status: {
    matches: number;
    raw_rows: number;
    source_files: number;
    rejected_rows: number;
    last_imported_at: string | null;
  };
  leagues: { league: string; year: number; matches: number }[];
  splits: { league: string; year: number; split: string }[];
  teams: TeamMetadata[];
  default_selection?: {
    league: string;
    year: number;
    team_id: string;
    comparison_team_id: string;
  };
};

type Player = { player_id: string; player_name: string; role: string; metrics: Metric[] };
type DraftChampion = { champion: string; metrics: Metric[] };
type Trend = {
  week: string;
  matches: number;
  win_rate: number | null;
  gold_diff_at_15: number | null;
  kills_per_game: number | null;
};
type Overview = {
  filters: {
    league: string;
    year: number;
    team_id: string;
    team_name: string;
    split: string | null;
  };
  team_metrics: Metric[];
  players: Player[];
  draft: DraftChampion[];
  trends: Trend[];
};
type View = 'overview' | 'compare' | 'team' | 'players' | 'draft' | 'trends';
type LoadState = 'loading' | 'ready' | 'empty' | 'error';

type Insight = {
  metricId: string;
  label: string;
  primaryValue: string;
  comparisonValue: string;
  score: number;
};

const demoMode = import.meta.env.VITE_DEMO_MODE === 'true';

const views: { id: View; label: string }[] = [
  { id: 'overview', label: 'Vue d’ensemble' },
  { id: 'compare', label: 'Comparer' },
  { id: 'team', label: 'Équipe' },
  { id: 'players', label: 'Joueurs' },
  { id: 'draft', label: 'Draft' },
  { id: 'trends', label: 'Tendances' },
];

const insightSpecs = [
  { id: 'T01', direction: 1, scale: 10 },
  { id: 'T05', direction: 1, scale: 500 },
  { id: 'T07', direction: 1, scale: 10 },
  { id: 'T08', direction: 1, scale: 10 },
  { id: 'T10', direction: 1, scale: 10 },
  { id: 'T03', direction: 1, scale: 2 },
  { id: 'T04', direction: -1, scale: 2 },
];

function analyticsUrl(apiPath: string, demoFile: string) {
  return demoMode ? `${import.meta.env.BASE_URL}demo/${demoFile}` : apiPath;
}

function metric(metrics: Metric[], id: string) {
  return metrics.find((item) => item.id === id);
}

function formatValue(item?: Metric, compact = false) {
  if (!item || item.value === null) return '—';
  if (item.unit === '%') return `${item.value.toFixed(1)} %`;
  if (item.unit === 'or') {
    return `${item.value >= 0 ? '+' : ''}${Math.round(item.value).toLocaleString('fr-FR')}`;
  }
  if (item.unit === 'champions') return Math.round(item.value).toString();
  const digits = compact ? 1 : 2;
  return item.value.toFixed(digits);
}

function formatGap(primary?: Metric, comparison?: Metric) {
  if (primary?.value === null || comparison?.value === null || !primary || !comparison) return '—';
  const value = primary.value - comparison.value;
  const sign = value > 0 ? '+' : '';
  if (primary.unit === '%') return `${sign}${value.toFixed(1)} pts`;
  if (primary.unit === 'or') return `${sign}${Math.round(value).toLocaleString('fr-FR')}`;
  return `${sign}${value.toFixed(1)}`;
}

function MetricBlock({ item, prominent = false }: { item?: Metric; prominent?: boolean }) {
  if (!item) return null;
  const coverage = item.eligible_sample_size
    ? Math.round((item.sample_size / item.eligible_sample_size) * 100)
    : 0;
  return (
    <article className={`metric-block${prominent ? ' prominent' : ''}`}>
      <p className="metric-code">{item.id}</p>
      <h3>{item.label}</h3>
      <strong>{formatValue(item, true)}</strong>
      <div className="metric-meta">
        {item.benchmark !== undefined && item.benchmark !== null ? (
          <span>
            Ligue {formatValue({ ...item, value: item.benchmark }, true)} · écart{' '}
            {item.delta !== null && item.delta !== undefined
              ? `${item.delta >= 0 ? '+' : ''}${item.delta.toFixed(1)}`
              : '—'}
          </span>
        ) : null}
        <span>
          {item.sample_size}/{item.eligible_sample_size} matchs · {coverage}% couverts
        </span>
      </div>
    </article>
  );
}

function TrendChart({ points }: { points: Trend[] }) {
  const values = points
    .map((point) => point.gold_diff_at_15)
    .filter((value): value is number => value !== null);
  if (points.length < 2 || values.length < 2) {
    return <p className="chart-empty">Pas assez de semaines avec une mesure GD@15.</p>;
  }
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const coords = points
    .map((point, index) => {
      if (point.gold_diff_at_15 === null) return null;
      const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
      const y = 92 - ((point.gold_diff_at_15 - min) / range) * 82;
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(' ');
  const zeroY = 92 - ((0 - min) / range) * 82;
  return (
    <div className="chart" aria-label="Évolution hebdomadaire de la différence d’or à 15 minutes">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img">
        <line x1="0" y1={zeroY} x2="100" y2={zeroY} className="zero-line" />
        <polyline points={coords} className="trend-line" />
      </svg>
      <div className="chart-scale">
        <span>{Math.round(max).toLocaleString('fr-FR')}</span>
        <span>0</span>
        <span>{Math.round(min).toLocaleString('fr-FR')}</span>
      </div>
      <div className="chart-dates">
        <span>{new Date(points[0].week).toLocaleDateString('fr-FR')}</span>
        <span>{new Date(points.at(-1)!.week).toLocaleDateString('fr-FR')}</span>
      </div>
    </div>
  );
}

function comparisonInsights(primary: Overview, comparison: Overview) {
  const insights: Insight[] = [];
  for (const spec of insightSpecs) {
    const primaryMetric = metric(primary.team_metrics, spec.id);
    const comparisonMetric = metric(comparison.team_metrics, spec.id);
    if (primaryMetric?.value === null || comparisonMetric?.value === null) continue;
    if (!primaryMetric || !comparisonMetric) continue;
    insights.push({
      metricId: spec.id,
      label: primaryMetric.label,
      primaryValue: formatValue(primaryMetric, true),
      comparisonValue: formatValue(comparisonMetric, true),
      score: ((primaryMetric.value - comparisonMetric.value) * spec.direction) / spec.scale,
    });
  }
  return {
    primary: insights.filter((item) => item.score > 0).sort((a, b) => b.score - a.score).slice(0, 2),
    comparison: insights
      .filter((item) => item.score < 0)
      .sort((a, b) => a.score - b.score)
      .slice(0, 2),
  };
}

function TeamSummary({ overview }: { overview: Overview }) {
  return (
    <article className="team-summary">
      <p className="eyebrow">{overview.filters.league} {overview.filters.year}</p>
      <h3>{overview.filters.team_name}</h3>
      <span>{metric(overview.team_metrics, 'T01')?.eligible_sample_size ?? 0} matchs</span>
      <dl>
        <div><dt>Win rate</dt><dd>{formatValue(metric(overview.team_metrics, 'T01'), true)}</dd></div>
        <div><dt>GD@15</dt><dd>{formatValue(metric(overview.team_metrics, 'T05'), true)}</dd></div>
        <div><dt>Premier dragon</dt><dd>{formatValue(metric(overview.team_metrics, 'T08'), true)}</dd></div>
      </dl>
    </article>
  );
}

function InsightCard({ teamName, insights }: { teamName: string; insights: Insight[] }) {
  return (
    <article className="insight-card">
      <p className="eyebrow">Avantages descriptifs</p>
      <h3>{teamName}</h3>
      {insights.length ? (
        <ul>
          {insights.map((item) => (
            <li key={item.metricId}>
              <strong>{item.label}</strong>
              <span>{item.primaryValue} contre {item.comparisonValue}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Aucun écart net sur les indicateurs retenus.</p>
      )}
    </article>
  );
}

function ComparisonView({ primary, comparison }: { primary: Overview; comparison: Overview }) {
  const insights = comparisonInsights(primary, comparison);
  return (
    <section>
      <div className="page-heading compare-heading">
        <p className="eyebrow">Même ligue · même saison · même périmètre</p>
        <h2>{primary.filters.team_name} face à {comparison.filters.team_name}</h2>
        <p>Les écarts restent descriptifs et affichent leurs échantillons réels.</p>
      </div>
      <div className="comparison-summaries">
        <TeamSummary overview={primary} />
        <div className="versus" aria-hidden="true">VS</div>
        <TeamSummary overview={comparison} />
      </div>
      <div className="comparison-insights panel">
        <div className="section-heading">
          <h2>Lecture automatique</h2>
          <span>7 signaux contrôlés</span>
        </div>
        <div className="insight-grid">
          <InsightCard teamName={primary.filters.team_name} insights={insights.primary} />
          <InsightCard
            teamName={comparison.filters.team_name}
            insights={insights.comparison.map((item) => ({
              ...item,
              primaryValue: item.comparisonValue,
              comparisonValue: item.primaryValue,
            }))}
          />
        </div>
        <p className="method-note">Les signaux comparent les résultats, l’early game, les objectifs et le rythme offensif. Ils ne prouvent pas de lien causal.</p>
      </div>
      <div className="table-wrap comparison-table">
        <table>
          <thead><tr><th>KPI</th><th>{primary.filters.team_name}</th><th>{comparison.filters.team_name}</th><th>Écart A − B</th><th>Échantillons</th></tr></thead>
          <tbody>
            {primary.team_metrics.map((item) => {
              const compared = metric(comparison.team_metrics, item.id);
              return (
                <tr key={item.id}>
                  <th><span className="metric-code">{item.id}</span>{item.label}</th>
                  <td>{formatValue(item, true)}</td>
                  <td>{formatValue(compared, true)}</td>
                  <td>{formatGap(item, compared)}</td>
                  <td>{item.sample_size} / {compared?.sample_size ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
    ['ligue', 'saison', 'équipe', 'kpi', 'libellé', 'valeur', 'unité', 'benchmark_ligue', 'échantillon', 'éligibles'],
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
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const names = selected.map((item) => item.filters.team_name).join('-vs-');
  link.href = url;
  link.download = `rift-analyst-${names.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
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

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    fetch(analyticsUrl('/api/v1/analytics/metadata', 'metadata.json'), { signal: controller.signal })
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
        if (!(error instanceof DOMException && error.name === 'AbortError')) setState('error');
      });
    return () => controller.abort();
  }, [attempt]);

  const [yearText, league = ''] = leagueKey.split('|');
  const year = Number(yearText);
  const teams = useMemo(
    () => metadata?.teams.filter((team) => team.year === year && team.league === league) ?? [],
    [metadata, year, league],
  );
  const splits = useMemo(
    () => metadata?.splits.filter((item) => item.year === year && item.league === league) ?? [],
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
      : teams.find((team) => team.team_id === defaultPrimary)?.team_id ?? teams[0].team_id;
    const defaultComparison = metadata?.default_selection?.comparison_team_id;
    const nextComparison = teams.some(
      (team) => team.team_id === comparisonTeamId && team.team_id !== nextPrimary,
    )
      ? comparisonTeamId
      : teams.find(
          (team) => team.team_id === defaultComparison && team.team_id !== nextPrimary,
        )?.team_id ?? teams.find((team) => team.team_id !== nextPrimary)?.team_id ?? '';
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
        const params = new URLSearchParams({ league, year: String(year), team_id: selectedTeamId });
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
        if (!(error instanceof DOMException && error.name === 'AbortError')) setState('error');
      });
    return () => controller.abort();
  }, [league, year, teamId, comparisonTeamId, split, startDate, endDate, teams, attempt]);

  const keyMetrics = overview
    ? ['T01', 'T05', 'T08'].map((id) => metric(overview.team_metrics, id))
    : [];
  const title = view === 'compare' && comparison
    ? `${overview?.filters.team_name ?? ''} vs ${comparison.filters.team_name}`
    : overview?.filters.team_name ?? 'Performance Review';

  return (
    <div className="workspace">
      <a className="skip" href="#main">Aller au contenu</a>
      <aside className="sidebar" aria-label="Rift Analyst">
        <div className="brand"><span className="brand-mark" aria-hidden="true">◇</span><span>RIFT<br />ANALYST</span></div>
        <p className="eyebrow">Data fuels greater teams</p>
        <nav aria-label="Navigation principale">
          {views.map((item) => (
            <button key={item.id} className={view === item.id ? 'current' : ''} onClick={() => setView(item.id)}>{item.label}</button>
          ))}
        </nav>
        <div className="sidebar-foot">ANALYZE<br />ADAPT<br />ACHIEVE</div>
      </aside>
      <main id="main">
        <header className="topbar">
          <div><p className="eyebrow">LEAGUE OF LEGENDS · ESPORTS</p><h1>{title}</h1></div>
          <div className="top-actions">
            <button className="export-button" disabled={!overview} onClick={() => overview && exportReport(overview, comparison)}>Exporter CSV</button>
            <div className="corpus-count"><strong>{metadata?.data_status.matches.toLocaleString('fr-FR') ?? '—'}</strong><span>matchs vérifiés</span></div>
          </div>
        </header>

        {demoMode ? (
          <aside className="demo-banner">
            <strong>Démo publique interactive</strong>
            <span>{metadata?.leagues.length ?? 0} ligues · {metadata?.teams.length ?? 0} équipes · instantanés calculés sur le corpus complet.</span>
            <a href="https://github.com/Usokka/rift_analysis">Voir le dépôt</a>
          </aside>
        ) : null}

        {metadata?.leagues.length ? (
          <section className={`filters${demoMode ? ' demo-filters' : ''}`} aria-label="Filtres d’analyse">
            <label>Ligue et saison<select value={leagueKey} onChange={(event) => setLeagueKey(event.target.value)}>{metadata.leagues.map((item) => <option key={`${item.year}|${item.league}`} value={`${item.year}|${item.league}`}>{item.league} · {item.year} ({item.matches})</option>)}</select></label>
            <label>Équipe analysée<select value={teamId} onChange={(event) => setTeamId(event.target.value)}>{teams.map((team) => <option key={team.team_id} value={team.team_id}>{team.team_name} ({team.matches})</option>)}</select></label>
            <label>Comparer à<select value={comparisonTeamId} onChange={(event) => setComparisonTeamId(event.target.value)} disabled={teams.length < 2}>{teams.map((team) => <option key={team.team_id} value={team.team_id} disabled={team.team_id === teamId}>{team.team_name} ({team.matches})</option>)}</select></label>
            {!demoMode ? <>
              <label>Split<select value={split} onChange={(event) => setSplit(event.target.value)}><option value="">Tous</option>{splits.map((item) => <option key={item.split} value={item.split}>{item.split}</option>)}</select></label>
              <label>Du<input type="date" value={startDate} max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} /></label>
              <label>Au<input type="date" value={endDate} min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} /></label>
            </> : null}
          </section>
        ) : null}

        {state === 'loading' ? <section className="notice" role="status">Calcul du rapport…</section> : null}
        {state === 'error' ? <section className="notice error" role="alert"><p>Le rapport n’a pas pu être chargé.</p><button onClick={() => setAttempt((value) => value + 1)}>Réessayer</button></section> : null}
        {state === 'empty' ? <section className="notice"><h2>Aucune donnée disponible</h2><p>Importe un export Oracle’s Elixir avec la commande documentée dans le README.</p></section> : null}

        {state === 'ready' && overview ? (
          <>
            {view === 'overview' ? <>
              <section className="hero panel"><div><p className="eyebrow">Le carnet de l’analyste</p><h2>Lire les forces.<br /><em>Comparer le contexte.</em></h2><p>{overview.filters.league} {overview.filters.year}{overview.filters.split ? ` · ${overview.filters.split}` : ''}</p></div><div className="hero-mark" aria-hidden="true">◈</div></section>
              <section className="metric-grid major" aria-label="Indicateurs principaux">{keyMetrics.map((item) => <MetricBlock key={item!.id} item={item} prominent />)}</section>
              <section className="panel split-panel"><div><div className="section-heading"><h2>Forme hebdomadaire</h2><span>GD@15</span></div><TrendChart points={overview.trends} /></div><div><div className="section-heading"><h2>Priorités de draft</h2><span>Top 5</span></div><ol className="champion-list">{overview.draft.slice(0, 5).map((item) => <li key={item.champion}><span>{item.champion}</span><strong>{formatValue(metric(item.metrics, 'D03'))}</strong></li>)}</ol></div></section>
              <section className="panel"><div className="section-heading"><h2>Roster observé</h2><span>{overview.players.length} profils joueur/rôle</span></div><div className="roster">{overview.players.slice(0, 10).map((player) => <article key={`${player.player_id}-${player.role}`}><span>{player.role}</span><h3>{player.player_name}</h3><p>KDA {formatValue(metric(player.metrics, 'P01'))} · KP {formatValue(metric(player.metrics, 'P02'))}</p></article>)}</div></section>
            </> : null}

            {view === 'compare' && comparison ? <ComparisonView primary={overview} comparison={comparison} /> : null}

            {view === 'team' ? <section><div className="page-heading"><p className="eyebrow">15 indicateurs</p><h2>Performance d’équipe</h2><p>Chaque valeur est comparée à toutes les observations de la même ligue et de la même période.</p></div><div className="metric-grid">{overview.team_metrics.map((item) => <MetricBlock key={item.id} item={item} />)}</div></section> : null}

            {view === 'players' ? <section><div className="page-heading"><p className="eyebrow">9 indicateurs par joueur</p><h2>Performance individuelle</h2><p>Les rôles et équipes sont conservés au niveau de chaque match.</p></div><div className="table-wrap"><table><thead><tr><th>Rôle</th><th>Joueur</th>{['P01','P02','P03','P04','P05','P06','P07','P08','P09'].map((id) => <th key={id}>{metric(overview.players[0]?.metrics ?? [], id)?.label ?? id}</th>)}</tr></thead><tbody>{overview.players.map((player) => <tr key={`${player.player_id}-${player.role}`}><td><span className="role">{player.role}</span></td><th>{player.player_name}</th>{['P01','P02','P03','P04','P05','P06','P07','P08','P09'].map((id) => <td key={id}>{formatValue(metric(player.metrics, id), true)}</td>)}</tr>)}</tbody></table></div></section> : null}

            {view === 'draft' ? <section><div className="page-heading"><p className="eyebrow">4 indicateurs par champion</p><h2>Lecture de draft</h2><p>Les picks et bans sont dédupliqués par match, équipe et emplacement.</p></div><div className="table-wrap"><table><thead><tr><th>Champion</th><th>Pick rate</th><th>Ban rate</th><th>Présence</th><th>Win rate en pick</th><th>Échantillon</th></tr></thead><tbody>{overview.draft.map((item) => <tr key={item.champion}><th>{item.champion}</th>{['D01','D02','D03','D04'].map((id) => <td key={id}>{formatValue(metric(item.metrics, id), true)}</td>)}<td>{metric(item.metrics, 'D04')?.sample_size ?? 0} picks</td></tr>)}</tbody></table></div></section> : null}

            {view === 'trends' ? <section><div className="page-heading"><p className="eyebrow">Agrégation hebdomadaire</p><h2>Tendances</h2><p>Évolution de l’early game, des résultats et du rythme offensif.</p></div><div className="panel trend-large"><div className="section-heading"><h2>Différence d’or à 15 minutes</h2><span>{overview.trends.length} semaines</span></div><TrendChart points={overview.trends} /></div><div className="table-wrap"><table><thead><tr><th>Semaine</th><th>Matchs</th><th>Win rate</th><th>GD@15</th><th>Kills/match</th></tr></thead><tbody>{overview.trends.map((point) => <tr key={point.week}><th>{new Date(point.week).toLocaleDateString('fr-FR')}</th><td>{point.matches}</td><td>{point.win_rate === null ? '—' : `${point.win_rate.toFixed(1)} %`}</td><td>{point.gold_diff_at_15 === null ? '—' : Math.round(point.gold_diff_at_15).toLocaleString('fr-FR')}</td><td>{point.kills_per_game?.toFixed(1) ?? '—'}</td></tr>)}</tbody></table></div></section> : null}
          </>
        ) : null}
        <footer><span>Source : Oracle’s Elixir{demoMode ? ' · instantanés statiques' : ''}</span><span>Same Rift. Smarter Decisions.</span></footer>
      </main>
    </div>
  );
}
