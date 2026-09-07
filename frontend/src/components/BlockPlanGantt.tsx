import React, { useState } from 'react';
import { BlockPlanItem } from '../types';
import { ExplainBlockModal } from './ExplainBlockModal';
import { formatTime24 } from '../utils/timeFormatter';
import { useClock, formatTimeISTShort } from '../utils/clock';
import {
  Calendar, CheckCircle2, XCircle, Info, Zap,
  Clock, AlertTriangle, Layers
} from 'lucide-react';

interface BlockPlanGanttProps {
  blocks: BlockPlanItem[];
  onApprove: (blockId: string) => void;
  onReject: (blockId: string, reason: string) => void;
  onRunOptimization: () => void;
  isOptimizing: boolean;
}

// Hour ticks to show on the ruler (every 2 hours for readability)
const RULER_TICKS = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];

function pct(hr: number) {
  return `${(hr / 24) * 100}%`;
}

function priorityColor(bucket: string) {
  switch (bucket) {
    case 'Critical': return 'text-red-400';
    case 'High':     return 'text-orange-400';
    case 'Medium':   return 'text-yellow-400';
    default:         return 'text-emerald-400';
  }
}

function statusGradient(status: string) {
  if (status === 'Approved')
    return 'from-emerald-600 to-teal-600 border-emerald-400/40 shadow-emerald-500/20';
  if (status === 'Rejected')
    return 'from-red-900 to-red-800 border-red-600/40 shadow-red-500/10 opacity-50';
  return 'from-blue-600 to-indigo-600 border-blue-400/40 shadow-blue-500/20';
}

