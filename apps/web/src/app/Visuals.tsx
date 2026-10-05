import { useState, type ReactNode } from 'react';
import type {
  MatchDetail,
  MatchSummary,
  Metric,
  Overview,
  Trend,
} from './types';
import {
  getMetric as m,
  fmt,
  finite,
  chronological,
  conversionGroups,
  durationDistribution,
  wilson,
} from './analytics';
import './visuals.css';

const GOLD = '#e4c46b',
  BLUE = '#75c9ed',
  GREEN = '#88d6ae',
  RED = '#eb938c';
const ROLES: Record<string, string> = {
  TOP: '#e4c46b',
  JNG: '#88d6ae',
  JUNGLE: '#88d6ae',
  MID: '#b9a1ef',
  ADC: '#75c9ed',
  BOT: '#75c9ed',
  SUP: '#eeadce',
  SUPPORT: '#eeadce',
};
const metricGroups = [
  { title: 'Résultats & rythme', ids: ['T01', 'T02', 'T03', 'T04'] },
  {
    title: 'Prendre l’initiative',
    ids: ['T05', 'T06', 'T07', 'T08', 'T09', 'T10'],
  },
  { title: 'Construire la victoire', ids: ['T11', 'T12', 'T13', 'T14', 'T15'] },
];
function Heading({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="analysis-heading">
      <p className="eyebrow">Rift / {number}</p>
      <h2>{title}</h2>
      <p>{children}</p>
    </header>
  );
}
function Panel({
  title,
  caption,
  children,
  className = '',
}: {
  title: string;
  caption?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`viz-panel ${className}`}>
      <header>
        <h3>{title}</h3>
        {caption && <p>{caption}</p>}
      </header>
      {children}
    </section>
  );
}
function Empty({
  children = 'Aucune observation disponible sur ce périmètre.',
}: {
  children?: ReactNode;
}) {
  return <p className="viz-empty">{children}</p>;
}
function Legend({ items }: { items: [string, string][] }) {
  return (
    <div className="viz-legend">
      {items.map(([label, color]) => (
        <span key={label}>
          <i style={{ background: color }} />
          {label}
        </span>
      ))}
    </div>
  );
}
function Sample({ item }: { item?: Metric }) {
  if (!item) return null;
  return (
    <small className="sample">
      n = {item.sample_size} · périmètre {item.eligible_sample_size}
      {item.sample_size < 5 ? ' · échantillon faible' : ''}
    </small>
  );
}
function Ring({
  rate,
  label,
  note,
  color = GREEN,
}: {
  rate: number | null;
  label: string;
  note: string;
  color?: string;
}) {
  return (
    <div className="ring-card">
      <svg
        viewBox="0 0 180 180"
        role="img"
        aria-label={`${label} : ${fmt(rate)} % ; ${note}`}
      >
        <circle
          cx="90"
          cy="90"
          r="68"
          fill="none"
          stroke="#243c46"
          strokeWidth="12"
        />
        {finite(rate) && (
          <circle
            cx="90"
            cy="90"
            r="68"
            fill="none"
            stroke={color}
            strokeWidth="12"
            pathLength="100"
            strokeDasharray={`${Math.max(0, Math.min(100, rate))} 100`}
            transform="rotate(-90 90 90)"
            strokeLinecap="round"
          />
        )}
        <text x="90" y="91" textAnchor="middle" className="ring-value">
          {fmt(rate)}
          {finite(rate) ? '%' : ''}
        </text>
        <text x="90" y="113" textAnchor="middle" className="ring-sub">
          {label}
        </text>
      </svg>
      <p>{note}</p>
    </div>
  );
}
function Bullet({
  item,
  compared,
  compareMode = false,
  names = ['Équipe', 'Ligue'],
}: {
  item: Metric;
  compared?: Metric;
  compareMode?: boolean;
  names?: [string, string];
}) {
  const reference = compareMode ? (compared?.value ?? null) : item.benchmark;
  const min = Math.min(0, item.value ?? 0, reference ?? 0);
  const max =
    item.unit === '%'
      ? 100
      : Math.max(1, item.value ?? 0, reference ?? 0) * 1.15;
  const position = (v: number) => ((v - min) / (max - min)) * 100;
  const gap =
    finite(item.value) && finite(reference) ? item.value - reference : null;
  return (
    <article className="bullet-card">
      <div className="bullet-title">
        <h4>{item.label}</h4>
        <span>{item.id}</span>
      </div>
      <div className="bullet-numbers">
        <strong>
          {fmt(item.value)} <small>{item.unit}</small>
        </strong>
        <span>
          {names[1]} {fmt(reference)}
        </span>
      </div>
      <div
        className="bullet-axis"
        role="img"
        aria-label={`${names[0]} ${fmt(item.value)} ; ${names[1]} ${fmt(reference)} ${item.unit}`}
      >
        <i className="axis-zero" style={{ left: `${position(0)}%` }} />
        {finite(item.value) && (
          <span
            className="bullet-fill"
            style={{
              left: `${position(Math.min(0, item.value))}%`,
              width: `${Math.abs(position(item.value) - position(0))}%`,
              background: item.value < 0 ? RED : GOLD,
            }}
          />
        )}
        {finite(reference) && (
          <i
            className="reference-dot"
            style={{ left: `${position(reference)}%` }}
          />
        )}
      </div>
      <div className="axis-labels">
        <span>{fmt(min)}</span>
        <span>
          {fmt(max)} {item.unit}
        </span>
      </div>
      <p className="delta-label">
        {gap === null
          ? 'Référence indisponible'
          : `${gap > 0 ? '+' : ''}${fmt(gap)} ${item.unit === '%' ? 'points' : item.unit} vs ${names[1]}`}
      </p>
      <Sample item={item} />
      {compared && (
        <small className="sample">
          {names[1]} : n = {compared.sample_size}
          {compared.sample_size < 5 ? ' · échantillon faible' : ''}
        </small>
      )}
    </article>
  );
}
function MetricAtlas({
  overview,
  comparison,
}: {
  overview: Overview;
  comparison?: Overview;
}) {
  return (
    <>
      {metricGroups.map((g) => (
        <Panel
          key={g.title}
          title={g.title}
          caption={`Barre dorée : ${overview.filters.team_name} · repère bleu : ${comparison?.filters.team_name ?? 'moyenne de ligue'}. Échelle propre à chaque indicateur.`}
        >
          <div className="bullet-grid">
            {g.ids.flatMap((id) => {
              const item = m(overview.team_metrics, id);
              return item
                ? [
                    <Bullet
                      key={id}
                      item={item}
                      compareMode={!!comparison}
                      compared={
                        comparison ? m(comparison.team_metrics, id) : undefined
                      }
                      names={[
                        overview.filters.team_name,
                        comparison?.filters.team_name ?? 'Ligue',
                      ]}
                    />,
                  ]
                : [];
            })}
          </div>
        </Panel>
      ))}
    </>
  );
}

