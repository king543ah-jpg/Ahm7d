import { supabase } from './supabase'

/**
 * جلب معرف المستخدم الحالي من جلسة Supabase المحفوظة
 */
const getCurrentUserId = () => {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const session = JSON.parse(localStorage.getItem(key) || '{}')
        if (session?.user) return session.user.id
      }
    }
  } catch (e) {}
  return null
}

/**
 * التخزين المحلي المؤقت (Local Cache)
 */
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
  // جلب البيانات من السحابة (Supabase) وتحديث الكاش المحلي
  getAll: async (collection) => {
    const userId = getCurrentUserId();
    if (!userId) return getLocalCollection(collection);

    try {
      const { data, error } = await supabase
        .from(collection)
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;

      if (data) {
        setLocalCollection(collection, data);
        return data;
      }
    } catch (e) {
      console.warn(`[db] Fetching ${collection} from Supabase failed, using cache:`, e);
    }
    return getLocalCollection(collection);
  },

  select: async (collection) => {
    return dbImpl.getAll(collection);
  },

  get: async (collection, id) => {
    if (!id) return dbImpl.getAll(collection);
    const userId = getCurrentUserId();

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

  // إضافة عنصر جديد وسحبه إلى السحابة فوراً
  insert: async (collection, doc) => {
    const userId = getCurrentUserId();
    const generatedId = doc.id || doc._id || (Date.now().toString() + Math.random().toString(36).substring(2, 6));
    
    const newDoc = {
      ...doc,
      id: String(generatedId),
      _id: String(generatedId),
      user_id: userId,
      createdAt: doc.createdAt || new Date().toISOString()
    };

    // 1. التحديث المحلي السريع
    const localItems = getLocalCollection(collection);
    localItems.push(newDoc);
    setLocalCollection(collection, localItems);

    // 2. الرفع إلى Supabase
    if (userId) {
      try {
        const { error } = await supabase.from(collection).insert([newDoc]);
        if (error) console.error(`[db] Insert error in ${collection}:`, error);
      } catch (e) {
        console.error(`[db] Insert exception in ${collection}:`, e);
      }
    }

    return newDoc;
  },

  // تعديل عنصر في السحابة وفي الكاش
  update: async (collection, id, updates) => {
    const userId = getCurrentUserId();

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

  // حذف عنصر من السحابة وفي الكاش
  delete: async (collection, id) => {
    const userId = getCurrentUserId();

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