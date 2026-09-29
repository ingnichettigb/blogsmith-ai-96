import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lightbulb, Loader2, Sparkles, ImageIcon, Shuffle, Link2, Eraser } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { generateArticle, suggestTopics } from "@/lib/ai.functions";
import { fetchReferencePage } from "@/lib/reference.functions";
import { countWords, createBlankArticle, DEFAULT_AUTHOR, slugify, useStore, type Figure } from "@/lib/store";
import { fileToDataUrl } from "./ProductsPanel";
import { TopicDialog } from "./TopicDialog";

const PRESETS = [200, 400, 800, 1500, 2500];
const stock = (seed: string, w = 1600, h = 900) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

export function ArticlePanel() {
  const { state, set } = useStore();
  const art = state.article;
  const upd = (p: Partial<typeof art>) => set({ article: { ...art, ...p } });
  const [niche, setNiche] = useState("");
  const [ideas, setIdeas] = useState<string[]>([]);
  const [tone, setTone] = useState("professionale");
  const [figCount, setFigCount] = useState(2);
  const [busy, setBusy] = useState<"" | "ideas" | "gen">("");
  const suggest = useServerFn(suggestTopics);
  const gen = useServerFn(generateArticle);
  const fetchRef = useServerFn(fetchReferencePage);
  const custom = !PRESETS.includes(art.minWords);
  const words = countWords(art.markdown);
  const isBlank = !art.title && !art.markdown && !art.excerpt && !art.cover && !art.topic && art.figures.length === 0 && art.author === DEFAULT_AUTHOR;

  const doReset = () => {
    upd(createBlankArticle());
    setNiche("");
    setIdeas([]);
    setTone("professionale");
    setFigCount(2);
    toast.success("Articolo azzerato: pronto per uno nuovo");
  };

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
      let referenceText = "";
      let referenceImages: string[] = [];
      const refUrl = (art.referenceUrl || "").trim();
      if (refUrl) {
        try {
          const ref = await fetchRef({ data: { url: refUrl } });
          referenceText = ref.text;
          referenceImages = ref.images;
          if (art.referenceImages && referenceImages.length === 0) toast.warning("Nessuna immagine trovata nella pagina di riferimento");
        } catch (e) {
          toast.warning(`Pagina di riferimento non letta: ${e instanceof Error ? e.message : "errore"}. Procedo senza.`);
        }
      }
      const r = await gen({ data: { title: art.title, minWords: art.minWords, figures: figCount, tone, referenceText, draftText: art.draftText || "" } });
      const n = (r.markdown.match(/\[\[FIGURA:/g) ?? []).length;
      const caps = [...r.markdown.matchAll(/\[\[FIGURA:\s*(.+?)\]\]/g)].map((m) => m[1]);
      const slug = art.slug || slugify(art.title);
      const useRefImages = art.referenceImages && referenceImages.length > 0;
      // La prima immagine reale (se c'è) va alla copertina; le successive alle figure, nell'ordine.
      // Quando le immagini reali finiscono, il resto viene "inventato" con foto stock invece di ripetere le stesse.
      const figImages = useRefImages ? referenceImages.slice(1) : [];
      const figures: Figure[] = Array.from({ length: n }, (_, i) =>
        art.figures[i] ?? { id: crypto.randomUUID(), caption: caps[i] ?? "", src: figImages[i] ?? stock(`${slug}-${i + 1}`) },
      );
      const cover = art.cover || (useRefImages ? referenceImages[0] : undefined) || stock(slug);
      upd({ markdown: r.markdown, excerpt: r.excerpt, slug, figures, cover, date: new Date().toISOString().slice(0, 10) });
      const w = countWords(r.markdown);
      toast[w >= art.minWords ? "success" : "warning"](`Articolo generato: ${w} parole`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Errore"); }
    finally { setBusy(""); }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="lg" className="h-12 border-2 text-lg font-bold" disabled={isBlank}>
              <Eraser /> Azzera tutto
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Azzerare l'articolo corrente?</AlertDialogTitle>
              <AlertDialogDescription>
                Titolo, testo, copertina, figure, argomento e numero verranno cancellati per iniziare un articolo nuovo da zero (l'autore torna a {DEFAULT_AUTHOR}). L'analisi del sito, i prodotti sponsorizzati e l'archivio argomenti non vengono toccati. Se non hai ancora salvato, l'articolo attuale andrà perso.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction onClick={doReset}>Azzera tutto</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <section className="space-y-4 rounded-xl border-2 bg-card p-4 sm:p-6">
        <h2 className="text-2xl font-extrabold">1. Argomento e titolo</h2>

        <TopicDialog />

        <div>
          <label htmlFor="niche" className="mb-1 block font-bold">Settore o parola chiave (per i suggerimenti AI dei titoli)</label>
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
          <p className="mt-1 text-muted-foreground">Indirizzo: <code>/blog/{art.slug || "slug"}</code>{art.number && <> · N. <code>{art.number}</code></>}</p>
        </div>
        <div>
          <label htmlFor="author" className="mb-1 block font-bold">Autore</label>
          <Input id="author" value={art.author} onChange={(e) => upd({ author: e.target.value })} className="h-12 border-2 text-lg" />
        </div>
        <div>
          <label htmlFor="tone" className="mb-1 block font-bold">Tono</label>
          <select id="tone" value={tone} onChange={(e) => setTone(e.target.value)} className="h-12 w-full rounded-md border-2 bg-background px-3 text-lg">
            {["professionale", "amichevole", "tecnico", "persuasivo", "giornalistico"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="space-y-2 border-t-2 pt-4">
          <label htmlFor="draft" className="mb-1 block font-bold">Bozza già scritta (facoltativo)</label>
          <p className="text-muted-foreground">Incolla qui un testo che hai già preparato: verrà usato come base, riscritto e completato dall'AI fino a raggiungere la lunghezza minima richiesta, mantenendo i contenuti che contiene.</p>
          <Textarea id="draft" value={art.draftText || ""} onChange={(e) => upd({ draftText: e.target.value })} placeholder="Incolla qui la tua bozza…" className="min-h-40 border-2 text-lg" />
        </div>
        <div className="space-y-2 border-t-2 pt-4">
          <label htmlFor="refurl" className="flex items-center gap-2 font-bold"><Link2 className="size-5" /> Link di riferimento (facoltativo)</label>
          <p className="text-muted-foreground">Incolla il link di una pagina che tratta già l'argomento (es. la tua landing page): l'AI la userà come spunto, riscrivendo tutto con parole proprie.</p>
          <Input id="refurl" type="url" value={art.referenceUrl || ""} onChange={(e) => upd({ referenceUrl: e.target.value })} placeholder="https://tuosito.it/pagina-landing" className="h-12 border-2 text-lg" />
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={!!art.referenceImages} onChange={(e) => upd({ referenceImages: e.target.checked })} className="size-5" />
            Usa anche le immagini trovate in quella pagina (invece delle foto stock)
          </label>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border-2 bg-card p-4 sm:p-6">
        <h2 className="text-2xl font-extrabold">2. Numero minimo di parole <span className="text-destructive">*</span></h2>
        <div role="radiogroup" aria-label="Parole minime" className="flex gap-1.5 sm:gap-3">
          {PRESETS.map((p) => (
            <button key={p} role="radio" aria-checked={art.minWords === p} onClick={() => upd({ minWords: p })}
              className={`h-14 min-w-0 flex-1 truncate rounded-lg border-2 px-1 text-sm font-bold sm:px-3 sm:text-lg ${art.minWords === p ? "bg-primary text-primary-foreground" : "bg-background"}`}>{p}{p === 2500 ? "+" : ""}</button>
          ))}
          <button role="radio" aria-checked={custom} onClick={() => upd({ minWords: 1000 })}
            className={`h-14 min-w-0 flex-1 truncate rounded-lg border-2 px-1 text-sm font-bold sm:px-3 sm:text-lg ${custom ? "bg-primary text-primary-foreground" : "bg-background"}`}>Personalizzato</button>
        </div>
        {custom && <Input type="number" min={200} max={6000} aria-label="Parole minime personalizzate" value={art.minWords} onChange={(e) => upd({ minWords: Number(e.target.value) || 200 })} className="h-12 border-2 text-lg" />}
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
    </div>
  );
}
