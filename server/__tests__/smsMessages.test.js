const test = require('node:test');
const assert = require('node:assert');
const { buildMessage } = require('../smsService');

const data = { guestName: 'Ama', roomNumber: 4, checkInDate: '2026-11-02', checkOutDate: '2026-11-04', roomRate: 200 };

test('reservation and check-in messages state the check-out time', () => {
  for (const event of ['reservation_created', 'reservation_updated', 'checked_in']) {
    assert.match(buildMessage(event, data), /12:00 noon/, event);
  }
});
