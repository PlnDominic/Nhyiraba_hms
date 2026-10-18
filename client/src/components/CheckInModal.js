import React, { useState, useEffect, useCallback } from 'react';
import 'react-datepicker/dist/react-datepicker.css';
import { useTheme } from '../context/ThemeContext';
import { useRoomReservation } from '../context/RoomReservationContext';
import DatePicker from 'react-datepicker';
import '../styles/AppleModal.css';
import { Group, Row, CloseIcon } from './ui/AppleForm';

const CheckInModal = ({ isOpen, onClose, onAddGuest }) => {
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';
    const { rooms } = useRoomReservation();
    
    // Filter available rooms for selection - memoize this calculation
    const availableRooms = React.useMemo(() => 
        rooms.filter(room => room.status === 'Available'), 
        [rooms]
    );
    
    // Initial form state - use as a reference instead of re-creating each time
    const initialFormState = {
        fullName: '',
        phone: '',
        gender: '',
        room: availableRooms.length > 0 ? availableRooms[0].id : '',
        checkIn: new Date(),
        checkOut: new Date(new Date().setDate(new Date().getDate() + 1)),
    };
    
    const [guestInfo, setGuestInfo] = useState(initialFormState);
    const [errors, setErrors] = useState({});

    // Reset form when modal opens - use useCallback to memoize this function
    useEffect(() => {
        if (isOpen) {
            setGuestInfo({
                ...initialFormState,
                room: availableRooms.length > 0 ? availableRooms[0].id : '',
            });
            setErrors({});
        }
    }, [isOpen, availableRooms]);

    // Memoize these handlers to prevent recreating them on each render
    const handleChange = useCallback((e) => {
        const { name, value } = e.target;
        setGuestInfo(prev => ({ ...prev, [name]: value }));
    }, []);

    const handleDateChange = useCallback((field, date) => {
        setGuestInfo(prev => {
            if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
                return prev;
            }
            if (field === 'checkIn') {
                const nextCheckOut = prev.checkOut && prev.checkOut > date
                    ? prev.checkOut
                    : new Date(date.getTime() + 86400000);
                return { ...prev, checkIn: date, checkOut: nextCheckOut };
            }
            if (field === 'checkOut') {
                return { ...prev, checkOut: date };
            }
            return { ...prev, [field]: date };
        });
    }, []);

    const validate = useCallback(() => {
        const newErrors = {};
        if (!guestInfo.fullName || !guestInfo.fullName.trim()) newErrors.fullName = 'Full Name is required';
        if (!guestInfo.room) newErrors.room = 'Room is required';
        if (!guestInfo.checkIn) newErrors.checkIn = 'Check In is required';
        if (!guestInfo.checkOut) {
            newErrors.checkOut = 'Check Out is required';
        } else if (guestInfo.checkOut <= guestInfo.checkIn) {
            newErrors.checkOut = 'Check Out must be after Check In';
        }
        return newErrors;
    }, [guestInfo]);

    const handleCompleteCheckIn = useCallback(async () => {
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
        } else {
            try {
                const trimmedName = guestInfo.fullName.trim();
                const nameParts = trimmedName.split(' ').filter(Boolean);
                const firstName = nameParts.shift() || '';
                const lastName = nameParts.join(' ');

                const nights = Math.max(1, Math.ceil((guestInfo.checkOut - guestInfo.checkIn) / 86400000));

                const newGuest = {
                    name: trimmedName,
                    fullName: trimmedName,
                    firstName,
                    lastName,
                    phone: guestInfo.phone,
                    gender: guestInfo.gender,
                    room: guestInfo.room,
                    checkIn: guestInfo.checkIn,
                    checkInDate: guestInfo.checkIn,
                    checkOut: guestInfo.checkOut,
                    checkOutDate: guestInfo.checkOut,
                    nights,
                    status: 'Checked In'
                };
                
                console.log('Submitting guest data:', newGuest);
                await onAddGuest(newGuest);
                onClose(); // Close the modal after adding the guest
            } catch (error) {
                console.error('Error adding guest:', error);
            }
        }
    }, [guestInfo, validate, onAddGuest, onClose]);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const mode = isDarkMode ? 'dark' : 'light';
    const muted = isDarkMode ? 'text-[#ebebf5]/60' : 'text-[#3c3c43]/60';
    const nights = Math.max(1, Math.ceil((guestInfo.checkOut - guestInfo.checkIn) / 86400000) || 1);

    const roomLabel = (room) => {
        const normalizedBlock = (room.block || '').toLowerCase();
        const isAquariumBlock = normalizedBlock.includes('aquarium') || normalizedBlock.includes('aquarian');
        const parsedPrice = Number(room.price);
        const hasValidPrice = Number.isFinite(parsedPrice) && parsedPrice > 0;
        const priceValue = hasValidPrice ? parsedPrice : (isAquariumBlock ? 500 : 0);
        const base = isAquariumBlock ? `Room ${room.room_number} · Aquarium block` : `Room ${room.room_number}`;
        return priceValue ? `${base} · ₵${priceValue}` : base;
    };

    return (
        <div className="apple-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className={`apple-ui apple-sheet apple-sheet--${mode}`} style={{ maxWidth: 1240 }} role="dialog" aria-modal="true" aria-label="Guest Check-In">
                <div className="flex items-start justify-between px-5 pt-5 pb-3">
                  <div>
                    <h2 className="apple-title">Guest Check-In</h2>
                    <p className="apple-subtitle">Register an arriving guest and assign a room.</p>
                  </div>
                  <button type="button" className="apple-close" onClick={onClose} aria-label="Close"><CloseIcon /></button>
                </div>

                <form className="flex-1 overflow-y-auto px-5 pt-2 pb-4 space-y-6" style={{ overflowX: 'hidden' }} onSubmit={(e) => { e.preventDefault(); handleCompleteCheckIn(); }}>
                    <div>
                        <p className="apple-section-title">Guest</p>
                        <Group mode={mode}>
                            <Row label="Full name" error={errors.fullName}>
                                <input className="apple-field" type="text" name="fullName" value={guestInfo.fullName} onChange={handleChange} placeholder="Required" autoComplete="off" autoFocus />
                            </Row>
                            <Row label="Phone">
                                <input className="apple-field" type="tel" name="phone" value={guestInfo.phone} onChange={handleChange} placeholder="Optional" autoComplete="off" />
                            </Row>
                            <Row label="Gender">
                                <select className="apple-field" name="gender" value={guestInfo.gender} onChange={handleChange}>
                                    <option value="">Not specified</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Other">Other</option>
                                </select>
                            </Row>
                        </Group>
                        {errors.fullName && <p className="apple-error">{errors.fullName}</p>}
                    </div>

                    <div>
                        <p className="apple-section-title">Stay</p>
                        <Group mode={mode}>
                            <Row label="Room" error={errors.room}>
                                <select className="apple-field" name="room" value={guestInfo.room} onChange={handleChange}>
                                    <option value="">Choose…</option>
                                    {availableRooms.map((room) => (
                                        <option key={room.id} value={room.id}>{roomLabel(room)}</option>
                                    ))}
                                </select>
                            </Row>
                            <Row label="Check-in" error={errors.checkIn}>
                                <DatePicker
                                    selected={guestInfo.checkIn}
                                    onChange={(date) => handleDateChange('checkIn', date)}
                                    className="apple-field"
                                    calendarClassName={isDarkMode ? 'apple-datepicker-dark' : undefined}
                                    dateFormat="EEE, d MMM yyyy"
                                    popperPlacement="bottom-end"
                                />
                            </Row>
                            <Row label="Check-out" error={errors.checkOut}>
                                <DatePicker
                                    selected={guestInfo.checkOut}
                                    onChange={(date) => handleDateChange('checkOut', date)}
                                    className="apple-field"
                                    calendarClassName={isDarkMode ? 'apple-datepicker-dark' : undefined}
                                    dateFormat="EEE, d MMM yyyy"
                                    popperPlacement="bottom-end"
                                    minDate={new Date(guestInfo.checkIn.getTime() + 86400000)}
                                />
                            </Row>
                        </Group>
                        {errors.room && <p className="apple-error">{errors.room}</p>}
                        {errors.checkIn && <p className="apple-error">{errors.checkIn}</p>}
                        {errors.checkOut && <p className="apple-error">{errors.checkOut}</p>}
                        {availableRooms.length === 0
                            ? <p className="apple-error" style={{ color: '#ff9500' }}>No rooms available currently</p>
                            : <p className={`apple-footnote ${muted}`}>{nights} night{nights !== 1 ? 's' : ''}</p>}
                    </div>
                </form>

<div className="px-5 pb-5 pt-2 apple-footer">
                  <button type="button" className="apple-btn apple-btn--secondary" onClick={onClose}>Cancel</button><button type="button" className="apple-btn apple-btn--primary" onClick={handleCompleteCheckIn}>
                        Complete Check-In
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CheckInModal;
