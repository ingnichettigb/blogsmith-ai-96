import { useState, type ReactNode } from "react";
import { Pencil, Shuffle, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { fileToDataUrl } from "./ProductsPanel";

type Props = {
  src?: string;
  alt?: string;
  className?: string;
  /** Mostrato al posto dell'immagine quando src è vuoto (es. "Nessuna copertina"). */
  placeholder?: ReactNode;
  /** Nome dell'immagine mostrato nel titolo del dialog, es. "copertina" o "figura 2". */
  label?: string;
  onReplace: (newSrc: string) => void;
  /** Callback opzionale per generare una foto stock alternativa. */
  onShuffle?: () => void;
};

/**
 * Immagine dell'anteprima che, con un doppio click (o Invio da tastiera),
 * apre una finestra per sostituirla: caricamento da file o incolla URL.
 */
export function EditableImage({ src, alt = "", className, placeholder, label = "immagine", onReplace, onShuffle }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const apply = (newSrc: string) => {
    if (!newSrc.trim()) return;
    onReplace(newSrc.trim());
    setOpen(false);
    setUrl("");
    toast.success("Immagine sostituita");
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Seleziona un file immagine"); return; }
    setBusy(true);
    try { apply(await fileToDataUrl(file)); }
    catch { toast.error("Impossibile leggere il file"); }
    finally { setBusy(false); }
  };

  return (
    <>
      <div
        className={cn("group relative cursor-pointer overflow-hidden", className)}
        onDoubleClick={() => setOpen(true)}
        role="button"
        tabIndex={0}
        aria-label={`Sostituisci ${label}, doppio click o Invio`}
        onKeyDown={(e) => { if (e.key === "Enter") setOpen(true); }}
      >
        {src ? <img src={src} alt={alt} className="size-full object-cover" /> : placeholder}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100 group-focus-visible:bg-black/40 group-focus-visible:opacity-100">
          <span className="flex items-center gap-2 rounded-md bg-background/95 px-3 py-1.5 text-sm font-bold shadow">
            <Pencil className="size-4" /> Doppio click per sostituire
          </span>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sostituisci {label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {src && <img src={src} alt="" className="aspect-video w-full rounded-lg border-2 object-cover" />}
            <label className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md border-2 font-bold hover:bg-secondary">
              <Upload className="size-4" /> Carica dal dispositivo
              <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-sm text-muted-foreground">oppure</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="flex gap-2">
              <Input placeholder="https://esempio.it/immagine.jpg" value={url} onChange={(e) => setUrl(e.target.value)} className="h-11 border-2" onKeyDown={(e) => { if (e.key === "Enter") apply(url); }} />
              <Button className="h-11 shrink-0" disabled={!url.trim()} onClick={() => apply(url)}>Usa URL</Button>
            </div>
            {onShuffle && (
              <Button variant="outline" className="h-11 w-full border-2" onClick={() => { onShuffle(); setOpen(false); }}>
                <Shuffle /> Foto stock casuale
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
