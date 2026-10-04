import { useState, useRef } from "react";
import {
  Share2,
  Linkedin,
  Facebook,
  Send,
  Sparkles,
  Copy,
  Check,
  Trash2,
  Loader2,
  ArrowRight,
  BookOpen,
  Download,
  Video,
  Image as ImageIcon,
  Film,
  Clapperboard,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useStore, type Article, type SocialPosts, countWords } from "@/lib/store";
import { generateSocialPost, generateVideoPrompt } from "@/lib/ai.functions";

type Platform = "linkedin" | "facebook" | "telegram";

interface SocialPanelProps {
  onNavigate?: (tab: "articolo" | "anteprima") => void;
}

export function SocialPanel({ onNavigate }: SocialPanelProps) {
  const { state, set } = useStore();
  const { article } = state;
  const [loadingPlatform, setLoadingPlatform] = useState<Platform | "">("");
  const [loadingVideoPrompt, setLoadingVideoPrompt] = useState<Platform | "">("");
  const [copiedPlatform, setCopiedPlatform] = useState<Platform | "">("");
  const [copiedPromptPlatform, setCopiedPromptPlatform] = useState<Platform | "">("");

  // Piattaforma attiva nella scheda Prompt Video in fondo alla pagina
  const [promptPlatform, setPromptPlatform] = useState<Platform>("linkedin");
  const promptSectionRef = useRef<HTMLDivElement>(null);
  const openPromptSection = (platform: Platform) => {
    setPromptPlatform(platform);
    setTimeout(() => promptSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  // Riferimenti per input file video
  const videoInputRefs = {
    linkedin: useRef<HTMLInputElement>(null),
    facebook: useRef<HTMLInputElement>(null),
    telegram: useRef<HTMLInputElement>(null),
  };

  const hasArticle = Boolean(article.title?.trim() || article.markdown?.trim());
  const words = countWords(article.markdown || "");

  // Elenco immagini disponibili dall'articolo corrente (copertina + figure)
  const availableImages = [
    ...(article.cover ? [{ id: "cover", label: "Copertina", src: article.cover }] : []),
    ...article.figures
      .filter((f) => Boolean(f.src))
      .map((f, idx) => ({ id: f.id || `fig-${idx + 1}`, label: `Figura ${idx + 1}`, src: f.src })),
  ];

  const posts: SocialPosts = article.socialPosts ?? {};

  const updateArticleSocial = (patch: Partial<SocialPosts>) => {
    const updated: Article = {
      ...article,
      socialPosts: {
        ...(article.socialPosts ?? {}),
        ...patch,
      },
    };
    set({ article: updated });
  };

  const updatePostText = (platform: Platform, text: string) => {
    updateArticleSocial({ [platform]: text });
  };

  const updateVideoPromptText = (platform: Platform, prompt: string) => {
    const key = `${platform}VideoPrompt` as keyof SocialPosts;
    updateArticleSocial({ [key]: prompt });
  };

  const selectImageForPlatform = (platform: Platform, imageSrc: string) => {
    const key = `${platform}Image` as keyof SocialPosts;
    updateArticleSocial({ [key]: imageSrc });
    toast.success("Immagine selezionata per il post");
  };

  const handleVideoUpload = (platform: Platform, file?: File) => {
    if (!file) return;
    if (file.size > 30 * 1024 * 1024) {
      toast.warning("File video superiore a 30 MB: ti consigliamo un video compresso (es. MP4 720p).");
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const videoKey = `${platform}Video` as keyof SocialPosts;
      const nameKey = `${platform}VideoName` as keyof SocialPosts;
      updateArticleSocial({
        [videoKey]: dataUrl,
        [nameKey]: file.name,
      });
      toast.success(`Video caricato: ${file.name}`);
    };
    reader.readAsDataURL(file);
  };

  const removeVideo = (platform: Platform) => {
    const videoKey = `${platform}Video` as keyof SocialPosts;
    const nameKey = `${platform}VideoName` as keyof SocialPosts;
    updateArticleSocial({
      [videoKey]: undefined,
      [nameKey]: undefined,
    });
    toast.info("Video rimosso. Torna visibile l'immagine selezionata.");
  };

  const downloadFile = (src: string, filename: string) => {
    const a = document.createElement("a");
    a.href = src;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Scaricato: ${filename}`);
  };

  const doGeneratePost = async (platform: Platform) => {
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
      updatePostText(platform, res.post);
      const name = platform === "linkedin" ? "LinkedIn" : platform === "facebook" ? "Facebook" : "Telegram";
      toast.success(`Post per ${name} generato!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore durante la generazione del post");
    } finally {
      setLoadingPlatform("");
    }
  };

  const doGenerateVideoPrompt = async (platform: Platform) => {
    if (!article.title.trim()) {
      toast.error("L'articolo non ha un titolo.");
      return;
    }
    setLoadingVideoPrompt(platform);
    try {
      const res = await generateVideoPrompt({
        data: {
          platform,
          title: article.title,
          excerpt: article.excerpt,
          topics: article.topics,
        },
      });
      updateVideoPromptText(platform, res.prompt);
      setShowVideoPromptBox((prev) => ({ ...prev, [platform]: true }));
      toast.success("Prompt video AI generato in inglese!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore generazione prompt video");
    } finally {
      setLoadingVideoPrompt("");
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

  const doCopyVideoPrompt = async (platform: Platform, promptText: string) => {
    if (!promptText.trim()) {
      toast.error("Nessun prompt da copiare.");
      return;
    }
    try {
      await navigator.clipboard.writeText(promptText);
      setCopiedPromptPlatform(platform);
      setTimeout(() => setCopiedPromptPlatform(""), 2000);
      toast.success("Prompt video copiato negli appunti! Incollalo in Runway, Kling o Sora.");
    } catch {
      toast.error("Impossibile copiare il prompt");
    }
  };

  const doClear = (platform: Platform) => {
    updatePostText(platform, "");
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
      description: "Gancio forte iniziale, paragrafi snelli, punti elenco tecnici e domanda finale per generare discussione tra professionisti.",
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
        <h2 className="text-lg font-black">Scegli la piattaforma, gestisci i media e genera il post</h2>
        <p className="text-sm text-muted-foreground">
          Ogni social ha un registro stilistico dedicato. Puoi abbinare l'immagine del blog, caricare un video oppure generare un <strong>prompt cinematografico</strong> da dare in pasto all'AI video.
        </p>
      </div>

      {/* Griglia a 3 card indipendenti */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {cards.map((card) => {
          const currentText = posts[card.id] ?? "";
          const charCount = currentText.length;
          const isBusy = loadingPlatform === card.id;
          const isBusyPrompt = loadingVideoPrompt === card.id;
          const isCopied = copiedPlatform === card.id;
          const isPromptCopied = copiedPromptPlatform === card.id;

          // Video o immagine assegnata a questo social
          const assignedVideo = posts[`${card.id}Video` as keyof SocialPosts];
          const assignedVideoName = posts[`${card.id}VideoName` as keyof SocialPosts];
          const assignedImage =
            posts[`${card.id}Image` as keyof SocialPosts] || availableImages[0]?.src || "";
          const currentVideoPrompt =
            posts[`${card.id}VideoPrompt` as keyof SocialPosts] || "";

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

              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                {card.description}
              </p>

              {/* SEZIONE MULTIMEDIALE: Immagine, Video o Prompt Video AI */}
              <div className="mb-4 rounded-lg border-2 bg-secondary/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-muted-foreground">
                    {assignedVideo ? <Film className="size-3.5 text-primary" /> : <ImageIcon className="size-3.5 text-primary" />}
                    Media per {card.name}
                  </span>
                  {assignedVideo && (
                    <Badge variant="secondary" className="border text-[10px] font-bold">
                      Video allegato
                    </Badge>
                  )}
                </div>

                {/* Player Video oppure Immagine */}
                {assignedVideo ? (
                  <div className="space-y-2">
                    <video
                      src={assignedVideo}
                      controls
                      className="aspect-video max-h-44 w-full rounded-md border-2 bg-black object-contain"
                    />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="truncate max-w-[180px] font-semibold">{assignedVideoName || "video-post.mp4"}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 border px-2 text-xs font-bold"
                          onClick={() => downloadFile(assignedVideo, assignedVideoName || `video-${card.id}.mp4`)}
                          title="Scarica file video"
                        >
                          <Download className="size-3.5" /> Scarica
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-destructive hover:bg-destructive/10"
                          onClick={() => removeVideo(card.id)}
                          title="Rimuovi video e torna all'immagine"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignedImage ? (
                      <div className="relative overflow-hidden rounded-md border-2 bg-black">
                        <img
                          src={assignedImage}
                          alt={`Media per ${card.name}`}
                          className="aspect-video max-h-44 w-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="flex aspect-video max-h-36 w-full items-center justify-center rounded-md border-2 border-dashed bg-secondary text-center text-xs text-muted-foreground">
                        Nessuna immagine nell'articolo.
                      </div>
                    )}

                    {/* Miniature per scegliere quale figura associare */}
                    {availableImages.length > 1 && (
                      <div className="flex items-center gap-1.5 overflow-x-auto py-1">
                        {availableImages.map((img) => {
                          const isSelected = assignedImage === img.src;
                          return (
                            <button
                              key={img.id}
                              onClick={() => selectImageForPlatform(card.id, img.src)}
                              className={`relative h-12 w-20 flex-shrink-0 overflow-hidden rounded border-2 transition-all ${
                                isSelected ? "border-primary ring-2 ring-primary" : "opacity-60 hover:opacity-100"
                              }`}
                              title={`Usa ${img.label}`}
                            >
                              <img src={img.src} alt={img.label} className="size-full object-cover" />
                              <span className="absolute inset-x-0 bottom-0 bg-black/80 px-1 text-[9px] font-bold text-white truncate">
                                {img.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Azioni media */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {assignedImage && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 min-w-0 border-2 px-2 text-xs font-bold"
                          onClick={() => downloadFile(assignedImage, `immagine-${card.id}.jpg`)}
                        >
                          <Download className="size-3.5 shrink-0" /> <span className="truncate">Scarica foto</span>
                        </Button>
                      )}
                      <input
                        type="file"
                        ref={videoInputRefs[card.id]}
                        accept="video/mp4,video/webm,video/quicktime"
                        className="hidden"
                        onChange={(e) => handleVideoUpload(card.id, e.target.files?.[0])}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className={`h-9 min-w-0 border-2 px-2 text-xs font-bold ${assignedImage ? "" : "col-span-2"}`}
                        title="Allega un video pronto (MP4, WebM)"
                        onClick={() => videoInputRefs[card.id].current?.click()}
                      >
                        <Video className="size-3.5 shrink-0 text-primary" /> <span className="truncate">Carica video</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`col-span-2 h-9 border-2 text-xs font-bold ${currentVideoPrompt ? "text-primary" : ""}`}
                        title="Apri la scheda prompt video in fondo alla pagina"
                        onClick={() => openPromptSection(card.id)}
                      >
                        <Clapperboard className="size-3.5 shrink-0" /> Prompt video AI <ArrowDown className="size-3.5 shrink-0" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Azione di generazione primaria del testo del post */}
              <div className="mb-3">
                <Button
                  className="h-11 w-full border-2 font-bold"
                  variant={currentText ? "outline" : "default"}
                  disabled={loadingPlatform !== ""}
                  onClick={() => void doGeneratePost(card.id)}
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

              {/* Editor testo modificabile */}
              <div className="relative flex flex-1 flex-col">
                <Textarea
                  value={currentText}
                  onChange={(e) => updatePostText(card.id, e.target.value)}
                  placeholder={`Clicca sul pulsante sopra per generare la bozza con l'AI, oppure scrivi o incolla qui il tuo post per ${card.name}...`}
                  rows={12}
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
                      <Check className="size-4 text-emerald-500" /> Testo copiato!
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

      {/* SCHEDA PROMPT VIDEO AI — in fondo, a tutta larghezza */}
      {(() => {
        const p = promptPlatform;
        const pName = cards.find((c) => c.id === p)?.name ?? "";
        const promptText = (posts[`${p}VideoPrompt` as keyof SocialPosts] as string) || "";
        const busy = loadingVideoPrompt === p;
        const copied = copiedPromptPlatform === p;
        return (
          <div ref={promptSectionRef} className="scroll-mt-4 space-y-4 rounded-xl border-2 border-primary bg-card p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <Clapperboard className="size-6 shrink-0 text-primary" />
                <h2 className="text-xl font-black sm:text-2xl">Prompt Video AI</h2>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {cards.map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant={p === c.id ? "default" : "outline"}
                    className="h-9 border-2 font-bold"
                    onClick={() => setPromptPlatform(c.id)}
                  >
                    <c.icon className="size-4" /> {c.name}
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Descrizione cinematografica in inglese per {pName}, da incollare in Runway, Kling, Sora o Luma. Puoi modificarla liberamente.
            </p>
            <Button
              className="h-11 w-full border-2 font-bold sm:w-auto"
              disabled={loadingVideoPrompt !== ""}
              onClick={() => void doGenerateVideoPrompt(p)}
            >
              {busy ? (
                <><Loader2 className="size-4 animate-spin" /> Generazione prompt...</>
              ) : (
                <><Sparkles className="size-4" /> {promptText ? `Rigenera prompt ${pName}` : `Crea prompt video ${pName}`}</>
              )}
            </Button>
            <Textarea
              value={promptText}
              onChange={(e) => updateVideoPromptText(p, e.target.value)}
              placeholder="Il prompt video comparirà qui. Potrai modificarlo prima di copiarlo..."
              rows={10}
              className="w-full resize-y border-2 text-base leading-relaxed"
            />
            <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
              <Button
                className="h-10 border-2 font-bold"
                variant={copied ? "secondary" : "default"}
                disabled={!promptText.trim()}
                onClick={() => void doCopyVideoPrompt(p, promptText)}
              >
                {copied ? <><Check className="size-4" /> Prompt copiato!</> : <><Copy className="size-4" /> Copia prompt</>}
              </Button>
              <Button
                variant="outline"
                className="h-10 border-2 font-bold text-destructive"
                disabled={!promptText.trim()}
                onClick={() => updateVideoPromptText(p, "")}
              >
                <Trash2 className="size-4" /> Svuota
              </Button>
              <Button
                variant="outline"
                className="h-10 border-2 font-bold"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              >
                <ArrowUp className="size-4" /> Torna ai post
              </Button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
