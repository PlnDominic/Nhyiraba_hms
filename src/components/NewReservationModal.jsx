import React, { useState, useEffect } from 'react';
import Modal from 'react-modal';
import { useTheme } from '../context/ThemeContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/AppleModal.css';
import { Group, Row, Counter, CloseIcon } from './ui/AppleForm';
import { useRoomReservation } from '../context/RoomReservationContext';

const NewReservationModal = ({ isOpen, onRequestClose, onAddReservation }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const { createReservation, rooms } = useRoomReservation();
  
  useEffect(() => {
    Modal.setAppElement('body');
  }, []);

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
    onRequestClose();
  };

  const mode = isDarkMode ? 'dark' : 'light';
  const dp = isDarkMode ? 'apple-datepicker-dark' : undefined;
  const setCount = (name) => (value) => setFormData(prev => ({ ...prev, [name]: value }));
  const availableRooms = rooms.filter(room => room.status === 'Available').sort((a, b) => a.id - b.id);

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
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <button type="button" className="apple-btn apple-btn--plain" style={{ height: 30, minWidth: 60, textAlign: 'left', padding: 0 }} onClick={handleModalClose}>Cancel</button>
        <h2 className="text-[17px] font-semibold">New Reservation</h2>
        <div style={{ minWidth: 60, textAlign: 'right' }}>
          <button type="button" className="apple-close" onClick={handleModalClose} aria-label="Close"><CloseIcon /></button>
        </div>
      </div>

      <form id="new-reservation-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 pt-2 pb-4 space-y-6" style={{ overflowX: 'hidden' }}>
        <div>
          <p className="apple-section-title">Guest</p>
          <Group mode={mode}>
            <Row label="Full name" error={errors.guestName}>
              <input className="apple-field" type="text" name="guestName" value={formData.guestName} onChange={handleChange} placeholder="Required" autoComplete="off" autoFocus />
            </Row>
            <Row label="Email" error={errors.email}>
              <input className="apple-field" type="email" name="email" value={formData.email} onChange={handleChange} placeholder="Required" autoComplete="off" />
            </Row>
            <Row label="Phone">
              <input className="apple-field" type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="Optional" autoComplete="off" />
            </Row>
            <Row label="Adults">
              <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{formData.adults}</span>
              <Counter name="adults" value={formData.adults} min={1} max={5} onChange={setCount('adults')} />
            </Row>
            <Row label="Children">
              <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{formData.children}</span>
              <Counter name="children" value={formData.children} min={0} max={4} onChange={setCount('children')} />
            </Row>
          </Group>
          {errors.guestName && <p className="apple-error">{errors.guestName}</p>}
          {errors.email && <p className="apple-error">{errors.email}</p>}
        </div>

        <div>
          <p className="apple-section-title">Stay</p>
          <Group mode={mode}>
            <Row label="Room type">
              <select className="apple-field" name="roomType" value={formData.roomType} onChange={handleChange}>
                {['Standard', 'Deluxe', 'Suite', 'Executive', 'Presidential'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Row>
            <Row label="Room" error={errors.roomNumber}>
              <select className="apple-field" name="roomNumber" value={formData.roomNumber} onChange={handleChange}>
                <option value="">Choose…</option>
                {availableRooms.map(room => <option key={room.id} value={room.id}>{room.id} · {room.type}</option>)}
              </select>
            </Row>
            <Row label="Check-in" error={errors.checkInDate}>
              <DatePicker selected={formData.checkInDate} onChange={(d) => handleDateChange('checkInDate', d)} className="apple-field" calendarClassName={dp} popperPlacement="bottom-end" minDate={new Date()} dateFormat="EEE, d MMM yyyy" />
            </Row>
            <Row label="Check-out" error={errors.checkOutDate}>
              <DatePicker selected={formData.checkOutDate} onChange={(d) => handleDateChange('checkOutDate', d)} className="apple-field" calendarClassName={dp} popperPlacement="bottom-end" minDate={new Date(formData.checkInDate.getTime() + 86400000)} dateFormat="EEE, d MMM yyyy" />
            </Row>
          </Group>
          {errors.roomNumber && <p className="apple-error">{errors.roomNumber}</p>}
          {errors.checkInDate && <p className="apple-error">{errors.checkInDate}</p>}
          {errors.checkOutDate && <p className="apple-error">{errors.checkOutDate}</p>}
        </div>

        <div>
          <p className="apple-section-title">Payment & notes</p>
          <Group mode={mode}>
            <Row label="Payment">
              <select className="apple-field" name="paymentMethod" value={formData.paymentMethod} onChange={handleChange}>
                {['Credit Card', 'Debit Card', 'Cash', 'Bank Transfer', 'Mobile Money'].map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </Row>
            <Row align="flex-start">
              <textarea className="apple-field apple-field--area" name="specialRequests" value={formData.specialRequests} onChange={handleChange} rows="3" placeholder="Special requests" />
            </Row>
          </Group>
        </div>

        {errors.general && (
          <div role="alert" className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(255,59,48,0.12)', color: '#ff3b30' }}>{errors.general}</div>
        )}
      </form>

      <div className="px-5 pb-5 pt-2">
        <button type="submit" form="new-reservation-form" className="apple-btn apple-btn--primary w-full">Create Reservation</button>
      </div>
    </Modal>
  );
};

export default NewReservationModal;
