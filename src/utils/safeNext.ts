// Single-source open-redirect guard for the post-auth ?next= redirect
// (D-S25-1, shipped in Phase D; extracted here so BOTH Login and RedirectPage
// apply the exact same rule — D-S25-8 / W-S24-1 / F-S25-4).
//
// Why RedirectPage needs it too: during login the auth state flips before
// Login's own effect navigates. RedirectPage (the guest-only wrapper around
// /login) then sees `user` and redirects to the tier home, unmounting Login and
// cancelling its pending safeNext navigate — so ?next= was silently dropped
// live. Honoring ?next= in RedirectPage's authed branch closes that race.
//
// Guard: accept ONLY a same-origin RELATIVE path — a leading '/', NOT '//'
// (protocol-relative), and NO URL scheme (e.g. "javascript:" / "https:").
// Anything else → null → the caller falls back to its tier default.
export const getSafeNext = (search: string): string | null => {
  const next = new URLSearchParams(search).get('next');
  if (
    next &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(next)
  ) {
    return next;
  }
  return null;
};
