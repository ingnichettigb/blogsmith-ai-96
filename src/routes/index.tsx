import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Sun, ScanSearch, Megaphone, PenLine, Eye, Share2, Save, Upload, History, Trash2, ArchiveRestore, FolderArchive } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { ProductsPanel } from "@/components/ProductsPanel";
import { ArticlePanel } from "@/components/ArticlePanel";
import { PreviewPanel } from "@/components/PreviewPanel";
import { SocialPanel } from "@/components/SocialPanel";
import { useStore, type State } from "@/lib/store";
import {
  generateCompleteBackupFilename,
  generateBlogBackupFilename,
  saveCompleteBackup,
  saveBlogBackup,
  restoreBackup,
  restoreFromHistory,
  classifyBackup,
  getBackupHistory,
  removeBackupHistoryEntry,
  clearBackupHistory,
  type BackupHistoryEntry,
} from "@/lib/backup.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BlogEngine AI — Genera blog professionali per qualsiasi sito" },
      { name: "description", content: "Analizza un sito, genera articoli con AI, gestisci prodotti sponsorizzati, anteprima ed export pronto all'uso con post social." },
      { property: "og:title", content: "BlogEngine AI" },
      { property: "og:description", content: "Analisi sito, articoli AI, sidebar sponsorizzata, export ZIP e post social pronti." },
    ],
  }),
  component: Index,
});

