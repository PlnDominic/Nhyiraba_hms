import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { useTheme } from '../context/ThemeContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useRoomReservation } from '../context/RoomReservationContext';
import { datePickerConfig } from '../utils/dateUtils';
import '../styles/FuturisticDatepicker.css';
import { FaUser, FaPhone, FaChild, FaCalendarAlt, FaHotel, FaClipboardCheck, FaCreditCard, FaMoneyBillWave, FaTimes, FaChevronRight, FaChevronLeft, FaBed } from 'react-icons/fa';

const NewReservationModal = ({ isOpen, onRequestClose, onAddReservation }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const { createReservation, rooms, refreshData } = useRoomReservation();

  useEffect(() => {
    if (typeof document !== 'undefined') {
      Modal.setAppElement('body');
    }
  }, []);

  // Initial form state
  const [formData, setFormData] = useState({
    guestName: '',
    phoneNumber: '',
    roomNumber: '',
    checkInDate: new Date(),
    checkOutDate: new Date(new Date().setDate(new Date().getDate() + 1)),
    adults: 1,
    children: 0,
    specialRequests: '',
    paymentMethod: 'Credit Card'
  });

  // Error state
  const [errors, setErrors] = useState({});
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Handle date changes
  const handleDateChange = (name, date) => {
    setFormData(prev => ({
      ...prev,
      [name]: date
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Form validation
  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      // Guest information validation
      if (!formData.guestName.trim()) newErrors.guestName = 'Guest name is required';
      if (!formData.phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required';
    } else if (step === 2) {
      if (!formData.roomNumber) newErrors.roomNumber = 'Please select a room';
      if (!formData.checkInDate) newErrors.checkInDate = 'Check-in date is required';
      if (!formData.checkOutDate) newErrors.checkOutDate = 'Check-out date is required';

      // Check if check-out date is after check-in date
      if (formData.checkInDate && formData.checkOutDate &&
        formData.checkOutDate <= formData.checkInDate) {
        newErrors.checkOutDate = 'Check-out date must be after check-in date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goToNextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    setCurrentStep(currentStep - 1);
  };

  // Handle form submission
  const handleSubmit = async () => {
    setIsSubmitting(true);

    // Format dates as strings
    const checkInDateStr = formData.checkInDate instanceof Date
      ? formData.checkInDate.toISOString().split('T')[0]
      : formData.checkInDate;

    const checkOutDateStr = formData.checkOutDate instanceof Date
      ? formData.checkOutDate.toISOString().split('T')[0]
      : formData.checkOutDate;

    // Find selected room to get its current price
    // Use loose equality to match string/number IDs
    const selectedRoom = rooms.find(r => r.id == formData.roomNumber);

    // Create reservation object
    const reservationData = {
      guestName: formData.guestName,
      phoneNumber: formData.phoneNumber,
      roomNumber: formData.roomNumber,
      roomPrice: selectedRoom ? selectedRoom.price : 0,
      checkInDate: checkInDateStr,
      checkOutDate: checkOutDateStr,
      adults: formData.adults,
      children: formData.children,
      specialRequests: formData.specialRequests,
      paymentMethod: formData.paymentMethod,
      email: ''
    };

    try {
      // Create the reservation in the context
      const result = await createReservation(formData.roomNumber, reservationData);

      if (result.success) {
        onAddReservation(result.data);
        refreshData();
        handleModalClose();
      } else {
        setErrors({ general: result.error || 'Failed to create reservation' });
      }
    } catch (error) {
      console.error('Error creating reservation:', error);
      setErrors({ general: error.message || 'An error occurred' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Custom styles for react-modal
  const customStyles = {
    content: {
      top: '50%',
      left: '50%',
      right: 'auto',
      bottom: 'auto',
      marginRight: '-50%',
      transform: 'translate(-50%, -50%)',
      maxWidth: '800px',
      width: '95%',
      maxHeight: '90vh',
      padding: 0,
      border: 'none',
      borderRadius: '24px',
      backgroundColor: 'transparent',
      overflow: 'visible' // Allow datepicker to overflow
    },
    overlay: {
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      zIndex: 1000
    }
  };

  // When modal is closed, reset form
  const handleModalClose = () => {
    setFormData({
      guestName: '',
      phoneNumber: '',
      roomNumber: '',
      checkInDate: new Date(),
      checkOutDate: new Date(new Date().setDate(new Date().getDate() + 1)),
      adults: 1,
      children: 0,
      specialRequests: '',
      paymentMethod: 'Credit Card'
    });
    setErrors({});
    setCurrentStep(1);
    onRequestClose();
  };

  // Helper to get available rooms
  const availableRooms = rooms
    .filter(room => room.status === 'Available')
    .sort((a, b) => a.room_number - b.room_number);

  const renderStepIndicator = () => {
    const steps = [
      { num: 1, title: 'Guest' },
      { num: 2, title: 'Room' },
      { num: 3, title: 'Confirm' }
    ];

    return (
      <div className="flex items-center justify-center mb-8 px-4">
        {steps.map((step, index) => (
          <React.Fragment key={step.num}>
            <div className="flex flex-col items-center relative z-10">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${currentStep >= step.num
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-110'
                  : isDarkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'
                  }`}
              >
                {step.num}
              </div>
              <span
                className={`text-xs mt-2 font-medium transition-colors duration-300 ${currentStep >= step.num
                  ? isDarkMode ? 'text-blue-400' : 'text-blue-600'
                  : isDarkMode ? 'text-gray-500' : 'text-gray-400'
                  }`}
              >
                {step.title}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className={`h-1 w-16 -mt-6 mx-2 rounded transition-colors duration-500 ${currentStep > step.num
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600'
                : isDarkMode ? 'bg-gray-700' : 'bg-gray-200'
                }`} />
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  const renderGuestInfoStep = () => (
    <div className="animate-fadeIn">
      <h3 className={`text-xl font-semibold mb-6 flex items-center ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
        <span className="bg-blue-500/10 p-2 rounded-lg mr-3 text-blue-500">
          <FaUser />
        </span>
        Guest Information
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="col-span-2 md:col-span-1">
          <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Full Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <FaUser />
            </div>
            <input
              type="text"
              name="guestName"
              value={formData.guestName}
              onChange={handleChange}
              className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none ${isDarkMode
                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                } ${errors.guestName ? 'border-red-500 ring-1 ring-red-500' : ''}`}
              placeholder="Enter guest name"
            />
          </div>
          {errors.guestName && <p className="text-red-500 text-xs mt-1 ml-1">{errors.guestName}</p>}
        </div>

        <div className="col-span-2 md:col-span-1">
          <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Phone Number <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <FaPhone className="transform rotate-90" />
            </div>
            <input
              type="tel"
              name="phoneNumber"
              value={formData.phoneNumber}
              onChange={handleChange}
              className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none ${isDarkMode
                ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
                : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
                } ${errors.phoneNumber ? 'border-red-500 ring-1 ring-red-500' : ''}`}
              placeholder="Enter phone number"
            />
          </div>
          {errors.phoneNumber && <p className="text-red-500 text-xs mt-1 ml-1">{errors.phoneNumber}</p>}
        </div>

        <div className="col-span-2 grid grid-cols-2 gap-6">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Adults
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <FaUser />
              </div>
              <select
                name="adults"
                value={formData.adults}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none appearance-none ${isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
              >
                {[1, 2, 3, 4, 5, 6].map(num => (
                  <option key={num} value={num}>{num} Adult{num > 1 ? 's' : ''}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                <FaChevronRight className="transform rotate-90 text-xs" />
              </div>
            </div>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Children
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <FaChild />
              </div>
              <select
                name="children"
                value={formData.children}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none appearance-none ${isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
              >
                {[0, 1, 2, 3, 4].map(num => (
                  <option key={num} value={num}>{num} Child{num !== 1 ? 'ren' : ''}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                <FaChevronRight className="transform rotate-90 text-xs" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRoomSelectionStep = () => (
    <div className="animate-fadeIn">
      <h3 className={`text-xl font-semibold mb-6 flex items-center ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
        <span className="bg-purple-500/10 p-2 rounded-lg mr-3 text-purple-500">
          <FaHotel />
        </span>
        Room & Dates
      </h3>

      <div className="space-y-6">
        <div>
          <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Select Room <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <FaBed />
            </div>
            <select
              name="roomNumber"
              value={formData.roomNumber}
              onChange={handleChange}
              className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none appearance-none ${isDarkMode
                ? 'bg-gray-800 border-gray-700 text-white'
                : 'bg-gray-50 border-gray-200 text-gray-900'
                } ${errors.roomNumber ? 'border-red-500 ring-1 ring-red-500' : ''}`}
            >
              <option value="">-- Choose a Room --</option>
              {availableRooms.map(room => (
                <option key={room.id} value={room.id}>
                  Room {room.room_number} - {room.type} (₵{room.price})
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
              <FaChevronRight className="transform rotate-90 text-xs" />
            </div>
          </div>
          {errors.roomNumber && <p className="text-red-500 text-xs mt-1 ml-1">{errors.roomNumber}</p>}
          <p className={`text-xs mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Only available rooms are shown.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Check-In Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 z-10">
                <FaCalendarAlt />
              </div>
              <DatePicker
                selected={formData.checkInDate}
                onChange={(date) => handleDateChange('checkInDate', date)}
                className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none ${isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                calendarClassName={isDarkMode ? "futuristic-calendar" : "light-calendar"}
                {...datePickerConfig}
              />
            </div>
            {errors.checkInDate && <p className="text-red-500 text-xs mt-1 ml-1">{errors.checkInDate}</p>}
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Check-Out Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400 z-10">
                <FaCalendarAlt />
              </div>
              <DatePicker
                selected={formData.checkOutDate}
                onChange={(date) => handleDateChange('checkOutDate', date)}
                className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all outline-none ${isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
                calendarClassName={isDarkMode ? "futuristic-calendar" : "light-calendar"}
                {...datePickerConfig}
                minDate={formData.checkInDate}
              />
            </div>
            {errors.checkOutDate && <p className="text-red-500 text-xs mt-1 ml-1">{errors.checkOutDate}</p>}
          </div>
        </div>
      </div>
    </div>
  );

  const renderConfirmationStep = () => {
    const selectedRoom = rooms.find(room => room.id == formData.roomNumber) || {};
    const nights = Math.ceil((formData.checkOutDate - formData.checkInDate) / (1000 * 60 * 60 * 24)) || 1;
    const roomPrice = selectedRoom.price || 0;
    const totalPrice = roomPrice * nights;

    return (
      <div className="animate-fadeIn">
        <h3 className={`text-xl font-semibold mb-6 flex items-center ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
          <span className="bg-green-500/10 p-2 rounded-lg mr-3 text-green-500">
            <FaClipboardCheck />
          </span>
          Confirm Details
        </h3>

        <div className={`rounded-2xl p-6 mb-6 ${isDarkMode ? 'bg-gray-800/50' : 'bg-gray-50'}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
            <div>
              <p className={`text-xs uppercase tracking-wider font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Guest</p>
              <p className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{formData.guestName}</p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{formData.phoneNumber}</p>
            </div>

            <div>
              <p className={`text-xs uppercase tracking-wider font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Room</p>
              <p className={`text-lg font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Room {selectedRoom.room_number || 'N/A'}
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>₵{roomPrice}/night</p>
            </div>

            <div>
              <p className={`text-xs uppercase tracking-wider font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Dates</p>
              <p className={`text-base font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {formData.checkInDate.toLocaleDateString()} — {formData.checkOutDate.toLocaleDateString()}
              </p>
              <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>{nights} Night{nights !== 1 ? 's' : ''}</p>
            </div>

            <div>
              <p className={`text-xs uppercase tracking-wider font-semibold mb-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Party</p>
              <p className={`text-base font-medium ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                {formData.adults} Adult{formData.adults !== 1 ? 's' : ''}, {formData.children} Child{formData.children !== 1 ? 'ren' : ''}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            Special Requests
          </label>
          <textarea
            name="specialRequests"
            value={formData.specialRequests}
            onChange={handleChange}
            rows="2"
            className={`w-full p-4 rounded-xl border focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none resize-none ${isDarkMode
              ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
              : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400'
              }`}
            placeholder="Any special requirements..."
          ></textarea>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
          <div>
            <label className={`block text-sm font-medium mb-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Payment Method
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                <FaCreditCard />
              </div>
              <select
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all outline-none appearance-none ${isDarkMode
                  ? 'bg-gray-800 border-gray-700 text-white'
                  : 'bg-gray-50 border-gray-200 text-gray-900'
                  }`}
              >
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Mobile Money">Mobile Money</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-gray-400">
                <FaChevronRight className="transform rotate-90 text-xs" />
              </div>
            </div>
          </div>

          <div className={`p-4 rounded-xl flex justify-between items-center ${isDarkMode ? 'bg-green-900/20 border border-green-500/30' : 'bg-green-50 border border-green-200'}`}>
            <span className={`font-medium ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>Total Amount</span>
            <span className={`text-2xl font-bold ${isDarkMode ? 'text-green-400' : 'text-green-700'}`}>
              ₵{totalPrice.toFixed(2)}
            </span>
          </div>
        </div>

        {errors.general && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 text-sm flex items-center">
            <FaTimes className="mr-2" /> {errors.general}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={handleModalClose}
      style={customStyles}
      contentLabel="New Reservation"
      closeTimeoutMS={300}
    >
      <div className={`relative w-full h-full flex flex-col max-h-[90vh] ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
        {/* Glassmorphism Background */}
        <div className={`absolute inset-0 rounded-3xl backdrop-blur-xl ${isDarkMode
          ? 'bg-gray-900/90 border border-gray-700/50 shadow-2xl shadow-black/50'
          : 'bg-white/95 border border-white/50 shadow-2xl shadow-gray-200/50'
          }`}></div>

        {/* Content Container */}
        <div className="relative z-10 flex flex-col h-full p-6 md:p-8">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">
                New Reservation
              </h2>
              <p className={`text-sm mt-1 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Create a new booking for a guest
              </p>
            </div>
            <button
              onClick={handleModalClose}
              className={`p-2 rounded-full transition-colors ${isDarkMode
                ? 'hover:bg-gray-800 text-gray-400 hover:text-white'
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-800'
                }`}
            >
              <FaTimes className="text-xl" />
            </button>
          </div>

          {/* Stepper */}
          {renderStepIndicator()}

          {/* Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar px-1 py-2">
            {currentStep === 1 && renderGuestInfoStep()}
            {currentStep === 2 && renderRoomSelectionStep()}
            {currentStep === 3 && renderConfirmationStep()}
          </div>

          {/* Footer */}
          <div className="mt-8 flex justify-between items-center pt-6 border-t border-gray-200/10">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={goToPreviousStep}
                disabled={isSubmitting}
                className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center ${isDarkMode
                  ? 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
              >
                <FaChevronLeft className="mr-2 text-sm" /> Back
              </button>
            ) : (
              <div></div> // Spacer
            )}

            {currentStep < 3 ? (
              <button
                type="button"
                onClick={goToNextStep}
                className="px-8 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/30 transition-all transform hover:-translate-y-0.5 flex items-center"
              >
                Next Step <FaChevronRight className="ml-2 text-sm" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className={`px-8 py-3 rounded-xl font-semibold text-white shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center ${isSubmitting
                  ? 'bg-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 shadow-green-500/30'
                  }`}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <FaClipboardCheck className="mr-2" /> Confirm Reservation
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default NewReservationModal;
