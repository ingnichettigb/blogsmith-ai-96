/**
 * Backup / ripristino manuale dello stato dell'app (analisi, prodotti, articolo).
 * Non esiste un backend: lo stato vive già in localStorage e viene salvato
 * automaticamente ad ogni modifica (vedi store.tsx). Queste funzioni servono
 * per esportare/importare uno "scatto" (snapshot) dello stato come file .json.
 */

import type { Product, SponsoredLink, Rotation, State } from "./store";

export type BackupHistoryEntry = { filename: string; savedAt: string };

const HISTORY_KEY = "blogengine-backup-history-v1";
const MAX_HISTORY = 20;

// -- Cronologia (solo nomi/date dei salvataggi fatti, non i contenuti) -----

export function getBackupHistory(): BackupHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as BackupHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function addBackupHistoryEntry(filename: string): BackupHistoryEntry[] {
  const history = [{ filename, savedAt: new Date().toISOString() }, ...getBackupHistory()].slice(0, MAX_HISTORY);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {
    /* quota piena: la cronologia è solo un promemoria, non è critica */
  }
  return history;
}

/**
 * Rimuove una singola voce dalla cronologia (identificata dal timestamp,
 * unico per ogni salvataggio). Rimuove solo il promemoria elencato qui:
 * non tocca né il file già scaricato/salvato sul disco dell'utente, né i
 * dati dell'articolo/prodotti correnti.
 */
export function removeBackupHistoryEntry(savedAt: string): BackupHistoryEntry[] {
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
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
  return [];
}

// -- Nome file: AAAAMMGGHHmmBLOG-<primi 20 caratteri del titolo, o "NoTitle">.json --

// Caratteri non ammessi nei nomi file su Windows/macOS/Linux: vengono solo rimossi,
// tutto il resto del titolo (spazi, accenti, punteggiatura) resta invariato.
const FS_FORBIDDEN_CHARS = /[<>:"/\\|?*\x00-\x1F]/g;

export function generateBackupFilename(title: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
  const first20 = (title || "").trim().slice(0, 20);
  const safeTitle = first20.replace(FS_FORBIDDEN_CHARS, "").trim();
  const namePart = safeTitle.length > 0 ? safeTitle : "NoTitle";
  return `${ts}BLOG-${namePart}.json`;
}

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
      // L'utente ha annullato la finestra "Salva con nome"
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // Altri errori: prosegui con il fallback di download classico
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
  const result = await writeJsonFile(JSON.stringify(state, null, 2), filename, "Backup BlogEngine AI");
  if (result !== "cancelled") addBackupHistoryEntry(filename);
  return result;
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

// -- Pubblicità (carte sponsorizzate): file AAMMGGHHmm-PUBLICITA-<n>carte.json ----------
// Salva/ricarica solo la sezione Sponsorizzati (carte, link sorgente, rotazione),
// separatamente dal backup completo e senza toccare la sua cronologia.

export type AdsFile = {
  tipo: "blogengine-pubblicita";
  versione: 1;
  salvatoIl: string;
  products: Product[];
  sponsoredLinks: SponsoredLink[];
  rotation: Rotation;
};

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

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Legge e valida un file Pubblicità; lancia un errore comprensibile se il file non è quello giusto. */
export async function restoreAds(): Promise<Pick<State, "products" | "sponsoredLinks" | "rotation"> | null> {
  const raw = (await restoreBackup()) as Partial<AdsFile> | null;
  if (raw === null) return null;
  if (!raw || typeof raw !== "object" || raw.tipo !== "blogengine-pubblicita" || !Array.isArray(raw.products)) {
    throw new Error("Il file scelto non è un file Pubblicità valido (nome atteso: ...-PUBLICITA-...json)");
  }
  const products: Product[] = raw.products
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
  const sponsoredLinks: SponsoredLink[] = (Array.isArray(raw.sponsoredLinks) ? raw.sponsoredLinks : [])
    .filter((l): l is SponsoredLink => !!l && typeof l === "object")
    .map((l) => ({
      id: str(l.id) || crypto.randomUUID(),
      url: str(l.url),
      ...(l.lastSyncedAt ? { lastSyncedAt: str(l.lastSyncedAt) } : {}),
      ...(typeof l.cardCount === "number" ? { cardCount: l.cardCount } : {}),
    }));
  const r = raw.rotation;
  const rotation: Rotation = {
    mode: r?.mode === "random" ? "random" : "sequential",
    intervalSec: typeof r?.intervalSec === "number" ? Math.min(120, Math.max(3, r.intervalSec)) : 8,
  };
  return { products, sponsoredLinks, rotation };
}
