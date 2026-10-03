import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Lightbulb, Loader2, Sparkles, ImageIcon, Shuffle, Link2, Eraser, Languages, FileCheck2, Images, Trash2 } from "lucide-react";
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
import { generateArticle, suggestTopics, translateArticle, generateArticleImage } from "@/lib/ai.functions";
import { fetchReferencePage } from "@/lib/reference.functions";
import { countWords, createBlankArticle, DEFAULT_AUTHOR, slugify, useStore, type Figure } from "@/lib/store";
import { LANGS, LANG_LABEL, type Lang, type Translation } from "@/lib/blocks";
import { italianTranslation } from "@/lib/article";
import { ensureFigureMarkers, excerptFromText, syncFigures } from "@/lib/manual";
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
  const [busy, setBusy] = useState<"" | "ideas" | "gen" | "tr">("");
  const [generatingSlot, setGeneratingSlot] = useState<string | null>(null);

  const suggest = useServerFn(suggestTopics);
  const gen = useServerFn(generateArticle);
  const fetchRef = useServerFn(fetchReferencePage);
  const translate = useServerFn(translateArticle);
  const generateImg = useServerFn(generateArticleImage);

  const custom = !PRESETS.includes(art.minWords);
  const words = countWords(art.markdown);
  const isBlank = !art.title && !art.markdown && !art.excerpt && !art.cover && !(art.topics ?? []).length && art.figures.length === 0 && art.author === DEFAULT_AUTHOR;

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
      const figImages = useRefImages ? referenceImages.slice(1) : [];
      const figures: Figure[] = Array.from({ length: n }, (_, i) =>
        art.figures[i] ?? { id: crypto.randomUUID(), caption: caps[i] ?? "", src: figImages[i] ?? stock(`${slug}-${i + 1}`) },
      );
      const cover = art.cover || (useRefImages ? referenceImages[0] : undefined) || stock(slug);
      upd({
        markdown: r.markdown,
        excerpt: r.excerpt,
        coverAlt: r.coverAlt || art.coverAlt,
        slug,
        figures,
        cover,
        manual: false,
        date: new Date().toISOString().slice(0, 10),
        translations: {},
      });
      const w = countWords(r.markdown);
      toast[w >= art.minWords ? "success" : "warning"](`Articolo generato: ${w} parole`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Errore"); }
    finally { setBusy(""); }
  };

  const doManual = () => {
    const text = (art.draftText || "").trim();
    if (!art.title.trim()) { toast.error("Inserisci prima un titolo"); return; }
    if (!text) { toast.error("Incolla prima il tuo testo nel campo \"Testo già pronto\""); return; }
    const md = ensureFigureMarkers(text, figCount);
    upd({
      markdown: md,
      excerpt: art.excerpt || excerptFromText(md),
      slug: art.slug || slugify(art.title),
      figures: syncFigures(md, art.figures),
      manual: true,
      translations: art.markdown === md ? art.translations : {},
    });
    toast.success(`Testo salvato senza modifiche: ${countWords(md)} parole. Ora carica le immagini o lascia i segnaposto.`);
  };

  const bulkUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = [...files].filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) { toast.error("Seleziona dei file immagine"); return; }
    const urls = await Promise.all(list.map(fileToDataUrl));
    let cover = art.cover;
    const figures = art.figures.map((f) => ({ ...f }));
    let used = 0;
    if (!cover && urls[used]) cover = urls[used++]!;
    for (const f of figures) if (!f.src && urls[used]) f.src = urls[used++]!;
    upd({ cover, figures });
    toast[used < urls.length ? "warning" : "success"](
      used < urls.length ? `${used} immagini inserite, ${urls.length - used} in più ignorate (nessuno slot vuoto)` : `${used} immagini inserite negli slot vuoti`,
    );
  };

  /** Genera una singola immagine con AI (copertina o singola figura) */
  const doGenerateImage = async (slot: "cover" | string, promptText?: string) => {
    if (generatingSlot) return;
    const isCover = slot === "cover";
    const prompt = (promptText || "").trim() || (isCover ? art.coverAlt || art.title : art.title);
    if (!prompt.trim()) {
      toast.error(isCover ? "Inserisci prima un titolo o una descrizione copertina" : "Inserisci prima la didascalia della figura");
      return;
    }
    setGeneratingSlot(slot);
    try {
      const res = await generateImg({
        data: {
          prompt,
          title: art.title,
          context: art.excerpt || "",
        },
      });
      if (isCover) {
        upd({ cover: res.url });
        toast.success("Copertina generata con AI");
      } else {
        upd({
          figures: art.figures.map((x) => (x.id === slot ? { ...x, src: res.url } : x)),
        });
        toast.success("Figura generata con AI");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore generazione immagine");
    } finally {
      setGeneratingSlot(null);
    }
  };

  /** Svuota tutte le immagini (copertina e figure) lasciandole vuote */
  const clearAllImages = () => {
    upd({
      cover: undefined,
      figures: art.figures.map((f) => ({ ...f, src: "" })),
    });
    toast.info("Tutte le immagini sono state svuotate");
  };

  const doTranslate = async () => {
    if (!art.markdown) { toast.error("Genera prima l'articolo"); return; }
    setBusy("tr");
    const it = italianTranslation(art);
    const payload = JSON.stringify(it);
    const next: Partial<Record<Lang, Translation>> = { ...art.translations };
    try {
      for (const lang of ["en", "de", "es"] as Lang[]) {
        const t = JSON.parse((await translate({ data: { lang, payload } })).json) as Translation;
        next[lang] = { ...t, readingTime: it.readingTime, figures: it.figures };
        set({ article: { ...art, translations: { ...next } } });
      }
      toast.success("Traduzioni EN, DE, ES pronte");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Errore"); }
    finally { setBusy(""); }
  };

  const hasAnyImages = !!art.cover || art.figures.some((f) => !!f.src);

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
          <p className="mt-1 text-muted-foreground">Cartella: <code>{art.number ? `${art.number}-` : ""}{art.slug || "slug"}/</code></p>
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
          <label htmlFor="draft" className="mb-1 block font-bold">Testo già pronto (facoltativo)</label>
          <p className="text-muted-foreground">Incolla qui l'articolo che hai già scritto. Hai due scelte: <strong>«Usa il mio testo così com'è»</strong> lo salva identico, senza AI e senza consumare crediti; oppure «Genera articolo» lo usa come base e lo fa riscrivere e completare dall'AI.</p>
          <Textarea id="draft" value={art.draftText || ""} onChange={(e) => upd({ draftText: e.target.value })} placeholder="Incolla qui il tuo testo…" className="min-h-40 border-2 text-lg" />
          <p className="text-muted-foreground">Puoi indicare tu dove vanno le immagini scrivendo su una riga da sola <code>[[FIGURA: descrizione]]</code>. Se non ne scrivi, li inserisco io tra i paragrafi (vedi «Figure interne» qui sotto) come segnaposto da sostituire.</p>
          <Button size="lg" variant="secondary" className="h-14 w-full border-2 text-lg font-bold" onClick={doManual} disabled={!!busy}>
            <FileCheck2 /> Usa il mio testo così com'è (senza AI)
          </Button>
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-2xl font-extrabold"><ImageIcon /> 3. Immagini</h2>
          {hasAnyImages && (
            <Button variant="outline" size="sm" onClick={clearAllImages} className="border-2 text-destructive hover:bg-destructive/10 font-bold">
              <Trash2 className="size-4" /> Svuota tutte le immagini
            </Button>
          )}
        </div>

        <div>
          <p className="mb-2 font-bold">Copertina 16:9</p>
          <div className="aspect-video w-full overflow-hidden rounded-lg border-2 bg-muted">
            {art.cover ? (
              <img src={art.cover} alt="Copertina" className="size-full object-cover" />
            ) : (
              <div className="grid size-full place-items-center text-muted-foreground font-semibold">Nessuna copertina (slot vuoto)</div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 sm:gap-3">
            <Button
              variant="default"
              size="lg"
              className="h-12 border-2 font-bold"
              onClick={() => doGenerateImage("cover", art.coverAlt || art.title)}
              disabled={!!generatingSlot}
            >
              {generatingSlot === "cover" ? <Loader2 className="animate-spin" /> : <Sparkles />} Genera con AI
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 border-2 font-semibold"
              onClick={() => upd({ cover: stock(`${art.slug || "blog"}-${Date.now()}`) })}
            >
              <Shuffle /> Foto stock
            </Button>
            <label className="inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-md border-2 px-4 font-semibold hover:bg-secondary">
              Carica immagine
              <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const f = e.target.files?.[0]; if (f) upd({ cover: await fileToDataUrl(f) }); }} />
            </label>
            {art.cover && (
              <Button
                variant="outline"
                size="lg"
                className="h-12 border-2 text-destructive hover:bg-destructive/10 font-semibold"
                onClick={() => { upd({ cover: undefined }); toast.info("Copertina rimossa"); }}
              >
                <Trash2 className="size-5" /> Rimuovi
              </Button>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="coverAlt" className="mb-1 block font-bold">Descrizione della copertina (testo alternativo e spunto AI)</label>
          <Input id="coverAlt" value={art.coverAlt} onChange={(e) => upd({ coverAlt: e.target.value })} placeholder="es. operaio specializzato durante il collaudo in officina" className="h-12 border-2 text-lg" />
        </div>

        <div>
          <label htmlFor="figc" className="mb-1 block font-bold">Figure interne nei paragrafi</label>
          <Input id="figc" type="number" min={0} max={6} value={figCount} onChange={(e) => setFigCount(Number(e.target.value))} className="h-12 border-2 text-lg sm:w-40" />
        </div>

        <label className="inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md border-2 px-4 font-semibold hover:bg-secondary sm:w-auto">
          <Images className="size-5" /> Carica più immagini insieme (negli slot vuoti, in ordine)
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { void bulkUpload(e.target.files); e.target.value = ""; }} />
        </label>

        {art.figures.map((f, i) => (
          <div key={f.id} className="flex flex-col gap-3 rounded-lg border-2 p-3 sm:flex-row">
            {f.src ? (
              <img src={f.src} alt="" className="h-28 w-full shrink-0 rounded object-cover sm:h-24 sm:w-36" />
            ) : (
              <div className="grid h-28 w-full shrink-0 place-items-center rounded border-2 border-dashed bg-muted p-2 text-center text-xs font-bold text-muted-foreground sm:h-24 sm:w-36">
                Da sostituire
              </div>
            )}
            <div className="min-w-0 flex-1 space-y-2">
              <Input
                aria-label={`Didascalia figura ${i + 1}`}
                value={f.caption}
                onChange={(e) => upd({ figures: art.figures.map((x) => (x.id === f.id ? { ...x, caption: e.target.value } : x)) })}
                placeholder={`Didascalia o descrizione figura ${i + 1} (usata anche per generare l'immagine con AI)`}
                className="h-11 border-2"
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="default"
                  className="h-11 border-2 font-bold"
                  onClick={() => doGenerateImage(f.id, f.caption)}
                  disabled={!!generatingSlot}
                >
                  {generatingSlot === f.id ? <Loader2 className="animate-spin" /> : <Sparkles className="size-4" />} Genera con AI
                </Button>
                <Button
                  variant="outline"
                  className="h-11 border-2 font-semibold"
                  onClick={() => upd({ figures: art.figures.map((x) => (x.id === f.id ? { ...x, src: stock(`${f.id}-${Date.now()}`, 1200, 675) } : x)) })}
                >
                  <Shuffle className="size-4" /> Stock
                </Button>
                <label className="inline-flex h-11 cursor-pointer items-center rounded-md border-2 px-3 font-semibold hover:bg-secondary">
                  Carica
                  <input type="file" accept="image/*" className="sr-only" onChange={async (e) => { const file = e.target.files?.[0]; if (file) { const src = await fileToDataUrl(file); upd({ figures: art.figures.map((x) => (x.id === f.id ? { ...x, src } : x)) }); } }} />
                </label>
                {f.src && (
                  <Button
                    variant="outline"
                    className="h-11 border-2 text-destructive hover:bg-destructive/10 font-semibold"
                    onClick={() => {
                      upd({ figures: art.figures.map((x) => (x.id === f.id ? { ...x, src: "" } : x)) });
                      toast.info(`Figura ${i + 1} rimossa`);
                    }}
                    title="Rimuovi immagine"
                  >
                    <Trash2 className="size-4" /> Rimuovi
                  </Button>
                )}
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
            <span className={`rounded-md border-2 px-3 py-1 font-bold ${art.manual || words >= art.minWords ? "text-success" : "text-destructive"}`}>{art.manual ? `${words} parole` : `${words} / ${art.minWords}`}</span>
          </div>
          <Textarea aria-label="Estratto" value={art.excerpt} onChange={(e) => upd({ excerpt: e.target.value })} className="border-2 text-lg" />
          <Textarea aria-label="Corpo articolo in Markdown" value={art.markdown} onChange={(e) => upd({ markdown: e.target.value, figures: syncFigures(e.target.value, art.figures) })} className="min-h-96 border-2 font-mono text-base" />
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
