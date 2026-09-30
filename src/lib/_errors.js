/**
 * Platform Client SDK — Errors Handler Stub
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

export const sdkError = __sdk('sdkError');
export const readErrorBody = __sdk('readErrorBody');
export const codeForResponse = __sdk('codeForResponse');
export const throwFromResponse = __sdk('throwFromResponse');
export const isWall = __sdk('isWall');