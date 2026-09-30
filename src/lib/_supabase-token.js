/**
 * Application Client SDK — Supabase Token Handler Stub
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

export const getSupabaseToken = __sdk('getSupabaseToken');
export const setSupabaseToken = __sdk('setSupabaseToken');
export const clearSupabaseToken = __sdk('clearSupabaseToken');