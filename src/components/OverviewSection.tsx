import React, { useMemo } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { ChartCanvas } from './ChartCanvas.tsx';
import { EnergyFlowDiagram } from './EnergyFlowDiagram.tsx';
import type { DashboardSummary } from '../types/energy.ts';

interface OverviewSectionProps {
  data: DashboardSummary;
  onNavigate: (tab: string) => void;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({ data, onNavigate }) => {
  const { kpis, hourly_series, building_breakdown, recent_alerts, top_recommendations, simulation_state } =
    data;

  const mainChartConfig = useMemo<ChartConfiguration<'line'>>(
    () => ({
      type: 'line',
      data: {
        labels: hourly_series.map((h) => h.label),
        datasets: [
          {
            label: 'Actual / Simulated Load (kWh)',
            data: hourly_series.map((h) => h.consumption_kwh),
            borderColor: '#A78BFA',
            backgroundColor: 'rgba(139, 92, 246, 0.14)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 2,
          },
          {
            label: 'Random Forest Forecast (kWh)',
            data: hourly_series.map((h) => h.predicted_kwh),
            borderColor: '#38BDF8',
            borderDash: [5, 4],
            fill: false,
            tension: 0.35,
            borderWidth: 1.75,
            pointRadius: 0,
          },
          {
            label: 'Solar PV Generation (kWh)',
            data: hourly_series.map((h) => h.solar_kwh),
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
            pointRadius: 0,
          },
          {
            label: 'Optimized Grid Import (kWh)',
            data: hourly_series.map((h) => h.grid_kwh),
            borderColor: '#F59E0B',
            fill: false,
            tension: 0.35,
            borderWidth: 1.5,
            pointRadius: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            labels: { color: '#CBD5E1', boxWidth: 12, font: { family: 'DM Sans', size: 11 } },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
          y: {
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
            title: { display: true, text: 'Energy (kWh)', color: '#94A3B8', font: { size: 11 } },
          },
        },
      },
    }),
    [hourly_series]
  );

  const kpiCards = [
    {
      label: "Today's Consumption",
      value: `${kpis.today_consumption_kwh.toLocaleString()} kWh`,
      detail: `15-day cumulative ${kpis.total_consumption_kwh.toLocaleString()} kWh`,
      tone: 'text-white',
    },
    {
      label: 'Monthly Projection',
      value: `${kpis.monthly_consumption_kwh.toLocaleString()} kWh`,
      detail: `Est. daily bill ₹${kpis.estimated_daily_cost_inr.toLocaleString()}`,
      tone: 'text-white',
    },
    {
      label: 'Solar Generation Today',
      value: `${kpis.solar_generation_today_kwh.toLocaleString()} kWh`,
      detail: `${kpis.solar_utilization_pct}% solar utilized`,
      tone: 'text-emerald-400',
    },
    {
      label: 'Battery State of Charge',
      value: `${kpis.battery_soc_pct.toFixed(1)}%`,
      detail: `${kpis.battery_stored_kwh.toFixed(1)} / ${kpis.battery_capacity_kwh} kWh stored`,
      tone: 'text-violet-300',
    },
    {
      label: 'Grid Electricity Usage',
      value: `${kpis.grid_usage_today_kwh.toLocaleString()} kWh`,
      detail: 'After solar & battery dispatch',
      tone: 'text-amber-300',
    },
    {
      label: 'Calculated Savings',
      value: `₹${kpis.estimated_savings_inr.toLocaleString()}`,
      detail: `${kpis.estimated_savings_kwh} kWh offset today (est.)`,
      tone: 'text-emerald-400',
    },
    {
      label: 'Active Energy Alerts',
      value: `${kpis.active_alerts_count}`,
      detail: 'Isolation Forest wastage flags',
      tone: kpis.active_alerts_count > 0 ? 'text-rose-400' : 'text-emerald-400',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Campus Energy Operations Overview
          </h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{data.campus_name}</span>
            <span aria-hidden="true">·</span>
            <span>Scenario: {simulation_state.scenario_name}</span>
            <span aria-hidden="true">·</span>
            <span>Weather: {simulation_state.weather_condition}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-300">{simulation_state.data_source}</span>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-4 flex flex-col justify-between"
          >
            <div className="text-xs text-slate-400">{card.label}</div>
            <div className={`mt-2 font-mono text-lg font-semibold tabular-nums ${card.tone}`}>
              {card.value}
            </div>
            <div className="mt-1.5 text-[11px] text-slate-400 truncate">{card.detail}</div>
          </div>
        ))}
      </div>

      {/* Energy Flow Schematic */}
      <EnergyFlowDiagram
        flow={data.energy_flow}
        batterySocPct={kpis.battery_soc_pct}
        dataSource={simulation_state.data_source}
      />

      {/* Main 24-Hour Telemetry Chart & Building Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 rounded-xl border border-slate-800/90 bg-[#0D1526] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                24-Hour Campus Load, AI Demand Forecast &amp; Solar Profile
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Compares measured/simulated hourly campus demand against Random Forest predictions and rooftop PV output.
              </p>
            </div>
            <button
              onClick={() => onNavigate('prediction')}
              className="text-xs font-medium text-violet-400 hover:text-violet-300 whitespace-nowrap cursor-pointer"
            >
              Inspect AI Model →
            </button>
          </div>
          <ChartCanvas config={mainChartConfig} height={310} />
        </div>

        <div className="xl:col-span-4 rounded-xl border border-slate-800/90 bg-[#0D1526] p-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="font-display text-base font-semibold text-white">
              Building Load Breakdown
            </h3>
            <button
              onClick={() => onNavigate('monitoring')}
              className="text-xs font-medium text-violet-400 hover:text-violet-300 whitespace-nowrap cursor-pointer"
            >
              Details →
            </button>
          </div>
          <div className="divide-y divide-slate-800/80 flex-1">
            {building_breakdown.map((b) => (
              <div key={b.id} className="py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-100 truncate">{b.name}</div>
                  <div className="text-xs text-slate-400">
                    {b.category} · Peak <span className="font-mono tabular-nums">{b.peak_kw} kW</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm font-semibold tabular-nums text-white">
                    {b.today_kwh} kWh
                  </div>
                  <div
                    className={`font-mono text-[11px] tabular-nums ${
                      b.efficiency_delta_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {b.efficiency_delta_pct >= 0 ? `${b.efficiency_delta_pct}% below base` : `${Math.abs(b.efficiency_delta_pct)}% over base`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row: Active Alerts & Top Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="font-display text-base font-semibold text-white">
              Recent Isolation Forest Alerts
            </h3>
            <button
              onClick={() => onNavigate('anomalies')}
              className="text-xs font-medium text-violet-400 hover:text-violet-300 whitespace-nowrap cursor-pointer"
            >
              View All Alerts →
            </button>
          </div>
          {recent_alerts.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-400">
              No wastage anomalies detected in the current cycle.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/80">
              {recent_alerts.map((alert) => (
                <div key={alert.id} className="py-3 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {alert.building_name}
                    </span>
                    <span
                      className={`font-mono text-xs font-medium tabular-nums ${
                        alert.severity === 'High'
                          ? 'text-rose-400'
                          : alert.severity === 'Medium'
                            ? 'text-amber-300'
                            : 'text-slate-300'
                      }`}
                    >
                      {alert.severity} · Score {alert.anomaly_score}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">{alert.reason}</p>
                  <div className="text-[11px] font-mono text-slate-300 tabular-nums">
                    Detected {alert.detected_kwh} kWh vs Expected {alert.expected_kwh} kWh
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="font-display text-base font-semibold text-white">
              AI Optimization Recommendations
            </h3>
            <button
              onClick={() => onNavigate('recommendations')}
              className="text-xs font-medium text-violet-400 hover:text-violet-300 whitespace-nowrap cursor-pointer"
            >
              Manage Queue →
            </button>
          </div>
          <div className="divide-y divide-slate-800/80">
            {top_recommendations.map((rec) => (
              <div key={rec.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-100">{rec.title}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {rec.category} · Priority {rec.priority} · Status {rec.status}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-sm font-semibold tabular-nums text-emerald-400">
                    -₹{rec.estimated_savings_inr}/day
                  </div>
                  <div className="font-mono text-[11px] tabular-nums text-slate-400">
                    {rec.estimated_savings_kwh} kWh
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
