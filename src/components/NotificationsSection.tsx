import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { apiFetch } from '../lib/api.ts';
import type { SmartNotification } from '../types/energy.ts';

interface NotificationsSectionProps {
  onUnreadChange?: (count: number) => void;
}

const CATEGORIES: Array<'All' | SmartNotification['category']> = [
  'All',
  'Excessive Consumption',
  'Low Battery',
  'Device Offline',
  'Anomaly Pattern',
  'System',
];

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({
  onUnreadChange,
}) => {
  const [items, setItems] = useState<SmartNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<'All' | SmartNotification['category']>('All');
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ notifications: SmartNotification[]; unread_count: number }>(
        '/api/advanced/notifications'
      );
      setItems(res.notifications);
      setUnreadCount(res.unread_count);
      onUnreadChange?.(res.unread_count);
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  const markRead = async (payload: { id?: number; all?: boolean }) => {
    setBusy(true);
    try {
      const res = await apiFetch<{
        ok: boolean;
        notifications: SmartNotification[];
        unread_count: number;
      }>('/api/advanced/notifications/read', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setItems(res.notifications);
      setUnreadCount(res.unread_count);
      onUnreadChange?.(res.unread_count);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    return items.filter((n) => {
      if (categoryFilter !== 'All' && n.category !== categoryFilter) return false;
      if (unreadOnly && n.is_read === 1) return false;
      return true;
    });
  }, [items, categoryFilter, unreadOnly]);

  if (loading && items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-sm text-slate-400">
        Loading Smart Notification feed...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-white">
            Smart Notification System
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Automated administrator alerts for excessive consumption, low battery reserves, device disconnections, and ML anomaly patterns.
          </p>
        </div>

        <button
          disabled={busy || unreadCount === 0}
          onClick={() => void markRead({ all: true })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 hover:border-violet-500 disabled:opacity-50 px-3.5 py-2 text-xs font-medium text-slate-200 cursor-pointer transition-colors"
        >
          <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Mark All Read ({unreadCount})</span>
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                categoryFilter === cat
                  ? 'bg-violet-600 text-white'
                  : 'bg-[#080D1A] border border-slate-800 text-slate-300 hover:border-slate-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="rounded border-slate-700 bg-[#080D1A] text-violet-600 focus:ring-violet-500"
          />
          <span>Unread only</span>
        </label>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-center text-xs text-slate-400">
            No notifications match the selected filter.
          </div>
        ) : (
          filtered.map((n) => {
            const isUnread = n.is_read === 0;
            return (
              <div
                key={n.id}
                className={`rounded-xl border p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  isUnread
                    ? 'border-violet-500/40 bg-[#101932]'
                    : 'border-slate-800 bg-[#0D1526] opacity-80'
                }`}
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <Bell
                      className={`w-3.5 h-3.5 shrink-0 ${
                        n.severity === 'High'
                          ? 'text-rose-400'
                          : n.severity === 'Medium'
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        n.severity === 'High'
                          ? 'text-rose-400'
                          : n.severity === 'Medium'
                            ? 'text-amber-300'
                            : 'text-emerald-400'
                      }`}
                    >
                      {n.severity} Severity
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-violet-300">{n.category}</span>
                    <span className="text-slate-600">·</span>
                    <span className="font-mono text-slate-400">{n.data_source}</span>
                    <span className="text-slate-600">·</span>
                    <span className="font-mono text-slate-500">
                      {new Date(n.created_at.replace(' ', 'T')).toLocaleString()}
                    </span>
                  </div>

                  <div className="font-display text-sm font-semibold text-white">
                    {n.title}
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{n.message}</p>
                </div>

                <div className="shrink-0">
                  {isUnread ? (
                    <button
                      disabled={busy}
                      onClick={() => void markRead({ id: n.id })}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-xs font-medium text-white cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Acknowledge</span>
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500 font-mono">
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Read</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
