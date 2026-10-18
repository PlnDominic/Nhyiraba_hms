import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChangePasswordPage from './ChangePasswordPage';

const mockNavigate = jest.fn();
const mockSetCurrentUser = jest.fn();
const mockUpdateUser = jest.fn();
const mockProfileUpdate = jest.fn();

// react-router-dom is not resolvable by Jest in this project (see App.test.js), so stub it
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('react-hot-toast', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../context/UserContext', () => ({
  useUser: () => ({ user: { id: 'u1', email: 'ama.boateng@hotel.com', passwordChangeRequired: true }, setCurrentUser: mockSetCurrentUser })
}));
jest.mock('../supabaseClient', () => ({
  __esModule: true,
  default: {
    auth: { updateUser: (...a) => mockUpdateUser(...a) },
    from: () => ({ update: (row) => ({ eq: (col, val) => { mockProfileUpdate(row, col, val); return Promise.resolve({ error: null }); } }) })
  }
}));

const fill = (password, confirm = password) => {
  fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: confirm } });
  fireEvent.click(screen.getByRole('button', { name: /save password/i }));
};

describe('ChangePasswordPage (temporary password replacement)', () => {
  beforeEach(() => {
    [mockNavigate, mockSetCurrentUser, mockUpdateUser, mockProfileUpdate].forEach((m) => m.mockReset());
    mockUpdateUser.mockResolvedValue({ error: null });
  });

  it('explains why it is shown and rejects weak or mismatched passwords without calling the server', async () => {
    render(<ChangePasswordPage />);
    expect(screen.getByText(/signed in with a temporary password/i)).toBeInTheDocument();

    fill('short');
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least 10 characters/i);

    fill('Tr1cky-Kettle-77', 'Tr1cky-Kettle-78');
    expect(await screen.findByRole('alert')).toHaveTextContent(/do not match/i);

    fill('Ama.Boateng2026!x');
    expect(await screen.findByRole('alert')).toHaveTextContent(/email name/i);

    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it('sets the password, clears the forced-change flag and unlocks the app', async () => {
    render(<ChangePasswordPage />);
    fill('Tr1cky-Kettle-77');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true }));
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'Tr1cky-Kettle-77' });
    expect(mockProfileUpdate).toHaveBeenCalledWith({ password_change_required: false }, 'user_id', 'u1');
    expect(mockSetCurrentUser).toHaveBeenCalledWith(expect.objectContaining({ passwordChangeRequired: false }));
  });

  it('does not unlock the app when the server rejects the new password', async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: 'New password should be different from the old password.' } });
    render(<ChangePasswordPage />);
    fill('Tr1cky-Kettle-77');
    expect(await screen.findByRole('alert')).toHaveTextContent(/different from the old password/i);
    expect(mockProfileUpdate).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
