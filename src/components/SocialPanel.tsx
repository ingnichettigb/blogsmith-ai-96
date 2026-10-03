import { useState } from "react";
import { Share2, Linkedin, Facebook, Send, Sparkles, Copy, Check, Trash2, Loader2, ArrowRight, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useStore, type Article, countWords } from "@/lib/store";
import { generateSocialPost } from "@/lib/ai.functions";

type Platform = "linkedin" | "facebook" | "telegram";

interface SocialPanelProps {
  onNavigate?: (tab: "articolo" | "anteprima") => void;
}

export function SocialPanel({ onNavigate }: SocialPanelProps) {
  const { state, set } = useStore();
  const { article } = state;
  const [loadingPlatform, setLoadingPlatform] = useState<Platform | "">("");
  const [copiedPlatform, setCopiedPlatform] = useState<Platform | "">("");

  const hasArticle = Boolean(article.title?.trim() || article.markdown?.trim());
  const words = countWords(article.markdown || "");

  const updatePost = (platform: Platform, text: string) => {
    const updated: Article = {
      ...article,
      socialPosts: {
        ...(article.socialPosts ?? {}),
        [platform]: text,
      },
    };
    set({ article: updated });
  };

  const doGenerate = async (platform: Platform) => {
    if (!article.title.trim()) {
      toast.error("L'articolo non ha un titolo. Compila prima il titolo dell'articolo.");
      return;
    }
    setLoadingPlatform(platform);
    try {
      const res = await generateSocialPost({
        data: {
          platform,
          title: article.title,
          excerpt: article.excerpt,
          markdown: article.markdown,
          topics: article.topics,
        },
      });
      updatePost(platform, res.post);
      const name = platform === "linkedin" ? "LinkedIn" : platform === "facebook" ? "Facebook" : "Telegram";
      toast.success(`Post per ${name} generato!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore durante la generazione del post");
    } finally {
      setLoadingPlatform("");
    }
  };

  const doCopy = async (platform: Platform, text: string) => {
    if (!text.trim()) {
      toast.error("Nessun testo da copiare.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopiedPlatform(platform);
      setTimeout(() => setCopiedPlatform(""), 2000);
      const name = platform === "linkedin" ? "LinkedIn" : platform === "facebook" ? "Facebook" : "Telegram";
      toast.success(`Testo per ${name} copiato negli appunti!`);
    } catch {
      toast.error("Impossibile copiare il testo");
    }
  };

  const doClear = (platform: Platform) => {
    updatePost(platform, "");
    toast.info("Testo svuotato");
  };

  if (!hasArticle) {
    return (
      <div className="rounded-xl border-2 border-dashed p-8 text-center sm:p-12">
        <Share2 className="mx-auto mb-4 size-12 text-muted-foreground" />
        <h2 className="mb-2 text-2xl font-black">Nessun articolo attivo</h2>
        <p className="mx-auto mb-6 max-w-lg text-muted-foreground">
          Per creare post dedicati a LinkedIn, Facebook e Telegram è necessario prima compilare o generare un articolo nella sezione Articolo.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {onNavigate && (
            <Button size="lg" className="h-12 border-2 font-bold" onClick={() => onNavigate("articolo")}>
              <BookOpen className="size-5" /> Vai a Articolo
            </Button>
          )}
        </div>
      </div>
    );
  }

  const posts = article.socialPosts ?? {};

  const cards: Array<{
    id: Platform;
    name: string;
    icon: typeof Linkedin;
    badge: string;
    badgeColor: string;
    description: string;
    recommendedChars: string;
  }> = [
    {
      id: "linkedin",
      name: "LinkedIn",
      icon: Linkedin,
      badge: "B2B & Leadership",
      badgeColor: "border-blue-500/50 text-blue-500 bg-blue-500/10",
      description: "Gancio forte iniziale, paragrafi snelli, punti elenco tecnici e domanda finale per generare discussione professionale.",
      recommendedChars: "1.200 - 1.800 car.",
    },
    {
      id: "facebook",
      name: "Facebook",
      icon: Facebook,
      badge: "Coinvolgimento & Storytelling",
      badgeColor: "border-indigo-500/50 text-indigo-500 bg-indigo-500/10",
      description: "Tono diretto ed empatico, narrazione del problema e chiaro invito all'azione con anteprima del link al blog.",
      recommendedChars: "400 - 900 car.",
    },
    {
      id: "telegram",
      name: "Telegram",
      icon: Send,
      badge: "Digest Rapido (30s)",
      badgeColor: "border-sky-500/50 text-sky-500 bg-sky-500/10",
      description: "Messaggio broadcast compatto a punti elenco, formattato per una lettura rapida da smartphone in mobilità.",
      recommendedChars: "300 - 700 car.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Intestazione e contesto articolo */}
      <div className="rounded-xl border-2 bg-card p-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Share2 className="size-5 text-primary" />
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground">Articolo di riferimento</span>
            </div>
            <h2 className="text-xl font-black">{article.title || "Senza titolo"}</h2>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-xs font-semibold text-muted-foreground">{words} parole</span>
              {article.topics.map((t) => (
                <Badge key={t} variant="secondary" className="border text-xs font-bold">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
          {onNavigate && (
            <Button variant="outline" className="h-10 self-start border-2 font-bold sm:self-center" onClick={() => onNavigate("anteprima")}>
              Vedi Anteprima <ArrowRight className="size-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-black">Scegli la piattaforma e genera il post</h2>
        <p className="text-sm text-muted-foreground">
          Ogni social ha un registro stilistico dedicato. Clicca <strong>«Genera post con AI»</strong> solo sulla piattaforma che intendi pubblicare per non sprecare crediti. Puoi modificare liberamente il testo generato prima di copiarlo.
        </p>
      </div>

      {/* Griglia a 3 card indipendenti */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {cards.map((card) => {
          const currentText = posts[card.id] ?? "";
          const charCount = currentText.length;
          const isBusy = loadingPlatform === card.id;
          const isCopied = copiedPlatform === card.id;

          return (
            <div key={card.id} className="flex flex-col rounded-xl border-2 bg-card p-5">
              {/* Header card */}
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex size-9 items-center justify-center rounded-lg border-2 bg-secondary">
                    <card.icon className="size-5" />
                  </div>
                  <h3 className="text-lg font-black">{card.name}</h3>
                </div>
                <Badge variant="outline" className={`border text-xs font-bold ${card.badgeColor}`}>
                  {card.badge}
                </Badge>
              </div>

              <p className="mb-4 min-h-[40px] text-xs leading-relaxed text-muted-foreground">
                {card.description}
              </p>

              {/* Azione di generazione primaria */}
              <div className="mb-3">
                <Button
                  className="h-11 w-full border-2 font-bold"
                  variant={currentText ? "outline" : "default"}
                  disabled={loadingPlatform !== ""}
                  onClick={() => void doGenerate(card.id)}
                >
                  {isBusy ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Elaborazione {card.name}...
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-4" /> {currentText ? `Rigenera post ${card.name}` : `Genera post ${card.name}`}
                    </>
                  )}
                </Button>
              </div>

              {/* Editor modificabile */}
              <div className="relative flex flex-1 flex-col">
                <Textarea
                  value={currentText}
                  onChange={(e) => updatePost(card.id, e.target.value)}
                  placeholder={`Clicca sul pulsante sopra per generare la bozza con l'AI, oppure scrivi o incolla qui il tuo post per ${card.name}...`}
                  rows={14}
                  className="w-full resize-y border-2 font-mono text-sm leading-relaxed"
                />

                {/* Contatore caratteri */}
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    Caratteri: <strong className="text-foreground">{charCount}</strong>
                  </span>
                  <span>Ottimale: {card.recommendedChars}</span>
                </div>
              </div>

              {/* Bottoni di gestione */}
              <div className="mt-4 flex items-center gap-2 border-t pt-3">
                <Button
                  className="h-10 flex-1 border-2 font-bold"
                  variant={isCopied ? "secondary" : "default"}
                  disabled={!currentText.trim()}
                  onClick={() => void doCopy(card.id, currentText)}
                >
                  {isCopied ? (
                    <>
                      <Check className="size-4 text-emerald-500" /> Copiato!
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" /> Copia testo
                    </>
                  )}
                </Button>
                {currentText.trim() && (
                  <Button
                    variant="outline"
                    className="h-10 border-2 px-3 text-destructive hover:bg-destructive/10"
                    title="Svuota post"
                    onClick={() => doClear(card.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

