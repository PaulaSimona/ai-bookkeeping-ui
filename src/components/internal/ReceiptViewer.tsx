import { type FC, useEffect, useState } from 'react';
import { SecondaryButton } from '@/components/internal/ui';
import { type TaxReviewReceipt } from '@/hooks/useStaffTaxReview';

/**
 * The receipt of a tax-review file (S98 P1d item 5). STAFF ONLY.
 *
 * The receipt's URL is signed and short-lived. It lives only in React state —
 * the file the hook holds, handed down here — and in the element that shows
 * it. It is never put in the route, the query string, localStorage,
 * sessionStorage, a log line or an error report, and it is never requested
 * through api, axios or fetch: the browser loads it as an image, an embedded
 * PDF or a new tab, and nothing else touches it.
 *
 * The link counts down from the server's expires_in. At expiry everything
 * that carries the URL is removed from the page, and "reload" reads the file
 * again — a new, audited read with a new link.
 */

export const RECEIPT_NONE = 'No receipt available';
export const RECEIPT_EXPIRED = 'This receipt link has expired — reload';
export const RECEIPT_OPEN = 'Open in new tab';
export const RECEIPT_BLOCKED = 'The browser blocked the new tab. Allow pop-ups for this site, then try again.';

// A blank tab opened in the click itself (so the browser allows it), cut off
// from this page, and only then pointed at the receipt. False when the
// browser refused the tab.
const openInNewTab = (url: string): boolean => {
  const tab = window.open('about:blank', '_blank');
  if (!tab) return false;
  tab.opener = null;
  tab.location.href = url;
  return true;
};

const clock = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export const ReceiptViewer: FC<{
  receipt: TaxReviewReceipt | null;
  // Reads the file again; the new file brings a new receipt link.
  onReload: () => void;
  reloading?: boolean;
}> = ({ receipt, onReload, reloading = false }) => {
  // When this link was handed over. A new file brings a new receipt object,
  // and the count starts again from it.
  const [issued, setIssued] = useState(() => ({ receipt, at: Date.now() }));
  const [now, setNow] = useState(() => Date.now());
  const [blocked, setBlocked] = useState(false);
  if (issued.receipt !== receipt) {
    const at = Date.now();
    setIssued({ receipt, at });
    setNow(at);
    setBlocked(false);
  }

  const expiresAt = receipt ? issued.at + Math.max(0, receipt.expires_in) * 1000 : 0;
  const remaining = receipt ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;
  const expired = receipt !== null && remaining <= 0;

  useEffect(() => {
    if (!receipt || expired) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [receipt, expired]);

  if (!receipt) {
    return <p className="text-sm text-white/50">{RECEIPT_NONE}</p>;
  }

  if (expired) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-3 text-sm text-amber-200">
        <p>{RECEIPT_EXPIRED}</p>
        <SecondaryButton onClick={onReload} disabled={reloading}>
          {reloading ? 'Reloading…' : 'Reload'}
        </SecondaryButton>
      </div>
    );
  }

  const { url, content_type: contentType } = receipt;
  const isImage = contentType.startsWith('image/');
  const isPdf = contentType === 'application/pdf';
  const openLink = (
    <SecondaryButton onClick={() => setBlocked(!openInNewTab(url))}>{RECEIPT_OPEN}</SecondaryButton>
  );

  return (
    <div className="space-y-3">
      {isImage && (
        <img
          src={url}
          alt="Receipt"
          referrerPolicy="no-referrer"
          className="max-h-[32rem] max-w-full rounded-lg border border-white/10"
        />
      )}
      {isPdf && (
        <object
          data={url}
          type="application/pdf"
          aria-label="Receipt"
          className="h-[32rem] w-full rounded-lg border border-white/10"
        >
          <p className="p-3 text-sm text-white/50">
            This browser cannot show the PDF here. Use “{RECEIPT_OPEN}”.
          </p>
        </object>
      )}
      <div className="flex flex-wrap items-center gap-3 text-xs text-white/40">
        {openLink}
        <span>Link expires in {clock(remaining)}</span>
      </div>
      {blocked && (
        <p role="alert" className="text-xs text-amber-200">
          {RECEIPT_BLOCKED}
        </p>
      )}
    </div>
  );
};
