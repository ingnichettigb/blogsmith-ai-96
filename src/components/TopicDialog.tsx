import { useState } from "react";
import { Check, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/lib/store";

/**
 * Casella "Argomento" per l'articolo corrente: apre un archivio persistente
 * di argomenti (condiviso tra tutti gli articoli) con selezione rapida,
 * creazione di un nuovo argomento, rinomina e rimozione.
 */
export function TopicDialog() {
  const { state, set } = useStore();
  const [open, setOpen] = useState(false);
  const [newTopic, setNewTopic] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const topic = state.article.topic;

  const selectTopic = (t: string) => {
    set({ article: { ...state.article, topic: t } });
    setOpen(false);
  };

  const clearTopic = (e: React.MouseEvent) => {
    e.stopPropagation();
    set({ article: { ...state.article, topic: "" } });
  };

  const addTopic = () => {
    const t = newTopic.trim();
    if (!t) return;
    if (state.topics.some((x) => x.toLowerCase() === t.toLowerCase())) {
      toast.error("Questo argomento esiste già");
      return;
    }
    set({ topics: [...state.topics, t] });
    setNewTopic("");
    selectTopic(t);
  };

  const removeTopic = (t: string) => {
    set({
      topics: state.topics.filter((x) => x !== t),
      article: state.article.topic === t ? { ...state.article, topic: "" } : state.article,
    });
  };

  const startRename = (t: string) => {
    setRenamingId(t);
    setRenameValue(t);
  };

  const confirmRename = (oldT: string) => {
    const t = renameValue.trim();
    setRenamingId(null);
    if (!t || t === oldT) return;
    if (state.topics.some((x) => x.toLowerCase() === t.toLowerCase() && x !== oldT)) {
      toast.error("Esiste già un argomento con questo nome");
      return;
    }
    set({
      topics: state.topics.map((x) => (x === oldT ? t : x)),
      article: state.article.topic === oldT ? { ...state.article, topic: t } : state.article,
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-2 rounded-lg border-2 bg-accent px-4 py-3 text-left font-bold text-accent-foreground hover:opacity-90"
      >
        <span className="flex items-center gap-2 truncate">
          <Tag className="size-5 shrink-0" />
          {topic || "Nessun argomento selezionato — Clicca per scegliere"}
        </span>
        {topic && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Rimuovi argomento dall'articolo"
            className="shrink-0 rounded p-1 hover:bg-black/10"
            onClick={clearTopic}
            onKeyDown={(e) => { if (e.key === "Enter") clearTopic(e as unknown as React.MouseEvent); }}
          >
            <X className="size-4" />
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Argomento dell'articolo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {state.topics.length === 0 ? (
              <p className="text-muted-foreground">Nessun argomento in archivio ancora. Creane uno qui sotto.</p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-auto rounded-lg border-2 p-1">
                {state.topics.map((t) => (
                  <li key={t} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-secondary">
                    {renamingId === t ? (
                      <>
                        <Input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") confirmRename(t); if (e.key === "Escape") setRenamingId(null); }}
                          className="h-10 flex-1 border-2"
                        />
                        <Button size="icon" className="size-9 shrink-0" onClick={() => confirmRename(t)} aria-label="Conferma rinomina"><Check /></Button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => selectTopic(t)} className="flex min-w-0 flex-1 items-center gap-2 text-left font-semibold">
                          <span className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${topic === t ? "bg-primary text-primary-foreground" : ""}`}>
                            {topic === t && <Check className="size-3.5" />}
                          </span>
                          <span className="truncate">{t}</span>
                        </button>
                        <Button variant="ghost" size="icon" className="size-9 shrink-0" onClick={() => startRename(t)} aria-label={`Rinomina ${t}`}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" className="size-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => removeTopic(t)} aria-label={`Elimina ${t} dall'archivio`}><Trash2 className="size-4" /></Button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-2 border-t-2 pt-4">
              <label htmlFor="new-topic" className="font-bold">Crea nuovo argomento</label>
              <div className="flex gap-2">
                <Input
                  id="new-topic"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") addTopic(); }}
                  placeholder="Es. Gestione credenziali"
                  className="h-11 flex-1 border-2"
                />
                <Button className="h-11 shrink-0 font-bold" disabled={!newTopic.trim()} onClick={addTopic}><Plus /> Aggiungi e seleziona</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
