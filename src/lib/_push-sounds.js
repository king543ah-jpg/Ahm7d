/**
 * Application Client SDK — Push Notification Sound Channels Stub
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

export const PUSH_SOUND_IDS = __sdk('PUSH_SOUND_IDS');
export const pushSoundChannels = __sdk('pushSoundChannels');
export const isPushSound = __sdk('isPushSound');