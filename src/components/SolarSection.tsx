import React, { useEffect, useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { Sun } from 'lucide-react';
import { ChartCanvas } from './ChartCanvas.tsx';
import { apiFetch } from '../lib/api.ts';
import type { DataSourceLabel, WeatherCondition } from '../types/energy.ts';

interface SolarResponse {
  weather_condition: WeatherCondition;
  data_source: DataSourceLabel;
  pv_array_capacity_kwp: number;
  totals: {
    total_generated_kwh: number;
    total_consumed_direct_kwh: number;
    total_excess_kwh: number;
    total_battery_charged_kwh: number;
    total_grid_import_kwh: number;
    solar_utilization_pct: number;
  };
  hourly: Array<{
    hour: number;
    irradiance_wm2: number;
    generated_kwh: number;
    consumed_direct_kwh: number;
    excess_kwh: number;
    battery_charged_kwh: number;
    grid_import_kwh: number;
  }>;
}

interface SolarSectionProps {
  onDataChanged: () => void;
}

export const SolarSection: React.FC<SolarSectionProps> = ({ onDataChanged }) => {
  const [data, setData] = useState<SolarResponse | null>(null);
  const [updatingWeather, setUpdatingWeather] = useState(false);

  const loadSolar = async () => {
    const res = await apiFetch<SolarResponse>('/api/solar');
    setData(res);
  };

  useEffect(() => {
    void loadSolar();
  }, []);

  const changeWeather = async (weather: WeatherCondition) => {
    setUpdatingWeather(true);
    try {
      await apiFetch('/api/simulation/run', {
        method: 'POST',
        body: JSON.stringify({ weather_condition: weather }),
      });
      await loadSolar();
      onDataChanged();
    } finally {
      setUpdatingWeather(false);
    }
  };

  const solarChart = useMemo<ChartConfiguration<'bar'> | null>(() => {
    if (!data) return null;
    return {
      type: 'bar',
      data: {
        labels: data.hourly.map((h) => `${String(h.hour).padStart(2, '0')}:00`),
        datasets: [
          {
            label: 'Direct Solar Consumed (kWh)',
            data: data.hourly.map((h) => h.consumed_direct_kwh),
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderRadius: 3,
          },
          {
            label: 'Excess Solar to Battery (kWh)',
            data: data.hourly.map((h) => h.battery_charged_kwh),
            backgroundColor: 'rgba(139, 92, 246, 0.8)',
            borderRadius: 3,
          },
          {
            label: 'Grid Import Fallback (kWh)',
            data: data.hourly.map((h) => h.grid_import_kwh),
            backgroundColor: 'rgba(245, 158, 11, 0.6)',
            borderRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#CBD5E1', boxWidth: 12, font: { size: 11 } } },
        },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
          y: {
            stacked: true,
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#94A3B8', font: { family: 'JetBrains Mono', size: 10 } },
          },
        },
      },
    };
  }, [data]);

  if (!data) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-sm text-slate-400">
        Loading rooftop solar PV telemetry...
      </div>
    );
  }

  const weathers: WeatherCondition[] = ['Clear Sunny', 'Partly Cloudy', 'Monsoon Overcast'];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Solar PV Generation &amp; Allocation
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {data.pv_array_capacity_kwp} kWp Campus Rooftop Array ·{' '}
            <span className="font-mono text-slate-300">{data.data_source}</span>
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-[#0D1526] border border-slate-800">
          {weathers.map((w) => (
            <button
              key={w}
              disabled={updatingWeather}
              onClick={() => changeWeather(w)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                data.weather_condition === w
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Total Solar Generated</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-amber-300">
            {data.totals.total_generated_kwh} kWh
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Solar Consumed Directly</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            {data.totals.total_consumed_direct_kwh} kWh
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Excess Solar Available</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
            {data.totals.total_excess_kwh} kWh
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Supplied to Battery</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-violet-300">
            {data.totals.total_battery_charged_kwh} kWh
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Grid Import Required</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-slate-200">
            {data.totals.total_grid_import_kwh} kWh
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Solar Utilization</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            {data.totals.solar_utilization_pct}%
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              Hourly Solar Allocation &amp; Grid Fallback ({data.weather_condition})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Demonstrates direct rooftop PV consumption, battery surplus capture, and residual grid import across 24 hours.
            </p>
          </div>
          <Sun className="w-5 h-5 text-amber-300 shrink-0" />
        </div>
        {solarChart && <ChartCanvas config={solarChart} height={320} />}
      </div>
    </div>
  );
};
