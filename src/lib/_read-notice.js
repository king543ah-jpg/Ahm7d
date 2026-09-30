/**
 * Application Client SDK — Read Quota Notice Stub
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

export const showReadLimitNotice = __sdk('showReadLimitNotice');
export const hideReadLimitNotice = __sdk('hideReadLimitNotice');
export const readNoticeState = __sdk('readNoticeState');