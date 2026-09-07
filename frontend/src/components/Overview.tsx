import React from 'react';
import { MaintenanceRequest, BlockPlanItem, NetworkData } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { Cpu, ShieldAlert, Zap, CheckCircle2, AlertTriangle, ArrowRight, Layers } from 'lucide-react';

interface OverviewProps {
  requests: MaintenanceRequest[];
  blocks: BlockPlanItem[];
  network: NetworkData | null;
  onNavigateToTab: (tab: string) => void;
  onRunOptimization: () => void;
}

export const Overview: React.FC<OverviewProps> = ({
  requests,
  blocks,
  network,
  onNavigateToTab,
  onRunOptimization,
}) => {
  const criticalCount = requests.filter((r) => r.priority_bucket === 'Critical').length;
  const highCount = requests.filter((r) => r.priority_bucket === 'High').length;
  const medCount = requests.filter((r) => r.priority_bucket === 'Medium').length;
  const lowCount = requests.filter((r) => r.priority_bucket === 'Low').length;

  const priorityPieData = [
    { name: 'Critical', value: criticalCount, color: '#ef4444' },
    { name: 'High', value: highCount, color: '#f59e0b' },
    { name: 'Medium', value: medCount, color: '#3b82f6' },
    { name: 'Low', value: lowCount, color: '#10b981' },
  ];

  const deptCounts = [
    { name: 'Engineering (ENG)', count: requests.filter((r) => r.department === 'ENG').length, fill: '#3b82f6' },
    { name: 'Traction (TRAC)', count: requests.filter((r) => r.department === 'TRAC').length, fill: '#8b5cf6' },
    { name: 'Signals & Telecom (ST)', count: requests.filter((r) => r.department === 'ST').length, fill: '#10b981' },
  ];

  const approvedCount = blocks.filter((b) => b.status === 'Approved').length;
  const proposedCount = blocks.filter((b) => b.status === 'Proposed').length;

  return (
    <div className="space-y-6">
      {/* Top Banner & System Operating Principle */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 rounded-xl p-6 shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs uppercase tracking-widest font-semibold text-blue-400">Core Operating Principle</span>
              <h2 className="text-xl font-bold text-white tracking-wide">
                “Combine compatible maintenance into fewer, safer, better-timed blocks”
              </h2>
            </div>
            <button
              onClick={onRunOptimization}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm rounded-lg shadow-lg shadow-blue-500/20 transition flex items-center space-x-2"
            >
              <Zap className="w-4 h-4" />
              <span>Run CP-SAT Optimizer</span>
            </button>
          </div>

          {/* 4-Step Pipeline Visual Flow */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-900/80 border border-blue-900/50 p-4 rounded-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-400">STEP 1</span>
                <Cpu className="w-5 h-5 text-blue-400" />
              </div>
              <div className="mt-2">
                <h4 className="font-bold text-sm text-slate-100">AI PREDICTS</h4>
                <p className="text-xs text-slate-400 mt-1">XGBoost asset failure risk score & train traffic disruption</p>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-amber-900/50 p-4 rounded-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">STEP 2</span>
                <ShieldAlert className="w-5 h-5 text-amber-400" />
              </div>
              <div className="mt-2">
                <h4 className="font-bold text-sm text-slate-100">RULES PROTECT</h4>
                <p className="text-xs text-slate-400 mt-1">Deterministic Safety Engine checks crew skills, equipment & weather</p>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-indigo-900/50 p-4 rounded-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-400">STEP 3</span>
                <Zap className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="mt-2">
                <h4 className="font-bold text-sm text-slate-100">OPTIMIZER SELECTS</h4>
                <p className="text-xs text-slate-400 mt-1">Google OR-Tools CP-SAT solves non-overlapping feasible schedule</p>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-emerald-900/50 p-4 rounded-lg flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400">STEP 4</span>
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="mt-2">
                <h4 className="font-bold text-sm text-slate-100">PLANNER APPROVES</h4>
                <p className="text-xs text-slate-400 mt-1">Human railway controller reviews & approves block plan</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Maintenance Requests</span>
            <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded">ENG / TRAC / ST</span>
          </div>
          <p className="text-3xl font-black text-white mt-2">{requests.length}</p>
          <p className="text-xs text-slate-400 mt-1">Active requests in queue</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Multi-Dept Merged Blocks</span>
            <span className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded"><Layers className="w-4 h-4" /></span>
          </div>
          <p className="text-3xl font-black text-indigo-400 mt-2">
            {blocks.filter((b) => b.request_ids.length > 1).length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Saved track possession windows</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Critical Priority Tasks</span>
            <span className="p-1.5 bg-red-500/10 text-red-400 rounded"><AlertTriangle className="w-4 h-4" /></span>
          </div>
          <p className="text-3xl font-black text-red-400 mt-2">{criticalCount}</p>
          <p className="text-xs text-slate-400 mt-1">Requires immediate window</p>
        </div>

        <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Approved Block Plans</span>
            <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded"><CheckCircle2 className="w-4 h-4" /></span>
          </div>
          <p className="text-3xl font-black text-emerald-400 mt-2">{approvedCount} / {blocks.length}</p>
          <p className="text-xs text-slate-400 mt-1">{proposedCount} proposed pending review</p>
        </div>
      </div>

      {/* Demo Multi-Department Merge Highlight Card */}
      <div className="bg-gradient-to-r from-blue-950/60 to-slate-900 border border-blue-800/50 rounded-xl p-5 shadow-xl">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-lg mt-0.5">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400">Featured Demo Scenario Highlight</span>
              <h3 className="text-base font-bold text-white mt-0.5">
                Multi-Department Block Bundling on Section <span className="text-blue-300 font-mono">SEC_GZB_ALJN</span>
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-3xl">
                Instead of shutting down the Ghaziabad–Aligarh line 3 separate times (ENG track tamping 3.0h, TRAC catenary wire alignment 2.5h, ST axle counter test 2.0h = 7.5h total closure), our work-grouping engine bundled all 3 activities into a single <span className="text-blue-300 font-semibold">3.5-hour shared night block</span>.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateToTab('plan')}
            className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 text-xs font-semibold rounded border border-blue-500/40 transition flex items-center space-x-1"
          >
            <span>View Block Plan</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Priority Breakdown Chart */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center justify-between">
            <span>Maintenance Priority Distribution</span>
            <span className="text-xs text-slate-400 font-normal">Weighted ML + Urgency</span>
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={priorityPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  paddingAngle={5}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {priorityPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '8px', color: '#fff' }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Requests Breakdown */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-5 shadow-xl">
          <h3 className="text-sm font-bold text-slate-200 mb-4 flex items-center justify-between">
            <span>Departmental Work Volume</span>
            <span className="text-xs text-slate-400 font-normal">ENG / TRAC / ST</span>
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={deptCounts} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', borderColor: '#475569', borderRadius: '8px', color: '#fff' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {deptCounts.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
