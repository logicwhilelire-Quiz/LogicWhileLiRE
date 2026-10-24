/**
 * storageMigration.ts — LogicWhileLiRE Client Storage & State Migration
 *
 * PHASE R1 Requirement:
 * "localStorage / IndexedDB / cookie / JWT-issuer names: read the old key once,
 *  copy to the new key, then delete the old one. Existing sessions and saved exam
 *  drafts must survive."
 */

const KEY_MIGRATION_MAP: Record<string, string> = {
  lw_theme: 'logicwhilelire_theme',
  LOGICWHILELIRE_theme: 'logicwhilelire_theme',
  lw_attempt: 'logicwhilelire_attempt',
  LOGICWHILELIRE_attempt: 'logicwhilelire_attempt',
  logicwhile_auth_token: 'logicwhilelire_auth_token',
  LOGICWHILELIRE_auth_token: 'logicwhilelire_auth_token',
  logicwhile_user: 'logicwhilelire_user',
  LOGICWHILELIRE_user: 'logicwhilelire_user',
};

/**
 * Migrates localStorage keys from legacy prefixes to LogicWhileLiRE keys non-destructively.
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

    // 2. Dynamic key prefixes (e.g. lw_exam_draft_, LOGICWHILELIRE_exam_draft_)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith('lw_exam_draft_') || key.startsWith('LOGICWHILELIRE_exam_draft_')) {
        const newKey = key.replace(/^(lw_exam_draft_|LOGICWHILELIRE_exam_draft_)/, 'logicwhilelire_exam_draft_');
        const val = localStorage.getItem(key);
        if (val !== null && !localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, val);
          localStorage.removeItem(key);
        }
      }
    }
  } catch (err) {
    console.warn('[LogicWhileLiRE] Non-blocking localStorage migration notice:', err);
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
 * Safe setter that persists under the new LogicWhileLiRE key and removes any legacy key.
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
 * Migrates IndexedDB database 'lw_exam_autosave' or 'LOGICWHILELIRE_exam_autosave' to 'logicwhilelire_exam_autosave'
 */
export async function migrateIndexedDB(): Promise<void> {
  try {
    if (typeof window === 'undefined' || !window.indexedDB) return;

    const legacyDbNames = ['lw_exam_autosave', 'LOGICWHILELIRE_exam_autosave'];
    const newDbName = 'logicwhilelire_exam_autosave';

    for (const legacyDbName of legacyDbNames) {
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
    }
  } catch (err) {
    console.warn('[LogicWhileLiRE] Non-blocking IndexedDB migration notice:', err);
  }
}

/**
 * Purges legacy mock/demo exam attempts and keys from browser storage to ensure
 * clean operational state.
 */
export function purgeLegacyDemoData(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;

    // Purge known demo / mock keys
    const demoKeysToRemove = [
      'admin_exam_state_DEMO123',
      'admin_exam_state_DEMO100',
      'admin_exam_state_LW-VRSEC-2026',
      'admin_imported_questions_LW-VRSEC-2026',
      'admin_imported_questions_DEMO123',
      'logicwhile_demo_state',
    ];

    demoKeysToRemove.forEach(k => {
      try { localStorage.removeItem(k); } catch {}
    });

    // Check if stored candidate attempt belongs to demo codes
    const attemptStr = localStorage.getItem('logicwhilelire_attempt') || localStorage.getItem('lw_attempt');
    if (attemptStr) {
      try {
        const att = JSON.parse(attemptStr);
        const code = (att.examCode || '').toUpperCase();
        if (code.includes('DEMO') || code === 'LW-VRSEC-2026') {
          localStorage.removeItem('logicwhilelire_attempt');
          localStorage.removeItem('lw_attempt');
          localStorage.removeItem('student_gate_pass');
          localStorage.removeItem('candidate_gate_pass');
        }
      } catch {}
    }
  } catch (err) {
    console.warn('[LogicWhileLiRE] Demo purge notice:', err);
  }
}

/**
 * Master migration invocation called at app startup.
 */
export function runStartupMigration(): void {
  purgeLegacyDemoData();
  migrateLocalStorage();
  migrateIndexedDB().catch(() => {});
}