type Dot = {
  id: string;
  label: string;
  x: number;
  y: number;
  size?: number;
  color?: string;
  note: string;
};
function Scatter({
  points,
  xLabel,
  yLabel,
  xDomain,
  yDomain,
  onSelect,
  selected,
  bubbleNote,
}: {
  points: Dot[];
  xLabel: string;
  yLabel: string;
  xDomain?: [number, number];
  yDomain?: [number, number];
  onSelect?: (id: string) => void;
  selected?: string;
  bubbleNote?: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  if (!points.length) return <Empty />;
  const xs = points.map((p) => p.x),
    ys = points.map((p) => p.y);
  const bounds = (values: number[]): [number, number] => {
    const low = Math.min(0, ...values),
      high = Math.max(1, ...values);
    return [low < 0 ? low * 1.1 : 0, high * 1.1];
  };
  const [xmin, xmax] = xDomain ?? bounds(xs),
    [ymin, ymax] = yDomain ?? bounds(ys);
  const x = (v: number) => 70 + ((v - xmin) / (xmax - xmin || 1)) * 560,
    y = (v: number) => 315 - ((v - ymin) / (ymax - ymin || 1)) * 255;
  const active =
    points.find((p) => p.id === hovered) ??
    points.find((p) => p.id === selected);
  const largest = Math.max(1, ...points.map((p) => p.size ?? 1));
  const activate = (p: Dot) => {
    setHovered(p.id);
    onSelect?.(p.id);
  };
  return (
    <div className="scatter-wrap">
      <svg
        viewBox="0 0 700 380"
        role="group"
        aria-label={`${xLabel} et ${yLabel}`}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line
              x1="70"
              x2="630"
              y1={60 + t * 255}
              y2={60 + t * 255}
              className="viz-gridline"
            />
            <text x="58" y={64 + t * 255} textAnchor="end">
              {fmt(ymax - t * (ymax - ymin), 0)}
            </text>
            <line
              x1={70 + t * 560}
              x2={70 + t * 560}
              y1="60"
              y2="315"
              className="viz-gridline"
            />
            <text x={70 + t * 560} y="337" textAnchor="middle">
              {fmt(xmin + t * (xmax - xmin), 0)}
            </text>
          </g>
        ))}
        {xmin < 0 && (
          <line
            x1={x(0)}
            x2={x(0)}
            y1="60"
            y2="315"
            className="viz-reference"
          />
        )}
        {ymin < 0 && (
          <line
            x1="70"
            x2="630"
            y1={y(0)}
            y2={y(0)}
            className="viz-reference"
          />
        )}
        <text x="70" y="30" className="axis-title">
          {yLabel}
        </text>
        <text x="350" y="371" textAnchor="middle" className="axis-title">
          {xLabel}
        </text>
        {points.map((p) => (
          <circle
            key={p.id}
            cx={x(p.x)}
            cy={y(p.y)}
            r={
              p.size === undefined
                ? 5
                : Math.sqrt(Math.max(0, p.size) / largest) * 15 + 2
            }
            fill={p.color ?? GOLD}
            fillOpacity={active?.id === p.id ? 1 : 0.65}
            stroke={active?.id === p.id ? '#fff' : '#07141d'}
            strokeWidth={active?.id === p.id ? 2.5 : 1}
            tabIndex={0}
            role="button"
            aria-label={`${p.label}. ${xLabel} : ${fmt(p.x)}. ${yLabel} : ${fmt(p.y)}. ${p.note}`}
            onMouseEnter={() => setHovered(p.id)}
            onFocus={() => setHovered(p.id)}
            onClick={() => activate(p)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate(p);
              }
            }}
          >
            <title>
              {p.label} · {fmt(p.x)} / {fmt(p.y)} · {p.note}
            </title>
          </circle>
        ))}
      </svg>
      <div className="point-readout" aria-live="polite">
        {active ? (
          <>
            <strong>{active.label}</strong>
            <span>
              {xLabel} : {fmt(active.x)} · {yLabel} : {fmt(active.y)}
            </span>
            <small>{active.note}</small>
          </>
        ) : (
          <>
            <strong>Explore les observations</strong>
            <span>
              Survole, touche ou sélectionne un point au clavier pour lire ses
              valeurs.
            </span>
          </>
        )}
      </div>
      {bubbleNote && <p className="viz-footnote">{bubbleNote}</p>}
    </div>
  );
}
function Ribbon({
  matches,
  onMatch,
}: {
  matches: MatchSummary[];
  onMatch: (id: string) => void;
}) {
  const ordered = chronological(matches);
  if (!ordered.length)
    return (
      <Empty>
        Le détail des matchs n’est pas disponible. Les indicateurs agrégés
        restent consultables.
      </Empty>
    );
  return (
    <>
      <Legend
        items={[
          ['Victoire', GREEN],
          ['Défaite', RED],
        ]}
      />
      <div className="result-ribbon">
        {ordered.map((match, i) => (
          <button
            key={match.game_id}
            className={match.result === 1 ? 'won' : 'lost'}
            onClick={() => onMatch(match.game_id)}
            title={`${match.played_at?.slice(0, 10) ?? 'Date inconnue'} · ${match.opponent_name} · ${match.result === 1 ? 'Victoire' : 'Défaite'} · GD@15 ${fmt(match.gold_diff_at_15)}`}
            aria-label={`Match ${i + 1}, ${match.opponent_name}, ${match.result === 1 ? 'victoire' : 'défaite'}, ouvrir le match`}
          >
            {match.result === 1 ? 'V' : 'D'}
          </button>
        ))}
      </div>
      <p className="viz-footnote">
        Du plus ancien au plus récent · {ordered.length} matchs · Clique sur un
        résultat pour ouvrir son détail.
      </p>
    </>
  );
}
function Conversion({ matches }: { matches: MatchSummary[] }) {
  const groups = conversionGroups(matches),
    count = groups.reduce((n, g) => n + g.items.length, 0);
  if (!count)
    return (
      <Empty>
        Les résultats et l’or à 15 minutes doivent être disponibles pour cette
        analyse.
      </Empty>
    );
  return (
    <>
      <div className="conversion-grid">
        {groups.map((g) => (
          <div key={g.label}>
            <Ring
              label="de victoires"
              rate={g.rate}
              note={g.label}
              color={g.label.startsWith('En retard') ? BLUE : GREEN}
            />
            <p>
              <strong>{g.wins}</strong> victoires / {g.items.length} matchs
            </p>
            {g.items.length < 5 && (
              <small className="sample">Échantillon faible</small>
            )}
          </div>
        ))}
      </div>
      <p className="viz-footnote">
        {count}/{matches.length} matchs analysables. Groupes définis par GD@15
        &lt; 0, = 0 et &gt; 0. Association descriptive, sans effet causal
        établi.
      </p>
    </>
  );
}
function MatchCloud({
  matches,
  onMatch,
}: {
  matches: MatchSummary[];
  onMatch?: (id: string) => void;
}) {
  const valid = matches.filter(
    (p) => finite(p.gold_diff_at_15) && finite(p.duration_seconds),
  );
  return (
    <>
      <Legend
        items={[
          ['Victoire', GREEN],
          ['Défaite', RED],
        ]}
      />
      <Scatter
        points={valid.map((p) => ({
          id: p.game_id,
          label: `${p.played_at?.slice(0, 10) ?? ''} · ${p.opponent_name}`,
          x: p.gold_diff_at_15!,
          y: p.duration_seconds! / 60,
          color: p.result === 1 ? GREEN : RED,
          note: `${p.result === 1 ? 'Victoire' : 'Défaite'} · ${p.side} · ${fmt(p.kills, 0)} kills${onMatch ? ' · Cliquer pour ouvrir le match' : ''}`,
        }))}
        xLabel="Différence d’or à 15 min"
        yLabel="Durée (minutes)"
        onSelect={onMatch}
      />
      <p className="viz-footnote">
        {valid.length}/{matches.length} matchs avec les deux mesures. À droite :
        avance à 15 min. À gauche : retard.
      </p>
    </>
  );
}
export function MatchDistribution({ matches }: { matches: MatchSummary[] }) {
  const bins = durationDistribution(matches),
    max = Math.max(1, ...bins.map((b) => b.wins + b.losses));
  const count = bins.reduce((n, b) => n + b.wins + b.losses, 0);
  return (
    <Panel
      title="À quel rythme se terminent les parties ?"
      caption="Distribution des durées, décomposée par résultat."
    >
      {count ? (
        <>
          <Legend
            items={[
              ['Victoire', GREEN],
              ['Défaite', RED],
            ]}
          />
          <div className="duration-hist">
            {bins.map((b) => (
              <div
                key={b.label}
                className="duration-bin"
                tabIndex={0}
                aria-label={`${b.label} minutes : ${b.wins} victoires, ${b.losses} défaites`}
              >
                <strong>{b.wins + b.losses}</strong>
                <div className="duration-track">
                  <span
                    style={{
                      height: `${(b.losses / max) * 100}%`,
                      background: RED,
                    }}
                  />
                  <span
                    style={{
                      height: `${(b.wins / max) * 100}%`,
                      background: GREEN,
                    }}
                  />
                </div>
                <small>
                  {b.label}
                  <br />
                  min
                </small>
              </div>
            ))}
          </div>
          <p className="viz-footnote">
            {count}/{matches.length} durées connues · effectifs par tranche ;
            les tranches extrêmes sont ouvertes.
          </p>
        </>
      ) : (
        <Empty />
      )}
    </Panel>
  );
}
export function OverviewVisuals({
  overview,
  matches,
  loading,
  onMatch,
}: {
  overview: Overview;
  matches: MatchSummary[];
  loading: boolean;
  onMatch: (id: string) => void;
}) {
  const wr = m(overview.team_metrics, 'T01'),
    gd = m(overview.team_metrics, 'T05');
  const strengths = overview.team_metrics
    .filter(
      (p) =>
        p.unit === '%' &&
        finite(p.delta) &&
        p.id !== 'T01' &&
        p.id !== 'T14' &&
        p.id !== 'T15',
    )
    .sort((a, b) => b.delta! - a.delta!);
  const best = strengths[0];
  return (
    <>
      <Heading
        number="01 · Le diagnostic"
        title="Comprendre ce qui fait gagner."
      >
        Résultats, initiative et conversion · {overview.filters.team_name} ·{' '}
        {overview.filters.league} {overview.filters.year}
      </Heading>
      <div className="story-grid">
        <article className="story-card feature">
          <p>Le résultat</p>
          <strong>
            {fmt(wr?.value)}
            <small>%</small>
          </strong>
          <h3>de victoires</h3>
          <Sample item={wr} />
        </article>
        <article className="story-card">
          <p>L’entrée en partie</p>
          <strong>
            {finite(gd?.value) && gd.value > 0 ? '+' : ''}
            {fmt(gd?.value, 0)}
          </strong>
          <h3>or à 15 minutes</h3>
          <span>
            {finite(gd?.value)
              ? gd.value > 0
                ? 'Une avance moyenne en early game.'
                : gd.value < 0
                  ? 'Un retard moyen à rattraper.'
                  : 'Un early game à l’équilibre.'
              : 'Mesure indisponible.'}
          </span>
          <Sample item={gd} />
        </article>
        <article className="story-card">
          <p>Le plus grand écart sur les premiers objectifs</p>
          <strong>
            {best && best.delta! > 0 ? '+' : ''}
            {fmt(best?.delta)}
            <small>pts</small>
          </strong>
          <h3>{best?.label ?? 'Référence indisponible'}</h3>
          <span>par rapport à la ligue</span>
          <Sample item={best} />
        </article>
      </div>
      <Panel
        title="Une saison, match après match"
        caption="Repérer les séries et revenir à la partie qui les explique."
      >
        {loading ? (
          <Empty>Chargement des matchs…</Empty>
        ) : (
          <Ribbon matches={matches} onMatch={onMatch} />
        )}
      </Panel>
      <Panel
        title="L’avance se transforme-t-elle en victoire ?"
        caption="Comparer le résultat final selon la situation à 15 minutes."
      >
        {loading ? (
          <Empty>Chargement…</Empty>
        ) : (
          <Conversion matches={matches} />
        )}
      </Panel>
      <Panel
        title="Gagner vite, renverser une partie, laisser filer une avance"
        caption="Chaque point représente un match. La couleur indique son résultat final."
      >
        {loading ? (
          <Empty>Chargement…</Empty>
        ) : (
          <MatchCloud matches={matches} onMatch={onMatch} />
        )}
      </Panel>
    </>
  );
}
export function TeamVisuals({
  overview,
  matches,
  loading,
}: {
  overview: Overview;
  matches: MatchSummary[];
  loading: boolean;
}) {
  const blue = m(overview.team_metrics, 'T14'),
    red = m(overview.team_metrics, 'T15');
  return (
    <>
      <Heading number="02 · Identité collective" title="Le profil de l’équipe.">
        Les 15 indicateurs, organisés par question de jeu et comparés à la
        ligue.
      </Heading>
      <div className="viz-two">
        <Panel
          title="Le côté change-t-il les résultats ?"
          caption="Deux sous-échantillons distincts ; une différence ne prouve pas un avantage causal du côté."
        >
          <div className="side-rings">
            <Ring
              rate={blue?.value ?? null}
              label="côté bleu"
              color={BLUE}
              note={`${blue?.sample_size ?? 0} matchs`}
            />
            <Ring
              rate={red?.value ?? null}
              label="côté rouge"
              color={RED}
              note={`${red?.sample_size ?? 0} matchs`}
            />
          </div>
        </Panel>
        {loading ? (
          <Panel title="Durées de partie">
            <Empty>Chargement…</Empty>
          </Panel>
        ) : (
          <MatchDistribution matches={matches} />
        )}
      </div>
      <MetricAtlas overview={overview} />
    </>
  );
}
export function CompareVisuals({
  primary,
  comparison,
}: {
  primary: Overview;
  comparison: Overview;
}) {
  const rates = primary.team_metrics.filter((p) => p.unit === '%');
  return (
    <>
      <Heading
        number="03 · Face à face"
        title={`${primary.filters.team_name} × ${comparison.filters.team_name}`}
      >
        Même ligue, même période. Observer les différences sans mélanger les
        unités.
      </Heading>
      <Panel
        title="Où les profils se séparent-ils ?"
        caption="Points reliés sur une échelle commune de 0 à 100 %. La longueur du trait représente l’écart."
      >
        <Legend
          items={[
            [primary.filters.team_name, GOLD],
            [comparison.filters.team_name, BLUE],
          ]}
        />
        <div className="dumbbell-list">
          {rates.map((item) => {
            const other = m(comparison.team_metrics, item.id);
            return (
              <div className="dumbbell-row" key={item.id}>
                <h4>{item.label}</h4>
                <div className="dumbbell-scale">
                  <span className="db-mid" />
                  {finite(item.value) && finite(other?.value) && (
                    <span
                      className="db-link"
                      style={{
                        left: `${Math.min(item.value, other.value)}%`,
                        width: `${Math.abs(item.value - other.value)}%`,
                      }}
                    />
                  )}
                  {finite(item.value) && (
                    <i
                      className="db-dot"
                      style={{ left: `${item.value}%`, background: GOLD }}
                    />
                  )}
                  {finite(other?.value) && (
                    <i
                      className="db-dot"
                      style={{ left: `${other.value}%`, background: BLUE }}
                    />
                  )}
                </div>
                <p>
                  <b style={{ color: GOLD }}>{fmt(item.value)} %</b> /{' '}
                  <b style={{ color: BLUE }}>{fmt(other?.value)} %</b>
                  <small>
                    n = {item.sample_size} / {other?.sample_size ?? 0}
                  </small>
                </p>
              </div>
            );
          })}
        </div>
        <p className="viz-footnote">
          Début de piste : 0 % · milieu : 50 % · fin : 100 %. Tous les autres
          indicateurs sont détaillés ci-dessous.
        </p>
      </Panel>
      <MetricAtlas overview={primary} comparison={comparison} />
    </>
  );
}
export function PlayerVisuals({ overview }: { overview: Overview }) {
  const [role, setRole] = useState('ALL'),
    [selected, setSelected] = useState(''),
    [mode, setMode] = useState('economy');
  const roles = [...new Set(overview.players.map((p) => p.role))];
  const players = overview.players.filter(
    (p) => role === 'ALL' || p.role === role,
  );
  const player =
    players.find((p) => `${p.player_id}:${p.role}` === selected) ?? players[0];
  const spec =
    mode === 'economy'
      ? { x: 'P04', y: 'P05', xl: 'Or / minute', yl: 'Dégâts / minute' }
      : mode === 'teamplay'
        ? {
            x: 'P02',
            y: 'P06',
            xl: 'Participation aux kills (%)',
            yl: 'Vision / minute',
          }
        : {
            x: 'P03',
            y: 'P07',
            xl: 'CS / minute',
            yl: 'Différence d’or à 15 min',
          };
  const points = players.flatMap((p) => {
    const a = m(p.metrics, spec.x),
      b = m(p.metrics, spec.y);
    return finite(a?.value) && finite(b?.value)
      ? [
          {
            id: `${p.player_id}:${p.role}`,
            label: `${p.player_name} · ${p.role}`,
            x: a.value,
            y: b.value,
            size: Math.min(a.sample_size, b.sample_size),
            color: ROLES[p.role] ?? GOLD,
            note: `${a.sample_size} observations X · ${b.sample_size} observations Y`,
          },
        ]
      : [];
  });
  return (
    <>
      <Heading
        number="04 · Les joueurs"
        title="Des rôles, des ressources, de l’impact."
      >
        Explorer les profils par rôle. Les moyennes décrivent les joueurs ;
        elles ne constituent pas un classement ajusté au contexte.
      </Heading>
      <div className="viz-controls">
        <label>
          Rôle
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="ALL">Tous les rôles</option>
            {roles.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label>
          Angle d’analyse
          <select value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value="economy">Ressources → dégâts</option>
            <option value="teamplay">Participation → vision</option>
            <option value="lane">Farm → avance en lane</option>
          </select>
        </label>
      </div>
      <div className="viz-two player-analysis">
        <Panel
          title={
            mode === 'economy'
              ? 'Qui produit avec quelles ressources ?'
              : mode === 'teamplay'
                ? 'Qui participe et éclaire la carte ?'
                : 'Qui construit une avance en lane ?'
          }
          caption={`${points.length}/${players.length} profils avec les deux mesures.`}
        >
          <Legend items={roles.map((r) => [r, ROLES[r] ?? GOLD])} />
          <Scatter
            points={points}
            xLabel={spec.xl}
            yLabel={spec.yl}
            selected={player ? `${player.player_id}:${player.role}` : undefined}
            onSelect={setSelected}
            bubbleNote="Surface des bulles proportionnelle au plus petit échantillon des deux mesures, avec une taille minimale de lisibilité. Comparer de préférence à rôle identique."
          />
        </Panel>
        <Panel
          title={
            player
              ? `${player.player_name} / ${player.role}`
              : 'Choisir un joueur'
          }
          caption="Cliquer sur une bulle ou une carte pour explorer son profil."
        >
          {player ? (
            <>
              <div className="player-spotlight">
                <strong>
                  {fmt(m(player.metrics, 'P01')?.value)}
                  <small>KDA</small>
                </strong>
                <strong>
                  {fmt(m(player.metrics, 'P09')?.value)}
                  <small>% victoires</small>
                </strong>
                <strong>
                  {fmt(m(player.metrics, 'P08')?.value, 0)}
                  <small>champions joués</small>
                </strong>
              </div>
              <div className="player-measures">
                {player.metrics.map((item) => {
                  const values = overview.players
                    .map((p) => m(p.metrics, item.id)?.value)
                    .filter(finite);
                  const min = Math.min(0, ...values),
                    max = item.unit === '%' ? 100 : Math.max(1, ...values);
                  const pos = (v: number) => ((v - min) / (max - min)) * 100;
                  return (
                    <div key={item.id}>
                      <div className="measure-heading">
                        <span>{item.label}</span>
                        <strong>
                          {fmt(item.value)} {item.unit}
                        </strong>
                      </div>
                      <div className="profile-track">
                        <i style={{ left: `${pos(0)}%` }} />
                        {finite(item.value) && (
                          <span
                            style={{
                              left: `${pos(Math.min(0, item.value))}%`,
                              width: `${Math.abs(pos(item.value) - pos(0))}%`,
                              background: ROLES[player.role] ?? GOLD,
                            }}
                          />
                        )}
                      </div>
                      <Sample item={item} />
                    </div>
                  );
                })}
              </div>
              <p className="viz-footnote">
                Échelles : 0–100 % pour les taux ; étendue du roster incluant
                zéro pour les autres mesures. Aucune normalisation en score
                composite.
              </p>
            </>
          ) : (
            <Empty />
          )}
        </Panel>
      </div>
      <div className="roster-cards">
        {players.map((p) => (
          <button
            key={`${p.player_id}:${p.role}`}
            className={player === p ? 'active' : ''}
            onClick={() => setSelected(`${p.player_id}:${p.role}`)}
            style={{ borderTopColor: ROLES[p.role] ?? GOLD }}
          >
            <span className="eyebrow">{p.role}</span>
            <strong>{p.player_name}</strong>
            <span>{fmt(m(p.metrics, 'P05')?.value, 0)} dégâts/min</span>
            <small>{m(p.metrics, 'P09')?.sample_size ?? 0} matchs</small>
          </button>
        ))}
      </div>
    </>
  );
}
export function DraftVisuals({ overview }: { overview: Overview }) {
  const [search, setSearch] = useState(''),
    [minPicks, setMinPicks] = useState(0),
    [selected, setSelected] = useState(''),
    [sort, setSort] = useState('D03');
  const [expanded, setExpanded] = useState(false);
  const champions = overview.draft
    .filter(
      (c) =>
        c.champion.toLowerCase().includes(search.toLowerCase()) &&
        (m(c.metrics, 'D04')?.sample_size ?? 0) >= minPicks,
    )
    .sort(
      (a, b) =>
        (m(b.metrics, sort)?.value ?? -1) - (m(a.metrics, sort)?.value ?? -1),
    );
  const active = champions.find((c) => c.champion === selected) ?? champions[0];
  const rates = champions.filter((c) => finite(m(c.metrics, 'D04')?.value));
  if (!overview.draft.length)
    return (
      <>
        <Heading
          number="05 · La draft"
          title="Une analyse qui exige des données complètes."
        >
          Aucune observation de draft éligible dans ce périmètre.
        </Heading>
        <Panel title="Draft indisponible">
          <Empty>
            Les matchs doivent être marqués complets et contenir des actions de
            draft. Les données actuellement disponibles pour cette équipe ne
            permettent pas de calculer ces taux.
          </Empty>
        </Panel>
      </>
    );
  return (
    <>
      <Heading number="05 · La draft" title="Choisir, interdire, gagner.">
        Distinguer les champions prioritaires des résultats obtenus lorsqu’ils
        sont joués.
      </Heading>
      <div className="viz-controls">
        <label>
          Champion
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un champion…"
          />
        </label>
        <label>
          Minimum de picks avec résultat
          <select
            value={minPicks}
            onChange={(e) => setMinPicks(Number(e.target.value))}
          >
            {[0, 5, 10, 20].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'Tous (bans seuls inclus)' : `${n} picks`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trier les cartes
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="D03">Présence</option>
            <option value="D01">Pick rate</option>
            <option value="D02">Ban rate</option>
            <option value="D04">Win rate</option>
          </select>
        </label>
      </div>
      <div className="viz-two">
        <Panel
          title="Les choix et les interdits"
          caption={`${champions.length} champions dans la sélection. À droite : souvent choisis. En haut : souvent bannis.`}
        >
          <Scatter
            points={champions.flatMap((c) => {
              const a = m(c.metrics, 'D01'),
                b = m(c.metrics, 'D02');
              return finite(a?.value) && finite(b?.value)
                ? [
                    {
                      id: c.champion,
                      label: c.champion,
                      x: a.value,
                      y: b.value,
                      size: m(c.metrics, 'D03')?.sample_size ?? 0,
                      color: GOLD,
                      note: `${a.sample_size} picks · ${b.sample_size} bans · présence ${fmt(m(c.metrics, 'D03')?.value)} %`,
                    },
                  ]
                : [];
            })}
            xLabel="Pick rate (%)"
            yLabel="Ban rate (%)"
            xDomain={[0, 100]}
            yDomain={[0, 100]}
            onSelect={setSelected}
            selected={active?.champion}
            bubbleNote="Surface : nombre de matchs avec présence, avec une taille minimale de lisibilité. Les taux portent sur le périmètre de l’équipe, pas sur toute la ligue."
          />
        </Panel>
        <Panel
          title={active?.champion ?? 'Aucun champion'}
          caption="Fiche de draft sélectionnée"
        >
          {active ? (
            <>
              <div className="draft-spotlight">
                <Ring
                  rate={m(active.metrics, 'D04')?.value ?? null}
                  label="victoires"
                  note={`${m(active.metrics, 'D04')?.sample_size ?? 0} picks avec résultat`}
                />
                <div>
                  {active.metrics
                    .filter((v) => v.id !== 'D04')
                    .map((v) => (
                      <div className="draft-rate" key={v.id}>
                        <span>{v.label}</span>
                        <strong>{fmt(v.value)} %</strong>
                        <div className="profile-track">
                          {finite(v.value) && (
                            <span
                              style={{
                                width: `${v.value}%`,
                                background: v.id === 'D02' ? RED : GOLD,
                              }}
                            />
                          )}
                        </div>
                        <Sample item={v} />
                      </div>
                    ))}
                </div>
              </div>
              <p className="viz-footnote">
                Le win rate concerne uniquement les parties où ce champion a été
                choisi. Il n’est pas une estimation de l’effet causal du pick.
              </p>
            </>
          ) : (
            <Empty />
          )}
        </Panel>
      </div>
      <Panel
        title="Un win rate élevé, sur combien de parties ?"
        caption="Point : taux observé. Segment : intervalle de Wilson à 95 %. Un segment large signale une estimation imprécise."
      >
        <p className="viz-footnote">
          {expanded ? rates.length : Math.min(20, rates.length)} /{' '}
          {rates.length} champions avec résultat, selon le tri sélectionné.
        </p>
        <div className="interval-list">
          {rates.length ? (
            (expanded ? rates : rates.slice(0, 20)).map((c) => {
              const item = m(c.metrics, 'D04')!,
                interval = wilson(item.value, item.sample_size)!;
              return (
                <button
                  className={active === c ? 'selected' : ''}
                  key={c.champion}
                  onClick={() => setSelected(c.champion)}
                >
                  <strong>{c.champion}</strong>
                  <div className="interval-axis">
                    <i className="interval-mid" />
                    <span
                      style={{
                        left: `${interval[0]}%`,
                        width: `${interval[1] - interval[0]}%`,
                      }}
                    />
                    <b style={{ left: `${item.value}%` }} />
                  </div>
                  <span>
                    {fmt(item.value)} %
                    <small>
                      n = {item.sample_size}
                      {item.sample_size < 5 ? ' · faible' : ''}
                    </small>
                    <small>
                      IC {fmt(interval[0])}–{fmt(interval[1])} %
                    </small>
                  </span>
                </button>
              );
            })
          ) : (
            <Empty>Aucun pick avec résultat dans cette sélection.</Empty>
          )}
        </div>
        <p className="viz-footnote">
          Échelle 0–100 %, repère central 50 %. Intervalles binomiaux
          descriptifs ; la dépendance entre matchs et les comparaisons multiples
          ne sont pas corrigées.
        </p>
      </Panel>
      <Panel
        title="Toute la palette de draft"
        caption="Chaque carte conserve les effectifs et les quatre indicateurs. La recherche et les filtres s’appliquent à tous les visuels."
      >
        <div className="champion-cards">
          {(expanded ? champions : champions.slice(0, 24)).map((c) => (
            <button
              key={c.champion}
              className={active === c ? 'active' : ''}
              onClick={() => setSelected(c.champion)}
            >
              <strong>{c.champion}</strong>
              <span>{fmt(m(c.metrics, 'D03')?.value)} % de présence</span>
              <div className="champion-actions">
                <span style={{ color: GOLD }}>
                  P {m(c.metrics, 'D01')?.sample_size ?? 0}
                </span>
                <span style={{ color: RED }}>
                  B {m(c.metrics, 'D02')?.sample_size ?? 0}
                </span>
                <span style={{ color: GREEN }}>
                  V {fmt(m(c.metrics, 'D04')?.value)} %
                </span>
              </div>
            </button>
          ))}
        </div>
        {champions.length > 20 && (
          <button className="expand-viz" onClick={() => setExpanded((v) => !v)}>
            {expanded
              ? 'Réduire la sélection'
              : `Explorer les ${champions.length} champions (cartes et intervalles)`}
          </button>
        )}
        {!champions.length && (
          <Empty>Aucun champion ne correspond aux filtres.</Empty>
        )}
      </Panel>
    </>
  );
}

type TimelinePoint = { date: string; value: number | null; note: string };
function Timeline({
  points,
  unit,
  percent = false,
}: {
  points: TimelinePoint[];
  unit: string;
  percent?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const values = ordered.map((p) => p.value).filter(finite);
  if (!values.length) return <Empty />;
  const min = Math.min(0, ...values),
    max = percent ? 100 : Math.max(1, ...values);
  const first = Date.parse(ordered[0].date),
    last = Date.parse(ordered.at(-1)!.date);
  const x = (date: string) =>
    first === last
      ? 350
      : 65 + ((Date.parse(date) - first) / (last - first)) * 565;
  const y = (v: number) => 245 - ((v - min) / (max - min)) * 195;
  const current = ordered.find((p) => p.date === selected);
  return (
    <>
      <svg
        className="timeline-svg"
        viewBox="0 0 700 300"
        role="group"
        aria-label={`Évolution de ${unit}`}
      >
        {[min, (min + max) / 2, max].map((v, i) => (
          <g key={i}>
            <line
              x1="65"
              x2="630"
              y1={y(v)}
              y2={y(v)}
              className="viz-gridline"
            />
            <text x="54" y={y(v) + 4} textAnchor="end">
              {fmt(v, 0)}
            </text>
          </g>
        ))}
        {min < 0 && (
          <line
            x1="65"
            x2="630"
            y1={y(0)}
            y2={y(0)}
            className="viz-reference"
          />
        )}
        {ordered.map((p, i) => (
          <g key={p.date}>
            {i > 0 &&
              finite(p.value) &&
              finite(ordered[i - 1].value) &&
              Date.parse(p.date) - Date.parse(ordered[i - 1].date) <=
                8 * 86400000 && (
                <line
                  x1={x(ordered[i - 1].date)}
                  x2={x(p.date)}
                  y1={y(ordered[i - 1].value!)}
                  y2={y(p.value)}
                  stroke={GOLD}
                  strokeWidth="2.5"
                />
              )}
            {finite(p.value) && (
              <circle
                cx={x(p.date)}
                cy={y(p.value)}
                r={selected === p.date ? 6 : 4}
                fill={GOLD}
                stroke="#07141d"
                tabIndex={0}
                role="button"
                aria-label={`${p.date} : ${fmt(p.value)} ${unit} ; ${p.note}`}
                onFocus={() => setSelected(p.date)}
                onMouseEnter={() => setSelected(p.date)}
                onClick={() => setSelected(p.date)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(p.date);
                  }
                }}
              >
                <title>
                  {p.date} · {fmt(p.value)} {unit} · {p.note}
                </title>
              </circle>
            )}
          </g>
        ))}
        <text x="65" y="279">
          {ordered[0].date}
        </text>
        <text x="630" y="279" textAnchor="end">
          {ordered.at(-1)!.date}
        </text>
      </svg>
      <div className="point-readout" aria-live="polite">
        {current ? (
          <>
            <strong>
              {current.date} · {fmt(current.value)} {unit}
            </strong>
            <span>{current.note}</span>
          </>
        ) : (
          <span>
            Sélectionne un point pour lire la période et son effectif.
          </span>
        )}
      </div>
      <p className="viz-footnote">
        Axe temporel réel ; une mesure absente ou une interruption de plus d’une
        semaine coupe la courbe.
      </p>
    </>
  );
}
export function TrendVisuals({
  overview,
  matches,
  loading,
  onWeek,
  onMatch,
}: {
  overview: Overview;
  matches: MatchSummary[];
  loading: boolean;
  onWeek: (week: string) => void;
  onMatch: (id: string) => void;
}) {
  const [field, setField] =
    useState<
      keyof Pick<
        Trend,
        'win_rate' | 'gold_diff_at_15' | 'kills_per_game' | 'matches'
      >
    >('win_rate');
  const labels = {
    win_rate: 'Taux de victoire (%)',
    gold_diff_at_15: 'Différence d’or à 15 min',
    kills_per_game: 'Kills / match',
    matches: 'Matchs / semaine',
  };
  const weeks = [...overview.trends].sort((a, b) =>
    a.week.localeCompare(b.week),
  );
  return (
    <>
      <Heading number="06 · La dynamique" title="La saison a une histoire.">
        Lire ensemble les résultats et les volumes : 100 % sur un match n’a pas
        le même poids que sur dix.
      </Heading>
      <Panel
        title="La mosaïque des semaines"
        caption="Chaque case est une semaine observée, datée explicitement. Couleur : taux de victoire. Taille fixe ; le nombre de matchs est indiqué."
      >
        <div className="week-mosaic">
          {weeks.map((p) => (
            <button
              key={p.week}
              onClick={() => onWeek(p.week)}
              style={{
                background: finite(p.win_rate)
                  ? `color-mix(in srgb, ${p.win_rate >= 50 ? GREEN : RED} ${20 + Math.abs(p.win_rate - 50) * 1.1}%, #10232e)`
                  : '#172b35',
              }}
            >
              <small>
                {new Date(p.week + 'T12:00:00Z').toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: 'short',
                })}
              </small>
              <strong>{fmt(p.win_rate, 0)} %</strong>
              <span>{p.matches} matchs</span>
            </button>
          ))}
        </div>
        <p className="viz-footnote">
          Vert ≥ 50 % ; corail &lt; 50 %. Clique pour ouvrir les matchs de la
          semaine. Les semaines sans match ne sont pas ajoutées.
        </p>
      </Panel>
      <Panel title="L’évolution, dans son contexte">
        <div className="viz-controls">
          <label>
            Indicateur
            <select
              value={field}
              onChange={(e) => setField(e.target.value as typeof field)}
            >
              {Object.entries(labels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <Timeline
          points={weeks.map((p) => ({
            date: p.week,
            value: p[field],
            note: `${p.matches} matchs · win rate ${fmt(p.win_rate)} % · GD@15 ${fmt(p.gold_diff_at_15)} · kills/match ${fmt(p.kills_per_game)}`,
          }))}
          unit={labels[field]}
          percent={field === 'win_rate'}
        />
      </Panel>
      <Panel
        title="Résultats dans l’ordre des parties"
        caption="Les séries sont visibles sans lisser les défaites."
      >
        {loading ? (
          <Empty>Chargement…</Empty>
        ) : (
          <Ribbon matches={matches} onMatch={onMatch} />
        )}
      </Panel>
      <Panel
        title="Early game et résultat hebdomadaire"
        caption="Une bulle par semaine. Sa surface représente le nombre de matchs, avec une taille minimale de lisibilité."
      >
        <Scatter
          points={weeks.flatMap((p) =>
            finite(p.gold_diff_at_15) && finite(p.win_rate)
              ? [
                  {
                    id: p.week,
                    label: `Semaine du ${p.week}`,
                    x: p.gold_diff_at_15,
                    y: p.win_rate,
                    size: p.matches,
                    note: `${p.matches} matchs · cliquer pour explorer la semaine`,
                  },
                ]
              : [],
          )}
          xLabel="GD@15 moyen"
          yLabel="Victoires (%)"
          yDomain={[0, 100]}
          onSelect={onWeek}
        />
        <p className="viz-footnote">
          Les moyennes hebdomadaires ne décrivent pas les trajectoires de chaque
          match.
        </p>
      </Panel>
    </>
  );
}
export function MatchVisuals({ detail }: { detail: MatchDetail }) {
  const [stat, setStat] = useState<
    | 'damage_to_champions'
    | 'total_gold'
    | 'total_cs'
    | 'vision_score'
    | 'gold_diff_at_15'
    | 'kills'
    | 'deaths'
    | 'assists'
  >('damage_to_champions');
  const labels = {
    damage_to_champions: 'Dégâts aux champions',
    total_gold: 'Or total',
    total_cs: 'CS',
    vision_score: 'Vision',
    gold_diff_at_15: 'GD@15',
    kills: 'Kills',
    deaths: 'Deaths',
    assists: 'Assists',
  };
  const values = detail.players.map((p) => p[stat]).filter(finite),
    max = Math.max(1, ...values.map(Math.abs));
  const roles = [...new Set(detail.players.map((p) => p.role))];
  return (
    <Panel
      title="Les duels, rôle par rôle"
      caption="Même échelle pour les dix joueurs sur l’indicateur sélectionné."
    >
      <div className="viz-controls">
        <label>
          Mesure
          <select
            value={stat}
            onChange={(e) => setStat(e.target.value as typeof stat)}
          >
            {Object.entries(labels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Legend
        items={[
          ['Côté bleu', BLUE],
          ['Côté rouge', RED],
        ]}
      />
      <div className="duel-grid">
        {roles.map((role) => (
          <section key={role} className="duel-role">
            <h4>{role}</h4>
            {detail.players
              .filter((p) => p.role === role)
              .sort((a, b) => a.side.localeCompare(b.side))
              .map((p) => (
                <article key={p.participant_id}>
                  <header>
                    <div>
                      <strong>{p.player_name}</strong>
                      <small>
                        {p.champion} · {p.team_name}
                      </small>
                    </div>
                    <b>{fmt(p[stat], 0)}</b>
                  </header>
                  <div
                    className={`duel-track${stat === 'gold_diff_at_15' ? ' signed' : ''}`}
                  >
                    {finite(p[stat]) && (
                      <span
                        style={{
                          left:
                            stat === 'gold_diff_at_15'
                              ? `${50 + (Math.min(0, p[stat]!) / max) * 50}%`
                              : '0',
                          width: `${(Math.abs(p[stat]!) / max) * (stat === 'gold_diff_at_15' ? 50 : 100)}%`,
                          background: p.side === 'BLUE' ? BLUE : RED,
                        }}
                      />
                    )}
                  </div>
                  <p>
                    {p.kills ?? '—'} / {p.deaths ?? '—'} / {p.assists ?? '—'}{' '}
                    <small>K / D / A</small>
                  </p>
                </article>
              ))}
          </section>
        ))}
      </div>
      <p className="viz-footnote">
        {stat === 'gold_diff_at_15'
          ? `Échelle symétrique : −${fmt(max, 0)} à +${fmt(max, 0)} or ; zéro au centre.`
          : `Échelle : 0 à ${fmt(max, 0)}.`}{' '}
        Les mesures absentes sont affichées « — ».
      </p>
    </Panel>
  );
}
