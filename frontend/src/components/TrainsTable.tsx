import React, { useState } from 'react';
import { TrainItem, NetworkData } from '../types';
import { TrainDetailPanel } from './TrainDetailPanel';
import { AddTrainModal } from './AddTrainModal';
import { formatTime24 } from '../utils/timeFormatter';
import { Train, Search, ChevronLeft, ChevronRight, ChevronRight as ChevronRightIcon, Plus, RotateCcw } from 'lucide-react';
import { usePersistedFilters } from '../hooks/usePersistedFilters';

interface TrainsTableProps {
  trains: TrainItem[];
  network: NetworkData | null;
  onRefreshData?: () => void;
}

interface TrainFilters {
  searchTerm: string;
  selectedStatus: string;
  selectedType: string;
}

const DEFAULT_TRAIN_FILTERS: TrainFilters = {
  searchTerm: '',
  selectedStatus: 'ALL',
  selectedType: 'ALL',
};

const PAGE_SIZE = 50;

export const TrainsTable: React.FC<TrainsTableProps> = ({ trains, network, onRefreshData }) => {
  const { filters, updateFilter, resetFilters, hasActiveFilters } = usePersistedFilters<TrainFilters>(
    'filters:trainsView',
    DEFAULT_TRAIN_FILTERS
  );
  const { searchTerm, selectedStatus, selectedType } = filters;
  const [selectedTrain, setSelectedTrain] = useState<TrainItem | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  const filteredTrains = trains.filter((t) => {
    if (selectedStatus !== 'ALL') {
      if (selectedStatus === 'rerouted' && !t.assigned_path) return false;
      if (selectedStatus !== 'rerouted' && t.current_status !== selectedStatus) return false;
    }
    if (selectedType !== 'ALL' && t.train_type !== selectedType) return false;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchName = t.train_name.toLowerCase().includes(term);
      const matchNum = t.train_number.toLowerCase().includes(term);
      const matchId = t.train_id.toLowerCase().includes(term);
      const matchOrig = t.origin_station_code.toLowerCase().includes(term);
      const matchDest = t.destination_station_code.toLowerCase().includes(term);
      if (!matchName && !matchNum && !matchId && !matchOrig && !matchDest) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredTrains.length / PAGE_SIZE) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const paginatedTrains = filteredTrains.slice(startIdx, startIdx + PAGE_SIZE);

  const getStatusBadgeClass = (status: string, isRerouted: boolean) => {
    if (isRerouted) return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
    switch (status) {
      case 'in_transit':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse';
      case 'completed':
        return 'bg-slate-700/60 text-slate-400 border-slate-600';
      case 'upcoming':
      default:
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls & Filter Bar */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center space-x-3">
          <Train className="w-5 h-5 text-blue-400 shrink-0" />
          <div>
            <h2 className="text-base font-bold text-white">Live Train Movements & Timetables</h2>
            <p className="text-xs text-slate-400">Network-wide active train inventory ({trains.length} trains seeded)</p>
          </div>
          <span className="text-xs bg-slate-700 text-slate-300 px-2.5 py-0.5 rounded-full font-mono font-semibold">
            {filteredTrains.length} matching
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-3 py-1.5 rounded-md transition shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Train</span>
          </button>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search train name/number/station..."
              value={searchTerm}
              onChange={(e) => {
                updateFilter('searchTerm', e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-md pl-8 pr-3 py-1.5 w-60 focus:outline-none focus:border-blue-500 placeholder-slate-500"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-slate-400 font-medium">Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => {
                updateFilter('selectedStatus', e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="upcoming">Upcoming</option>
              <option value="in_transit">In Transit</option>
              <option value="completed">Completed</option>
              <option value="rerouted">Rerouted Only</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-slate-400 font-medium">Type:</span>
            <select
              value={selectedType}
              onChange={(e) => {
                updateFilter('selectedType', e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Types</option>
              <option value="Express">Express</option>
              <option value="Superfast">Superfast</option>
              <option value="Passenger">Passenger</option>
              <option value="Freight">Freight</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={() => {
                resetFilters();
                setCurrentPage(1);
              }}
              className="flex items-center space-x-1 text-xs text-amber-400 hover:text-amber-300 font-semibold px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-md transition"
              title="Reset all filters to defaults"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900/90 border-b border-slate-700 text-xs font-bold uppercase tracking-wider text-slate-400">
                <th className="py-3.5 px-4">Train ID</th>
                <th className="py-3.5 px-4">Name / Number</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Origin → Destination</th>
                <th className="py-3.5 px-4">Departure (24h)</th>
                <th className="py-3.5 px-4">Arrival (24h)</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Current Section</th>
                <th className="py-3.5 px-4 text-right font-mono">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 text-xs">
              {paginatedTrains.length > 0 ? (
                paginatedTrains.map((t) => {
                  const isRerouted = !!(t.assigned_path && t.assigned_path.length > 0);
                  return (
                    <tr
                      key={t.train_id}
                      onClick={() => setSelectedTrain(t)}
                      className="hover:bg-slate-700/40 transition cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-200">{t.train_id}</td>
                      <td className="py-3 px-4 font-medium text-slate-200">
                        <div>{t.train_name}</div>
                        <div className="text-[11px] font-mono text-slate-400">#{t.train_number}</div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-900 text-slate-300 rounded border border-slate-700 font-mono text-[11px]">
                          {t.train_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-emerald-400 font-bold">Prio #{t.priority_class}</td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {t.origin_station_code} → {t.destination_station_code}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-200">{formatTime24(t.scheduled_departure_time)}</td>
                      <td className="py-3 px-4 font-mono text-slate-200">{formatTime24(t.scheduled_arrival_time)}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-md border ${getStatusBadgeClass(t.current_status, isRerouted)}`}>
                          {isRerouted ? 'REROUTED' : t.current_status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-blue-300 font-semibold">
                        {t.current_section_code || <span className="text-slate-500 font-normal italic">--</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button className="text-blue-400 hover:text-blue-300 transition p-1">
                          <ChevronRightIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500 font-medium">
                    No trains found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="bg-slate-900/90 border-t border-slate-700/80 px-4 py-3 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono">
            Showing <span className="text-slate-200 font-bold">{filteredTrains.length > 0 ? startIdx + 1 : 0}</span> to{' '}
            <span className="text-slate-200 font-bold">{Math.min(startIdx + PAGE_SIZE, filteredTrains.length)}</span> of{' '}
            <span className="text-slate-200 font-bold">{filteredTrains.length}</span> trains
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700 transition"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-300 font-mono font-semibold px-2">
              Page {safePage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 rounded border border-slate-700 transition"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Train Detail Panel Modal */}
      <TrainDetailPanel train={selectedTrain} network={network} onClose={() => setSelectedTrain(null)} />

      {/* Add Train Modal */}
      <AddTrainModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onTrainAdded={() => {
          if (onRefreshData) onRefreshData();
        }}
      />
    </div>
  );
};

