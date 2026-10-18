import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CheckInModal from './CheckInModal';

jest.mock('../supabaseClient', () => ({ __esModule: true, default: {} }));
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
const mockSaveRecord = jest.fn(() => Promise.resolve({ error: null }));
jest.mock('../services/operationsService', () => ({
  ...jest.requireActual('../services/operationsService'),
  saveCheckInRecord: (...args) => mockSaveRecord(...args)
}));

const next = () => fireEvent.click(screen.getByRole('button', { name: /continue|complete check-in/i }));

describe('CheckInModal (walk-in check-in validation, #7)', () => {
  beforeEach(() => mockSaveRecord.mockResolvedValue({ error: null })); // CRA resets mocks between tests

  it('requires a contact detail before leaving the guest step', () => {
    render(<CheckInModal isOpen onClose={() => {}} onAddGuest={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Enter full name'), { target: { value: 'Ama Boateng' } });
    next();
    expect(screen.getByText('Enter a phone number or email address')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Guest details' })).toBeInTheDocument();
  });

  it('blocks check-in until ID, payment and policy acknowledgement are given, then saves the record', async () => {
    const onAddGuest = jest.fn(() => Promise.resolve({ success: true }));
    const onClose = jest.fn();
    render(<CheckInModal isOpen onClose={onClose} onAddGuest={onAddGuest} />);

    fireEvent.change(screen.getByPlaceholderText('Enter full name'), { target: { value: 'Ama Boateng' } });
    fireEvent.change(screen.getByPlaceholderText('Enter phone number'), { target: { value: '0241234567' } });
    next(); // -> Room & dates (room 101 preselected, Clean)
    next(); // -> Verification
    expect(screen.getByRole('heading', { name: 'Verification' })).toBeInTheDocument();

    next(); // nothing filled in
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/identity/i);
    expect(alert).toHaveTextContent(/payment/i);
    expect(alert).toHaveTextContent(/acknowledge/i);
    expect(onAddGuest).not.toHaveBeenCalled();

    fireEvent.change(screen.getByPlaceholderText('e.g. GHA-123456789-0'), { target: { value: 'GHA-7' } });
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '150' } });
    fireEvent.click(screen.getByLabelText(/acknowledges the hotel policies/i));
    next(); // -> Review
    expect(screen.getByRole('heading', { name: /review/i })).toBeInTheDocument();

    next(); // Complete check-in
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onAddGuest).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ama Boateng', phone: '0241234567', room: 1 }));
    expect(mockSaveRecord).toHaveBeenCalledWith(expect.objectContaining({
      form: expect.objectContaining({ idNumber: 'GHA-7', depositAmount: '150', policyAcknowledged: true })
    }));
  });

  it('refuses a room that housekeeping has not cleaned', () => {
    render(<CheckInModal isOpen onClose={() => {}} onAddGuest={jest.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Enter full name'), { target: { value: 'Kojo' } });
    fireEvent.change(screen.getByPlaceholderText('Enter phone number'), { target: { value: '0241234567' } });
    next();
    fireEvent.click(screen.getByText('Room 102'));
    next();
    fireEvent.change(screen.getByPlaceholderText('e.g. GHA-123456789-0'), { target: { value: 'X1' } });
    fireEvent.click(screen.getByLabelText(/payment confirmed/i));
    fireEvent.click(screen.getByLabelText(/acknowledges the hotel policies/i));
    next();
    expect(screen.getByRole('alert')).toHaveTextContent(/Room 102 is marked "Dirty"/);
  });
});
