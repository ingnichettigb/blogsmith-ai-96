import { createServerFn } from "@tanstack/react-start";
import { decodeHtmlEntities } from "./utils";

/**
 * Legge una pagina web indicata dall'utente (es. la sua landing page) per usarla
 * come spunto/contesto nella generazione dell'articolo: SOLO testo leggibile
 * (l'AI lo riscrive con parole proprie, non lo copia) ed elenco delle immagini
 * trovate, che l'utente può scegliere di riusare o meno tramite una spunta in UI.
 */

export type ReferencePage = { url: string; text: string; images: string[] };

const UA = "Mozilla/5.0 (compatible; BlogEngineAI/1.0)";
const MAX_TEXT_CHARS = 6000;
const MAX_IMAGES = 20;

function abs(base: string, href: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function extractText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|header|footer)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|br|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeHtmlEntities(stripped)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_TEXT_CHARS);
}

function extractImages(html: string, base: string): string[] {
  const found: string[] = [];
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) {
    const src = m[1];
    if (!src || src.startsWith("data:")) continue;
    const url = abs(base, src);
    // scarta icone/loghi molto piccoli o probabili tracker da 1x1
    if (/\b(1x1|pixel|spacer|favicon)\b/i.test(url)) continue;
    if (!found.includes(url)) found.push(url);
    if (found.length >= MAX_IMAGES) break;
  }
  return found;
}

export const fetchReferencePage = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => {
    let u = String(d.url ?? "").trim();
    if (!u) throw new Error("Inserisci un URL");
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    const parsed = new URL(u);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("URL non valido");
    return { url: parsed.toString() };
  })
  .handler(async ({ data }): Promise<ReferencePage> => {
    const res = await fetch(data.url, { headers: { "user-agent": UA }, redirect: "follow" });
    if (!res.ok) throw new Error(`La pagina di riferimento ha risposto con errore ${res.status}`);
    const html = (await res.text()).slice(0, 800_000);
    const base = res.url || data.url;
    return { url: base, text: extractText(html), images: extractImages(html, base) };
  });
