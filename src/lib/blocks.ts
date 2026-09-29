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

export type Translation = {
  title: string;
  excerpt: string;
  readingTime: string;
  content: Block[];
};

const clean = (s: string) =>
  s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/`/g, "").trim();

/** Converte il markdown generato in blocchi tipizzati conformi allo standard. */
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
    const fig = line.match(/^\[\[FIGURA:\s*(.+?)\]\]$/);
    const li = line.match(/^(?:[-*]|\d+\.)\s+(.*)/);
    if (li) {
      list.push(clean(li[1] ?? ""));
      continue;
    }
    flush();
    if (!line) continue;
    if (fig) {
      figIdx += 1;
      out.push({ type: "image", src: `figura-${figIdx}.webp`, caption: clean(fig[1] ?? "") });
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

export const readingTime = (content: Block[]) => `${Math.max(1, Math.round(blockWords(content) / 200))} min`;

export const pad3 = (n: number) => String(Math.max(1, Math.min(999, n))).padStart(3, "0");
