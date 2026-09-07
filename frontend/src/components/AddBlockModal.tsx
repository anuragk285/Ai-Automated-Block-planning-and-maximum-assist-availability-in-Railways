import React, { useState } from 'react';
import axios from 'axios';
import { X, ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AddBlockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBlockAdded: () => void;
}

export const AddBlockModal: React.FC<AddBlockModalProps> = ({ isOpen, onClose, onBlockAdded }) => {
  const [sectionId, setSectionId] = useState('');
  const [blockGroupId, setBlockGroupId] = useState('');
  const [trackNumber, setTrackNumber] = useState(1);
  const [startTime, setStartTime] = useState('21:00');
  const [duration, setDuration] = useState('01:00');
  const [status, setStatus] = useState('Proposed');
  const [trafficSensitivity, setTrafficSensitivity] = useState('High');
  const [fromStation, setFromStation] = useState('NDLS');
  const [toStation, setToStation] = useState('BPL');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!sectionId.trim() || !blockGroupId.trim() || !startTime.trim() || !duration.trim() || !fromStation.trim() || !toStation.trim()) {
      setErrorMsg('Please fill in all required (NOT NULL) fields before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        section_id: sectionId.trim(),
        block_group_id: blockGroupId.trim(),
        track_number: Number(trackNumber),
        start_time: startTime.trim(),
        duration: duration.trim(),
        status: status,
        traffic_sensitivity: trafficSensitivity,
        from_station_code: fromStation.trim().toUpperCase(),
        to_station_code: toStation.trim().toUpperCase(),
      };

      const resp = await axios.post('/api/block-sections', payload);
      setSuccessMsg(`Block Section '${resp.data?.block_section?.section_id || sectionId}' persisted into DB!`);
      setTimeout(() => {
        onBlockAdded();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Insert block section error:', err);
      const detail = err.response?.data?.detail || err.message || 'Failed to insert block section into database.';
      setErrorMsg(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-800/90 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Add New Block Section Record</h3>
              <p className="text-xs text-slate-400">Persist maintenance block section into block_sections table</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start space-x-2.5 text-xs text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Insert Failed: </span>
                {errorMsg}
              </div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center space-x-2.5 text-xs text-emerald-400">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Section ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. SEC_STNNDLS_STNBPL"
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Block Group ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. BLK-GRP_SEC_STNNDLS_STNBPL_14"
                value={blockGroupId}
                onChange={(e) => setBlockGroupId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                From Station <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. NDLS"
                value={fromStation}
                onChange={(e) => setFromStation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                To Station <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. BPL"
                value={toStation}
                onChange={(e) => setToStation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Track Number</label>
              <input
                type="number"
                min={1}
                max={4}
                value={trackNumber}
                onChange={(e) => setTrackNumber(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Start Time (24h) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="21:00"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Duration (HH:MM) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="01:00"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="Proposed">Proposed</option>
                <option value="Approved">Approved</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Traffic Sensitivity</label>
              <select
                value={trafficSensitivity}
                onChange={(e) => setTrafficSensitivity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition flex items-center space-x-2 shadow-lg shadow-amber-500/20"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Block Section to DB</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
