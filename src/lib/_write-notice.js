/**
 * Application Client SDK — Write Quota Notice Stub
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

export const showWriteLimitNotice = __sdk('showWriteLimitNotice');
export const hideWriteLimitNotice = __sdk('hideWriteLimitNotice');
export const writeNoticeState = __sdk('writeNoticeState');