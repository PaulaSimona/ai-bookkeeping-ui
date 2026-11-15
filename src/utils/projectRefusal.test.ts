// readRefusal (J1c-1, R-J1C-2/3): one server body becomes one banner text and
// the errors of the fields the form really has.
import { describe, expect, it } from 'vitest';
import { readRefusal } from './projectRefusal';

const FALLBACK = 'Could not save.';

describe('readRefusal', () => {
  it('puts the server detail in the banner and keeps the machine code', () => {
    const refusal = readRefusal(
      { status: 409, data: { detail: 'Projects is turned off for this organization.', error_code: 'projects_off' } },
      FALLBACK,
    );

    expect(refusal).toEqual({
      banner: 'Projects is turned off for this organization.',
      code: 'projects_off',
      fields: {},
    });
  });

  it('reads the machine code from the older "code" key as well', () => {
    const refusal = readRefusal(
      { status: 400, data: { detail: 'This account has history.', code: 'account_has_history' } },
      FALLBACK,
      ['code', 'name'],
    );

    // The machine code is never mistaken for an error of a form field "code".
    expect(refusal).toEqual({
      banner: 'This account has history.',
      code: 'account_has_history',
      fields: {},
    });
  });

  it('puts a field error under its field and leaves the banner empty', () => {
    const refusal = readRefusal(
      { status: 400, data: { end_date: ['The end date may not be before the start date.'] } },
      FALLBACK,
      ['name', 'end_date'],
    );

    expect(refusal).toEqual({
      banner: null,
      code: null,
      fields: { end_date: 'The end date may not be before the start date.' },
    });
  });

  it('shows an error of a field the form does not have in the banner', () => {
    const refusal = readRefusal(
      { status: 400, data: { status: ['This field is not allowed.'] } },
      FALLBACK,
      ['name'],
    );

    expect(refusal).toEqual({
      banner: 'status: This field is not allowed.',
      code: null,
      fields: {},
    });
  });

  it('falls back to the given text when the body says nothing', () => {
    expect(readRefusal({ status: 500, data: '<html>' }, FALLBACK)).toEqual({
      banner: FALLBACK,
      code: null,
      fields: {},
    });
    expect(readRefusal(null, FALLBACK)).toEqual({ banner: FALLBACK, code: null, fields: {} });
  });
});
