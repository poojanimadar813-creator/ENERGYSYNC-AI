/**
 * ENERGYSYNC AI — Random Forest Energy Demand Prediction Engine
 *
 * Implements a genuine Random Forest Regressor (ensemble of CART Decision Regression Trees
 * trained on bootstrap resamples with random feature subsampling at each split).
 *
 * Input Features (7):
 *   0: hour (0..23)
 *   1: day_of_week (0..6)
 *   2: month (1..12)
 *   3: historical_consumption_kwh (previous hour campus demand)
 *   4: occupancy_rate (0..1 normalized campus occupancy)
 *   5: temperature_c (ambient temperature in Celsius)
 *   6: solar_generation_kwh (current solar PV generation)
 *
 * Chronological Evaluation:
 *   - Splits historical hourly campus series chronologically (80% train, 20% test)
 *   - Computes real MAE, RMSE, and R² on the held-out chronological test window
 */

import type { DataSourceLabel, PredictionSummary } from '../../types/energy.ts';

export interface HourlyCampusSample {
  timestamp: string;
  hour: number;
  day_of_week: number;
  month: number;
  historical_kwh: number;
  occupancy_rate: number;
  temperature_c: number;
  solar_generation_kwh: number;
  total_kwh: number;
}

interface RegressionNode {
  isLeaf: boolean;
  value?: number;
  featureIndex?: number;
  threshold?: number;
  left?: RegressionNode;
  right?: RegressionNode;
}

class SeededRng {
  private state: number;
  constructor(seed: number) {
    this.state = seed % 2147483647;
    if (this.state <= 0) this.state += 2147483646;
  }
  next(): number {
    this.state = (this.state * 16807) % 2147483647;
    return (this.state - 1) / 2147483646;
  }
  nextInt(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
}

const FEATURE_NAMES = [
  'Hour of Day',
  'Day of Week',
  'Month',
  'Historical Consumption (t-1)',
  'Classroom Occupancy Rate',
  'Ambient Temperature (°C)',
  'Solar Generation (kWh)',
];

function sampleToFeatures(s: HourlyCampusSample): number[] {
  return [
    s.hour,
    s.day_of_week,
    s.month,
    s.historical_kwh,
    s.occupancy_rate,
    s.temperature_c,
    s.solar_generation_kwh,
  ];
}

function mean(vals: number[]): number {
  if (vals.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < vals.length; i++) sum += vals[i];
  return sum / vals.length;
}

export class RandomForestRegressor {
  private trees: RegressionNode[] = [];
  private featureSplitCounts: number[] = new Array(7).fill(0);
  private readonly nEstimators: number;
  private readonly maxDepth: number;
  private readonly minSamplesSplit: number;
  private readonly maxFeatures: number;

  constructor(options?: {
    nEstimators?: number;
    maxDepth?: number;
    minSamplesSplit?: number;
    maxFeatures?: number;
  }) {
    this.nEstimators = options?.nEstimators ?? 32;
    this.maxDepth = options?.maxDepth ?? 8;
    this.minSamplesSplit = options?.minSamplesSplit ?? 4;
    this.maxFeatures = options?.maxFeatures ?? 3; // sqrt(7) ≈ 3
  }

  fit(X: number[][], y: number[], seed = 2026): void {
    const n = X.length;
    if (n === 0) return;
    const rng = new SeededRng(seed);
    this.trees = [];
    this.featureSplitCounts = new Array(X[0].length).fill(0);

    for (let t = 0; t < this.nEstimators; t++) {
      // Bootstrap sample with replacement
      const bootIndices: number[] = new Array(n);
      for (let i = 0; i < n; i++) {
        bootIndices[i] = rng.nextInt(n);
      }
      const tree = this.buildTree(X, y, bootIndices, 0, rng);
      this.trees.push(tree);
    }
  }

