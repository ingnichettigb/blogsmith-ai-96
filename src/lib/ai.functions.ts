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
  .inputValidator((d: { niche: string; site?: string }) => ({
    niche: String(d.niche ?? "").slice(0, 300),
    site: String(d.site ?? "").slice(0, 300),
  }))
  .handler(async ({ data }) => {
    const txt = await callAI(
      "Sei un content strategist SEO italiano. Rispondi SOLO con 6 titoli di articoli tecnici B2B, uno per riga, senza numeri né virgolette, ciascuno di MASSIMO 70 caratteri.",
      `Argomento o settore: ${data.niche || "generico"}\nSito: ${data.site || "n/d"}`,
    );
    return txt.split("\n").map((l) => l.replace(/^[\s\-\d.*"]+|"$/g, "").trim()).filter(Boolean).slice(0, 6);
  });

/** Taglia il testo al massimo di caratteri, preferendo la fine di una frase. */
function limitChars(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const sentence = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  if (sentence > max * 0.5) return cut.slice(0, sentence + 1).trim();
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.5 ? cut.slice(0, space) : cut).trim()}…`;
}

export const generateArticle = createServerFn({ method: "POST" })
  .inputValidator((d: { title: string; minWords: number; figures: number; referenceText?: string; draftText?: string }) => ({
    title: String(d.title ?? "").slice(0, 300),
    minWords: Math.min(1300, Math.max(900, Number(d.minWords) || 900)),
    figures: Math.min(6, Math.max(0, Number(d.figures) || 0)),
    referenceText: d.referenceText ? String(d.referenceText).slice(0, 6000) : "",
    draftText: d.draftText ? String(d.draftText).slice(0, 10_000) : "",
  }))
  .handler(async ({ data }) => {
    if (!data.title) throw new Error("Inserisci un titolo");
    const draftBlock = data.draftText
      ? `\n\nBozza già scritta dall'utente: usala come BASE del nuovo articolo. Riscrivila e adattala con parole tue, migliorando struttura, sottotitoli e scorrevolezza, ed espandila fino a raggiungere la lunghezza richiesta mantenendo però i contenuti, i fatti e il punto di vista che contiene: non snaturarli, non inventare fatti in contraddizione con essa.\n"""\n${data.draftText}\n"""`
      : "";
    const referenceBlock = data.referenceText
      ? `\n\nContenuto di riferimento fornito dall'utente (una pagina che tratta già l'argomento): usalo${data.draftText ? " come ulteriore fonte di fatti e dettagli oltre alla bozza sopra" : " SOLO come spunto per fatti, punti chiave e taglio dell'argomento"}. Riscrivi tutto con parole tue, in modo originale: non copiare frasi né la struttura testuale.\n"""\n${data.referenceText}\n"""`
      : "";
    const md = await callAI(
      `Sei il redattore del blog di "CorporateBoostService.eu". Scrivi articoli in italiano, in Markdown standard, per un pubblico B2B di tecnici, costruttori, impiantisti e responsabili qualità.
Tono di voce: B2B, concreto e professionale, tecnico ma chiaro, senza enfasi pubblicitaria.
Regole: NON includere il titolo H1. Usa ## per i titoli di sezione e ### per i sottotitoli, paragrafi brevi, elenchi puntati quando servono e il grassetto **termine** per i concetti chiave.
Lunghezza OBBLIGATORIA: tra ${data.minWords} e 1400 parole (mai più di 1400).
Inserisci esattamente ${data.figures} segnaposto per figure interne, ciascuno su una riga isolata nel formato: [[FIGURA: breve descrizione dell'immagine]] distribuiti tra i paragrafi.
NON inserire né citare schede prodotto, banner o pubblicità: la pubblicità è gestita dal sito.
Alla fine NON aggiungere note.${draftBlock}${referenceBlock}`,
      `Titolo: ${data.title}`,
    );
    const meta = await callAI(
      `Rispondi SOLO con un JSON valido, senza testo attorno, nel formato {"excerpt":"...","coverAlt":"..."}.
"excerpt": riassunto in italiano di 2-3 frasi, MASSIMO 180 caratteri. "coverAlt": testo alternativo dell'immagine di copertina, massimo 15 parole.`,
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
    return { markdown: md.trim(), excerpt: limitChars(excerpt, 180), coverAlt };
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
Mantieni ESATTAMENTE la stessa struttura e gli stessi campi: title, excerpt, readingTime, topics, markdown, figures.
Nel campo "markdown" conserva identica la formattazione Markdown (## ### ** elenchi) e i riferimenti alle immagini ![didascalia tradotta](figura-N.jpg): i nomi dei file NON vanno mai tradotti o modificati.
Traduci: title, excerpt, topics, il testo del markdown e le caption delle figures. I campi readingTime, src e id restano identici.`,
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

/**
 * Genera un'immagine fotografica 16:9 con AI Gateway Lovable (modello openai/gpt-image-2.5-sunburst).
 * Crea una fotografia reale senza testi o watermark, integrando didascalia e contesto dell'articolo.
 */
export const generateArticleImage = createServerFn({ method: "POST" })
  .inputValidator((d: { prompt: string; title?: string; context?: string }) => ({
    prompt: String(d.prompt ?? "").slice(0, 500),
    title: String(d.title ?? "").slice(0, 300),
    context: String(d.context ?? "").slice(0, 300),
  }))
  .handler(async ({ data }) => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) throw new Error("Chiave AI non configurata");

    const subject = data.prompt.trim() || data.title.trim() || "professional corporate industrial setting";
    const enhancedPrompt = `Authentic professional editorial photography, sharp focus, natural corporate and industrial lighting, 35mm lens style, 16:9 landscape aspect ratio, no text, no watermark, no logos, clean visual. Subject: ${subject}. Article context: ${data.title || "B2B article"}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
        "Lovable-API-Key": key,
      },
      body: JSON.stringify({
        model: "openai/gpt-image-2.5-sunburst",
        prompt: enhancedPrompt,
        size: "1536x1024",
        quality: "medium",
        stream: false,
      }),
    });

    if (!res.ok) {
      const t = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Troppe richieste immagini: riprova tra un minuto.");
      if (res.status === 402) throw new Error("Crediti AI esauriti per la generazione immagini.");
      throw new Error(`Errore generazione immagine (${res.status}): ${t.slice(0, 200)}`);
    }

    const json = (await res.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
    const first = json.data?.[0];
    if (first?.b64_json) {
      return { url: `data:image/png;base64,${first.b64_json}` };
    }
    if (first?.url) {
      return { url: first.url };
    }
    throw new Error("Nessuna immagine generata ricevuta dall'AI.");
  });

