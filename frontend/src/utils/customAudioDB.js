/**
 * customAudioDB.js
 * IndexedDB helper for persisting custom alarm audio songs/files locally.
 * Audio files (MP3, WAV, AAC, M4A) can be several megabytes, which exceeds
 * the 5MB localStorage quota. IndexedDB allows storing Blobs of arbitrary size safely.
 */

const DB_NAME = 'travel_alarm_audio_db';
const DB_VERSION = 1;
const STORE_NAME = 'audio_files';
const KEY_NAME = 'custom_alarm_ringtone';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (e) => {
      resolve(e.target.result);
    };

    request.onerror = (e) => {
      reject(e.target.error);
    };
  });
}

/**
 * Save custom audio file Blob to IndexedDB
 */
export async function saveCustomAudioFile(blob, fileName) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({ blob, fileName, updatedAt: Date.now() }, KEY_NAME);

      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.error('Failed to save audio file to IndexedDB:', err);
    return false;
  }
}

/**
 * Retrieve saved custom audio file from IndexedDB
 * Returns { blob, fileName } or null
 */
export async function getCustomAudioFile() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(KEY_NAME);

      req.onsuccess = (e) => {
        resolve(e.target.result || null);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn('Notice loading custom audio from IndexedDB:', err);
    return null;
  }
}

/**
 * Remove custom audio file from IndexedDB
 */
export async function deleteCustomAudioFile() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(KEY_NAME);

      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  } catch (err) {
    console.warn('Failed to delete custom audio from IndexedDB:', err);
    return false;
  }
}
