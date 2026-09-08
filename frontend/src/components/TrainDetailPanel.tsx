import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { TrainItem, NetworkData, StationNode, TrainPathStop, TrainStopInput } from '../types';
import { formatTime24 } from '../utils/timeFormatter';
import { useMapViewport, Point2D } from '../hooks/useMapViewport';
import {
  X,
  Train,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Navigation,
  Clock,
  MapPin,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  Minimize2,
  Move,
  Radio,
} from 'lucide-react';

interface TrainDetailPanelProps {
  train: TrainItem | null;
  network: NetworkData | null;
  onClose: () => void;
}

export const TrainDetailPanel: React.FC<TrainDetailPanelProps> = ({ train, network, onClose }) => {
  if (!train) return null;

  // ── 1. Status & Path Normalization ──
  const isRerouted =
    !!(train.assigned_path && train.assigned_path.length > 0) ||
    train.current_status?.toLowerCase() === 'rerouted';

  // Map station details lookup dictionary
  const stationMap: Record<string, StationNode> = useMemo(() => {
    const map: Record<string, StationNode> = {};
    if (network?.stations) {
      network.stations.forEach((s) => {
        map[s.code] = s;
      });
    }
    return map;
  }, [network]);

  // Helper to normalize stops from either string arrays (e.g. ["ADI", "BRC"]) or object arrays ({ station_code: ... })
  const normalizeStops = useCallback(
    (rawStops: TrainStopInput[] | undefined, defaultTime: string, isBypass = false): TrainPathStop[] => {
      if (!rawStops || !Array.isArray(rawStops)) return [];
      return rawStops.map((item, idx) => {
        if (typeof item === 'string') {
          return {
            station_code: item.trim().toUpperCase(),
            scheduled_time: defaultTime,
            is_bypass: isBypass,
          };
        }
        return {
          station_code: item.station_code ? item.station_code.trim().toUpperCase() : `STN-${idx}`,
          scheduled_time: item.scheduled_time || defaultTime,
          is_bypass: item.is_bypass ?? isBypass,
        };
      });
    },
    []
  );

  const originalStops = useMemo(
    () => normalizeStops(train.original_path, train.scheduled_departure_time, false),
    [train.original_path, train.scheduled_departure_time, normalizeStops]
  );

  const assignedStops = useMemo(
    () => normalizeStops(train.assigned_path ?? undefined, train.scheduled_departure_time, true),
    [train.assigned_path, train.scheduled_departure_time, normalizeStops]
  );

  const activePathStops = isRerouted && assignedStops.length > 0 ? assignedStops : originalStops;

  const origCodes = useMemo(() => originalStops.map((p) => p.station_code), [originalStops]);
  const assignedCodes = useMemo(() => assignedStops.map((p) => p.station_code), [assignedStops]);

  const skippedStations = useMemo(() => {
    if (!isRerouted || assignedCodes.length === 0) return [];
    return origCodes.filter((code) => !assignedCodes.includes(code));
  }, [isRerouted, origCodes, assignedCodes]);

  const routeNodeSet = useMemo(() => {
    const set = new Set<string>();
    // Explicitly add origin and destination so endpoints are never missing
    if (train.origin_station_code) set.add(train.origin_station_code);
    if (train.destination_station_code) set.add(train.destination_station_code);
    origCodes.forEach((c) => set.add(c));
    assignedCodes.forEach((c) => set.add(c));
    return set;
  }, [train.origin_station_code, train.destination_station_code, origCodes, assignedCodes]);

  // ── 2. Discover Nearby Stations & Sections (Dimmed Background Network) ──
  const { nearbyStations, nearbySections } = useMemo(() => {
    if (!network?.stations || !network?.sections) return { nearbyStations: [], nearbySections: [] };

    // Fixed absolute proximity radius — stations must be within 120 coordinate units
    // of at least one route stop to qualify as local context halo.
    const NEARBY_RADIUS = 120;
    const NEARBY_RADIUS_SQ = NEARBY_RADIUS * NEARBY_RADIUS;

    // Pre-build list of route stop coordinates for distance checks
    const routePoints: { x: number; y: number }[] = [];
    routeNodeSet.forEach((code) => {
      const st = stationMap[code];
      if (st) routePoints.push({ x: st.schematic_x_position, y: st.schematic_y_position });
    });

    // Helper: is a coordinate within NEARBY_RADIUS of any route stop?
    const isNearRoute = (x: number, y: number): boolean => {
      for (const pt of routePoints) {
        const dx = x - pt.x;
        const dy = y - pt.y;
        if (dx * dx + dy * dy <= NEARBY_RADIUS_SQ) return true;
      }
      return false;
    };

    const nearbyMap = new Map<string, StationNode>();
    network.stations.forEach((st) => {
      if (routeNodeSet.has(st.code)) return; // exclude route stations themselves
      if (isNearRoute(st.schematic_x_position, st.schematic_y_position)) {
        nearbyMap.set(st.code, st);
      }
    });

    const nearbyStnList = Array.from(nearbyMap.values());
    const nearbyCodes = new Set(nearbyMap.keys());

    // Only keep track sections where BOTH endpoints are within the nearby set
    // or link a nearby station directly to a route station — no dangling lines.
    const nearbySecList = network.sections.filter((sec) => {
      const isRouteStart = routeNodeSet.has(sec.start_station_code);
      const isRouteEnd = routeNodeSet.has(sec.end_station_code);
      const isNearbyStart = nearbyCodes.has(sec.start_station_code);
      const isNearbyEnd = nearbyCodes.has(sec.end_station_code);

      return (
        (isNearbyStart && isNearbyEnd) ||
        (isRouteStart && isNearbyEnd) ||
        (isNearbyStart && isRouteEnd)
      );
    });

    return { nearbyStations: nearbyStnList, nearbySections: nearbySecList };
  }, [network, routeNodeSet, stationMap]);

  // ── 3. Critical Points & All Visible Points for Fit-to-Bounds ──
  const criticalPoints: Point2D[] = useMemo(() => {
    const pts: Point2D[] = [];
    const added = new Set<string>();

    const addCode = (code?: string) => {
      if (!code || added.has(code)) return;
      const st = stationMap[code];
      if (st) {
        pts.push({ x: st.schematic_x_position, y: st.schematic_y_position });
        added.add(code);
      }
    };

    // Explicitly guarantee source & destination are critical endpoints
    addCode(train.origin_station_code);
    addCode(train.destination_station_code);
    activePathStops.forEach((s) => addCode(s.station_code));
    origCodes.forEach(addCode);
    assignedCodes.forEach(addCode);

    return pts;
  }, [train.origin_station_code, train.destination_station_code, activePathStops, origCodes, assignedCodes, stationMap]);

  const allVisiblePoints: Point2D[] = useMemo(() => {
    const pts = [...criticalPoints];
    nearbyStations.forEach((st) => {
      pts.push({ x: st.schematic_x_position, y: st.schematic_y_position });
    });
    return pts;
  }, [criticalPoints, nearbyStations]);

  // ── 4. Shared Interactive Pan & Zoom Viewport Hook ──
  const {
    viewport,
    containerRef,
    isDragging,
    fitToBounds,
    zoomIn,
    zoomOut,
    setManualTransform,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  } = useMapViewport({ minScale: 0.12, maxScale: 5.0 });

  // Inspected node state for station inspection tooltip/popup
  const [inspectedStation, setInspectedStation] = useState<{
    code: string;
    name: string;
    zone: string;
    role: string;
    time?: string;
    x: number;
    y: number;
  } | null>(null);

  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Auto-fit function with 10% padding margin and critical points sanity check
  const autoFitRoute = useCallback(() => {
    fitToBounds(allVisiblePoints, criticalPoints, {
      paddingRatio: 0.10, // 10% padding margin on all sides
      minPadding: 60,
      minZoom: 0.12,
      maxZoom: 2.2,
    });
    setInspectedStation(null);
  }, [fitToBounds, allVisiblePoints, criticalPoints]);

  // Re-fit whenever train, route paths, or container height toggle changes
  useEffect(() => {
    const timer = setTimeout(() => {
      autoFitRoute();
    }, 40);
    return () => clearTimeout(timer);
  }, [train.train_id, train.original_path, train.assigned_path, isExpanded, autoFitRoute]);

  // Re-fit on container resize (e.g. window resize or modal rendering)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const ro = new ResizeObserver(() => {
      autoFitRoute();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [autoFitRoute, containerRef]);

  // Live Position Focus for In-Transit trains
  const livePositionCoords = useMemo(() => {
    if (train.current_status !== 'in_transit') return null;

    if (train.current_section_code) {
      const parts = train.current_section_code.replace('SEC_', '').split('_');
      if (parts.length === 2 && stationMap[parts[0]] && stationMap[parts[1]]) {
        const s1 = stationMap[parts[0]];
        const s2 = stationMap[parts[1]];
        return {
          x: (s1.schematic_x_position + s2.schematic_x_position) / 2,
          y: (s1.schematic_y_position + s2.schematic_y_position) / 2,
          label: `In Transit: ${train.current_section_code}`,
        };
      }
    }

    const firstSt = activePathStops[0]?.station_code;
    if (firstSt && stationMap[firstSt]) {
      return {
        x: stationMap[firstSt].schematic_x_position,
        y: stationMap[firstSt].schematic_y_position,
        label: `At Origin: ${firstSt}`,
      };
    }

    return null;
  }, [train, activePathStops, stationMap]);

  const handleFocusLiveTrain = () => {
    if (!livePositionCoords || !containerRef.current) return;
    const cw = containerRef.current.clientWidth / 2;
    const ch = containerRef.current.clientHeight / 2;
    const targetZoom = 1.4;
    setManualTransform({
      scale: targetZoom,
      x: cw - livePositionCoords.x * targetZoom,
      y: ch - livePositionCoords.y * targetZoom,
    });
  };

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
              <span className="font-bold text-white text-xs">{formatTime24(train.scheduled_departure_time)}</span>
            </div>
            <div>
              <span className="text-slate-400 text-[11px] block">Scheduled Arrival</span>
              <span className="font-bold text-white text-xs">{formatTime24(train.scheduled_arrival_time)}</span>
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

          {/* ── Interactive Movable & Scrollable Route Map ── */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 shadow-inner">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
              <div className="flex items-center space-x-2">
                <Navigation className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white">Interactive Train Route & Corridors Map</span>
                <span className="text-[10px] px-2 py-0.5 bg-slate-900 text-slate-400 rounded border border-slate-800 font-mono">
                  {isRerouted
                    ? 'Rerouted Corridor (Amber) + Skipped (Red)'
                    : train.current_status === 'in_transit'
                    ? 'In Transit (Live Highlight)'
                    : train.current_status === 'completed'
                    ? 'Completed Journey'
                    : 'Scheduled Path'}
                </span>
              </div>

              {/* Status Hint & Actions */}
              <div className="flex items-center space-x-2">
                {livePositionCoords && (
                  <button
                    onClick={handleFocusLiveTrain}
                    className="px-2 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 rounded text-[10px] font-mono flex items-center space-x-1.5 transition"
                    title="Center view on train live position"
                  >
                    <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>Focus Train</span>
                  </button>
                )}
                <span className="text-[10px] text-slate-500 font-mono flex items-center space-x-1">
                  <Move className="w-3 h-3 text-slate-400" />
                  <span>Drag to pan · Scroll to zoom</span>
                </span>
              </div>
            </div>

            {/* Viewport Container */}
            <div
              ref={containerRef}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onTouchCancel={handleTouchEnd}
              className={`relative w-full bg-[#080d1a] rounded-xl border border-slate-800 overflow-hidden select-none transition-all duration-300 ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              } ${isExpanded ? 'h-[520px]' : 'h-[360px]'}`}
            >
              {/* Subtle Railway Topology Grid Background */}
              <div
                className="absolute inset-0 pointer-events-none opacity-20"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 1px 1px, #334155 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                }}
              />

              {/* Floating Map Controls Toolbar */}
              <div className="absolute top-3 right-3 z-10 flex flex-col space-y-1.5 bg-slate-900/90 backdrop-blur border border-slate-700/80 p-1.5 rounded-lg shadow-xl">
                <button
                  onClick={() => zoomIn()}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded transition"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={() => zoomOut()}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded transition"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <button
                  onClick={autoFitRoute}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 rounded transition"
                  title="Fit to Route"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsExpanded((prev) => !prev)}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded transition"
                  title={isExpanded ? 'Collapse Height' : 'Expand Height'}
                >
                  {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
              </div>

              {/* Floating Legend Overlay */}
              <div className="absolute bottom-3 left-3 z-10 bg-slate-900/90 backdrop-blur border border-slate-800 px-3 py-2 rounded-lg text-[10px] font-mono space-y-1 shadow-lg pointer-events-none">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-1 bg-emerald-500 rounded" />
                  <span className="text-slate-300 font-semibold">Active Route Path</span>
                </div>
                {isRerouted && (
                  <>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-1 bg-amber-500 rounded" />
                      <span className="text-amber-300 font-semibold">Assigned Reroute Corridor</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-0.5 border-b border-dashed border-blue-400" />
                      <span className="text-blue-300 font-semibold">Original Path</span>
                    </div>
                    {skippedStations.length > 0 && (
                      <div className="flex items-center space-x-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-slate-900" />
                        <span className="text-red-400 font-semibold">Skipped Station ({skippedStations.length})</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-slate-600/40 border border-slate-700" />
                  <span className="text-slate-400">Nearby Regional Stations (Dimmed)</span>
                </div>
              </div>

              {/* Station Details Tooltip / Popup */}
              {inspectedStation && (
                <div
                  className="tooltip-card absolute top-3 left-3 z-20 bg-slate-900/95 border border-blue-500/60 p-3 rounded-lg shadow-2xl font-mono text-xs space-y-1.5 max-w-xs animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between space-x-3">
                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      <span className="font-bold text-white text-sm">{inspectedStation.code}</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-blue-950 text-blue-300 rounded border border-blue-800">
                        {inspectedStation.zone}
                      </span>
                    </div>
                    <button
                      onClick={() => setInspectedStation(null)}
                      className="text-slate-400 hover:text-white p-0.5 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-300 font-sans font-medium">{inspectedStation.name}</p>
                  <div className="pt-1 border-t border-slate-800 flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">Role: <span className="font-bold text-slate-200">{inspectedStation.role}</span></span>
                    {inspectedStation.time && (
                      <span className="text-emerald-400 font-bold">{formatTime24(inspectedStation.time)}</span>
                    )}
                  </div>
                </div>
              )}

              {/* SVG Transform Container with Pan and Zoom */}
              <div
                style={{
                  transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0px) scale(${viewport.scale})`,
                  transformOrigin: '0 0',
                  transition: 'none',
                  width: 3200,
                  height: 2400,
                }}
                className="pointer-events-auto"
              >
                <svg viewBox="0 0 3200 2400" className="w-[3200px] h-[2400px] pointer-events-auto">
                  <defs>
                    <filter id="routeGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#10b981" floodOpacity="0.6" />
                    </filter>
                    <filter id="amberGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#f59e0b" floodOpacity="0.75" />
                    </filter>
                  </defs>

                  {/* ── PASS 1: Nearby Background Track Connections (Dimmed / Off-Colored) ── */}
                  <g className="nearby-sections" opacity="0.32">
                    {nearbySections.map((sec) => {
                      const st1 = stationMap[sec.start_station_code];
                      const st2 = stationMap[sec.end_station_code];
                      if (!st1 || !st2) return null;

                      return (
                        <line
                          key={`nearby-sec-${sec.code}`}
                          x1={st1.schematic_x_position}
                          y1={st1.schematic_y_position}
                          x2={st2.schematic_x_position}
                          y2={st2.schematic_y_position}
                          stroke="#334155"
                          strokeWidth="1.5"
                          strokeDasharray="3,3"
                        />
                      );
                    })}
                  </g>

                  {/* ── PASS 2: Nearby Regional Stations (Dimmed / Off-Colored) ── */}
                  <g className="nearby-stations">
                    {nearbyStations.map((st) => (
                      <g
                        key={`nearby-stn-${st.code}`}
                        className="cursor-pointer group"
                        onClick={() =>
                          setInspectedStation({
                            code: st.code,
                            name: st.name,
                            zone: st.zone,
                            role: 'Nearby Regional Station',
                            x: st.schematic_x_position,
                            y: st.schematic_y_position,
                          })
                        }
                      >
                        <circle
                          cx={st.schematic_x_position}
                          cy={st.schematic_y_position}
                          r="4"
                          fill="#475569"
                          fillOpacity="0.35"
                          stroke="#1e293b"
                          strokeWidth="1"
                          className="transition-colors group-hover:fill-blue-400 group-hover:fill-opacity-80"
                        />
                        <text
                          x={st.schematic_x_position}
                          y={st.schematic_y_position + 12}
                          fill="#64748b"
                          fillOpacity="0.55"
                          fontSize="8"
                          textAnchor="middle"
                          className="font-mono pointer-events-none group-hover:fill-blue-200 group-hover:fill-opacity-100"
                          style={{
                            paintOrder: 'stroke fill',
                            stroke: '#090d16',
                            strokeWidth: '2px',
                          }}
                        >
                          {st.code}
                        </text>
                      </g>
                    ))}
                  </g>

                  {/* ── PASS 3: Original Scheduled Route — ONE continuous polyline through all ordered stops ── */}
                  <g className="original-route">
                    {(() => {
                      // Build ordered coordinate list from originalStops in sequence.
                      // Filter out any stop whose station code is missing from the map (null safety).
                      const pts = originalStops
                        .map((s) => stationMap[s.station_code])
                        .filter(Boolean)
                        .map((st) => `${st!.schematic_x_position},${st!.schematic_y_position}`)
                        .join(' ');

                      if (!pts || originalStops.length < 2) return null;

                      // Validate: first rendered code must match origin, last must match destination
                      const firstCode = originalStops[0].station_code;
                      const lastCode = originalStops[originalStops.length - 1].station_code;
                      const originOk = firstCode === train.origin_station_code;
                      const destOk = lastCode === train.destination_station_code;

                      // Debug guard: if mismatched, render a warning circle at canvas origin
                      if (!originOk || !destOk) {
                        console.warn(`[TrainDetailPanel] Route label mismatch: firstCode=${firstCode} (expected ${train.origin_station_code}), lastCode=${lastCode} (expected ${train.destination_station_code})`);
                      }

                      return (
                        <>
                          {/* Glow underlay — slightly thicker and more transparent */}
                          <polyline
                            points={pts}
                            fill="none"
                            stroke={isRerouted ? '#3b82f6' : '#10b981'}
                            strokeWidth={isRerouted ? '6' : '9'}
                            strokeOpacity={isRerouted ? 0.25 : 0.35}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                          {/* Main route line */}
                          <polyline
                            points={pts}
                            fill="none"
                            stroke={isRerouted ? '#3b82f6' : '#10b981'}
                            strokeWidth={isRerouted ? '3.5' : '5'}
                            strokeDasharray={isRerouted ? '8,5' : 'none'}
                            strokeOpacity={isRerouted ? 0.65 : 0.97}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </>
                      );
                    })()}
                  </g>

                  {/* ── PASS 4: Assigned Reroute Detour — ONE continuous polyline through all ordered detour stops ── */}
                  {isRerouted && (
                    <g className="assigned-reroute">
                      {(() => {
                        const pts = assignedStops
                          .map((s) => stationMap[s.station_code])
                          .filter(Boolean)
                          .map((st) => `${st!.schematic_x_position},${st!.schematic_y_position}`)
                          .join(' ');

                        if (!pts || assignedStops.length < 2) return null;

                        return (
                          <>
                            {/* Amber glow underlay */}
                            <polyline
                              points={pts}
                              fill="none"
                              stroke="#f59e0b"
                              strokeWidth="10"
                              strokeOpacity="0.30"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            {/* Main amber detour line */}
                            <polyline
                              points={pts}
                              fill="none"
                              stroke="#f59e0b"
                              strokeWidth="6"
                              strokeOpacity="0.97"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </>
                        );
                      })()}
                    </g>
                  )}


                  {/* ── PASS 5: Live Train Position Marker for In-Transit Trains ── */}
                  {livePositionCoords && (
                    <g className="live-train-marker pointer-events-none">
                      <circle
                        cx={livePositionCoords.x}
                        cy={livePositionCoords.y}
                        r="18"
                        fill="#10b981"
                        fillOpacity="0.25"
                        className="animate-ping"
                      />
                      <circle
                        cx={livePositionCoords.x}
                        cy={livePositionCoords.y}
                        r="9"
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth="2.5"
                      />
                      <rect
                        x={livePositionCoords.x - 38}
                        y={livePositionCoords.y - 28}
                        width="76"
                        height="18"
                        rx="4"
                        fill="#064e3b"
                        stroke="#10b981"
                        strokeWidth="1.5"
                      />
                      <text
                        x={livePositionCoords.x}
                        y={livePositionCoords.y - 16}
                        fill="#6ee7b7"
                        fontSize="8.5"
                        fontWeight="bold"
                        fontFamily="monospace"
                        textAnchor="middle"
                      >
                        LIVE TRAIN
                      </text>
                    </g>
                  )}

                  {/* ── PASS 6: Route Station Nodes (High-Contrast, Prominent) ── */}
                  <g className="route-stations">
                    {Array.from(routeNodeSet).map((code) => {
                      const st = stationMap[code];
                      if (!st) return null;

                      const isOrigStop = origCodes.includes(code);
                      const isAssignedStop = assignedCodes.includes(code);
                      const isSkipped = skippedStations.includes(code);
                      const isOrigin = code === train.origin_station_code;
                      const isDestination = code === train.destination_station_code;
                      const isTerminus = isOrigin || isDestination;

                      // Find scheduled time for stop
                      const activeStop = activePathStops.find((s) => s.station_code === code);
                      const origStop = originalStops.find((s) => s.station_code === code);
                      const stopTime = activeStop?.scheduled_time || origStop?.scheduled_time;

                      // Determine color scheme
                      let nodeColor = '#3b82f6'; // Scheduled Blue
                      let roleLabel = 'Scheduled Stop';

                      if (isSkipped) {
                        nodeColor = '#ef4444'; // Skipped Red
                        roleLabel = 'Skipped Station due to Reroute';
                      } else if (isAssignedStop && isRerouted && !isOrigStop) {
                        nodeColor = '#f59e0b'; // Detour Bypass Amber
                        roleLabel = 'Assigned Detour Station';
                      } else if (isOrigin) {
                        nodeColor = '#3b82f6';
                        roleLabel = 'Origin Station';
                      } else if (isDestination) {
                        nodeColor = '#10b981';
                        roleLabel = 'Destination Station';
                      } else if (!isRerouted) {
                        nodeColor = train.current_status === 'in_transit' ? '#10b981' : '#3b82f6';
                      }

                      return (
                        <g
                          key={`route-stn-${code}`}
                          className="cursor-pointer group"
                          onClick={() =>
                            setInspectedStation({
                              code: st.code,
                              name: st.name,
                              zone: st.zone,
                              role: roleLabel,
                              time: stopTime,
                              x: st.schematic_x_position,
                              y: st.schematic_y_position,
                            })
                          }
                        >
                          {/* Terminus Double Pulsing Halo */}
                          {isTerminus && (
                            <>
                              <circle
                                cx={st.schematic_x_position}
                                cy={st.schematic_y_position}
                                r="16"
                                fill={nodeColor}
                                fillOpacity="0.18"
                                className="animate-pulse"
                              />
                              <circle
                                cx={st.schematic_x_position}
                                cy={st.schematic_y_position}
                                r="11"
                                fill="none"
                                stroke={nodeColor}
                                strokeWidth="1.5"
                                strokeDasharray="3,2"
                              />
                            </>
                          )}

                          {/* Skipped Station Warning Halo */}
                          {isSkipped && (
                            <circle
                              cx={st.schematic_x_position}
                              cy={st.schematic_y_position}
                              r="13"
                              fill="#ef4444"
                              fillOpacity="0.25"
                            />
                          )}

                          {/* Main Station Circle */}
                          <circle
                            cx={st.schematic_x_position}
                            cy={st.schematic_y_position}
                            r={isTerminus ? '8.5' : isSkipped ? '7.5' : '6.5'}
                            fill={nodeColor}
                            stroke="#0b1329"
                            strokeWidth="2.5"
                            className="transition-transform group-hover:scale-125"
                          />

                          {/* Skipped cross indicator */}
                          {isSkipped && (
                            <text
                              x={st.schematic_x_position}
                              y={st.schematic_y_position + 3}
                              fill="#ffffff"
                              fontSize="8"
                              fontWeight="bold"
                              textAnchor="middle"
                              className="pointer-events-none select-none"
                            >
                              ✕
                            </text>
                          )}

                          {/* Station Code Label with Dark Outline */}
                          <text
                            x={st.schematic_x_position}
                            y={st.schematic_y_position + 19}
                            fill={
                              isSkipped
                                ? '#f87171'
                                : isTerminus
                                ? '#ffffff'
                                : isRerouted && isAssignedStop
                                ? '#fde68a'
                                : '#e2e8f0'
                            }
                            fontSize={isTerminus ? '12' : '10'}
                            fontWeight="bold"
                            textAnchor="middle"
                            className="font-mono tracking-tight"
                            style={{
                              paintOrder: 'stroke fill',
                              stroke: '#080d1a',
                              strokeWidth: '3.5px',
                              strokeLinejoin: 'round',
                            }}
                          >
                            {code}
                          </text>

                          {/* Terminus Badge Label */}
                          {isTerminus && (
                            <text
                              x={st.schematic_x_position}
                              y={st.schematic_y_position - 14}
                              fill={isOrigin ? '#60a5fa' : '#34d399'}
                              fontSize="8"
                              fontWeight="bold"
                              fontFamily="monospace"
                              textAnchor="middle"
                              style={{
                                paintOrder: 'stroke fill',
                                stroke: '#080d1a',
                                strokeWidth: '2.5px',
                              }}
                            >
                              {isOrigin ? 'ORIGIN' : 'DEST'}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                </svg>
              </div>
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
                const isBypass = stop.is_bypass || !origCodes.includes(stop.station_code);
                const stInfo = stationMap[stop.station_code];

                return (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border font-mono flex items-center justify-between text-xs transition ${
                      isOrigin
                        ? 'bg-blue-950/60 border-blue-700/80 text-blue-200'
                        : isDestination
                        ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-200'
                        : isBypass && isRerouted
                        ? 'bg-amber-950/50 border-amber-600/70 text-amber-200'
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
                          {isBypass && isRerouted && (
                            <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-600 text-white rounded">DETOUR</span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block mt-0.5">
                          Zone: {stInfo?.zone || 'NR'} · {isBypass && isRerouted ? 'Bypass Detour Stop' : 'Scheduled Stop'}
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