  private buildTree(
    X: number[][],
    y: number[],
    indices: number[],
    depth: number,
    rng: SeededRng
  ): RegressionNode {
    const targets = indices.map((idx) => y[idx]);
    const leafVal = mean(targets);

    if (depth >= this.maxDepth || indices.length < this.minSamplesSplit) {
      return { isLeaf: true, value: leafVal };
    }

    // Check if targets are virtually identical
    let minY = Infinity;
    let maxY = -Infinity;
    for (const val of targets) {
      if (val < minY) minY = val;
      if (val > maxY) maxY = val;
    }
    if (maxY - minY < 1e-6) {
      return { isLeaf: true, value: leafVal };
    }

    // Select random subset of features (mtry = maxFeatures)
    const numFeatures = X[0].length;
    const featureCandidates = Array.from({ length: numFeatures }, (_, i) => i);
    for (let i = featureCandidates.length - 1; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      [featureCandidates[i], featureCandidates[j]] = [featureCandidates[j], featureCandidates[i]];
    }
    const selectedFeatures = featureCandidates.slice(0, this.maxFeatures);

    let bestFeature = -1;
    let bestThreshold = 0;
    let bestScore = Infinity; // Minimize weighted MSE
    let bestLeft: number[] = [];
    let bestRight: number[] = [];

    for (const fIdx of selectedFeatures) {
      // Sort indices by feature value for fast linear scan
      const sorted = [...indices].sort((a, b) => X[a][fIdx] - X[b][fIdx]);
      let totalSum = 0;
      let totalSqSum = 0;
      for (const idx of sorted) {
        const val = y[idx];
        totalSum += val;
        totalSqSum += val * val;
      }

      let leftSum = 0;
      let leftSqSum = 0;
      const nTotal = sorted.length;

      for (let i = 0; i < nTotal - 1; i++) {
        const idx = sorted[i];
        const nextIdx = sorted[i + 1];
        const val = y[idx];
        leftSum += val;
        leftSqSum += val * val;

        const leftCount = i + 1;
        const rightCount = nTotal - leftCount;

        // Skip duplicate feature values
        if (Math.abs(X[idx][fIdx] - X[nextIdx][fIdx]) < 1e-9) {
          continue;
        }
        if (leftCount < 2 || rightCount < 2) {
          continue;
        }

        const rightSum = totalSum - leftSum;
        const rightSqSum = totalSqSum - leftSqSum;

        const leftSse = leftSqSum - (leftSum * leftSum) / leftCount;
        const rightSse = rightSqSum - (rightSum * rightSum) / rightCount;
        const weightedSse = leftSse + rightSse;

        if (weightedSse < bestScore) {
          bestScore = weightedSse;
          bestFeature = fIdx;
          bestThreshold = (X[idx][fIdx] + X[nextIdx][fIdx]) / 2;
        }
      }
    }

    if (bestFeature === -1) {
      return { isLeaf: true, value: leafVal };
    }

    for (const idx of indices) {
      if (X[idx][bestFeature] <= bestThreshold) {
        bestLeft.push(idx);
      } else {
        bestRight.push(idx);
      }
    }

    if (bestLeft.length === 0 || bestRight.length === 0) {
      return { isLeaf: true, value: leafVal };
    }

    this.featureSplitCounts[bestFeature] += 1;

    return {
      isLeaf: false,
      featureIndex: bestFeature,
      threshold: bestThreshold,
      left: this.buildTree(X, y, bestLeft, depth + 1, rng),
      right: this.buildTree(X, y, bestRight, depth + 1, rng),
    };
  }

  private predictTree(node: RegressionNode, row: number[]): number {
    if (node.isLeaf) return node.value ?? 0;
    const fIdx = node.featureIndex ?? 0;
    const thresh = node.threshold ?? 0;
    if (row[fIdx] <= thresh) {
      return node.left ? this.predictTree(node.left, row) : 0;
    }
    return node.right ? this.predictTree(node.right, row) : 0;
  }

  predictWithUncertainty(row: number[]): { mean: number; std: number } {
    if (this.trees.length === 0) return { mean: 0, std: 0 };
    const preds = this.trees.map((t) => this.predictTree(t, row));
    const avg = mean(preds);
    let sqDiff = 0;
    for (const p of preds) sqDiff += (p - avg) ** 2;
    const std = Math.sqrt(sqDiff / preds.length);
    return { mean: avg, std };
  }

