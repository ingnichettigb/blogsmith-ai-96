/**
 * Backup / ripristino manuale dello stato dell'app (analisi, prodotti, articolo).
 * Non esiste un backend: lo stato vive già in localStorage e viene salvato
 * automaticamente ad ogni modifica (vedi store.tsx). Queste funzioni servono
 * per esportare/importare uno "scatto" (snapshot) dello stato come file .json.
 */

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

export async function saveBackup(state: unknown, filename: string): Promise<SaveResult> {
  const json = JSON.stringify(state, null, 2);

  if (typeof window !== "undefined" && typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Backup BlogEngine AI", accept: { "application/json": [".json"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      addBackupHistoryEntry(filename);
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
  addBackupHistoryEntry(filename);
  return "downloaded";
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
