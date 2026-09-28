import { markdownToBlocks, readingTime, type Block, type Lang, type Translation } from "./blocks";
import type { Article, Product } from "./store";

/** Versione italiana (fonte) dell'articolo, in blocchi conformi allo standard. */
export function italianTranslation(a: Article, products: Product[]): Translation {
  const content: Block[] = markdownToBlocks(a.markdown);
  const p = products.find((x) => x.id === a.ctaProductId);
  if (p) content.push({ type: "cta", text: p.title, link: p.link });
  return { title: a.title, excerpt: a.excerpt, readingTime: readingTime(content), content };
}

export const folderName = (a: Article) => `${a.number}-${a.slug}`;

export function articleJson(a: Article, products: Product[]) {
  const it = italianTranslation(a, products);
  const translations: Partial<Record<Lang, Translation>> = { it };
  for (const lang of ["en", "de", "es"] as Lang[]) {
    const t = a.translations[lang];
    if (t) translations[lang] = { ...t, readingTime: it.readingTime };
  }
  return {
    number: a.number,
    slug: folderName(a),
    date: a.date,
    author: a.author,
    cover: "copertina.webp",
    coverAlt: a.coverAlt,
    translations,
  };
}

/** Converte una immagine in WebP 16:9 (minimo 1280x720) tramite canvas. */
export async function toWebp(src: string, w = 1280): Promise<Blob | null> {
  try {
    const res = await fetch(src);
    const bitmap = await createImageBitmap(await res.blob());
    const h = Math.round((w * 9) / 16);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const scale = Math.max(w / bitmap.width, h / bitmap.height);
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    ctx.drawImage(bitmap, (w - dw) / 2, (h - dh) / 2, dw, dh);
    return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/webp", 0.9));
  } catch {
    return null;
  }
}
