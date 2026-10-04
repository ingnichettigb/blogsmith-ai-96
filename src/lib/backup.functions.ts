
/**
 * Backup / ripristino manuale dello stato dell'app (analisi, prodotti, articolo).
 * Non esiste un backend: lo stato vive già in localStorage e viene salvato
 * automaticamente ad ogni modifica (vedi store.tsx). Queste funzioni servono
 * per esportare/importare uno "scatto" (snapshot) dello stato come file .json.
 */

import type { Product, SponsoredLink, Rotation, State } from "./store";

export type BackupHistoryEntry = {
  filename: string;
  savedAt: string;
  /** true = una copia completa del salvataggio è conservata nel browser (IndexedDB) e si può ripristinare con un click. */
  hasSnapshot?: boolean;
};

export type CompleteBackupFile = {
  tipo: "blogengine-completo";
  versione: 1;
  salvatoIl: string;
  analysis: State["analysis"];
  products: State["products"];
  sponsoredLinks: State["sponsoredLinks"];
  topics: State["topics"];
  nextArticleNumber: State["nextArticleNumber"];
  rotation: State["rotation"];
  article: State["article"];
};

export type BlogBackupFile = {
  tipo: "blogengine-blog";
  versione: 1;
  salvatoIl: string;
  article: State["article"];
  nextArticleNumber?: number;
  topics?: string[];
};

export type AdsFile = {
  tipo: "blogengine-pubblicita";
  versione: 1;
  salvatoIl: string;
  products: Product[];
  sponsoredLinks: SponsoredLink[];
  rotation: Rotation;
};

const HISTORY_KEY = "blogengine-backup-history-v1";
const MAX_HISTORY = 20;

// -- Copie dei salvataggi nel browser (IndexedDB: molto più capiente di localStorage, regge le immagini) --

const DB_NAME = "blogengine-backups";
const STORE = "snapshots";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB non disponibile"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idb<T = unknown>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

const dropSnapshot = (savedAt: string) => {
  void idb("readwrite", (s) => s.delete(savedAt)).catch(() => {
    /* ignore */
  });
};

// -- Cronologia (nome/data di ogni salvataggio + copia nel browser quando disponibile) -----

export function getBackupHistory(): BackupHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as BackupHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function addBackupHistoryEntry(entry: BackupHistoryEntry): BackupHistoryEntry[] {
  const all = [entry, ...getBackupHistory()];
  const history = all.slice(0, MAX_HISTORY);
  // le voci che escono dalla lista lasciano anche lo spazio occupato dalla loro copia nel browser
  for (const old of all.slice(MAX_HISTORY)) if (old.hasSnapshot) dropSnapshot(old.savedAt);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* quota piena: la cronologia è solo un promemoria, non è critica */
  }
  return history;
}

/**
 * Rimuove una singola voce dalla cronologia (identificata dal timestamp,
 * unico per ogni salvataggio).
 */
export function removeBackupHistoryEntry(savedAt: string): BackupHistoryEntry[] {
  dropSnapshot(savedAt);
  const history = getBackupHistory().filter((h) => h.savedAt !== savedAt);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* ignore */
  }
  return history;
}

/** Svuota completamente la cronologia dei salvataggi. */
export function clearBackupHistory(): BackupHistoryEntry[] {
  void idb("readwrite", (s) => s.clear()).catch(() => {
    /* ignore */
  });
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
  return [];
}

// Caratteri non ammessi nei nomi file su Windows/macOS/Linux
const FS_FORBIDDEN_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

function cleanTitle(title: string): string {
  const first20 = (title || "").trim().slice(0, 20);
  const safeTitle = first20.replace(FS_FORBIDDEN_CHARS, "").trim();
  return safeTitle.length > 0 ? safeTitle : "NoTitle";
}

function getTimestamp12(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
}

/** Nome file: AAAAMMGGHHmm-COMPLETO-<titolo>.json */
export function generateCompleteBackupFilename(title: string): string {
  return `${getTimestamp12()}-COMPLETO-${cleanTitle(title)}.json`;
}

/** Nome file: AAAAMMGGHHmm-BLOG-<titolo>.json */
export function generateBlogBackupFilename(title: string): string {
  return `${getTimestamp12()}-BLOG-${cleanTitle(title)}.json`;
}

