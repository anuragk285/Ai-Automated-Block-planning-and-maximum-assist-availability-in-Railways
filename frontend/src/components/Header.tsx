import React from 'react';
import { Train, ShieldCheck, RefreshCw, Clock } from 'lucide-react';
import { useClock, formatDateLong, formatTimeIST } from '../utils/clock';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSeedData: () => void;
  onRunOptimization: () => void;
  isOptimizing: boolean;
  isSeeding: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onSeedData,
  onRunOptimization,
  isOptimizing,
  isSeeding,
}) => {
  const now = useClock();

  const tabs = [
    { id: 'overview',    label: 'Overview Dashboard' },
    { id: 'requests',    label: 'Maintenance Requests' },
    { id: 'network',     label: 'Network Schematic Map' },
    { id: 'trains',      label: 'Trains View' },
    { id: 'plan',        label: 'Block Plan & Optimizer' },
    { id: 'monitoring',  label: 'Live Traffic Monitoring' },
    { id: 'emergency',   label: 'Emergency Control' },
  ];

  return (
    <header className="bg-slate-950 border-b border-slate-800 sticky top-0 z-40 shadow-xl">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">

          {/* ── Brand ── */}
          <div className="flex items-center space-x-3 shrink-0">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
              <Train className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-base tracking-wider text-white">INDIAN RAILWAYS</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-900/60 text-blue-300 rounded border border-blue-700/50 shrink-0">
                  SIH26027
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-tight">
                AI-Assisted Automatic Maintenance Block Planning System
              </p>
            </div>
          </div>

          {/* ── Live Clock (IST) ── */}
          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 border border-slate-700/60 rounded-xl shadow-inner">
              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
              <div className="text-center">
                <div className="font-mono font-bold text-lg text-emerald-400 leading-none tracking-widest tabular-nums">
                  {formatTimeIST(now)}
                </div>
                <div className="text-[9px] text-slate-500 font-mono tracking-wide mt-0.5">
                  {formatDateLong(now)} &nbsp;·&nbsp; IST (UTC+5:30)
                </div>
              </div>
            </div>
          </div>

          {/* ── Global Actions ── */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={onSeedData}
              disabled={isSeeding}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-md border border-slate-700 transition disabled:opacity-50"
              title="Reset and re-seed railway dataset"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSeeding ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSeeding ? 'Seeding...' : 'Seed Data'}</span>
            </button>

            <button
              onClick={onRunOptimization}
              disabled={isOptimizing}
              className="inline-flex items-center space-x-2 px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-md shadow-md shadow-blue-500/20 transition active:scale-95 disabled:opacity-50"
            >
              <ShieldCheck className={`w-4 h-4 ${isOptimizing ? 'animate-pulse' : ''}`} />
              <span>{isOptimizing ? 'Optimizing...' : 'Generate Plan'}</span>
            </button>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <nav className="flex space-x-5 border-t border-slate-900 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2.5 px-0.5 border-b-2 text-xs font-medium transition whitespace-nowrap ${
                  isActive
                    ? 'border-blue-500 text-blue-400 font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
