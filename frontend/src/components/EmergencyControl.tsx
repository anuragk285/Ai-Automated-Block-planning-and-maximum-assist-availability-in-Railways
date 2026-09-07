import React, { useState } from 'react';
import { EmergencyDiff, NetworkData } from '../types';
import { formatTime24 } from '../utils/timeFormatter';
import { AlertOctagon, ShieldAlert, ArrowRight, Zap, Lock, CheckCircle2 } from 'lucide-react';
import axios from 'axios';

interface EmergencyControlProps {
  network: NetworkData | null;
  onEmergencyHandled: () => void;
}

export const EmergencyControl: React.FC<EmergencyControlProps> = ({ network, onEmergencyHandled }) => {
  const [sectionCode, setSectionCode] = useState<string>('SEC_GZB_ALJN');
  const [targetTrackNumber, setTargetTrackNumber] = useState<number>(1);
  const [reason, setReason] = useState<string>('Sudden OHE Catenary Wire Snapping & Flashover');
  const [severity, setSeverity] = useState<string>('Critical');
  const [durationHrs, setDurationHrs] = useState<number>(3.0);
  const [startTimeHr, setStartTimeHr] = useState<number>(2.0);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [emergencyResult, setEmergencyResult] = useState<EmergencyDiff | null>(null);

  const handleReportEmergency = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const resp = await axios.post('/api/emergency', {
        section_code: sectionCode,
        target_track_number: targetTrackNumber,
        reason: reason,
        severity: severity,
        duration_hrs: durationHrs,
        start_time_hr: startTimeHr,
      });
      setEmergencyResult(resp.data);
      onEmergencyHandled();
    } catch (err) {
      console.error('Error reporting emergency:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-950/80 via-slate-900 to-slate-900 border border-red-800/60 rounded-xl p-5 shadow-2xl flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-red-600/20 text-red-400 border border-red-500/40 rounded-lg">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Emergency Track Block & Local Re-Optimization Control</h2>
            <p className="text-xs text-slate-300">
              Locks target physical track as a hard safety constraint and re-evaluates local neighborhood graph while preserving global network plan.
            </p>
          </div>
        </div>
      </div>

      {/* Form & Neighborhood Analysis Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 shadow-xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Report Emergency Track Block</h3>

          <form onSubmit={handleReportEmergency} className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Target Track Section:</label>
              <select
                value={sectionCode}
                onChange={(e) => setSectionCode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white font-mono p-2 rounded focus:outline-none focus:border-red-500"
              >
                {network?.sections.map((sec) => (
                  <option key={sec.code} value={sec.code}>
                    {sec.code} ({sec.start_station_code} – {sec.end_station_code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Target Track Number:</label>
              <select
                value={targetTrackNumber}
                onChange={(e) => setTargetTrackNumber(parseInt(e.target.value, 10))}
                className="w-full bg-slate-900 border border-slate-700 text-white font-mono p-2 rounded focus:outline-none focus:border-red-500"
              >
                <option value={1}>Track 1 (UP Line)</option>
                <option value={2}>Track 2 (DOWN Line)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Emergency Failure Reason:</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white p-2 rounded focus:outline-none focus:border-red-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Severity Level:</label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white p-2 rounded focus:outline-none focus:border-red-500"
                >
                  <option value="Critical">Critical</option>
                  <option value="Major">Major</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Duration (Hours):</label>
                <input
                  type="number"
                  step="0.5"
                  min="1.0"
                  max="12.0"
                  value={durationHrs}
                  onChange={(e) => setDurationHrs(parseFloat(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 text-white p-2 rounded focus:outline-none focus:border-red-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Start Time (Hour 0–24):</label>
              <input
                type="number"
                step="0.5"
                min="0.0"
                max="23.0"
                value={startTimeHr}
                onChange={(e) => setStartTimeHr(parseFloat(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 text-white p-2 rounded focus:outline-none focus:border-red-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded shadow-lg shadow-red-500/20 transition flex items-center justify-center space-x-2 mt-4"
            >
              <Zap className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`} />
              <span>{isSubmitting ? 'Executing Local Re-Optimizer...' : 'Inject Emergency & Local Re-Optimize'}</span>
            </button>
          </form>
        </div>

        {/* Side-by-Side Before/After Local Re-Optimization Diff View */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between">
            <span>Local Neighborhood Re-Optimization Schedule Diff</span>
            {emergencyResult && (
              <span className="text-xs text-emerald-400 font-mono font-normal">
                {emergencyResult.affected_blocks_count} Local Blocks Rescheduled | {emergencyResult.unaffected_frozen_blocks_count} Global Blocks Frozen
              </span>
            )}
          </h3>

          {emergencyResult ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Before Plan */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="font-bold text-slate-400 uppercase tracking-wider block mb-2">Original Baseline Schedule</span>
                {emergencyResult.diff.before_plan.map((b, i) => (
                  <div key={i} className="bg-slate-900 p-2.5 rounded border border-slate-800 font-mono">
                    <div className="flex justify-between font-bold text-blue-300">
                      <span>{b.block_id}</span>
                      <span>{b.section_code}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Window: {formatTime24(b.start_time_hr)} – {formatTime24(b.end_time_hr)}
                    </p>
                  </div>
                ))}
              </div>

              {/* After Plan */}
              <div className="bg-slate-950 p-4 rounded-xl border border-emerald-900/50 space-y-2">
                <span className="font-bold text-emerald-400 uppercase tracking-wider block mb-2 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Re-Optimized Local Schedule</span>
                </span>
                {emergencyResult.diff.after_plan.map((b, i) => {
                  const isShifted = b.action?.includes('Moved') || b.status?.includes('Shifted');
                  return (
                    <div
                      key={i}
                      className={`p-2.5 rounded border font-mono ${
                        isShifted ? 'bg-amber-950/30 border-amber-500/50 text-amber-200' : 'bg-slate-900 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="flex justify-between font-bold">
                        <span className={isShifted ? 'text-amber-300' : 'text-slate-300'}>{b.block_id}</span>
                        <span className="text-[11px] text-slate-400">{b.action}</span>
                      </div>
                      <p className="text-[11px] mt-1">
                        New Window: <span className="font-bold">{formatTime24(b.start_time_hr)} – {formatTime24(b.end_time_hr)}</span>
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400 space-y-2 border border-dashed border-slate-800 rounded-xl">
              <ShieldAlert className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs">No emergency currently injected.</p>
              <p className="text-xs text-slate-500">Fill out the emergency report form on the left to test local neighborhood re-planning.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
