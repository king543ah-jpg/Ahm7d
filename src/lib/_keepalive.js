/**
 * Application Client SDK — Keepalive Connection Handler Stub
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

export const KEEPALIVE_HEADERS = __sdk('KEEPALIVE_HEADERS');
export const isKeepaliveEnvelope = __sdk('isKeepaliveEnvelope');
export const unwrapKeepalive = __sdk('unwrapKeepalive');
export const DEFAULT_KEEPALIVE_BODY_TIMEOUT_MS = __sdk('DEFAULT_KEEPALIVE_BODY_TIMEOUT_MS');
export const readKeepaliveJson = __sdk('readKeepaliveJson');
export const throwFromEnvelope = __sdk('throwFromEnvelope');