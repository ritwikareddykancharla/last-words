/** Tiny IndexedDB store shared by every Last Words app on the same site. */

import type { LanguagePack } from './pack';
import type { Card } from './srs';

const DB_NAME = 'last-words';
const VERSION = 1;
type StoreName = 'packs' | 'audio' | 'progress';

let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('packs')) d.createObjectStore('packs', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('audio')) d.createObjectStore('audio');
      if (!d.objectStoreNames.contains('progress')) d.createObjectStore('progress');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opening = null;
      reject(req.error ?? new Error('IndexedDB is unavailable'));
    };
  });
  return opening;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(store, mode);
        const req = run(t.objectStore(store));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error ?? req.error);
        t.onabort = () => reject(t.error ?? new Error('Transaction aborted'));
      }),
  );
}

export const putPack = (p: LanguagePack) => tx('packs', 'readwrite', (s) => s.put(p)).then(() => undefined);
export const getPack = (id: string) => tx<LanguagePack | undefined>('packs', 'readonly', (s) => s.get(id) as IDBRequest<LanguagePack | undefined>);
export const listPacks = () => tx<LanguagePack[]>('packs', 'readonly', (s) => s.getAll() as IDBRequest<LanguagePack[]>);
export const deletePack = (id: string) => tx('packs', 'readwrite', (s) => s.delete(id)).then(() => undefined);

export const putAudio = (key: string, blob: Blob) => tx('audio', 'readwrite', (s) => s.put(blob, key)).then(() => undefined);
export const getAudio = (key: string) => tx<Blob | undefined>('audio', 'readonly', (s) => s.get(key) as IDBRequest<Blob | undefined>);
export const deleteAudio = (key: string) => tx('audio', 'readwrite', (s) => s.delete(key)).then(() => undefined);

export const getProgress = (packId: string) =>
  tx<Record<string, Card> | undefined>('progress', 'readonly', (s) => s.get(packId) as IDBRequest<Record<string, Card> | undefined>).then((p) => p ?? {});
export const putProgress = (packId: string, cards: Record<string, Card>) => tx('progress', 'readwrite', (s) => s.put(cards, packId)).then(() => undefined);
