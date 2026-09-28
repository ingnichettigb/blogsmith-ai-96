import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lightbulb, Loader2, Sparkles, ImageIcon, Shuffle, Languages } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateArticle, suggestTopics, translateArticle } from "@/lib/ai.functions";
import { countWords, slugify, useStore, type Figure } from "@/lib/store";
import { LANGS, LANG_LABEL, pad3, type Lang, type Translation } from "@/lib/blocks";
import { italianTranslation } from "@/lib/article";
import { fileToDataUrl } from "./ProductsPanel";

const PRESETS = [800, 1500, 2500];
const stock = (seed: string, w = 1600, h = 900) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

export function ArticlePanel() {
  const { state, set } = useStore();
  const art = state.article;
  const upd = (p: Partial<typeof art>) => set({ article: { ...art, ...p } });
  const [niche, setNiche] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);
  const [tone, setTone] = useState("professionale");
  const [figCount, setFigCount] = useState(2);
  const [busy, setBusy] = useState<"" | "ideas" | "gen" | "tr">("");
  const suggest = useServerFn(suggestTopics);
  const gen = useServerFn(generateArticle);
  const translate = useServerFn(translateArticle);
  const custom = !PRESETS.includes(art.minWords);
  const words = countWords(art.markdown);

  const doIdeas = async () => {
    setBusy("ideas");
    try { setIdeas(await suggest({ data: { niche: niche || art.title, site: state.analysis?.title ?? "" } })); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Errore"); }
    finally { setBusy(""); }
  };

  const doGen = async () => {
    if (!art.title.trim()) { toast.error("Inserisci prima un titolo"); return; }
    setBusy("gen");
    try {
      const r = await gen({ data: { title: art.title, minWords: art.minWords, figures: figCount, tone } });
      const n = (r.markdown.match(/\[\[FIGURA:/g) ?? []).length;
      const caps = [...r.markdown.matchAll(/\[\[FIGURA:\s*(.+?)\]\]/g)].map((m) => m[1]);
      const slug = art.slug || slugify(art.title);
      const figures: Figure[] = Array.from({ length: n }, (_, i) => art.figures[i] ?? { id: crypto.randomUUID(), caption: caps[i] ?? "", src: stock(`${slug}-${i + 1}`) });
      upd({
        markdown: r.markdown,
        excerpt: r.excerpt,
        coverAlt: r.coverAlt || art.coverAlt,
        slug,
        figures,
        cover: art.cover || stock(slug),
        date: new Date().toISOString().slice(0, 10),
        translations: {},
      });
      const w = countWords(r.markdown);
      toast[w >= art.minWords ? "success" : "warning"](`Articolo generato: ${w} parole`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Errore"); }
    finally { setBusy(""); }
  };

  const doTranslate = async () => {
    if (!art.markdown) { toast.error("Genera prima l'articolo"); return; }
    setBusy("tr");
    const it = italianTranslation(art, state.products);
    const payload = JSON.stringify(it);
    const next: Partial<Record<Lang, Translation>> = { ...art.translations };
    try {
      for (const lang of ["en", "de", "es"] as Lang[]) {
        const t = (await translate({ data: { lang, payload } })) as Translation;
        next[lang] = { ...t, readingTime: it.readingTime };
        set({ article: { ...art, translations: { ...next } } });
      }
      toast.success("Traduzioni EN, DE, ES pronte");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Errore"); }
    finally { setBusy(""); }
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border-2 bg-card p-4 sm:p-6">
        <h2 className="text-2xl font-extrabold">1. Argomento e titolo</h2>
        <div>
          <label htmlFor="niche" className="mb-1 block font-bold">Settore o parola chiave (per i suggerimenti)</label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input id="niche" value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="es. arredamento sostenibile" className="h-12 border-2 text-lg" />
            <Button variant="secondary" size="lg" className="h-12 border-2 text-lg font-bold" onClick={doIdeas} disabled={!!busy}>
              {busy === "ideas" ? <Loader2 className="animate-spin" /> : <Lightbulb />} Suggerisci titoli
            </Button>
          </div>
        </div>
        {ideas.length > 0 && (
          <ul className="grid gap-2">
            {ideas.map((t) => (
              <li key={t}><button onClick={() => upd({ title: t, slug: slugify(t) })} className="min-h-12 w-full rounded-lg border-2 px-4 py-2 text-left text-lg hover:bg-secondary">{t}</button></li>
            ))}
          </ul>
        )}
        <div>
          <label htmlFor="title" className="mb-1 block font-bold">Titolo dell'articolo</label>
          <Input id="title" value={art.title} onChange={(e) => upd({ title: e.target.value, slug: slugify(e.target.value) })} className="h-14 border-2 text-xl font-bold" />
          <p className="mt-1 text-muted-foreground">Cartella: <code>{art.number}-{art.slug || "slug"}/</code></p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="num" className="mb-1 block font-bold">Numero progressivo</label>
            <Input id="num" value={art.number} onChange={(e) => upd({ number: pad3(Number(e.target.value.replace(/\D/g, "")) || 1) })} className="h-12 border-2 text-lg" />
          </div>
          <div>
            <label htmlFor="author" className="mb-1 block font-bold">Autore</label>
            <Input id="author" value={art.author} onChange={(e) => upd({ author: e.target.value })} className="h-12 border-2 text-lg" />
          </div>
        </div>
        <div>
          <label htmlFor="cta" className="mb-1 block font-bold">Invito all'azione nell'articolo</label>
          <select id="cta" value={art.ctaProductId} onChange={(e) => upd({ ctaProductId: e.target.value })} className="h-12 w-full rounded-md border-2 bg-background px-3 text-lg">
            <option value="">Nessuno</option>
            {state.products.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="tone" className="mb-1 block font-bold">Tono</label>
          <select id="tone" value={tone} onChange={(e) => setTone(e.target.value)} className="h-12 w-full rounded-md border-2 bg-background px-3 text-lg">
            {["professionale", "amichevole", "tecnico", "persuasivo", "giornalistico"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border-2 bg-card p-4 sm:p-6">
        <h2 className="text-2xl font-extrabold">2. Numero minimo di parole <span className="text-destructive">*</span></h2>
        <div role="radiogroup" aria-label="Parole minime" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRESETS.map((p) => (
            <button key={p} role="radio" aria-checked={art.minWords === p} onClick={() => upd({ minWords: p })}
              className={`h-14 rounded-lg border-2 text-lg font-bold ${art.minWords === p ? "bg-primary text-primary-foreground" : "bg-background"}`}>{p}{p === 2500 ? "+" : ""}</button>
          ))}
          <button role="radio" aria-checked={custom} onClick={() => upd({ minWords: 1000 })}
            className={`h-14 rounded-lg border-2 text-lg font-bold ${custom ? "bg-primary text-primary-foreground" : "bg-background"}`}>Personalizzato</button>
        </div>
        {custom && <Input type="number" min={300} max={6000} aria-label="Parole minime personalizzate" value={art.minWords} onChange={(e) => upd({ minWords: Number(e.target.value) || 300 })} className="h-12 border-2 text-lg" />}
      </section>

      <section className="space-y-4 rounded-xl border-2 bg-card p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-2xl font-extrabold"><ImageIcon /> 3. Immagini</h2>
        <div>
          <p className="mb-2 font-bold">Copertina 16:9</p>
          <div className="aspect-video w-full overflow-hidden rounded-lg border-2 bg-muted">
            {art.cover ? <img src={art.cover} alt="Copertina" className="size-full object-cover" /> : <div className="grid size-full place-items-center text-muted-foreground">Nessuna copertina</div>}
          </div>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <Button variant="outline" size="lg" className="h-12 border-2" onClick={() => upd({ cover: stock(`${art.slug || "blog"}-${Date.now()}`) })}><Shuffle /> Foto stock</Button>
            <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border-2 px-4 font-semibold hover:bg-secondary">
              Carica immagine
              <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) upd({ cover: await fileToDataUrl(f) }); }} />
            </label>
          </div>
        </div>
        <div>
          <label htmlFor="coverAlt" className="mb-1 block font-bold">Descrizione della copertina (testo alternativo)</label>
          <Input id="coverAlt" value={art.coverAlt} onChange={(e) => upd({ coverAlt: e.target.value })} className="h-12 border-2 text-lg" />
        </div>
        <div>
          <label htmlFor="figc" className="mb-1 block font-bold">Figure interne nei paragrafi</label>
          <Input id="figc" type="number" min={0} max={6} value={figCount} onChange={(e) => setFigCount(Number(e.target.value))} className="h-12 border-2 text-lg sm:w-40" />
        </div>
        {art.figures.map((f, i) => (
          <div key={f.id} className="flex gap-3 rounded-lg border-2 p-3">
            <img src={f.src} alt="" className="h-20 w-32 shrink-0 rounded object-cover" />
            <div className="min-w-0 flex-1 space-y-2">
              <Input aria-label={`Didascalia figura ${i + 1}`} value={f.caption} onChange={(e) => upd({ figures: art.figures.map((x) => (x.id === f.id ? { ...x, caption: e.target.value } : x)) })} className="h-11 border-2" />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="h-11 border-2" onClick={() => upd({ figures: art.figures.map((x) => (x.id === f.id ? { ...x, src: stock(`${f.id}-${Date.now()}`, 1200, 675) } : x)) })}><Shuffle /> Stock</Button>
                <label className="inline-flex h-11 cursor-pointer items-center rounded-md border-2 px-3 font-semibold hover:bg-secondary">Carica
                  <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { const src = await fileToDataUrl(file); upd({ figures: art.figures.map((x) => (x.id === f.id ? { ...x, src } : x)) }); } }} />
                </label>
              </div>
            </div>
          </div>
        ))}
      </section>

      <Button size="lg" className="h-16 w-full text-xl font-extrabold" onClick={doGen} disabled={!!busy}>
        {busy === "gen" ? <><Loader2 className="animate-spin" /> Scrittura in corso (può richiedere 1-2 minuti)…</> : <><Sparkles /> Genera articolo</>}
      </Button>

      {art.markdown && (
        <section className="space-y-3 rounded-xl border-2 bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold">Testo (modificabile)</h2>
            <span className={`rounded-md border-2 px-3 py-1 font-bold ${words >= art.minWords ? "text-success" : "text-destructive"}`}>{words} / {art.minWords}</span>
          </div>
          <Textarea aria-label="Estratto" value={art.excerpt} onChange={(e) => upd({ excerpt: e.target.value })} className="border-2 text-lg" />
          <Textarea aria-label="Corpo articolo in Markdown" value={art.markdown} onChange={(e) => upd({ markdown: e.target.value })} className="min-h-96 border-2 font-mono text-base" />
        </section>
      )}

      {art.markdown && (
        <section className="space-y-4 rounded-xl border-2 bg-card p-4 sm:p-6">
          <h2 className="flex items-center gap-2 text-2xl font-extrabold"><Languages /> 4. Lingue</h2>
          <div className="flex flex-wrap gap-2">
            {LANGS.map((l) => (
              <span key={l} className={`rounded-md border-2 px-3 py-1 font-bold ${l === "it" || art.translations[l] ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {LANG_LABEL[l]} {l === "it" || art.translations[l] ? "✓" : "—"}
              </span>
            ))}
          </div>
          <Button size="lg" className="h-14 w-full text-lg font-bold" onClick={doTranslate} disabled={!!busy}>
            {busy === "tr" ? <><Loader2 className="animate-spin" /> Traduzione in corso…</> : <><Languages /> Genera traduzioni EN, DE, ES</>}
          </Button>
        </section>
      )}
    </div>

  );
}
