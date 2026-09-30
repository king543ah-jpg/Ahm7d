/**
 * Application Client SDK — Local Files & Folders Service Implementation
 */

const getStorageData = (key) => {
  try {
    const data = localStorage.getItem(`app_${key}`);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

const setStorageData = (key, items) => {
  try {
    localStorage.setItem(`app_${key}`, JSON.stringify(items));
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('db_updated'));
  } catch (e) {
    console.error(e);
  }
};

export const files = new Proxy(
  {
    listFolders: async () => getStorageData('folders'),
    createFolder: async (folderData) => {
      const folders = getStorageData('folders');
      const newFolder = {
        id: Date.now().toString(),
        _id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        ...folderData,
      };
      folders.push(newFolder);
      setStorageData('folders', folders);
      return newFolder;
    },
    listFiles: async (folderId) => {
      const allFiles = getStorageData('files');
      if (!folderId) return allFiles;
      return allFiles.filter((f) => f.folderId === folderId);
    },
    createFile: async (fileData) => {
      const allFiles = getStorageData('files');
      const newFile = {
        id: Date.now().toString(),
        _id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        ...fileData,
      };
      allFiles.push(newFile);
      setStorageData('files', allFiles);
      return newFile;
    },
    deleteFolder: async (id) => {
      const folders = getStorageData('folders').filter((f) => f.id !== id && f._id !== id);
      setStorageData('folders', folders);
      return true;
    },
    deleteFile: async (id) => {
      const allFiles = getStorageData('files').filter((f) => f.id !== id && f._id !== id);
      setStorageData('files', allFiles);
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

export default files;