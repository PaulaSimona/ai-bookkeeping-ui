/**
 * Service surfaces linked from the public footers (O-S78-5).
 *
 * These pages are rendered by the Django `content` app, NOT by this SPA — they
 * are matched at the root prefix ahead of the SPA catch-all. They must always be
 * plain `<a href>`; a react-router `<Link to>` would push a client route the SPA
 * cannot resolve. Precedent: the existing `/blog` link in both footers.
 *
 * Both fields are DERIVED, not authored:
 *   path  — every `<loc>` under /services in https://www.ai-bookkeeping.ai/sitemap.xml
 *   label — that page's own BreadcrumbList JSON-LD, last item's "name"
 * Derived 2026-09-19. When a service or city page is added, re-derive from those
 * two sources rather than hand-writing an entry; the prerender guard (G6) fails
 * the build if any path here stops appearing in the prerendered footers.
 *
 * City labels are the bare city name because that is what their breadcrumb's last
 * item says. They read correctly under the "Services" column heading.
 */
export type FooterLink = { path: string; label: string };

export const FOOTER_SERVICE_LINKS: readonly FooterLink[] = [
  { path: '/services', label: 'Services' },
  { path: '/services/bookkeeping-services', label: 'Bookkeeping Services' },
  { path: '/services/bookkeeping-services-canada', label: 'Bookkeeping Services in Canada' },
  { path: '/services/online-bookkeeping-services', label: 'Online Bookkeeping Services' },
  { path: '/services/outsourced-bookkeeping-services', label: 'Outsourced Bookkeeping Services' },
  { path: '/services/bookkeeping-services/toronto', label: 'Toronto' },
  { path: '/services/bookkeeping-services/vancouver', label: 'Vancouver' },
  { path: '/services/bookkeeping-services/calgary', label: 'Calgary' },
];
