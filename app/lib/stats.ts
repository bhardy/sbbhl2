export type Summary = {
  n: number;
  mean: number;
  median: number;
  p25: number;
  p75: number;
  stdev: number;
  min: number;
  max: number;
  /** where the mean sits in the player's own distribution (0-100) */
  meanPercentile: number;
  /** mean - median; positive means the average is being propped up by a few big games */
  delta: number;
  /** delta as a fraction of the median */
  deltaPct: number;
  /** Pearson's second skewness coefficient: 3 * (mean - median) / stdev */
  skew: number;
};

/** Linear-interpolated percentile (same convention as numpy's default). */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo);
}

/** Percentile rank of `value` within `sorted` (0-100), ties count as half. */
export function percentileRank(sorted: number[], value: number): number {
  if (sorted.length === 0) return NaN;
  let below = 0;
  let equal = 0;
  for (const v of sorted) {
    if (v < value) below++;
    else if (v === value) equal++;
  }
  return ((below + equal / 2) / sorted.length) * 100;
}

export function summarize(values: number[]): Summary {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = n ? sorted.reduce((a, b) => a + b, 0) / n : NaN;
  const median = percentile(sorted, 50);
  const variance = n ? sorted.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n : NaN;
  const stdev = Math.sqrt(variance);
  const delta = mean - median;
  return {
    n,
    mean,
    median,
    p25: percentile(sorted, 25),
    p75: percentile(sorted, 75),
    stdev,
    min: sorted[0] ?? NaN,
    max: sorted[n - 1] ?? NaN,
    meanPercentile: percentileRank(sorted, mean),
    delta,
    deltaPct: median !== 0 ? delta / Math.abs(median) : NaN,
    skew: stdev > 0 ? (3 * delta) / stdev : 0,
  };
}
