import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SyncStatus from './SyncStatus';
import { resetStateForTests, setState } from '../offline/state';

const mockList = jest.fn();
const mockRetry = jest.fn();
const mockDiscard = jest.fn();
const mockApplyUpdate = jest.fn();

jest.mock('../offline', () => {
  const state = require('../offline/state');
  return {
    getOfflineState: state.getState,
    subscribeOffline: state.subscribe,
    listNeedsAttention: (...a) => mockList(...a),
    retryEntry: (...a) => mockRetry(...a),
    discardEntry: (...a) => mockDiscard(...a)
  };
});
jest.mock('../offline/registerSW', () => ({ applyUpdate: () => mockApplyUpdate() }));

const entry = { id: 'e1', kind: 'rest', method: 'POST', table: 'reservations', createdAt: '2026-10-18T10:00:00Z', error: 'Another booking took this room for those dates while you were offline.' };

describe('SyncStatus', () => {
  beforeEach(() => {
    resetStateForTests();
    [mockList, mockRetry, mockDiscard, mockApplyUpdate].forEach((m) => m.mockReset());
    mockList.mockResolvedValue([entry]);
    window.confirm = jest.fn(() => true);
  });

  it('shows nothing when everything is normal', () => {
    const { container } = render(<SyncStatus />);
    expect(container).toBeEmptyDOMElement();
  });

  it('tells the user they are offline and how many changes are saved on the device', () => {
    render(<SyncStatus />);
    act(() => setState({ forcedOffline: true, queued: 3 }));
    expect(screen.getByRole('status')).toHaveTextContent('Offline: 3 changes saved on this device');
    act(() => setState({ queued: 0 }));
    expect(screen.getByRole('status')).toHaveTextContent(/you can keep working/i);
  });

  it('shows syncing, then a short "all synced" confirmation', async () => {
    render(<SyncStatus />);
    act(() => setState({ queued: 2, syncing: true }));
    expect(screen.getByRole('status')).toHaveTextContent('Syncing 2 changes');
    act(() => setState({ queued: 0, syncing: false, lastSyncAt: Date.now() }));
    expect(screen.getByRole('status')).toHaveTextContent('All changes synced');
  });

  it('warns when queued changes cannot upload until the user signs in again', () => {
    render(<SyncStatus />);
    act(() => setState({ queued: 2, authRequired: true }));
    expect(screen.getByRole('status')).toHaveTextContent('Sign in again to upload 2 waiting changes');
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });

  it('lists rejected changes with the reason and lets the user retry or discard', async () => {
    render(<SyncStatus />);
    act(() => setState({ needsAttention: 1 }));
    expect(screen.getByRole('status')).toHaveTextContent('1 change need attention');

    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    expect(await screen.findByText('Add to reservations')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveTextContent(/another booking took this room/i);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(mockRetry).toHaveBeenCalledWith('e1'));

    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(mockDiscard).toHaveBeenCalledWith('e1'));
  });

  it('offers a reload when a new version is waiting', () => {
    render(<SyncStatus />);
    act(() => setState({ updateAvailable: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(mockApplyUpdate).toHaveBeenCalled();
  });
});
