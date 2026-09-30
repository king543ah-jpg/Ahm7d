import { useState, useEffect } from 'react';
import { db } from './db';

export function useLive(key, initialValue = []) {
  const readData = () => {
    try {
      const liveData = localStorage.getItem(`live_${key}`);
      if (liveData !== null) return JSON.parse(liveData);
      
      const dbData = localStorage.getItem(`db_${key}`);
      if (dbData !== null) return JSON.parse(dbData);

      return initialValue;
    } catch (e) {
      return initialValue;
    }
  };

  const [data, setData] = useState(readData);

  useEffect(() => {
    let isMounted = true;

    // طلب مزامنة فورية في الخلفية مع السحابة عند تحميل الشاشة
    const syncFromCloud = async () => {
      try {
        if (db && typeof db.syncCollection === 'function') {
          const freshData = await db.syncCollection(key);
          if (isMounted && freshData) {
            setData(freshData);
          }
        }
      } catch (e) {
        console.warn(`[useLive] Sync warning for ${key}:`, e);
      }
    };

    syncFromCloud();

    const handleUpdate = () => {
      if (isMounted) {
        setData(readData());
      }
    };

    window.addEventListener('storage', handleUpdate);
    window.addEventListener('db_updated', handleUpdate);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleUpdate);
      window.removeEventListener('db_updated', handleUpdate);
    };
  }, [key]);

  const updateData = (newValue) => {
    try {
      const valueToStore = typeof newValue === 'function' ? newValue(data) : newValue;
      setData(valueToStore);
      localStorage.setItem(`live_${key}`, JSON.stringify(valueToStore));
      localStorage.setItem(`db_${key}`, JSON.stringify(valueToStore));
      window.dispatchEvent(new Event('db_updated'));
    } catch (e) {
      console.error(e);
    }
  };

  const result = {
    data: Array.isArray(data) ? data : [],
    loading: false,
    updateData,
    [Symbol.iterator]: function* () {
      yield Array.isArray(data) ? data : [];
      yield updateData;
    }
  };

  return result;
}

export function useLiveShared(key, initialValue) {
  return useLive(key, initialValue);
}

export default useLive;