import React, { useEffect, useState } from 'react';
import { PlusCircle, Search } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { CollegeRecord, DistrictRecord } from '../types/energy.ts';

interface CollegeRegistrySectionProps {
  onNavigate: (tab: string) => void;
}

export const CollegeRegistrySection: React.FC<CollegeRegistrySectionProps> = ({ onNavigate }) => {
  const [colleges, setColleges] = useState<CollegeRecord[]>([]);
  const [districts, setDistricts] = useState<DistrictRecord[]>([]);
  const [search, setSearch] = useState('');
  const [districtFilter, setDistrictFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Onboarding' | 'Maintenance'>('All');
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadRegistry = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (districtFilter) params.set('district_id', districtFilter);
      if (statusFilter !== 'All') params.set('status', statusFilter);
      if (search.trim()) params.set('q', search.trim());

      const [cRes, dRes] = await Promise.all([
        apiFetch<{ colleges: CollegeRecord[] }>(`/api/state/colleges?${params.toString()}`),
        apiFetch<{ districts: DistrictRecord[] }>('/api/state/districts'),
      ]);
      setColleges(cRes.colleges);
      setDistricts(dRes.districts);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRegistry();
  }, [districtFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void loadRegistry();
  };

  const handleStatusChange = async (
    id: number,
    nextStatus: 'Active' | 'Onboarding' | 'Maintenance'
  ) => {
    setUpdatingId(id);
    try {
      await apiFetch(`/api/state/colleges/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await loadRegistry();
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">College Registry</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Search, filter, and manage institutions connected to the Karnataka ENERGYSYNC AI network.
          </p>
        </div>

        <button
          onClick={() => onNavigate('add_college')}
          className="flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-3.5 py-2 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Add College</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4 flex flex-wrap items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search college, code, city, or district..."
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg border border-slate-700 hover:border-slate-500 px-3 py-1.5 text-xs font-medium text-slate-200 cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={districtFilter}
            onChange={(e) => setDistrictFilter(e.target.value)}
            className="rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-1.5 text-xs text-white focus:border-violet-500 focus:outline-none"
          >
            <option value="">All Districts</option>
            {districts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 p-1 rounded-lg bg-[#080D1A] border border-slate-800">
            {(['All', 'Active', 'Onboarding', 'Maintenance'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                  statusFilter === s ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Registry Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] overflow-x-auto">
        {loading ? (
          <div className="p-8 text-sm text-slate-400">Loading registered campuses...</div>
        ) : colleges.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No institutions match the active filters.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="py-3 px-4 font-medium">Code</th>
                <th className="py-3 px-4 font-medium">Institution</th>
                <th className="py-3 px-4 font-medium">District / City</th>
                <th className="py-3 px-4 font-medium text-right">Solar (kWp)</th>
                <th className="py-3 px-4 font-medium text-right">BESS (kWh)</th>
                <th className="py-3 px-4 font-medium text-right">Daily Load (kWh)</th>
                <th className="py-3 px-4 font-medium text-right">Est. Savings</th>
                <th className="py-3 px-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {colleges.map((c) => (
                <tr key={c.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-mono text-violet-300">{c.code}</td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-white">{c.name}</div>
                    <div className="text-[11px] text-slate-400">
                      {c.campus_type} · {c.connected_buildings} buildings
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-300">
                    {c.district_name} · <span className="text-slate-400">{c.city}</span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-amber-300">
                    {c.solar_capacity_kwp}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-200">
                    {c.battery_capacity_kwh} ({c.battery_soc_pct}%)
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-white">
                    {c.daily_demand_kwh}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-400">
                    ₹{c.estimated_savings_inr.toLocaleString()}/day
                  </td>
                  <td className="py-3 px-4">
                    <select
                      disabled={updatingId === c.id}
                      value={c.status}
                      onChange={(e) =>
                        void handleStatusChange(
                          c.id,
                          e.target.value as 'Active' | 'Onboarding' | 'Maintenance'
                        )
                      }
                      className="rounded border border-slate-700 bg-[#080D1A] px-2 py-1 text-xs text-white"
                    >
                      <option value="Active">Active</option>
                      <option value="Onboarding">Onboarding</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
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
