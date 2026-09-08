import React, { useMemo } from 'react';
import { TrainItem, NetworkData, StationNode } from '../types';
import { formatTime24 } from '../utils/timeFormatter';
import { X, Train, ArrowRight, AlertTriangle, CheckCircle2, Navigation, Clock, MapPin, ChevronRight, ShieldAlert } from 'lucide-react';

interface TrainDetailPanelProps {
  train: TrainItem | null;
  network: NetworkData | null;
  onClose: () => void;
}

export const TrainDetailPanel: React.FC<TrainDetailPanelProps> = ({ train, network, onClose }) => {
  if (!train) return null;

  const isRerouted = !!(train.assigned_path && train.assigned_path.length > 0);

  // Map station details
  const stationMap: Record<string, StationNode> = useMemo(() => {
    const map: Record<string, StationNode> = {};
    if (network?.stations) {
      network.stations.forEach((s) => {
        map[s.code] = s;
      });
    }
    return map;
  }, [network]);

  // Extract route stop codes and normalize (support both string and object)
  const rawOriginalStops = train.original_path || [];
  const rawAssignedStops = isRerouted ? train.assigned_path! : rawOriginalStops;
  const rawActivePathStops = isRerouted ? rawAssignedStops : rawOriginalStops;

  const normalizeStop = (p: any, idx: number) => {
    if (typeof p === 'string') {
      return { station_code: p, scheduled_time: formatTime24(train.scheduled_departure_time) };
    }
    return { station_code: p?.station_code || '', scheduled_time: p?.scheduled_time || '--' };
  };

  const originalStops = rawOriginalStops.map(normalizeStop);
  const assignedStops = rawAssignedStops.map(normalizeStop);
  const activePathStops = rawActivePathStops.map(normalizeStop);

  const origCodes = originalStops.map((p) => p.station_code);
  const assignedCodes = assignedStops.map((p) => p.station_code);

  const skippedStations = isRerouted
    ? origCodes.filter((code) => !assignedCodes.includes(code))
    : [];

  // Compute bounding box for SVG fit-to-window calculation
  const routeBoundingBox = useMemo(() => {
    const allRouteCodes = Array.from(new Set([...origCodes, ...assignedCodes]));
    const points = allRouteCodes
      .map((code) => stationMap[code])
      .filter((st): st is StationNode => !!st);

    if (points.length === 0) return { minX: 0, minY: 0, width: 1000, height: 300, viewBox: "0 0 1000 300" };

    const xs = points.map((p) => p.schematic_x_position);
    const ys = points.map((p) => p.schematic_y_position);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const pad = 60;
    const w = Math.max(300, maxX - minX + pad * 2);
    const h = Math.max(180, maxY - minY + pad * 2);

    return {
      minX: minX - pad,
      minY: minY - pad,
      width: w,
      height: h,
      viewBox: `${minX - pad} ${minY - pad} ${w} ${h}`
    };
  }, [origCodes, assignedCodes, stationMap]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-end">
      <div className="bg-slate-900 border-l border-slate-700 w-full max-w-3xl h-full overflow-y-auto shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950 sticky top-0 z-20">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg">
              <Train className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono font-bold text-lg text-white">{train.train_id}</span>
                <span className="text-xs font-semibold px-2 py-0.5 bg-blue-900/60 text-blue-300 rounded border border-blue-700/50 font-mono">
                  #{train.train_number}
                </span>
                <span className={`px-2.5 py-0.5 text-xs font-bold rounded-md border ${
                  isRerouted
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    : train.current_status === 'in_transit'
                    ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                }`}>
                  {isRerouted ? 'REROUTED' : train.current_status.toUpperCase()}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-200 mt-0.5">{train.train_name}</h3>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 text-xs text-slate-300 flex-1">
          {/* Top Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-800/80 p-4 rounded-xl border border-slate-700 font-mono">
            <div>
              <span className="text-slate-400 text-[11px] block">Train Type</span>
              <span className="font-bold text-white text-xs">{train.train_type}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Priority Class</span>
              <span className="font-bold text-emerald-400 text-xs">Prio #{train.priority_class}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Scheduled Departure</span>
              <span className="font-bold text-white text-xs">
                {formatTime24(activePathStops[0]?.scheduled_time || train.scheduled_departure_time)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Scheduled Arrival</span>
              <span className="font-bold text-white text-xs">
                {formatTime24(activePathStops[activePathStops.length - 1]?.scheduled_time || train.scheduled_arrival_time)}
              </span>
            </div>
          </div>

          {/* Route Header Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-4 rounded-xl border border-slate-700 flex items-center justify-between font-mono shadow-md">
            <div className="flex items-center space-x-3">
              <MapPin className="w-5 h-5 text-blue-400" />
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">ORIGIN HUB</span>
                <span className="font-bold text-blue-300 text-base">{train.origin_station_code}</span>
                <span className="text-[11px] text-slate-400 block">{stationMap[train.origin_station_code]?.name || 'Origin Station'}</span>
              </div>
            </div>

            <div className="flex flex-col items-center px-4">
              <span className="text-[10px] text-emerald-400 font-bold tracking-wider uppercase mb-1">
                {activePathStops.length - 1} Route Hops ({activePathStops.length} Stops)
              </span>
              <div className="flex items-center space-x-2 text-slate-500">
                <div className="w-12 h-0.5 bg-gradient-to-r from-blue-500 to-emerald-500" />
                <ArrowRight className="w-4 h-4 text-emerald-400" />
              </div>
            </div>

            <div className="flex items-center space-x-3 text-right">
              <div>
                <span className="text-slate-400 text-[10px] uppercase block">DESTINATION HUB</span>
                <span className="font-bold text-emerald-300 text-base">{train.destination_station_code}</span>
                <span className="text-[11px] text-slate-400 block">{stationMap[train.destination_station_code]?.name || 'Destination Station'}</span>
              </div>
              <MapPin className="w-5 h-5 text-emerald-400" />
            </div>
          </div>

          {/* ── 1. Fit-to-Window Interactive Graphic Route Map ── */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold text-white flex items-center space-x-2">
                <Navigation className="w-4 h-4 text-blue-400" />
                <span>Schematic Train Route Map (Fitted to Window)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {isRerouted ? 'Amber = Assigned Reroute · Blue Dashed = Original' : 'Blue/Emerald = Active Scheduled Path'}
              </span>
            </div>

            {/* Auto-Bounding SVG Canvas */}
            <div className="w-full bg-slate-900/90 rounded-lg p-2 border border-slate-800 overflow-hidden">
              <svg viewBox={routeBoundingBox.viewBox} className="w-full h-auto max-h-[260px] min-h-[180px]">
                {/* 1. Original Scheduled Reference Path (Faint background comparison trace) */}
                {isRerouted &&
                  originalStops.map((stop, idx) => {
                    if (idx === originalStops.length - 1) return null;
                    const st1 = stationMap[stop.station_code];
                    const st2 = stationMap[originalStops[idx + 1].station_code];
                    if (!st1 || !st2) return null;

                    return (
                      <line
                        key={`orig-ref-${idx}`}
                        x1={st1.schematic_x_position}
                        y1={st1.schematic_y_position}
                        x2={st2.schematic_x_position}
                        y2={st2.schematic_y_position}
                        stroke="#3b82f6"
                        strokeWidth="2.5"
                        strokeDasharray="5,5"
                        strokeOpacity="0.4"
                      />
                    );
                  })}

                {/* Non-rerouted: Standard Active Scheduled Path */}
                {!isRerouted &&
                  originalStops.map((stop, idx) => {
                    if (idx === originalStops.length - 1) return null;
                    const st1 = stationMap[stop.station_code];
                    const st2 = stationMap[originalStops[idx + 1].station_code];
                    if (!st1 || !st2) return null;

                    return (
                      <line
                        key={`orig-${idx}`}
                        x1={st1.schematic_x_position}
                        y1={st1.schematic_y_position}
                        x2={st2.schematic_x_position}
                        y2={st2.schematic_y_position}
                        stroke="#10b981"
                        strokeWidth="4"
                        strokeOpacity="0.9"
                      />
                    );
                  })}

                {/* 2. Active Assigned Reroute Path Lines (Solid Amber) */}
                {isRerouted &&
                  assignedStops.map((stop, idx) => {
                    if (idx === assignedStops.length - 1) return null;
                    const st1 = stationMap[stop.station_code];
                    const st2 = stationMap[assignedStops[idx + 1].station_code];
                    if (!st1 || !st2) return null;

                    return (
                      <line
                        key={`alt-${idx}`}
                        x1={st1.schematic_x_position}
                        y1={st1.schematic_y_position}
                        x2={st2.schematic_x_position}
                        y2={st2.schematic_y_position}
                        stroke="#f59e0b"
                        strokeWidth="5"
                        strokeOpacity="0.95"
                      />
                    );
                  })}

                {/* 3. Station Nodes on Route */}
                {Array.from(new Set([...origCodes, ...assignedCodes])).map((code) => {
                  const st = stationMap[code];
                  if (!st) return null;

                  const isAssignedStop = assignedCodes.includes(code);
                  const isSkipped = isRerouted && skippedStations.includes(code);
                  const isTerminus = code === train.origin_station_code || code === train.destination_station_code;

                  let nodeColor = '#3b82f6';
                  let nodeRadius = isTerminus ? '8' : '6';
                  let nodeOpacity = 1.0;

                  if (isSkipped) {
                    nodeColor = '#ef4444';
                    nodeRadius = '4.5';
                    nodeOpacity = 0.55;
                  } else if (isAssignedStop && isRerouted) {
                    nodeColor = isTerminus ? '#10b981' : '#f59e0b';
                  } else if (isTerminus) {
                    nodeColor = '#10b981';
                  }

                  return (
                    <g key={code} className="cursor-pointer" opacity={nodeOpacity}>
                      {/* Terminus Outer Halo */}
                      {isTerminus && (
                        <circle
                          cx={st.schematic_x_position}
                          cy={st.schematic_y_position}
                          r="12"
                          fill={nodeColor}
                          fillOpacity="0.2"
                          className="animate-pulse"
                        />
                      )}

                      {/* Main Station Circle */}
                      <circle
                        cx={st.schematic_x_position}
                        cy={st.schematic_y_position}
                        r={nodeRadius}
                        fill={nodeColor}
                        stroke="#0f172a"
                        strokeWidth="2"
                      />

                      {/* Label Text */}
                      <text
                        x={st.schematic_x_position}
                        y={st.schematic_y_position + 16}
                        fill={isSkipped ? '#f87171' : (isTerminus ? '#ffffff' : (isAssignedStop && isRerouted ? '#fde68a' : '#e2e8f0'))}
                        fontSize={isTerminus ? '11' : (isSkipped ? '8' : '9')}
                        fontWeight={isTerminus || isAssignedStop ? 'bold' : 'normal'}
                        textAnchor="middle"
                        style={{
                          paintOrder: 'stroke fill',
                          stroke: '#0f172a',
                          strokeWidth: '3px',
                          strokeLinejoin: 'round',
                        }}
                      >
                        {code} {isSkipped ? '(Bypassed)' : ''}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* ── 2. Sequential Station Stop Timeline Stepper ── */}
          <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-4 space-y-3 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <span className="font-bold text-white text-xs flex items-center space-x-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Complete Sequential Station Timetable & Route Path ({activePathStops.length} Stations)</span>
              </span>
              {skippedStations.length > 0 && (
                <span className="text-[11px] font-mono font-bold text-red-400 bg-red-950/80 px-2 py-0.5 rounded border border-red-800">
                  {skippedStations.length} Station(s) Skipped due to Reroute
                </span>
              )}
            </div>

            {/* Sequential Horizontal Stepper Cards */}
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {activePathStops.map((stop, idx) => {
                const isOrigin = idx === 0;
                const isDestination = idx === activePathStops.length - 1;
                const stInfo = stationMap[stop.station_code];

                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border font-mono flex items-center justify-between text-xs transition ${
                      isOrigin
                        ? 'bg-blue-950/60 border-blue-700/80 text-blue-200'
                        : isDestination
                        ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-200'
                        : 'bg-slate-900 border-slate-700/70 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-white text-sm">{stop.station_code}</span>
                          <span className="text-[10px] text-slate-400">({stInfo?.name || 'Station'})</span>
                          {isOrigin && (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold bg-blue-600 text-white rounded">ORIGIN</span>
                          )}
                          {isDestination && (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-600 text-white rounded">DESTINATION</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Zone: {stInfo?.zone || 'NR'} · Scheduled Stop
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-bold text-emerald-400 text-xs">{formatTime24(stop.scheduled_time)}</span>
                      <span className="text-[10px] text-slate-500 block">Scheduled Time</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Reroute Resolution Summary */}
          {isRerouted ? (
            <div className="bg-amber-950/40 border border-amber-500/50 rounded-xl p-4 space-y-2">
              <span className="font-bold text-amber-400 text-xs flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Assigned Alternate Route & Maintenance Bypass Status</span>
              </span>
              <p className="text-amber-200 text-xs">
                Train bypasses active maintenance block line and is routed via alternate track corridors.
              </p>
              {skippedStations.length > 0 ? (
                <div className="text-red-300 font-mono text-xs bg-red-950/80 p-2.5 rounded border border-red-800/80">
                  <span className="font-bold text-white block mb-1">Skipped Station Stops ({skippedStations.length}):</span>
                  <div className="flex flex-wrap gap-1.5">
                    {skippedStations.map((sc, i) => (
                      <span key={i} className="px-2 py-0.5 bg-red-900/60 text-red-200 rounded border border-red-700 text-[11px] font-bold">
                        {sc}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-emerald-300 font-mono text-xs font-semibold">Zero station stops skipped.</p>
              )}
            </div>
          ) : (
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <span className="text-emerald-300 text-xs font-bold block">Operating on Normal Scheduled Path</span>
                <span className="text-[11px] text-slate-400">All intermediate stops clear with zero maintenance disruptions.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
