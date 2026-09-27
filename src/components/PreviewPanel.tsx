import { useEffect, useState } from "react";
import JSZip from "jszip";
import { Download, FileJson, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Markdown } from "./Markdown";
import { countWords, useStore, type Article, type Product, type Rotation } from "@/lib/store";

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

function frontmatter(a: Article, ext: string) {
  return `---\ntitle: ${JSON.stringify(a.title)}\nslug: ${a.slug}\ndate: ${a.date}\nexcerpt: ${JSON.stringify(a.excerpt)}\ncover: /blog/${a.slug}/copertina.${ext}\nminWords: ${a.minWords}\nwords: ${countWords(a.markdown)}\n---\n\n`;
}

async function toBlob(src: string): Promise<{ blob: Blob; ext: string } | null> {
  try {
    const r = await fetch(src);
    const blob = await r.blob();
    const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg").replace("svg+xml", "svg");
    return { blob, ext };
  } catch { return null; }
}

const INSTRUCTIONS = (slug: string) => `# Installazione rapida

1. Copia la cartella \`public/blog/${slug}/\` dentro la cartella \`public/\` del tuo sito.
2. Copia \`src/content/blog/${slug}.md\` (o \`.json\`) in \`src/content/blog/\`.
3. Copia \`src/content/sponsored.json\` in \`src/content/\` per la sidebar destra a rotazione.
4. Se il sito non ha ancora il blog, usa il prompt generato in "Analisi sito" per creare /blog e /blog/[slug].
5. Pubblica il sito: l'articolo sarà visibile su /blog/${slug}.
`;

export function PreviewPanel() {
  const { state } = useStore();
  const a = state.article;
  const [view, setView] = useState<"list" | "single">("single");
  const words = countWords(a.markdown);

  const exportZip = async () => {
    if (!a.markdown) { toast.error("Genera prima un articolo"); return; }
    const zip = new JSZip();
    const dir = zip.folder(`public/blog/${a.slug}`)!;
    let coverExt = "webp";
    if (a.cover) { const c = await toBlob(a.cover); if (c) { coverExt = c.ext; dir.file(`copertina.${c.ext}`, c.blob); } }
    let md = a.markdown;
    const figMeta: { src: string; caption: string }[] = [];
    for (let i = 0; i < a.figures.length; i++) {
      const f = a.figures[i]!;
      const b = await toBlob(f.src);
      const name = `figura-${i + 1}.${b?.ext ?? "jpg"}`;
      if (b) dir.file(name, b.blob);
      figMeta.push({ src: `/blog/${a.slug}/${name}`, caption: f.caption });
    }
    let n = 0;
    md = md.replace(/\[\[FIGURA:\s*(.+?)\]\]/g, (_, cap) => { const f = figMeta[n++]; return f ? `![${f.caption || cap}](${f.src})` : ""; });
    zip.file(`src/content/blog/${a.slug}.md`, frontmatter(a, coverExt) + `# ${a.title}\n\n` + md);
    zip.file(`src/content/blog/${a.slug}.json`, JSON.stringify({ title: a.title, slug: a.slug, date: a.date, excerpt: a.excerpt, cover: `/blog/${a.slug}/copertina.${coverExt}`, figures: figMeta, words, body: md }, null, 2));
    zip.file("src/content/sponsored.json", JSON.stringify({ rotation: state.rotation, products: state.products.map(({ id: _id, ...p }) => p) }, null, 2));
    zip.file("ISTRUZIONI.md", INSTRUCTIONS(a.slug));
    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: `blog-${a.slug}.zip` }).click();
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
      <div className="sticky top-[72px] z-10 flex flex-wrap items-center gap-3 rounded-xl border-2 bg-card p-3">
        <div role="tablist" className="grid flex-1 grid-cols-2 gap-2">
          <button role="tab" aria-selected={view === "list"} onClick={() => setView("list")} className={`h-12 rounded-md border-2 font-bold ${view === "list" ? "bg-primary text-primary-foreground" : ""}`}>Vetrina /blog</button>
          <button role="tab" aria-selected={view === "single"} onClick={() => setView("single")} className={`h-12 rounded-md border-2 font-bold ${view === "single" ? "bg-primary text-primary-foreground" : ""}`}>Articolo /blog/slug</button>
        </div>
        <span className={`rounded-md border-2 px-3 py-2 text-lg font-extrabold ${words >= a.minWords ? "text-success" : "text-destructive"}`} aria-live="polite">{words} / {a.minWords} parole</span>
      </div>

      <div className="rounded-xl border-2 bg-background p-4 sm:p-8">
        {!a.markdown ? (
          <p className="py-12 text-center text-xl text-muted-foreground">Genera un articolo per vedere l'anteprima.</p>
        ) : view === "list" ? (
          <div>
            <h1 className="mb-6 text-4xl font-extrabold">Blog</h1>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <article className="overflow-hidden rounded-xl border-2 bg-card">
                {a.cover && <img src={a.cover} alt="" className="aspect-video w-full object-cover" />}
                <div className="p-4">
                  <time className="text-muted-foreground">{a.date}</time>
                  <h2 className="mt-1 text-xl font-bold">{a.title}</h2>
                  <p className="mt-2 text-muted-foreground">{a.excerpt}</p>
                  <button onClick={() => setView("single")} className="mt-3 font-bold text-primary underline underline-offset-4">Leggi →</button>
                </div>
              </article>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <article className="min-w-0">
              {a.cover && <img src={a.cover} alt="" className="aspect-video w-full rounded-xl border-2 object-cover" />}
              <h1 className="mt-6 text-3xl font-extrabold sm:text-4xl">{a.title}</h1>
              <time className="text-muted-foreground">{a.date}</time>
              <Markdown md={a.markdown} figures={a.figures} />
            </article>
            <aside className="lg:sticky lg:top-40 lg:self-start">
              <SponsoredSidebar products={state.products} rotation={state.rotation} />
            </aside>
          </div>
        )}
      </div>

      <section className="space-y-4 rounded-xl border-2 bg-card p-4 sm:p-6">
        <h2 className="text-2xl font-extrabold">Esporta</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Button size="lg" className="h-14 text-lg font-bold" onClick={exportZip}><Download /> Pacchetto .zip</Button>
          <Button size="lg" variant="outline" className="h-14 border-2 text-lg" disabled={!a.markdown} onClick={() => dl(`${a.slug}.md`, frontmatter(a, "webp") + `# ${a.title}\n\n` + a.markdown, "text/markdown")}><FileText /> Solo Markdown</Button>
          <Button size="lg" variant="outline" className="h-14 border-2 text-lg" disabled={!a.markdown} onClick={() => dl(`${a.slug}.json`, JSON.stringify({ ...a, words }, null, 2), "application/json")}><FileJson /> Solo JSON</Button>
        </div>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-lg bg-muted p-4 text-base">{INSTRUCTIONS(a.slug || "slug")}</pre>
      </section>
    </div>
  );
}
