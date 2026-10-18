import React, { useState, useEffect } from 'react';
import { FaTimes, FaUser, FaIdCard, FaEnvelope, FaPhone, FaBuilding, FaUserTie, FaMapMarkerAlt, FaExclamationTriangle } from 'react-icons/fa';
import { useTheme } from '../../context/ThemeContext';

const StaffModal = ({ isOpen, onClose, onSave, staff, viewMode = false }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    position: '',
    department: '',
    hire_date: '',
    status: 'Active',
    emergency_contact: '',
    emergency_phone: '',
    address: '',
    hourly_rate: '',
    weekly_hours: 40
  });

  useEffect(() => {
    if (staff) {
      setFormData({
        first_name: staff.first_name || '',
        last_name: staff.last_name || '',
        email: staff.email || '',
        phone: staff.phone || '',
        position: staff.position || '',
        department: staff.department || '',
        hire_date: staff.hire_date || '',
        status: staff.status || 'Active',
        emergency_contact: staff.emergency_contact || '',
        emergency_phone: staff.emergency_phone || '',
        address: staff.address || '',
        hourly_rate: staff.hourly_rate || '',
        weekly_hours: staff.weekly_hours || 40
      });
    } else {
      // Reset form when adding new staff
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        position: '',
        department: '',
        hire_date: '',
        status: 'Active',
        emergency_contact: '',
        emergency_phone: '',
        address: '',
        hourly_rate: '',
        weekly_hours: 40
      });
    }
  }, [staff, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  if (!isOpen) return null;

  const inputClass = isDarkMode
    ? `border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:border-blue-500 focus:bg-gray-600 ${viewMode ? 'cursor-not-allowed opacity-75' : ''}`
    : `border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${viewMode ? 'cursor-not-allowed opacity-75' : ''}`;

  const labelClass = isDarkMode ? 'text-gray-300' : 'text-gray-700';
  const iconClass = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fadeIn" onClick={onClose}>
      <div className="relative w-full max-w-4xl animate-scaleIn" onClick={(e) => e.stopPropagation()}>
        {/* Animated background gradient effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 via-purple-500/30 to-pink-500/30 rounded-3xl blur-2xl animate-pulse"></div>

        <div className={`relative ${isDarkMode ? 'bg-gray-900/95' : 'bg-white'} backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden ${isDarkMode ? 'border border-gray-700/50' : 'border border-gray-200'}`}>
          {/* Header - Enhanced */}
          <div className={`relative overflow-hidden p-6 border-b ${isDarkMode ? 'bg-gradient-to-r from-gray-800 to-gray-900 border-gray-700' : 'bg-gradient-to-r from-blue-50 to-purple-50 border-gray-200'}`}>
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10"></div>
            <div className="relative flex justify-between items-center">
              <div>
                <h2 className={`text-3xl font-bold ${isDarkMode ? 'bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent' : 'text-gray-800'}`}>
                  {viewMode ? 'Staff Member Details' : staff ? 'Edit Staff Member' : 'Add New Staff Member'}
                </h2>
                <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {viewMode ? 'View staff member information' : staff ? 'Update staff member information' : 'Fill in the details to add a new staff member'}
                </p>
              </div>
              <button
                onClick={onClose}
                className={`${isDarkMode ? 'text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200'} transition-all duration-300 p-3 rounded-full hover:scale-110 hover:rotate-90`}
              >
                <FaTimes size={20} />
              </button>
            </div>
          </div>

          {/* Form section with smooth scrolling - Enhanced */}
          <div className={`p-8 overflow-y-auto max-h-[70vh] ${isDarkMode ? 'scrollbar-dark' : 'scrollbar-light'}`} style={{
            scrollbarWidth: 'thin',
            scrollbarColor: isDarkMode ? '#4B5563 #1F2937' : '#CBD5E1 #F3F4F6'
          }}>
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* Personal Information Section */}
              <div className={`p-6 rounded-2xl ${isDarkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-blue-50/50 border border-blue-100'}`}>
                <h3 className={`text-lg font-semibold mb-5 flex items-center ${isDarkMode ? 'text-blue-400' : 'text-blue-700'}`}>
                  <FaUser className="mr-2" />
                  Personal Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={`block mb-2 font-medium ${labelClass}`}>First Name *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaUser className={iconClass} />
                      </div>
                      <input
                        type="text"
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleChange}
                        required={!viewMode}
                        readOnly={viewMode}
                        className={`pl-10 w-full p-3.5 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none`}
                        placeholder="Enter first name"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block mb-2 font-medium ${labelClass}`}>Last Name *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaUser className={iconClass} />
                      </div>
                      <input
                        type="text"
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleChange}
                        required={!viewMode}
                        readOnly={viewMode}
                        className={`pl-10 w-full p-3.5 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none`}
                        placeholder="Enter last name"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className={`p-6 rounded-2xl ${isDarkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-purple-50/50 border border-purple-100'}`}>
                <h3 className={`text-lg font-semibold mb-5 flex items-center ${isDarkMode ? 'text-purple-400' : 'text-purple-700'}`}>
                  <FaEnvelope className="mr-2" />
                  Contact Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={`block mb-2 font-medium ${labelClass}`}>Email *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaEnvelope className={iconClass} />
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required={!viewMode}
                        readOnly={viewMode}
                        className={`pl-10 w-full p-3.5 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none`}
                        placeholder="email@example.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block mb-2 font-medium ${labelClass}`}>Phone *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaPhone className={iconClass} />
                      </div>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required={!viewMode}
                        readOnly={viewMode}
                        className={`pl-10 w-full p-3.5 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none`}
                        placeholder="+1 (555) 000-0000"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <label className={`block mb-2 font-medium ${labelClass}`}>Address</label>
                  <div className="relative">
                    <div className="absolute top-3.5 left-3 pointer-events-none">
                      <FaMapMarkerAlt className={iconClass} />
                    </div>
                    <textarea
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      readOnly={viewMode}
                      className={`pl-10 w-full p-3.5 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none resize-none`}
                      placeholder="Enter full address"
                      rows="2"
                    ></textarea>
                  </div>
                </div>
              </div>

              {/* Employment Information Section */}
              <div className={`p-6 rounded-2xl ${isDarkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-green-50/50 border border-green-100'}`}>
                <h3 className={`text-lg font-semibold mb-5 flex items-center ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>
                  <FaUserTie className="mr-2" />
                  Employment Information
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={`block mb-2 font-medium ${labelClass}`}>Position *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaUserTie className={iconClass} />
                      </div>
                      <input
                        type="text"
                        name="position"
                        value={formData.position}
                        onChange={handleChange}
                        required={!viewMode}
                        readOnly={viewMode}
                        className={`pl-10 w-full p-3.5 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none`}
                        placeholder="e.g., Front Desk Manager"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={`block mb-2 font-medium ${labelClass}`}>Department *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaBuilding className={iconClass} />
                      </div>
                      <select
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                        required={!viewMode}
                        disabled={viewMode}
                        className={`pl-10 w-full p-3.5 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none cursor-pointer`}
                      >
                        <option value="">Select Department</option>
                        <option value="Front Desk">Front Desk</option>
                        <option value="Housekeeping">Housekeeping</option>
                        <option value="Food & Beverage">Food & Beverage</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Management">Management</option>
                        <option value="Security">Security</option>
                        <option value="HR">Human Resources</option>
                        <option value="Supermarket">Supermarket</option>
                        <option value="IT">IT</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>



                  <div>
                    <label className={`block mb-2 font-medium ${labelClass}`}>Hire Date</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FaIdCard className={iconClass} />
                      </div>
                      <input
                        type="date"
                        name="hire_date"
                        value={formData.hire_date}
                        onChange={handleChange}
                        readOnly={viewMode}
                        className={`pl-10 w-full p-3.5 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none`}
                      />
                    </div>
                  </div>



                  <div>
                    <label className={`block mb-2 font-medium ${labelClass}`}>Status</label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      disabled={viewMode || formData.status === 'Left'}
                      className={`w-full p-3.5 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none cursor-pointer`}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="On Leave">On Leave</option>
                      <option value="Terminated">Terminated</option>
                      {formData.status === 'Left' && <option value="Left">Left</option>}
                    </select>
                    {formData.status === 'Left' && (
                      <p className={`mt-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        This person has left. An administrator can reinstate them from Former staff.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Emergency Contact Section */}
              <div className={`p-6 rounded-2xl ${isDarkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-red-50/50 border border-red-100'}`}>
                <h3 className={`text-lg font-semibold mb-5 flex items-center ${isDarkMode ? 'text-red-400' : 'text-red-700'}`}>
                  <FaExclamationTriangle className="mr-2" />
                  Emergency Contact
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className={`block mb-2 font-medium ${labelClass}`}>Contact Name</label>
                    <input
                      type="text"
                      name="emergency_contact"
                      value={formData.emergency_contact}
                      onChange={handleChange}
                      readOnly={viewMode}
                      className={`w-full p-3.5 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none`}
                      placeholder="Emergency contact name"
                    />
                  </div>

                  <div>
                    <label className={`block mb-2 font-medium ${labelClass}`}>Contact Phone</label>
                    <input
                      type="tel"
                      name="emergency_phone"
                      value={formData.emergency_phone}
                      onChange={handleChange}
                      readOnly={viewMode}
                      className={`w-full p-3.5 border rounded-xl transition-all duration-200 ${inputClass} focus:outline-none`}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>
              </div>

              {/* Form actions */}
              <div className={`flex justify-end space-x-4 pt-6 border-t ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-8 py-3 border rounded-xl font-medium transition-all duration-300 hover:scale-105 ${isDarkMode
                    ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                >
                  {viewMode ? 'Close' : 'Cancel'}
                </button>
                {!viewMode && (
                  <button
                    type="submit"
                    className="px-8 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl transition-all duration-300 hover:scale-105 shadow-lg hover:shadow-xl hover:shadow-blue-500/25"
                  >
                    {staff ? 'Update Staff' : 'Add Staff Member'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-scaleIn {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default StaffModal;
