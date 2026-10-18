import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CheckoutSettlementModal from './CheckoutSettlementModal';

jest.mock('../context/ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));
jest.mock('../supabaseClient', () => {
  const query = (data) => {
    const q = { select: () => q, eq: () => q, order: () => q, limit: () => Promise.resolve({ data }), maybeSingle: () => Promise.resolve({ data: data[0] }) };
    return q;
  };
  return {
    __esModule: true,
    default: {
      from: (table) => (table === 'rooms'
        ? query([{ id: 7, room_number: 12, price: 200, housekeeping_status: 'Clean' }])
        : query([{ name: 'Ama Boateng', room: '7', status: 'Checked In', check_in: new Date(Date.now() - 2 * 86400000 + 3600000).toISOString() }]))
    }
  };
});
const mocks = {
  load: jest.fn(), save: jest.fn(), settle: jest.fn(), hk: jest.fn(), record: jest.fn()
};
jest.mock('../services/operationsService', () => ({
  ...jest.requireActual('../services/operationsService'),
  loadRoomCharges: (...a) => mocks.load(...a),
  saveCheckoutSettlement: (...a) => mocks.save(...a),
  markRoomChargesSettled: (...a) => mocks.settle(...a),
  setHousekeepingStatus: (...a) => mocks.hk(...a),
  getLatestCheckInRecord: (...a) => mocks.record(...a)
}));

describe('CheckoutSettlementModal (#8)', () => {
  beforeEach(() => {
    mocks.load.mockResolvedValue([
      { key: 'order:o1', source: 'restaurant', sourceId: 'o1', description: 'Room service (11/10/2026)', amount: 80 },
      { key: 'service:5', source: 'service', sourceId: 5, description: 'Laundry', amount: 20 }
    ]);
    mocks.save.mockResolvedValue({ error: null });
    mocks.settle.mockResolvedValue({ error: null });
    mocks.hk.mockResolvedValue({ error: null });
    mocks.record.mockResolvedValue({ data: { deposit_amount: 100 } });
  });

  it('adds room charges to the folio, lets staff exclude one, and requires a zero balance', async () => {
    const onSettled = jest.fn();
    render(<CheckoutSettlementModal roomId={7} onCancel={() => {}} onSettled={onSettled} />);
    await screen.findByText('Laundry');

    // 2 nights x 200 + 80 + 20 = 500, minus 100 deposit
    expect(screen.getByText('Total due').nextSibling).toHaveTextContent('GH₵500.00');
    expect(screen.getByText('Balance').nextSibling).toHaveTextContent('GH₵400.00');

    fireEvent.click(screen.getByLabelText(/include laundry/i)); // already paid in cash, say
    expect(screen.getByText('Balance').nextSibling).toHaveTextContent('GH₵380.00');

    fireEvent.click(screen.getByRole('button', { name: /settle & check out/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/outstanding balance of GH₵380.00/i);
    expect(mocks.save).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Payment received'), { target: { value: '380' } });
    fireEvent.click(screen.getByRole('button', { name: /settle & check out/i }));
    await waitFor(() => expect(onSettled).toHaveBeenCalled());

    const saved = mocks.save.mock.calls[0][0];
    expect(saved).toMatchObject({ nights: 2, room_total: 400, extras_total: 80, total_due: 480, deposit_paid: 100, payment_received: 380, balance: 0 });
    expect(saved.extras).toEqual([expect.objectContaining({ source: 'restaurant', source_id: 'o1', amount: 80 })]);
    expect(mocks.settle).toHaveBeenCalledWith([expect.objectContaining({ sourceId: 'o1' })]); // only the included order is marked paid
    expect(mocks.hk).toHaveBeenCalledWith(expect.objectContaining({ id: 7 }), 'Dirty', 'Guest checked out');
  });
});