/** Retrocompatibilità */
export const generateBackupFilename = generateBlogBackupFilename;

// -- Salvataggio: "Salva con nome" se il browser lo supporta, altrimenti download --

type SaveFilePickerOptions = {
  suggestedName?: string;
  types?: { description: string; accept: Record<string, string[]> }[];
};
type FileSystemWritable = { write: (data: string) => Promise<void>; close: () => Promise<void> };
type FileSystemHandleLike = { createWritable: () => Promise<FileSystemWritable> };

declare global {
  interface Window {
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemHandleLike>;
  }
}

export type SaveResult = "saved" | "downloaded" | "cancelled";

async function writeJsonFile(json: string, filename: string, description: string): Promise<SaveResult> {
  if (typeof window !== "undefined" && typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description, accept: { "application/json": [".json"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return "saved";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
}

export async function saveBackup(state: unknown, filename: string): Promise<SaveResult> {
  const json = JSON.stringify(state, null, 2);
  const result = await writeJsonFile(json, filename, "Backup BlogEngine AI");
  if (result !== "cancelled") {
    const savedAt = new Date().toISOString();
    let hasSnapshot = false;
    try {
      await idb("readwrite", (s) => s.put(json, savedAt));
      hasSnapshot = true;
    } catch {
      /* copia nel browser non riuscita: resta valido il file sul dispositivo */
    }
    addBackupHistoryEntry({ filename, savedAt, hasSnapshot });
  }
  return result;
}

/** Salva tutto lo stato dell'app (Analisi + Sponsorizzati + Argomenti + Articolo + Social) */
export async function saveCompleteBackup(state: State, filename: string): Promise<SaveResult> {
  const file: CompleteBackupFile = {
    tipo: "blogengine-completo",
    versione: 1,
    salvatoIl: new Date().toISOString(),
    analysis: state.analysis,
    products: state.products,
    sponsoredLinks: state.sponsoredLinks,
    topics: state.topics,
    nextArticleNumber: state.nextArticleNumber,
    rotation: state.rotation,
    article: state.article,
  };
  return saveBackup(file, filename);
}

/** Salva solo l'articolo attuale con le sue traduzioni, argomenti e post/media social */
export async function saveBlogBackup(
  data: { article: State["article"]; nextArticleNumber?: number; topics?: string[] },
  filename: string,
): Promise<SaveResult> {
  const file: BlogBackupFile = {
    tipo: "blogengine-blog",
    versione: 1,
    salvatoIl: new Date().toISOString(),
    article: data.article,
    nextArticleNumber: data.nextArticleNumber,
    topics: data.topics,
  };
  return saveBackup(file, filename);
}

// -- Ripristino: l'utente sceglie il file .json da ricaricare --------------

export async function restoreBackup(): Promise<unknown | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      try {
        const text = await file.text();
        resolve(JSON.parse(text));
      } catch {
        reject(new Error("Il file scelto non è un backup valido"));
      }
    };
    input.click();
  });
}

/**
 * Ripristina una voce della cronologia. Se la copia è nel browser il ripristino è immediato;
 * altrimenti si apre la scelta del file .json.
 */
export async function restoreFromHistory(entry: BackupHistoryEntry): Promise<{ data: unknown; fromFile: boolean } | null> {
  if (entry.hasSnapshot) {
    try {
      const json = await idb<string | undefined>("readonly", (s) => s.get(entry.savedAt));
      if (typeof json === "string") return { data: JSON.parse(json), fromFile: false };
    } catch {
      /* passa alla scelta del file */
    }
  }
  const data = await restoreBackup();
  return data === null ? null : { data, fromFile: true };
}

// -- Riconoscimento intelligente del tipo di backup --------------------------

