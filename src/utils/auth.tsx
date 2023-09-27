import { getCookie, setCookie, removeCookie } from 'typescript-cookie';

// returns access token
export const getToken = (): undefined | string => getCookie('token-ns');

// returns refresh token
export const getRefresh = (): undefined | string => getCookie('refresh-ns');

// set access token on cookies
export const setToken = (token: string): undefined | string =>
  setCookie('token-ns', token);

// set access refresh token on cookies
export const setRefresh = (refresh: string): void => {
  setCookie('refresh-ns', refresh);
};

// remove access and refresh tokens from cookies
export const removeAuth = (): void => {
  removeCookie('refresh-ns');
  removeCookie('token-ns');
};
