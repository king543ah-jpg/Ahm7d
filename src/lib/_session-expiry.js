/**
 * Application Client SDK — Session Expiry & Renewal Stub
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

export const SESSION_RENEW_HEADER = __sdk('SESSION_RENEW_HEADER');
export const EXPIRY_SKEW_SECONDS = __sdk('EXPIRY_SKEW_SECONDS');
export const onSessionExpired = __sdk('onSessionExpired');
export const decodeJwtExp = __sdk('decodeJwtExp');
export const isJwtExpired = __sdk('isJwtExpired');
export const sweepExpiredSession = __sdk('sweepExpiredSession');
export const absorbSessionRenewal = __sdk('absorbSessionRenewal');