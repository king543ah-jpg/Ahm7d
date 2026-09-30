/**
 * Application Client SDK — Reactive Live State Integration
 */
import { useState, useEffect } from 'react';

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
    const handleUpdate = () => {
      setData(readData());
    };

    window.addEventListener('storage', handleUpdate);
    window.addEventListener('db_updated', handleUpdate);

    return () => {
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

  // كائن هجين يدعم التفكيك المباشر وتفادي خطأ Array.isArray في الواجهة
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