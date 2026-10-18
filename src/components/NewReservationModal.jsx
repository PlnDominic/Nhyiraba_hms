import React, { useState } from 'react';
import { useTheme } from '../context/ThemeContext';
import { StepModal, Step, Field, Counter, RoomCards, DateInput, ReviewList } from './ui/StepModal';
import { useRoomReservation } from '../context/RoomReservationContext';

const NewReservationModal = ({ isOpen, onRequestClose, onAddReservation }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const { createReservation, rooms } = useRoomReservation();
  

  // Initial form state
  const [formData, setFormData] = useState({
    guestName: '',
    email: '',
    phoneNumber: '',
    roomType: 'Standard',
    roomNumber: '',
    checkInDate: new Date(),
    checkOutDate: new Date(new Date().setDate(new Date().getDate() + 3)), // Default: 3 days from now
    adults: 1,
    children: 0,
    specialRequests: '',
    paymentMethod: 'Credit Card'
  });

  // Error state
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(0);

  // Handle form field changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle date changes
  const handleDateChange = (name, date) => {
    setFormData(prev => ({
      ...prev,
      [name]: date
    }));
  };

  // Form validation
  const validateForm = () => {
    const newErrors = {};
    if (!formData.guestName.trim()) newErrors.guestName = 'Guest name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.roomNumber.trim()) newErrors.roomNumber = 'Room number is required';
    if (!formData.checkInDate) newErrors.checkInDate = 'Check-in date is required';
    if (!formData.checkOutDate) newErrors.checkOutDate = 'Check-out date is required';
    
    // Check if check-out date is after check-in date
    if (formData.checkInDate && formData.checkOutDate && 
        formData.checkOutDate <= formData.checkInDate) {
      newErrors.checkOutDate = 'Check-out date must be after check-in date';
    }
    
    return newErrors;
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate form
    const formErrors = validateForm();
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }
    
    // Format dates as strings
    const checkInDateStr = formData.checkInDate instanceof Date 
      ? formData.checkInDate.toISOString().split('T')[0] 
      : formData.checkInDate;
    
    const checkOutDateStr = formData.checkOutDate instanceof Date 
      ? formData.checkOutDate.toISOString().split('T')[0] 
      : formData.checkOutDate;
    
    // Create reservation object
    const newReservation = {
      guestName: formData.guestName,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      roomType: 'Standard',
      roomNumber: formData.roomNumber,
      checkInDate: checkInDateStr,
      checkOutDate: checkOutDateStr,
      adults: formData.adults,
      children: formData.children,
      specialRequests: formData.specialRequests,
      paymentMethod: formData.paymentMethod,
      status: 'Confirmed',
      id: Date.now().toString(), // Generate unique ID
      createdAt: new Date().toISOString()
    };
    
    // Update room status in the context
    const roomId = parseInt(formData.roomNumber);
    
    // Create the reservation in the context to update room status
    createReservation(roomId, {
      guestName: formData.guestName,
      email: formData.email,
      phoneNumber: formData.phoneNumber,
      checkInDate: checkInDateStr,
      checkOutDate: checkOutDateStr,
      specialRequests: formData.specialRequests,
      paymentMethod: formData.paymentMethod,
      adults: formData.adults,
      children: formData.children,
      roomType: formData.roomType
    })
      .then(result => {
        if (result.success) {
          // Add reservation and close modal
          onAddReservation(newReservation);
          onRequestClose();
        } else {
          setErrors({ general: result.error || 'Failed to create reservation' });
        }
      });
  };

  // When modal is closed, reset form
  const handleModalClose = () => {
    setFormData({
      guestName: '',
      email: '',
      phoneNumber: '',
      roomType: 'Standard',
      roomNumber: '',
      checkInDate: new Date(),
      checkOutDate: new Date(new Date().setDate(new Date().getDate() + 3)),
      adults: 1,
      children: 0,
      specialRequests: '',
      paymentMethod: 'Credit Card'
    });
    setErrors({});
    setStep(0);
    onRequestClose();
  };

  const setCount = (name) => (value) => setFormData(prev => ({ ...prev, [name]: value }));
  const selectedRoom = rooms.find(room => String(room.id) === String(formData.roomNumber));
  const nights = Math.max(1, Math.ceil((formData.checkOutDate - formData.checkInDate) / 86400000) || 1);
  const fmt = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const money = (n) => `₵${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const STEP_KEYS = [['guestName', 'email'], ['roomNumber', 'checkInDate', 'checkOutDate'], []];
  const LAST = STEP_KEYS.length - 1;

  const goNext = () => {
    const all = validateForm();
    const stepErrors = {};
    STEP_KEYS[step].forEach(k => { if (all[k]) stepErrors[k] = all[k]; });
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length === 0) setStep(step + 1);
  };

  const submit = () => handleSubmit({ preventDefault: () => {} });

  const renderStep = () => {
    if (step === 0) {
      return (
        <Step title="Guest details" lead="Who is the booking for?">
          <div className="sm-grid">
            <Field label="Full name" error={errors.guestName}>
              <input className="sm-input" type="text" name="guestName" value={formData.guestName} onChange={handleChange} placeholder="Enter full name" autoComplete="off" autoFocus />
            </Field>
            <Field label="Email address" error={errors.email}>
              <input className="sm-input" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" autoComplete="off" />
            </Field>
            <Field label="Phone (optional)">
              <input className="sm-input" type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="Enter phone number" autoComplete="off" />
            </Field>
            <Field label="Room type">
              <select className="sm-select" name="roomType" value={formData.roomType} onChange={handleChange}>
                {['Standard', 'Deluxe', 'Suite', 'Executive', 'Presidential'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Adults"><Counter name="adults" value={formData.adults} min={1} max={5} onChange={setCount('adults')} /></Field>
            <Field label="Children"><Counter name="children" value={formData.children} min={0} max={4} onChange={setCount('children')} /></Field>
          </div>
        </Step>
      );
    }
    if (step === 1) {
      return (
        <Step title="Room & dates" lead="Choose an available room and the length of stay.">
          {errors.roomNumber && <p className="sm-error" style={{ marginBottom: 12 }}>{errors.roomNumber}</p>}
          <RoomCards
            rooms={rooms}
            selectedId={formData.roomNumber}
            onSelect={(id) => handleChange({ target: { name: 'roomNumber', value: String(id) } })}
            label={(room) => `Room ${room.room_number || room.id}`}
            meta={(room) => room.type}
            price={(room) => Number(room.price) || 0}
          />
          <div className="sm-grid">
            <Field label="Check-in" error={errors.checkInDate}>
              <DateInput selected={formData.checkInDate} onChange={(date) => handleDateChange('checkInDate', date)} minDate={new Date()} />
            </Field>
            <Field label="Check-out" error={errors.checkOutDate}>
              <DateInput selected={formData.checkOutDate} onChange={(date) => handleDateChange('checkOutDate', date)} minDate={new Date(formData.checkInDate.getTime() + 86400000)} />
            </Field>
          </div>
        </Step>
      );
    }
    return (
      <Step title="Payment & review" lead="Add payment details and confirm the booking.">
        <div className="sm-grid" style={{ marginBottom: 24 }}>
          <Field label="Payment method">
            <select className="sm-select" name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}>
              {['Credit Card', 'Debit Card', 'Cash', 'Bank Transfer', 'Mobile Money'].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </Field>
          <Field label="Special requests" span>
            <textarea className="sm-textarea" name="specialRequests" value={formData.specialRequests} onChange={handleChange} placeholder="Any special requirements or notes" />
          </Field>
        </div>
        <ReviewList rows={[
          ['Guest', formData.guestName],
          ['Email', formData.email],
          ['Room', selectedRoom ? `Room ${selectedRoom.room_number || selectedRoom.id} · ${selectedRoom.type}` : '—'],
          ['Dates', `${fmt(formData.checkInDate)} – ${fmt(formData.checkOutDate)} (${nights} night${nights !== 1 ? 's' : ''})`],
          ['Guests', `${formData.adults} adult${formData.adults !== 1 ? 's' : ''}, ${formData.children} child${formData.children !== 1 ? 'ren' : ''}`]
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
      steps={['Guest', 'Room & dates', 'Payment & review']}
      current={step}
      recap={[
        formData.guestName.trim() && { label: 'Guest', value: formData.guestName.trim() },
        selectedRoom && { label: 'Room', value: `Room ${selectedRoom.room_number || selectedRoom.id}` }
      ].filter(Boolean)}
      total={selectedRoom && Number(selectedRoom.price) ? { label: `${nights} night${nights !== 1 ? 's' : ''} · Total`, value: money(Number(selectedRoom.price) * nights) } : null}
      onBack={() => setStep(Math.max(0, step - 1))}
      onNext={step === LAST ? submit : goNext}
      nextLabel={step === LAST ? 'Create reservation' : 'Continue'}
      finalStep={step === LAST}
    >
      {renderStep()}
    </StepModal>
  );
};

export default NewReservationModal;
