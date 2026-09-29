import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Moon, Sun, ScanSearch, Megaphone, PenLine, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnalysisPanel } from "@/components/AnalysisPanel";
import { ProductsPanel } from "@/components/ProductsPanel";
import { ArticlePanel } from "@/components/ArticlePanel";
import { PreviewPanel } from "@/components/PreviewPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BlogEngine AI — Genera blog professionali per qualsiasi sito" },
      { name: "description", content: "Analizza un sito, genera articoli con AI, gestisci prodotti sponsorizzati ed esporta il blog pronto." },
      { property: "og:title", content: "BlogEngine AI" },
      { property: "og:description", content: "Analisi sito, articoli AI, sidebar sponsorizzata ed export pronto all'uso." },
    ],
  }),
  component: Index,
});

const TABS = [
  { id: "analisi", label: "Analisi sito", icon: ScanSearch },
  { id: "prodotti", label: "Sponsorizzati", icon: Megaphone },
  { id: "articolo", label: "Articolo", icon: PenLine },
  { id: "anteprima", label: "Anteprima", icon: Eye },
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
            <Button variant="outline" className="min-h-11 min-w-11 border-2" onClick={() => setDark(!dark)} aria-label={dark ? "Tema chiaro" : "Tema scuro"}>
              {dark ? <Sun /> : <Moon />}
            </Button>
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
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t-2 bg-background lg:hidden" aria-label="Sezioni">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }); }} aria-current={tab === t.id ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-1 text-sm font-bold ${tab === t.id ? "bg-foreground text-background" : ""}`}>
              <t.icon className="size-6" /> {t.label}
            </button>
          ))}
        </nav>
      </div>
    </>
  );
}
