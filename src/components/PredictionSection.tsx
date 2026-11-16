import React, { useEffect, useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { ChartCanvas } from './ChartCanvas.tsx';
import { apiFetch } from '../lib/api.ts';
import type { PredictionSummary } from '../types/energy.ts';

export const PredictionSection: React.FC = () => {
  const [data, setData] = useState<PredictionSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<PredictionSummary>('/api/energy/prediction')
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const forecastChart = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!data) return null;
    return {
      type: 'line',
      data: {
        labels: data.hourly_forecast.map((p) => p.label),
        datasets: [
          {
            label: 'Upper Confidence Bound',
            data: data.hourly_forecast.map((p) => p.confidence_upper),
            borderColor: 'rgba(139, 92, 246, 0.25)',
            borderDash: [3, 3],
            fill: false,
            pointRadius: 0,
            tension: 0.35,
          },
          {
            label: 'Random Forest Predicted Demand (kWh)',
            data: data.hourly_forecast.map((p) => p.predicted_kwh),
            borderColor: '#8B5CF6',
            backgroundColor: 'rgba(139, 92, 246, 0.14)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.2,
          },
          {
            label: 'Actual / Observed Load (kWh)',
            data: data.hourly_forecast.map((p) => p.actual_kwh ?? null),
            borderColor: '#10B981',
            fill: false,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 2.5,
          },
          {
            label: 'Lower Confidence Bound',
            data: data.hourly_forecast.map((p) => p.confidence_lower),
            borderColor: 'rgba(139, 92, 246, 0.25)',
            borderDash: [3, 3],
            fill: false,
            pointRadius: 0,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { labels: { color: '#CBD5E1', boxWidth: 12, font: { size: 11 } } },
        },
        scales: {
          x: {
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
          y: {
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
        },
      },
    };
  }, [data]);

  const featureChart = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (!data) return null;
    return {
      type: 'bar',
      data: {
        labels: data.feature_importance.map((f) => f.feature),
        datasets: [
          {
            label: 'Split Importance (%)',
            data: data.feature_importance.map((f) => f.importance_pct),
            backgroundColor: 'rgba(16, 185, 129, 0.72)',
            borderRadius: 4,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
          y: {
            grid: { display: false },
            ticks: { color: '#CBD5E1', font: { size: 11 } },
          },
        },
      },
    };
  }, [data]);

  if (loading || !data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-sm text-slate-400">
        Training and evaluating Random Forest Regression model on chronological campus dataset...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            AI Energy Demand Prediction
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {data.model_name} · Chronological split ({data.train_samples} train / {data.test_samples} test hourly intervals) ·{' '}
            <span className="font-mono text-slate-300">{data.data_source}</span>
          </p>
        </div>
      </div>

      {/* Model KPIs & Evaluation Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Test MAE</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            {data.mae} kWh
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Mean Absolute Error</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Test RMSE</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-violet-300">
            {data.rmse} kWh
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Root Mean Squared Error</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Test R² Fit</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
            {data.r2_score}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Chronological holdout</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Predicted Daily Load</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
            {data.predicted_daily_total_kwh} kWh
          </div>
          <div className="mt-1 text-[11px] text-slate-400">24-hour forecast sum</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Expected Peak Demand</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-amber-300">
            {data.expected_peak_demand_kwh} kWh
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            At {String(data.expected_peak_hour).padStart(2, '0')}:00 hrs
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Recommended Window</div>
          <div className="mt-1.5 font-mono text-xs font-semibold text-emerald-400 leading-snug">
            {data.recommended_utilization_window}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">Heavy lab batch scheduling</div>
        </div>
      </div>

      {/* Actual vs Predicted Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 rounded-xl border border-slate-800 bg-[#0D1526] p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Actual vs. Random Forest Predicted Demand (24h Cycle)
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Uses 7 input features: Hour, Day of Week, Month, Historical Load (t-1), Classroom Occupancy, Temperature, and Solar Generation.
          </p>
          {forecastChart && <ChartCanvas config={forecastChart} height={310} />}
        </div>

        <div className="xl:col-span-4 rounded-xl border border-slate-800 bg-[#0D1526] p-5">
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Random Forest Feature Importance
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Relative contribution of each telemetry feature across 36 decision trees.
          </p>
          {featureChart && <ChartCanvas config={featureChart} height={310} />}
        </div>
      </div>

      {/* Chronological Holdout Evaluation Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5">
        <h3 className="font-display text-base font-semibold text-white mb-1">
          Chronological Test Dataset Verification
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Recent held-out test timestamps comparing observed campus consumption against out-of-sample Random Forest predictions.
        </p>
        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-2.5 px-3 font-medium">Timestamp</th>
                <th className="py-2.5 px-3 font-medium text-right">Actual (kWh)</th>
                <th className="py-2.5 px-3 font-medium text-right">Predicted (kWh)</th>
                <th className="py-2.5 px-3 font-medium text-right">Residual Error (kWh)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 font-mono tabular-nums">
              {data.test_evaluation.slice(-16).map((row) => (
                <tr key={row.timestamp} className="hover:bg-slate-800/30">
                  <td className="py-2 px-3 text-slate-300">{row.timestamp.replace('T', ' ')}</td>
                  <td className="py-2 px-3 text-right text-white">{row.actual_kwh.toFixed(2)}</td>
                  <td className="py-2 px-3 text-right text-violet-300">
                    {row.predicted_kwh.toFixed(2)}
                  </td>
                  <td
                    className={`py-2 px-3 text-right ${
                      Math.abs(row.error_kwh) <= data.mae ? 'text-emerald-400' : 'text-amber-300'
                    }`}
                  >
                    {row.error_kwh >= 0 ? `+${row.error_kwh.toFixed(2)}` : row.error_kwh.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
