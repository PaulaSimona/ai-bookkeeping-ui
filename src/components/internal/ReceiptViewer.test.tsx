// ReceiptViewer (S98 P1d item 5): the signed, short-lived receipt link of a
// tax-review file. The URL is shown by the browser only — never requested
// through api or fetch, never stored — and is removed from the page at expiry.
// Every URL and value here is invented.
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@/utils/api';
import { type TaxReviewReceipt } from '@/hooks/useStaffTaxReview';
import { ReceiptViewer } from './ReceiptViewer';

vi.mock('@/utils/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));

const SIGNED = 'https://files.invalid/receipts/r-1?sig=invented-signature-1';
const SIGNED_AGAIN = 'https://files.invalid/receipts/r-1?sig=invented-signature-2';
const EXPIRED = 'This receipt link has expired — reload';
const OPEN = 'Open in new tab';

const receipt = (over: Partial<TaxReviewReceipt> = {}): TaxReviewReceipt => ({
  url: SIGNED,
  expires_in: 300,
  content_type: 'image/png',
  ...over,
});

const fetchSpy = vi.fn();
const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const pageHtml = () => document.body.innerHTML;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchSpy);
  fetchSpy.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Nothing requested the link, and it sits in neither store nor the address.
const expectLinkUntouched = () => {
  expect(api.get).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);
  expect(window.location.href).not.toContain('sig=');
  expect(window.location.href).not.toContain('files.invalid');
};

describe('ReceiptViewer — what it shows', () => {
  it('says "No receipt available" when the file has none, and no more', () => {
    render(<ReceiptViewer receipt={null} onReload={vi.fn()} />);
    expect(screen.getByText('No receipt available')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByText(/expire/i)).not.toBeInTheDocument();
  });

  it('shows an image with no referrer', () => {
    render(<ReceiptViewer receipt={receipt({ content_type: 'image/jpeg' })} onReload={vi.fn()} />);
    const img = screen.getByRole('img', { name: 'Receipt' });
    expect(img).toHaveAttribute('src', SIGNED);
    expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(document.querySelector('object')).toBeNull();
    expect(screen.getByRole('button', { name: OPEN })).toBeInTheDocument();
    expectLinkUntouched();
  });

  it('embeds a PDF, with the new-tab fallback', () => {
    render(
      <ReceiptViewer receipt={receipt({ content_type: 'application/pdf' })} onReload={vi.fn()} />,
    );
    const pdf = document.querySelector('object');
    expect(pdf).toHaveAttribute('data', SIGNED);
    expect(pdf).toHaveAttribute('type', 'application/pdf');
    expect(pdf).toHaveTextContent('This browser cannot show the PDF here.');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: OPEN })).toBeInTheDocument();
    expectLinkUntouched();
  });

  it('offers only the new tab for application/octet-stream', () => {
    render(
      <ReceiptViewer
        receipt={receipt({ content_type: 'application/octet-stream' })}
        onReload={vi.fn()}
      />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('object')).toBeNull();
    expect(document.querySelector('a')).toBeNull();
    expect(screen.getByRole('button', { name: OPEN })).toBeInTheDocument();
    // The link is in no element: it stays in state until the click.
    expect(pageHtml()).not.toContain('sig=');
    expectLinkUntouched();
  });

  it('treats a type it does not know as a download: the new tab only', () => {
    render(<ReceiptViewer receipt={receipt({ content_type: 'text/html' })} onReload={vi.fn()} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('object')).toBeNull();
    expect(document.querySelector('iframe')).toBeNull();
    expect(screen.getByRole('button', { name: OPEN })).toBeInTheDocument();
  });
});

