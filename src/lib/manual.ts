import type { Figure } from "./store";

/**
 * Modalità manuale (senza AI): funzioni pure che lavorano sul testo scritto dall'utente
 * SENZA riscriverlo. L'unica cosa che può essere aggiunta sono i segnaposto [[FIGURA: ...]].
 */

// Un richiamo a figura può essere un segnaposto [[FIGURA: ...]] oppure, dopo l'export o la
// modifica rapida in Anteprima, un'immagine markdown ![didascalia](figura-N.jpg).
const FIG_GLOBAL = /\[\[FIGURA:\s*(.+?)\]\]|!\[([^\]]*)\]\(figura-\d+\.[a-z0-9]+\)/gi;

/** Didascalie dei richiami a figura presenti nel testo, nell'ordine. */
export const figureCaptions = (md: string): string[] => [...md.matchAll(FIG_GLOBAL)].map((m) => (m[1] ?? m[2] ?? "").trim());

const isPlainParagraph = (chunk: string) => {
  const t = chunk.trim();
  return !!t && !/^(#|>|[-*]\s|\d+\.\s|\[\[FIGURA:|!\[)/.test(t);
};

/**
 * Se il testo non contiene nessun segnaposto, ne inserisce `count` distribuiti in modo uniforme
 * tra i paragrafi. Il testo dell'utente resta identico (si aggiungono solo le righe [[FIGURA: ...]]).
 * Se ci sono già dei segnaposto, il testo viene restituito così com'è.
 */
export function ensureFigureMarkers(md: string, count: number): string {
  if (count <= 0 || figureCaptions(md).length > 0) return md;
  // split con gruppo di cattura: i separatori restano nell'array, quindi il testo si ricompone senza perdite
  const chunks = md.split(/(\n\s*\n)/);
  const candidates = chunks.map((c, i) => (i % 2 === 0 && isPlainParagraph(c) ? i : -1)).filter((i) => i >= 0);
  if (candidates.length === 0) return md;
  const targets = new Set<number>();
  for (let k = 1; k <= count; k++) {
    const pos = Math.min(candidates.length - 1, Math.max(0, Math.round((k * candidates.length) / (count + 1)) - 1));
    targets.add(candidates[pos]!);
  }
  let n = 0;
  return chunks
    .map((c, i) => (targets.has(i) ? `${c}\n\n[[FIGURA: Immagine ${++n} da sostituire]]` : c))
    .join("");
}

/**
 * Allinea l'elenco delle figure ai segnaposto presenti nel testo:
 * mantiene le immagini già caricate (per posizione) e crea slot vuoti per i nuovi segnaposto.
 */
export function syncFigures(md: string, figures: Figure[]): Figure[] {
  const caps = figureCaptions(md);
  return caps.map((cap, i) => {
    const old = figures[i];
    return old ? { ...old, caption: old.caption || cap } : { id: crypto.randomUUID(), caption: cap, src: "" };
  });
}

/** Estratto non-AI: primo paragrafo "normale" del testo, ripulito e tagliato a ~160 caratteri. */
export function excerptFromText(md: string): string {
  const first = md.split(/\n\s*\n/).find(isPlainParagraph) ?? "";
  const plain = first.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/\s+/g, " ").trim();
  if (plain.length <= 160) return plain;
  const cut = plain.slice(0, 160);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 100))}…`;
}
