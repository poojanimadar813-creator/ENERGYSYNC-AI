import React, { useEffect, useState } from 'react';
import { Cpu, Users, Power } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { OccupancyRoom } from '../types/energy.ts';

interface OccupancyResponse {
  rooms: OccupancyRoom[];
  iot_ready_protocol: {
    mcu: string;
    sensors: string[];
    endpoint: string;
  };
}

export const OccupancySection: React.FC = () => {
  const [data, setData] = useState<OccupancyResponse | null>(null);
  const [updatingRoom, setUpdatingRoom] = useState<string | null>(null);

  const loadRooms = async () => {
    const res = await apiFetch<OccupancyResponse>('/api/occupancy');
    setData(res);
  };

  useEffect(() => {
    void loadRooms();
  }, []);

  const toggleRelay = async (
    room: OccupancyRoom,
    field: 'lights_on' | 'fans_on' | 'ac_on',
    nextVal: number
  ) => {
    setUpdatingRoom(room.room_code);
    try {
      await apiFetch('/api/occupancy/update', {
        method: 'POST',
        body: JSON.stringify({ room_code: room.room_code, [field]: nextVal }),
      });
      await loadRooms();
    } finally {
      setUpdatingRoom(null);
    }
  };

  const turnOffEmptyRoom = async (room: OccupancyRoom) => {
    setUpdatingRoom(room.room_code);
    try {
      await apiFetch('/api/occupancy/update', {
        method: 'POST',
        body: JSON.stringify({
          room_code: room.room_code,
          lights_on: 0,
          fans_on: 0,
          ac_on: 0,
          computers_on: 0,
        }),
      });
      await loadRooms();
    } finally {
      setUpdatingRoom(null);
    }
  };

  const rooms = data?.rooms ?? [];
  const occupiedCount = rooms.filter((r) => r.status === 'Occupied').length;
  const standbyWastingCount = rooms.filter((r) => r.status === 'Standby').length;
  const totalRoomKw = rooms.reduce((acc, r) => acc + r.current_load_kw, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Classroom Occupancy &amp; Equipment Control
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Simulated PIR occupancy telemetry &amp; relay states. Schema is ready for live ESP32 + PIR + SCT-013 sensor streams.
          </p>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Monitored Rooms</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-white">
            {rooms.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Active Occupied Zones</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-emerald-400">
            {occupiedCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Empty Rooms With Load On</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-rose-400">
            {standbyWastingCount}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4">
          <div className="text-xs text-slate-400">Room Sub-Meter Total</div>
          <div className="mt-1.5 font-mono text-xl font-semibold tabular-nums text-violet-300">
            {totalRoomKw.toFixed(1)} kW
          </div>
        </div>
      </div>

      {/* Rooms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {rooms.map((room) => {
          const isWasting = room.occupant_count === 0 && room.current_load_kw > 0.5;
          return (
            <div
              key={room.room_code}
              className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-5 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs text-violet-300">{room.room_code}</div>
                    <h3 className="font-display text-base font-semibold text-white mt-0.5">
                      {room.room_name}
                    </h3>
                    <div className="text-xs text-slate-400 mt-0.5">{room.building_name}</div>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <div
                      className={`text-xs font-medium ${
                        room.status === 'Occupied'
                          ? 'text-emerald-400'
                          : isWasting
                            ? 'text-rose-400'
                            : 'text-slate-400'
                      }`}
                    >
                      {isWasting ? 'Empty · Wastage' : room.status}
                    </div>
                    <div className="text-sm font-semibold text-white mt-0.5">
                      {room.current_load_kw.toFixed(2)} kW
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs text-slate-300 border-t border-slate-800/80 pt-3">
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono tabular-nums">
                      {room.occupant_count} / {room.capacity} occupants
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-500">{room.data_source}</span>
                </div>
              </div>

              <div className="space-y-2.5">
                <div className="grid grid-cols-3 gap-2">
                  <button
                    disabled={updatingRoom === room.room_code}
                    onClick={() => toggleRelay(room, 'lights_on', room.lights_on ? 0 : 1)}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      room.lights_on
                        ? 'border-amber-500/40 bg-amber-950/30 text-amber-200'
                        : 'border-slate-800 bg-[#080D1A] text-slate-400'
                    }`}
                  >
                    Lights: {room.lights_on ? 'ON' : 'OFF'}
                  </button>
                  <button
                    disabled={updatingRoom === room.room_code}
                    onClick={() => toggleRelay(room, 'fans_on', room.fans_on ? 0 : 1)}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      room.fans_on
                        ? 'border-violet-500/40 bg-violet-950/30 text-violet-200'
                        : 'border-slate-800 bg-[#080D1A] text-slate-400'
                    }`}
                  >
                    Fans: {room.fans_on ? 'ON' : 'OFF'}
                  </button>
                  <button
                    disabled={updatingRoom === room.room_code}
                    onClick={() => toggleRelay(room, 'ac_on', room.ac_on ? 0 : 1)}
                    className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                      room.ac_on
                        ? 'border-sky-500/40 bg-sky-950/30 text-sky-200'
                        : 'border-slate-800 bg-[#080D1A] text-slate-400'
                    }`}
                  >
                    AC: {room.ac_on ? 'ON' : 'OFF'}
                  </button>
                </div>

                {isWasting && (
                  <button
                    disabled={updatingRoom === room.room_code}
                    onClick={() => turnOffEmptyRoom(room)}
                    className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 py-1.5 px-3 text-xs font-medium text-white transition-colors cursor-pointer"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Shut Off Idle Equipment</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ESP32 IoT Hardware Integration Spec */}
      <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Cpu className="w-4 h-4 text-violet-400" />
          <span>ESP32 + PIR + Smart Meter Integration Protocol</span>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Hardware nodes ({data?.iot_ready_protocol.sensors.join(', ')}) stream JSON telemetry to{' '}
          <code className="font-mono text-slate-200">POST /api/occupancy/update</code> with{' '}
          <code className="font-mono text-slate-200">data_source: &quot;LIVE SENSOR DATA&quot;</code>.
        </p>
      </div>
    </div>
  );
};
