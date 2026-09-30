import { useEffect, useMemo, useState } from "react";
import JSZip from "jszip";
import { Download, FileJson, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EditableImage } from "./EditableImage";
import { Blocks } from "./Blocks";
import { useStore, type Article, type Product, type Rotation } from "@/lib/store";
import { COVER_FILE, LANGS, LANG_LABEL, figureFile, markdownToBlocks, mdWords, type Lang } from "@/lib/blocks";
import { articleJson, folderName, toJpeg } from "@/lib/article";

function SponsoredSidebar({ products, rotation }: { products: Product[]; rotation: Rotation }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (products.length < 2) return;
    const t = setInterval(() => setI((x) => (rotation.mode === "random" ? Math.floor(Math.random() * products.length) : (x + 1) % products.length)), rotation.intervalSec * 1000);
    return () => clearInterval(t);
  }, [products.length, rotation]);
  const p = products[i % Math.max(1, products.length)];
  if (!p) return <p className="rounded-lg border-2 border-dashed p-4 text-muted-foreground">Nessun prodotto configurato</p>;
  return (
    <div className="rounded-xl border-2 bg-card p-4" aria-live="polite">
      <p className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">Sponsorizzato · {(i % products.length) + 1}/{products.length}</p>
      {p.image && <img src={p.image} alt="" className="mb-3 aspect-[4/3] w-full rounded-lg object-cover" />}
      {p.badge && <span className="rounded bg-accent px-2 py-0.5 text-sm font-bold text-accent-foreground">{p.badge}</span>}
      <h4 className="mt-2 text-xl font-bold">{p.title}</h4>
      <p className="mt-1 text-muted-foreground">{p.description}</p>
      <a href={p.link} target="_blank" rel="sponsored noopener noreferrer" className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-md bg-primary font-bold text-primary-foreground">Scopri di più</a>
    </div>
  );
}

const INSTRUCTIONS = (dir: string) => `# Installazione rapida

1. Copia l'intera cartella \`${dir}/\` nella cartella degli articoli del blog del sito.
2. La cartella contiene solo: \`article.json\` (testi e metadati nelle lingue generate), \`${COVER_FILE}\` e le eventuali \`figura-N.jpg\`.
3. Le immagini sono file reali richiamati con il nome relativo dentro il markdown: non serve modificare nulla.
4. Le schede sponsorizzate NON sono incluse: la fascia laterale è gestita in modo centralizzato dal sito.
5. Gli argomenti ("topics") servono al sito per l'indice e i filtri della vetrina /blog.
`;

