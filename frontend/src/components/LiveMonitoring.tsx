import React, { useState } from 'react';
import { DriftAlert } from '../types';
import { formatTime24 } from '../utils/timeFormatter';
import { Activity, AlertTriangle, RefreshCw, CheckCircle2, ArrowRight, ShieldAlert, Clock } from 'lucide-react';
import axios from 'axios';

export const LiveMonitoring: React.FC = () => {
  const [alerts, setAlerts] = useState<DriftAlert[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  const handleSimulateDrift = async () => {
    setIsSimulating(true);
    try {
      const resp = await axios.post('/api/monitor/simulate-drift');
      setSimulationResult(resp.data);
      setAlerts(resp.data.alerts || []);
    } catch (err) {
      console.error('Error running drift simulation:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Header */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Live Operations & Timetable Drift Monitoring</h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Continuously monitors live train delays & detects operational drift from baseline maintenance schedule.
          </p>
        </div>

        <button
          onClick={handleSimulateDrift}
          disabled={isSimulating}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs rounded-lg shadow-lg shadow-emerald-500/20 transition flex items-center space-x-2"
        >
          <RefreshCw className={`w-4 h-4 ${isSimulating ? 'animate-spin' : ''}`} />
          <span>{isSimulating ? 'Simulating Live Traffic...' : 'Simulate Live Traffic Delays'}</span>
        </button>
      </div>

      {/* Simulation Metrics Summary */}
      {simulationResult && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl shadow-lg">
            <span className="text-xs text-slate-400">Perturbed Delayed Trains</span>
            <p className="text-2xl font-black text-amber-400 mt-1">{simulationResult.delayed_trains_count}</p>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl shadow-lg">
            <span className="text-xs text-slate-400">Active Drift Alerts Triggered</span>
            <p className="text-2xl font-black text-red-400 mt-1">{simulationResult.drift_alerts_count}</p>
          </div>
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl shadow-lg">
            <span className="text-xs text-slate-400">Recommended Alternative Windows</span>
            <p className="text-2xl font-black text-blue-400 mt-1">{alerts.length}</p>
          </div>
        </div>
      )}

      {/* Drift Alerts List */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Active Timetable Drift Alerts ({alerts.length})</span>
        </h3>

        {alerts.length > 0 ? (
          <div className="space-y-4">
            {alerts.map((al, i) => (
              <div key={i} className="bg-slate-800/90 border border-amber-500/40 rounded-xl p-5 shadow-xl space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-lg">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-white">{al.block_id}</span>
                        <span className="px-2 py-0.5 bg-blue-900/60 text-blue-300 font-mono text-xs rounded border border-blue-700/50">
                          {al.section_code}
                        </span>
                        <span className="px-2 py-0.5 bg-red-500/20 text-red-400 font-bold text-xs rounded border border-red-500/40">
                          Drift Delta +{al.drift_delta}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">{al.message}</p>
                    </div>
                  </div>
                </div>

                {/* Score Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/80 p-3.5 rounded-lg border border-slate-700 text-xs">
                  <div>
                    <span className="text-slate-400 block font-bold mb-1">Original Planned Window</span>
                    <p className="font-mono text-slate-200">{al.original_window}</p>
                    <p className="font-mono text-amber-400 mt-0.5">
                      Forecast Disruption: {al.original_disruption_score} $\rightarrow$ Live Disruption: <span className="font-bold text-red-400">{al.live_disruption_score}</span>
                    </p>
                  </div>

                  <div className="border-t md:border-t-0 md:border-l border-slate-700 pt-2 md:pt-0 md:pl-4">
                    <span className="text-emerald-400 font-bold block mb-1">Suggested Re-Optimized Alternative Window</span>
                    <p className="font-mono text-emerald-300 font-bold">
                      {formatTime24(al.suggested_alternative_window.start_time_hr)} – {formatTime24(al.suggested_alternative_window.end_time_hr)}
                    </p>
                    <p className="font-mono text-slate-400 mt-0.5">
                      New Predicted Disruption Score: <span className="text-emerald-400 font-bold">{al.suggested_alternative_window.predicted_disruption}</span>
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-8 text-center text-slate-400 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <p className="text-xs font-semibold text-slate-200">No active timetable drift alerts detected.</p>
            <p className="text-xs text-slate-400">Click "Simulate Live Traffic Delays" above to perturb train entry/exit times.</p>
          </div>
        )}
      </div>
    </div>
  );
};
