/**
 * Application Client SDK — Realtime Options & Reauth Stub
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

export const realtimeClientOptions = __sdk('realtimeClientOptions');
export const registerRealtimeClient = __sdk('registerRealtimeClient');
export const reauthRealtimeClients = __sdk('reauthRealtimeClients');
export const _realtimeClientCount = __sdk('_realtimeClientCount');