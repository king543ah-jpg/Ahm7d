/**
 * Application Client SDK — OAuth Return Router Stub
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

export const MAX_RETURN_PATH = __sdk('MAX_RETURN_PATH');
export const safeReturnPath = __sdk('safeReturnPath');
export const currentReturnPath = __sdk('currentReturnPath');
export const parseOAuthReturnHash = __sdk('parseOAuthReturnHash');