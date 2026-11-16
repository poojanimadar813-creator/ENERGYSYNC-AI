import React, { useEffect, useMemo, useState } from 'react';
import type { ChartConfiguration } from 'chart.js';
import { CloudSun } from 'lucide-react';
import { ChartCanvas } from './ChartCanvas.tsx';
import { apiFetch } from '../lib/api.ts';
import type { WeatherCondition, WeatherForecastResult } from '../types/energy.ts';

export const WeatherPredictionSection: React.FC = () => {
  const [weather, setWeather] = useState<WeatherCondition>('Clear Sunny');
  const [tempC, setTempC] = useState(31);
  const [cloudPct, setCloudPct] = useState(15);
  const [data, setData] = useState<WeatherForecastResult | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({
      weather,
      temp: String(tempC),
      cloud: String(cloudPct),
    });
    apiFetch<WeatherForecastResult>(`/api/advanced/weather-forecast?${params.toString()}`).then(
      setData
    );
  }, [weather, tempC, cloudPct]);

  const chartConfig = useMemo<ChartConfiguration<'line'> | null>(() => {
    if (!data) return null;
    return {
      type: 'line',
      data: {
        labels: data.hourly.map((h) => h.label),
        datasets: [
          {
            label: 'Weather-Adjusted Demand (kWh)',
            data: data.hourly.map((h) => h.predicted_demand_kwh),
            borderColor: '#8B5CF6',
            backgroundColor: 'rgba(139, 92, 246, 0.14)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
          },
          {
            label: 'Predicted Solar PV (kWh)',
            data: data.hourly.map((h) => h.predicted_solar_kwh),
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.14)',
            fill: true,
            tension: 0.35,
            borderWidth: 2,
          },
          {
            label: 'Residual Net Grid (kWh)',
            data: data.hourly.map((h) => h.net_grid_kwh),
            borderColor: '#F59E0B',
            borderDash: [4, 4],
            fill: false,
            tension: 0.35,
            borderWidth: 1.6,
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">
          Weather-Based Energy Prediction
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Models ambient temperature thermal HVAC sensitivity, cloud cover attenuation, and solar irradiance to forecast demand and PV generation.
        </p>
      </div>

      {/* Weather Parameter Controls */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5 grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Weather Condition</label>
          <div className="flex flex-wrap gap-1.5">
            {(['Clear Sunny', 'Partly Cloudy', 'Monsoon Overcast'] as const).map((w) => (
              <button
                key={w}
                onClick={() => {
                  setWeather(w);
                  setCloudPct(w === 'Clear Sunny' ? 12 : w === 'Partly Cloudy' ? 45 : 82);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                  weather === w
                    ? 'bg-violet-600 text-white'
                    : 'bg-[#080D1A] border border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400">Ambient Peak Temperature</span>
            <span className="font-mono text-amber-300">{tempC}°C</span>
          </div>
          <input
            type="range"
            min="18"
            max="44"
            value={tempC}
            onChange={(e) => setTempC(Number(e.target.value))}
            className="w-full accent-violet-500"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-slate-400">Cloud Cover Attenuation</span>
            <span className="font-mono text-sky-300">{cloudPct}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="95"
            value={cloudPct}
            onChange={(e) => setCloudPct(Number(e.target.value))}
            className="w-full accent-emerald-500"
          />
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
            <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
              <div className="text-xs text-slate-400">Peak Solar Irradiance</div>
              <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-amber-300">
                {data.peak_irradiance_wm2} W/m²
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
              <div className="text-xs text-slate-400">Weather-Adjusted Demand</div>
              <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
                {data.predicted_daily_demand_kwh} kWh
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
              <div className="text-xs text-slate-400">Predicted Solar Yield</div>
              <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
                {data.predicted_solar_kwh} kWh
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
              <div className="text-xs text-slate-400">Renewable Share (RE%)</div>
              <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-violet-300">
                {data.renewable_share_pct}%
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-display text-base font-semibold text-white">
                24-Hour Meteorological Demand &amp; Solar Forecast
              </h3>
              <CloudSun className="w-5 h-5 text-amber-300" />
            </div>
            {chartConfig && <ChartCanvas config={chartConfig} height={300} />}
          </div>
        </>
      )}
    </div>
  );
};
