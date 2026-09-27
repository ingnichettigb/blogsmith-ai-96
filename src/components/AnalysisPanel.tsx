import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, FolderTree, Loader2, Palette, ScanSearch, Type, X, Cpu } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { analyzeSite, type SiteAnalysis } from "@/lib/analyze.functions";
import { useStore } from "@/lib/store";

export function buildBlogPrompt(a: SiteAnalysis) {
  return `Crea la sezione blog per il sito ${a.url}${a.title ? ` ("${a.title}")` : ""}, clonando fedelmente l'estetica esistente.

## Estetica da rispettare
- Palette colori: ${a.colors.join(", ") || "rilevala dal sito"}
- Tipografia: ${a.fonts.join(", ") || "usa gli stessi font del sito"}
- Logo: ${a.logo ?? "riusa il logo dell'header esistente"}
- Riusa header, footer, pulsanti, raggi e spaziature già presenti nel sito.
- Stack rilevato: ${a.tech.join(", ") || "non determinato"} — integra il blog nello stesso stack.

## Pagine da creare
1. /blog — vetrina: griglia responsive (1 colonna mobile, 2 tablet, 3 desktop) di card con copertina 16:9, titolo, estratto, data e link "Leggi".
2. /blog/[slug] — articolo singolo: copertina 16:9 in alto, titolo H1, data, corpo Markdown (h2, h3, liste, figure con didascalia), layout a 2 colonne su desktop: contenuto (max 720px) + SIDEBAR DESTRA STICKY (top: 96px, larghezza 320px). Su mobile la sidebar scende sotto l'articolo.

## Struttura cartelle (modello Content Folder)
public/blog/[slug]/copertina.webp
public/blog/[slug]/figura-1.webp ...
src/content/blog/[slug].md      (frontmatter: title, slug, date, excerpt, cover)
src/content/blog/[slug].json    (alternativa: stessi campi + body)
src/content/sponsored.json      (prodotti per la sidebar)

## Sidebar destra (prodotti sponsorizzati)
- Legge src/content/sponsored.json: [{ "title", "description", "badge", "link", "image" }].
- Mostra UNA card alla volta con rotazione automatica (ogni 8 secondi, in sequenza), con badge, immagine, titolo, descrizione e pulsante CTA che apre il link (rel="sponsored noopener").
- Etichetta visibile "Sponsorizzato".

## Requisiti
- Caricamento automatico di tutti i file in src/content/blog (import.meta.glob o equivalente), ordinati per data decrescente.
- SEO: title, meta description, og:title, og:description, og:image = copertina per ogni articolo.
- Accessibilità: testi ad alto contrasto, font minimo 18px, pulsanti alti almeno 44px.
- Aggiungi il link "Blog" nel menu principale.`;
}

export function AnalysisPanel() {
  const { state, set } = useStore();
  const [url, setUrl] = useState(state.analysis?.url ?? "");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const run = useServerFn(analyzeSite);
  const a = state.analysis;

  const scan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await run({ data: { url } });
      set({ analysis: res });
      toast.success("Analisi completata");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analisi non riuscita");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!a) return;
    await navigator.clipboard.writeText(buildBlogPrompt(a));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={scan} className="rounded-xl border-2 bg-card p-4 sm:p-6">
        <label htmlFor="url" className="mb-2 block text-lg font-bold">Indirizzo del sito da analizzare</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input id="url" inputMode="url" placeholder="https://tuosito.it" value={url} onChange={(e) => setUrl(e.target.value)} className="h-14 border-2 text-lg" required />
          <Button type="submit" size="lg" className="h-14 px-6 text-lg font-bold" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <ScanSearch />} Scansiona
          </Button>
        </div>
      </form>

      {a && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card icon={<Palette />} title="Palette colori">
            <div className="flex flex-wrap gap-3">
              {a.colors.length ? a.colors.map((c) => (
                <div key={c} className="text-center">
                  <div className="h-14 w-14 rounded-lg border-2" style={{ background: c }} />
                  <code className="text-sm">{c}</code>
                </div>
              )) : <p>Nessun colore rilevato</p>}
            </div>
          </Card>
          <Card icon={<Type />} title="Tipografia e logo">
            <p className="mb-2">{a.fonts.join(", ") || "Font di sistema"}</p>
            {a.logo && <img src={a.logo} alt="Logo rilevato" className="max-h-16 rounded border-2 bg-background p-2" />}
          </Card>
          <Card icon={<Cpu />} title="Stack tecnologico">
            <div className="flex flex-wrap gap-2">
              {a.tech.length ? a.tech.map((t) => <span key={t} className="rounded-md border-2 px-3 py-1 font-semibold">{t}</span>) : <p>Non determinato</p>}
            </div>
          </Card>
          <Card icon={a.blog.found ? <Check /> : <X />} title={a.blog.found ? `Blog trovato: ${a.blog.path}` : "Blog assente"}>
            <ul className="space-y-1">
              {a.blog.checked.map((c) => (
                <li key={c.path} className="flex justify-between"><code>{c.path}</code><span className={c.status === 200 ? "font-bold text-success" : "text-destructive"}>{c.status}</span></li>
              ))}
            </ul>
          </Card>
          <Card icon={<FolderTree />} title="Albero cartelle (Content Folder)" className="md:col-span-2">
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-base leading-7">{`progetto/
├── public/
│   └── blog/
│       └── [slug]/
│           ├── copertina.webp   ← 16:9
│           └── figura-1.webp
└── src/
    └── content/
        ├── blog/
        │   ├── [slug].md        ← oppure .json
        │   └── ...
        └── sponsored.json       ← sidebar destra`}</pre>
          </Card>
          {!a.blog.found && (
            <Card icon={<Copy />} title="Prompt pronto per creare il blog" className="md:col-span-2">
              <textarea readOnly value={buildBlogPrompt(a)} className="h-64 w-full rounded-lg border-2 bg-background p-3 font-mono text-sm" aria-label="Prompt generato" />
              <Button onClick={copy} size="lg" className="mt-3 h-12 w-full text-lg font-bold sm:w-auto">
                {copied ? <Check /> : <Copy />} {copied ? "Copiato!" : "Copia prompt"}
              </Button>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ icon, title, children, className = "" }: { icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border-2 bg-card p-4 sm:p-5 ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 text-xl font-bold [&_svg]:size-6">{icon}{title}</h3>
      {children}
    </section>
  );
}