/**
 * Genera un post social ottimizzato (LinkedIn, Facebook o Telegram) basato sull'articolo.
 */
export const generateSocialPost = createServerFn({ method: "POST" })
  .inputValidator((d: { platform: string; title: string; excerpt?: string; markdown?: string; topics?: string[] }) => ({
    platform: (["linkedin", "facebook", "telegram"].includes(d.platform) ? d.platform : "linkedin") as "linkedin" | "facebook" | "telegram",
    title: String(d.title ?? "").slice(0, 300),
    excerpt: String(d.excerpt ?? "").slice(0, 500),
    markdown: String(d.markdown ?? "").slice(0, 10000),
    topics: Array.isArray(d.topics) ? d.topics.map((t) => String(t).slice(0, 50)) : [],
  }))
  .handler(async ({ data }) => {
    if (!data.title) throw new Error("Titolo articolo mancante");

    let systemPrompt = "";
    if (data.platform === "linkedin") {
      systemPrompt = `Sei un esperto copywriter B2B specializzato in LinkedIn per professionisti, costruttori, impiantisti e dirigenti aziendali.
Scrivi un post per LinkedIn in lingua italiana basandoti sull'articolo fornito.
REGOLE DI FORMATTAZIONE PER LINKEDIN:
1. Gancio iniziale (prime 2 righe): forte, curioso, che attiri l'attenzione e spinga a cliccare "Vedi altro".
2. Struttura del testo: paragrafi molto brevi di 1-2 frasi separati da righe vuote per una lettura fluida.
3. Punti elenco (3-4 bullet point con simboli discreti come 🔹 o •) che mettono in risalto soluzioni, dati o lezioni pratiche.
4. Tono professionale, analitico e orientato a concrete sfide tecniche ed economiche.
5. Chiusura: domanda aperta stimolante per invitare alla discussione e ai commenti tra addetti ai lavori.
6. Invito all'azione chiaro: "[Link all'approfondimento completo nel primo commento / sul nostro blog]".
7. In calce: 3-5 hashtag pertinenti (es. #B2B #Innovazione #Settore).
NON inserire formule di saluto vuote (es. "Cari follower"). NON usare markdown con asterischi per il grassetto (LinkedIn non supporta il markdown nativo). Restituisci SOLO il testo puro del post pronto per essere copiato e pubblicato.`;
    } else if (data.platform === "facebook") {
      systemPrompt = `Sei un copywriter esperto in social media marketing e divulgazione per Facebook.
Scrivi un post per Facebook in lingua italiana basandoti sull'articolo fornito.
REGOLE DI FORMATTAZIONE PER FACEBOOK:
1. Incipit coinvolgente, empatico e narrativo incentrato su un problema concreto che aziende o persone affrontano.
2. Spiegazione semplice e accessibile dell'approfondimento o delle risposte individuate nell'articolo.
3. Call-to-action finale chiara e visibile: "👉 Leggi l'approfondimento completo sul nostro blog: [Inserisci link]".
4. Usa qualche emoji adatta per dare ritmo visivo al testo.
5. In calce: 2-3 hashtag tematici.
NON usare markdown per il grassetto con asterischi. Restituisci SOLO il testo puro del post pronto da pubblicare.`;
    } else {
      // telegram
      systemPrompt = `Sei il redattore di un canale broadcast Telegram aziendale e specialistico.
Scrivi un post per un canale Telegram in lingua italiana basandoti sull'articolo fornito.
REGOLE DI FORMATTAZIONE PER TELEGRAM:
1. Titolo del messaggio in grassetto incisivo e chiaro (usa **Titolo** o lettere maiuscole).
2. Breve sommario di 1-2 frasi che inquadra il contesto.
3. Sintesi snella (3-4 punti chiave rapidi con emoji come 📌, 💡, ⚙️) che si legge in 30 secondi dallo smartphone.
4. Link finale: "🔗 Leggi l'articolo completo: [Link al blog]".
5. Massimo 1-2 hashtag tematici.
Restituisci SOLO il testo del messaggio pronto per il broadcast su Telegram.`;
    }

    const userContent = `Titolo articolo: ${data.title}
Argomenti: ${data.topics.length > 0 ? data.topics.join(", ") : "n/d"}
Estratto: ${data.excerpt || "n/d"}

Testo articolo (estratto):
${data.markdown.slice(0, 4000)}`;

    const post = await callAI(systemPrompt, userContent);
    return { post: post.trim() };
  });

