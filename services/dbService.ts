// IndexedDB service for local file storage and persistence in the browser

const DB_NAME = "MadrasahAppDb";
const DB_VERSION = 1;
const STORE_NAME = "uploaded_files";

export interface StoredFile {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // Base64 data URL
  extractedText?: string;
  timestamp: number;
}

export const initDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("Your browser does not support IndexedDB"));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("IndexedDB open error:", event);
      reject(new Error("IndexedDB খুলতে সমস্যা হয়েছে।"));
    };

    request.onsuccess = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
  });
};

export const saveStoredFile = async (file: Omit<StoredFile, "timestamp">): Promise<StoredFile> => {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    const fullFile: StoredFile = {
      ...file,
      timestamp: Date.now()
    };

    const request = store.put(fullFile);

    request.onsuccess = () => {
      resolve(fullFile);
    };

    request.onerror = (event) => {
      console.error("Error saving file to IndexedDB:", event);
      reject(new Error("ফাইল ব্রাউজারে সংরক্ষণ করতে সমস্যা হয়েছে।"));
    };
  });
};

export const getAllStoredFiles = async (): Promise<StoredFile[]> => {
  try {
    const db = await initDb();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        // Return files sorted by newest first
        const files = (request.result || []) as StoredFile[];
        const validFiles = files.filter(f => f && typeof f === 'object' && typeof f.timestamp === 'number');
        validFiles.sort((a, b) => b.timestamp - a.timestamp);
        resolve(validFiles);
      };

      request.onerror = (event) => {
        console.error("Error reading files from IndexedDB:", event);
        reject(new Error("সংরক্ষিত ফাইল তালিকা লোড করা যায়নি।"));
      };
    });
  } catch (err) {
    console.warn("IndexedDB not available, returning empty file list", err);
    return [];
  }
};

export const getStoredFile = async (id: string): Promise<StoredFile | null> => {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);

    request.onsuccess = () => {
      resolve(request.result || null);
    };

    request.onerror = (event) => {
      console.error("Error getting file from IndexedDB:", event);
      reject(new Error("ফাইলটি ব্রাউজার থেকে পড়া যায়নি।"));
    };
  });
};

export const deleteStoredFile = async (id: string): Promise<void> => {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = (event) => {
      console.error("Error deleting file from IndexedDB:", event);
      reject(new Error("ফাইলটি মুছে ফেলা সম্ভব হয়নি।"));
    };
  });
};

export const getSampleLessonPlan = async (): Promise<{ text: string; fileName?: string; type?: string; size?: number; data?: string } | null> => {
  try {
    const file = await getStoredFile("sample_lesson_plan");
    if (file) {
      return { 
        text: file.extractedText || "", 
        fileName: file.name,
        type: file.type,
        size: file.size,
        data: file.data
      };
    }
    return null;
  } catch (err) {
    console.error("Error getting sample lesson plan from DB:", err);
    return null;
  }
};

export const saveSampleLessonPlan = async (
  text: string, 
  fileName: string = "uploaded_sample.txt",
  type: string = "text/plain",
  size: number = 0,
  dataUrl: string = ""
): Promise<void> => {
  try {
    await saveStoredFile({
      id: "sample_lesson_plan",
      name: fileName,
      type: type,
      size: size || text.length,
      data: dataUrl || ("data:text/plain;base64," + btoa(unescape(encodeURIComponent(text)))),
      extractedText: text,
      timestamp: Date.now()
    });
  } catch (err) {
    console.error("Error saving sample lesson plan to DB:", err);
    throw new Error("নমুনা পাঠ পরিকল্পনা সংরক্ষণ করতে সমস্যা হয়েছে।");
  }
};

export const deleteSampleLessonPlan = async (): Promise<void> => {
  try {
    await deleteStoredFile("sample_lesson_plan");
  } catch (err) {
    console.error("Error deleting sample lesson plan from DB:", err);
  }
};

export const clearAllStoredFiles = async (): Promise<void> => {
  const db = await initDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    // Only delete files that are NOT the sample lesson plan
    const request = store.openCursor();
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        if (cursor.key !== "sample_lesson_plan") {
          cursor.delete();
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = (event) => {
      console.error("Error clearing IndexedDB:", event);
      reject(new Error("সব ফাইল মুছে ফেলা সম্ভব হয়নি।"));
    };
  });
};

