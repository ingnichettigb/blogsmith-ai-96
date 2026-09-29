import type { Block } from "@/lib/blocks";
import type { Figure } from "@/lib/store";
import { EditableImage } from "./EditableImage";

export function Blocks({ content, figures, onReplaceFigure }: { content: Block[]; figures: Figure[]; onReplaceFigure?: (figureId: string, newSrc: string) => void }) {
  return (
    <div>
      {content.map((b, i) => {
        switch (b.type) {
          case "heading2":
            return <h2 key={i} className="mt-8 mb-3 text-2xl font-extrabold">{b.text}</h2>;
          case "heading3":
            return <h3 key={i} className="mt-6 mb-2 text-xl font-bold">{b.text}</h3>;
          case "quote":
            return <blockquote key={i} className="my-4 border-l-4 border-primary pl-4 text-lg italic">{b.text}</blockquote>;
          case "list":
            return (
              <ul key={i} className="my-4 list-disc space-y-2 pl-6 text-lg">
                {b.items.map((it, j) => <li key={j}>{it}</li>)}
              </ul>
            );
          case "image": {
            const idx = Number(b.src.match(/figura-(\d+)/)?.[1] ?? 0) - 1;
            const f = figures[idx];
            return (
              <figure key={i} className="my-6">
                {f && onReplaceFigure ? (
                  <EditableImage
                    src={f.src}
                    alt={b.caption}
                    label={`figura "${b.caption}"`}
                    className="aspect-video w-full rounded-lg border-2"
                    placeholder={<div className="grid size-full place-items-center border-2 border-dashed bg-muted p-4 text-center text-muted-foreground">{b.src}</div>}
                    onReplace={(src) => onReplaceFigure(f.id, src)}
                  />
                ) : f?.src ? (
                  <img src={f.src} alt={b.caption} className="aspect-video w-full rounded-lg border-2 object-cover" loading="lazy" />
                ) : (
                  <div className="grid aspect-video w-full place-items-center rounded-lg border-2 border-dashed bg-muted p-4 text-center text-muted-foreground">{b.src}</div>
                )}
                <figcaption className="mt-2 text-base text-muted-foreground">{b.caption}</figcaption>
              </figure>
            );
          }
          case "cta":
            return (
              <a key={i} href={b.link} target="_blank" rel="sponsored noopener noreferrer"
                className="my-6 flex min-h-14 items-center justify-center rounded-xl bg-primary px-6 py-3 text-center text-lg font-extrabold text-primary-foreground">
                {b.text}
              </a>
            );
          default:
            return <p key={i} className="my-4 text-lg leading-relaxed">{b.text}</p>;
        }
      })}
    </div>
  );
}
