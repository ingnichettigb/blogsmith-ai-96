import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Pencil, RefreshCw, Link2, Loader2, ExternalLink, Copy, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchSponsoredCards } from "@/lib/sponsored.functions";
import { generateAdsFilename, saveAds, restoreAds } from "@/lib/backup.functions";
import { useStore, type Product } from "@/lib/store";

const empty: Omit<Product, "id"> = { title: "", description: "", badge: "", link: "", image: "" };
const stockPhoto = (seed: string, w = 800, h = 600) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

export function fileToDataUrl(f: File) {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(f);
  });
}

function LinkPopover({ product, onSave }: { product: Product; onSave: (link: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(product.link);

  useEffect(() => {
    if (open) setValue(product.link);
  }, [open, product.link]);

  const openLink = () => {
    const v = value.trim();
    if (!v) { toast.error("Nessun link da aprire"); return; }
    window.open(/^https?:\/\//i.test(v) ? v : `https://${v}`, "_blank", "noopener,noreferrer");
  };

  const copy = async () => {
    if (!value.trim()) { toast.error("Nessun link da copiare"); return; }
    try {
      await navigator.clipboard.writeText(value.trim());
      toast.success("Link copiato");
    } catch {
      toast.error("Impossibile copiare il link");
    }
  };

  const doSave = () => {
    const v = value.trim();
    if (!v) { toast.error("Inserisci un link prima di salvare"); return; }
    onSave(v);
    setOpen(false);
    toast.success("Link di destinazione aggiornato");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-11 border-2" aria-label={`Link di destinazione: ${product.title || "prodotto"}`}><Link2 /></Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-3">
        <p className="font-bold">Link di destinazione</p>
        <Input
          type="url"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="https://..."
          className="h-11 border-2"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); doSave(); } }}
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="h-10 flex-1 border-2" onClick={openLink}><ExternalLink className="size-4" /> Apri</Button>
          <Button type="button" variant="outline" className="h-10 flex-1 border-2" onClick={copy}><Copy className="size-4" /> Copia</Button>
        </div>
        <Button type="button" className="h-10 w-full font-bold" onClick={doSave}>Salva</Button>
      </PopoverContent>
    </Popover>
  );
}

