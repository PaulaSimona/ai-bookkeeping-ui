type functionType = (num: number) => number;

/**
 * @param {number} num: float number
 * @return number: rounded to the largest
 */
export const roundUp: functionType = (num) => Math.ceil(num);

/**
 * @param {number} num: float number
 * @return number: rounded to the nearest
 */
export const roundNormal: functionType = (num) => Math.round(num);

/**
 * @param {number} num: float number
 * @return number: rounded to the smallest or equals
 */
export const roundDown: functionType = (num) => Math.floor(num);

/**
 * @param {number} num: float number
 * @param {number} dec: number of decimals, default = 2
 * @return number: rounded with a number of decimals
 */
export const round: (num: number, dec: number) => number = (
  num: number,
  dec: number = 2,
) => Math.round(num * 10 ** dec) / 10 ** dec;
