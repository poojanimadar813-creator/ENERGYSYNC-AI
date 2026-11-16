import React, { useEffect, useState } from 'react';
import { ArrowRight, Building2, Globe2, GraduationCap, MapPin, PlusCircle, UserCheck } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { DashboardSummary, StateDashboardSummary, UserPublic } from '../types/energy.ts';

interface WelcomeSectionProps {
  user: UserPublic;
  campusDashboard: DashboardSummary | null;
  onGoToDashboard: () => void;
  onNavigate: (tab: string) => void;
}

export const WelcomeSection: React.FC<WelcomeSectionProps> = ({
  user,
  campusDashboard,
  onGoToDashboard,
  onNavigate,
}) => {
  const [stateData, setStateData] = useState<StateDashboardSummary | null>(null);

  useEffect(() => {
    apiFetch<StateDashboardSummary>('/api/state/dashboard')
      .then(setStateData)
      .catch(() => {
        // fallback gracefully if still loading
      });
  }, []);

  return (
    <div className="space-y-6">
      {/* Main Welcome Hero Panel */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <p className="text-xs font-medium tracking-wider text-emerald-400 uppercase">
              Smart Campus &amp; State Microgrid Network
            </p>
            <h1
              className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-white"
              style={{ textWrap: 'balance' }}
            >
              Welcome to ENERGYSYNC AI
            </h1>
            <p className="text-sm sm:text-base text-violet-300 font-medium">
              Karnataka Statewide Smart Energy Management Network
            </p>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Centralized AI demand forecasting, Isolation Forest energy wastage detection, rooftop
              solar PV monitoring, and battery storage dispatch across Karnataka higher-education
              campuses.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={onGoToDashboard}
              className="flex items-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 px-5 py-3 text-sm font-medium text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Go to Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('state_dashboard')}
              className="flex items-center gap-2 rounded-lg border border-slate-700 hover:border-slate-500 px-4 py-3 text-sm font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Globe2 className="w-4 h-4 text-emerald-400" />
              <span>Karnataka State Dashboard</span>
            </button>
          </div>
        </div>

        {/* Logged-in User Role & College/District Info */}
        <div className="mt-6 pt-5 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <UserCheck className="w-4 h-4 text-violet-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-slate-400">Signed-In User &amp; Role</div>
              <div className="text-sm font-medium text-white truncate">
                {user.name} · <span className="text-emerald-400">{user.role}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <GraduationCap className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-slate-400">Assigned Institution</div>
              <div className="text-sm font-medium text-white truncate">
                {user.college || 'BLDEACET Vijayapura'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <MapPin className="w-4 h-4 text-amber-300 shrink-0" />
            <div className="min-w-0">
              <div className="text-[11px] text-slate-400">District Node</div>
              <div className="text-sm font-medium text-white truncate">
                {user.district ? `${user.district}, Karnataka` : 'Vijayapura, Karnataka'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Campus & Statewide Snapshots */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Registered Karnataka Campuses</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-white">
            {stateData ? stateData.kpis.total_colleges : '—'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Across {stateData ? stateData.kpis.covered_districts : '—'} active districts
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Statewide Solar Capacity</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-emerald-400">
            {stateData ? `${stateData.kpis.total_solar_capacity_kwp} kWp` : '—'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {stateData ? `${stateData.kpis.total_solar_generation_kwh} kWh/day generated` : 'Loading...'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Local Campus Demand Today</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-violet-300">
            {campusDashboard ? `${campusDashboard.kpis.today_consumption_kwh} kWh` : '—'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {campusDashboard
              ? `Battery SOC ${campusDashboard.kpis.battery_soc_pct.toFixed(1)}%`
              : 'Syncing campus node...'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Statewide Calculated Savings</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-emerald-400">
            {stateData ? `₹${stateData.kpis.total_estimated_savings_inr.toLocaleString()}/day` : '—'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            Estimated tariff &amp; solar offset
          </div>
        </div>
      </div>

      {/* Quick Navigation Shortcuts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button
          onClick={onGoToDashboard}
          className="text-left rounded-xl border border-slate-800/90 hover:border-violet-500/50 bg-[#0D1526] p-5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-base font-semibold text-white">
              Campus Overview Dashboard
            </span>
            <Building2 className="w-4 h-4 text-violet-400 shrink-0" />
          </div>
          <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
            Open the live BLDEACET microgrid dashboard with AI forecasts, energy flow, and battery optimization.
          </p>
        </button>

        <button
          onClick={() => onNavigate('college_registry')}
          className="text-left rounded-xl border border-slate-800/90 hover:border-emerald-500/50 bg-[#0D1526] p-5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-base font-semibold text-white">
              College Registry
            </span>
            <GraduationCap className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
            Browse connected engineering campuses across Karnataka districts, inspect solar &amp; battery status.
          </p>
        </button>

        <button
          onClick={() => onNavigate('add_college')}
          className="text-left rounded-xl border border-slate-800/90 hover:border-violet-500/50 bg-[#0D1526] p-5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-base font-semibold text-white">
              Add College to Network
            </span>
            <PlusCircle className="w-4 h-4 text-violet-400 shrink-0" />
          </div>
          <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
            Onboard a new institution with district mapping, rooftop PV capacity, and storage bank specs.
          </p>
        </button>
      </div>
    </div>
  );
};