/**
 * Genera un prompt cinematografico in inglese per generatori video AI esterni (Runway Gen-3, Kling, Sora, Luma).
 */
export const generateVideoPrompt = createServerFn({ method: "POST" })
  .inputValidator((d: { title: string; excerpt?: string; topics?: string[]; platform?: string }) => ({
    title: String(d.title ?? "").slice(0, 300),
    excerpt: String(d.excerpt ?? "").slice(0, 500),
    topics: Array.isArray(d.topics) ? d.topics.map((t) => String(t).slice(0, 50)) : [],
    platform: String(d.platform ?? "linkedin").slice(0, 20),
  }))
  .handler(async ({ data }) => {
    if (!data.title) throw new Error("Titolo articolo mancante");

    const systemPrompt = `You are a film director and expert prompt engineer for cutting-edge text-to-video AI models (such as Runway Gen-3 Alpha, Kling AI, OpenAI Sora, and Luma Dream Machine).
Generate a cinematic, highly descriptive video prompt IN ENGLISH (the universal standard for AI video generators) to produce a compelling, photorealistic 5 to 10 second video clip for a social post on ${data.platform}.
RULES FOR THE VIDEO PROMPT:
1. Subject & Action: Clear physical action in an authentic professional/industrial B2B setting.
2. Camera Motion: Specify smooth cinematic movement (e.g., slow cinematic push-in, subtle pan, sweeping aerial shot, rack focus).
3. Lighting & Aesthetic: Natural diffused studio/factory lighting, cinematic depth of field, 35mm lens, 4K photorealistic, 24fps filmic look.
4. Strict Negatives: No overlaid text, no subtitles, no watermarks, no distorted faces or impossible physics.
5. Length: 3-5 vivid, concise English sentences ready to paste into the video generator prompt box.
Output ONLY the raw English prompt, without introductory text or quotes.`;

    const userContent = `Article title: ${data.title}
Industry / Topics: ${data.topics.join(", ") || "General B2B"}
Article excerpt: ${data.excerpt || "n/a"}`;

    const promptText = await callAI(systemPrompt, userContent);
    return { prompt: promptText.trim() };
  });
