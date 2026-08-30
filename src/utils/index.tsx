// O-S61-1: guard for the SSR prerender pass (no `document` in Node). In the
// browser `document` is always defined, so this evaluates exactly as before —
// browser behavior is unchanged; the 'https:' fallback only affects the
// build-time prerender, which makes no API calls.
const protocol =
  typeof document !== 'undefined' ? document.location.protocol : 'https:';
let vite_api_domain: string = import.meta.env.VITE_API_DOMAIN ?? 'http://localhost:8000';

if (protocol === 'https:' && !vite_api_domain.includes('https:')) {
  vite_api_domain = vite_api_domain.replace('http', 'https');
}

if (protocol === 'http:' && vite_api_domain.includes('https:')) {
  vite_api_domain = vite_api_domain.replace('https', 'http');
}

export const IS_HTTPS = protocol === 'https:';
export const API_DOMAIN: string = vite_api_domain;
