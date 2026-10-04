// AccountPicker behaviour (D-S84-6, D-S85-3): filtering, keyboard, the form
// guarantee, Escape, restore-on-leave, and the portalled list.
import { type FC, type FormEvent, useState } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CurrentAccount, PickerAccount } from '@/types/account';
import { AccountPicker, type AccountPickerProps } from './index';

const acct = (
  code: string,
  name: string,
  type: PickerAccount['type'],
): PickerAccount => ({
  id: `id-${code}`,
  org_id: 'org-1',
  code,
  name,
  type,
  is_active: true,
});

// Out of order on purpose; holds both 2110 and 21100.
const ACCOUNTS: PickerAccount[] = [
  acct('5000', 'Rent Expense', 'expense'),
  acct('2110', 'Credit Card Payable', 'liability'),
  acct('1000', 'Cash', 'asset'),
  acct('4000', 'Sales Revenue', 'revenue'),
  acct('21100', 'Visa Card Payable', 'liability'),
  acct('3000', 'Owner Equity', 'equity'),
  acct('2100', 'Accounts Payable', 'liability'),
  acct('1200', 'Accounts Receivable', 'asset'),
  acct('2200', 'Sales Tax Payable', 'liability'),
  acct('5100', 'Office Supplies', 'expense'),
];

// "code — name", em dash.
const L = (code: string, name: string) => `${code} — ${name}`;

type HarnessProps = Partial<
  Omit<AccountPickerProps, 'id' | 'label' | 'ariaLabel' | 'value' | 'onChange'>
> & {
  initialValue?: string;
  onChange?: AccountPickerProps['onChange'];
};

// The picker is controlled; this holds its value the way a screen would.
const Harness: FC<HarnessProps> = ({ initialValue = '', onChange, ...rest }) => {
  const [value, setValue] = useState(initialValue);
  return (
    <AccountPicker
      id="acct"
      ariaLabel="Account"
      accounts={ACCOUNTS}
      {...rest}
      value={value}
      onChange={(next, account) => {
        setValue(next);
        onChange?.(next, account);
      }}
    />
  );
};

const field = () => screen.getByRole('combobox', { name: 'Account' });
const optionTexts = () =>
  screen.queryAllByRole('option').map((o) => o.textContent);
const highlighted = () => screen.getByRole('option', { selected: true });

describe('filtering', () => {
  it('narrows with each of the code prefixes 2, 21 and 2110', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(field());

    await user.keyboard('2');
    expect(optionTexts()).toEqual([
      L('2100', 'Accounts Payable'),
      L('2110', 'Credit Card Payable'),
      L('21100', 'Visa Card Payable'),
      L('2200', 'Sales Tax Payable'),
    ]);

    await user.keyboard('1');
    expect(optionTexts()).toEqual([
      L('2100', 'Accounts Payable'),
      L('2110', 'Credit Card Payable'),
      L('21100', 'Visa Card Payable'),
    ]);

    await user.keyboard('10');
    expect(optionTexts()).toEqual([
      L('2110', 'Credit Card Payable'),
      L('21100', 'Visa Card Payable'),
    ]);
  });

  it('filters by a name fragment, case-insensitively', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(field());

    await user.keyboard('rent');
    expect(optionTexts()).toEqual([L('5000', 'Rent Expense')]);

    await user.clear(field());
    await user.keyboard('RENT');
    expect(optionTexts()).toEqual([L('5000', 'Rent Expense')]);
  });

  it('groups by type, in type order, with exact "code — name" labels', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(field());

    const list = screen.getByRole('listbox');
    expect(
      within(list)
        .getAllByRole('presentation')
        .map((h) => h.textContent),
    ).toEqual(['Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses']);
    expect(optionTexts()).toEqual([
      L('1000', 'Cash'),
      L('1200', 'Accounts Receivable'),
      L('2100', 'Accounts Payable'),
      L('2110', 'Credit Card Payable'),
      L('21100', 'Visa Card Payable'),
      L('2200', 'Sales Tax Payable'),
      L('3000', 'Owner Equity'),
      L('4000', 'Sales Revenue'),
      L('5000', 'Rent Expense'),
      L('5100', 'Office Supplies'),
    ]);
  });

  it('offers only the allowed types, minus what the site predicate rejects', async () => {
    const user = userEvent.setup();
    render(
      <Harness
        allowedTypes={['liability', 'equity']}
        filter={(a) => !a.code.startsWith('22')}
      />,
    );
    await user.click(field());
    expect(optionTexts()).toEqual([
      L('2100', 'Accounts Payable'),
      L('2110', 'Credit Card Payable'),
      L('21100', 'Visa Card Payable'),
      L('3000', 'Owner Equity'),
    ]);
  });
});

