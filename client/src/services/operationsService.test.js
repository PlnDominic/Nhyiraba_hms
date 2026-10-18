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

describe('buildRoomCharges', () => {
  const { buildRoomCharges } = require('./operationsService');
  const room = { id: 7, room_number: 12 };
  const checkIn = '2026-10-10T12:00:00Z';
  const order = (over) => ({ id: 'o1', order_type: 'room-service', payment_status: 'unpaid', status: 'delivered', room_number: 12, total_amount: 80, created_at: '2026-10-11T19:00:00Z', ...over });

  it('includes unpaid room-service orders for this room during the stay', () => {
    const lines = buildRoomCharges({ room, checkIn, orders: [order()] });
    expect(lines).toEqual([expect.objectContaining({ source: 'restaurant', sourceId: 'o1', amount: 80 })]);
  });

  it('skips paid, cancelled, other-room, pre-arrival and non room-service orders', () => {
    const orders = [
      order({ id: 'a', payment_status: 'paid' }),
      order({ id: 'b', status: 'cancelled' }),
      order({ id: 'c', room_number: 13 }),
      order({ id: 'd', created_at: '2026-10-01T10:00:00Z' }),
      order({ id: 'e', order_type: 'dine-in' })
    ];
    expect(buildRoomCharges({ room, checkIn, orders })).toEqual([]);
  });

  it('prices completed service requests from the services list, matching room id or number', () => {
    const requests = [
      { id: 1, room: '12', service_id: 3, service_name: 'Laundry', status: 'Completed', created_at: '2026-10-11T08:00:00Z' },
      { id: 2, room: 'Room 7', service_id: 3, service_name: 'Laundry', status: 'Completed', created_at: '2026-10-12T08:00:00Z' },
      { id: 3, room: '12', service_id: 3, service_name: 'Laundry', status: 'Pending', created_at: '2026-10-12T08:00:00Z' },
      { id: 4, room: '99', service_id: 3, service_name: 'Laundry', status: 'Completed', created_at: '2026-10-12T08:00:00Z' }
    ];
    const lines = buildRoomCharges({ room, checkIn, requests, services: [{ id: 3, price: '25' }] });
    expect(lines.map((l) => l.sourceId)).toEqual([1, 2]);
    expect(lines[0]).toMatchObject({ source: 'service', description: 'Laundry', amount: 25 });
  });
});
