// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// jsdom lacks these browser APIs; the offline layer (IndexedDB via fake-indexeddb, uuid ids) needs them in tests.
if (typeof global.structuredClone === 'undefined') {
  global.structuredClone = (value) => (value === undefined ? value : require('v8').deserialize(require('v8').serialize(value)));
}
if (typeof global.crypto === 'undefined' || !global.crypto.randomUUID) {
  const { webcrypto } = require('crypto');
  Object.defineProperty(global, 'crypto', { value: webcrypto, configurable: true });
}
