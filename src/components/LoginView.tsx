import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react';
import { EnergySyncLogo } from './Logo.tsx';
import { apiFetch, setAuthToken } from '../lib/api.ts';
import type { UserPublic } from '../types/energy.ts';

interface LoginViewProps {
  onSuccess: (user: UserPublic) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const [email, setEmail] = useState('admin@bldea-energysync.edu');
  const [password, setPassword] = useState('EnergySync@2026');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ user: UserPublic; token?: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if (data.token) {
        setAuthToken(data.token);
      }
      onSuccess(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080D1A] text-slate-100 flex flex-col justify-between px-6 py-8">
      <header className="mx-auto w-full max-w-6xl flex items-center justify-between">
        <EnergySyncLogo />
        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400">
          <span>IEEE Energy &amp; Storage Innovation Challenge 2026</span>
          <span aria-hidden="true">·</span>
          <span>BLDEACET Vijayapura</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center my-10">
        <div className="lg:col-span-7 space-y-6">
          <p className="text-xs font-medium tracking-wider text-emerald-400 uppercase">
            Smart Campus Microgrid Platform
          </p>
          <h1
            className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-white leading-[1.15]"
            style={{ textWrap: 'balance' }}
          >
            AI Demand Forecasting, Wastage Detection &amp; Battery Storage Optimization
          </h1>
          <p className="text-[15px] text-slate-300 leading-relaxed max-w-xl">
            Monitor campus electricity across academic buildings, forecast daily load with Random
            Forest Regression, isolate wastage using Isolation Forest, and schedule solar-to-battery
            storage to minimize peak grid costs.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-4">
              <div className="text-xs text-slate-400">Forecasting Model</div>
              <div className="mt-1 font-display text-base font-semibold text-white">
                Random Forest
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Chronological MAE &amp; RMSE evaluation
              </div>
            </div>
            <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-4">
              <div className="text-xs text-slate-400">Wastage Detection</div>
              <div className="mt-1 font-display text-base font-semibold text-white">
                Isolation Forest
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Empty room &amp; off-hour anomaly scoring
              </div>
            </div>
            <div className="rounded-xl border border-slate-800/90 bg-[#0D1526] p-4">
              <div className="text-xs text-slate-400">Storage Dispatch</div>
              <div className="mt-1 font-display text-base font-semibold text-emerald-400">
                200 kWh LiFePO₄
              </div>
              <div className="mt-1 text-xs text-slate-400">
                Tariff-aware peak shaving optimizer
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-xl border border-slate-800 bg-[#0D1526] p-7">
            <h2 className="font-display text-xl font-semibold text-white">
              Administrator Sign In
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Access the ENERGYSYNC AI campus telemetry and optimization console.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-4 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3.5 py-2.5 text-xs text-rose-200"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Administrator Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-700/80 bg-[#080D1A] pl-10 pr-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                    placeholder="admin@bldea-energysync.edu"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-700/80 bg-[#080D1A] pl-10 pr-10 py-2.5 text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 px-4 py-2.5 text-sm font-medium text-white transition-colors cursor-pointer"
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-slate-800/80 text-xs text-slate-400 space-y-1">
              <div className="font-medium text-slate-300">Demonstration Credentials</div>
              <div className="font-mono text-[11px] text-slate-400">
                Email: <span className="text-slate-200">admin@bldea-energysync.edu</span>
              </div>
              <div className="font-mono text-[11px] text-slate-400">
                Password: <span className="text-slate-200">EnergySync@2026</span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1">
                Credentials use salted scrypt hashing and can be changed in Settings.
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-6xl flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/70 pt-5 text-xs text-slate-500">
        <span>ENERGYSYNC AI · Engineering Prototype</span>
        <span>All initial telemetry is clearly labeled SIMULATED DATA until ESP32 meters connect.</span>
      </footer>
    </div>
  );
};
