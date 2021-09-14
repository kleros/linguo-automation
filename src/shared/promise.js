import { curry, unary } from 'ramda';

const allSettledPolyfill = arrP =>
  Promise.all(
    arrP.map(async p => {
      try {
        return {
          status: 'fulfilled',
          value: await p,
        };
      } catch (err) {
        return {
          status: 'rejected',
          reason: err,
        };
      }
    })
  );

export const allSettled =
  typeof Promise.allSettled === 'function' ? Promise.allSettled.bind(Promise) : allSettledPolyfill;

export const all = unary(Promise.all.bind(Promise));
export const race = unary(Promise.race.bind(Promise));
export const resolve = unary(Promise.resolve.bind(Promise));
export const reject = unary(Promise.reject.bind(Promise));
export const map = curry(async (fn, arr) => await Promise.all(arr.map(item => fn(item))));
export const mapSeries = curry(async (fn, arr) => {
  const result = [];
  let index = 0;

  for (const item of arr) {
    result.push(await fn(await item, index++));
  }

  return result;
});