export type SmartRestoreResult =
  | { type: "completo"; data: Partial<State>; label: string }
  | { type: "blog"; data: Partial<State>; label: string }
  | { type: "pubblicita"; data: Pick<State, "products" | "sponsoredLinks" | "rotation">; label: string }
  | { type: "legacy"; data: Partial<State>; label: string };

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function classifyBackup(raw: unknown): SmartRestoreResult {
  if (!raw || typeof raw !== "object") {
    throw new Error("Il file scelto non è un formato JSON valido");
  }
  const obj = raw as Record<string, unknown>;

  // 1. Pubblicità (file delle sole sponsorizzate)
  if (obj.tipo === "blogengine-pubblicita" || (Array.isArray(obj.products) && !obj.article)) {
    const rawProducts = Array.isArray(obj.products) ? obj.products : [];
    const products: Product[] = rawProducts
      .filter((p): p is Product => !!p && typeof p === "object")
      .map((p) => ({
        id: str(p.id) || crypto.randomUUID(),
        title: str(p.title),
        description: str(p.description),
        badge: str(p.badge),
        link: str(p.link),
        image: str(p.image),
        ...(p.sourceLinkId ? { sourceLinkId: str(p.sourceLinkId) } : {}),
      }))
      .filter((p) => p.title || p.link);

    const rawLinks = Array.isArray(obj.sponsoredLinks) ? obj.sponsoredLinks : [];
    const sponsoredLinks: SponsoredLink[] = rawLinks
      .filter((l): l is SponsoredLink => !!l && typeof l === "object")
      .map((l) => ({
        id: str(l.id) || crypto.randomUUID(),
        url: str(l.url),
        ...(l.lastSyncedAt ? { lastSyncedAt: str(l.lastSyncedAt) } : {}),
        ...(typeof l.cardCount === "number" ? { cardCount: l.cardCount } : {}),
      }));

    const r = obj.rotation as Rotation | undefined;
    const rotation: Rotation = {
      mode: r?.mode === "random" ? "random" : "sequential",
      intervalSec: typeof r?.intervalSec === "number" ? Math.min(120, Math.max(3, r.intervalSec)) : 8,
    };

    return {
      type: "pubblicita",
      data: { products, sponsoredLinks, rotation },
      label: `Pubblicità (${products.length} carte)`,
    };
  }

  // 2. Solo Blog (tipo esplicito o ha article senza products/analysis)
  if (obj.tipo === "blogengine-blog" || (obj.article && !obj.products && !obj.analysis)) {
    const partial: Partial<State> = {
      article: obj.article as State["article"],
    };
    if (typeof obj.nextArticleNumber === "number") partial.nextArticleNumber = obj.nextArticleNumber;
    if (Array.isArray(obj.topics)) partial.topics = obj.topics as string[];
    const title = (obj.article as { title?: string })?.title || "Senza titolo";
    return {
      type: "blog",
      data: partial,
      label: `Articolo Blog ("${title.slice(0, 30)}")`,
    };
  }

  // 3. Completo esplicito
  if (obj.tipo === "blogengine-completo") {
    return {
      type: "completo",
      data: obj as unknown as Partial<State>,
      label: "Backup Completo (Analisi, Sponsorizzati, Blog e Social)",
    };
  }

  // 4. Completo legacy (ha sia article sia products o analysis)
  if (obj.article && (obj.products || obj.analysis !== undefined)) {
    return {
      type: "completo",
      data: obj as unknown as Partial<State>,
      label: "Backup Completo (archivio)",
    };
  }

  // 5. Fallback generico
  return {
    type: "legacy",
    data: obj as Partial<State>,
    label: "Backup",
  };
}

// -- Pubblicità (carte sponsorizzate): file AAMMGGHHmm-PUBLICITA-<n>carte.json ----------

export function generateAdsFilename(cardCount: number): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${pad(d.getFullYear() % 100)}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `${ts}-PUBLICITA-${cardCount}carte.json`;
}

export async function saveAds(data: Pick<State, "products" | "sponsoredLinks" | "rotation">, filename: string): Promise<SaveResult> {
  const file: AdsFile = {
    tipo: "blogengine-pubblicita",
    versione: 1,
    salvatoIl: new Date().toISOString(),
    products: data.products,
    sponsoredLinks: data.sponsoredLinks,
    rotation: data.rotation,
  };
  return writeJsonFile(JSON.stringify(file, null, 2), filename, "Pubblicità BlogEngine AI");
}

export async function restoreAds(): Promise<Pick<State, "products" | "sponsoredLinks" | "rotation"> | null> {
  const raw = await restoreBackup();
  if (raw === null) return null;
  const classified = classifyBackup(raw);
  if (classified.type !== "pubblicita") {
    throw new Error("Il file scelto non è un file Pubblicità valido (nome atteso: ...-PUBLICITA-...json)");
  }
  return classified.data;
}
