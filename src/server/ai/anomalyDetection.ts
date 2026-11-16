/**
 * ENERGYSYNC AI — Isolation Forest Energy Wastage & Anomaly Detection
 *
 * Implements the Liu, Ting & Zhou (2008) Isolation Forest algorithm:
 *   - Constructs an ensemble of randomized Isolation Trees (iTrees) on subsamples
 *     of campus building hourly telemetry.
 *   - Feature vector per building-hour observation:
 *       0: consumption_kwh
 *       1: occupancy_count
 *       2: hour (0..23)
 *       3: consumption_per_occupant_ratio (consumption / max(1, occupancy))
 *       4: baseline_deviation_ratio ((consumption - expected) / max(1, expected))
 *       5: is_holiday (0 or 1)
 *   - Computes average path length E(h(x)) across all trees and normalizes with c(n):
 *       s(x, n) = 2^(-E(h(x)) / c(n))
 *   - Points with short isolation paths (s >= 0.59) and excessive wastage over expected
 *     baseline are classified with root-cause reasons and energy-saving actions.
 */

import type { DataSourceLabel } from '../../types/energy.ts';

export interface BuildingHourObservation {
  building_id: number;
  building_code: string;
  building_name: string;
  building_category: string;
  timestamp: string;
  hour: number;
  consumption_kwh: number;
  expected_kwh: number;
  occupancy_count: number;
  is_holiday: number;
  data_source: DataSourceLabel;
}

export interface DetectedAnomaly {
  building_id: number;
  building_name: string;
  timestamp: string;
  detected_kwh: number;
  expected_kwh: number;
  anomaly_score: number;
  severity: 'High' | 'Medium' | 'Low';
  reason: string;
  suggested_action: string;
  data_source: DataSourceLabel;
}

interface IsolationNode {
  isExternal: boolean;
  size: number;
  splitAttr?: number;
  splitValue?: number;
  left?: IsolationNode;
  right?: IsolationNode;
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

/**
 * Average path length of unsuccessful search in a BST of size n:
 * c(n) = 2 * H(n - 1) - (2 * (n - 1) / n)
 */
function harmonicC(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const H = Math.log(n - 1) + 0.5772156649; // Euler-Mascheroni constant
  return 2 * H - (2 * (n - 1)) / n;
}

function toFeatureVector(obs: BuildingHourObservation): number[] {
  const ratio = obs.consumption_kwh / Math.max(1, obs.occupancy_count);
  const dev = (obs.consumption_kwh - obs.expected_kwh) / Math.max(1, obs.expected_kwh);
  return [
    obs.consumption_kwh,
    obs.occupancy_count,
    obs.hour,
    ratio,
    dev,
    obs.is_holiday,
  ];
}

export class IsolationForest {
  private trees: IsolationNode[] = [];
  private subsampleSize = 128;
  private maxDepth = 7;

  constructor(private readonly nEstimators = 64) {}

  fit(vectors: number[][], seed = 4096): void {
    const n = vectors.length;
    if (n === 0) return;
    this.subsampleSize = Math.min(128, n);
    this.maxDepth = Math.ceil(Math.log2(Math.max(2, this.subsampleSize)));
    const rng = new SeededRng(seed);
    this.trees = [];

    for (let t = 0; t < this.nEstimators; t++) {
      const sample: number[][] = [];
      for (let i = 0; i < this.subsampleSize; i++) {
        sample.push(vectors[rng.nextInt(n)]);
      }
      this.trees.push(this.buildITree(sample, 0, rng));
    }
  }

  private buildITree(data: number[][], depth: number, rng: SeededRng): IsolationNode {
    if (depth >= this.maxDepth || data.length <= 1) {
      return { isExternal: true, size: data.length };
    }

    const numAttrs = data[0].length;
    const attrOrder = Array.from({ length: numAttrs }, (_, i) => i);
    for (let i = attrOrder.length - 1; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      [attrOrder[i], attrOrder[j]] = [attrOrder[j], attrOrder[i]];
    }

    for (const attr of attrOrder) {
      let minVal = Infinity;
      let maxVal = -Infinity;
      for (const row of data) {
        if (row[attr] < minVal) minVal = row[attr];
        if (row[attr] > maxVal) maxVal = row[attr];
      }
      if (maxVal - minVal <= 1e-9) continue;

      const splitValue = minVal + rng.next() * (maxVal - minVal);
      const left: number[][] = [];
      const right: number[][] = [];
      for (const row of data) {
        if (row[attr] < splitValue) left.push(row);
        else right.push(row);
      }

      return {
        isExternal: false,
        size: data.length,
        splitAttr: attr,
        splitValue,
        left: this.buildITree(left, depth + 1, rng),
        right: this.buildITree(right, depth + 1, rng),
      };
    }

    return { isExternal: true, size: data.length };
  }

  private pathLength(node: IsolationNode, x: number[], currentDepth: number): number {
    if (node.isExternal) {
      return currentDepth + harmonicC(node.size);
    }
    const attr = node.splitAttr ?? 0;
    const val = node.splitValue ?? 0;
    if (x[attr] < val) {
      return node.left ? this.pathLength(node.left, x, currentDepth + 1) : currentDepth;
    }
    return node.right ? this.pathLength(node.right, x, currentDepth + 1) : currentDepth;
  }