function formatHistoryDate(iso: string) {
  return new Date(iso).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function SaveRestoreControls() {
  const { state, set } = useStore();
  const [busy, setBusy] = useState<"" | "saveAll" | "saveBlog" | "restore">("");
  const [history, setHistory] = useState<BackupHistoryEntry[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pending, setPending] = useState<BackupHistoryEntry | null>(null);

  useEffect(() => {
    setHistory(getBackupHistory());
  }, []);

  const ensureArticleNumber = () => {
    let current = state;
    if (!current.article.number) {
      const number = String(current.nextArticleNumber).padStart(3, "0");
      current = { ...current, article: { ...current.article, number }, nextArticleNumber: current.nextArticleNumber + 1 };
      set({ article: current.article, nextArticleNumber: current.nextArticleNumber });
    }
    return current;
  };

  const doSaveAll = async () => {
    setBusy("saveAll");
    try {
      const current = ensureArticleNumber();
      const filename = generateCompleteBackupFilename(current.article.title);
      const result = await saveCompleteBackup(current, filename);
      if (result === "saved") toast.success(`Backup completo salvato come ${filename}`);
      if (result === "downloaded") toast.success(`Backup completo scaricato: ${filename}`);
      if (result !== "cancelled") setHistory(getBackupHistory());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore durante il salvataggio completo");
    } finally {
      setBusy("");
    }
  };

  const doSaveBlog = async () => {
    setBusy("saveBlog");
    try {
      const current = ensureArticleNumber();
      const filename = generateBlogBackupFilename(current.article.title);
      const result = await saveBlogBackup({ article: current.article, nextArticleNumber: current.nextArticleNumber, topics: current.topics }, filename);
      if (result === "saved") toast.success(`Blog salvato come ${filename}`);
      if (result === "downloaded") toast.success(`Blog scaricato: ${filename}`);
      if (result !== "cancelled") setHistory(getBackupHistory());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore durante il salvataggio del blog");
    } finally {
      setBusy("");
    }
  };

  const doRestore = async () => {
    setBusy("restore");
    try {
      const raw = await restoreBackup();
      if (!raw || typeof raw !== "object") return;
      const parsed = classifyBackup(raw);
      set(parsed.data);
      toast.success(`Ripristinato: ${parsed.label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "File di backup non valido");
    } finally {
      setBusy("");
    }
  };

  const doRestoreEntry = async (entry: BackupHistoryEntry) => {
    setBusy("restore");
    try {
      const r = await restoreFromHistory(entry);
      if (!r || typeof r.data !== "object" || r.data === null) return;
      const parsed = classifyBackup(r.data);
      set(parsed.data);
      toast.success(`Ripristinato: ${parsed.label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Il file scelto non è un backup valido");
    } finally {
      setBusy("");
    }
  };

  return (
    <>
      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="outline"
          className="h-11 border-2 px-2.5 sm:px-3"
          onClick={doSaveAll}
          disabled={busy !== ""}
          title="Salva tutto insieme (Analisi + Sponsorizzati + Blog + Social)"
          aria-label="Salva tutto insieme"
        >
          <FolderArchive className={`size-4 ${busy === "saveAll" ? "animate-pulse" : ""}`} />
          <span className="hidden sm:inline">Salva tutto</span>
        </Button>

        <Button
          variant="outline"
          className="h-11 border-2 px-2.5 sm:px-3"
          onClick={doSaveBlog}
          disabled={busy !== ""}
          title="Salva solo Articolo Blog e Social"
          aria-label="Salva solo Blog"
        >
          <Save className={`size-4 ${busy === "saveBlog" ? "animate-pulse" : ""}`} />
          <span className="hidden sm:inline">Salva Blog</span>
        </Button>

        <Button
          variant="outline"
          className="h-11 border-2 px-2.5 sm:px-3"
          onClick={doRestore}
          disabled={busy !== ""}
          title="Ripristina file (riconosce in automatico Completo, Blog o Pubblicità)"
          aria-label="Ripristina da backup"
        >
          <Upload className={`size-4 ${busy === "restore" ? "animate-pulse" : ""}`} />
          <span className="hidden md:inline">Ripristina</span>
        </Button>

        <Popover open={historyOpen} onOpenChange={setHistoryOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-11 min-w-11 border-2" aria-label="Cronologia salvataggi" title="Cronologia salvataggi recenti">
              <History />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-bold">Salvataggi recenti</p>
              {history.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  onClick={() => {
                    clearBackupHistory();
                    setHistory([]);
                    toast.success("Cronologia svuotata");
                  }}
                >
                  Svuota elenco
                </Button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">Nessun salvataggio recente memorizzato in questo browser.</p>
            ) : (
              <>
                <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                  {history.map((entry) => (
                    <li key={entry.savedAt} className="flex items-center justify-between gap-2 rounded-md p-2 hover:bg-secondary">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate font-semibold">{entry.filename || "Senza titolo"}</p>
                          {entry.filename.includes("COMPLETO") ? (
                            <span className="shrink-0 rounded bg-primary/10 px-1 py-0.5 text-[10px] font-bold text-primary uppercase">Tutto</span>
                          ) : entry.filename.includes("PUBLICITA") ? (
                            <span className="shrink-0 rounded bg-amber-500/10 px-1 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Pubblicità</span>
                          ) : (
                            <span className="shrink-0 rounded bg-secondary px-1 py-0.5 text-[10px] font-bold text-muted-foreground uppercase">Blog</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatHistoryDate(entry.savedAt)} {entry.hasSnapshot ? "• copia locale" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2"
                          title="Ripristina questo salvataggio"
                          onClick={() => {
                            setHistoryOpen(false);
                            setPending(entry);
                          }}
                        >
                          <ArchiveRestore className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 text-destructive hover:bg-destructive/10"
                          title="Elimina dall'elenco"
                          onClick={() => {
                            removeBackupHistoryEntry(entry.savedAt);
                            setHistory(getBackupHistory());
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-muted-foreground">
                  Il pulsante di ripristino carica il contenuto del file. Eliminare una voce la rimuove dall'elenco e dalla memoria locale, ma non cancella il file sul tuo computer.
                </p>
              </>
            )}
          </PopoverContent>
        </Popover>
      </div>

      <AlertDialog open={!!pending} onOpenChange={(o) => { if (!o) setPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ripristinare questo salvataggio?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{pending?.filename}</span>
              <br />
              {pending?.filename.includes("COMPLETO")
                ? "Questo backup completo sostituirà l'analisi, le sponsorizzate e l'articolo con i social attuali."
                : pending?.filename.includes("PUBLICITA")
                ? "Questo file sostituirà solo le carte sponsorizzate e la rotazione, lasciando invariato l'articolo del blog."
                : "Questo file sostituirà solo l'articolo del blog e i social collegati, preservando l'analisi del sito e le sponsorizzate correnti."}
              <br />
              {pending && !pending.hasSnapshot && " Questo salvataggio è precedente alla copia nel browser: dopo aver confermato dovrai scegliere il file .json con questo nome dal tuo dispositivo."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (pending) void doRestoreEntry(pending); }}>Ripristina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const TABS = [
  { id: "analisi", label: "Analisi sito", icon: ScanSearch },
  { id: "prodotti", label: "Sponsorizzati", icon: Megaphone },
  { id: "articolo", label: "Articolo", icon: PenLine },
  { id: "anteprima", label: "Anteprima", icon: Eye },
  { id: "social", label: "Social", icon: Share2 },
] as const;
type Tab = (typeof TABS)[number]["id"];

function Index() {
  const [tab, setTab] = useState<Tab>("analisi");
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(localStorage.getItem("be-theme") === "dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("be-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <>
      <div className="min-h-screen pb-24 lg:pb-8">
        <header className="sticky top-0 z-20 border-b-2 bg-background">
          <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate font-display text-2xl font-black">Blog<span className="text-primary">Engine</span> AI</p>
            </div>
            <div className="flex items-center gap-2">
              <SaveRestoreControls />
              <Button variant="outline" className="min-h-11 min-w-11 border-2" onClick={() => setDark(!dark)} aria-label={dark ? "Tema chiaro" : "Tema scuro"}>
                {dark ? <Sun /> : <Moon />}
              </Button>
            </div>
          </div>
          <nav className="mx-auto hidden max-w-6xl gap-2 px-4 pb-3 lg:flex" aria-label="Sezioni">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} aria-current={tab === t.id ? "page" : undefined}
                className={`flex h-12 items-center gap-2 rounded-lg border-2 px-5 text-lg font-bold ${tab === t.id ? "bg-foreground text-background" : "hover:bg-secondary"}`}>
                <t.icon className="size-5" /> {t.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="mb-6 text-3xl font-black sm:text-4xl">{TABS.find((t) => t.id === tab)?.label}</h1>
          {tab === "analisi" && <AnalysisPanel />}
          {tab === "prodotti" && <ProductsPanel />}
          {tab === "articolo" && <ArticlePanel />}
          {tab === "anteprima" && <PreviewPanel />}
          {tab === "social" && <SocialPanel onNavigate={(target) => setTab(target)} />}
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t-2 bg-background lg:hidden" aria-label="Sezioni">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }); }} aria-current={tab === t.id ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold ${tab === t.id ? "bg-foreground text-background" : ""}`}>
              <t.icon className="size-5" /> {t.label}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
