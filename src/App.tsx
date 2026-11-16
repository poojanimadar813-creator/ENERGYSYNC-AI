import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  BatteryCharging,
  Bell,
  BrainCircuit,
  Building2,
  Calculator,
  CloudSun,
  Cpu,
  FileBarChart2,
  FileSpreadsheet,
  Gauge,
  Globe2,
  GraduationCap,
  Home,
  LayoutDashboard,
  Lightbulb,
  LogOut,
  MapPin,
  Menu,
  Play,
  PlusCircle,
  RotateCcw,
  ServerCog,
  Settings,
  ShieldAlert,
  Sun,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { EnergySyncLogo } from './components/Logo.tsx';
import { LoginView } from './components/LoginView.tsx';
import { WelcomeSection } from './components/WelcomeSection.tsx';
import { OverviewSection } from './components/OverviewSection.tsx';
import { MonitoringSection } from './components/MonitoringSection.tsx';
import { PredictionSection } from './components/PredictionSection.tsx';
import { AnomalySection } from './components/AnomalySection.tsx';
import { OccupancySection } from './components/OccupancySection.tsx';
import { SolarSection } from './components/SolarSection.tsx';
import { BatterySection } from './components/BatterySection.tsx';
import { RecommendationsSection } from './components/RecommendationsSection.tsx';
import { ReportsSection } from './components/ReportsSection.tsx';
import { SettingsSection } from './components/SettingsSection.tsx';
import { StateDashboardSection } from './components/StateDashboardSection.tsx';
import { CollegeRegistrySection } from './components/CollegeRegistrySection.tsx';
import { AddCollegeSection } from './components/AddCollegeSection.tsx';
import { DistrictManagementSection } from './components/DistrictManagementSection.tsx';
import { DistrictAnalyticsSection } from './components/DistrictAnalyticsSection.tsx';
import { StatewideReportsSection } from './components/StatewideReportsSection.tsx';
import { DigitalTwinSection } from './components/DigitalTwinSection.tsx';
import { PeakLoadSection } from './components/PeakLoadSection.tsx';
import { PredictiveMaintenanceSection } from './components/PredictiveMaintenanceSection.tsx';
import { WeatherPredictionSection } from './components/WeatherPredictionSection.tsx';
import { NotificationsSection } from './components/NotificationsSection.tsx';
import { CarbonFormulasSection } from './components/CarbonFormulasSection.tsx';
import { GreenLeaderboardSection } from './components/GreenLeaderboardSection.tsx';
import { ReliabilitySection } from './components/ReliabilitySection.tsx';
import { ApiError, apiFetch, clearAuthToken } from './lib/api.ts';
import { flushAllOfflineBuffers, getLocalOfflineQueue } from './lib/offlineSync.ts';
import type { DashboardSummary, UserPublic } from './types/energy.ts';

type NavKey =
  | 'welcome'
  | 'overview'
  | 'monitoring'
  | 'prediction'
  | 'anomalies'
  | 'occupancy'
  | 'solar'
  | 'battery'
  | 'recommendations'
  | 'reports'
  | 'settings'
  | 'state_dashboard'
  | 'college_registry'
  | 'add_college'
  | 'district_management'
  | 'district_analytics'
  | 'statewide_reports'
  | 'digital_twin'
  | 'peak_load'
  | 'maintenance'
  | 'weather_prediction'
  | 'notifications'
  | 'carbon_formulas'
  | 'green_leaderboard'
  | 'system_reliability';

