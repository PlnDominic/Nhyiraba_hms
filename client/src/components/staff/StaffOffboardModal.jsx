import React, { useState } from 'react';
import { FaTimes, FaUserSlash } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';
import { LEAVING_REASONS, validateOffboarding } from '../../utils/staffLifecycle';

const today = () => new Date().toISOString().slice(0, 10);

const StaffOffboardModal = ({ staff, onClose, onConfirm }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const [endDate, setEndDate] = useState(today());
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [disableLogin, setDisableLogin] = useState(true);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const inputClass = isDarkMode
    ? 'border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:border-blue-500'
    : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  const labelClass = isDarkMode ? 'text-gray-300' : 'text-gray-700';
  const errorClass = 'mt-1 text-sm text-red-500';

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = validateOffboarding({ endDate, reason, hireDate: staff.hire_date });
    setErrors(result.errors);
    if (!result.valid) return;

    setSaving(true);
    await onConfirm({ endDate, reason, notes, disableLogin });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className={`relative w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex justify-between items-start p-6 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <div>
            <h2 className={`text-2xl font-bold flex items-center ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
              <FaUserSlash className="mr-3 text-red-500" />
              Record departure
            </h2>
            <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {staff.first_name} {staff.last_name} · {staff.position}, {staff.department}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`p-2 rounded-full ${isDarkMode ? 'text-gray-400 hover:bg-gray-800' : 'text-gray-500 hover:bg-gray-100'}`}
            aria-label="Close"
          >
            <FaTimes />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className={`block mb-2 font-medium ${labelClass}`}>Last working day *</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={`w-full p-3 border rounded-xl focus:outline-none ${inputClass}`}
            />
            {errors.endDate && <p className={errorClass}>{errors.endDate}</p>}
          </div>

          <div>
            <label className={`block mb-2 font-medium ${labelClass}`}>Reason for leaving *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={`w-full p-3 border rounded-xl focus:outline-none cursor-pointer ${inputClass}`}
            >
              <option value="">Select a reason</option>
              {LEAVING_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {errors.reason && <p className={errorClass}>{errors.reason}</p>}
          </div>

          <div>
            <label className={`block mb-2 font-medium ${labelClass}`}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows="3"
              className={`w-full p-3 border rounded-xl focus:outline-none resize-none ${inputClass}`}
              placeholder="Handover, exit interview, anything the next manager should know"
            />
          </div>

          <label className={`flex items-start space-x-3 p-4 rounded-xl border cursor-pointer ${isDarkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}`}>
            <input
              type="checkbox"
              checked={disableLogin}
              onChange={(e) => setDisableLogin(e.target.checked)}
              className="mt-1 h-4 w-4"
            />
            <span className={`text-sm ${labelClass}`}>
              <span className="font-medium">Switch off their system login now</span>
              <span className={`block mt-0.5 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                They are signed out and cannot sign in again unless an administrator reinstates them.
                Untick this only if they work out a notice period and the login should stay on until then.
              </span>
            </span>
          </label>

          <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Their attendance and schedule history is kept. Shifts after the last working day are cancelled.
          </p>

          <div className={`flex justify-end space-x-3 pt-4 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={`px-6 py-2.5 border rounded-xl font-medium ${isDarkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-700 hover:bg-gray-100'}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Record departure'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StaffOffboardModal;
