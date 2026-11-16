import { apiFetch } from './api.ts';

export interface OfflineReadingPayload {
  device_id: string;
  building_id: number;
  consumption_kwh: number;
  occupancy_count: number;
  temperature_c: number;
  queued_at: string;
}

const OFFLINE_QUEUE_KEY = 'energysync_offline_queue';

export function getLocalOfflineQueue(): OfflineReadingPayload[] {
  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OfflineReadingPayload[]) : [];
  } catch {
    return [];
  }
}

export function saveLocalOfflineQueue(items: OfflineReadingPayload[]): void {
  try {
    window.localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage quota issues
  }
}

export function queueLocalOfflineReading(
  reading: Omit<OfflineReadingPayload, 'queued_at'>
): OfflineReadingPayload[] {
  const current = getLocalOfflineQueue();
  const next: OfflineReadingPayload[] = [
    ...current,
    {
      ...reading,
      queued_at: new Date().toISOString(),
    },
  ];
  saveLocalOfflineQueue(next);
  return next;
}

export async function flushAllOfflineBuffers(): Promise<{
  flushedLocal: number;
  syncedTotal: number;
  message: string;
}> {
  const localQueue = getLocalOfflineQueue();
  let flushedLocal = 0;

  if (localQueue.length > 0) {
    const remaining: OfflineReadingPayload[] = [];
    for (const item of localQueue) {
      try {
        await apiFetch('/api/advanced/offline-buffer', {
          method: 'POST',
          body: JSON.stringify({
            device_id: item.device_id,
            building_id: item.building_id,
            consumption_kwh: item.consumption_kwh,
            occupancy_count: item.occupancy_count,
            temperature_c: item.temperature_c,
          }),
        });
        flushedLocal += 1;
      } catch {
        remaining.push(item);
      }
    }
    saveLocalOfflineQueue(remaining);
  }

  const res = await apiFetch<{ ok: boolean; synced_count: number; message: string }>(
    '/api/advanced/sync-buffer',
    { method: 'POST' }
  );

  return {
    flushedLocal,
    syncedTotal: res.synced_count,
    message: res.message,
  };
}
