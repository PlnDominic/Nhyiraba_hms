import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CheckInModal from './CheckInModal';

jest.mock('../supabaseClient', () => ({ __esModule: true, default: {} }));
const mockSms = jest.fn();
jest.mock('../services/smsService', () => ({ sendSmsNotification: (...a) => mockSms(...a) }));
jest.mock('./DuplicateGuestHint', () => () => null);
jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../context/RoomReservationContext', () => ({
  useRoomReservation: () => ({
    rooms: [
      { id: 1, room_number: 101, status: 'Available', price: 200, type: 'Standard', housekeeping_status: 'Clean' },
      { id: 2, room_number: 102, status: 'Available', price: 200, type: 'Standard', housekeeping_status: 'Dirty' }
    ]
  })
}));

const next = () => fireEvent.click(screen.getByRole('button', { name: /continue|complete check-in/i }));

describe('CheckInModal (walk-in check-in validation, #7)', () => {
  it('requires a contact detail before leaving the guest step', () => {
    render(<CheckInModal isOpen onClose={() => {}} onAddGuest={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Enter guest name'), { target: { value: 'Ama Boateng' } });
    next();
    expect(screen.getByText('Enter a phone number or email address')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Guest details' })).toBeInTheDocument();
  });

  it('goes guest -> room & dates -> review and checks the guest in', async () => {
    const onAddGuest = jest.fn(() => Promise.resolve({ success: true }));
    const onClose = jest.fn();
    render(<CheckInModal isOpen onClose={onClose} onAddGuest={onAddGuest} />);

    fireEvent.change(screen.getByPlaceholderText('Enter guest name'), { target: { value: 'Ama Boateng' } });
    fireEvent.change(screen.getByPlaceholderText('Enter phone number'), { target: { value: '0241234567' } });
    next(); // -> Room & dates (room 101 preselected)
    next(); // -> Review (no verification step)
    expect(screen.getByRole('heading', { name: /review/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Verification' })).not.toBeInTheDocument();

    next(); // Complete check-in
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onAddGuest).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ama Boateng', phone: '0241234567', room: 1 }));
    expect(mockSms).toHaveBeenCalledWith('checked_in', '0241234567', expect.objectContaining({ guestName: 'Ama Boateng', roomNumber: 101 }));
  });

  it('sends no confirmation when the guest could not be saved', async () => {
    const onAddGuest = jest.fn(() => Promise.resolve({ success: false, error: 'db' }));
    const onClose = jest.fn();
    render(<CheckInModal isOpen onClose={onClose} onAddGuest={onAddGuest} />);
    fireEvent.change(screen.getByPlaceholderText('Enter guest name'), { target: { value: 'Ama' } });
    fireEvent.change(screen.getByPlaceholderText('Enter phone number'), { target: { value: '0241234567' } });
    next(); next(); next();
    await waitFor(() => expect(onAddGuest).toHaveBeenCalled());
    expect(mockSms).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
