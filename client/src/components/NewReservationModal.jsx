import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { useTheme } from '../context/ThemeContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { useRoomReservation } from '../context/RoomReservationContext';
import '../styles/AppleModal.css';
import { Group, Row, Counter, CloseIcon } from './ui/AppleForm';

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

  const mode = isDarkMode ? 'dark' : 'light';
  const muted = isDarkMode ? 'text-[#ebebf5]/60' : 'text-[#3c3c43]/60';
  const nights = Math.max(1, Math.ceil((formData.checkOutDate - formData.checkInDate) / 86400000) || 1);

  const setCount = (name) => (value) => setFormData(prev => ({ ...prev, [name]: value }));
  const renderStepIndicator = () => {
    const steps = ['Guest', 'Room', 'Confirm'];
    return (
      <div className="apple-segmented" role="tablist" aria-label="Reservation progress">
        {steps.map((title, i) => (
          <div key={title} role="tab" aria-selected={currentStep === i + 1} className={currentStep === i + 1 ? 'is-active' : ''}>
            {title}
          </div>
        ))}
      </div>
    );
  };

  const renderGuestInfoStep = () => (
    <div className="apple-step space-y-6">
      <div>
        <p className="apple-section-title">Guest</p>
        <Group mode={mode}>
          <Row label="Full name" error={errors.guestName}>
            <input className="apple-field" type="text" name="guestName" value={formData.guestName} onChange={handleChange} placeholder="Required" autoComplete="off" autoFocus />
          </Row>
          <Row label="Phone" error={errors.phoneNumber}>
            <input className="apple-field" type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="Required" autoComplete="off" />
          </Row>
        </Group>
        {errors.guestName && <p className="apple-error">{errors.guestName}</p>}
        {errors.phoneNumber && <p className="apple-error">{errors.phoneNumber}</p>}
      </div>

      <div>
        <p className="apple-section-title">Party</p>
        <Group mode={mode}>
          <Row label="Adults">
            <span className={muted} style={{ marginLeft: 'auto' }}>{formData.adults}</span>
            <Counter name="adults" value={formData.adults} min={1} max={6} onChange={setCount('adults')} />
          </Row>
          <Row label="Children">
            <span className={muted} style={{ marginLeft: 'auto' }}>{formData.children}</span>
            <Counter name="children" value={formData.children} min={0} max={4} onChange={setCount('children')} />
          </Row>
        </Group>
      </div>
    </div>
  );

  const renderRoomSelectionStep = () => (
    <div className="apple-step space-y-6">
      <div>
        <p className="apple-section-title">Room</p>
        <Group mode={mode}>
          <Row label="Room" error={errors.roomNumber}>
            <select className="apple-field" name="roomNumber" value={formData.roomNumber} onChange={handleChange}>
              <option value="">Choose…</option>
              {availableRooms.map(room => (
                <option key={room.id} value={room.id}>
                  Room {room.room_number} · {room.type} · ₵{room.price}
                </option>
              ))}
            </select>
          </Row>
        </Group>
        {errors.roomNumber ? <p className="apple-error">{errors.roomNumber}</p> : <p className="apple-footnote">Only available rooms are shown.</p>}
      </div>

      <div>
        <p className="apple-section-title">Stay</p>
        <Group mode={mode}>
          <Row label="Check-in" error={errors.checkInDate}>
            <DatePicker
              selected={formData.checkInDate}
              onChange={(date) => handleDateChange('checkInDate', date)}
              className="apple-field"
              calendarClassName={isDarkMode ? 'apple-datepicker-dark' : undefined}
              dateFormat="EEE, d MMM yyyy"
              popperPlacement="bottom-end"
              minDate={new Date()}
            />
          </Row>
          <Row label="Check-out" error={errors.checkOutDate}>
            <DatePicker
              selected={formData.checkOutDate}
              onChange={(date) => handleDateChange('checkOutDate', date)}
              className="apple-field"
              calendarClassName={isDarkMode ? 'apple-datepicker-dark' : undefined}
              dateFormat="EEE, d MMM yyyy"
              popperPlacement="bottom-end"
              minDate={formData.checkInDate}
            />
          </Row>
        </Group>
        {errors.checkInDate && <p className="apple-error">{errors.checkInDate}</p>}
        {errors.checkOutDate && <p className="apple-error">{errors.checkOutDate}</p>}
      </div>
    </div>
  );

  const renderConfirmationStep = () => {
    const selectedRoom = rooms.find(room => room.id == formData.roomNumber) || {};
    const roomPrice = selectedRoom.price || 0;
    const totalPrice = roomPrice * nights;
    const fmt = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

    return (
      <div className="apple-step space-y-6">
        <div className="text-center py-2">
          <p className={`text-sm ${muted}`}>Total · {nights} night{nights !== 1 ? 's' : ''}</p>
          <p className="text-[40px] leading-tight font-semibold tracking-tight">₵{totalPrice.toFixed(2)}</p>
        </div>

        <div>
          <p className="apple-section-title">Summary</p>
          <Group mode={mode}>
            <Row label="Guest"><span className="apple-field flex items-center justify-end" style={{ height: 46 }}>{formData.guestName}</span></Row>
            <Row label="Phone"><span className={`apple-field flex items-center justify-end ${muted}`} style={{ height: 46 }}>{formData.phoneNumber}</span></Row>
            <Row label="Room"><span className="apple-field flex items-center justify-end" style={{ height: 46 }}>Room {selectedRoom.room_number || 'N/A'} · ₵{roomPrice}/night</span></Row>
            <Row label="Dates"><span className="apple-field flex items-center justify-end" style={{ height: 46 }}>{fmt(formData.checkInDate)} – {fmt(formData.checkOutDate)}</span></Row>
            <Row label="Guests"><span className="apple-field flex items-center justify-end" style={{ height: 46 }}>{formData.adults} adult{formData.adults !== 1 ? 's' : ''}, {formData.children} child{formData.children !== 1 ? 'ren' : ''}</span></Row>
          </Group>
        </div>

        <div>
          <p className="apple-section-title">Payment & notes</p>
          <Group mode={mode}>
            <Row label="Payment">
              <select className="apple-field" name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Cash">Cash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Mobile Money">Mobile Money</option>
              </select>
            </Row>
            <div className="apple-row" style={{ alignItems: 'flex-start' }}>
              <textarea className="apple-field apple-field--area" name="specialRequests" value={formData.specialRequests} onChange={handleChange} rows="3" placeholder="Special requests" />
            </div>
          </Group>
        </div>

        {errors.general && (
          <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,59,48,0.12)', color: '#ff3b30' }}>
            {errors.general}
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
      contentLabel="New Reservation"
      closeTimeoutMS={250}
      overlayClassName="apple-overlay"
      className={`apple-ui apple-sheet apple-sheet--${mode}`}
      style={{ content: { maxWidth: 520 } }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div style={{ minWidth: 60 }}>
          {currentStep > 1 && (
            <button type="button" className="apple-btn apple-btn--plain" style={{ height: 30, padding: 0 }} onClick={goToPreviousStep} disabled={isSubmitting}>
              ‹ Back
            </button>
          )}
        </div>
        <h2 className="text-[17px] font-semibold">New Reservation</h2>
        <div style={{ minWidth: 60, textAlign: 'right' }}>
          <button type="button" className="apple-close" onClick={handleModalClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
      </div>

      <div className="px-5 pb-3">{renderStepIndicator()}</div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 pt-3 pb-4" style={{ overflowX: 'hidden' }}>
        {currentStep === 1 && renderGuestInfoStep()}
        {currentStep === 2 && renderRoomSelectionStep()}
        {currentStep === 3 && renderConfirmationStep()}
      </div>

      {/* Footer */}
      <div className="px-5 pb-5 pt-2">
        {currentStep < 3 ? (
          <button type="button" className="apple-btn apple-btn--primary w-full" onClick={goToNextStep}>Continue</button>
        ) : (
          <button type="button" className="apple-btn apple-btn--success w-full" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Processing…' : 'Confirm Reservation'}
          </button>
        )}
      </div>
    </Modal>
  );
};

export default NewReservationModal;
