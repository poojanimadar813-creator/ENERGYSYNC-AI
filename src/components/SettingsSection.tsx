import React, { useEffect, useState } from 'react';
import { KeyRound, Save, BookOpen } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { WeatherCondition } from '../types/energy.ts';

interface SettingsResponse {
  simulation_state: {
    scenario_name: string;
    weather_condition: WeatherCondition;
    is_holiday: number;
    tariff_offpeak_inr: number;
    tariff_standard_inr: number;
    tariff_peak_inr: number;
  };
}

interface ApiDocsSpec {
  info: { title: string; version: string; description: string };
  paths: Record<string, Record<string, { summary: string }>>;
}

interface SettingsSectionProps {
  onDataChanged: () => void;
}

export const SettingsSection: React.FC<SettingsSectionProps> = ({ onDataChanged }) => {
  const [weather, setWeather] = useState<WeatherCondition>('Clear Sunny');
  const [isHoliday, setIsHoliday] = useState(false);
  const [offpeakTariff, setOffpeakTariff] = useState(4.8);
  const [stdTariff, setStdTariff] = useState(6.9);
  const [peakTariff, setPeakTariff] = useState(9.6);
  const [simMsg, setSimMsg] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [authMsg, setAuthMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const [docs, setDocs] = useState<ApiDocsSpec | null>(null);

  useEffect(() => {
    apiFetch<SettingsResponse>('/api/settings').then((res) => {
      setWeather(res.simulation_state.weather_condition);
      setIsHoliday(Boolean(res.simulation_state.is_holiday));
      setOffpeakTariff(res.simulation_state.tariff_offpeak_inr);
      setStdTariff(res.simulation_state.tariff_standard_inr);
      setPeakTariff(res.simulation_state.tariff_peak_inr);
    });
    apiFetch<ApiDocsSpec>('/api/docs').then(setDocs);
  }, []);

  const saveTariffsAndScenario = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimMsg(null);
    await apiFetch('/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        weather_condition: weather,
        is_holiday: isHoliday,
        tariff_offpeak_inr: offpeakTariff,
        tariff_standard_inr: stdTariff,
        tariff_peak_inr: peakTariff,
      }),
    });
    setSimMsg('Tariff rates and simulation settings saved. Battery optimization recalculated.');
    onDataChanged();
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthMsg(null);
    try {
      const res = await apiFetch<{ message: string }>('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword, newName }),
      });
      setAuthMsg({ text: res.message, isError: false });
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setAuthMsg({
        text: err instanceof Error ? err.message : 'Failed to update credentials.',
        isError: true,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">
          System Settings, Tariffs &amp; API Reference
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Configure Time-of-Use utility tariffs, simulation mode defaults, administrator password, and inspect REST endpoints.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Simulation & Tariff Config */}
        <form
          onSubmit={saveTariffsAndScenario}
          className="rounded-xl border border-slate-800 bg-[#0D1526] p-5 space-y-4"
        >
          <h3 className="font-display text-base font-semibold text-white">
            Utility Tariff &amp; Simulation Parameters
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Weather Condition</label>
              <select
                value={weather}
                onChange={(e) => setWeather(e.target.value as WeatherCondition)}
                className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 text-sm text-white"
              >
                <option value="Clear Sunny">Clear Sunny</option>
                <option value="Partly Cloudy">Partly Cloudy</option>
                <option value="Monsoon Overcast">Monsoon Overcast</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isHoliday}
                  onChange={(e) => setIsHoliday(e.target.checked)}
                  className="rounded border-slate-600 bg-[#080D1A]"
                />
                <span>Simulate Campus Holiday</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Off-Peak (₹/kWh)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                value={offpeakTariff}
                onChange={(e) => setOffpeakTariff(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Standard (₹/kWh)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                value={stdTariff}
                onChange={(e) => setStdTariff(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Peak (₹/kWh)</label>
              <input
                type="number"
                step="0.1"
                min="1"
                value={peakTariff}
                onChange={(e) => setPeakTariff(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-sm text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-medium text-white transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save &amp; Recalculate Optimization</span>
          </button>

          {simMsg && <div className="text-xs text-emerald-400">{simMsg}</div>}
        </form>

        {/* Administrator Credentials */}
        <form
          onSubmit={handlePasswordChange}
          className="rounded-xl border border-slate-800 bg-[#0D1526] p-5 space-y-4"
        >
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-400" />
            <h3 className="font-display text-base font-semibold text-white">
              Administrator Credentials
            </h3>
          </div>
          <p className="text-xs text-slate-400">
            Passwords are stored as salted scrypt hashes in SQLite. Update the default demonstration credentials here.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Display Name (optional)</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Dr. Campus Energy Admin"
                className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Current Password</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 text-sm text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">New Password (min 8 chars)</label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 text-sm text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-medium text-white transition-colors cursor-pointer"
          >
            Update Administrator Password
          </button>

          {authMsg && (
            <div className={`text-xs ${authMsg.isError ? 'text-rose-400' : 'text-emerald-400'}`}>
              {authMsg.text}
            </div>
          )}
        </form>
      </div>

      {/* API Documentation / Endpoint Explorer */}
      {docs && (
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-5">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-violet-400" />
            <h3 className="font-display text-base font-semibold text-white">
              REST API Endpoint Specification (OpenAPI {docs.info.version})
            </h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
            {Object.entries(docs.paths).map(([path, methods]) =>
              Object.entries(methods).map(([method, meta]) => (
                <div
                  key={`${method}-${path}`}
                  className="rounded-lg border border-slate-800 bg-[#080D1A] px-3.5 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <span
                      className={`font-mono font-semibold uppercase mr-2 ${
                        method === 'get' ? 'text-emerald-400' : 'text-violet-300'
                      }`}
                    >
                      {method}
                    </span>
                    <span className="font-mono text-slate-200">{path}</span>
                    <div className="text-[11px] text-slate-400 mt-0.5 truncate">{meta.summary}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
