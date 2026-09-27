import { createServerFn } from "@tanstack/react-start";

async function callAI(system: string, user: string): Promise<string> {
  const key = process.env['LOVABLE_API_KEY'];
  if (!key) throw new Error("Chiave AI non configurata");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      instructions: system,
      input: [{ role: "user", content: user }],
      stream: true,
      store: false,
      reasoning: { effort: "low" },
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    if (res.status === 429) throw new Error("Troppe richieste, riprova tra poco.");
    if (res.status === 402) throw new Error("Crediti AI esauriti. Aggiungi crediti al workspace.");
    throw new Error(`Errore AI (${res.status}) ${t.slice(0, 200)}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of frame.split("\n")) {
        if (!line.startsWith("data:")) continue;
        const d = line.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try {
          const j = JSON.parse(d);
          if (j.type === "response.output_text.delta") out += j.delta;
          if (j.type === "error" || j.type === "response.failed")
            throw new Error(j.error?.message ?? j.response?.error?.message ?? "Errore AI");
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("Errore")) throw e;
        }
      }
    }
  }
  if (!out.trim()) throw new Error("La risposta AI è vuota.");
  return out;
}

export const suggestTopics = createServerFn({ method: "POST" })
  .inputValidator((d: { niche: string; site?: string }) => ({ niche: String(d.niche ?? "").slice(0, 300), site: String(d.site ?? "").slice(0, 300) }))
  .handler(async ({ data }) => {
    const txt = await callAI(
      "Sei un content strategist SEO italiano. Rispondi SOLO con 6 titoli di articoli, uno per riga, senza numeri né virgolette.",
      `Argomento o settore: ${data.niche || "generico"}\nSito: ${data.site || "n/d"}`,
    );
    return txt.split("\n").map((l) => l.replace(/^[\s\-\d.*"]+|"$/g, "").trim()).filter(Boolean).slice(0, 6);
  });

export const generateArticle = createServerFn({ method: "POST" })
  .inputValidator((d: { title: string; minWords: number; figures: number; tone: string }) => ({
    title: String(d.title ?? "").slice(0, 300),
    minWords: Math.min(6000, Math.max(300, Number(d.minWords) || 800)),
    figures: Math.min(6, Math.max(0, Number(d.figures) || 0)),
    tone: String(d.tone ?? "professionale").slice(0, 50),
  }))
  .handler(async ({ data }) => {
    if (!data.title) throw new Error("Inserisci un titolo");
    const md = await callAI(
      `Sei un copywriter esperto. Scrivi articoli di blog in italiano, in Markdown, tono ${data.tone}.
Regole: NON includere il titolo H1. Usa sottotitoli ## e ###, paragrafi, elenchi puntati, grassetti.
Lunghezza MINIMA obbligatoria: ${data.minWords} parole (superala leggermente).
Inserisci esattamente ${data.figures} segnaposto per figure interne, ciascuno su una riga isolata nel formato: [[FIGURA: breve descrizione dell'immagine]] distribuiti tra i paragrafi.
Alla fine NON aggiungere note.`,
      `Titolo: ${data.title}`,
    );
    const excerpt = await callAI(
      "Riassumi in una frase di massimo 30 parole, in italiano, senza virgolette.",
      md.slice(0, 3000),
    );
    return { markdown: md.trim(), excerpt: excerpt.trim() };
  });
