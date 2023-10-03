const protocol = document.location.protocol;
let vite_api_domain: string = import.meta.env.VITE_API_DOMAIN;

if (protocol == 'https:' && !vite_api_domain.includes('https:')) {
  vite_api_domain = vite_api_domain.replace('http', 'https');
}

if (protocol == 'http:' && vite_api_domain.includes('https:')) {
  vite_api_domain = vite_api_domain.replace('https', 'http');
}

export const IS_HTTPS = protocol == 'https:';
export const API_DOMAIN: string = vite_api_domain;