describe('an exact code', () => {
  it('is highlighted and commits nothing until Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(field());
    await user.keyboard('2110');

    expect(highlighted()).toHaveTextContent(L('2110', 'Credit Card Payable'));
    expect(field()).toHaveAttribute('aria-activedescendant', highlighted().id);
    expect(onChange).not.toHaveBeenCalled();

    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      'id-2110',
      expect.objectContaining({ code: '2110' }),
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(field()).toHaveValue(L('2110', 'Credit Card Payable'));
  });

  it('is committed by Tab', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initialValue="id-1000" onChange={onChange} />);
    await user.click(field());
    await user.keyboard('2110');
    await user.tab();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      'id-2110',
      expect.objectContaining({ code: '2110' }),
    );
    expect(field()).toHaveValue(L('2110', 'Credit Card Payable'));
  });

  it('is NOT committed by Tab once the highlight has moved off it', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initialValue="id-1000" onChange={onChange} />);
    await user.click(field());
    await user.keyboard('2110{ArrowDown}');
    expect(highlighted()).toHaveTextContent(L('21100', 'Visa Card Payable'));
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(field()).toHaveValue(L('1000', 'Cash'));
  });
});

describe('leaving the field without a commit', () => {
  it('Tab on a query that is not an exact code commits nothing and restores the value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initialValue="id-1000" onChange={onChange} />);
    await user.click(field());
    await user.keyboard('21');
    // A first match IS highlighted — Tab still must not take it.
    expect(highlighted()).toHaveTextContent(L('2100', 'Accounts Payable'));
    expect(field()).toHaveValue('21');
    await user.tab();

    expect(onChange).not.toHaveBeenCalled();
    expect(field()).toHaveValue(L('1000', 'Cash'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('blur without a commit restores the previous value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initialValue="id-1000" onChange={onChange} />);
    await user.click(field());
    await user.keyboard('rent');
    expect(field()).toHaveValue('rent');

    fireEvent.blur(field());
    expect(onChange).not.toHaveBeenCalled();
    expect(field()).toHaveValue(L('1000', 'Cash'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('a press outside closes the list, commits nothing and restores the value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <>
        <Harness initialValue="id-1000" onChange={onChange} />
        <button type="button">Elsewhere</button>
      </>,
    );
    await user.click(field());
    await user.keyboard('rent');
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Elsewhere' }));
    expect(onChange).not.toHaveBeenCalled();
    expect(field()).toHaveValue(L('1000', 'Cash'));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('never emits typed text as a value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(field());
    await user.keyboard('zzz');
    expect(screen.getByText('No matching accounts')).toBeInTheDocument();
    expect(optionTexts()).toEqual([]);

    await user.keyboard('{Enter}');
    await user.tab();
    expect(onChange).not.toHaveBeenCalled();
    expect(field()).toHaveValue('');
  });
});

describe('arrow keys', () => {
  it('move through the options and skip the group headers', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(field());
    // Nothing chosen and nothing typed: no option is highlighted yet.
    expect(screen.queryByRole('option', { selected: true })).not.toBeInTheDocument();

    await user.keyboard('{ArrowDown}');
    expect(highlighted()).toHaveTextContent(L('1000', 'Cash'));
    await user.keyboard('{ArrowDown}');
    expect(highlighted()).toHaveTextContent(L('1200', 'Accounts Receivable'));

    // Crossing from the last asset to the first liability passes the
    // "Liabilities" header without stopping on it.
    await user.keyboard('{ArrowDown}');
    expect(highlighted()).toHaveTextContent(L('2100', 'Accounts Payable'));
    expect(field()).toHaveAttribute('aria-activedescendant', highlighted().id);

    await user.keyboard('{ArrowUp}');
    expect(highlighted()).toHaveTextContent(L('1200', 'Accounts Receivable'));

    // No header is ever an option.
    const headers = within(screen.getByRole('listbox')).getAllByRole('presentation');
    expect(headers).toHaveLength(5);
    for (const h of headers) expect(h).not.toHaveAttribute('aria-selected');
  });

  it('stop at the ends of the list', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(field());
    await user.keyboard('{ArrowDown}{ArrowUp}{ArrowUp}');
    expect(highlighted()).toHaveTextContent(L('1000', 'Cash'));

    await user.keyboard('rent{ArrowDown}{ArrowDown}');
    expect(highlighted()).toHaveTextContent(L('5000', 'Rent Expense'));
  });

  it('open a closed list from the keyboard, on the current value', async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="id-3000" />);
    await user.tab();
    expect(field()).toHaveFocus();
    expect(field()).toHaveAttribute('aria-expanded', 'false');

    await user.keyboard('{ArrowDown}');
    expect(field()).toHaveAttribute('aria-expanded', 'true');
    expect(highlighted()).toHaveTextContent(L('3000', 'Owner Equity'));
  });
});

describe('Enter inside a form', () => {
  const renderInForm = (onChange: AccountPickerProps['onChange']) => {
    const onSubmit = vi.fn((e: FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Harness onChange={onChange} />
        <input aria-label="Memo" />
        <button type="submit">Save</button>
      </form>,
    );
    return onSubmit;
  };

  it('commits and never submits — list open and list closed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = renderInForm(onChange);

    // Control: in this same form, Enter in a plain input DOES submit. Without
    // this the assertions below could pass while proving nothing.
    await user.click(screen.getByRole('textbox', { name: 'Memo' }));
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    onSubmit.mockClear();

    // List open, an option highlighted.
    await user.click(field());
    await user.keyboard('2110');
    expect(field()).toHaveAttribute('aria-expanded', 'true');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenCalledWith(
      'id-2110',
      expect.objectContaining({ code: '2110' }),
    );
    expect(onSubmit).not.toHaveBeenCalled();

    // List closed (the commit closed it); focus is still in the field.
    expect(field()).toHaveAttribute('aria-expanded', 'false');
    expect(field()).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not submit from a field that was only tabbed into', async () => {
    const user = userEvent.setup();
    const onSubmit = renderInForm(vi.fn());
    await user.tab();
    expect(field()).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit when the list is open with nothing to commit', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSubmit = renderInForm(onChange);
    await user.click(field());
    await user.keyboard('zzz{Enter}');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe('Escape', () => {
  it('closes an open list without reaching a parent; propagates once it is closed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    // Both shapes of "a parent": a React ancestor, and a window listener like
    // the one the posted-correction editor uses to close itself.
    const parentKeyDown = vi.fn();
    const windowKeyDown = vi.fn();
    window.addEventListener('keydown', windowKeyDown);
    try {
      render(
        <div onKeyDown={parentKeyDown}>
          <Harness initialValue="id-1000" onChange={onChange} />
        </div>,
      );
      await user.click(field());
      await user.keyboard('21');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
      parentKeyDown.mockClear();
      windowKeyDown.mockClear();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(parentKeyDown).not.toHaveBeenCalled();
      expect(windowKeyDown).not.toHaveBeenCalled();
      // Uncommitted, and the previous value is back.
      expect(onChange).not.toHaveBeenCalled();
      expect(field()).toHaveValue(L('1000', 'Cash'));

      await user.keyboard('{Escape}');
      expect(parentKeyDown).toHaveBeenCalledTimes(1);
      expect(windowKeyDown).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener('keydown', windowKeyDown);
    }
  });
});

describe('currentAccount', () => {
  const inactive: CurrentAccount = { id: 'id-1999', code: '1999', name: 'Old Clearing' };

  it('displays a value the list does not hold, and keeps it selectable', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Harness initialValue="id-1999" currentAccount={inactive} onChange={onChange} />,
    );
    expect(field()).toHaveValue(L('1999', 'Old Clearing'));

    // It is offered, under its own trailing header.
    await user.click(field());
    const headers = within(screen.getByRole('listbox')).getAllByRole('presentation');
    expect(headers[headers.length - 1]).toHaveTextContent('Current');
    expect(highlighted()).toHaveTextContent(L('1999', 'Old Clearing'));

    // Move away from it…
    await user.click(screen.getByRole('option', { name: L('1000', 'Cash') }));
    expect(onChange).toHaveBeenLastCalledWith(
      'id-1000',
      expect.objectContaining({ code: '1000' }),
    );
    expect(field()).toHaveValue(L('1000', 'Cash'));

    // …and back to it.
    await user.click(field());
    await user.click(screen.getByRole('option', { name: L('1999', 'Old Clearing') }));
    expect(onChange).toHaveBeenLastCalledWith('id-1999', inactive);
    expect(field()).toHaveValue(L('1999', 'Old Clearing'));
  });
});

describe('value handling', () => {
  it('a click commits the option and keeps focus in the field', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await user.click(field());
    await user.click(screen.getByRole('option', { name: L('4000', 'Sales Revenue') }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      'id-4000',
      expect.objectContaining({ code: '4000' }),
    );
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(field()).toHaveFocus();
  });

  it('does not report a change when the committed option is already the value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness initialValue="id-4000" onChange={onChange} />);
    await user.click(field());
    await user.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('replaces the shown label when typing starts, instead of appending to it', async () => {
    const user = userEvent.setup();
    render(<Harness initialValue="id-1000" />);
    await user.click(field());
    await user.keyboard('5');
    expect(field()).toHaveValue('5');
    expect(optionTexts()).toEqual([
      L('5000', 'Rent Expense'),
      L('5100', 'Office Supplies'),
    ]);
  });

  it('reads and emits the code when valueKey is "code"', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness valueKey="code" initialValue="1000" onChange={onChange} />);
    expect(field()).toHaveValue(L('1000', 'Cash'));

    await user.click(field());
    await user.keyboard('2110{Enter}');
    expect(onChange).toHaveBeenCalledWith(
      '2110',
      expect.objectContaining({ id: 'id-2110' }),
    );
    expect(field()).toHaveValue(L('2110', 'Credit Card Payable'));
  });

  it('offers a first row that clears the value when clearable', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Harness
        clearable
        placeholder="No parent (optional)"
        initialValue="id-1000"
        onChange={onChange}
      />,
    );
    await user.click(field());
    expect(optionTexts()[0]).toBe('No parent (optional)');

    await user.click(screen.getByRole('option', { name: 'No parent (optional)' }));
    expect(onChange).toHaveBeenCalledWith('', null);
    expect(field()).toHaveValue('');
  });

  it('has no clearing row unless clearable', async () => {
    const user = userEvent.setup();
    render(<Harness placeholder="Select account…" />);
    await user.click(field());
    expect(optionTexts()).not.toContain('Select account…');
  });
});

