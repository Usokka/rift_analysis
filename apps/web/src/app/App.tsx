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
  leagues: { league: string; year: number; matches: number; match_snapshot?: string | null }[];
  splits: { league: string; year: number; split: string }[];
  teams: TeamMetadata[];
  default_selection?: {
    league: string;
    year: number;
    team_id: string;
    comparison_team_id: string;
  };
};

type MatchTeam = {
  team_id: string;
  team_name: string;
  side: 'BLUE' | 'RED';
  result: number;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  gold_diff_at_15: number | null;
  first_blood: boolean | null;
  first_tower: boolean | null;
  first_dragon: boolean | null;
  first_herald: boolean | null;
  first_baron: boolean | null;
  dragons: number | null;
  heralds: number | null;
  barons: number | null;
  towers: number | null;
  reading: string;
};

type MatchPlayer = {
  participant_id: number;
  player_id: string;
  player_name: string;
  team_id: string;
  team_name: string;
  side: 'BLUE' | 'RED';
  role: string;
  champion: string;
  result: number;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  total_cs: number | null;
  total_gold: number | null;
  damage_to_champions: number | null;
  vision_score: number | null;
  gold_diff_at_15: number | null;
};

type MatchDraftAction = {
  team_id: string;
  team_name: string;
  side: 'BLUE' | 'RED';
  action_type: 'PICK' | 'BAN';
  action_slot: number;
  champion: string;
  role: string | null;
};

type MatchDetail = {
  game_id: string;
  league: string;
  year: number;
  split: string | null;
  playoffs: boolean | null;
  played_at: string | null;
  game_number: number | null;
  patch: string | null;
  duration_seconds: number | null;
  data_completeness: string | null;
  quality_status: string;
  teams: MatchTeam[];
  players: MatchPlayer[];
  draft: MatchDraftAction[];
};

type MatchSummary = {
  game_id: string;
  played_at: string | null;
  split: string | null;
  game_number: number | null;
  patch: string | null;
  duration_seconds: number | null;
  team_id: string;
  team_name: string;
  opponent_id: string;
  opponent_name: string;
  side: 'BLUE' | 'RED';
  result: number;
  kills: number | null;
  deaths: number | null;
  gold_diff_at_15: number | null;
};

type MatchBundle = { league: string; year: number; matches: MatchDetail[] };

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
type View = 'overview' | 'compare' | 'team' | 'players' | 'draft' | 'trends' | 'matches';
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
  { id: 'matches', label: 'Matchs' },
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

