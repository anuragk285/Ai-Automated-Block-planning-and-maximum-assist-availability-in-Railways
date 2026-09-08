import React, { useState } from 'react';
import { MaintenanceRequest } from '../types';
import { Filter, AlertTriangle, ShieldCheck, Clock, Wrench, ChevronDown, ChevronUp, Search, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { usePersistedFilters } from '../hooks/usePersistedFilters';

interface RequestsTableProps {
  requests: MaintenanceRequest[];
}

interface MaintenanceRequestFilters {
  searchTerm: string;
  selectedDept: string;
  selectedPrio: string;
}

const DEFAULT_REQUEST_FILTERS: MaintenanceRequestFilters = {
  searchTerm: '',
  selectedDept: 'ALL',
  selectedPrio: 'ALL',
};

const PAGE_SIZE = 30;

export const RequestsTable: React.FC<RequestsTableProps> = ({ requests }) => {
  const { filters, updateFilter, resetFilters, hasActiveFilters } = usePersistedFilters<MaintenanceRequestFilters>(
    'filters:maintenanceRequests',
    DEFAULT_REQUEST_FILTERS
  );
  const { searchTerm, selectedDept, selectedPrio } = filters;
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const filteredRequests = requests.filter((r) => {
    if (selectedDept !== 'ALL' && r.department !== selectedDept) return false;
    if (selectedPrio !== 'ALL' && r.priority_bucket !== selectedPrio) return false;
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const matchId = r.request_id.toLowerCase().includes(term);
      const matchSec = r.section_code.toLowerCase().includes(term);
      const matchDef = r.defect_type.toLowerCase().includes(term);
      if (!matchId && !matchSec && !matchDef) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredRequests.length / PAGE_SIZE) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIdx = (safePage - 1) * PAGE_SIZE;
  const paginatedRequests = filteredRequests.slice(startIdx, startIdx + PAGE_SIZE);

  const getPriorityBadgeClass = (bucket?: string) => {
    switch (bucket) {
      case 'Critical':
        return 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse';
      case 'High':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      case 'Medium':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/40';
      case 'Low':
      default:
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
    }
  };

  const getDeptBadgeClass = (dept: string) => {
    switch (dept) {
      case 'ENG':
        return 'bg-blue-900/60 text-blue-300 border-blue-700/50';
      case 'TRAC':
        return 'bg-purple-900/60 text-purple-300 border-purple-700/50';
      case 'ST':
        return 'bg-emerald-900/60 text-emerald-300 border-emerald-700/50';
      default:
        return 'bg-slate-800 text-slate-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls & Filter Bar */}
      <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center space-x-2">
          <Wrench className="w-5 h-5 text-blue-400 shrink-0" />
          <div>
            <h2 className="text-base font-bold text-white">Department Maintenance Requests</h2>
            <p className="text-xs text-slate-400">Total requests logged: {requests.length}</p>
          </div>
          <span className="text-xs bg-slate-700 text-slate-300 px-2.5 py-0.5 rounded-full font-mono font-semibold">
            {filteredRequests.length} matching
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search ID, section, defect..."
              value={searchTerm}
              onChange={(e) => {
                updateFilter('searchTerm', e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-700 text-xs text-slate-200 rounded-md pl-8 pr-3 py-1.5 w-56 focus:outline-none focus:border-blue-500 placeholder-slate-500"
            />
          </div>

          {/* Dept Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-slate-400 font-medium">Department:</span>
            <select
              value={selectedDept}
              onChange={(e) => {
                updateFilter('selectedDept', e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Departments</option>
              <option value="ENG">Engineering (ENG)</option>
              <option value="TRAC">Traction (TRAC)</option>
              <option value="ST">Signals & Telecom (ST)</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-slate-400 font-medium">Priority:</span>
            <select
              value={selectedPrio}
              onChange={(e) => {
                updateFilter('selectedPrio', e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
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
                <th className="py-3.5 px-4">Req ID</th>
                <th className="py-3.5 px-4">Dept</th>
                <th className="py-3.5 px-4">Section & Track</th>
                <th className="py-3.5 px-4">Defect Description</th>
                <th className="py-3.5 px-4 text-center">Req. Duration</th>
                <th className="py-3.5 px-4 text-center">Urgency</th>
                <th className="py-3.5 px-4 text-center">Due in</th>
                <th className="py-3.5 px-4 text-center">Composite Score</th>
                <th className="py-3.5 px-4 text-center">Priority Bucket</th>
                <th className="py-3.5 px-4 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/60 text-xs">
              {paginatedRequests.length > 0 ? (
                paginatedRequests.map((r) => {
                  const isExpanded = expandedRow === r.request_id;
                  const score = r.calculated_priority_score ?? 0;
                  return (
                    <React.Fragment key={r.request_id}>
                      <tr
                        onClick={() => setExpandedRow(isExpanded ? null : r.request_id)}
                        className={`hover:bg-slate-700/40 transition cursor-pointer ${isExpanded ? 'bg-slate-700/30' : ''}`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-200">{r.request_id}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 text-[11px] font-bold rounded border ${getDeptBadgeClass(r.department)}`}>
                            {r.department}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-300">
                          <div className="font-semibold text-blue-300">{r.section_code}</div>
                          <div className="text-[10px] text-slate-400">Track #{r.target_track_number} @ Km {r.location_km}</div>
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-200 max-w-xs truncate">{r.defect_type}</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-300">{r.requested_duration_hours} hrs</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-amber-400">{r.declared_urgency} / 5</td>
                        <td className="py-3 px-4 text-center font-mono text-slate-300">{r.due_date_days} days</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-blue-400 text-sm">
                          {score.toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-1 text-[11px] font-extrabold rounded-md border ${getPriorityBadgeClass(r.priority_bucket)}`}>
                            {r.priority_bucket || 'Medium'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button className="text-slate-400 hover:text-white transition">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded details */}
                      {isExpanded && (
                        <tr className="bg-slate-900/80">
                          <td colSpan={10} className="p-4 border-b border-slate-700/80">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                                <div className="text-slate-400 font-bold mb-1">Required Skills:</div>
                                <div className="flex flex-wrap gap-1">
                                  {r.required_skills?.map((sk, idx) => (
                                    <span key={idx} className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-[11px]">
                                      {sk}
                                    </span>
                                  )) || <span className="text-slate-500">None</span>}
                                </div>
                              </div>

                              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                                <div className="text-slate-400 font-bold mb-1">Required Equipment:</div>
                                <div className="flex flex-wrap gap-1">
                                  {r.required_equipment?.map((eq, idx) => (
                                    <span key={idx} className="bg-slate-700 text-slate-200 px-2 py-0.5 rounded text-[11px]">
                                      {eq}
                                    </span>
                                  )) || <span className="text-slate-500">None</span>}
                                </div>
                              </div>

                              <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
                                <div className="text-slate-400 font-bold mb-1">Prerequisite Dependencies:</div>
                                <div className="flex flex-wrap gap-1">
                                  {r.dependencies?.length ? (
                                    r.dependencies.map((dep, idx) => (
                                      <span key={idx} className="bg-amber-900/60 text-amber-300 border border-amber-700/50 px-2 py-0.5 rounded text-[11px]">
                                        {dep}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-slate-500">No prerequisites</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500 font-medium">
                    No maintenance requests found matching filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="bg-slate-900/90 border-t border-slate-700/80 px-4 py-3 flex items-center justify-between">
          <div className="text-xs text-slate-400 font-mono">
            Showing <span className="text-slate-200 font-bold">{filteredRequests.length > 0 ? startIdx + 1 : 0}</span> to{' '}
            <span className="text-slate-200 font-bold">{Math.min(startIdx + PAGE_SIZE, filteredRequests.length)}</span> of{' '}
            <span className="text-slate-200 font-bold">{filteredRequests.length}</span> requests
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
    </div>
  );
};