describe('loading, error and disabled', () => {
  it('renders the loading state as text', () => {
    render(<Harness accounts={[]} loading />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading accounts…');
  });

  it('renders the error as text and offers no options at all', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    // The list is passed anyway: with an error it must not be offered.
    render(<Harness error="Failed to load accounts." onChange={onChange} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load accounts.');

    await user.click(field());
    await user.keyboard('2110{ArrowDown}{Enter}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('option')).toHaveLength(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('hideError leaves the message to the screen but still offers no options', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness error="Failed to load accounts." hideError onChange={onChange} />);
    // The screen says it once for all of its pickers; this one does not repeat it.
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed to load accounts.')).not.toBeInTheDocument();
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(field()).not.toHaveAttribute('aria-describedby');

    await user.click(field());
    await user.keyboard('2110{ArrowDown}{Enter}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not open when disabled', async () => {
    const user = userEvent.setup();
    render(<Harness disabled />);
    expect(field()).toBeDisabled();
    await user.click(field());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});

describe('size', () => {
  it('uses the form-field padding by default and the roomier one for size "lg"', () => {
    const { unmount } = render(<Harness />);
    expect(field()).toHaveClass('px-3', 'py-2');
    unmount();

    render(<Harness size="lg" />);
    expect(field()).toHaveClass('px-3.5', 'py-2.5');
    expect(field()).not.toHaveClass('px-3');
  });

  it('keeps the one dark size', () => {
    render(<Harness tone="dark" size="lg" />);
    expect(field()).toHaveClass('px-2', 'py-1.5');
  });
});

describe('the list popup', () => {
  // jsdom has no layout: every rect is zero. Give the input a rect to anchor to.
  const placeInput = (top: number) => {
    field().getBoundingClientRect = () =>
      ({
        top,
        bottom: top + 30,
        left: 40,
        right: 340,
        width: 300,
        height: 30,
        x: 40,
        y: top,
        toJSON: () => ({}),
      }) as DOMRect;
  };

  it('is portalled to <body>, outside the element that holds the field', async () => {
    const user = userEvent.setup();
    render(
      <div data-testid="clipping-parent" style={{ overflow: 'hidden' }}>
        <Harness />
      </div>,
    );
    await user.click(field());
    const list = screen.getByRole('listbox');
    expect(list.parentElement).toBe(document.body);
    expect(screen.getByTestId('clipping-parent')).not.toContainElement(list);
    expect(field()).toHaveAttribute('aria-controls', list.id);
  });

  it('is fixed-positioned under the input and follows it on scroll and on a viewport size change', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    placeInput(100);
    await user.click(field());

    const list = screen.getByRole('listbox');
    expect(list).toHaveStyle({ position: 'fixed', top: '134px', left: '40px', width: '300px' });

    placeInput(60);
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    expect(list).toHaveStyle({ top: '94px' });

    placeInput(200);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(list).toHaveStyle({ top: '234px' });
  });

  it('opens upward when there is no room below the input', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    placeInput(window.innerHeight - 40);
    await user.click(field());

    const list = screen.getByRole('listbox');
    expect(list.style.top).toBe('');
    expect(list).toHaveStyle({ bottom: '44px' });
  });
});