describe('ReceiptViewer — the new tab', () => {
  it('opens about:blank in the click, cuts the opener, then sets the location', () => {
    const steps: string[] = [];
    const tab = {
      _opener: {} as unknown,
      get opener() {
        return this._opener;
      },
      set opener(value: unknown) {
        steps.push('opener');
        this._opener = value;
      },
      location: {
        _href: 'about:blank',
        get href() {
          return this._href;
        },
        set href(value: string) {
          steps.push('location');
          this._href = value;
        },
      },
    };
    const open = vi.fn((..._args: unknown[]) => {
      steps.push('open');
      return tab;
    });
    vi.stubGlobal('open', open);
    render(
      <ReceiptViewer
        receipt={receipt({ content_type: 'application/octet-stream' })}
        onReload={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: OPEN }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith('about:blank', '_blank');
    expect(steps).toEqual(['open', 'opener', 'location']);
    expect(tab.opener).toBeNull();
    expect(tab.location.href).toBe(SIGNED);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expectLinkUntouched();
  });

  it('says so when the browser blocks the tab', () => {
    vi.stubGlobal(
      'open',
      vi.fn(() => null),
    );
    render(<ReceiptViewer receipt={receipt()} onReload={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: OPEN }));
    expect(screen.getByRole('alert')).toHaveTextContent('The browser blocked the new tab.');
  });
});

describe('ReceiptViewer — expiry', () => {
  it('counts down from expires_in', () => {
    render(<ReceiptViewer receipt={receipt()} onReload={vi.fn()} />);
    expect(screen.getByText('Link expires in 5:00')).toBeInTheDocument();
    tick(61_000);
    expect(screen.getByText('Link expires in 3:59')).toBeInTheDocument();
    tick(238_000);
    expect(screen.getByText('Link expires in 0:01')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Receipt' })).toBeInTheDocument();
  });

  it('removes the link from the page at expiry and offers a reload', () => {
    const onReload = vi.fn();
    render(<ReceiptViewer receipt={receipt()} onReload={onReload} />);
    expect(pageHtml()).toContain('sig=invented-signature-1');
    tick(300_000);
    expect(screen.getByText(EXPIRED)).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: OPEN })).not.toBeInTheDocument();
    expect(pageHtml()).not.toContain('sig=');
    expect(pageHtml()).not.toContain('files.invalid');
    expect(onReload).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalledTimes(1);
    expectLinkUntouched();
  });

  it('expires a PDF the same way', () => {
    render(
      <ReceiptViewer
        receipt={receipt({ content_type: 'application/pdf', expires_in: 5 })}
        onReload={vi.fn()}
      />,
    );
    expect(document.querySelector('object')).not.toBeNull();
    tick(5_000);
    expect(document.querySelector('object')).toBeNull();
    expect(screen.getByText(EXPIRED)).toBeInTheDocument();
  });

  it('a link that arrives already expired is never shown', () => {
    render(<ReceiptViewer receipt={receipt({ expires_in: 0 })} onReload={vi.fn()} />);
    expect(screen.getByText(EXPIRED)).toBeInTheDocument();
    expect(pageHtml()).not.toContain('sig=');
  });

  it('stays expired while the reload is in flight, then shows the new link from a full count', () => {
    const onReload = vi.fn();
    const first = receipt();
    const { rerender } = render(<ReceiptViewer receipt={first} onReload={onReload} />);
    tick(300_000);
    // The reload is in flight: the same (expired) receipt, and no second click.
    rerender(<ReceiptViewer receipt={first} onReload={onReload} reloading />);
    expect(screen.getByText(EXPIRED)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reloading…' })).toBeDisabled();
    expect(pageHtml()).not.toContain('sig=');
    // The new file brings a new link.
    rerender(<ReceiptViewer receipt={receipt({ url: SIGNED_AGAIN })} onReload={onReload} />);
    expect(screen.queryByText(EXPIRED)).not.toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Receipt' })).toHaveAttribute('src', SIGNED_AGAIN);
    expect(screen.getByText('Link expires in 5:00')).toBeInTheDocument();
    expect(pageHtml()).not.toContain('invented-signature-1');
    tick(300_000);
    expect(screen.getByText(EXPIRED)).toBeInTheDocument();
  });
});
