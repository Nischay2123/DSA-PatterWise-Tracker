import { useEffect, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Icon } from "./Icon";
import { renderMarkdown } from "./NotesPanel";

// The user guide: public/docs/guide.md, with an "On this page" index.
export function GuidePage() {
  const article = useRef<HTMLDivElement>(null);
  const [sections, setSections] = useState<{ id: string; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("docs/guide.md")
      .then((res) => {
        if (!res.ok) throw new Error(`docs/guide.md: ${res.status}`);
        return res.text();
      })
      .then(async (md) => {
        if (cancelled || !article.current) return;
        await renderMarkdown(md, article.current);
        setSections([...article.current.querySelectorAll("h2")].map((h) => ({ id: h.id, title: h.textContent ?? "" })));
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    window.scrollTo(0, 0);
    return () => {
      cancelled = true;
    };
  }, []);

  // Routes live in the hash (#/tracker), so a plain #section link would
  // navigate away from this page. Scroll to it instead.
  const jump = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest("a");
    const href = a?.getAttribute("href");
    if (!href?.startsWith("#") || href.startsWith("#/")) return;
    e.preventDefault();
    document.getElementById(href.slice(1))?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="md:grid md:grid-cols-[13rem_minmax(0,1fr)] gap-6" onClick={jump}>
      <nav className="max-md:hidden sticky top-5 self-start max-h-[calc(100vh-2.5rem)] overflow-y-auto pr-1">
        <div className="field-label px-2">On this page</div>
        {sections.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="block rounded-md px-2 py-1 text-ui text-muted hover:text-fg hover:bg-row-hover">
            {s.title}
          </a>
        ))}
      </nav>
      <article className="card min-w-0 px-4 py-5 md:px-7">
        {error ? (
          <p className="flex items-center gap-2 text-body text-hard m-0">
            <Icon name="alert" className="size-4" />
            Couldn't load the guide ({error}).
          </p>
        ) : (
          <div ref={article} className="md [&_h2]:scroll-mt-6">
            Loading…
          </div>
        )}
      </article>
    </div>
  );
}
