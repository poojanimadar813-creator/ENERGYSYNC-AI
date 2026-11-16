import React from 'react';
import { Sun, Zap, BatteryCharging, Building2, ArrowRight, UtilityPole } from 'lucide-react';
import type { DashboardSummary, DataSourceLabel } from '../types/energy.ts';

interface EnergyFlowDiagramProps {
  flow: DashboardSummary['energy_flow'];
  batterySocPct: number;
  dataSource: DataSourceLabel;
}

export const EnergyFlowDiagram: React.FC<EnergyFlowDiagramProps> = ({
  flow,
  batterySocPct,
  dataSource,
}) => {
  const nodes = [
    {
      title: 'Solar Generation',
      value: `${flow.solar_generated_kw.toFixed(1)} kW`,
      sub: '115 kWp Rooftop PV',
      icon: Sun,
      accent: 'text-amber-300 border-amber-500/30 bg-amber-950/20',
    },
    {
      title: 'Direct Consumption',
      value: `${flow.solar_direct_kw.toFixed(1)} kW`,
      sub: 'Zero-loss daytime supply',
      icon: Zap,
      accent: 'text-emerald-300 border-emerald-500/30 bg-emerald-950/20',
    },
    {
      title: 'Excess Solar to Storage',
      value: `${flow.excess_solar_to_battery_kw.toFixed(1)} kW`,
      sub: 'Surplus PV buffering',
      icon: BatteryCharging,
      accent: 'text-violet-300 border-violet-500/30 bg-violet-950/25',
    },
    {
      title: 'Battery Discharge',
      value: `${flow.battery_discharge_kw.toFixed(1)} kW`,
      sub: `SOC ${batterySocPct.toFixed(1)}% · Peak shaving`,
      icon: BatteryCharging,
      accent: 'text-emerald-300 border-emerald-500/30 bg-emerald-950/20',
    },
    {
      title: 'Campus Demand',
      value: `${flow.campus_demand_kw.toFixed(1)} kW`,
      sub: '5 monitored buildings',
      icon: Building2,
      accent: 'text-slate-100 border-slate-700 bg-[#121C33]',
    },
  ];

  return (
    <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="font-display text-base font-semibold text-white">
            Microgrid Energy Flow Allocation
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Solar Generation → Direct Consumption → Excess Solar → Battery Storage → Future Peak Demand
          </p>
        </div>
        <span className="font-mono text-[11px] text-slate-400">{dataSource}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-stretch">
        {nodes.map((node, idx) => {
          const Icon = node.icon;
          return (
            <div key={node.title} className="relative flex items-center gap-2">
              <div className={`w-full rounded-lg border p-3.5 ${node.accent}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-300">{node.title}</span>
                  <Icon className="w-4 h-4 shrink-0 opacity-85" />
                </div>
                <div className="mt-2 font-mono text-lg font-semibold tabular-nums text-white">
                  {node.value}
                </div>
                <div className="mt-1 text-[11px] text-slate-400 truncate">{node.sub}</div>
              </div>
              {idx < nodes.length - 1 && (
                <ArrowRight
                  className="hidden md:block w-4 h-4 shrink-0 text-slate-500"
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-3.5 text-xs">
        <div className="flex items-center gap-2 text-slate-300">
          <UtilityPole className="w-4 h-4 text-slate-400" />
          <span>
            Grid Electricity Fallback Supply:{' '}
            <span className="font-mono font-semibold tabular-nums text-white">
              {flow.grid_import_kw.toFixed(1)} kW
            </span>
          </span>
        </div>
        <span className="text-slate-400">
          Grid supplies remaining demand only when solar generation and battery discharge headroom are insufficient.
        </span>
      </div>
    </div>
  );
};
