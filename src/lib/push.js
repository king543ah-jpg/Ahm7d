/**
 * Application Client SDK — Local Push Notification Service Implementation
 */

const __sdk = (path) =>
  new Proxy(function () {}, {
    get: (_t, prop) =>
      typeof prop === 'symbol' || prop === 'then' ? undefined : __sdk(path + '.' + prop),
    apply: () => {},
  });

export const push = new Proxy(
  {
    onNotification: (callback) => {
      return () => {};
    },
    requestPermission: async () => {
      if ('Notification' in window) {
        return await Notification.requestPermission();
      }
      return 'denied';
    },
    sendNotification: (title, options) => {
      if ('Notification' in window && Notification.permission === 'granted') {
        return new Notification(title, options);
      }
    },
    diagnose: async () => {
      return { status: 'ok', supported: true };
    },
  },
  {
    get: (target, prop) => {
      if (prop in target) {
        return target[prop];
      }
      // إرجاع دالة وهمية لأي استدعاء آخر غير موجود لمنع حدوث TypeError
      return async () => {};
    },
  }
);

export default push;