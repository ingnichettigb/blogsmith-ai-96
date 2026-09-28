import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SiteAnalysis } from "./analyze.functions";
import type { Lang, Translation } from "./blocks";

export type Product = {
  id: string;
  title: string;
  description: string;
  badge: string;
  link: string;
  image: string;
};

export type Figure = { id: string; caption: string; src: string };

export type Article = {
  number: string;
  author: string;
  title: string;
  slug: string;
  excerpt: string;
  markdown: string;
  cover: string;
  coverAlt: string;
  figures: Figure[];
  minWords: number;
  date: string;
  ctaProductId: string;
  translations: Partial<Record<Lang, Translation>>;
};

export type Rotation = { mode: "random" | "sequential"; intervalSec: number };

type State = {
  analysis: SiteAnalysis | null;
  products: Product[];
  rotation: Rotation;
  article: Article;
};

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

export const countWords = (s: string) =>
  s.replace(/\[\[FIGURA:[^\]]*\]\]/g, " ").replace(/[#*_>`\-]/g, " ").split(/\s+/).filter((w) => /\p{L}|\d/u.test(w)).length;

const initial: State = {
  analysis: null,
  products: [
    {
      id: "p1",
      title: "Consulenza SEO gratuita",
      description: "30 minuti con un esperto per far crescere il tuo traffico organico.",
      badge: "Gratis",
      link: "https://example.com/seo",
      image: "https://picsum.photos/seed/seo/400/300",
    },
  ],
  rotation: { mode: "sequential", intervalSec: 8 },
  article: {
    number: "001",
    author: "Nichetti Gian Battista",
    title: "",
    slug: "",
    excerpt: "",
    markdown: "",
    cover: "",
    coverAlt: "",
    figures: [],
    minWords: 1500,
    date: new Date().toISOString().slice(0, 10),
    ctaProductId: "",
    translations: {},
  },
};


const Ctx = createContext<{ state: State; set: (p: Partial<State>) => void } | null>(null);
const KEY = "blogengine-state-v1";

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(initial);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as Partial<State>;
        setState({ ...initial, ...p, article: { ...initial.article, ...(p.article ?? {}) } });
      }
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* quota: large images */
    }
  }, [state, loaded]);
  return <Ctx.Provider value={{ state, set: (p) => setState((s) => ({ ...s, ...p })) }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error("StoreProvider missing");
  return c;
}
