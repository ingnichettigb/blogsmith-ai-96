import { createServerFn } from "@tanstack/react-start";
import { decodeHtmlEntities } from "./utils";

/**
 * Legge una pagina web indicata dall'utente (es. la pagina "Applicazioni" del suo
 * sito) e ne estrae le "carte" così come sono organizzate nella pagina: titolo,
 * descrizione, link di destinazione e immagine, per popolare in automatico la
 * rotazione sponsorizzata. Euristica basata su regex (nessuna libreria DOM,
 * coerente con reference.functions.ts): per ogni titolo (h1-h4) individua il
 * paragrafo, il link e l'eventuale immagine più vicini nel markup.
 */

export type SponsoredCard = { title: string; description: string; link: string; image: string };

const UA = "Mozilla/5.0 (compatible; BlogEngineAI/1.0)";
const MAX_CARDS = 12;
const LOOKBACK = 800;
const LOOKAHEAD = 4000;

function abs(base: string, href: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function textOf(fragment: string) {
  return decodeHtmlEntities(fragment.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function stripNoise(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<(nav|header|footer)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function isRealLink(href: string) {
  return !!href && !href.startsWith("#") && !/^(mailto:|tel:|javascript:)/i.test(href);
}

function extractCards(html: string, base: string): SponsoredCard[] {
  const cleaned = stripNoise(html);
  const headingRe = /<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings = [...cleaned.matchAll(headingRe)];
  const cards: SponsoredCard[] = [];
  const seenLinks = new Set<string>();

  for (let i = 0; i < headings.length && cards.length < MAX_CARDS; i++) {
    const h = headings[i];
    if (!h || h.index === undefined) continue;
    const title = textOf(h[2] ?? "");
    if (!title || title.length > 100) continue;

    const blockStart = h.index + h[0].length;
    const next = headings[i + 1];
    const blockEnd = Math.min(next?.index ?? cleaned.length, blockStart + LOOKAHEAD);
    const block = cleaned.slice(blockStart, blockEnd);

    const pMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    let description = pMatch ? textOf(pMatch[1] ?? "") : textOf(block.split(/<a\b/i)[0] ?? "");
    if (description.length > 280) description = description.slice(0, 280).trim() + "…";

    let link = "";
    for (const am of block.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
      const href = am[1] ?? "";
      if (isRealLink(href)) {
        link = abs(base, href);
        break;
      }
    }
    if (!link) {
      const pre = cleaned.slice(Math.max(0, h.index - 300), h.index);
      const preLinks = [...pre.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)];
      const lastPre = preLinks[preLinks.length - 1];
      const href = lastPre?.[1] ?? "";
      if (isRealLink(href)) link = abs(base, href);
    }
    if (!link || seenLinks.has(link)) continue;

    const pre2 = cleaned.slice(Math.max(0, h.index - LOOKBACK), h.index);
    const imgs = [...pre2.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)];
    const lastImg = imgs[imgs.length - 1]?.[1] ?? "";
    let image = lastImg ? abs(base, lastImg) : "";
    if (image.startsWith("data:") || /\b(1x1|pixel|spacer|favicon)\b/i.test(image)) image = "";

    seenLinks.add(link);
    cards.push({ title, description, link, image });
  }
  return cards;
}

export const fetchSponsoredCards = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => {
    let u = String(d.url ?? "").trim();
    if (!u) throw new Error("Inserisci un URL");
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    const parsed = new URL(u);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("URL non valido");
    return { url: parsed.toString() };
  })
  .handler(async ({ data }): Promise<SponsoredCard[]> => {
    const res = await fetch(data.url, { headers: { "user-agent": UA }, redirect: "follow" });
    if (!res.ok) throw new Error(`La pagina ha risposto con errore ${res.status}`);
    const html = (await res.text()).slice(0, 800_000);
    const base = res.url || data.url;
    const cards = extractCards(html, base);
    if (cards.length === 0) throw new Error("Nessuna carta riconosciuta in quella pagina");
    return cards;
  });
