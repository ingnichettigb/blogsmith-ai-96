import type { ReactNode } from "react";
import type { Figure } from "@/lib/store";

function inline(t: string, key: string): ReactNode[] {
  const parts = t.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g);
  return parts.map((p, i) => {
    const k = `${key}-${i}`;
    if (/^\*\*.+\*\*$/.test(p)) return <strong key={k}>{p.slice(2, -2)}</strong>;
    if (/^\*.+\*$/.test(p)) return <em key={k}>{p.slice(1, -1)}</em>;
    const l = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (l) return <a key={k} href={l[2]} className="text-primary underline underline-offset-4">{l[1]}</a>;
    return p;
  });
}

export function Markdown({ md, figures }: { md: string; figures: Figure[] }) {
  const lines = md.split("\n");
  const out: ReactNode[] = [];
  let list: string[] = [];
  let ordered = false;
  let figIdx = 0;
  const flush = (k: number) => {
    if (!list.length) return;
    const items = list.map((li, i) => <li key={i}>{inline(li, `li${k}-${i}`)}</li>);
    out.push(ordered ? <ol key={`l${k}`} className="my-4 list-decimal space-y-2 pl-6">{items}</ol> : <ul key={`l${k}`} className="my-4 list-disc space-y-2 pl-6">{items}</ul>);
    list = [];
  };
  lines.forEach((raw, i) => {
    const line = raw.trim();
    const fig = line.match(/^\[\[FIGURA:\s*(.+?)\]\]$/);
    const ul = line.match(/^[-*]\s+(.*)/);
    const ol = line.match(/^\d+\.\s+(.*)/);
    if (ul || ol) {
      if (list.length && ordered !== !!ol) flush(i);
      ordered = !!ol;
      list.push((ul ?? ol)![1] ?? "");
      return;
    }
    flush(i);
    if (!line) return;
    if (fig) {
      const f = figures[figIdx++];
      out.push(
        <figure key={i} className="my-6">
          {f?.src ? (
            <img src={f.src} alt={f.caption || fig[1]} className="aspect-video w-full rounded-lg border-2 object-cover" loading="lazy" />
          ) : (
            <div className="grid aspect-video w-full place-items-center rounded-lg border-2 border-dashed bg-muted p-4 text-center text-muted-foreground">Figura: {fig[1]}</div>
          )}
          <figcaption className="mt-2 text-base text-muted-foreground">{f?.caption || fig[1]}</figcaption>
        </figure>,
      );
    } else if (line.startsWith("### ")) out.push(<h3 key={i} className="mt-6 mb-2 text-xl font-bold">{inline(line.slice(4), `h${i}`)}</h3>);
    else if (line.startsWith("## ")) out.push(<h2 key={i} className="mt-8 mb-3 text-2xl font-extrabold">{inline(line.slice(3), `h${i}`)}</h2>);
    else if (line.startsWith("# ")) out.push(<h2 key={i} className="mt-8 mb-3 text-2xl font-extrabold">{inline(line.slice(2), `h${i}`)}</h2>);
    else if (line.startsWith("> ")) out.push(<blockquote key={i} className="my-4 border-l-4 border-primary pl-4 italic">{inline(line.slice(2), `q${i}`)}</blockquote>);
    else out.push(<p key={i} className="my-4 text-lg leading-relaxed">{inline(line, `p${i}`)}</p>);
  });
  flush(lines.length);
  return <div>{out}</div>;
}
