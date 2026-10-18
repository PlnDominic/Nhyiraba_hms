import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { useOfflineRoomReservation } from '../context/OfflineRoomReservationContext';
import { StepModal, Step, Field, RoomCards, DateInput, ReviewList } from './ui/StepModal';

// Two uses: from a room card (roomId + onCheckIn) it checks a named guest into that
// room; from the Guests page (onAddGuest, no room) it also asks for the room and phone.
const OfflineCheckInModal = ({ isOpen, onClose, onCheckIn, onAddGuest, roomId }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const guestMode = roomId === undefined || roomId === null;
  const { rooms } = useOfflineRoomReservation();
  const availableRooms = (rooms || []).filter(r => r.status === 'Available');

  const toDate = (str) => parseISO(str);
  const toStr = (date) => format(date, 'yyyy-MM-dd');
  const today = () => new Date().toISOString().split('T')[0];
  const tomorrow = () => new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [step, setStep] = useState(0);
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [errors, setErrors] = useState({});
  const [checkInDate, setCheckInDate] = useState(today());
  const [checkOutDate, setCheckOutDate] = useState(tomorrow());

  // Start every check-in from a clean form
  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setGuestName('');
      setPhone('');
      setSelectedRoom('');
      setErrors({});
      setCheckInDate(today());
      setCheckOutDate(tomorrow());
    }
  }, [isOpen]);

  const handleCheckInChange = (date) => {
    if (!date) return;
    const next = toStr(date);
    setCheckInDate(next);
    if (checkOutDate <= next) setCheckOutDate(toStr(new Date(date.getTime() + 86400000)));
  };

  const nights = Math.max(1, Math.round((toDate(checkOutDate) - toDate(checkInDate)) / 86400000) || 1);
  const fmt = (str) => toDate(str).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const room = availableRooms.find(r => String(r.id) === String(selectedRoom));
  const roomLabel = guestMode ? (room ? `Room ${room.room_number}` : '—') : `Room ${roomId}`;

  const validateStep = () => {
    const next = {};
    if (step === 0 && !guestName.trim()) next.guestName = 'Guest name is required';
    if (step === 1 && guestMode && !selectedRoom) next.room = 'Please choose a room';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => { if (validateStep()) setStep(step + 1); };

  const submit = () => {
    if (guestMode) {
      if (!guestName.trim() || !selectedRoom) return;
      onAddGuest({
        name: guestName.trim(),
        phone,
        room: Number(selectedRoom),
        room_name: room ? `Room ${room.room_number}` : undefined,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        status: 'Checked In'
      });
      return;
    }
    onCheckIn(roomId, guestName, checkInDate, checkOutDate);
    onClose();
  };

  const steps = guestMode ? ['Guest', 'Room & dates', 'Review'] : ['Guest', 'Stay & confirm'];
  const last = step === steps.length - 1;

  const renderStep = () => {
    if (step === 0) {
      return (
        <Step title="Guest details" lead={guestMode ? 'Register the arriving guest.' : `Who is checking in to Room ${roomId}?`}>
          <div className="sm-grid">
            <Field label="Full name" error={errors.guestName} span={!guestMode}>
              <input className="sm-input" type="text" value={guestName} onChange={(e) => { setGuestName(e.target.value); setErrors({}); }} placeholder="Enter guest name" autoComplete="off" autoFocus />
            </Field>
            {guestMode && (
              <Field label="Phone (optional)">
                <input className="sm-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Enter phone number" autoComplete="off" />
              </Field>
            )}
          </div>
        </Step>
      );
    }
    if (step === 1) {
      return (
        <Step title={guestMode ? 'Room & dates' : 'Stay & confirm'} lead={guestMode ? 'Pick an available room for this stay.' : 'Set the dates and confirm the check-in.'}>
          {guestMode && errors.room && <p className="sm-error" style={{ marginBottom: 12 }}>{errors.room}</p>}
          {guestMode && (
            <RoomCards
              rooms={availableRooms}
              selectedId={selectedRoom}
              onSelect={(id) => { setSelectedRoom(String(id)); setErrors({}); }}
              label={(r) => `Room ${r.room_number}`}
              meta={(r) => r.room_type || 'Room'}
              price={(r) => Number(r.price_per_night) || 0}
            />
          )}
          <div className="sm-grid" style={{ marginBottom: guestMode ? 0 : 24 }}>
            <Field label="Check-in"><DateInput selected={toDate(checkInDate)} onChange={handleCheckInChange} /></Field>
            <Field label="Check-out"><DateInput selected={toDate(checkOutDate)} onChange={(date) => date && setCheckOutDate(toStr(date))} minDate={new Date(toDate(checkInDate).getTime() + 86400000)} /></Field>
          </div>
          {!guestMode && (
            <ReviewList rows={[
              ['Guest', guestName.trim()],
              ['Room', roomLabel],
              ['Dates', `${fmt(checkInDate)} – ${fmt(checkOutDate)} (${nights} night${nights !== 1 ? 's' : ''})`]
            ]} />
          )}
        </Step>
      );
    }
    return (
      <Step title="Review & check in" lead="Confirm the details before checking the guest in.">
        <ReviewList rows={[
          ['Guest', guestName.trim()],
          ['Phone', phone || '—'],
          ['Room', roomLabel],
          ['Dates', `${fmt(checkInDate)} – ${fmt(checkOutDate)} (${nights} night${nights !== 1 ? 's' : ''})`]
        ]} />
      </Step>
    );
  };

  return (
    <StepModal
      isOpen={isOpen}
      onClose={onClose}
      isDarkMode={isDarkMode}
      title={guestMode ? 'Guest check-in' : `Check in · Room ${roomId}`}
      steps={steps}
      current={step}
      recap={[
        guestName.trim() && { label: 'Guest', value: guestName.trim() },
        (guestMode ? room : true) && { label: 'Room', value: roomLabel }
      ].filter(Boolean)}
      onBack={() => setStep(Math.max(0, step - 1))}
      onNext={last ? submit : goNext}
      nextLabel={last ? 'Check in' : 'Continue'}
      finalStep={last}
    >
      {renderStep()}
    </StepModal>
  );
};

export default OfflineCheckInModal;
