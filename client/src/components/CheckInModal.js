import React, { useState, useEffect, useCallback } from 'react';
import 'react-datepicker/dist/react-datepicker.css';
import { useTheme } from '../context/ThemeContext';
import { useRoomReservation } from '../context/RoomReservationContext';
import { StepModal, Step, Field, RoomCards, DateInput, ReviewList } from './ui/StepModal';
import DuplicateGuestHint from './DuplicateGuestHint';
import { sendSmsNotification } from '../services/smsService';

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
    const [step, setStep] = useState(0);
    const [email, setEmail] = useState('');

    // Reset form when modal opens - use useCallback to memoize this function
    useEffect(() => {
        if (isOpen) {
            setGuestInfo({
                ...initialFormState,
                room: availableRooms.length > 0 ? availableRooms[0].id : '',
            });
            setErrors({});
            setStep(0);
            setEmail('');
        }
    }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
        if (!guestInfo.fullName || !guestInfo.fullName.trim()) newErrors.fullName = 'Enter the guest\'s name';
        if (!String(guestInfo.phone || '').trim() && !String(email || '').trim()) newErrors.phone = 'Enter a phone number or email address';
        if (!guestInfo.room) newErrors.room = 'Room is required';
        if (!guestInfo.checkIn) newErrors.checkIn = 'Check In is required';
        if (!guestInfo.checkOut) {
            newErrors.checkOut = 'Check Out is required';
        } else if (guestInfo.checkOut <= guestInfo.checkIn) {
            newErrors.checkOut = 'Check Out must be after Check In';
        }
        return newErrors;
    }, [guestInfo, email]);

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
                    email: email,
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
                const result = await onAddGuest(newGuest);
                if (result?.success === false) return; // not saved: no confirmation, keep the modal open
                const room = rooms.find(r => String(r.id) === String(guestInfo.room));
                sendSmsNotification('checked_in', guestInfo.phone, {
                    guestName: trimmedName,
                    roomNumber: room?.room_number || guestInfo.room,
                    checkInDate: guestInfo.checkIn,
                    checkOutDate: guestInfo.checkOut
                });
                onClose(); // Close the modal after adding the guest
            } catch (error) {
                console.error('Error adding guest:', error);
            }
        }
    }, [guestInfo, email, validate, onAddGuest, onClose, rooms]);

    const money = (n) => `₵${Number(n).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
    const priceOf = (room) => {
        const normalizedBlock = (room.block || '').toLowerCase();
        const isAquariumBlock = normalizedBlock.includes('aquarium') || normalizedBlock.includes('aquarian');
        const parsedPrice = Number(room.price);
        return Number.isFinite(parsedPrice) && parsedPrice > 0 ? parsedPrice : (isAquariumBlock ? 500 : 0);
    };
    const blockOf = (room) => {
        const normalizedBlock = (room.block || '').toLowerCase();
        return normalizedBlock.includes('aquarium') || normalizedBlock.includes('aquarian') ? 'Aquarium block' : (room.type || room.block || 'Room');
    };

    const selectedRoom = availableRooms.find(r => String(r.id) === String(guestInfo.room));
    const nights = Math.max(1, Math.ceil((guestInfo.checkOut - guestInfo.checkIn) / 86400000) || 1);
    const fmt = (d) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

    const goNext = () => {
        const all = validate();
        const keys = step === 0 ? ['fullName', 'phone'] : ['room', 'checkIn', 'checkOut'];
        const stepErrors = {};
        keys.forEach(k => { if (all[k]) stepErrors[k] = all[k]; });
        setErrors(stepErrors);
        if (Object.keys(stepErrors).length === 0) setStep(step + 1);
    };

    const renderStep = () => {
        if (step === 0) {
            return (
                <Step title="Guest details" lead="Register the arriving guest.">
                    <div className="sm-grid">
                        <Field label="Name (first name is enough)" error={errors.fullName} span>
                            <input className="sm-input" type="text" name="fullName" value={guestInfo.fullName} onChange={handleChange} placeholder="Enter guest name" autoComplete="off" autoFocus />
                        </Field>
                        <Field label="Phone" error={errors.phone}>
                            <input className="sm-input" type="tel" name="phone" value={guestInfo.phone} onChange={handleChange} placeholder="Enter phone number" autoComplete="off" />
                        </Field>
                        <Field label="Email (optional)">
                            <input className="sm-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoComplete="off" />
                        </Field>
                        <Field label="Gender">
                            <select className="sm-select" name="gender" value={guestInfo.gender} onChange={handleChange}>
                                <option value="">Not specified</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </Field>
                        <div className="sm-span">
                            <DuplicateGuestHint name={guestInfo.fullName} phone={guestInfo.phone} email={email} />
                        </div>
                    </div>
                </Step>
            );
        }
        if (step === 1) {
            return (
                <Step title="Room & dates" lead="Pick an available room for this stay.">
                    {errors.room && <p className="sm-error" style={{ marginBottom: 12 }}>{errors.room}</p>}
                    <RoomCards
                        rooms={rooms}
                        selectedId={guestInfo.room}
                        onSelect={(id) => handleChange({ target: { name: 'room', value: id } })}
                        label={(room) => `Room ${room.room_number}`}
                        meta={blockOf}
                        price={priceOf}
                    />
                    <div className="sm-grid">
                        <Field label="Check-in" error={errors.checkIn}>
                            <DateInput selected={guestInfo.checkIn} onChange={(date) => handleDateChange('checkIn', date)} />
                        </Field>
                        <Field label="Check-out" error={errors.checkOut}>
                            <DateInput selected={guestInfo.checkOut} onChange={(date) => handleDateChange('checkOut', date)} minDate={new Date(guestInfo.checkIn.getTime() + 86400000)} />
                        </Field>
                    </div>
                </Step>
            );
        }
        return (
            <Step title="Review & check in" lead="Confirm the details before checking the guest in.">
                <ReviewList rows={[
                    ['Guest', guestInfo.fullName],
                    ['Phone', guestInfo.phone || '—'],
                    ['Gender', guestInfo.gender || 'Not specified'],
                    ['Room', selectedRoom ? `Room ${selectedRoom.room_number}` : '—'],
                    ['Dates', `${fmt(guestInfo.checkIn)} – ${fmt(guestInfo.checkOut)} (${nights} night${nights !== 1 ? 's' : ''})`]
                ]} />
            </Step>
        );
    };

    const lastStep = step === 2;

    return (
        <StepModal
            isOpen={isOpen}
            onClose={onClose}
            isDarkMode={isDarkMode}
            title="Guest check-in"
            steps={['Guest', 'Room & dates', 'Review']}
            current={step}
            recap={[
                guestInfo.fullName.trim() && { label: 'Guest', value: guestInfo.fullName.trim() },
                selectedRoom && { label: 'Room', value: `Room ${selectedRoom.room_number}` }
            ].filter(Boolean)}
            total={selectedRoom && priceOf(selectedRoom) ? { label: `${nights} night${nights !== 1 ? 's' : ''} · Total`, value: money(priceOf(selectedRoom) * nights) } : null}
            onBack={() => setStep(Math.max(0, step - 1))}
            onNext={lastStep ? handleCompleteCheckIn : goNext}
            nextLabel={lastStep ? 'Complete check-in' : 'Continue'}
            finalStep={lastStep}
        >
            {renderStep()}
        </StepModal>
    );
};

export default CheckInModal;
