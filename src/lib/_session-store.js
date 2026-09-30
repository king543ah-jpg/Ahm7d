/**
 * Application Client SDK — Session Storage Manager Stub
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

export const storeGet = __sdk('storeGet');
export const storeSet = __sdk('storeSet');
export const storeRemove = __sdk('storeRemove');
export const storageDenied = __sdk('storageDenied');
export const probeStorage = __sdk('probeStorage');
export const _resetSessionStore = __sdk('_resetSessionStore');