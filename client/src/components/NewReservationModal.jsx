import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { useRoomReservation } from '../context/RoomReservationContext';
import { StepModal, Step, Field, Counter, RoomCards, DateInput, ReviewList } from './ui/StepModal';

const NewReservationModal = ({ isOpen, onRequestClose, onAddReservation }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const { createReservation, rooms, refreshData } = useRoomReservation();

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

  const TOTAL_STEPS = 4;

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
    const selectedRoom = rooms.find(r => String(r.id) === String(formData.roomNumber));

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

  const setCount = (name) => (value) => setFormData(prev => ({ ...prev, [name]: value }));
  const nights = Math.max(1, Math.ceil((formData.checkOutDate - formData.checkInDate) / 86400000) || 1);
  const selectedRoom = rooms.find(room => String(room.id) === String(formData.roomNumber));
  const total = (selectedRoom?.price || 0) * nights;
  const fmt = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const money = (n) => `₵${Number(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  const recap = [
    formData.guestName && { label: 'Guest', value: formData.guestName },
    selectedRoom && { label: 'Room', value: `Room ${selectedRoom.room_number} · ${selectedRoom.type}` },
    selectedRoom && { label: 'Stay', value: `${fmt(formData.checkInDate)} → ${fmt(formData.checkOutDate)} · ${nights} night${nights !== 1 ? 's' : ''}` }
  ].filter(Boolean);

  const renderStep = () => {
    if (currentStep === 1) {
      return (
        <Step title="Guest details" lead="Who is the booking for?">
          <div className="sm-grid">
            <Field label="Full name" error={errors.guestName}>
              <input className="sm-input" type="text" name="guestName" value={formData.guestName} onChange={handleChange} placeholder="Enter guest name" autoComplete="off" autoFocus />
            </Field>
            <Field label="Phone number" error={errors.phoneNumber}>
              <input className="sm-input" type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="Enter phone number" autoComplete="off" />
            </Field>
            <Field label="Adults"><Counter name="adults" value={formData.adults} min={1} max={6} onChange={setCount('adults')} /></Field>
            <Field label="Children"><Counter name="children" value={formData.children} min={0} max={4} onChange={setCount('children')} /></Field>
          </div>
        </Step>
      );
    }
    if (currentStep === 2) {
      return (
        <Step title="Room & dates" lead="Choose an available room and the length of stay.">
          {errors.roomNumber && <p className="sm-error" style={{ marginBottom: 12 }}>{errors.roomNumber}</p>}
          <RoomCards
            rooms={rooms}
            selectedId={formData.roomNumber}
            onSelect={(id) => handleChange({ target: { name: 'roomNumber', value: id } })}
            label={(room) => `Room ${room.room_number}`}
            meta={(room) => room.type}
            price={(room) => Number(room.price) || 0}
          />
          <div className="sm-grid">
            <Field label="Check-in" error={errors.checkInDate}>
              <DateInput selected={formData.checkInDate} onChange={(date) => handleDateChange('checkInDate', date)} />
            </Field>
            <Field label="Check-out" error={errors.checkOutDate}>
              <DateInput selected={formData.checkOutDate} onChange={(date) => handleDateChange('checkOutDate', date)} minDate={formData.checkInDate} />
            </Field>
          </div>
        </Step>
      );
    }
    if (currentStep === 3) {
      return (
        <Step title="Payment & notes" lead="How will the guest pay, and is there anything we should prepare?">
          <div className="sm-grid">
            <Field label="Payment method">
              <select className="sm-select" name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}>
                {['Credit Card', 'Debit Card', 'Cash', 'Bank Transfer', 'Mobile Money'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Special requests" span>
              <textarea className="sm-textarea" name="specialRequests" value={formData.specialRequests} onChange={handleChange} placeholder="Any special requirements..." />
            </Field>
          </div>
        </Step>
      );
    }
    return (
      <Step title="Review & confirm" lead="Check everything before creating the reservation.">
        <ReviewList rows={[
          ['Guest', formData.guestName],
          ['Phone', formData.phoneNumber],
          ['Room', selectedRoom ? `Room ${selectedRoom.room_number} · ${money(selectedRoom.price || 0)}/night` : 'N/A'],
          ['Dates', `${fmt(formData.checkInDate)} – ${fmt(formData.checkOutDate)} (${nights} night${nights !== 1 ? 's' : ''})`],
          ['Guests', `${formData.adults} adult${formData.adults !== 1 ? 's' : ''}, ${formData.children} child${formData.children !== 1 ? 'ren' : ''}`],
          ['Payment', formData.paymentMethod],
          ['Special requests', formData.specialRequests || 'None']
        ]} />
        {errors.general && <div role="alert" className="sm-alert">{errors.general}</div>}
      </Step>
    );
  };

  return (
    <StepModal
      isOpen={isOpen}
      onClose={handleModalClose}
      isDarkMode={isDarkMode}
      title="New reservation"
      steps={['Guest', 'Room & dates', 'Payment', 'Review']}
      current={currentStep - 1}
      recap={recap}
      total={selectedRoom ? { label: `${nights} night${nights !== 1 ? 's' : ''} · Total`, value: money(total) } : null}
      onBack={goToPreviousStep}
      onNext={currentStep < TOTAL_STEPS ? goToNextStep : handleSubmit}
      nextLabel={currentStep < TOTAL_STEPS ? 'Continue' : (isSubmitting ? 'Processing…' : 'Confirm reservation')}
      finalStep={currentStep === TOTAL_STEPS}
      busy={isSubmitting}
    >
      {renderStep()}
    </StepModal>
  );
};

export default NewReservationModal;
