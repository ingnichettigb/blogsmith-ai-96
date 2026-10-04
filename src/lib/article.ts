import { COVER_FILE, figureFile, readingTime, type FigureRef, type Lang, type Translation } from "./blocks";
import type { Article } from "./store";

/**
 * Markdown conforme allo standard: i segnaposto [[FIGURA: ...]] diventano
 * immagini markdown con il nome del file fisico (figura-1.jpg, figura-2.jpg...).
 */
export function normalizedMarkdown(a: Article): string {
  let i = 0;
  const IMG = /(!\[[^\]]*\]\(figura-\d+\.[a-z0-9]+\))/gi;
  return a.markdown
    .replace(/^[ \t]*\[\[FIGURA:\s*(.+?)\]\][ \t]*$/gm, (_m, cap: string) => {
      const caption = (a.figures[i]?.caption || cap || "").trim();
      i += 1;
      return `![${caption}](${figureFile(i)})`;
    })
    // ogni immagine resta un blocco a sé: riga vuota prima e dopo
    .replace(new RegExp(`([^\\n])\\n${IMG.source}`, "gi"), "$1\n\n$2")
    .replace(new RegExp(`${IMG.source}\\n([^\\n])`, "gi"), "$1\n\n$2")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function figureRefs(a: Article): FigureRef[] {
  return a.figures.map((f, i) => ({ id: `figura-${i + 1}`, src: figureFile(i + 1), caption: f.caption }));
}

/** Figure di una traduzione: stessi id e file dell'italiano, ma didascalia tradotta se disponibile. */
export function mergeFigures(base: FigureRef[], translated?: FigureRef[]): FigureRef[] {
  return base.map((f, i) => ({ ...f, caption: translated?.[i]?.caption?.trim() || f.caption }));
}

/** Versione italiana (fonte) dell'articolo. */
export function italianTranslation(a: Article): Translation {
  const markdown = normalizedMarkdown(a);
  return {
    title: a.title,
    excerpt: a.excerpt,
    readingTime: readingTime(markdown),
    topics: a.topics ?? [],
    markdown,
    figures: figureRefs(a),
  };
}

export const folderName = (a: Article) => `${a.number || "001"}-${a.slug || "slug"}`;

export function articleJson(a: Article) {
  const it = italianTranslation(a);
  const translations: Partial<Record<Lang, Translation>> = { it };
  for (const lang of ["en", "de", "es"] as Lang[]) {
    const t = a.translations[lang];
    if (t) translations[lang] = { ...t, readingTime: it.readingTime, figures: mergeFigures(it.figures, t.figures) };
  }
  return {
    number: a.number || "001",
    slug: folderName(a),
    date: a.date,
    author: a.author,
    cover: COVER_FILE,
    coverAlt: a.coverAlt,
    translations,
  };
}

/**
 * Converte una immagine in JPEG 16:9 (minimo 1280x720) tramite canvas,
 * abbassando la qualità finché il file non sta sotto il limite richiesto.
 */
export async function toJpeg(src: string, w = 1600, maxBytes = 300 * 1024): Promise<Blob | null> {
  try {
    const res = await fetch(src);
    const bitmap = await createImageBitmap(await res.blob());
    const width = Math.max(1280, w);
    const height = Math.round((width * 9) / 16);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    const scale = Math.max(width / bitmap.width, height / bitmap.height);
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    ctx.drawImage(bitmap, (width - dw) / 2, (height - dh) / 2, dw, dh);
    let blob: Blob | null = null;
    for (const q of [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]) {
      blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", q));
      if (blob && blob.size <= maxBytes) return blob;
    }
    return blob;
  } catch {
    return null;
  }
}

/**
 * Riduce un'immagine (data URL o URL) a JPEG di larghezza massima `maxW`, per non riempire
 * la memoria del browser (le immagini AI arrivano come PNG molto pesanti). In caso di errore
 * restituisce l'originale.
 */
export async function shrinkToJpegDataUrl(src: string, maxW = 1600, quality = 0.82): Promise<string> {
  try {
    const bitmap = await createImageBitmap(await (await fetch(src)).blob());
    const scale = Math.min(1, maxW / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return src;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } catch {
    return src;
  }
}
