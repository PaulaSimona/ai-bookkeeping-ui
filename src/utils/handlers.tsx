import { round } from './round';

/**
 * @param {number} size receive the size in bytes
 * @return {string} return a string with the value in bytes, Kb or Mb.
 */
export const getSize = (size: number) => {
  if (size > 1024 * 1024) {
    return `${round(size / 1024 / 1024)}Mb`;
  }
  if (size > 1024) {
    return `${round(size / 1024)}Kb`;
  }
  return `${size}bytes`;
};
