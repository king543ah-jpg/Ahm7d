/**
 * Application Client SDK — Realtime Sharing Channels Stub
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

export const appDataTopic = __sdk('appDataTopic');
export const takeRealtimeDropStat = __sdk('takeRealtimeDropStat');
export const onRealtimeResync = __sdk('onRealtimeResync');
export const createChannelShare = __sdk('createChannelShare');
export const makeAppDataListener = __sdk('makeAppDataListener');