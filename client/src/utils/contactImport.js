// Turn a CSV (or pasted spreadsheet rows) into SMS contacts: { name, phone, group }.
// Phones are normalised the same way as guest numbers (Ghana-aware, digits with country code).
import { normalizePhone } from './guestIdentity';

export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_BYTES = 1024 * 1024;

// RFC 4180-style parser: quoted fields, doubled quotes, newlines inside quotes.
const parseRows = (text, delimiter) => {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((cell) => cell.trim()));
};

const detectDelimiter = (text) => {
  const first = text.split(/\r?\n/).find((l) => l.trim()) || '';
  const counts = [',', ';', '\t'].map((d) => [d, first.split(d).length - 1]);
  return counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts[0][0] : ',';
};

const PHONE_HEADER = /phone|mobile|msisdn|number|tel|cell|contact/i;
const NAME_HEADER = /name/i;
const FIRST_HEADER = /first|given/i;
const LAST_HEADER = /last|sur|family/i;
const GROUP_HEADER = /group|tag|list|categor|type|label/i;

// "Phone-like": at least 7 digits once punctuation is removed.
const looksLikePhone = (value) => String(value || '').replace(/\D/g, '').length >= 7;

const validPhone = (raw) => {
  const text = String(raw || '').trim();
  if (/^\d(\.\d+)?e\+?\d+$/i.test(text)) return { error: 'Looks like Excel scientific notation. Format the column as Text and export again' };
  const phone = normalizePhone(text);
  if (!phone) return { error: 'Not a valid phone number' };
  if (phone.length > 15) return { error: 'Too many digits' };
  return { phone };
};

export const parseContactsCsv = (input) => {
  const text = String(input || '').replace(/^﻿/, '');
  const result = { contacts: [], invalid: [], duplicates: 0, rows: 0, tooMany: false };
  if (!text.trim()) return result;

  let rows = parseRows(text, detectDelimiter(text)).filter((r) => r.some(Boolean));
  if (rows.length === 0) return result;

  // A header row has text in its cells and no phone number in any of them
  let cols = null;
  let firstDataLine = 1;
  const head = rows[0];
  if (!head.some(looksLikePhone) && head.some((c) => /[a-z]/i.test(c))) {
    const find = (re, skip = -1) => head.findIndex((c, i) => i !== skip && re.test(c));
    const phone = find(PHONE_HEADER);
    const first = find(FIRST_HEADER);
    const last = find(LAST_HEADER);
    cols = {
      phone,
      name: find(NAME_HEADER, phone) !== first && find(NAME_HEADER, phone) !== last ? find(NAME_HEADER, phone) : -1,
      first,
      last,
      group: find(GROUP_HEADER, phone)
    };
    rows = rows.slice(1);
    firstDataLine = 2;
  }

  if (!cols) {
    // No header: the column holding phone numbers is the phone, any other text is the name
    const sample = rows.slice(0, 20);
    const width = Math.max(...sample.map((r) => r.length));
    const score = (i) => sample.filter((r) => looksLikePhone(r[i])).length;
    const phone = [...Array(width).keys()].sort((a, b) => score(b) - score(a))[0];
    const others = [...Array(width).keys()].filter((i) => i !== phone);
    cols = { phone, name: others[0] ?? -1, first: -1, last: -1, group: others[1] ?? -1 };
  } else if (cols.phone < 0) {
    result.invalid.push({ line: 1, value: head.join(', '), reason: 'No phone column found. Name the column "Phone", "Mobile" or "Number"' });
    return result;
  }

  result.rows = rows.length;
  if (rows.length > MAX_IMPORT_ROWS) { result.tooMany = true; return result; }

  const seen = new Set();
  rows.forEach((r, idx) => {
    const line = idx + firstDataLine;
    const { phone, error } = validPhone(r[cols.phone]);
    if (error) { result.invalid.push({ line, value: r[cols.phone] || '', reason: error }); return; }
    if (seen.has(phone)) { result.duplicates += 1; return; }
    seen.add(phone);
    const name = cols.name >= 0 ? r[cols.name] : [r[cols.first], r[cols.last]].filter(Boolean).join(' ');
    result.contacts.push({
      name: String(name || '').slice(0, 60),
      phone,
      group: String(cols.group >= 0 ? r[cols.group] || '' : '').slice(0, 40)
    });
  });
  return result;
};
