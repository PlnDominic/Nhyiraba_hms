import { MAX_IMPORT_ROWS, parseContactsCsv } from './contactImport';

describe('parseContactsCsv', () => {
  it('reads a headed file with name, phone and group', () => {
    const r = parseContactsCsv('Name,Phone,Group\nAma Mensah,0241234567,Suppliers\nKofi,+233 20 111 2222,Church');
    expect(r.contacts).toEqual([
      { name: 'Ama Mensah', phone: '233241234567', group: 'Suppliers' },
      { name: 'Kofi', phone: '233201112222', group: 'Church' }
    ]);
    expect(r.invalid).toEqual([]);
  });

  it('finds columns by header words in any order, and joins first and last name', () => {
    const r = parseContactsCsv('Mobile Number,Last Name,First Name\n0241234567,Mensah,Ama');
    expect(r.contacts[0]).toMatchObject({ name: 'Ama Mensah', phone: '233241234567' });
  });

  it('accepts a file with no header', () => {
    expect(parseContactsCsv('Ama,0241234567\nKofi,0201112222').contacts.map((c) => c.name)).toEqual(['Ama', 'Kofi']);
    expect(parseContactsCsv('0241234567\n0201112222').contacts).toHaveLength(2);
    expect(parseContactsCsv('0241234567,Ama').contacts[0]).toMatchObject({ name: 'Ama', phone: '233241234567' });
  });

  it('handles quotes, semicolons, tabs, a BOM and Windows line endings', () => {
    const quoted = parseContactsCsv('﻿Name,Phone\r\n"Mensah, Ama","024 123 4567"\r\n');
    expect(quoted.contacts[0]).toMatchObject({ name: 'Mensah, Ama', phone: '233241234567' });
    expect(parseContactsCsv('Name;Phone\nAma;0241234567').contacts).toHaveLength(1);
    expect(parseContactsCsv('Name\tPhone\nAma\t0241234567').contacts).toHaveLength(1);
  });

  it('reports bad rows with their line number and drops repeats', () => {
    const r = parseContactsCsv('Name,Phone\nAma,0241234567\nBad,12345\nAma again,024 123 4567\nSci,2.33241E+11');
    expect(r.contacts).toHaveLength(1);
    expect(r.duplicates).toBe(1);
    expect(r.invalid.map((i) => i.line)).toEqual([3, 5]);
    expect(r.invalid[1].reason).toMatch(/scientific/);
  });

  it('explains a header with no phone column', () => {
    const r = parseContactsCsv('Name,Email\nAma,a@b.com');
    expect(r.contacts).toEqual([]);
    expect(r.invalid[0].reason).toMatch(/phone column/i);
  });

  it('returns nothing for empty input and refuses oversized files', () => {
    expect(parseContactsCsv('').contacts).toEqual([]);
    const big = `Phone\n${Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `024${String(1000000 + i)}`).join('\n')}`;
    expect(parseContactsCsv(big).tooMany).toBe(true);
  });
});
