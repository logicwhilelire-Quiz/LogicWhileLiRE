/**
 * LogicWhileLiRE — IndexedDB Offline Answer Store & Buffer
 * Ensures zero-loss answer persistence even during network drops, tab crashes, or unexpected reloads.
 */

export interface BufferedAnswer {
  id: string; // `${examCode}_${hallTicket}_${questionId}`
  examCode: string;
  hallTicket: string;
  questionId: string;
  answer: number | string;
  type?: 'mcq' | 'code' | 'aptitude';
  synced: boolean;
  updatedAt: number;
}

const DB_NAME = 'LogicWhileLiREOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'pending_answers';

function getIndexedDB(): IDBFactory | null {
  if (typeof window === 'undefined') return null;
  return window.indexedDB || (window as unknown as { mozIndexedDB?: IDBFactory; webkitIndexedDB?: IDBFactory }).webkitIndexedDB || null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const idb = getIndexedDB();
    if (!idb) {
      return reject(new Error('IndexedDB not supported in this environment'));
    }

    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('exam_candidate', ['examCode', 'hallTicket'], { unique: false });
        store.createIndex('synced', 'synced', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Buffers an answer in IndexedDB immediately upon user interaction.
 */
export async function bufferAnswer(
  examCode: string,
  hallTicket: string,
  questionId: string,
  answer: number | string,
  type: 'mcq' | 'code' | 'aptitude' = 'mcq'
): Promise<void> {
  const cleanCode = String(examCode).trim().toUpperCase();
  const cleanHt = String(hallTicket).trim().toUpperCase();
  const id = `${cleanCode}_${cleanHt}_${questionId}`;

  const record: BufferedAnswer = {
    id,
    examCode: cleanCode,
    hallTicket: cleanHt,
    questionId: String(questionId),
    answer,
    type,
    synced: false,
    updatedAt: Date.now(),
  };

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const putReq = store.put(record);
      putReq.onsuccess = () => resolve();
      putReq.onerror = () => reject(putReq.error);
    });
  } catch (err) {
    console.warn('[OfflineDB] Failed to buffer answer to IndexedDB, fallback to localStorage:', err);
    try {
      localStorage.setItem(`logicwhilelire_ans_${id}`, JSON.stringify(record));
    } catch {
      /* storage limit reached */
    }
  }
}

/**
 * Returns all un-synced answers for the given exam session.
 */
export async function getPendingAnswers(
  examCode: string,
  hallTicket: string
): Promise<BufferedAnswer[]> {
  const cleanCode = String(examCode).trim().toUpperCase();
  const cleanHt = String(hallTicket).trim().toUpperCase();

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getAllReq = store.getAll();

      getAllReq.onsuccess = () => {
        const all: BufferedAnswer[] = getAllReq.result || [];
        const pending = all.filter(
          (item) =>
            item.examCode === cleanCode &&
            item.hallTicket === cleanHt &&
            item.synced === false
        );
        resolve(pending);
      };
      getAllReq.onerror = () => reject(getAllReq.error);
    });
  } catch {
    return [];
  }
}

/**
 * Returns all cached answers (synced and un-synced) to immediately restore student progress on reload.
 */
export async function getAllCachedAnswers(
  examCode: string,
  hallTicket: string
): Promise<Record<string, { answer: number | string; type?: string }>> {
  const cleanCode = String(examCode).trim().toUpperCase();
  const cleanHt = String(hallTicket).trim().toUpperCase();
  const result: Record<string, { answer: number | string; type?: string }> = {};

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const getAllReq = store.getAll();

      getAllReq.onsuccess = () => {
        const all: BufferedAnswer[] = getAllReq.result || [];
        for (const item of all) {
          if (item.examCode === cleanCode && item.hallTicket === cleanHt) {
            result[item.questionId] = { answer: item.answer, type: item.type };
          }
        }
        resolve();
      };
      getAllReq.onerror = () => reject(getAllReq.error);
    });
  } catch (err) {
    console.warn('[OfflineDB] Could not load cached answers from IndexedDB:', err);
  }

  return result;
}

/**
 * Marks specified buffered answers as synced.
 */
export async function markAnswersSynced(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      let completed = 0;
      for (const id of ids) {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          if (getReq.result) {
            const item: BufferedAnswer = getReq.result;
            item.synced = true;
            store.put(item);
          }
          completed++;
          if (completed === ids.length) resolve();
        };
        getReq.onerror = () => {
          completed++;
          if (completed === ids.length) resolve();
        };
      }
    });
  } catch {
    /* non-blocking */
  }
}

/**
 * Clears buffered answers upon final exam submission.
 */
export async function clearAnswerBuffer(
  examCode: string,
  hallTicket: string
): Promise<void> {
  const cleanCode = String(examCode).trim().toUpperCase();
  const cleanHt = String(hallTicket).trim().toUpperCase();

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getAllReq = store.getAll();

      getAllReq.onsuccess = () => {
        const all: BufferedAnswer[] = getAllReq.result || [];
        for (const item of all) {
          if (item.examCode === cleanCode && item.hallTicket === cleanHt) {
            store.delete(item.id);
          }
        }
        resolve();
      };
      getAllReq.onerror = () => resolve();
    });
  } catch {
    /* non-blocking */
  }
}