function summaryFromDetail(match: MatchDetail, teamId: string): MatchSummary | null {
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

function TrendChart({ points, field = 'gold_diff_at_15', label = 'Différence d’or à 15 minutes', unit = 'or' }: { points: Trend[]; field?: 'gold_diff_at_15' | 'win_rate' | 'kills_per_game'; label?: string; unit?: string }) {
  const ordered = [...points].sort((a, b) => a.week.localeCompare(b.week));
  const values = ordered.flatMap(p => p[field] === null ? [] : [p[field] as number]);
  if (!values.length) return <p className="chart-empty">Aucune mesure disponible pour {label}.</p>;
  const min = Math.min(0, ...values), max = unit === '%' ? 100 : Math.max(1, ...values);
  const y = (v: number) => 180 - (v - min) / (max - min) * 150;
  const times = ordered.map(p => Date.parse(p.week));
  const x = (i: number) => times.length === 1 ? 300 : 55 + (times[i] - times[0]) / (times.at(-1)! - times[0] || 1) * 510;
  return <div className="time-chart"><svg viewBox="0 0 620 225" role="img" aria-label={label}>
    {[min, (min + max) / 2, max].map((v, i) => <g key={i}><line x1="55" x2="565" y1={y(v)} y2={y(v)} className="zero-line" /><text x="48" y={y(v) + 4} textAnchor="end">{Math.round(v).toLocaleString('fr-FR')}</text></g>)}
    {ordered.map((p, i) => <g key={p.week}>
      {i > 0 && p[field] !== null && ordered[i - 1][field] !== null ? <line x1={x(i - 1)} y1={y(ordered[i - 1][field]!)} x2={x(i)} y2={y(p[field]!)} className="trend-line" /> : null}
      {p[field] !== null ? <circle cx={x(i)} cy={y(p[field]!)} r="4" fill="var(--gold-soft)" tabIndex={0}><title>{p.week} : {p[field]!.toFixed(1)} {unit} · {p.matches} matchs</title></circle> : null}
    </g>)}
    <text x="55" y="210">{ordered[0].week}</text><text x="565" y="210" textAnchor="end">{ordered.at(-1)!.week}</text>
  </svg><p className="viz-note">{unit} · Survoler les points pour les valeurs et échantillons. Les mesures manquantes interrompent la courbe.</p></div>;
}

type BarRow = { label: string; value: number | null; note?: string; color?: string };
function Bars({ rows, unit = '', percent = false }: { rows: BarRow[]; unit?: string; percent?: boolean }) {
  const values = rows.flatMap(r => r.value === null ? [] : [r.value]);
  if (!values.length) return <p className="chart-empty">Aucune mesure disponible.</p>;
  const min = Math.min(0, ...values), max = percent ? 100 : Math.max(0, ...values);
  const scale = (v: number) => (v - min) / (max - min || 1) * 100;
  return <div className="bars"><p className="viz-note">Échelle commune : {min.toLocaleString('fr-FR')} à {max.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} {unit}</p>{rows.map((r, i) => <div className="bar-row" key={`${r.label}-${i}`}>
    <div className="bar-label"><span>{r.label}</span><strong>{r.value === null ? '—' : `${r.value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${unit}`}</strong></div>
    <div className="bar-track" aria-hidden="true"><i className="bar-zero" style={{ left: `${scale(0)}%` }} />{r.value !== null ? <span style={{ left: `${scale(Math.min(0, r.value))}%`, width: `${Math.abs(scale(r.value) - scale(0))}%`, background: r.color ?? (r.value < 0 ? '#d98278' : 'var(--gold-soft)') }} /> : null}</div>
    {r.note ? <small>{r.note}</small> : null}
  </div>)}</div>;
}

function ResultsDonut({ item }: { item?: Metric }) {
  if (!item || item.value === null || !item.sample_size) return <p className="chart-empty">Aucun résultat disponible.</p>;
  return <div className="donut-layout"><svg viewBox="0 0 180 180" role="img" aria-label={`${item.value.toFixed(1)} % de victoires sur ${item.sample_size} matchs`}>
    <circle cx="90" cy="90" r="65" fill="none" stroke="#d98278" strokeWidth="20" />
    <circle cx="90" cy="90" r="65" fill="none" stroke="#80c7a0" strokeWidth="20" pathLength="100" strokeDasharray={`${item.value} ${100 - item.value}`} transform="rotate(-90 90 90)" />
    <text x="90" y="88" textAnchor="middle" className="donut-value">{item.value.toFixed(1)} %</text><text x="90" y="110" textAnchor="middle">victoires</text>
  </svg><div><p className="win-text">● Victoires · {item.value.toFixed(1)} %</p><p className="loss-text">● Défaites · {(100 - item.value).toFixed(1)} %</p><p className="viz-note">{item.sample_size} matchs avec résultat</p></div></div>;
}

function MetricBars({ metrics, other, names }: { metrics: Metric[]; other?: Metric[]; names: [string, string] }) {
  const [selected, setSelected] = useState('T01');
  const item = metric(metrics, selected) ?? metrics[0];
  if (!item) return null;
  const compared = other ? metric(other, item.id) : undefined;
  return <section className="panel"><div className="section-heading"><h2>Comparer les indicateurs</h2><label className="chart-select">Indicateur<select value={item.id} onChange={e => setSelected(e.target.value)}>{metrics.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label></div><Bars unit={item.unit} percent={item.unit === '%'} rows={[
    { label: names[0], value: item.value, note: `${item.sample_size}/${item.eligible_sample_size} matchs` },
    { label: names[1], value: other ? compared?.value ?? null : item.benchmark ?? null, color: '#69c7e5', note: other ? `${compared?.sample_size ?? 0} matchs` : 'Référence de la ligue sur la même période' },
  ]} /></section>;
}

function RankingChart({ overview, draft = false }: { overview: Overview; draft?: boolean }) {
  const [selected, setSelected] = useState(draft ? 'D03' : 'P01');
  const entries = draft ? overview.draft.map(p => ({ label: p.champion, metrics: p.metrics })) : overview.players.map(p => ({ label: `${p.player_name} · ${p.role}`, metrics: p.metrics }));
  const options = entries[0]?.metrics ?? [];
  const spec = metric(options, selected);
  const rows = entries.map(p => { const m = metric(p.metrics, selected); return { label: p.label, value: m?.value ?? null, note: `${m?.sample_size ?? 0}/${m?.eligible_sample_size ?? 0} observations` }; }).sort((a,b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
  return <section className="panel"><div className="section-heading"><h2>{draft ? 'Champions prioritaires' : 'Comparer les joueurs'}</h2><label className="chart-select">Indicateur<select value={selected} onChange={e => setSelected(e.target.value)}>{options.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label></div><p className="viz-note">{draft ? 'Top 15, trié par valeur. Les taux de présence des champions ne constituent pas les parts d’un même total.' : 'Tri décroissant. Comparer les rôles et les échantillons avant de conclure.'}</p><Bars rows={draft ? rows.slice(0,15) : rows} unit={spec?.unit} percent={spec?.unit === '%'} /></section>;
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
      <MetricBars metrics={primary.team_metrics} other={comparison.team_metrics} names={[primary.filters.team_name, comparison.filters.team_name]} /><details className="data-details"><summary>Afficher les valeurs et échantillons</summary><div className="table-wrap comparison-table">
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
      </div></details>
    </section>
  );
}

function DurationHistogram({ matches }: { matches: MatchSummary[] }) {
  const eligible = matches.filter(m => m.duration_seconds !== null && m.duration_seconds >= 0);
  const bins = [{ label: '< 20 min', min: 0, max: 1200 }, { label: '20–25 min', min: 1200, max: 1500 }, { label: '25–30 min', min: 1500, max: 1800 }, { label: '30–35 min', min: 1800, max: 2100 }, { label: '35–40 min', min: 2100, max: 2400 }, { label: '≥ 40 min', min: 2400, max: Infinity }];
  const counts = bins.map(b => eligible.filter(m => m.duration_seconds! >= b.min && m.duration_seconds! < b.max).length);
  const max = Math.max(1, ...counts);
  return <section className="panel"><div className="section-heading"><h2>Durée des parties</h2><span>{eligible.length}/{matches.length} matchs renseignés</span></div>{eligible.length ? <div className="histogram" role="img" aria-label="Distribution des durées de match par tranche de cinq minutes ; première et dernière tranches ouvertes">{bins.map((b,i) => <div className="hist-bin" key={b.label}><strong>{counts[i]}</strong><div className="hist-track"><span style={{ height: `${counts[i]/max*100}%` }} /></div><small>{b.label}</small></div>)}</div> : <p className="chart-empty">Aucune durée disponible.</p>}</section>;
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
          <p>Du résultat agrégé aux deux équipes, dix joueurs et actions de draft sources.</p>
        </div>
        {selectedWeek ? (
          <button className="quiet-button" onClick={onClearWeek}>
            Semaine du {new Date(selectedWeek).toLocaleDateString('fr-FR')} · Tout afficher
          </button>
        ) : null}
      </div>
      {!loading ? <DurationHistogram matches={visibleMatches} /> : null}
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
                  <strong>{item.team_name} — {item.opponent_name}</strong>
                  <small>
                    {item.played_at ? new Date(item.played_at).toLocaleDateString('fr-FR') : 'Date inconnue'}
                    {' · '}{item.kills ?? '—'}–{item.deaths ?? '—'}
                    {' · '}GD@15 {number(item.gold_diff_at_15, true)}
                  </small>
                </span>
              </button>
            ))}
            {!visibleMatches.length ? <p className="chart-empty">Aucun match pour cette semaine.</p> : null}
          </div>
        </aside>

        <div className="match-detail" aria-live="polite">
          {loading ? <div className="notice" role="status">Chargement du match…</div> : null}
          {!loading && detail ? (
            <>
              <header className="match-context">
                <div>
                  <p className="eyebrow">{detail.league} {detail.year}{detail.split ? ` · ${detail.split}` : ''}</p>
                  <h2>{detail.teams[0].team_name} face à {detail.teams[1].team_name}</h2>
                </div>
                <dl>
                  <div><dt>Date</dt><dd>{detail.played_at ? new Date(detail.played_at).toLocaleDateString('fr-FR') : '—'}</dd></div>
                  <div><dt>Patch</dt><dd>{detail.patch ?? '—'}</dd></div>
                  <div><dt>Durée</dt><dd>{duration(detail.duration_seconds)}</dd></div>
                </dl>
              </header>

              <div className="scoreboard">
                {detail.teams.map((team) => (
                  <article key={team.team_id} className={team.team_id === teamId ? 'focus-team' : ''}>
                    <p className="eyebrow">{team.side === 'BLUE' ? 'Côté bleu' : 'Côté rouge'}</p>
                    <h3>{team.team_name}</h3>
                    <strong>{team.kills ?? '—'} <span>kills</span></strong>
                    <p className={team.result ? 'win-text' : 'loss-text'}>{team.result ? 'Victoire' : 'Défaite'}</p>
                    <dl>
                      <div><dt>GD@15</dt><dd>{number(team.gold_diff_at_15, true)}</dd></div>
                      <div><dt>Tours</dt><dd>{team.towers ?? '—'}</dd></div>
                      <div><dt>Dragons</dt><dd>{team.dragons ?? '—'}</dd></div>
                      <div><dt>Barons</dt><dd>{team.barons ?? '—'}</dd></div>
                    </dl>
                  </article>
                ))}
              </div>

              {perspective ? (
                <div className="match-reading">
                  <p className="eyebrow">Lecture descriptive · {perspective.team_name}</p>
                  <p>{perspective.reading}</p>
                </div>
              ) : null}

              <div className="table-wrap player-match-table">
                <table>
                  <thead><tr><th>Équipe</th><th>Rôle</th><th>Joueur</th><th>Champion</th><th>K / D / A</th><th>CS</th><th>Or</th><th>Dégâts</th><th>Vision</th><th>GD@15</th></tr></thead>
                  <tbody>{detail.players.map((player) => (
                    <tr key={player.participant_id}>
                      <td>{player.team_name}</td><td><span className="role">{player.role}</span></td>
                      <th>{player.player_name}</th><td>{player.champion}</td>
                      <td>{player.kills ?? '—'} / {player.deaths ?? '—'} / {player.assists ?? '—'}</td>
                      <td>{number(player.total_cs)}</td><td>{number(player.total_gold)}</td>
                      <td>{number(player.damage_to_champions)}</td><td>{number(player.vision_score)}</td>
                      <td>{number(player.gold_diff_at_15, true)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>

              <div className="draft-detail panel">
                <div className="section-heading"><h2>Draft normalisée</h2><span>Picks et bans par côté</span></div>
                <div className="draft-sides">
                  {detail.teams.map((team) => {
                    const actions = detail.draft.filter((item) => item.team_id === team.team_id);
                    return (
                      <article key={team.team_id}>
                        <h3>{team.team_name}</h3>
                        <p><span>Picks</span>{actions.filter((item) => item.action_type === 'PICK').map((item) => item.champion).join(' · ') || '—'}</p>
                        <p><span>Bans</span>{actions.filter((item) => item.action_type === 'BAN').map((item) => item.champion).join(' · ') || '—'}</p>
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

  useEffect(() => {
    if (!league || !year || !teamId || !metadata) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ league, year: String(year), team_id: teamId });
    if (split) params.set('split', split);
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    const leagueMetadata = metadata.leagues.find(
      (item) => item.league === league && item.year === year,
    );
    const url = demoMode
      ? analyticsUrl('', leagueMetadata?.match_snapshot ?? `matches/${year}/${league}.json`)
      : `/api/v1/analytics/matches?${params}`;
    setMatchesLoading(true);
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
        setSelectedMatch(demoMode ? details.find((item) => item.game_id === initial) ?? null : null);
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
        demoMatchDetails.find((item) => item.game_id === selectedGameId) ?? null,
      );
      return;
    }
    const controller = new AbortController();
    setMatchesLoading(true);
    fetch(`/api/v1/analytics/match?${new URLSearchParams({ game_id: selectedGameId })}`, {
      signal: controller.signal,
    })
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

  const keyMetrics = overview
    ? ['T01', 'T05', 'T08'].map((id) => metric(overview.team_metrics, id))
    : [];
  const title = view === 'compare' && comparison
    ? `${overview?.filters.team_name ?? ''} vs ${comparison.filters.team_name}`
    : overview?.filters.team_name ?? 'Performance Review';
  const report = useMemo(
    () => (overview ? exportReport(overview, comparison) : null),
    [overview, comparison],
  );

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
            {report ? <a className="export-button" href={report.href} download={report.filename}>Exporter CSV</a> : null}
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
              <section className="panel"><div className="section-heading"><h2>Répartition des résultats</h2><span>Équipe sélectionnée</span></div><ResultsDonut item={metric(overview.team_metrics, 'T01')} /></section><section className="panel split-panel"><div><div className="section-heading"><h2>Forme hebdomadaire</h2><span>GD@15</span></div><TrendChart points={overview.trends} /></div><div><div className="section-heading"><h2>Priorités de draft</h2><span>Top 5</span></div><Bars percent unit="%" rows={[...overview.draft].sort((a,b) => (metric(b.metrics, 'D03')?.value ?? -1) - (metric(a.metrics, 'D03')?.value ?? -1)).slice(0,5).map(item => ({ label: item.champion, value: metric(item.metrics, 'D03')?.value ?? null }))} /></div></section>
              <section className="panel"><div className="section-heading"><h2>Roster observé</h2><span>{overview.players.length} profils joueur/rôle</span></div><div className="roster">{overview.players.slice(0, 10).map((player) => <article key={`${player.player_id}-${player.role}`}><span>{player.role}</span><h3>{player.player_name}</h3><p>KDA {formatValue(metric(player.metrics, 'P01'))} · KP {formatValue(metric(player.metrics, 'P02'))}</p></article>)}</div></section>
            </> : null}

            {view === 'compare' && comparison ? <ComparisonView primary={overview} comparison={comparison} /> : null}

            {view === 'team' ? <section><div className="page-heading"><p className="eyebrow">15 indicateurs</p><h2>Performance d’équipe</h2><p>Chaque valeur est comparée à toutes les observations de la même ligue et de la même période.</p></div><MetricBars metrics={overview.team_metrics} names={[overview.filters.team_name, 'Moyenne de la ligue']} /><div className="metric-grid">{overview.team_metrics.map((item) => <MetricBlock key={item.id} item={item} />)}</div></section> : null}

            {view === 'players' ? <section><div className="page-heading"><p className="eyebrow">9 indicateurs par joueur</p><h2>Performance individuelle</h2><p>Les rôles et équipes sont conservés au niveau de chaque match.</p></div><RankingChart overview={overview} /><details className="data-details"><summary>Afficher les données détaillées</summary><div className="table-wrap"><table><thead><tr><th>Rôle</th><th>Joueur</th>{['P01','P02','P03','P04','P05','P06','P07','P08','P09'].map((id) => <th key={id}>{metric(overview.players[0]?.metrics ?? [], id)?.label ?? id}</th>)}</tr></thead><tbody>{overview.players.map((player) => <tr key={`${player.player_id}-${player.role}`}><td><span className="role">{player.role}</span></td><th>{player.player_name}</th>{['P01','P02','P03','P04','P05','P06','P07','P08','P09'].map((id) => <td key={id}>{formatValue(metric(player.metrics, id), true)}</td>)}</tr>)}</tbody></table></div></details></section> : null}

            {view === 'draft' ? <section><div className="page-heading"><p className="eyebrow">4 indicateurs par champion</p><h2>Lecture de draft</h2><p>Les picks et bans sont dédupliqués par match, équipe et emplacement.</p></div><RankingChart overview={overview} draft /><details className="data-details"><summary>Afficher les données détaillées</summary><div className="table-wrap"><table><thead><tr><th>Champion</th><th>Pick rate</th><th>Ban rate</th><th>Présence</th><th>Win rate en pick</th><th>Échantillon</th></tr></thead><tbody>{overview.draft.map((item) => <tr key={item.champion}><th>{item.champion}</th>{['D01','D02','D03','D04'].map((id) => <td key={id}>{formatValue(metric(item.metrics, id), true)}</td>)}<td>{metric(item.metrics, 'D04')?.sample_size ?? 0} picks</td></tr>)}</tbody></table></div></details></section> : null}

            {view === 'trends' ? <section><div className="page-heading"><p className="eyebrow">Agrégation hebdomadaire</p><h2>Tendances</h2><p>Évolution de l’early game, des résultats et du rythme offensif.</p></div><div className="panel trend-large"><div className="section-heading"><h2>Différence d’or à 15 minutes</h2><span>{overview.trends.length} semaines</span></div><TrendChart points={overview.trends} /></div><div className="visual-grid">{([{ field: 'win_rate', label: 'Taux de victoire', unit: '%' }, { field: 'kills_per_game', label: 'Kills par match', unit: 'kills/match' }] as const).map(c => <section className="panel" key={c.field}><div className="section-heading"><h2>{c.label}</h2></div><TrendChart points={overview.trends} {...c} /></section>)}</div><details className="data-details"><summary>Afficher les données détaillées et accéder aux matchs</summary><div className="table-wrap"><table><thead><tr><th>Semaine</th><th>Matchs</th><th>Win rate</th><th>GD@15</th><th>Kills/match</th><th>Détail</th></tr></thead><tbody>{overview.trends.map((point) => <tr key={point.week}><th>{new Date(point.week).toLocaleDateString('fr-FR')}</th><td>{point.matches}</td><td>{point.win_rate === null ? '—' : `${point.win_rate.toFixed(1)} %`}</td><td>{point.gold_diff_at_15 === null ? '—' : Math.round(point.gold_diff_at_15).toLocaleString('fr-FR')}</td><td>{point.kills_per_game?.toFixed(1) ?? '—'}</td><td><button className="table-action" onClick={() => { const first = matchSummaries.find((item) => weekStart(item.played_at) === point.week); setSelectedWeek(point.week); if (first) setSelectedGameId(first.game_id); setView('matches'); }}>Voir les matchs</button></td></tr>)}</tbody></table></div></details></section> : null}

            {view === 'matches' ? <MatchExplorer matches={matchSummaries} detail={selectedMatch} selectedGameId={selectedGameId} selectedWeek={selectedWeek} teamId={teamId} loading={matchesLoading} onSelect={setSelectedGameId} onClearWeek={() => setSelectedWeek('')} /> : null}
          </>
        ) : null}
        <footer><span>Source : Oracle’s Elixir{demoMode ? ' · instantanés statiques' : ''}</span><span>Same Rift. Smarter Decisions.</span></footer>
      </main>
    </div>
  );
}
