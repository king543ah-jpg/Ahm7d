import { supabase } from './supabase'

export async function getUserId() {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user?.id) return session.user.id
  } catch (e) {}

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const item = JSON.parse(localStorage.getItem(key) || '{}')
        if (item?.user?.id) return item.user.id
        if (item?.currentSession?.user?.id) return item.currentSession.user.id
      }
    }
  } catch (e) {}
  return null
}

export function getCurrentUserIdSync() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const item = JSON.parse(localStorage.getItem(key) || '{}')
        if (item?.user?.id) return item.user.id
        if (item?.currentSession?.user?.id) return item.currentSession.user.id
      }
    }
  } catch (e) {}
  return null
}

const getLocalCollection = (collection) => {
  try {
    const data = localStorage.getItem(`db_${collection}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const setLocalCollection = (collection, items) => {
  try {
    localStorage.setItem(`db_${collection}`, JSON.stringify(items));
    localStorage.setItem(`live_${collection}`, JSON.stringify(items));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('db_updated'));
  } catch (e) {
    console.error(e);
  }
};

export const dbImpl = {
  // مزامنة ذكية: ترفع العناصر المحلية غير المربوطة بحساب وتجلب عناصر السحابة وتدمجها
  syncCollection: async (collection) => {
    const userId = await getUserId();
    const localItems = getLocalCollection(collection);

    if (!userId) {
      return localItems;
    }

    try {
      // 1. رفع المجلدات/الوثائق المحلية التي أُنشئت بدون حساب
      const anonymousItems = localItems.filter(item => !item.user_id || item.user_id !== userId);
      
      if (anonymousItems.length > 0) {
        for (const item of anonymousItems) {
          const itemToUpload = { ...item, user_id: userId };
          await supabase.from(collection).upsert(itemToUpload, { onConflict: 'id' }).catch(() => {});
        }
      }

      // 2. جلب كل بيانات المستخدم من Supabase
      const { data: cloudItems, error } = await supabase
        .from(collection)
        .select('*')
        .eq('user_id', userId);

      if (error) {
        console.warn(`[db] Cloud sync error for ${collection}:`, error);
        return localItems;
      }

      if (cloudItems) {
        // دمج بيانات السحابة مع المحلي بدون مسح أي شيء
        const map = new Map();
        cloudItems.forEach(item => map.set(String(item.id || item._id), item));
        localItems.forEach(item => {
          const id = String(item.id || item._id);
          if (!map.has(id)) {
            map.set(id, { ...item, user_id: userId });
          }
        });

        const merged = Array.from(map.values());
        setLocalCollection(collection, merged);
        return merged;
      }
    } catch (e) {
      console.error(`[db] Sync exception for ${collection}:`, e);
    }

    return localItems;
  },

  syncAll: async () => {
    await dbImpl.syncCollection('folders');
    await dbImpl.syncCollection('documents');
    await dbImpl.syncCollection('docs');
  },

  getAll: async (collection) => {
    return await dbImpl.syncCollection(collection);
  },

  select: async (collection) => {
    return await dbImpl.syncCollection(collection);
  },

  get: async (collection, id) => {
    if (!id) return await dbImpl.getAll(collection);
    const userId = await getUserId();

    if (userId) {
      try {
        const { data, error } = await supabase
          .from(collection)
          .select('*')
          .eq('id', String(id))
          .eq('user_id', userId)
          .maybeSingle();

        if (!error && data) return data;
      } catch (e) {}
    }

    const items = getLocalCollection(collection);
    return items.find((item) => String(item.id) === String(id) || String(item._id) === String(id)) || null;
  },

  insert: async (collection, doc) => {
    const userId = (await getUserId()) || getCurrentUserIdSync();
    const generatedId = doc.id || doc._id || ('f_' + Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7));
    
    const newDoc = {
      ...doc,
      id: String(generatedId),
      _id: String(generatedId),
      user_id: userId || null,
      createdAt: doc.createdAt || new Date().toISOString()
    };

    // 1. التحديث المحلي الفوري
    const localItems = getLocalCollection(collection);
    const filtered = localItems.filter(item => String(item.id || item._id) !== String(newDoc.id));
    filtered.push(newDoc);
    setLocalCollection(collection, filtered);

    // 2. الرفع المباشر لسوبابيز
    if (userId) {
      try {
        await supabase.from(collection).upsert(newDoc, { onConflict: 'id' });
      } catch (e) {
        console.error(`[db] Insert exception in ${collection}:`, e);
      }
    }

    return newDoc;
  },

  update: async (collection, id, updates) => {
    const userId = (await getUserId()) || getCurrentUserIdSync();

    // 1. التحديث المحلي
    const localItems = getLocalCollection(collection);
    const updatedLocal = localItems.map((item) =>
      (String(item.id) === String(id) || String(item._id) === String(id)) ? { ...item, ...updates } : item
    );
    setLocalCollection(collection, updatedLocal);

    // 2. التحديث في Supabase
    if (userId) {
      try {
        await supabase
          .from(collection)
          .update(updates)
          .eq('id', String(id))
          .eq('user_id', userId);
      } catch (e) {
        console.error(`[db] Update exception in ${collection}:`, e);
      }
    }

    return updatedLocal;
  },

  delete: async (collection, id) => {
    const userId = (await getUserId()) || getCurrentUserIdSync();

    // 1. الحذف المحلي
    const localItems = getLocalCollection(collection);
    const filtered = localItems.filter((item) => String(item.id) !== String(id) && String(item._id) !== String(id));
    setLocalCollection(collection, filtered);

    // 2. الحذف من Supabase
    if (userId) {
      try {
        await supabase
          .from(collection)
          .delete()
          .eq('id', String(id))
          .eq('user_id', userId);
      } catch (e) {
        console.error(`[db] Delete exception in ${collection}:`, e);
      }
    }

    return true;
  },

  search: async (collection, query) => {
    const items = await dbImpl.getAll(collection);
    if (!query) return items;
    const q = String(query).toLowerCase().trim();
    return items.filter((item) =>
      JSON.stringify(item).toLowerCase().includes(q)
    );
  }
};

export const db = new Proxy(dbImpl, {
  get: (target, prop) => {
    if (prop in target) return target[prop];
    return async () => [];
  }
});

export default db;