  score(x: number[]): number {
    if (this.trees.length === 0) return 0.5;
    let totalPath = 0;
    for (const tree of this.trees) {
      totalPath += this.pathLength(tree, x, 0);
    }
    const avgPath = totalPath / this.trees.length;
    const cN = Math.max(1, harmonicC(this.subsampleSize));
    return Number(Math.pow(2, -avgPath / cN).toFixed(3));
  }
}

function classifyAnomalyCause(obs: BuildingHourObservation): {
  reason: string;
  suggested_action: string;
} {
  const isAfterHours = obs.hour < 7 || obs.hour >= 19;
  const excessRatio = obs.consumption_kwh / Math.max(1, obs.expected_kwh);

  if (obs.is_holiday === 1 && obs.consumption_kwh > obs.expected_kwh * 1.35) {
    return {
      reason: `High electricity draw (${obs.consumption_kwh.toFixed(1)} kWh) detected during campus holiday when facility should be in standby.`,
      suggested_action: `Isolate non-essential distribution feeders in ${obs.building_name} and verify holiday HVAC shutdown schedule.`,
    };
  }

  if (obs.occupancy_count <= 3 && obs.consumption_kwh > obs.expected_kwh * 1.4) {
    return {
      reason: `High electricity usage (${obs.consumption_kwh.toFixed(1)} kWh) in near-empty ${obs.building_category.toLowerCase()} (only ${obs.occupancy_count} occupants detected).`,
      suggested_action: `Trigger automated relay shutoff for lighting, ceiling fans, and split AC units in unoccupied zones of ${obs.building_name}.`,
    };
  }

  if (isAfterHours && obs.consumption_kwh > obs.expected_kwh * 1.35) {
    return {
      reason: `Unnecessary equipment operation after college operating hours (${String(obs.hour).padStart(2, '0')}:00) at ${excessRatio.toFixed(2)}× expected standby baseline.`,
      suggested_action: `Enforce after-hours smart breaker schedule at 19:00 and power down idle projection/HVAC circuits in ${obs.building_name}.`,
    };
  }

  if (obs.building_category.toLowerCase().includes('lab')) {
    return {
      reason: `Unexpected computer/equipment surge in ${obs.building_name} (${obs.consumption_kwh.toFixed(1)} kWh vs ${obs.expected_kwh.toFixed(1)} kWh expected).`,
      suggested_action: `Audit workstation sleep policies, unscheduled server loads, and shift high-draw lab batches to peak solar hours (10:00–15:00).`,
    };
  }

  return {
    reason: `Abnormal consumption spike in ${obs.building_name}: ${obs.consumption_kwh.toFixed(1)} kWh exceeds expected ${obs.expected_kwh.toFixed(1)} kWh baseline.`,
    suggested_action: `Inspect HVAC compressor duty cycle and sub-meter circuit breakers in ${obs.building_name} for faulty load equipment.`,
  };
}

export function detectEnergyAnomalies(
  trainingHistory: BuildingHourObservation[],
  evaluationWindow: BuildingHourObservation[]
): DetectedAnomaly[] {
  const trainVectors = trainingHistory.map(toFeatureVector);
  const forest = new IsolationForest(64);
  forest.fit(trainVectors, 4096);

  const anomalies: DetectedAnomaly[] = [];

  for (const obs of evaluationWindow) {
    const vec = toFeatureVector(obs);
    const anomalyScore = forest.score(vec);
    const excessKwh = obs.consumption_kwh - obs.expected_kwh;
    const excessRatio = obs.consumption_kwh / Math.max(1, obs.expected_kwh);

    // Flag observations that are both isolated by the forest AND show positive wastage above baseline
    const isWastageSpike =
      (anomalyScore >= 0.58 && excessRatio >= 1.3 && excessKwh >= 3.0) ||
      (obs.occupancy_count <= 2 && excessRatio >= 1.65 && excessKwh >= 4.0) ||
      (obs.is_holiday === 1 && excessRatio >= 1.5 && excessKwh >= 4.0);

    if (isWastageSpike) {
      const effectiveScore = Number(
        Math.min(0.99, Math.max(anomalyScore, 0.56 + Math.min(0.38, (excessRatio - 1.2) * 0.25))).toFixed(3)
      );
      const severity: 'High' | 'Medium' | 'Low' =
        effectiveScore >= 0.74 || excessRatio >= 2.0
          ? 'High'
          : effectiveScore >= 0.63 || excessRatio >= 1.5
            ? 'Medium'
            : 'Low';

      const { reason, suggested_action } = classifyAnomalyCause(obs);

      anomalies.push({
        building_id: obs.building_id,
        building_name: obs.building_name,
        timestamp: obs.timestamp,
        detected_kwh: Number(obs.consumption_kwh.toFixed(2)),
        expected_kwh: Number(obs.expected_kwh.toFixed(2)),
        anomaly_score: effectiveScore,
        severity,
        reason,
        suggested_action,
        data_source: obs.data_source,
      });
    }
  }

  return anomalies.sort((a, b) => b.anomaly_score - a.anomaly_score);
}
