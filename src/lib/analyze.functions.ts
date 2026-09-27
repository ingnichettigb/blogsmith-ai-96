import { createServerFn } from "@tanstack/react-start";

export type SiteAnalysis = {
  url: string;
  title: string;
  description: string;
  colors: string[];
  fonts: string[];
  logo: string | null;
  tech: string[];
  blog: { found: boolean; path: string | null; checked: { path: string; status: number | string }[] };
};

const UA = "Mozilla/5.0 (compatible; BlogEngineAI/1.0)";

function abs(base: string, href: string) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function topColors(text: string): string[] {
  const counts = new Map<string, number>();
  const re = /#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  for (const m of text.match(re) ?? []) {
    let c = m.toLowerCase();
    if (c.length === 4) c = "#" + [...c.slice(1)].map((x) => x + x).join("");
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c]) => c);
}

function detectTech(html: string, headers: Headers): string[] {
  const t: string[] = [];
  const h = html.toLowerCase();
  const rules: [string, RegExp][] = [
    ["Next.js", /__next|_next\/static/],
    ["Nuxt", /__nuxt|_nuxt\//],
    ["Astro", /astro-island|data-astro/],
    ["Gatsby", /___gatsby/],
    ["WordPress", /wp-content|wp-includes/],
    ["Shopify", /cdn\.shopify|shopify\.theme/],
    ["Wix", /wixstatic|wix\.com/],
    ["Squarespace", /squarespace/],
    ["Webflow", /webflow/],
    ["React", /react|data-reactroot/],
    ["Vue", /data-v-[0-9a-f]{6}|vue\.js/],
    ["Svelte", /svelte-[a-z0-9]{5,}/],
    ["Tailwind CSS", /\b(?:px-\d|py-\d|text-(?:sm|lg|xl)|flex items-center)\b/],
    ["Bootstrap", /bootstrap(\.min)?\.(css|js)/],
    ["Vite", /\/assets\/index-[a-z0-9]+\.js|vite/],
    ["Google Analytics", /googletagmanager|gtag\(/],
    ["Lovable", /lovable/],
  ];
  for (const [n, r] of rules) if (r.test(h)) t.push(n);
  const server = headers.get("server");
  const powered = headers.get("x-powered-by");
  if (server) t.push(`Server: ${server}`);
  if (powered) t.push(`Powered by: ${powered}`);
  return [...new Set(t)];
}

export const analyzeSite = createServerFn({ method: "POST" })
  .inputValidator((d: { url: string }) => {
    let u = String(d.url ?? "").trim();
    if (!u) throw new Error("Inserisci un URL");
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    const parsed = new URL(u);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("URL non valido");
    return { url: parsed.toString() };
  })
  .handler(async ({ data }): Promise<SiteAnalysis> => {
    const res = await fetch(data.url, { headers: { "user-agent": UA }, redirect: "follow" });
    if (!res.ok) throw new Error(`Il sito ha risposto con errore ${res.status}`);
    const html = (await res.text()).slice(0, 800_000);
    const base = res.url || data.url;

    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
    const description =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ?? "";

    // CSS: inline + first 3 stylesheets
    let css = (html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) ?? []).join("\n");
    const sheets = [...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*>/gi)]
      .map((m) => m[0].match(/href=["']([^"']+)/i)?.[1])
      .filter(Boolean)
      .slice(0, 3) as string[];
    await Promise.all(
      sheets.map(async (s) => {
        try {
          const r = await fetch(abs(base, s), { headers: { "user-agent": UA } });
          if (r.ok) css += "\n" + (await r.text()).slice(0, 400_000);
        } catch {
          /* ignore */
        }
      }),
    );
    const theme = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)/i)?.[1];
    const colors = [...new Set([...(theme ? [theme.toLowerCase()] : []), ...topColors(css + html)])].slice(0, 8);

    const fontSet = new Set<string>();
    for (const m of html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>]+)/gi)) {
      for (const f of (m[1] ?? "").matchAll(/family=([^&:;]+)/g)) fontSet.add(decodeURIComponent((f[1] ?? "").replace(/\+/g, " ")));
    }
    for (const m of css.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
      const first = (m[1] ?? "").split(",")[0]!.replace(/["']/g, "").trim();
      if (first && !/^(inherit|var\(|initial|sans-serif|serif|monospace|system-ui|-apple-system)/i.test(first))
        fontSet.add(first);
    }
    const fonts = [...fontSet].slice(0, 6);

    const logoImg =
      html.match(/<img[^>]+(?:class|id|alt|src)=["'][^"']*logo[^"']*["'][^>]*>/i)?.[0]?.match(/src=["']([^"']+)/i)?.[1] ??
      html.match(/<link[^>]+rel=["'](?:apple-touch-icon|icon)["'][^>]*href=["']([^"']+)/i)?.[1] ??
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] ??
      null;

    const origin = new URL(base).origin;
    const paths = ["/blog", "/news", "/articoli"];
    const checked = await Promise.all(
      paths.map(async (p) => {
        try {
          const r = await fetch(origin + p, { headers: { "user-agent": UA }, redirect: "follow" });
          return { path: p, status: r.status };
        } catch {
          return { path: p, status: "errore" as const };
        }
      }),
    );
    const linked = paths.find((p) => new RegExp(`href=["'](?:${origin})?${p}[/"'?]`, "i").test(html));
    const okPath = checked.find((c) => c.status === 200)?.path ?? linked ?? null;

    return {
      url: base,
      title,
      description,
      colors,
      fonts,
      logo: logoImg ? abs(base, logoImg) : null,
      tech: detectTech(html, res.headers),
      blog: { found: !!okPath, path: okPath, checked },
    };
  });
