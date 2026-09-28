/**
 * storageMigration.ts — GROWTHRAN Client Storage & State Migration
 *
 * PHASE R1 Requirement:
 * "localStorage / IndexedDB / cookie / JWT-issuer names: read the old key once,
 *  copy to the new key, then delete the old one. Existing sessions and saved exam
 *  drafts must survive."
 */

const KEY_MIGRATION_MAP: Record<string, string> = {
  lw_theme: 'growthran_theme',
  lw_attempt: 'growthran_attempt',
  logicwhile_auth_token: 'growthran_auth_token',
  logicwhile_user: 'growthran_user',
};

/**
 * Migrates localStorage keys from legacy prefixes to GROWTHRAN keys non-destructively.
 */
export function migrateLocalStorage(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;

    // 1. Direct key mappings
    for (const [oldKey, newKey] of Object.entries(KEY_MIGRATION_MAP)) {
      const oldVal = localStorage.getItem(oldKey);
      if (oldVal !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, oldVal);
        localStorage.removeItem(oldKey);
      }
    }

    // 2. Dynamic key prefixes (e.g. lw_exam_draft_, exam_tab_)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith('lw_exam_draft_')) {
        const newKey = key.replace('lw_exam_draft_', 'growthran_exam_draft_');
        const val = localStorage.getItem(key);
        if (val !== null && !localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, val);
          localStorage.removeItem(key);
        }
      }
    }
  } catch (err) {
    console.warn('[GROWTHRAN] Non-blocking localStorage migration notice:', err);
  }
}

/**
 * Safe getter that reads new key, falls back to legacy key, and migrates on the fly.
 */
export function getStorageItem(key: string, legacyKey?: string): string | null {
  try {
    const val = localStorage.getItem(key);
    if (val !== null) return val;
    if (legacyKey) {
      const legacyVal = localStorage.getItem(legacyKey);
      if (legacyVal !== null) {
        localStorage.setItem(key, legacyVal);
        localStorage.removeItem(legacyKey);
        return legacyVal;
      }
    }
  } catch {}
  return null;
}

/**
 * Safe setter that persists under the new GROWTHRAN key and removes any legacy key.
 */
export function setStorageItem(key: string, value: string, legacyKey?: string): void {
  try {
    localStorage.setItem(key, value);
    if (legacyKey) {
      localStorage.removeItem(legacyKey);
    }
  } catch {}
}

/**
 * Migrates IndexedDB database 'lw_exam_autosave' to 'growthran_exam_autosave'
 */
export async function migrateIndexedDB(): Promise<void> {
  try {
    if (typeof window === 'undefined' || !window.indexedDB) return;

    const legacyDbName = 'lw_exam_autosave';
    const newDbName = 'growthran_exam_autosave';

    // Check if legacy DB exists by opening it
    const req = indexedDB.open(legacyDbName);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('pending_saves')) {
        db.close();
        return;
      }

      const tx = db.transaction('pending_saves', 'readonly');
      const store = tx.objectStore('pending_saves');
      const getAllReq = store.getAll();

      getAllReq.onsuccess = () => {
        const records = getAllReq.result || [];
        db.close();

        if (records.length > 0) {
          const newReq = indexedDB.open(newDbName, 1);
          newReq.onupgradeneeded = () => {
            if (!newReq.result.objectStoreNames.contains('pending_saves')) {
              newReq.result.createObjectStore('pending_saves', { keyPath: 'id' });
            }
          };
          newReq.onsuccess = () => {
            const newDb = newReq.result;
            const newTx = newDb.transaction('pending_saves', 'readwrite');
            const newStore = newTx.objectStore('pending_saves');
            records.forEach(r => newStore.put(r));
            newTx.oncomplete = () => {
              newDb.close();
              try { indexedDB.deleteDatabase(legacyDbName); } catch {}
            };
          };
        } else {
          try { indexedDB.deleteDatabase(legacyDbName); } catch {}
        }
      };
    };
  } catch (err) {
    console.warn('[GROWTHRAN] Non-blocking IndexedDB migration notice:', err);
  }
}

/**
 * Master migration invocation called at app startup.
 */
export function runStartupMigration(): void {
  migrateLocalStorage();
  migrateIndexedDB().catch(() => {});
}
