/**
 * Platform Client SDK — Gate Control Stub
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

export const GATE_STATUS_TIMEOUT_MS = __sdk('GATE_STATUS_TIMEOUT_MS');
export const clearGateToken = __sdk('clearGateToken');
export const gateSeedIsOpen = __sdk('gateSeedIsOpen');
export const gateSeedIsLocked = __sdk('gateSeedIsLocked');
export const setGateSeed = __sdk('setGateSeed');
export const handleGatedResponse = __sdk('handleGatedResponse');
export const popMagicKey = __sdk('popMagicKey');
export const fetchGateStatus = __sdk('fetchGateStatus');
export const submitGateCode = __sdk('submitGateCode');
export const _hasGateToken = __sdk('_hasGateToken');