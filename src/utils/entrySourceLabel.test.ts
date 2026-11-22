// entrySourceLabel (S98 P1d item 8, P-7): what a screen calls an entry's
// source. A customer reads both staff sources as "Correction"; staff read them
// apart; nothing else changes.
import { describe, expect, it } from 'vitest';
import { entrySourceLabel } from './entryStatus';

describe('entrySourceLabel', () => {
  it('the default lane is the customer label: both staff sources read "Correction"', () => {
    expect(entrySourceLabel('staff_correction')).toBe('Correction');
    expect(entrySourceLabel('staff_reclassification')).toBe('Correction');
    expect(entrySourceLabel('staff_correction', 'customer')).toBe('Correction');
    expect(entrySourceLabel('staff_reclassification', 'customer')).toBe('Correction');
  });

  it('staff read the two apart', () => {
    expect(entrySourceLabel('staff_correction', 'staff')).toBe('Staff correction');
    expect(entrySourceLabel('staff_reclassification', 'staff')).toBe('Staff reclassification');
  });

  it.each([
    ['ai', 'Ai'],
    ['manual', 'Manual'],
    ['accountant_adjustment', 'Accountant adjustment'],
    ['bank_feed', 'Bank feed'],
    ['', '—'],
    ['toString', 'ToString'],
  ])('%j keeps the text it had, in both lanes', (source, label) => {
    expect(entrySourceLabel(source)).toBe(label);
    expect(entrySourceLabel(source, 'staff')).toBe(label);
  });
});