export const BlockPlanGantt: React.FC<BlockPlanGanttProps> = ({
  blocks,
  onApprove,
  onReject,
  onRunOptimization,
  isOptimizing,
}) => {
  const now = useClock();
  const [selectedExplainBlock, setSelectedExplainBlock] = useState<BlockPlanItem | null>(null);
  const [rejectingBlockId, setRejectingBlockId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');

  // Current IST hour (fractional) for the "now" cursor
  const nowHrIST = (() => {
    const istStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });
    const [h, m, s] = istStr.split(':').map(Number);
    return h + m / 60 + s / 3600;
  })();

  const handleConfirmReject = (blockId: string) => {
    if (!rejectReason.trim()) return;
    onReject(blockId, rejectReason);
    setRejectingBlockId(null);
    setRejectReason('');
  };

  /* ─────────────────────────────────────────────────────────
     Traffic-density band: rough indicator of busy vs quiet
  ───────────────────────────────────────────────────────── */
  const TRAFFIC_BANDS = [
    { from: 0, to: 5, label: 'Low traffic', color: 'bg-emerald-900/20' },
    { from: 5, to: 10, label: 'Moderate', color: 'bg-yellow-900/20' },
    { from: 10, to: 18, label: 'Peak', color: 'bg-red-900/20' },
    { from: 18, to: 22, label: 'Moderate', color: 'bg-yellow-900/20' },
    { from: 22, to: 24, label: 'Low traffic', color: 'bg-emerald-900/20' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header Bar ── */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <Calendar className="w-5 h-5 text-blue-400" />
          <div>
            <h2 className="text-base font-bold text-white">CP-SAT Optimized Maintenance Block Schedule</h2>
            <p className="text-xs text-slate-400">24-Hour Horizon Gantt Timeline · Human Controller Decision Desk</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Legend */}
          <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gradient-to-r from-blue-600 to-indigo-600 inline-block" />Proposed
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gradient-to-r from-emerald-600 to-teal-600 inline-block" />Approved
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-gradient-to-r from-red-900 to-red-800 inline-block opacity-60" />Rejected
            </span>
          </div>

          <button
            onClick={onRunOptimization}
            disabled={isOptimizing}
            id="run-optimization-btn"
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold text-xs rounded-lg shadow-md shadow-blue-500/20 transition flex items-center space-x-2"
          >
            <Zap className={`w-4 h-4 ${isOptimizing ? 'animate-pulse' : ''}`} />
            <span>{isOptimizing ? 'Running CP-SAT Solver…' : 'Re-Run Optimization'}</span>
          </button>
        </div>
      </div>

      {/* ── 24-Hour Gantt Chart ── */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl overflow-x-auto">
        <div style={{ minWidth: 900 }}>

          {/* Traffic density background hint */}
          <div className="flex items-center gap-3 mb-3 text-xs text-slate-500 font-mono">
            <Clock className="w-3.5 h-3.5" />
            <span>Colour bands: low / moderate / peak traffic hours</span>
            <span className="ml-auto flex items-center gap-1.5 text-red-400 font-semibold">
              <span className="w-0.5 h-3 bg-red-500 rounded inline-block" />
              NOW — {formatTimeISTShort(now)} IST
            </span>
          </div>

          {/* ── Ruler header ── */}
          <div className="flex mb-1">
            {/* Row label column */}
            <div className="shrink-0" style={{ width: 220 }} />
            {/* Timeline ruler */}
            <div className="flex-1 relative h-6">
              {/* Tick marks + labels */}
              {RULER_TICKS.map((h) => (
                <div
                  key={h}
                  className="absolute top-0 flex flex-col items-center"
                  style={{ left: pct(h), transform: 'translateX(-50%)' }}
                >
                  <span className="text-[10px] font-mono text-slate-400 leading-none whitespace-nowrap">
                    {h === 24 ? '24:00' : `${String(h).padStart(2, '0')}:00`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Grid area with traffic bands ── */}
          <div className="flex mb-1">
            <div className="shrink-0" style={{ width: 220 }} />
            <div className="flex-1 relative h-3 rounded overflow-hidden border border-slate-800">
              {TRAFFIC_BANDS.map((b) => (
                <div
                  key={b.from}
                  className={`absolute top-0 bottom-0 ${b.color}`}
                  style={{ left: pct(b.from), width: `calc(${pct(b.to)} - ${pct(b.from)})` }}
                  title={`${b.label} (${b.from}:00–${b.to}:00)`}
                />
              ))}
              {/* Vertical tick lines */}
              {RULER_TICKS.map((h) => (
                <div
                  key={h}
                  className="absolute top-0 bottom-0 border-l border-slate-700/60"
                  style={{ left: pct(h) }}
                />
              ))}
              {/* NOW cursor on band */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 z-10"
                style={{ left: pct(nowHrIST) }}
              />
            </div>
          </div>

          {/* ── Section Rows ── */}
          {blocks.length > 0 ? (
            <div className="space-y-2 mt-3">
              {blocks.map((b) => {
                const barWidth = (b.duration_hrs / 24) * 100;

                return (
                  <div
                    key={b.block_id}
                    className="flex items-center border-b border-slate-800/60 pb-2 last:border-0"
                  >
                    {/* Left column: section + block id */}
                    <div className="shrink-0 pr-4" style={{ width: 220 }}>
                      <span className="font-mono font-bold text-xs text-blue-300 block leading-tight">
                        {b.section_code}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 block leading-tight">
                        {b.block_id}
                      </span>
                      <span className="text-[10px] font-mono text-slate-600">
                        (Track #{b.target_track_number ?? 1})
                      </span>
                    </div>

                    {/* Timeline row */}
                    <div className="flex-1 relative h-9 bg-slate-950/70 rounded-lg border border-slate-800 overflow-hidden">
                      {/* Faint vertical grid lines */}
                      {RULER_TICKS.map((h) => (
                        <div
                          key={h}
                          className="absolute top-0 bottom-0 border-l border-slate-800/50"
                          style={{ left: pct(h) }}
                        />
                      ))}
                      {/* NOW cursor line (red) */}
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-red-500/60 z-20 pointer-events-none"
                        style={{ left: pct(nowHrIST) }}
                      />
                      {/* NOW label – only show at top of first row */}
                      {blocks.indexOf(b) === 0 && (
                        <div
                          className="absolute -top-5 text-[9px] text-red-400 font-mono font-bold whitespace-nowrap z-20 -translate-x-1/2"
                          style={{ left: pct(nowHrIST) }}
                        >
                          ▼ NOW
                        </div>
                      )}

                      {/* The block bar */}
                      <div
                        className={`absolute top-1 bottom-1 rounded-md px-2 flex items-center justify-between
                          text-xs font-semibold shadow-lg border
                          bg-gradient-to-r ${statusGradient(b.status)} transition-all duration-300`}
                        style={{
                          left: pct(b.start_time_hr),
                          width: `${barWidth}%`,
                          minWidth: 60,
                        }}
                        title={`${b.block_id} · ${formatTime24(b.start_time_hr)}–${formatTime24(b.end_time_hr)} · ${b.duration_hrs}h · ${b.decision_reason?.rationale || ''}`}
                      >
                        <span className="truncate font-mono text-[10px] text-white/90 select-none">
                          {formatTime24(b.start_time_hr)} – {formatTime24(b.end_time_hr)}
                          <span className="ml-1 opacity-70">({b.duration_hrs}h)</span>
                        </span>
                        <button
                          onClick={() => setSelectedExplainBlock(b)}
                          className="p-0.5 bg-black/30 hover:bg-black/50 rounded text-white/80 hover:text-white transition shrink-0 ml-1"
                          title="Explain AI Decision & Safety Checks"
                        >
                          <Info className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Quick status badge */}
                    <div className="shrink-0 ml-3 w-20 text-right">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border font-mono ${
                          b.status === 'Approved'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                            : b.status === 'Rejected'
                            ? 'bg-red-500/10 text-red-400 border-red-500/30'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        }`}
                      >
                        {b.status}
                      </span>
                      <div className={`text-[10px] font-mono mt-0.5 ${priorityColor(b.priority_bucket)}`}>
                        {b.priority_bucket}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 space-y-3">
              <Layers className="w-10 h-10 opacity-30" />
              <p className="text-sm">No block schedule generated yet.</p>
              <p className="text-xs">Click <strong className="text-blue-400">Re-Run Optimization</strong> to produce a plan.</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Human Controller Decision Desk ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Human Controller Decision &amp; Approval Desk
          </h3>
          <span className="text-xs text-slate-500 font-mono">{blocks.length} block(s) pending review</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {blocks.map((b) => (
            <div
              key={b.block_id}
              className={`bg-slate-800/90 border rounded-xl p-5 shadow-xl transition-all duration-200 space-y-3 ${
                b.status === 'Approved'
                  ? 'border-emerald-500/40 bg-emerald-950/10'
                  : b.status === 'Rejected'
                  ? 'border-red-500/40 bg-red-950/10 opacity-70'
                  : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              {/* Card header */}
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-sm text-white">{b.block_id}</span>
                    <span className="px-1.5 py-0.5 bg-blue-900/50 text-blue-300 font-mono text-[10px] rounded border border-blue-700/40 shrink-0">
                      {b.section_code}
                    </span>
                    <span className="px-1.5 py-0.5 bg-slate-900 text-slate-400 font-mono text-[10px] rounded border border-slate-700 shrink-0">
                      Track #{b.target_track_number ?? 1}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 font-mono mt-1">
                    <Clock className="w-3 h-3 inline mr-1 opacity-60" />
                    {formatTime24(b.start_time_hr)} – {formatTime24(b.end_time_hr)}
                    <span className="text-slate-500 ml-1">({b.duration_hrs} hrs)</span>
                  </p>
                  {b.resolution_action && (
                    <p className="text-[10px] text-emerald-400 font-mono mt-0.5 font-semibold">
                      ↳ {b.resolution_action}
                    </p>
                  )}
                  {b.decision_reason?.rationale && (
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-relaxed line-clamp-2" title={b.decision_reason.rationale}>
                      🔍 {b.decision_reason.rationale}
                    </p>
                  )}
                </div>

                <span
                  className={`shrink-0 px-2.5 py-1 text-xs font-bold rounded-md border ${
                    b.status === 'Approved'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                      : b.status === 'Rejected'
                      ? 'bg-red-500/20 text-red-400 border-red-500/40'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  }`}
                >
                  {b.status}
                </span>
              </div>

              {/* Score metrics */}
              <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-2 text-center">
                  <div className="text-slate-500 text-[10px] uppercase tracking-wide mb-0.5">Priority</div>
                  <div className={`font-bold text-sm ${priorityColor(b.priority_bucket)}`}>
                    {b.priority_score}
                  </div>
                  <div className={`text-[10px] ${priorityColor(b.priority_bucket)}`}>{b.priority_bucket}</div>
                </div>
                <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-2 text-center">
                  <div className="text-slate-500 text-[10px] uppercase tracking-wide mb-0.5">ML Disruption</div>
                  <div className="font-bold text-sm text-amber-400">{b.predicted_disruption}</div>
                  <div className="text-[10px] text-slate-500">traffic score</div>
                </div>
                <div className="bg-slate-900/80 border border-slate-700/60 rounded-lg p-2 text-center">
                  <div className="text-slate-500 text-[10px] uppercase tracking-wide mb-0.5">Net Impact</div>
                  <div className="font-bold text-sm text-blue-400">{b.network_impact_score}</div>
                  <div className="text-[10px] text-slate-500">reroute score</div>
                </div>
              </div>

              {/* Rejection reason */}
              {b.rejection_reason && (
                <div className="text-xs bg-red-950/40 border border-red-800/50 p-2 rounded text-red-300">
                  <span className="font-bold">Rejection: </span>{b.rejection_reason}
                </div>
              )}

              {/* Decision actions */}
              <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                <button
                  onClick={() => setSelectedExplainBlock(b)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-700 text-blue-400 text-xs font-semibold rounded border border-slate-700 transition flex items-center space-x-1.5"
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Explain Block</span>
                </button>

                {b.status === 'Proposed' && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setRejectingBlockId(b.block_id)}
                      className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 text-red-300 text-xs font-semibold rounded border border-red-500/40 transition flex items-center space-x-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                    <button
                      onClick={() => onApprove(b.block_id)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded shadow transition flex items-center space-x-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Reject reason form */}
              {rejectingBlockId === b.block_id && (
                <div className="mt-2 p-3 bg-slate-900 rounded-lg border border-red-700/60 space-y-2">
                  <span className="text-xs font-bold text-red-400 block">Enter Rejection Reason</span>
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Conflict with VIP Special Train movement"
                    className="w-full bg-slate-950 border border-slate-700 text-xs text-white p-2 rounded focus:outline-none focus:border-red-500"
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirmReject(b.block_id)}
                    autoFocus
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => setRejectingBlockId(null)}
                      className="px-2.5 py-1 bg-slate-800 text-slate-300 text-xs rounded"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleConfirmReject(b.block_id)}
                      className="px-2.5 py-1 bg-red-600 text-white text-xs rounded font-semibold"
                    >
                      Confirm Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Explain Modal */}
      <ExplainBlockModal block={selectedExplainBlock} onClose={() => setSelectedExplainBlock(null)} />
    </div>
  );
};
