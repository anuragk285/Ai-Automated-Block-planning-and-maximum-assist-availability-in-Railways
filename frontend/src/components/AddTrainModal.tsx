import React, { useState } from 'react';
import axios from 'axios';
import { X, Train, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AddTrainModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTrainAdded: () => void;
}

export const AddTrainModal: React.FC<AddTrainModalProps> = ({ isOpen, onClose, onTrainAdded }) => {
  const [trainId, setTrainId] = useState('');
  const [trainNumber, setTrainNumber] = useState('');
  const [trainName, setTrainName] = useState('');
  const [trainType, setTrainType] = useState('Vande Bharat');
  const [priorityClass, setPriorityClass] = useState(1);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [pathStations, setPathStations] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    // Front-end validation for NOT NULL fields
    if (!trainId.trim() || !trainNumber.trim() || !trainName.trim() || !origin.trim() || !destination.trim() || !departureTime.trim() || !arrivalTime.trim()) {
      setErrorMsg('Please fill in all required (NOT NULL) fields before submitting.');
      return;
    }

    const stationList = pathStations
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    if (stationList.length === 0) {
      stationList.push(origin.trim().toUpperCase(), destination.trim().toUpperCase());
    }

    setIsSubmitting(true);
    try {
      const payload = {
        train_id: trainId.trim(),
        train_number: trainNumber.trim(),
        train_name: trainName.trim(),
        train_type: trainType,
        priority_class: Number(priorityClass),
        origin_station_code: origin.trim().toUpperCase(),
        destination_station_code: destination.trim().toUpperCase(),
        scheduled_departure_time: departureTime.trim(),
        scheduled_arrival_time: arrivalTime.trim(),
        current_status: 'Scheduled',
        current_section_code: origin.trim().toUpperCase(),
        original_path_json: stationList,
        assigned_path_json: stationList,
      };

      const resp = await axios.post('/api/trains', payload);
      setSuccessMsg(`Train '${resp.data?.train?.train_id || trainId}' persisted into database successfully!`);
      setTimeout(() => {
        onTrainAdded();
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Insert train error:', err);
      const detail = err.response?.data?.detail || err.message || 'Failed to insert train into database.';
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
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg">
              <Train className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Add New Train Record</h3>
              <p className="text-xs text-slate-400">Persist train timetable & route sequence into DB</p>
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
                Train ID <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. TRN_ADI_NGP_001"
                value={trainId}
                onChange={(e) => setTrainId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Train Number <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 20820"
                value={trainNumber}
                onChange={(e) => setTrainNumber(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Train Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Vande Bharat Special"
                value={trainName}
                onChange={(e) => setTrainName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Type</label>
              <select
                value={trainType}
                onChange={(e) => setTrainType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="Vande Bharat">Vande Bharat</option>
                <option value="Express">Express</option>
                <option value="Superfast">Superfast</option>
                <option value="Passenger">Passenger</option>
                <option value="Freight">Freight</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Priority Class</label>
              <select
                value={priorityClass}
                onChange={(e) => setPriorityClass(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
              >
                <option value={1}>1 (High Priority)</option>
                <option value={2}>2 (Medium)</option>
                <option value={3}>3 (Low)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Origin Station <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. ADI"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Destination Station <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. NGP"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white uppercase placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Scheduled Departure (HH:MM) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="20:03"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Scheduled Arrival (HH:MM) <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="23:16"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Ordered Route Stations (comma separated)
            </label>
            <input
              type="text"
              placeholder="e.g. ADI, BRC, ST, NDB, BSL, AK, WR, NGP"
              value={pathStations}
              onChange={(e) => setPathStations(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Ordered sequence of stations passed along route. Used for dynamic block-impact calculation.
            </p>
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
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition flex items-center space-x-2 shadow-lg shadow-blue-500/20"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Train to Database</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
