// ─── Calendar-date parsing (S68 E3, O-S68-21 — closes F-S66-1) ──────────────
// The ledger's entry_date (and every report period bound) is a DATE, not an
// instant: the API sends "YYYY-MM-DD" with no zone. `new Date("YYYY-MM-DD")`
// parses that as UTC MIDNIGHT, so toLocaleDateString in any browser west of
// UTC shows the PREVIOUS day. parseIsoDate builds a LOCAL calendar date instead.
// The Tier 1 helpers below (formatDate / formatDateTime) are untouched —
// they format datetime instants for the billing pages.

const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

export function parseIsoDate(iso: string): Date {
  if (typeof iso !== 'string' || !ISO_DATE_PREFIX.test(iso)) {
    throw new Error(`parseIsoDate: not an ISO calendar date: ${String(iso)}`);
  }
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`parseIsoDate: invalid calendar date: ${iso}`);
  }
  return date;
}

const DEFAULT_ISO_DATE_OPTS: Intl.DateTimeFormatOptions = {
  year: 'numeric', month: 'short', day: 'numeric',
};

/** Format a "YYYY-MM-DD" value as a calendar date (default: "Sep 15, 2026"). */
export function formatIsoDate(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return parseIsoDate(iso).toLocaleDateString('en-CA', opts ?? DEFAULT_ISO_DATE_OPTS);
}

export const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${month}/${day}/${year}`;
};

export const formatDateTime = (dateString: string) => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Los meses en JavaScript comienzan desde 0
  const year = date.getFullYear();
  const hours = date.getHours() > 12 ? date.getHours() - 12 : date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = date.getHours() >= 12 ? 'PM' : 'AM';

  return `${day}/${month}/${year} - ${hours}:${minutes} ${ampm}`;
};
