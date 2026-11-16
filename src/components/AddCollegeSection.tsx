import React, { useEffect, useState } from 'react';
import { CheckCircle2, PlusCircle } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { CollegeRecord, DistrictRecord } from '../types/energy.ts';

interface AddCollegeSectionProps {
  onNavigate: (tab: string) => void;
}

export const AddCollegeSection: React.FC<AddCollegeSectionProps> = ({ onNavigate }) => {
  const [districts, setDistricts] = useState<DistrictRecord[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [districtId, setDistrictId] = useState<number>(1);
  const [city, setCity] = useState('');
  const [campusType, setCampusType] = useState('Engineering College');
  const [buildings, setBuildings] = useState('5');
  const [solarKwp, setSolarKwp] = useState('120');
  const [batteryKwh, setBatteryKwh] = useState('200');
  const [dailyDemand, setDailyDemand] = useState('1650');
  const [status, setStatus] = useState<'Active' | 'Onboarding' | 'Maintenance'>('Active');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdCollege, setCreatedCollege] = useState<CollegeRecord | null>(null);

  useEffect(() => {
    apiFetch<{ districts: DistrictRecord[] }>('/api/state/districts').then((res) => {
      setDistricts(res.districts);
      if (res.districts.length > 0) {
        setDistrictId(res.districts[0].id);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreatedCollege(null);
    setSubmitting(true);
    try {
      const res = await apiFetch<{ ok: boolean; college: CollegeRecord }>('/api/state/colleges', {
        method: 'POST',
        body: JSON.stringify({
          code,
          name,
          district_id: districtId,
          city,
          campus_type: campusType,
          connected_buildings: Number(buildings),
          solar_capacity_kwp: Number(solarKwp),
          battery_capacity_kwh: Number(batteryKwh),
          daily_demand_kwh: Number(dailyDemand),
          status,
        }),
      });
      setCreatedCollege(res.college);
      setCode('');
      setName('');
      setCity('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register college.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">Add College</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Register a new Karnataka institution into the SQLite statewide energy network.
          </p>
        </div>
        <button
          onClick={() => onNavigate('college_registry')}
          className="rounded-lg border border-slate-700 hover:border-slate-500 px-3.5 py-2 text-xs font-medium text-slate-200 cursor-pointer"
        >
          View College Registry
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/30 px-4 py-3 text-xs text-rose-200">
          {error}
        </div>
      )}

      {createdCollege && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-emerald-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Registered <strong className="text-white">{createdCollege.name}</strong> ({createdCollege.code}) in{' '}
              {createdCollege.district_name} · Est. savings ₹{createdCollege.estimated_savings_inr}/day.
            </span>
          </div>
          <button
            onClick={() => onNavigate('college_registry')}
            className="text-xs font-medium text-emerald-300 hover:text-emerald-200 cursor-pointer"
          >
            Open Registry →
          </button>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-slate-800 bg-[#0D1526] p-6 space-y-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Institution Code *</label>
            <input
              type="text"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g., BEC-BGK"
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3.5 py-2 font-mono text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Institution Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Basaveshwar Engineering College"
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Karnataka District *</label>
            <select
              value={districtId}
              onChange={(e) => setDistrictId(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
            >
              {districts.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">City / Town *</label>
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g., Bagalkot"
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Campus Type</label>
            <select
              value={campusType}
              onChange={(e) => setCampusType(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 text-sm text-white focus:border-violet-500 focus:outline-none"
            >
              <option value="Engineering College">Engineering College</option>
              <option value="Technical University">Technical University</option>
              <option value="Polytechnic Institute">Polytechnic Institute</option>
              <option value="Medical & Allied Campus">Medical &amp; Allied Campus</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Buildings</label>
            <input
              type="number"
              min="1"
              max="50"
              value={buildings}
              onChange={(e) => setBuildings(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Solar PV (kWp)</label>
            <input
              type="number"
              min="0"
              max="2000"
              value={solarKwp}
              onChange={(e) => setSolarKwp(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Battery (kWh)</label>
            <input
              type="number"
              min="0"
              max="5000"
              value={batteryKwh}
              onChange={(e) => setBatteryKwh(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Daily Load (kWh)</label>
            <input
              type="number"
              min="100"
              max="20000"
              value={dailyDemand}
              onChange={(e) => setDailyDemand(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 font-mono text-sm text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-300 mb-1.5">Initial Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'Active' | 'Onboarding' | 'Maintenance')}
              className="w-full rounded-lg border border-slate-700 bg-[#080D1A] px-3 py-2 text-sm text-white"
            >
              <option value="Active">Active</option>
              <option value="Onboarding">Onboarding</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-5 py-2.5 text-sm font-medium text-white transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{submitting ? 'Registering College...' : 'Register College in Network'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
