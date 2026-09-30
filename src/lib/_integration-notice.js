/**
 * Platform Client SDK — Integration Notice Stub
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

export const showIntegrationNotice = __sdk('showIntegrationNotice');
export const hideIntegrationNotice = __sdk('hideIntegrationNotice');
export const integrationNoticeState = __sdk('integrationNoticeState');