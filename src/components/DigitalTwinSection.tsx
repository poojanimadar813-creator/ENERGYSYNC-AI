import React, { useEffect, useState } from 'react';
import { BatteryCharging, Building2, Cpu, Sun, Users, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { DigitalTwinBuilding, DigitalTwinState } from '../types/energy.ts';

export const DigitalTwinSection: React.FC = () => {
  const [twin, setTwin] = useState<DigitalTwinState | null>(null);
  const [selected, setSelected] = useState<DigitalTwinBuilding | null>(null);

  useEffect(() => {
    apiFetch<DigitalTwinState>('/api/advanced/digital-twin').then((res) => {
      setTwin(res);
      if (res.buildings.length > 0) {
        setSelected(res.buildings[0]);
      }
    });
  }, []);

  if (!twin) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-sm text-slate-400">
        Loading Smart Campus Digital Twin...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Smart Campus Digital Twin
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Live virtual representation of campus buildings, rooftop solar array, LiFePO₄ battery bank, and room equipment ·{' '}
            <span className="font-mono text-slate-300">{twin.data_source}</span>
          </p>
        </div>
      </div>

      {/* Microgrid Core Generation & Storage Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-emerald-500/30 bg-[#0D1526] p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
              <Sun className="w-4 h-4" />
              <span>Rooftop Solar PV Array ({twin.solar_array.capacity_kwp} kWp)</span>
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-white">
              {twin.solar_array.current_output_kw} kW live
            </div>
            <div className="text-xs text-slate-400">
              {twin.solar_array.daily_generated_kwh} kWh today · {twin.solar_array.weather_condition} · Inverter η {twin.solar_array.inverter_efficiency_pct}%
            </div>
          </div>
          <div className="text-right font-mono text-xs text-slate-400">
            <div>PV Bus</div>
            <div className="text-emerald-400 font-semibold mt-0.5">Online</div>
          </div>
        </div>

        <div className="rounded-xl border border-violet-500/30 bg-[#0D1526] p-5 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-violet-300 font-medium">
              <BatteryCharging className="w-4 h-4" />
              <span>Campus BESS Bank ({twin.battery_bank.capacity_kwh} kWh)</span>
            </div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-white">
              {twin.battery_bank.soc_pct.toFixed(1)}% SOC ({twin.battery_bank.stored_kwh} kWh)
            </div>
            <div className="text-xs text-slate-400">
              Action: {twin.battery_bank.action} ({twin.battery_bank.power_kw} kW) · SOH {twin.battery_bank.health_pct}%
            </div>
          </div>
          <div className="text-right font-mono text-xs text-slate-400">
            <div>Usable Cap</div>
            <div className="text-violet-300 font-semibold mt-0.5">
              {twin.battery_bank.usable_capacity_kwh} kWh
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Campus Building Twin Grid + Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {twin.buildings.map((b) => {
            const isSelected = selected?.id === b.id;
            const loadPct = Math.min(100, Math.round((b.current_kw / Math.max(1, b.capacity_kw)) * 100));
            return (
              <button
                key={b.id}
                onClick={() => setSelected(b)}
                className={`text-left rounded-xl border p-4 transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-violet-500 bg-violet-950/25'
                    : 'border-slate-800 bg-[#0D1526] hover:border-slate-600'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {b.code} · {b.location_zone}
                    </div>
                    <div className="font-display text-sm font-semibold text-white mt-0.5">
                      {b.name}
                    </div>
                  </div>
                  {b.active_alerts > 0 && (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                </div>

                <div className="mt-3 flex items-baseline justify-between font-mono tabular-nums">
                  <span className="text-lg font-semibold text-white">{b.current_kw} kW</span>
                  <span className="text-xs text-emerald-400">{b.today_kwh} kWh today</span>
                </div>

                {/* Capacity bar */}
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      b.status === 'Wastage Alert'
                        ? 'bg-rose-500'
                        : b.status === 'Elevated Load'
                          ? 'bg-amber-400'
                          : 'bg-emerald-500'
                    }`}
                    style={{ width: `${loadPct}%` }}
                  />
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                  <span>{b.total_occupants} occupants</span>
                  <span
                    className={
                      b.status === 'Wastage Alert'
                        ? 'text-rose-400 font-medium'
                        : b.status === 'Elevated Load'
                          ? 'text-amber-300 font-medium'
                          : 'text-emerald-400 font-medium'
                    }
                  >
                    {b.status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Building Digital Twin Telemetry Panel */}
        <div className="xl:col-span-5 rounded-xl border border-slate-800 bg-[#0D1526] p-5 space-y-5">
          {selected && (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-violet-300 font-mono">
                    <Building2 className="w-4 h-4" />
                    <span>{selected.code}</span>
                  </div>
                  <h3 className="font-display text-lg font-semibold text-white mt-1">
                    {selected.name}
                  </h3>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {selected.category} · {selected.floor_area_sqm} m² · {selected.location_zone}
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-xs text-slate-400">Rated Cap</div>
                  <div className="text-sm font-semibold text-white">{selected.capacity_kw} kW</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
                <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-3">
                  <div className="text-[11px] font-sans text-slate-400">Daily Energy</div>
                  <div className="text-base font-semibold text-white mt-1">
                    {selected.today_kwh} kWh
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-3">
                  <div className="text-[11px] font-sans text-slate-400">Solar Share</div>
                  <div className="text-base font-semibold text-emerald-400 mt-1">
                    {selected.solar_allocated_kwh} kWh
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-3">
                  <div className="text-[11px] font-sans text-slate-400">Active Rooms</div>
                  <div className="text-base font-semibold text-white mt-1">
                    {selected.occupied_rooms} / {selected.rooms_monitored}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-800 bg-[#080D1A] p-3">
                  <div className="text-[11px] font-sans text-slate-400">Active Alerts</div>
                  <div
                    className={`text-base font-semibold mt-1 ${
                      selected.active_alerts > 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {selected.active_alerts}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-300 mb-2.5">
                  <Cpu className="w-3.5 h-3.5 text-violet-400" />
                  <span>Connected Equipment State</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#080D1A] px-3 py-2">
                    <span className="text-slate-400">Lighting Circuits</span>
                    <span className="font-mono text-amber-300">{selected.equipment.lights_on} ON</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#080D1A] px-3 py-2">
                    <span className="text-slate-400">Ceiling Fans</span>
                    <span className="font-mono text-violet-300">{selected.equipment.fans_on} ON</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#080D1A] px-3 py-2">
                    <span className="text-slate-400">HVAC / Split AC</span>
                    <span className="font-mono text-sky-300">{selected.equipment.ac_on} ON</span>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-[#080D1A] px-3 py-2">
                    <span className="text-slate-400">Workstations</span>
                    <span className="font-mono text-emerald-400">{selected.equipment.computers_on}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400 pt-1">
                <Users className="w-3.5 h-3.5" />
                <span>Total Zone Occupancy: {selected.total_occupants} students/staff detected</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
