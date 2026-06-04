import React, { useState, useEffect, useCallback } from 'react';
import 'react-datepicker/dist/react-datepicker.css';
import { useTheme } from '../context/ThemeContext';
import { useRoomReservation } from '../context/RoomReservationContext';
import DatePickerWrapper from './ui/DatePickerWrapper';

const CheckInModal = ({ isOpen, onClose, onAddGuest }) => {
    const { theme } = useTheme();
    const isDarkMode = theme === 'dark';
    const { rooms } = useRoomReservation();
    
    const availableRooms = React.useMemo(() => 
        rooms.filter(room => room.status === 'Available'), 
        [rooms]
    );
    
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

    useEffect(() => {
        if (isOpen) {
            setGuestInfo({
                ...initialFormState,
                room: availableRooms.length > 0 ? availableRooms[0].id : '',
            });
            setErrors({});
        }
    }, [isOpen, availableRooms]);

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
                onClose();
            } catch (error) {
                console.error('Error adding guest:', error);
            }
        }
    }, [guestInfo, validate, onAddGuest, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-lg transform transition-all duration-300 ease-in-out scale-100 hover:scale-105`}>
                <div className={`border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} p-4 flex justify-between items-center`}>
                    <h2 className={`text-2xl font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>Guest Check-In</h2>
                    <button onClick={onClose} className={`${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`}>
                        <i className="fas fa-times fa-lg"></i>
                    </button>
                </div>
                <form className="p-6 space-y-6">
                    <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>GUEST INFO</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Full Name</label>
                            <input type="text" name="fullName" value={guestInfo.fullName} onChange={handleChange} className={`mt-1 block w-full border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-black'} rounded-md shadow-sm p-2 focus:ring focus:ring-blue-300`}/>
                            {errors.fullName && <p className="text-red-500 text-xs italic">{errors.fullName}</p>}
                        </div>
                        <div>
                            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Phone (optional)</label>
                            <input type="tel" name="phone" value={guestInfo.phone} onChange={handleChange} className={`mt-1 block w-full border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-black'} rounded-md shadow-sm p-2 focus:ring focus:ring-blue-300`}/>
                        </div>
                        <div>
                            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Gender</label>
                            <select name="gender" value={guestInfo.gender} onChange={handleChange} className={`mt-1 block w-full border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-black'} rounded-md shadow-sm p-2 focus:ring focus:ring-blue-300`}>
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>
                    </div>
                    <h3 className={`text-lg font-semibold ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>BOOKING DETAILS</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Room</label>
                            <select name="room" value={guestInfo.room} onChange={handleChange} className={`mt-1 block w-full border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-black'} rounded-md shadow-sm p-2 focus:ring focus:ring-blue-300`}>
                                <option value="">Select Room</option>
                                {availableRooms.map((room) => {
                                    const normalizedBlock = (room.block || '').toLowerCase();
                                    const isAquariumBlock = normalizedBlock.includes('aquarium') || normalizedBlock.includes('aquarian');
                                    const blockLabel = isAquariumBlock ? 'Aquarium block' : null;
                                    const parsedPrice = Number(room.price);
                                    const hasValidPrice = Number.isFinite(parsedPrice) && parsedPrice > 0;
                                    const priceValue = hasValidPrice ? parsedPrice : (isAquariumBlock ? 500 : 0);
                                    const displayLabel = blockLabel
                                        ? `Room ${room.room_number} - ${blockLabel}`
                                        : `Room ${room.room_number}`;
                                    const priceLabel = priceValue ? ` (${priceValue}gh)` : '';

                                    return (
                                        <option key={room.id} value={room.id}>
                                            {displayLabel}{priceLabel}
                                        </option>
                                    );
                                })}
                            </select>
                            {errors.room && <p className="text-red-500 text-xs italic">{errors.room}</p>}
                            {availableRooms.length === 0 && <p className="text-yellow-500 text-xs italic">No rooms available currently</p>}
                        </div>
                        <div>
                            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Check In Date</label>
                            <DatePickerWrapper
                                selected={guestInfo.checkIn}
                                onChange={(date) => handleDateChange('checkIn', date)}
                                className={`mt-1 block w-full border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-black'} rounded-md shadow-sm p-2 focus:ring focus:ring-blue-300`}
                                wrapperClassName="w-full"
                                shouldCloseOnSelect={true}
                                fixedHeight={true}
                                dateFormat="MM/dd/yyyy"
                                isDarkMode={isDarkMode}
                                field="checkIn"
                                error={errors.checkIn}
                            />
                        </div>
                        <div>
                            <label className={`block text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>Check Out Date</label>
                            <DatePickerWrapper
                                selected={guestInfo.checkOut}
                                onChange={(date) => handleDateChange('checkOut', date)}
                                className={`mt-1 block w-full border ${isDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300 text-black'} rounded-md shadow-sm p-2 focus:ring focus:ring-blue-300`}
                                wrapperClassName="w-full"
                                shouldCloseOnSelect={true}
                                fixedHeight={true}
                                dateFormat="MM/dd/yyyy"
                                minDate={new Date(guestInfo.checkIn.getTime() + 86400000)}
                                isDarkMode={isDarkMode}
                                field="checkOut"
                                error={errors.checkOut}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end space-x-2">
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className={`px-4 py-2 rounded ${isDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
                        >
                            Cancel
                        </button>
                        <button 
                            type="button" 
                            onClick={handleCompleteCheckIn} 
                            className={`px-4 py-2 rounded bg-blue-500 hover:bg-blue-600 text-white`}
                        >
                            Complete Check-In
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CheckInModal;
