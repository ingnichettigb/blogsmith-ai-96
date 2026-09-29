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
  .inputValidator((d: { title: string; minWords: number; figures: number; tone: string; referenceText?: string; draftText?: string }) => ({
    title: String(d.title ?? "").slice(0, 300),
    minWords: Math.min(6000, Math.max(200, Number(d.minWords) || 800)),
    figures: Math.min(6, Math.max(0, Number(d.figures) || 0)),
    tone: String(d.tone ?? "professionale").slice(0, 50),
    referenceText: d.referenceText ? String(d.referenceText).slice(0, 6000) : "",
    draftText: d.draftText ? String(d.draftText).slice(0, 10_000) : "",
  }))
  .handler(async ({ data }) => {
    if (!data.title) throw new Error("Inserisci un titolo");
    const draftBlock = data.draftText
      ? `\n\nBozza già scritta dall'utente: usala come BASE del nuovo articolo. Riscrivila e adattala con parole tue, migliorando struttura, sottotitoli e scorrevolezza, ed espandila fino a raggiungere la lunghezza minima richiesta mantenendo però i contenuti, i fatti e il punto di vista che contiene: non snaturarli, non inventare fatti in contraddizione con essa.\n"""\n${data.draftText}\n"""`
      : "";
    const referenceBlock = data.referenceText
      ? `\n\nContenuto di riferimento fornito dall'utente (una pagina che tratta già l'argomento): usalo${data.draftText ? " come ulteriore fonte di fatti e dettagli oltre alla bozza sopra" : " SOLO come spunto per fatti, punti chiave e taglio dell'argomento"}. Riscrivi tutto con parole tue, in modo originale: non copiare frasi né la struttura testuale.\n"""\n${data.referenceText}\n"""`
      : "";
    const md = await callAI(
      `Sei un copywriter esperto. Scrivi articoli di blog in italiano, in Markdown, tono ${data.tone}.
Regole: NON includere il titolo H1. Usa sottotitoli ## e ###, paragrafi, elenchi puntati, grassetti.
Lunghezza MINIMA obbligatoria: ${data.minWords} parole (superala leggermente).
Inserisci esattamente ${data.figures} segnaposto per figure interne, ciascuno su una riga isolata nel formato: [[FIGURA: breve descrizione dell'immagine]] distribuiti tra i paragrafi.
Alla fine NON aggiungere note.${draftBlock}${referenceBlock}`,
      `Titolo: ${data.title}`,
    );
    const meta = await callAI(
      `Rispondi SOLO con un JSON valido, senza testo attorno, nel formato {"excerpt":"...","coverAlt":"..."}.
"excerpt": riassunto in italiano di massimo 30 parole. "coverAlt": testo alternativo dell'immagine di copertina, massimo 15 parole.`,
      `Titolo: ${data.title}\n\n${md.slice(0, 3000)}`,
    );
    let excerpt = "";
    let coverAlt = "";
    try {
      const j = JSON.parse(meta.replace(/^```(?:json)?|```$/gm, "").trim());
      excerpt = String(j.excerpt ?? "").trim();
      coverAlt = String(j.coverAlt ?? "").trim();
    } catch {
      excerpt = meta.trim().slice(0, 300);
    }
    return { markdown: md.trim(), excerpt, coverAlt };
  });

const LANG_NAME: Record<string, string> = { en: "inglese", de: "tedesco", es: "spagnolo", it: "italiano" };

export const translateArticle = createServerFn({ method: "POST" })
  .inputValidator((d: { lang: string; payload: string }) => ({
    lang: String(d.lang ?? "en").slice(0, 5),
    payload: String(d.payload ?? "").slice(0, 120000),
  }))
  .handler(async ({ data }) => {
    const target = LANG_NAME[data.lang] ?? "inglese";
    const raw = await callAI(
      `Sei un traduttore professionale. Traduci in ${target} il JSON dell'articolo che ricevi.
Rispondi SOLO con un JSON valido, senza testo attorno e senza blocchi di codice.
Mantieni ESATTAMENTE la stessa struttura e lo stesso ordine dei blocchi, gli stessi campi "type", i valori "src" e i link invariati.
Traduci solo i campi testuali: title, excerpt, text, items, caption. Il campo readingTime deve restare identico.`,
      data.payload,
    );
    const cleaned = raw.replace(/^```(?:json)?/m, "").replace(/```\s*$/m, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    const json = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
    try {
      JSON.parse(json);
      return { json };
    } catch {
      throw new Error("La traduzione non è un JSON valido, riprova.");
    }
  });

