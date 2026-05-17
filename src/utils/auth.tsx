const TOKEN_KEY   = 'ai-bk-token';
const REFRESH_KEY = 'ai-bk-refresh';

export const getToken   = (): string | undefined => localStorage.getItem(TOKEN_KEY)   ?? undefined;
export const getRefresh = (): string | undefined => localStorage.getItem(REFRESH_KEY) ?? undefined;

export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const setRefresh = (refresh: string): void => localStorage.setItem(REFRESH_KEY, refresh);

export const removeAuth = (): void => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
};