export function ProductsPanel() {
  const { state, set } = useStore();
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncCards = useServerFn(fetchSponsoredCards);

  const onThumbnailFile = async (file?: File) => {
    const id = replacingId;
    setReplacingId(null);
    if (!id || !file) return;
    if (!file.type.startsWith("image/")) { toast.error("Seleziona un file immagine"); return; }
    const src = await fileToDataUrl(file);
    set({ products: state.products.map((p) => (p.id === id ? { ...p, image: src } : p)) });
    toast.success("Immagine sostituita");
  };

  const [adsBusy, setAdsBusy] = useState<"" | "save" | "restore">("");

  const doSaveAds = async () => {
    if (state.products.length === 0 && state.sponsoredLinks.length === 0) { toast.error("Non ci sono carte da salvare"); return; }
    setAdsBusy("save");
    try {
      const filename = generateAdsFilename(state.products.length);
      const result = await saveAds({ products: state.products, sponsoredLinks: state.sponsoredLinks, rotation: state.rotation }, filename);
      if (result === "saved") toast.success(`Pubblicità salvata come ${filename}`);
      if (result === "downloaded") toast.success(`Scaricato ${filename}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore durante il salvataggio");
    } finally {
      setAdsBusy("");
    }
  };

  const doRestoreAds = async () => {
    setAdsBusy("restore");
    try {
      const data = await restoreAds();
      if (!data) return;
      if ((state.products.length > 0 || state.sponsoredLinks.length > 0) && !window.confirm(`Sostituire le ${state.products.length} carte attuali con le ${data.products.length} del file?`)) return;
      set(data);
      toast.success(`Pubblicità ricaricata: ${data.products.length} carte`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "File non valido");
    } finally {
      setAdsBusy("");
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) set({ products: state.products.map((p) => (p.id === editing ? { ...form, id: editing } : p)) });
    else set({ products: [...state.products, { ...form, id: crypto.randomUUID() }] });
    setForm(empty);
    setEditing(null);
  };

  const addLink = () => set({ sponsoredLinks: [...state.sponsoredLinks, { id: crypto.randomUUID(), url: "" }] });

  const updLink = (id: string, url: string) => set({ sponsoredLinks: state.sponsoredLinks.map((l) => (l.id === id ? { ...l, url } : l)) });

  const removeLink = (id: string) =>
    set({
      sponsoredLinks: state.sponsoredLinks.filter((l) => l.id !== id),
      products: state.products.filter((p) => p.sourceLinkId !== id),
    });

  const syncLink = async (id: string) => {
    const link = state.sponsoredLinks.find((l) => l.id === id);
    if (!link || !link.url.trim()) { toast.error("Inserisci prima un URL"); return; }
    setSyncingId(id);
    try {
      const cards = await syncCards({ data: { url: link.url } });
      const fresh: Product[] = cards.map((c, i) => ({
        id: crypto.randomUUID(),
        title: c.title,
        description: c.description,
        badge: "",
        link: c.link,
        image: c.image || stockPhoto(`${id}-${i}`),
        sourceLinkId: id,
      }));
      set({
        products: [...state.products.filter((p) => p.sourceLinkId !== id), ...fresh],
        sponsoredLinks: state.sponsoredLinks.map((l) => {
          if (l.id !== id) return l;
          const { error: _err, ...rest } = l;
          return { ...rest, lastSyncedAt: new Date().toISOString(), cardCount: fresh.length };
        }),
      });
      toast.success(`${fresh.length} cart${fresh.length === 1 ? "a trovata" : "e trovate"}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Errore nella lettura della pagina";
      set({ sponsoredLinks: state.sponsoredLinks.map((l) => (l.id === id ? { ...l, error: msg } : l)) });
      toast.error(msg);
    } finally {
      setSyncingId(null);
    }
  };

  const field = (k: keyof typeof empty, label: string, type = "text") => (
    <div>
      <label htmlFor={`pf-${k}`} className="mb-1 block font-bold">{label}</label>
      <Input id={`pf-${k}`} type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="h-12 border-2 text-lg" required={k === "title" || k === "link"} />
    </div>
  );

  return (
    <div className="space-y-6">
      <section className="space-y-3 rounded-xl border-2 bg-card p-4 sm:p-6">
        <h2 className="text-2xl font-extrabold">Salva e ricarica le carte</h2>
        <p className="text-muted-foreground">Salva tutte le carte, i link di origine e la rotazione in un file <code>AAMMGGHHmm-PUBLICITA-…json</code>, così non devi rifarle ogni volta.</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" size="lg" className="h-12 text-lg font-bold" onClick={doSaveAds} disabled={adsBusy !== ""}><Save className={adsBusy === "save" ? "animate-pulse" : ""} /> Salva Pubblicità</Button>
          <Button type="button" variant="outline" size="lg" className="h-12 border-2 text-lg font-bold" onClick={doRestoreAds} disabled={adsBusy !== ""}><Upload className={adsBusy === "restore" ? "animate-pulse" : ""} /> Ricarica Pubblicità</Button>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border-2 bg-card p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-2xl font-extrabold"><Link2 /> Carte automatiche da una pagina web</h2>
        <p className="text-muted-foreground">Incolla il link di una tua pagina che elenca già delle "carte" (titolo, descrizione, link). Premi "Aggiorna" per leggerle e inserirle in rotazione; puoi aggiungere più link.</p>
        <ul className="space-y-3">
          {state.sponsoredLinks.map((l) => (
            <li key={l.id} className="space-y-2 rounded-lg border-2 p-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input aria-label="URL pagina" type="url" placeholder="https://tuosito.it/pagina" value={l.url} onChange={(e) => updLink(l.id, e.target.value)} className="h-12 flex-1 border-2 text-lg" />
                <div className="flex gap-2">
                  <Button className="h-12 shrink-0 font-bold" onClick={() => syncLink(l.id)} disabled={syncingId === l.id}>
                    {syncingId === l.id ? <Loader2 className="animate-spin" /> : <RefreshCw />} Aggiorna
                  </Button>
                  <Button variant="destructive" className="h-12 shrink-0" aria-label="Rimuovi link" onClick={() => removeLink(l.id)}><Trash2 /></Button>
                </div>
              </div>
              {l.error ? (
                <p className="text-destructive">{l.error}</p>
              ) : l.lastSyncedAt ? (
                <p className="text-muted-foreground">{l.cardCount ?? 0} carte trovate · ultimo aggiornamento {new Date(l.lastSyncedAt).toLocaleString("it-IT")}</p>
              ) : (
                <p className="text-muted-foreground">Non ancora aggiornato.</p>
              )}
            </li>
          ))}
        </ul>
        <Button variant="outline" size="lg" className="h-12 border-2 text-lg font-bold" onClick={addLink}><Plus /> Aggiungi link</Button>
      </section>

      <form onSubmit={save} className="space-y-4 rounded-xl border-2 bg-card p-4 sm:p-6">
        <h2 className="text-2xl font-extrabold">{editing ? "Modifica prodotto" : "Nuovo prodotto o servizio"}</h2>
        {field("title", "Titolo")}
        <div>
          <label htmlFor="pf-desc" className="mb-1 block font-bold">Descrizione</label>
          <Textarea id="pf-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-24 border-2 text-lg" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {field("badge", "Badge (es. -20%, Nuovo)")}
          {field("link", "Link di destinazione", "url")}
        </div>
        {field("image", "URL immagine o icona", "url")}
        <div>
          <label htmlFor="pf-file" className="mb-1 block font-bold">…oppure carica un'immagine</label>
          <input id="pf-file" type="file" accept="image/*" className="block w-full text-base file:mr-3 file:h-12 file:rounded-md file:border-2 file:bg-secondary file:px-4 file:font-bold"
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) setForm({ ...form, image: await fileToDataUrl(f) }); }} />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" size="lg" className="h-12 text-lg font-bold"><Plus /> {editing ? "Salva modifiche" : "Aggiungi"}</Button>
          {editing && <Button type="button" variant="outline" size="lg" className="h-12 border-2 text-lg" onClick={() => { setEditing(null); setForm(empty); }}>Annulla</Button>}
        </div>
      </form>

      <section className="space-y-4 rounded-xl border-2 bg-card p-4 sm:p-6">
        <h2 className="text-2xl font-extrabold">Rotazione nella sidebar</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="rot-mode" className="mb-1 block font-bold">Modalità</label>
            <select id="rot-mode" value={state.rotation.mode} onChange={(e) => set({ rotation: { ...state.rotation, mode: e.target.value as "random" | "sequential" } })} className="h-12 w-full rounded-md border-2 bg-background px-3 text-lg">
              <option value="sequential">A turno (sequenziale)</option>
              <option value="random">Casuale</option>
            </select>
          </div>
          <div>
            <label htmlFor="rot-int" className="mb-1 block font-bold">Cambia ogni (secondi)</label>
            <Input id="rot-int" type="number" min={3} max={120} value={state.rotation.intervalSec} onChange={(e) => set({ rotation: { ...state.rotation, intervalSec: Math.max(3, Number(e.target.value) || 8) } })} className="h-12 border-2 text-lg" />
          </div>
        </div>
      </section>

      <ul className="grid gap-4 sm:grid-cols-2">
        {state.products.map((p) => (
          <li key={p.id} className="flex gap-4 rounded-xl border-2 bg-card p-4">
            {p.image && (
              <button
                type="button"
                className="group relative h-20 w-20 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2"
                onDoubleClick={() => { setReplacingId(p.id); fileInputRef.current?.click(); }}
                aria-label={`Sostituisci l'immagine di ${p.title}, doppio click`}
                title="Doppio click per sostituire l'immagine"
              >
                <img src={p.image} alt="" className="size-full object-cover" />
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                  <Pencil className="size-5 text-white" />
                </span>
              </button>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {p.badge && <span className="rounded bg-accent px-2 py-0.5 text-sm font-bold text-accent-foreground">{p.badge}</span>}
                {p.sourceLinkId && <span className="rounded border-2 px-2 py-0.5 text-sm font-bold text-muted-foreground">Da link automatico</span>}
              </div>
              <h3 className="truncate text-lg font-bold">{p.title}</h3>
              <p className="line-clamp-2 text-muted-foreground">{p.description}</p>
              <div className="mt-2 flex gap-2">
                <Button variant="outline" className="h-11 border-2" onClick={() => { setEditing(p.id); setForm(p); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil /> Modifica</Button>
                <LinkPopover product={p} onSave={(link) => set({ products: state.products.map((x) => (x.id === p.id ? { ...x, link } : x)) })} />
                <Button variant="destructive" className="h-11" aria-label={`Elimina ${p.title}`} onClick={() => set({ products: state.products.filter((x) => x.id !== p.id) })}><Trash2 /></Button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => { onThumbnailFile(e.target.files?.[0]); e.target.value = ""; }}
      />
    </div>
  );
}
