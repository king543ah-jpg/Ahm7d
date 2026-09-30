/**
 * Platform Client SDK — Embed Shims Stub
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

export const BLOCKED_DIALOG_MS = __sdk('BLOCKED_DIALOG_MS');
export const dialogLooksBlocked = __sdk('dialogLooksBlocked');
export const externalLinkTarget = __sdk('externalLinkTarget');
export const embedShimState = __sdk('embedShimState');
export const installEmbedShims = __sdk('installEmbedShims');