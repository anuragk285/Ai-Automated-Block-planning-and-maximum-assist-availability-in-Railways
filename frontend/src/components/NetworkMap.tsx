import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { NetworkData, StationNode, SectionEdge, BlockPlanItem } from '../types';
import { MapPin, Activity, Search, Filter, ZoomIn, ZoomOut, RotateCcw, Move, ShieldCheck, AlertTriangle, Layers, Navigation, ArrowRight, X, Compass, CheckCircle2, Info, GitFork } from 'lucide-react';
import { usePersistedFilters } from '../hooks/usePersistedFilters';

interface NetworkMapProps {
  network: NetworkData | null;
  blocks: BlockPlanItem[];
}

interface NetworkMapFilters {
  sourceStationCode: string;
  targetStationCode: string;
  selectedZone: string;
  searchQuery: string;
}

const DEFAULT_NETWORK_FILTERS: NetworkMapFilters = {
  sourceStationCode: 'NDLS',
  targetStationCode: 'HWH',
  selectedZone: 'ALL',
  searchQuery: '',
};

export const NetworkMap: React.FC<NetworkMapProps> = ({ network, blocks }) => {
  // Persisted Route & Search Filters
  const { filters, updateFilter, resetFilters, hasActiveFilters } = usePersistedFilters<NetworkMapFilters>(
    'filters:networkMap',
    DEFAULT_NETWORK_FILTERS
  );
  const { sourceStationCode, targetStationCode, selectedZone, searchQuery } = filters;

  const setSourceStationCode = useCallback((code: string) => updateFilter('sourceStationCode', code), [updateFilter]);
  const setTargetStationCode = useCallback((code: string) => updateFilter('targetStationCode', code), [updateFilter]);
  const setSelectedZone = useCallback((zone: string) => updateFilter('selectedZone', zone), [updateFilter]);
  const setSearchQuery = useCallback((query: string) => updateFilter('searchQuery', query), [updateFilter]);

  const [hoveredStation, setHoveredStation] = useState<StationNode | null>(null);
  const [selectedStation, setSelectedStation] = useState<StationNode | null>(null);
  const [hoveredSection, setHoveredSection] = useState<SectionEdge | null>(null);
  const [selectedSection, setSelectedSection] = useState<SectionEdge | null>(null);

  // ── Pan & Zoom Viewport State ──
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Quick lookup dictionary for stations
  const stationMap: Record<string, StationNode> = useMemo(() => {
    if (!network) return {};
    const map: Record<string, StationNode> = {};
    network.stations.forEach((s) => {
      map[s.code] = s;
    });
    return map;
  }, [network]);

  // Major Hub Stations (always prioritized for LOD labeling)
  const majorStationCodes = useMemo(
    () =>
      new Set([
        'NDLS', 'DLI', 'ANVT', 'GZB', 'ALJN', 'TDL', 'ETW', 'CNB', 'PRYJ', 'DDU', 'BSB',
        'MB', 'BE', 'SRE', 'HW', 'RKSH', 'LKO', 'AY', 'GKP', 'GD', 'BCT', 'ADI', 'BRC',
        'ST', 'RTM', 'KOTA', 'SWM', 'CSTM', 'PUNE', 'NGP', 'BPL', 'JBP', 'ET', 'HWH',
        'SDAH', 'GAYA', 'DHN', 'ASN', 'PNBE', 'MFP', 'MAS', 'SBC', 'HYB', 'SC', 'GTL', 'TVC', 'ERS'
      ]),
    []
  );

  // ── 1 & 2. REQUIREMENT: Auto-Fit Bounding Box on Load ──
  const autoFitNetworkView = useCallback(() => {
    if (!network?.stations.length || !containerRef.current) return;

    const xs = network.stations.map((s) => s.schematic_x_position);
    const ys = network.stations.map((s) => s.schematic_y_position);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const netWidth = maxX - minX || 1000;
    const netHeight = maxY - minY || 800;

    const containerWidth = containerRef.current.clientWidth || 900;
    const containerHeight = containerRef.current.clientHeight || 600;

    const scaleX = (containerWidth - 80) / netWidth;
    const scaleY = (containerHeight - 80) / netHeight;
    const initialZoom = Math.min(scaleX, scaleY, 1.2);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const initialPanX = containerWidth / 2 - centerX * initialZoom;
    const initialPanY = containerHeight / 2 - centerY * initialZoom;

    setZoomLevel(initialZoom);
    setPanX(initialPanX);
    setPanY(initialPanY);
  }, [network]);

  // Initial Auto-Fit Mount
  useEffect(() => {
    if (network?.stations.length) {
      const timer = setTimeout(() => autoFitNetworkView(), 50);
      return () => clearTimeout(timer);
    }
  }, [network, autoFitNetworkView]);

  // Page Scroll Containment inside Map Viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault(); // Prevents parent page scrolling while zooming over map
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoomLevel((prevZoom) => Math.min(4.5, Math.max(0.2, prevZoom * zoomFactor)));
    };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleNativeWheel);
    };
  }, []);

  if (!network) {
    return (
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
        Loading Railway Network Topology...
      </div>
    );
  }

  // Evaluate individual physical track status
  const getTrackStatus = (secCode: string, trackNum: number) => {
    const block = blocks.find(
      (b) => b.section_code === secCode && (b.target_track_number === trackNum || !b.target_track_number)
    );

    if (block) {
      if (block.status === 'Approved') return { status: 'APPROVED_BLOCK', color: '#ef4444', label: `APPROVED BLOCK (${block.block_id})` };
      return { status: 'PROPOSED_BLOCK', color: '#f59e0b', label: `PROPOSED BLOCK (${block.block_id})` };
    }

    if (secCode.includes('GZB_ALJN') || secCode.includes('MB_BE') || secCode.includes('PRYJ_BSB')) {
      return { status: 'AT_RISK', color: '#f59e0b', label: 'AT-RISK ASSET (WEAR / FAULT)' };
    }

    return { status: 'CLEAR', color: '#10b981', label: 'HEALTHY / FREE' };
  };

  // Filter stations based on selected Zone or Search
  const filteredStations = network.stations.filter((st) => {
    if (selectedZone !== 'ALL' && selectedZone !== 'MAIN') {
      if (st.zone !== selectedZone) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchCode = st.code.toLowerCase().includes(q);
      const matchName = st.name?.toLowerCase().includes(q);
      if (!matchCode && !matchName) return false;
    }
    return true;
  });

  // Filter sections connecting visible stations
  const filteredSections = network.sections.filter((sec) => {
    if (selectedZone === 'MAIN') {
      return !sec.code.startsWith('SEC_STN');
    }
    if (selectedZone !== 'ALL') {
      const startSt = stationMap[sec.start_station_code];
      const endSt = stationMap[sec.end_station_code];
      if (startSt?.zone !== selectedZone && endSt?.zone !== selectedZone) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchSec = sec.code.toLowerCase().includes(q);
      const matchStart = sec.start_station_code.toLowerCase().includes(q);
      const matchEnd = sec.end_station_code.toLowerCase().includes(q);
      if (!matchSec && !matchStart && !matchEnd) return false;
    }
    return true;
  });

  // ── 3 & 7. REQUIREMENT: Graph Pathfinder for Source -> Destination Route Highlighting ──
  const highlightedRoutePath = useMemo(() => {
    if (!sourceStationCode || !targetStationCode || sourceStationCode === targetStationCode) return null;

    // Adjacency graph
    const adj: Record<string, { node: string; sec: SectionEdge }[]> = {};
    network.sections.forEach((sec) => {
      if (!adj[sec.start_station_code]) adj[sec.start_station_code] = [];
      if (!adj[sec.end_station_code]) adj[sec.end_station_code] = [];
      adj[sec.start_station_code].push({ node: sec.end_station_code, sec });
      adj[sec.end_station_code].push({ node: sec.start_station_code, sec });
    });

    // BFS shortest path search
    const queue: { node: string; path: string[]; edges: SectionEdge[]; distKm: number }[] = [
      { node: sourceStationCode, path: [sourceStationCode], edges: [], distKm: 0 }
    ];
    const visited = new Set<string>([sourceStationCode]);

    while (queue.length > 0) {
      const { node, path, edges, distKm } = queue.shift()!;

      if (node === targetStationCode) {
        const nodeSet = new Set(path);
        const edgeSet = new Set(edges.map((e) => e.code));

        const hasDisruption = edges.some((e) =>
          blocks.some((b) => b.section_code === e.code && b.status === 'Approved')
        );

        return {
          nodes: path,
          edges: edges,
          nodeSet,
          edgeSet,
          totalDistanceKm: Math.round(distKm),
          totalHops: path.length - 1,
          hasDisruption
        };
      }

      const neighbors = adj[node] || [];
      for (const { node: neighbor, sec } of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({
            node: neighbor,
            path: [...path, neighbor],
            edges: [...edges, sec],
            distKm: distKm + sec.length_km
          });
        }
      }
    }

    return null;
  }, [sourceStationCode, targetStationCode, network.sections, blocks]);

  // ── 4. REQUIREMENT: Greedy Collision Avoidance Label-Placement Algorithm ──
  const placedLabels = useMemo(() => {
    const renderedBoxes: { x: number; y: number; w: number; h: number }[] = [];
    const visibleLabelCodes = new Set<string>();

    const routeNodeSet = highlightedRoutePath?.nodeSet || new Set<string>();

    // Priorities: Source/Target (10), Active Route Stations (9), Hovered/Selected (8), Search match (7), Major Hubs (5)
    const sortedStations = [...filteredStations].sort((a, b) => {
      const aPrio = (a.code === sourceStationCode || a.code === targetStationCode ? 10 : 0) +
                    (routeNodeSet.has(a.code) ? 9 : 0) +
                    (hoveredStation?.code === a.code || selectedStation?.code === a.code ? 8 : 0) +
                    (searchQuery && a.code.toLowerCase().includes(searchQuery.toLowerCase()) ? 7 : 0) +
                    (majorStationCodes.has(a.code) ? 5 : 0);
      const bPrio = (b.code === sourceStationCode || b.code === targetStationCode ? 10 : 0) +
                    (routeNodeSet.has(b.code) ? 9 : 0) +
                    (hoveredStation?.code === b.code || selectedStation?.code === b.code ? 8 : 0) +
                    (searchQuery && b.code.toLowerCase().includes(searchQuery.toLowerCase()) ? 7 : 0) +
                    (majorStationCodes.has(b.code) ? 5 : 0);
      return bPrio - aPrio;
    });

    // Check spatial collision box overlap
    const isColliding = (box: { x: number; y: number; w: number; h: number }) => {
      for (const b of renderedBoxes) {
        if (
          box.x < b.x + b.w &&
          box.x + box.w > b.x &&
          box.y < b.y + b.h &&
          box.y + box.h > b.y
        ) {
          return true;
        }
      }
      return false;
    };

    sortedStations.forEach((st) => {
      const isHighPriority =
        st.code === sourceStationCode ||
        st.code === targetStationCode ||
        routeNodeSet.has(st.code) ||
        hoveredStation?.code === st.code ||
        selectedStation?.code === st.code ||
        (searchQuery && st.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        majorStationCodes.has(st.code);

      // Level-of-Detail (LOD): Minor non-priority stations reveal progressively as user zooms in (>= 1.4)
      if (!isHighPriority && zoomLevel < 1.4) return;

      const labelWidth = Math.max(32, st.code.length * 8.5);
      const labelHeight = 14;

      // Candidate anchor positions: Below, Above, Right, Left
      const candidates = [
        { x: st.schematic_x_position - labelWidth / 2, y: st.schematic_y_position + 12, w: labelWidth, h: labelHeight, pos: 'below' },
        { x: st.schematic_x_position - labelWidth / 2, y: st.schematic_y_position - 22, w: labelWidth, h: labelHeight, pos: 'above' },
        { x: st.schematic_x_position + 12, y: st.schematic_y_position - 6, w: labelWidth, h: labelHeight, pos: 'right' },
        { x: st.schematic_x_position - labelWidth - 12, y: st.schematic_y_position - 6, w: labelWidth, h: labelHeight, pos: 'left' },
      ];

      let placed = false;
      for (const cand of candidates) {
        if (!isColliding(cand)) {
          renderedBoxes.push(cand);
          visibleLabelCodes.add(st.code);
          placed = true;
          break;
        }
      }

      // High priority hubs & route stations get rendered even if overlapping slightly
      if (!placed && isHighPriority) {
        renderedBoxes.push(candidates[0]);
        visibleLabelCodes.add(st.code);
      }
    });

    return visibleLabelCodes;
  }, [filteredStations, sourceStationCode, targetStationCode, highlightedRoutePath, hoveredStation, selectedStation, searchQuery, majorStationCodes, zoomLevel]);

  // Bezier curve calculation helper for curved rail connectors
  const getCurvedBezierPath = (x1: number, y1: number, x2: number, y2: number, offsetPx: number = 0) => {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    const px = -dy / len;
    const py = dx / len;

    const curveAmount = Math.min(45, len * 0.15);
    const ctrlX = midX + px * (curveAmount + offsetPx);
    const ctrlY = midY + py * (curveAmount + offsetPx);

    return `M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`;
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - panX, y: e.clientY - panY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanX(e.clientX - dragStartRef.current.x);
    setPanY(e.clientY - dragStartRef.current.y);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Click on station: selects station node for inspection and option to set origin/destination
  const handleStationClick = (st: StationNode) => {
    setSelectedStation(st);
  };

  const allStationOptions = useMemo(
    () => network.stations.map((s) => s.code).sort(),
    [network.stations]
  );

  // Split edges into background network edges and active highlighted route edges for layering
  const backgroundSections = useMemo(() => {
    return filteredSections.filter((sec) => !highlightedRoutePath?.edgeSet.has(sec.code));
  }, [filteredSections, highlightedRoutePath]);

  const routeSections = useMemo(() => {
    return filteredSections.filter((sec) => highlightedRoutePath?.edgeSet.has(sec.code));
  }, [filteredSections, highlightedRoutePath]);

  // Find connected sections for selected station
  const stationConnectedSections = useMemo(() => {
    if (!selectedStation) return [];
    return network.sections.filter(
      (sec) => sec.start_station_code === selectedStation.code || sec.end_station_code === selectedStation.code
    );
  }, [selectedStation, network.sections]);

  return (
    <div className="space-y-4 select-none">
      {/* ── 3. REQUIREMENT: Source & Destination Route Selector Header ── */}
      <div className="bg-slate-800/90 border border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg">
            <Navigation className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Full Network Interactive Train Pathfinder</h2>
            <p className="text-xs text-slate-400">Entire network remains visible; active route path highlights on top</p>
          </div>
        </div>

        {/* Source & Destination Dropdown Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-slate-900 border border-blue-500/40 px-3 py-1.5 rounded-lg shadow-inner">
            <span className="text-[11px] font-mono font-bold text-blue-400">ORIGIN:</span>
            <select
              value={sourceStationCode}
              onChange={(e) => setSourceStationCode(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none"
            >
              <option value="" className="bg-slate-900">Select Origin...</option>
              {allStationOptions.map((code) => (
                <option key={code} value={code} className="bg-slate-900 text-white">
                  {code} - {stationMap[code]?.name || code}
                </option>
              ))}
            </select>
          </div>

          <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />

          <div className="flex items-center space-x-2 bg-slate-900 border border-emerald-500/40 px-3 py-1.5 rounded-lg shadow-inner">
            <span className="text-[11px] font-mono font-bold text-emerald-400">DESTINATION:</span>
            <select
              value={targetStationCode}
              onChange={(e) => setTargetStationCode(e.target.value)}
              className="bg-transparent text-xs font-mono font-bold text-white focus:outline-none"
            >
              <option value="" className="bg-slate-900">Select Destination...</option>
              {allStationOptions.map((code) => (
                <option key={code} value={code} className="bg-slate-900 text-white">
                  {code} - {stationMap[code]?.name || code}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search station..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-md pl-8 pr-3 py-1.5 w-44 focus:outline-none focus:border-blue-500 placeholder-slate-500"
            />
          </div>

          {/* Reset Fit View */}
          <button
            onClick={() => {
              autoFitNetworkView();
              setSearchQuery('');
            }}
            className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold rounded-md border border-slate-600 transition flex items-center space-x-1.5 shadow"
            title="Auto-Fit Network View"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
            <span>Auto Fit</span>
          </button>

          {/* Reset Route & Filters */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                resetFilters();
                autoFitNetworkView();
              }}
              className="flex items-center space-x-1 text-xs text-amber-400 hover:text-amber-300 font-semibold px-2 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-md transition"
              title="Reset route and search to defaults"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Route</span>
            </button>
          )}
        </div>
      </div>

      {/* ── 7. REQUIREMENT: Highlighted Route Info Panel ── */}
      {highlightedRoutePath && (
        <div className="bg-gradient-to-r from-slate-900 via-blue-950/70 to-slate-900 border border-blue-500/50 p-4 rounded-xl shadow-xl space-y-3 font-mono">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-sm font-extrabold">
                <span className="px-2.5 py-1 bg-blue-600 text-white rounded shadow">{sourceStationCode}</span>
                <ArrowRight className="w-4 h-4 text-blue-400" />
                <span className="px-2.5 py-1 bg-emerald-600 text-white rounded shadow">{targetStationCode}</span>
              </div>
              <span className="text-xs text-slate-300 font-bold">Selected Path Corridor</span>
            </div>

            <div className="flex items-center space-x-3 text-xs">
              <span className="px-3 py-1 bg-blue-900/60 text-blue-300 border border-blue-700/60 rounded-full font-bold">
                {highlightedRoutePath.totalHops} Route Sections ({highlightedRoutePath.nodes.length} Stations)
              </span>

              <span className="px-3 py-1 bg-slate-800 text-emerald-400 border border-slate-700 rounded-full font-bold">
                {highlightedRoutePath.totalDistanceKm} KM Total Distance
              </span>

              {highlightedRoutePath.hasDisruption ? (
                <span className="px-3 py-1 bg-red-900/60 text-red-300 border border-red-700/60 rounded-full font-bold animate-pulse flex items-center space-x-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span>Active Block Disruption</span>
                </span>
              ) : (
                <span className="px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-700/50 rounded-full font-bold flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Route Healthy</span>
                </span>
              )}
            </div>
          </div>

          {/* Ordered Intermediate Station List */}
          <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-[11px] scrollbar-thin scrollbar-thumb-slate-700">
            <span className="text-slate-400 font-bold shrink-0">Stops:</span>
            {highlightedRoutePath.nodes.map((stCode, idx) => {
              const isFirst = idx === 0;
              const isLast = idx === highlightedRoutePath.nodes.length - 1;
              return (
                <React.Fragment key={stCode}>
                  {idx > 0 && <span className="text-slate-600 font-bold">→</span>}
                  <button
                    onClick={() => {
                      const st = stationMap[stCode];
                      if (st) setSelectedStation(st);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition shrink-0 border ${
                      isFirst
                        ? 'bg-blue-600/30 text-blue-300 border-blue-500/50'
                        : isLast
                        ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50'
                        : 'bg-slate-800 text-slate-200 border-slate-700 hover:border-blue-400'
                    }`}
                  >
                    {stCode}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main Map Canvas & Side Detail Drawer Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SVG Network Map Canvas */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl relative flex flex-col justify-between overflow-hidden">
          {/* Status Legend & Level-of-Detail Indicator */}
          <div className="flex flex-wrap items-center justify-between text-xs mb-3 px-1 z-10 gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1.5 text-slate-300">
                <span className="w-3.5 h-1.5 rounded bg-cyan-400 inline-block shadow-sm shadow-cyan-400/50" />
                <span className="font-bold text-cyan-300">Active Path</span>
              </span>
              <span className="flex items-center space-x-1.5 text-slate-300">
                <span className="w-3.5 h-1 rounded bg-slate-500/60 inline-block" />
                <span className="text-slate-400">Background Network (Dimmed)</span>
              </span>
              <span className="flex items-center space-x-1.5 text-slate-300">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block shadow-sm shadow-red-500/50 animate-pulse" />
                <span>Blocked Section</span>
              </span>
            </div>

            <div className="text-[11px] font-mono text-slate-400">
              Zoom: <span className="text-blue-400 font-bold">{Math.round(zoomLevel * 100)}%</span> · Showing {placedLabels.size} labels (Collision-Free)
            </div>
          </div>

          {/* ── 6. REQUIREMENT: Interactive Viewport Canvas (Scroll Lock) ── */}
          <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              handleMouseUp();
              setHoveredStation(null);
              setHoveredSection(null);
            }}
            style={{ overscrollBehavior: 'contain', touchAction: 'none' }}
            className={`w-full h-[600px] bg-slate-950/90 rounded-lg border border-slate-800 relative overflow-hidden ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            {/* Grid Background Pattern */}
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: 'radial-gradient(#38bdf8 1px, transparent 1px)',
                backgroundSize: `${40 * zoomLevel}px ${40 * zoomLevel}px`,
                backgroundPosition: `${panX}px ${panY}px`,
              }}
            />

            {/* Hover Tooltip Card for Station */}
            {hoveredStation && (
              <div
                className="absolute z-30 bg-slate-900/95 border border-slate-700 p-3 rounded-lg shadow-2xl pointer-events-none text-xs font-mono backdrop-blur-md"
                style={{
                  left: Math.min(window.innerWidth - 320, hoveredStation.schematic_x_position * zoomLevel + panX + 15),
                  top: Math.min(500, hoveredStation.schematic_y_position * zoomLevel + panY + 15),
                }}
              >
                <div className="font-bold text-blue-400 flex items-center justify-between gap-3">
                  <span>{hoveredStation.name || hoveredStation.code}</span>
                  <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 border border-slate-700">
                    {hoveredStation.zone} Zone
                  </span>
                </div>
                <div className="text-[11px] text-slate-300 mt-1">
                  Station Code: <span className="text-white font-bold">{hoveredStation.code}</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Click to inspect station & connections
                </div>
              </div>
            )}

            {/* Hover Tooltip Card for Section Line (Requirement 6) */}
            {hoveredSection && !hoveredStation && (
              <div
                className="absolute z-30 bg-slate-900/95 border border-purple-500/60 p-3 rounded-lg shadow-2xl pointer-events-none text-xs font-mono backdrop-blur-md"
                style={{ left: 20, top: 20 }}
              >
                <div className="font-bold text-purple-300 flex items-center space-x-2">
                  <GitFork className="w-3.5 h-3.5 text-purple-400" />
                  <span>Section: {hoveredSection.code}</span>
                </div>
                <div className="text-[11px] text-slate-300 mt-1">
                  {hoveredSection.start_station_code} ↔ {hoveredSection.end_station_code} ({hoveredSection.length_km} KM)
                </div>
                <div className="text-[10px] text-purple-400 mt-0.5">
                  Hovering background route (brought to 95% opacity for alternate route exploration)
                </div>
              </div>
            )}

            {/* SVG Group shifted by pan & scale */}
            <div
              style={{
                transform: `translate(${panX}px, ${panY}px) scale(${zoomLevel})`,
                transformOrigin: '0 0',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                width: 3200,
                height: 2000,
              }}
            >
              <svg viewBox="0 0 3200 2000" className="w-[3200px] h-[2000px] pointer-events-auto">
                {/* ── PASS 1: Draw Background Network Sections (Edges) ── */}
                {backgroundSections.map((sec) => {
                  const startSt = stationMap[sec.start_station_code];
                  const endSt = stationMap[sec.end_station_code];
                  if (!startSt || !endSt) return null;

                  const isDoubleTrack = sec.total_tracks > 1;
                  const track1Info = getTrackStatus(sec.code, 1);
                  const track2Info = isDoubleTrack ? getTrackStatus(sec.code, 2) : track1Info;

                  const isHovered = hoveredSection?.code === sec.code;
                  const isSelected = selectedSection?.code === sec.code;

                  // Requirement 1 & 3: Background sections stay visible (25-35% opacity), NOT removed
                  const lineOpacity = isHovered
                    ? 0.95
                    : highlightedRoutePath
                    ? 0.32
                    : isSelected
                    ? 1.0
                    : 0.85;

                  const strokeWidthVal = isHovered ? 4.5 : isSelected ? 4.5 : 2.0;

                  const strokeColor1 = isHovered
                    ? '#a855f7' // Purple highlight on hover for alternate path exploration
                    : isSelected
                    ? '#3b82f6'
                    : track1Info.color;

                  const strokeColor2 = isHovered
                    ? '#c084fc'
                    : isSelected
                    ? '#60a5fa'
                    : track2Info.color;

                  const path1 = getCurvedBezierPath(
                    startSt.schematic_x_position,
                    startSt.schematic_y_position,
                    endSt.schematic_x_position,
                    endSt.schematic_y_position,
                    isDoubleTrack ? 3 : 0
                  );

                  const path2 = isDoubleTrack
                    ? getCurvedBezierPath(
                        startSt.schematic_x_position,
                        startSt.schematic_y_position,
                        endSt.schematic_x_position,
                        endSt.schematic_y_position,
                        -3
                      )
                    : null;

                  return (
                    <g
                      key={sec.code}
                      className="cursor-pointer group"
                      onMouseEnter={() => setHoveredSection(sec)}
                      onMouseLeave={() => setHoveredSection(null)}
                      onClick={() => setSelectedSection(sec)}
                    >
                      <path
                        d={path1}
                        fill="none"
                        stroke={strokeColor1}
                        strokeWidth={strokeWidthVal}
                        strokeDasharray={sec.track_type === 'Single' ? '5,3' : 'none'}
                        strokeOpacity={lineOpacity}
                        className="transition-all duration-200"
                      />

                      {isDoubleTrack && path2 && (
                        <path
                          d={path2}
                          fill="none"
                          stroke={strokeColor2}
                          strokeWidth={strokeWidthVal}
                          strokeOpacity={lineOpacity}
                          className="transition-all duration-200"
                        />
                      )}
                    </g>
                  );
                })}

                {/* ── PASS 2: Draw Active Highlighted Route Sections ON TOP of background ── */}
                {routeSections.map((sec) => {
                  const startSt = stationMap[sec.start_station_code];
                  const endSt = stationMap[sec.end_station_code];
                  if (!startSt || !endSt) return null;

                  const isDoubleTrack = sec.total_tracks > 1;

                  const path1 = getCurvedBezierPath(
                    startSt.schematic_x_position,
                    startSt.schematic_y_position,
                    endSt.schematic_x_position,
                    endSt.schematic_y_position,
                    isDoubleTrack ? 3 : 0
                  );

                  const path2 = isDoubleTrack
                    ? getCurvedBezierPath(
                        startSt.schematic_x_position,
                        startSt.schematic_y_position,
                        endSt.schematic_x_position,
                        endSt.schematic_y_position,
                        -3
                      )
                    : null;

                  return (
                    <g
                      key={`hl_${sec.code}`}
                      className="cursor-pointer group"
                      onMouseEnter={() => setHoveredSection(sec)}
                      onMouseLeave={() => setHoveredSection(null)}
                      onClick={() => setSelectedSection(sec)}
                    >
                      {/* Outer Glow for Bold Route Emphasis */}
                      <path
                        d={path1}
                        fill="none"
                        stroke="#0284c7"
                        strokeWidth={13}
                        strokeOpacity={0.35}
                      />

                      {/* Main Thick Glowing Line on Top */}
                      <path
                        d={path1}
                        fill="none"
                        stroke="#38bdf8"
                        strokeWidth={6.5}
                        strokeOpacity={1.0}
                        className="transition-all duration-200"
                      />

                      {isDoubleTrack && path2 && (
                        <path
                          d={path2}
                          fill="none"
                          stroke="#60a5fa"
                          strokeWidth={5.5}
                          strokeOpacity={1.0}
                          className="transition-all duration-200"
                        />
                      )}
                    </g>
                  );
                })}

                {/* ── PASS 3: Draw Station Nodes & Collision-Free Labels ── */}
                {filteredStations.map((st) => {
                  const isMajor = majorStationCodes.has(st.code);
                  const isMatched = searchQuery && st.code.toLowerCase().includes(searchQuery.toLowerCase());
                  const isSource = st.code === sourceStationCode;
                  const isTarget = st.code === targetStationCode;
                  const isOnHighlightedRoute = highlightedRoutePath?.nodeSet.has(st.code);
                  const isHovered = hoveredStation?.code === st.code;
                  const isSelected = selectedStation?.code === st.code;

                  // Requirement 1 & 3: Nearby stations stay visible at 50% opacity, NOT hidden
                  const nodeOpacity = highlightedRoutePath
                    ? isOnHighlightedRoute || isSource || isTarget || isMajor || isSelected
                      ? 1.0
                      : 0.50
                    : 1.0;

                  const shouldShowLabel = placedLabels.has(st.code);

                  return (
                    <g
                      key={st.code}
                      className="cursor-pointer group"
                      style={{ opacity: nodeOpacity }}
                      onMouseEnter={() => setHoveredStation(st)}
                      onClick={() => handleStationClick(st)}
                    >
                      {/* Radiant Ring for Source, Target, or Active Route Stations */}
                      {(isSource || isTarget || isOnHighlightedRoute || isSelected) && (
                        <circle
                          cx={st.schematic_x_position}
                          cy={st.schematic_y_position}
                          r={isSource || isTarget ? '18' : '14'}
                          fill={isSource ? '#3b82f6' : isTarget ? '#10b981' : '#38bdf8'}
                          fillOpacity={isSource || isTarget ? '0.35' : '0.25'}
                          stroke={isSource ? '#3b82f6' : isTarget ? '#10b981' : '#38bdf8'}
                          strokeWidth="1.5"
                          className="animate-pulse"
                        />
                      )}

                      {/* Station Node Circle */}
                      <circle
                        cx={st.schematic_x_position}
                        cy={st.schematic_y_position}
                        r={isSource || isTarget ? 9.5 : isOnHighlightedRoute ? 7 : isMajor ? 6 : 3.5}
                        fill={
                          isSource
                            ? '#3b82f6'
                            : isTarget
                            ? '#10b981'
                            : isOnHighlightedRoute
                            ? '#38bdf8'
                            : isMajor
                            ? '#1e293b'
                            : '#334155'
                        }
                        stroke={
                          isSource || isTarget
                            ? '#ffffff'
                            : isOnHighlightedRoute
                            ? '#38bdf8'
                            : isMajor
                            ? '#38bdf8'
                            : '#64748b'
                        }
                        strokeWidth={isMajor || isSource || isTarget || isOnHighlightedRoute ? 2.5 : 1}
                        className="transition-all group-hover:r-7 group-hover:stroke-cyan-300"
                      />

                      {/* ── Decluttered Non-Overlapping Station Label ── */}
                      {shouldShowLabel && (
                        <text
                          x={st.schematic_x_position}
                          y={st.schematic_y_position + (isMajor || isSource || isTarget ? 16 : 12)}
                          fill={
                            isSource
                              ? '#60a5fa'
                              : isTarget
                              ? '#34d399'
                              : isOnHighlightedRoute
                              ? '#38bdf8'
                              : isMajor
                              ? '#ffffff'
                              : '#e2e8f0'
                          }
                          fontSize={isSource || isTarget || isMajor || isOnHighlightedRoute ? '11' : '9'}
                          fontWeight={isSource || isTarget || isMajor || isOnHighlightedRoute ? 'bold' : 'normal'}
                          textAnchor="middle"
                          className="select-none pointer-events-none"
                          style={{
                            paintOrder: 'stroke fill',
                            stroke: '#090d16',
                            strokeWidth: '3.5px',
                            strokeLinejoin: 'round',
                          }}
                        >
                          {st.code}
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Floating Zoom Controls Overlay */}
            <div className="absolute bottom-4 right-4 flex flex-col space-y-1.5 z-20 bg-slate-900/90 border border-slate-700/90 p-1.5 rounded-lg shadow-2xl backdrop-blur-md">
              <button
                onClick={() => setZoomLevel((z) => Math.min(4.5, z * 1.25))}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded transition flex items-center justify-center shadow"
                title="Zoom In (+)"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.2, z / 1.25))}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded transition flex items-center justify-center shadow"
                title="Zoom Out (-)"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={autoFitNetworkView}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-blue-400 rounded transition flex items-center justify-center shadow"
                title="Auto-Fit Network to Viewport"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Navigation Hint */}
            <div className="absolute bottom-4 left-4 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-md text-[10px] text-slate-400 font-mono flex items-center space-x-2 backdrop-blur-sm pointer-events-none">
              <Move className="w-3 h-3 text-blue-400" />
              <span>Scroll wheel to zoom · Drag map to pan · Click any station or track section to inspect</span>
            </div>
          </div>
        </div>

        {/* Side Inspection Drawer (Station & Track Section Info) */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 shadow-xl flex flex-col justify-between">
          {selectedStation ? (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-blue-400" />
                    <span className="text-xs uppercase font-bold text-blue-400">Selected Station</span>
                  </div>
                  <h3 className="text-lg font-mono font-bold text-white mt-0.5">{selectedStation.name} ({selectedStation.code})</h3>
                </div>
                <button
                  onClick={() => setSelectedStation(null)}
                  className="p-1 hover:bg-slate-700 text-slate-400 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Station Details */}
              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-700 space-y-2 font-mono">
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Zone / Region:</span>
                  <span className="text-white font-bold">{selectedStation.zone} Zone</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800">
                  <span className="text-slate-400">Classification:</span>
                  <span className="text-blue-300 font-bold">
                    {majorStationCodes.has(selectedStation.code) ? 'Major Junction Hub' : 'Standard Station Node'}
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Connected Rail Lines:</span>
                  <span className="text-emerald-400 font-bold">{stationConnectedSections.length} Sections</span>
                </div>
              </div>

              {/* Route Pathfinder Set Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
                <button
                  onClick={() => setSourceStationCode(selectedStation.code)}
                  className={`py-2 px-3 rounded-lg border font-bold transition flex items-center justify-center space-x-1.5 ${
                    sourceStationCode === selectedStation.code
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-slate-900 hover:bg-slate-700 text-blue-400 border-blue-500/40'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Set Origin</span>
                </button>

                <button
                  onClick={() => setTargetStationCode(selectedStation.code)}
                  className={`py-2 px-3 rounded-lg border font-bold transition flex items-center justify-center space-x-1.5 ${
                    targetStationCode === selectedStation.code
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-900 hover:bg-slate-700 text-emerald-400 border-emerald-500/40'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>Set Destination</span>
                </button>
              </div>

              {/* Connected Lines List */}
              <div className="space-y-2 pt-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Connected Track Sections</span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {stationConnectedSections.map((sec) => {
                    const otherSt = sec.start_station_code === selectedStation.code ? sec.end_station_code : sec.start_station_code;
                    return (
                      <div
                        key={sec.code}
                        onClick={() => setSelectedSection(sec)}
                        className="p-2 bg-slate-900 hover:bg-slate-750 border border-slate-700 rounded cursor-pointer transition flex items-center justify-between font-mono"
                      >
                        <div>
                          <div className="text-white font-bold text-xs">{sec.code}</div>
                          <div className="text-[10px] text-slate-400">To {otherSt} ({sec.length_km} KM)</div>
                        </div>
                        <span className="text-[10px] bg-slate-800 text-blue-300 px-1.5 py-0.5 rounded border border-slate-700">
                          {sec.total_tracks} Track(s)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : selectedSection ? (
            <div className="space-y-4 text-xs font-mono">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <div>
                  <span className="text-xs uppercase font-bold text-blue-400">Track Section Details</span>
                  <h3 className="text-lg font-bold text-white">{selectedSection.code}</h3>
                </div>
                <button
                  onClick={() => setSelectedSection(null)}
                  className="p-1 hover:bg-slate-700 text-slate-400 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Physical Track Breakdown */}
              <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-700 space-y-2">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block">Physical Track Status</span>
                {Array.from({ length: selectedSection.total_tracks }).map((_, idx) => {
                  const trkNum = idx + 1;
                  const trackInfo = getTrackStatus(selectedSection.code, trkNum);

                  const badgeStyle =
                    trackInfo.status === 'APPROVED_BLOCK'
                      ? 'bg-red-500/20 text-red-400 border-red-500/40'
                      : trackInfo.status === 'PROPOSED_BLOCK' || trackInfo.status === 'AT_RISK'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';

                  return (
                    <div key={trkNum} className="flex items-center justify-between bg-slate-800 p-2.5 rounded border border-slate-700">
                      <div className="flex items-center space-x-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ backgroundColor: trackInfo.color }}
                        />
                        <span className="text-slate-200 font-bold">
                          Track #{trkNum} ({trkNum === 1 ? 'UP Line' : 'DOWN Line'})
                        </span>
                      </div>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${badgeStyle}`}>
                        {trackInfo.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2 text-slate-300">
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span>Start Station:</span>
                  <span className="font-bold text-white">{selectedSection.start_station_code}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span>End Station:</span>
                  <span className="font-bold text-white">{selectedSection.end_station_code}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span>Section Distance:</span>
                  <span className="text-white">{selectedSection.length_km} KM</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span>Max Speed Limit:</span>
                  <span className="text-emerald-400 font-bold">{selectedSection.max_speed_kmh} KM/H</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-700/50">
                  <span>Section Capacity:</span>
                  <span className="text-blue-300 font-bold">{selectedSection.capacity_trains_per_hr} trains/hr</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 space-y-3">
              <MapPin className="w-8 h-8 text-slate-500 mx-auto" />
              <div className="text-xs font-medium space-y-1">
                <p className="text-slate-300 font-bold">Interactive Network Inspector</p>
                <p className="text-slate-400 text-[11px]">
                  Click any station node or track section on the map to view detailed connections, track breakdown, and route setup.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