export function PreviewPanel() {
  const { state, set } = useStore();
  const a = state.article;
  const upd = (p: Partial<Article>) => set({ article: { ...a, ...p } });
  const [view, setView] = useState<"list" | "single">("single");
  const [lang, setLang] = useState<Lang>("it");
  const doc = useMemo(() => articleJson(a), [a]);
  const t = doc.translations[lang] ?? doc.translations.it!;
  const blocks = useMemo(() => markdownToBlocks(t.markdown), [t.markdown]);
  const words = mdWords(t.markdown);

  const exportZip = async () => {
    if (!a.markdown) { toast.error("Genera prima un articolo"); return; }
    const dirName = folderName(a);
    const zip = new JSZip();
    const dir = zip.folder(dirName)!;
    dir.file("article.json", JSON.stringify(doc, null, 2));
    const missing: string[] = [];
    if (a.cover) {
      const c = await toJpeg(a.cover, 1600);
      if (c) dir.file(COVER_FILE, c); else missing.push(COVER_FILE);
    } else missing.push(COVER_FILE);
    for (let i = 0; i < a.figures.length; i++) {
      const f = a.figures[i]!;
      const b = f.src ? await toJpeg(f.src, 1280) : null;
      if (b) dir.file(figureFile(i + 1), b); else missing.push(figureFile(i + 1));
    }
    if (missing.length) toast.warning(`Mancano ${missing.length} immagini: ${missing.join(", ")}`);
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `${dirName}.zip` }).click();
    URL.revokeObjectURL(url);
    toast.success("Pacchetto scaricato");
  };

  const dl = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    Object.assign(document.createElement("a"), { href: url, download: name }).click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-[72px] z-10 space-y-3 rounded-xl border-2 bg-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" className="grid flex-1 grid-cols-2 gap-2">
            <button role="tab" aria-selected={view === "list"} onClick={() => setView("list")} className={`h-12 rounded-md border-2 font-bold ${view === "list" ? "bg-primary text-primary-foreground" : ""}`}>Vetrina /blog</button>
            <button role="tab" aria-selected={view === "single"} onClick={() => setView("single")} className={`h-12 rounded-md border-2 font-bold ${view === "single" ? "bg-primary text-primary-foreground" : ""}`}>Articolo /blog/slug</button>
          </div>
          <span className={`rounded-md border-2 px-3 py-2 text-lg font-extrabold ${a.manual || words >= a.minWords ? "text-success" : "text-destructive"}`} aria-live="polite">{a.manual ? `${words} parole` : `${words} / ${a.minWords} parole`}</span>
        </div>
        <div role="tablist" aria-label="Lingua" className="grid grid-cols-4 gap-2">
          {LANGS.map((l) => (
            <button key={l} role="tab" aria-selected={lang === l} disabled={l !== "it" && !doc.translations[l]}
              onClick={() => setLang(l)}
              className={`h-11 rounded-md border-2 font-bold uppercase disabled:opacity-40 ${lang === l ? "bg-primary text-primary-foreground" : ""}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border-2 bg-background p-4 sm:p-8">
        {!a.markdown ? (
          <p className="py-12 text-center text-xl text-muted-foreground">Genera un articolo per vedere l'anteprima.</p>
        ) : view === "list" ? (
          <div>
            <h1 className="mb-6 text-4xl font-extrabold">Blog</h1>
            {state.topics.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                <span className="rounded-md border-2 bg-primary px-3 py-1 font-bold text-primary-foreground">Tutti</span>
                {state.topics.map((x) => (
                  <span key={x} className={`rounded-md border-2 px-3 py-1 font-bold ${t.topics.includes(x) ? "" : "text-muted-foreground"}`}>{x}</span>
                ))}
              </div>
            )}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <article className="overflow-hidden rounded-xl border-2 bg-card">
                <EditableImage
                  src={a.cover}
                  alt={a.coverAlt}
                  label="copertina"
                  className="aspect-video w-full"
                  placeholder={<div className="grid size-full place-items-center bg-muted text-muted-foreground">Nessuna copertina</div>}
                  onReplace={(src) => upd({ cover: src })}
                />
                <div className="p-4">
                  <time className="text-muted-foreground">{a.date} · {t.readingTime}</time>
                  <h2 className="mt-1 text-xl font-bold">{t.title}</h2>
                  <p className="mt-2 text-muted-foreground">{t.excerpt}</p>
                  {t.topics.length > 0 && (
                    <p className="mt-2 flex flex-wrap gap-1">
                      {t.topics.map((x) => <span key={x} className="rounded bg-secondary px-2 py-0.5 text-sm font-bold">{x}</span>)}
                    </p>
                  )}
                  <button onClick={() => setView("single")} className="mt-3 font-bold text-primary underline underline-offset-4">Leggi →</button>
                </div>
              </article>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <article className="min-w-0">
              <EditableImage
                src={a.cover}
                alt={a.coverAlt}
                label="copertina"
                className="aspect-video w-full rounded-xl border-2"
                placeholder={<div className="grid size-full place-items-center border-2 border-dashed bg-muted text-muted-foreground">Nessuna copertina</div>}
                onReplace={(src) => upd({ cover: src })}
              />
              {t.topics.length > 0 && (
                <p className="mt-4 flex flex-wrap gap-2">
                  {t.topics.map((x) => <span key={x} className="rounded bg-secondary px-2 py-0.5 font-bold">{x}</span>)}
                </p>
              )}
              <h1 className="mt-4 text-3xl font-extrabold sm:text-4xl">{t.title}</h1>
              <p className="text-muted-foreground">{a.date} · {a.author} · {t.readingTime}</p>
              <Blocks content={blocks} figures={a.figures} onReplaceFigure={(id, src) => upd({ figures: a.figures.map((f) => (f.id === id ? { ...f, src } : f)) })} />
            </article>
            <aside className="lg:sticky lg:top-40 lg:self-start">
              <SponsoredSidebar products={state.products} rotation={state.rotation} />
            </aside>
          </div>
        )}
      </div>

      <section className="space-y-4 rounded-xl border-2 bg-card p-4 sm:p-6">
        <h2 className="text-2xl font-extrabold">Esporta</h2>
        <p className="text-muted-foreground">Il pacchetto contiene solo la cartella dell'articolo con <code>article.json</code> e le immagini in .jpg. Nessuna scheda pubblicitaria viene inclusa.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Button size="lg" className="h-14 text-lg font-bold" onClick={exportZip}><Download /> Cartella .zip</Button>
          <Button size="lg" variant="outline" className="h-14 border-2 text-lg" disabled={!a.markdown} onClick={() => dl(`${folderName(a)}-${lang}.md`, `# ${t.title}\n\n${t.markdown}`, "text/markdown")}><FileText /> Markdown ({LANG_LABEL[lang]})</Button>
          <Button size="lg" variant="outline" className="h-14 border-2 text-lg" disabled={!a.markdown} onClick={() => dl("article.json", JSON.stringify(doc, null, 2), "application/json")}><FileJson /> article.json</Button>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-base">{INSTRUCTIONS(folderName(a))}</pre>
      </section>
    </div>
  );
}
