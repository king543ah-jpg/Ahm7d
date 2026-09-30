/**
 * Application Client SDK — Local Storage Database & Event Bus
 */

const getCollection = (collection) => {
  try {
    const data = localStorage.getItem(`db_${collection}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const setCollection = (collection, items) => {
  try {
    localStorage.setItem(`db_${collection}`, JSON.stringify(items));
    localStorage.setItem(`live_${collection}`, JSON.stringify(items));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('db_updated'));
  } catch (e) {
    console.error(e);
  }
};

export const db = new Proxy(
  {
    insert: async (collection, doc) => {
      const items = getCollection(collection);
      const generatedId = doc.id || doc._id || Date.now().toString();
      const newDoc = { 
        ...doc,
        id: String(generatedId), 
        _id: String(generatedId),
        createdAt: doc.createdAt || new Date().toISOString()
      };
      items.push(newDoc);
      setCollection(collection, items);
      return newDoc;
    },
    select: async (collection) => getCollection(collection),
    getAll: async (collection) => getCollection(collection),
    get: async (collection, id) => {
      const items = getCollection(collection);
      if (!id) return items;
      return items.find((item) => String(item.id) === String(id) || String(item._id) === String(id)) || null;
    },
    search: async (collection, query) => {
      const items = getCollection(collection);
      if (!query) return items;
      const q = String(query).toLowerCase().trim();
      return items.filter((item) =>
        JSON.stringify(item).toLowerCase().includes(q)
      );
    },
    update: async (collection, id, updates) => {
      const items = getCollection(collection);
      const updated = items.map((item) => 
        (String(item.id) === String(id) || String(item._id) === String(id)) ? { ...item, ...updates } : item
      );
      setCollection(collection, updated);
      return updated;
    },
    delete: async (collection, id) => {
      const items = getCollection(collection);
      const filtered = items.filter((item) => String(item.id) !== String(id) && String(item._id) !== String(id));
      setCollection(collection, filtered);
      return true;
    },
  },
  {
    get: (target, prop) => {
      if (prop in target) return target[prop];
      return async () => [];
    },
  }
);

export default db;