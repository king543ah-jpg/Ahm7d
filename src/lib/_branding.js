/**
 * Platform Client SDK — Application Branding Stub
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

export const brandingHidden = __sdk('brandingHidden');
export const brandingKnown = __sdk('brandingKnown');
export const onBrandingChange = __sdk('onBrandingChange');
export const refreshBranding = __sdk('refreshBranding');