import type { MatchSummary, Metric } from './types';

export const getMetric = (items: Metric[], id: string) =>
  items.find((m) => m.id === id);
export const finite = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value);
export const fmt = (value: number | null | undefined, digits = 1) =>
  finite(value)
    ? value.toLocaleString('fr-FR', { maximumFractionDigits: digits })
    : '—';
export const chronological = (matches: MatchSummary[]) =>
  [...matches].sort(
    (a, b) =>
      (a.played_at ?? '').localeCompare(b.played_at ?? '') ||
      a.game_id.localeCompare(b.game_id),
  );
export function wilson(
  rate: number | null | undefined,
  n: number,
): [number, number] | null {
  if (!finite(rate) || n <= 0) return null;
  const p = rate / 100,
    z = 1.96,
    d = 1 + (z * z) / n;
  const mid = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, (mid - half) * 100), Math.min(100, (mid + half) * 100)];
}
export function conversionGroups(matches: MatchSummary[]) {
  const valid = matches.filter(
    (m) => finite(m.gold_diff_at_15) && (m.result === 0 || m.result === 1),
  );
  return [
    {
      label: 'En retard à 15 min',
      items: valid.filter((m) => m.gold_diff_at_15! < 0),
    },
    {
      label: 'À égalité à 15 min',
      items: valid.filter((m) => m.gold_diff_at_15 === 0),
    },
    {
      label: 'En avance à 15 min',
      items: valid.filter((m) => m.gold_diff_at_15! > 0),
    },
  ].map((g) => ({
    ...g,
    wins: g.items.filter((m) => m.result === 1).length,
    rate: g.items.length
      ? (g.items.filter((m) => m.result === 1).length / g.items.length) * 100
      : null,
  }));
}
export const durationBins = [0, 20, 25, 30, 35, 40];
export function durationDistribution(matches: MatchSummary[]) {
  return durationBins.map((min, i) => {
    const max = durationBins[i + 1] ?? Infinity;
    const items = matches.filter(
      (m) =>
        finite(m.duration_seconds) &&
        m.duration_seconds / 60 >= min &&
        m.duration_seconds / 60 < max,
    );
    return {
      label: i === 0 ? '< 20' : i === 5 ? '≥ 40' : `${min}–${max}`,
      wins: items.filter((m) => m.result === 1).length,
      losses: items.filter((m) => m.result === 0).length,
    };
  });
}
