import { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, Link2, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useStore, type Product } from "@/lib/store";

const empty: Omit<Product, "id"> = { title: "", description: "", badge: "", link: "", image: "" };

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

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) set({ products: state.products.map((p) => (p.id === editing ? { ...form, id: editing } : p)) });
    else set({ products: [...state.products, { ...form, id: crypto.randomUUID() }] });
    setForm(empty);
    setEditing(null);
  };

  const field = (k: keyof typeof empty, label: string, type = "text") => (
    <div>
      <label htmlFor={`pf-${k}`} className="mb-1 block font-bold">{label}</label>
      <Input id={`pf-${k}`} type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="h-12 border-2 text-lg" required={k === "title" || k === "link"} />
    </div>
  );

  return (
    <div className="space-y-6">
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
            {p.image && <img src={p.image} alt="" className="h-20 w-20 shrink-0 rounded-lg border-2 object-cover" />}
            <div className="min-w-0 flex-1">
              {p.badge && <span className="rounded bg-accent px-2 py-0.5 text-sm font-bold text-accent-foreground">{p.badge}</span>}
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
    </div>
  );
}