  getFeatureImportance(): Array<{ feature: string; importance_pct: number }> {
    const total = this.featureSplitCounts.reduce((a, b) => a + b, 0) || 1;
    return FEATURE_NAMES.map((feature, idx) => ({
      feature,
      importance_pct: Number(((this.featureSplitCounts[idx] / total) * 100).toFixed(1)),
    })).sort((a, b) => b.importance_pct - a.importance_pct);
  }
}

export function trainAndEvaluatePredictionModel(
  chronologicalSeries: HourlyCampusSample[],
  todaySeries: HourlyCampusSample[],
  dataSource: DataSourceLabel
): PredictionSummary {
  // Ensure chronological order
  const sorted = [...chronologicalSeries].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // 80% / 20% chronological train-test split
  const splitIdx = Math.max(24, Math.floor(sorted.length * 0.8));
  const trainSet = sorted.slice(0, splitIdx);
  const testSet = sorted.slice(splitIdx);

  const XTrain = trainSet.map(sampleToFeatures);
  const yTrain = trainSet.map((s) => s.total_kwh);

  const rf = new RandomForestRegressor({
    nEstimators: 36,
    maxDepth: 8,
    minSamplesSplit: 4,
    maxFeatures: 3,
  });
  rf.fit(XTrain, yTrain, 2026);

  // Evaluate on held-out chronological test set
  let sumAbsErr = 0;
  let sumSqErr = 0;
  const actuals: number[] = [];
  const testEvaluation: PredictionSummary['test_evaluation'] = [];

  for (const s of testSet) {
    const { mean: pred } = rf.predictWithUncertainty(sampleToFeatures(s));
    const roundedPred = Number(Math.max(0, pred).toFixed(2));
    const err = roundedPred - s.total_kwh;
    sumAbsErr += Math.abs(err);
    sumSqErr += err * err;
    actuals.push(s.total_kwh);
    testEvaluation.push({
      timestamp: s.timestamp,
      actual_kwh: Number(s.total_kwh.toFixed(2)),
      predicted_kwh: roundedPred,
      error_kwh: Number(err.toFixed(2)),
    });
  }

  const nTest = Math.max(1, testSet.length);
  const mae = Number((sumAbsErr / nTest).toFixed(2));
  const rmse = Number(Math.sqrt(sumSqErr / nTest).toFixed(2));
  const meanActual = mean(actuals);
  const ssTot = actuals.reduce((acc, v) => acc + (v - meanActual) ** 2, 0) || 1;
  const r2Score = Number(Math.max(0, 1 - sumSqErr / ssTot).toFixed(3));

  // Generate 24-hour forecast for today/next cycle
  const hourlyForecast: PredictionSummary['hourly_forecast'] = [];
  let rollingHistoricalKwh =
    todaySeries.length > 0 ? todaySeries[0].historical_kwh : sorted[sorted.length - 1]?.total_kwh ?? 45;

  for (let h = 0; h < 24; h++) {
    const match = todaySeries.find((s) => s.hour === h);
    const sample: HourlyCampusSample = match ?? {
      timestamp: `Forecast-${String(h).padStart(2, '0')}:00`,
      hour: h,
      day_of_week: new Date().getDay(),
      month: new Date().getMonth() + 1,
      historical_kwh: rollingHistoricalKwh,
      occupancy_rate: h >= 8 && h <= 17 ? 0.72 : 0.08,
      temperature_c: 24 + 9 * Math.sin(((h - 6) * Math.PI) / 14),
      solar_generation_kwh: h >= 6 && h <= 18 ? 62 * Math.sin(((h - 6) * Math.PI) / 12) : 0,
      total_kwh: 0,
    };

    const { mean: predMean, std } = rf.predictWithUncertainty(sampleToFeatures(sample));
    const predictedKwh = Number(Math.max(8, predMean).toFixed(2));
    rollingHistoricalKwh = match ? match.total_kwh : predictedKwh;

    hourlyForecast.push({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      actual_kwh: match ? Number(match.total_kwh.toFixed(2)) : null,
      predicted_kwh: predictedKwh,
      confidence_lower: Number(Math.max(5, predictedKwh - 1.28 * std).toFixed(2)),
      confidence_upper: Number((predictedKwh + 1.28 * std).toFixed(2)),
      solar_kwh: Number(sample.solar_generation_kwh.toFixed(2)),
      temperature_c: Number(sample.temperature_c.toFixed(1)),
      occupancy_rate: Number((sample.occupancy_rate * 100).toFixed(0)),
    });
  }

  const predictedDailyTotal = Number(
    hourlyForecast.reduce((acc, p) => acc + p.predicted_kwh, 0).toFixed(2)
  );
  let peakPoint = hourlyForecast[0];
  for (const p of hourlyForecast) {
    if (p.predicted_kwh > peakPoint.predicted_kwh) peakPoint = p;
  }

  // Recommend optimal heavy-load utilization window (high solar + lower net grid impact)
  let bestSolarHour = 12;
  let bestSolar = -1;
  for (const p of hourlyForecast) {
    if (p.solar_kwh > bestSolar) {
      bestSolar = p.solar_kwh;
      bestSolarHour = p.hour;
    }
  }
  const winStart = `${String(Math.max(9, bestSolarHour - 2)).padStart(2, '0')}:00`;
  const winEnd = `${String(Math.min(16, bestSolarHour + 2)).padStart(2, '0')}:00`;

  return {
    model_name: 'Random Forest Regressor (36 Trees, Max Depth 8)',
    features_used: FEATURE_NAMES,
    train_samples: trainSet.length,
    test_samples: testSet.length,
    mae,
    rmse,
    r2_score: r2Score,
    predicted_daily_total_kwh: predictedDailyTotal,
    expected_peak_demand_kwh: peakPoint.predicted_kwh,
    expected_peak_hour: peakPoint.hour,
    recommended_utilization_window: `${winStart} – ${winEnd} (Peak Solar Surplus Window)`,
    hourly_forecast: hourlyForecast,
    test_evaluation: testEvaluation.slice(-48),
    feature_importance: rf.getFeatureImportance(),
    data_source: dataSource,
  };
}
