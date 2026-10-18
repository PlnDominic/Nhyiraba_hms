import React, { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../context/ThemeContext';
import { useOfflineRoomReservation } from '../context/OfflineRoomReservationContext';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import '../styles/AppleModal.css';
import { Group, Row, CloseIcon } from './ui/AppleForm';

// Two uses: from a room card (roomId + onCheckIn) it checks a named guest into that
// room; from the Guests page (onAddGuest, no room) it also asks for the room and phone.
const OfflineCheckInModal = ({ isOpen, onClose, onCheckIn, onAddGuest, roomId }) => {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const mode = isDarkMode ? 'dark' : 'light';
  const toDate = (str) => parseISO(str);
  const toStr = (date) => format(date, 'yyyy-MM-dd');
  const guestMode = roomId === undefined || roomId === null;
  const { rooms } = useOfflineRoomReservation();
  const availableRooms = (rooms || []).filter(r => r.status === 'Available');
  const [guestName, setGuestName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [checkInDate, setCheckInDate] = useState(new Date().toISOString().split('T')[0]);

  // Calculate default checkout date
  const defaultCheckOut = new Date();
  defaultCheckOut.setDate(defaultCheckOut.getDate() + 1);
  const [checkOutDate, setCheckOutDate] = useState(defaultCheckOut.toISOString().split('T')[0]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    if (guestMode) {
      if (!selectedRoom) return;
      const room = availableRooms.find(r => String(r.id) === String(selectedRoom));
      onAddGuest({
        name: guestName.trim(),
        phone,
        room: Number(selectedRoom),
        room_name: room ? `Room ${room.room_number}` : undefined,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        status: 'Checked In'
      });
      setGuestName('');
      setPhone('');
      setSelectedRoom('');
      return;
    }
    onCheckIn(roomId, guestName, checkInDate, checkOutDate);
    onClose();
  };

  const handleCheckInChange = (date) => {
    if (!date) return;
    const next = toStr(date);
    setCheckInDate(next);
    if (checkOutDate <= next) setCheckOutDate(toStr(new Date(date.getTime() + 86400000)));
  };

  const nights = Math.max(1, Math.round((toDate(checkOutDate) - toDate(checkInDate)) / 86400000) || 1);

  return (
    <div className="apple-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`apple-ui apple-sheet apple-sheet--${mode}`} style={{ maxWidth: 1080 }} role="dialog" aria-modal="true" aria-label={guestMode ? 'Guest check-in' : `Check in room ${roomId}`}>
        <div className="flex items-start justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="apple-title">{guestMode ? 'Guest Check-In' : `Check In · Room ${roomId}`}</h2>
            <p className="apple-subtitle">{guestMode ? 'Register an arriving guest and assign a room.' : 'Register the guest arriving in this room.'}</p>
          </div>
          <button type="button" className="apple-close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>

        <form id="room-check-in-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 pt-2 pb-4 space-y-6" style={{ overflowX: 'hidden' }}>
          <div>
            <p className="apple-section-title">Guest</p>
            <Group mode={mode}>
              <Row label="Full name">
                <input className="apple-field" type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Required" autoComplete="off" autoFocus required />
              </Row>
              {guestMode && (
                <Row label="Phone">
                  <input className="apple-field" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" autoComplete="off" />
                </Row>
              )}
            </Group>
          </div>

          <div>
            <p className="apple-section-title">Stay</p>
            <Group mode={mode}>
              {guestMode && (
                <Row label="Room">
                  <select className="apple-field" value={selectedRoom} onChange={(e) => setSelectedRoom(e.target.value)} required>
                    <option value="">Choose…</option>
                    {availableRooms.map(r => <option key={r.id} value={r.id}>Room {r.room_number}</option>)}
                  </select>
                </Row>
              )}
              <Row label="Check-in">
                <DatePicker selected={toDate(checkInDate)} onChange={handleCheckInChange} className="apple-field" calendarClassName={isDarkMode ? 'apple-datepicker-dark' : undefined} dateFormat="EEE, d MMM yyyy" popperPlacement="bottom-end" />
              </Row>
              <Row label="Check-out">
                <DatePicker selected={toDate(checkOutDate)} onChange={(date) => date && setCheckOutDate(toStr(date))} className="apple-field" calendarClassName={isDarkMode ? 'apple-datepicker-dark' : undefined} dateFormat="EEE, d MMM yyyy" popperPlacement="bottom-end" minDate={new Date(toDate(checkInDate).getTime() + 86400000)} />
              </Row>
            </Group>
            <p className="apple-footnote">{nights} night{nights !== 1 ? 's' : ''}</p>
          </div>
        </form>

<div className="px-5 pb-5 pt-2 apple-footer">
          <button type="button" className="apple-btn apple-btn--secondary" onClick={onClose}>Cancel</button><button type="submit" form="room-check-in-form" className="apple-btn apple-btn--primary">Check In</button>
        </div>
      </div>
    </div>
  );
};

export default OfflineCheckInModal;
