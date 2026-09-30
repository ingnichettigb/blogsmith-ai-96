export type Block =
  | { type: "paragraph"; text: string }
  | { type: "heading2"; text: string }
  | { type: "heading3"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] }
  | { type: "image"; src: string; caption: string }
  | { type: "cta"; text: string; link: string };

export type Lang = "it" | "en" | "de" | "es";
export const LANGS: Lang[] = ["it", "en", "de", "es"];
export const LANG_LABEL: Record<Lang, string> = { it: "Italiano", en: "English", de: "Deutsch", es: "Español" };

/** Estensione fisica delle immagini esportate (standard CorporateBoostService.eu). */
export const IMG_EXT = "jpg";
export const COVER_FILE = `copertina.${IMG_EXT}`;
export const figureFile = (i: number) => `figura-${i}.${IMG_EXT}`;

export type FigureRef = { id: string; src: string; caption: string };

/** Traduzione conforme allo standard: markdown standard + metadati. */
export type Translation = {
  title: string;
  excerpt: string;
  readingTime: string;
  topics: string[];
  markdown: string;
  figures: FigureRef[];
};

const clean = (s: string) =>
  s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`/g, "").trim();

/** Converte il markdown in blocchi, solo per l'anteprima a schermo. */
export function markdownToBlocks(md: string): Block[] {
  const out: Block[] = [];
  let list: string[] = [];
  let figIdx = 0;
  const flush = () => {
    if (list.length) out.push({ type: "list", items: list });
    list = [];
  };
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    const img = line.match(/^!\[(.*?)\]\((.+?)\)$/);
    const legacy = line.match(/^\[\[FIGURA:\s*(.+?)\]\]$/);
    const li = line.match(/^(?:[-*]|\d+\.)\s+(.*)/);
    if (li) {
      list.push(clean(li[1] ?? ""));
      continue;
    }
    flush();
    if (!line) continue;
    if (img) {
      figIdx += 1;
      out.push({ type: "image", src: img[2] ?? figureFile(figIdx), caption: clean(img[1] ?? "") });
    } else if (legacy) {
      figIdx += 1;
      out.push({ type: "image", src: figureFile(figIdx), caption: clean(legacy[1] ?? "") });
    } else if (line.startsWith("### ")) out.push({ type: "heading3", text: clean(line.slice(4)) });
    else if (line.startsWith("## ")) out.push({ type: "heading2", text: clean(line.slice(3)) });
    else if (line.startsWith("# ")) out.push({ type: "heading2", text: clean(line.slice(2)) });
    else if (line.startsWith("> ")) out.push({ type: "quote", text: clean(line.slice(2)) });
    else out.push({ type: "paragraph", text: clean(line) });
  }
  flush();
  return out;
}

export function blockWords(content: Block[]): number {
  const text = content
    .map((b) => (b.type === "list" ? b.items.join(" ") : b.type === "image" ? b.caption : b.text))
    .join(" ");
  return text.split(/\s+/).filter((w) => /\p{L}|\d/u.test(w)).length;
}

/** Parole di un testo markdown (immagini e marcatori esclusi). */
export const mdWords = (md: string) => blockWords(markdownToBlocks(md));

export const readingTime = (md: string) => `${Math.max(1, Math.round(mdWords(md) / 200))} min`;

export const pad3 = (n: number) => String(Math.max(1, Math.min(999, n))).padStart(3, "0");
