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

export const all = Promise.all.bind(Promise);
export const race = Promise.race.bind(Promise);
export const resolve = Promise.resolve.bind(Promise);
export const reject = Promise.reject.bind(Promise);
