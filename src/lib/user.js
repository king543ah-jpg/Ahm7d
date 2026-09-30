/**
 * Application Client SDK — User Authentication & Identity Stub
 */

const __sdk = (path) =>
  new Proxy(function () {}, {
    get: (_t, prop) =>
      typeof prop === 'symbol' || prop === 'then' ? undefined : __sdk(path + '.' + prop),
    apply: () => {
      throw new Error(
        '`' + path + '` runs on the application platform and is not available in standalone export.'
      );
    },
  });

export const getAppUserId = __sdk('getAppUserId');
export const getAnonymousId = __sdk('getAnonymousId');