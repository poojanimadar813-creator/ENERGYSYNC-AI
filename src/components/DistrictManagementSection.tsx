import React, { useEffect, useState } from 'react';
import { MapPin, PlusCircle } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { DistrictRecord } from '../types/energy.ts';

export const DistrictManagementSection: React.FC = () => {
  const [districts, setDistricts] = useState<DistrictRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [zone, setZone] = useState('Kittur Karnataka');
  const [officer, setOfficer] = useState('');
  const [targetPct, setTargetPct] = useState('20');
  const [tariffZone, setTariffZone] = useState('HESCOM Institutional HT-2');
  const [msg, setMsg] = useState<{ text: string; isError: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const loadDistricts = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ districts: DistrictRecord[] }>('/api/state/districts');
      setDistricts(res.districts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDistricts();
  }, []);

  const handleAddDistrict = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setSaving(true);
    try {
      await apiFetch('/api/state/districts', {
        method: 'POST',
        body: JSON.stringify({
          code,
          name,
          zone,
          nodal_officer: officer || 'District Nodal Energy Officer',
          target_savings_pct: Number(targetPct),
          tariff_zone: tariffZone,
        }),
      });
      setCode('');
      setName('');
      setOfficer('');
      setMsg({ text: 'Karnataka district node registered successfully.', isError: false });
      await loadDistricts();
    } catch (err) {
      setMsg({
        text: err instanceof Error ? err.message : 'Unable to create district.',
        isError: true,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTargetBump = async (d: DistrictRecord, delta: number) => {
    const next = Math.min(50, Math.max(5, Number((d.target_savings_pct + delta).toFixed(1))));
    await apiFetch(`/api/state/districts/${d.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ target_savings_pct: next }),
    });
    await loadDistricts();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-semibold text-white">District Management</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Manage Karnataka district energy nodes, ESCOM tariff zones, nodal officers, and efficiency targets.
        </p>
      </div>

      {/* Add New District Form */}
      <form
        onSubmit={handleAddDistrict}
        className="rounded-xl border border-slate-800 bg-[#0D1526] p-5 space-y-4"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <MapPin className="w-4 h-4 text-violet-400" />
          <span>Register Karnataka District Node</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end">
          <div>
            <label className="block text-xs text-slate-400 mb-1">District Code *</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="KA-BGK"
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">District Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Bagalkot"
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Region Zone</label>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 text-xs text-white"
            >
              <option value="Kittur Karnataka">Kittur Karnataka</option>
              <option value="Kalyana Karnataka">Kalyana Karnataka</option>
              <option value="South Karnataka">South Karnataka</option>
              <option value="Coastal Karnataka">Coastal Karnataka</option>
              <option value="Central Karnataka">Central Karnataka</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Nodal Officer</label>
            <input
              type="text"
              value={officer}
              onChange={(e) => setOfficer(e.target.value)}
              placeholder="Dr. A. B. Desai"
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 text-xs text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">ESCOM Tariff Zone</label>
            <select
              value={tariffZone}
              onChange={(e) => setTariffZone(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 text-xs text-white"
            >
              <option value="HESCOM Institutional HT-2">HESCOM Institutional HT-2</option>
              <option value="BESCOM Institutional HT-2">BESCOM Institutional HT-2</option>
              <option value="GESCOM Institutional HT-2">GESCOM Institutional HT-2</option>
              <option value="MESCOM Institutional HT-2">MESCOM Institutional HT-2</option>
              <option value="CESC Mysuru HT-2">CESC Mysuru HT-2</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-20">
              <label className="block text-xs text-slate-400 mb-1">Target %</label>
              <input
                type="number"
                min="5"
                max="50"
                value={targetPct}
                onChange={(e) => setTargetPct(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-2.5 py-2 font-mono text-xs text-white"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 py-2 px-3 text-xs font-medium text-white cursor-pointer whitespace-nowrap"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </div>
        </div>

        {msg && (
          <div className={`text-xs ${msg.isError ? 'text-rose-400' : 'text-emerald-400'}`}>
            {msg.text}
          </div>
        )}
      </form>

      {/* Districts Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] overflow-x-auto">
        {loading ? (
          <div className="p-8 text-sm text-slate-400">Loading districts...</div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-3 px-4 font-medium">Code</th>
                <th className="py-3 px-4 font-medium">District</th>
                <th className="py-3 px-4 font-medium">Zone &amp; Utility</th>
                <th className="py-3 px-4 font-medium">Nodal Officer</th>
                <th className="py-3 px-4 font-medium text-right">Colleges</th>
                <th className="py-3 px-4 font-medium text-right">Solar (kWp)</th>
                <th className="py-3 px-4 font-medium text-right">Daily Demand (kWh)</th>
                <th className="py-3 px-4 font-medium text-right">Savings Target</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {districts.map((d) => (
                <tr key={d.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-mono text-violet-300">{d.code}</td>
                  <td className="py-3 px-4 font-medium text-white">{d.name}</td>
                  <td className="py-3 px-4 text-slate-300">
                    <div>{d.zone}</div>
                    <div className="text-[11px] text-slate-400">{d.tariff_zone}</div>
                  </td>
                  <td className="py-3 px-4 text-slate-300">{d.nodal_officer}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-white">
                    {d.college_count ?? 0}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-300">
                    {d.total_solar_kwp ?? 0}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                    {d.total_daily_demand_kwh ?? 0}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        onClick={() => void handleTargetBump(d, -1)}
                        className="px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
                        aria-label={`Decrease target for ${d.name}`}
                      >
                        -
                      </button>
                      <span className="text-emerald-400 w-10 text-center">
                        {d.target_savings_pct}%
                      </span>
                      <button
                        onClick={() => void handleTargetBump(d, 1)}
                        className="px-1.5 py-0.5 rounded border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
                        aria-label={`Increase target for ${d.name}`}
                      >
                        +
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