const NAV_ITEMS: Array<{
  key: NavKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: 'campus' | 'statewide' | 'advanced';
}> = [
  { key: 'welcome', label: 'Welcome', icon: Home, group: 'campus' },
  { key: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'campus' },
  { key: 'monitoring', label: 'Energy Monitoring', icon: Building2, group: 'campus' },
  { key: 'prediction', label: 'AI Prediction', icon: BrainCircuit, group: 'campus' },
  { key: 'anomalies', label: 'Anomaly Detection', icon: ShieldAlert, group: 'campus' },
  { key: 'occupancy', label: 'Occupancy Monitoring', icon: Users, group: 'campus' },
  { key: 'solar', label: 'Solar Management', icon: Sun, group: 'campus' },
  { key: 'battery', label: 'Battery Optimization', icon: BatteryCharging, group: 'campus' },
  { key: 'recommendations', label: 'AI Recommendations', icon: Lightbulb, group: 'campus' },
  { key: 'reports', label: 'Reports', icon: FileBarChart2, group: 'campus' },
  { key: 'settings', label: 'Settings', icon: Settings, group: 'campus' },
  { key: 'state_dashboard', label: 'Karnataka State Dashboard', icon: Globe2, group: 'statewide' },
  { key: 'college_registry', label: 'College Registry', icon: GraduationCap, group: 'statewide' },
  { key: 'add_college', label: 'Add College', icon: PlusCircle, group: 'statewide' },
  { key: 'district_management', label: 'District Management', icon: MapPin, group: 'statewide' },
  { key: 'district_analytics', label: 'District-wise Analytics', icon: BarChart3, group: 'statewide' },
  { key: 'statewide_reports', label: 'Statewide Reports', icon: FileSpreadsheet, group: 'statewide' },
  { key: 'digital_twin', label: 'Smart Campus Digital Twin', icon: Cpu, group: 'advanced' },
  { key: 'peak_load', label: 'Smart Peak Load', icon: Gauge, group: 'advanced' },
  { key: 'maintenance', label: 'Predictive Maintenance', icon: Wrench, group: 'advanced' },
  { key: 'weather_prediction', label: 'Weather Prediction', icon: CloudSun, group: 'advanced' },
  { key: 'notifications', label: 'Smart Notifications', icon: Bell, group: 'advanced' },
  { key: 'carbon_formulas', label: 'Carbon & Calculations', icon: Calculator, group: 'advanced' },
  { key: 'green_leaderboard', label: 'Green Leaderboard', icon: Award, group: 'advanced' },
  { key: 'system_reliability', label: 'System Reliability', icon: ServerCog, group: 'advanced' },
];

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [user, setUser] = useState<UserPublic | null>(null);
  const [activeTab, setActiveTab] = useState<NavKey>('welcome');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const loadDashboard = useCallback(async () => {
    setDashboardError(null);
    try {
      const data = await apiFetch<DashboardSummary>('/api/dashboard');
      setDashboard(data);
      apiFetch<{ unread_count: number }>('/api/advanced/notifications')
        .then((res) => setUnreadNotifications(res.unread_count))
        .catch(() => undefined);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        clearAuthToken();
        setUser(null);
        setDashboard(null);
        return;
      }
      setDashboardError(err instanceof Error ? err.message : 'Unable to load campus energy dashboard.');
    }
  }, []);

  useEffect(() => {
    apiFetch<{ authenticated: boolean; user?: UserPublic }>('/api/auth/me')
      .then((res) => {
        if (res.authenticated && res.user) {
          setUser(res.user);
        }
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setAuthChecked(true);
      });
  }, []);

  useEffect(() => {
    if (user) {
      void loadDashboard();
    }
  }, [user, loadDashboard, refreshCounter]);

  useEffect(() => {
    if (!user) return;
    const handleOnline = () => {
      if (getLocalOfflineQueue().length > 0) {
        void flushAllOfflineBuffers()
          .then((res) => {
            if (res.syncedTotal > 0) {
              setRefreshCounter((c) => c + 1);
              setToast(res.message);
            }
          })
          .catch(() => undefined);
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [user]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4500);
  };

  const handleRunSimulation = async () => {
    setSimRunning(true);
    try {
      const res = await apiFetch<{
        mae: number;
        rmse: number;
        anomalies_detected: number;
        estimated_cost_savings_inr: number;
      }>('/api/simulation/run', {
        method: 'POST',
        body: JSON.stringify({ inject_anomaly: true }),
      });
      setRefreshCounter((c) => c + 1);
      showToast(
        `Simulation updated · RF MAE ${res.mae} kWh · ${res.anomalies_detected} anomalies · Est. ₹${res.estimated_cost_savings_inr} savings`
      );
    } finally {
      setSimRunning(false);
    }
  };

  const handleResetSimulation = async () => {
    setSimRunning(true);
    try {
      await apiFetch('/api/simulation/reset', { method: 'POST' });
      setRefreshCounter((c) => c + 1);
      showToast('Simulation dataset and ML models restored to baseline state.');
    } finally {
      setSimRunning(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      clearAuthToken();
      setUser(null);
      setDashboard(null);
    }
  };

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#080D1A] flex items-center justify-center text-sm text-slate-400">
        Initializing ENERGYSYNC AI...
      </div>
    );
  }

  if (!user) {
    return (
      <LoginView
        onSuccess={(loggedInUser) => {
          setUser(loggedInUser);
        }}
      />
    );
  }

  const activeNavMeta = NAV_ITEMS.find((n) => n.key === activeTab) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-[#080D1A] text-slate-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-800/90 bg-[#0B1121]">
        <div className="p-5 border-b border-slate-800/80">
          <EnergySyncLogo />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.filter((item) => item.group === 'campus').map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-violet-600/20 text-white border border-violet-500/35'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-violet-400' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          <div className="pt-4 pb-1 px-3 text-[11px] font-medium text-slate-500">
            Karnataka Network
          </div>
          {NAV_ITEMS.filter((item) => item.group === 'statewide').map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-violet-600/20 text-white border border-violet-500/35'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-violet-400' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}

          <div className="pt-4 pb-1 px-3 text-[11px] font-medium text-slate-500">
            Advanced &amp; Sustainability
          </div>
          {NAV_ITEMS.filter((item) => item.group === 'advanced').map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-violet-600/20 text-white border border-violet-500/35'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/40 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-violet-400' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
                {item.key === 'notifications' && unreadNotifications > 0 && (
                  <span className="ml-auto font-mono text-[10px] px-1.5 py-0.5 rounded bg-violet-600/30 text-violet-200">
                    {unreadNotifications}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800/80 space-y-3">
          <div className="text-xs">
            <div className="font-medium text-white truncate">{user.name}</div>
            <div className="text-slate-400 truncate">{user.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-800 hover:border-slate-600 py-2 px-3 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-full bg-[#0B1121] border-r border-slate-800 flex flex-col z-10">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <EnergySyncLogo compact />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setActiveTab(item.key);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-violet-600/20 text-white border border-violet-500/35'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-800">
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-800 py-2 text-xs font-medium text-slate-300"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 border-b border-slate-800/90 bg-[#080D1A]/95 backdrop-blur-sm px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg border border-slate-800 text-slate-300 hover:text-white"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 truncate">
              <span className="text-slate-300 font-medium whitespace-nowrap">ENERGYSYNC AI</span>
              <span aria-hidden="true">/</span>
              <span className="text-white font-medium whitespace-nowrap">{activeNavMeta.label}</span>
              {dashboard && (
                <>
                  <span className="hidden md:inline" aria-hidden="true">·</span>
                  <span className="hidden md:inline font-mono text-xs text-emerald-400 whitespace-nowrap">
                    {dashboard.simulation_state.data_source}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleRunSimulation}
              disabled={simRunning}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-3.5 py-2 text-xs font-medium text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Play className="w-3.5 h-3.5" />
              <span>{simRunning ? 'Running...' : 'Run Energy Simulation'}</span>
            </button>

            <button
              onClick={handleResetSimulation}
              disabled={simRunning}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 hover:border-slate-500 disabled:opacity-60 px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Simulation</span>
            </button>
          </div>
        </header>

        {toast && (
          <div className="mx-4 sm:mx-6 mt-4 rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-2.5 text-xs text-emerald-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {/* Active Module Viewport */}
        <main key={refreshCounter} className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeTab === 'welcome' && (
            <WelcomeSection
              user={user}
              campusDashboard={dashboard}
              onGoToDashboard={() => setActiveTab('overview')}
              onNavigate={(tab) => setActiveTab(tab as NavKey)}
            />
          )}
          {activeTab === 'overview' && dashboard && (
            <OverviewSection
              data={dashboard}
              onNavigate={(tab) => setActiveTab(tab as NavKey)}
            />
          )}
          {activeTab === 'overview' && !dashboard && dashboardError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-6 space-y-3">
              <div className="text-sm font-medium text-rose-200">{dashboardError}</div>
              <button
                onClick={() => void loadDashboard()}
                className="rounded-lg bg-violet-600 hover:bg-violet-500 px-3.5 py-2 text-xs font-medium text-white cursor-pointer"
              >
                Retry Loading Dashboard
              </button>
            </div>
          )}
          {activeTab === 'overview' && !dashboard && !dashboardError && (
            <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-8 text-sm text-slate-400">
              Loading campus energy dashboard...
            </div>
          )}
          {activeTab === 'monitoring' && (
            <MonitoringSection onDataChanged={() => setRefreshCounter((c) => c + 1)} />
          )}
          {activeTab === 'prediction' && <PredictionSection />}
          {activeTab === 'anomalies' && (
            <AnomalySection onDataChanged={() => setRefreshCounter((c) => c + 1)} />
          )}
          {activeTab === 'occupancy' && <OccupancySection />}
          {activeTab === 'solar' && (
            <SolarSection onDataChanged={() => setRefreshCounter((c) => c + 1)} />
          )}
          {activeTab === 'battery' && <BatterySection />}
          {activeTab === 'recommendations' && (
            <RecommendationsSection onDataChanged={() => setRefreshCounter((c) => c + 1)} />
          )}
          {activeTab === 'reports' && <ReportsSection />}
          {activeTab === 'settings' && (
            <SettingsSection onDataChanged={() => setRefreshCounter((c) => c + 1)} />
          )}
          {activeTab === 'state_dashboard' && (
            <StateDashboardSection onNavigate={(tab) => setActiveTab(tab as NavKey)} />
          )}
          {activeTab === 'college_registry' && (
            <CollegeRegistrySection onNavigate={(tab) => setActiveTab(tab as NavKey)} />
          )}
          {activeTab === 'add_college' && (
            <AddCollegeSection onNavigate={(tab) => setActiveTab(tab as NavKey)} />
          )}
          {activeTab === 'district_management' && <DistrictManagementSection />}
          {activeTab === 'district_analytics' && <DistrictAnalyticsSection />}
          {activeTab === 'statewide_reports' && <StatewideReportsSection />}
          {activeTab === 'digital_twin' && <DigitalTwinSection />}
          {activeTab === 'peak_load' && <PeakLoadSection />}
          {activeTab === 'maintenance' && <PredictiveMaintenanceSection />}
          {activeTab === 'weather_prediction' && <WeatherPredictionSection />}
          {activeTab === 'notifications' && (
            <NotificationsSection onUnreadChange={(cnt) => setUnreadNotifications(cnt)} />
          )}
          {activeTab === 'carbon_formulas' && <CarbonFormulasSection />}
          {activeTab === 'green_leaderboard' && <GreenLeaderboardSection />}
          {activeTab === 'system_reliability' && (
            <ReliabilitySection onDataChanged={() => setRefreshCounter((c) => c + 1)} />
          )}
        </main>
      </div>
    </div>
  );
}
