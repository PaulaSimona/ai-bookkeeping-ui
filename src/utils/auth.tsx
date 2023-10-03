import { getCookie, setCookie, removeCookie } from 'typescript-cookie';
import { IS_HTTPS } from './index';

const token_name = `token-bk${IS_HTTPS ? 's' : ''}`;
const refresh_name = `refresh-bk${IS_HTTPS ? 's' : ''}`;

// returns access token
export const getToken = (): undefined | string => getCookie(token_name);

// returns refresh token
export const getRefresh = (): undefined | string => getCookie(refresh_name);

// set access token on cookies
export const setToken = (token: string): undefined | string =>
  setCookie(token_name, token);

// set access refresh token on cookies
export const setRefresh = (refresh: string): void => {
  setCookie(refresh_name, refresh);
};

// remove access and refresh tokens from cookies
export const removeAuth = (): void => {
  removeCookie(refresh_name);
  removeCookie(token_name);
};

// refresh
/* 
{detail: "Token is invalid or expired", code: "token_not_valid"}
code: "token_not_valid"
detail: "Token is invalid or expired"
*/

// me

/* 
{
    "detail": "Given token not valid for any token type",
    "code": "token_not_valid",
    "messages": [
        {
            "token_class": "AccessToken",
            "token_type": "access",
            "message": "Token is invalid or expired"
        }
    ]
}
*/
