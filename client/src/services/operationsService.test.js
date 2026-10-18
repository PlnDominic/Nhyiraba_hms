jest.mock('../supabaseClient', () => ({ __esModule: true, default: {} }));

const {
  calculateFolio,
  calculateNights,
  friendlyReservationError,
  isRoomReady,
  validateCheckIn
} = require('./operationsService');

describe('calculateFolio', () => {
  it('charges nights x rate, extras and late fee, minus deposit and payment', () => {
    const folio = calculateFolio({
      checkIn: '2026-10-01T14:00:00Z',
      checkOut: '2026-10-04T10:00:00Z',
      roomRate: 200,
      lateCheckoutFee: 50,
      extras: [{ description: 'Minibar', amount: 35.5 }],
      depositPaid: 100,
      paymentReceived: 100
    });
    expect(folio.nights).toBe(3);
    expect(folio.roomTotal).toBe(600);
    expect(folio.extrasTotal).toBe(35.5);
    expect(folio.totalDue).toBe(685.5);
    expect(folio.balance).toBe(485.5);
  });

  it('bills at least one night', () => {
    expect(calculateNights('2026-10-01T14:00:00Z', '2026-10-01T15:00:00Z')).toBe(1);
  });

  it('shows a negative balance when the guest overpaid', () => {
    const folio = calculateFolio({ checkIn: '2026-10-01', checkOut: '2026-10-02', roomRate: 100, depositPaid: 150 });
    expect(folio.balance).toBe(-50);
  });
});

describe('validateCheckIn', () => {
  const reservation = { guest_phone: '0241234567', payment_status: 'Pending' };
  const room = { room_number: 4, status: 'Reserved', housekeeping_status: 'Clean' };
  const good = { idType: 'Ghana Card', idNumber: 'GHA-123', depositAmount: '100', policyAcknowledged: true };

  it('passes when every requirement is met', () => {
    expect(validateCheckIn({ reservation, room, form: good })).toEqual([]);
  });

  it('requires identity, policy acknowledgement and a ready room', () => {
    const problems = validateCheckIn({
      reservation,
      room: { ...room, housekeeping_status: 'Dirty' },
      form: { ...good, idNumber: ' ', policyAcknowledged: false }
    });
    expect(problems).toHaveLength(3);
  });

  it('needs a payment or a documented override', () => {
    const noPayment = { ...good, depositAmount: '' };
    expect(validateCheckIn({ reservation, room, form: noPayment })).toHaveLength(1);
    expect(validateCheckIn({ reservation, room, form: { ...noPayment, overrideReason: 'Corporate account' } })).toEqual([]);
  });

  it('requires some contact detail', () => {
    expect(validateCheckIn({ reservation: {}, room, form: good })).toHaveLength(1);
  });
});

describe('helpers', () => {
  it('treats rooms without a housekeeping status as ready', () => {
    expect(isRoomReady({})).toBe(true);
    expect(isRoomReady({ housekeeping_status: 'Dirty' })).toBe(false);
  });

  it('maps the exclusion-constraint error to a friendly message', () => {
    expect(friendlyReservationError({ code: '23P01', message: 'conflicting key value' })).toMatch(/just booked/);
    expect(friendlyReservationError({ message: 'boom' })).toBe('boom');
  });
});
