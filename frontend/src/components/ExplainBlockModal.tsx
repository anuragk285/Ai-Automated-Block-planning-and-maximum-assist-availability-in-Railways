import React from 'react';
import { BlockPlanItem } from '../types';
import { formatTime24 } from '../utils/timeFormatter';
import { X, ShieldCheck, AlertOctagon, Cpu, CheckCircle2, XCircle, Activity, Layers, Train } from 'lucide-react';

interface ExplainBlockModalProps {
  block: BlockPlanItem | null;
  onClose: () => void;
}

export const ExplainBlockModal: React.FC<ExplainBlockModalProps> = ({ block, onClose }) => {
  if (!block) return null;

  const passedChecksCount = block.safety_checks.filter((c) => c.passed).length;
  const totalChecksCount = block.safety_checks.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950 rounded-t-2xl sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-lg text-white">{block.block_id}</span>
                <span className="px-2 py-0.5 bg-blue-900/60 text-blue-300 font-mono text-xs rounded border border-blue-700/50">
                  {block.section_code} (Track #{block.target_track_number || 1})
                </span>
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${block.status === 'Approved' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}`}>
                  {block.status}
                </span>
              </div>
              <p className="text-xs text-slate-400">AI Decision Rationale & Machine Safety Audit Panel</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-xs text-slate-300">
          {/* Track Rerouting & Resolution Banner */}
          <div className="bg-gradient-to-r from-emerald-950/60 to-slate-900 border border-emerald-800/60 rounded-xl p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-1.5 mb-1">
              <Train className="w-4 h-4" />
              <span>Track Resolution & Rerouting Decision</span>
            </span>
            <p className="text-sm font-mono font-bold text-white">
              {block.resolution_action || `Reassigned to Track 2 (same section ${block.section_code})`}
            </p>
          </div>

          {/* Why CP-SAT Optimizer Picked This Window */}
          <div className="bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-800/60 rounded-xl p-4">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center space-x-1.5 mb-2">
              <Cpu className="w-4 h-4" />
              <span>OR-Tools CP-SAT Optimizer Selection Rationale</span>
            </span>
            <p className="text-sm font-medium text-white leading-relaxed">
              {block.decision_reason?.rationale || `Selected optimal window ${formatTime24(block.start_time_hr)} – ${formatTime24(block.end_time_hr)} with lowest disruption (${block.predicted_disruption}) and network rerouting penalty (${block.network_impact_score}).`}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-xs font-mono">
              <span className="bg-slate-900/80 px-2.5 py-1 rounded border border-slate-700 text-slate-300">
                Window: <span className="text-white font-bold">{formatTime24(block.start_time_hr)} – {formatTime24(block.end_time_hr)}</span>
              </span>
              <span className="bg-slate-900/80 px-2.5 py-1 rounded border border-slate-700 text-slate-300">
                Disruption Score: <span className="text-amber-400 font-bold">{block.predicted_disruption}</span>
              </span>
              <span className="bg-slate-900/80 px-2.5 py-1 rounded border border-slate-700 text-slate-300">
                Network Impact Score: <span className="text-blue-400 font-bold">{block.network_impact_score}</span>
              </span>
              <span className="bg-slate-900/80 px-2.5 py-1 rounded border border-slate-700 text-slate-300">
                Priority Score: <span className="text-emerald-400 font-bold">{block.priority_score} ({block.priority_bucket})</span>
              </span>
            </div>
          </div>

          {/* Machine-Readable Safety Checks */}
          <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="font-bold text-white text-sm flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Deterministic Safety & Constraint Engine Verification</span>
              </span>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded font-mono font-bold">
                {passedChecksCount} / {totalChecksCount} Hard Rules Passed
              </span>
            </div>

            <div className="space-y-2">
              {block.safety_checks.map((chk, idx) => (
                <div key={idx} className="flex items-start justify-between bg-slate-900/80 p-2.5 rounded border border-slate-700/60">
                  <div className="flex items-start space-x-2">
                    {chk.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                    )}
                    <div>
                      <span className="font-mono font-bold text-slate-200">{chk.check_name}</span>
                      <p className="text-slate-400 mt-0.5">{chk.message}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${chk.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {chk.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Resources & Merged Requests */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
              <span className="font-bold text-slate-200 block mb-2">Assigned Skilled Crew & Machinery</span>
              <div className="space-y-1.5">
                {block.assigned_resources.map((res, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-900/80 p-2 rounded border border-slate-700 font-mono">
                    <span className="text-slate-300">{res.name}</span>
                    <span className="text-blue-400 text-[10px] bg-blue-900/40 px-1.5 py-0.5 rounded">{res.type}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4">
              <span className="font-bold text-slate-200 block mb-2">Merged Departmental Requests</span>
              <div className="space-y-1.5">
                {block.request_ids.map((rid) => (
                  <div key={rid} className="flex items-center justify-between bg-slate-900/80 p-2 rounded border border-slate-700 font-mono">
                    <span className="text-blue-300 font-bold">{rid}</span>
                    <span className="text-emerald-400 text-[10px] bg-emerald-900/40 px-1.5 py-0.5 rounded">Bundled</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
