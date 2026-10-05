import test from 'node:test';
import assert from 'node:assert/strict';
import {
  conversionGroups,
  durationDistribution,
  wilson,
} from '../src/app/analytics.ts';
import type { MatchSummary } from '../src/app/types.ts';
const match = (
  gold: number | null,
  result: number,
  duration: number | null = 1500,
) =>
  ({
    gold_diff_at_15: gold,
    result,
    duration_seconds: duration,
  }) as MatchSummary;
test('conversion excludes missing gold, separates equality and preserves zero wins', () => {
  const groups = conversionGroups([
    match(null, 1),
    match(-500, 0),
    match(0, 1),
    match(500, 1),
    match(1000, 0),
  ]);
  assert.deepEqual(
    groups.map((g) => [g.items.length, g.wins, g.rate]),
    [
      [1, 0, 0],
      [1, 1, 100],
      [2, 1, 50],
    ],
  );
  assert.ok(conversionGroups([]).every((g) => g.rate === null));
});
test('duration bins are mutually exclusive at exact boundaries and exclude missing durations', () => {
  const bins = durationDistribution([
    match(0, 1, 1199),
    match(0, 0, 1200),
    match(0, 1, 1500),
    match(0, 0, 1800),
    match(0, 1, 2100),
    match(0, 0, 2400),
    match(0, 1, null),
  ]);
  assert.deepEqual(
    bins.map((b) => b.wins + b.losses),
    [1, 1, 1, 1, 1, 1],
  );
});
test('Wilson intervals retain uncertainty for perfect records and shrink with sample size', () => {
  assert.equal(wilson(null, 10), null);
  assert.equal(wilson(100, 0), null);
  assert.ok(Math.abs(wilson(50, 100)![0] - 40.38298) < 0.001);
  const small = wilson(100, 2)!,
    large = wilson(100, 100)!;
  assert.ok(small[0] < large[0] && small[1] === 100);
  assert.ok(wilson(0, 2)![1] > 50);
});
