import { useEffect, useRef, useState } from "react";
import { cx } from "../cx";
import { NOTE_SECTIONS, NOTES_BY_ID } from "../notes";
import { Icon } from "./Icon";
import { isDarkNow } from "../useTheme";

// Markdown notes (pattern notes, Java, Java core) with highlighted Java and
// mermaid diagrams. The renderers are only loaded on this page.
export async function renderMarkdown(markdown: string, into: HTMLElement) {
  const [{ marked }, { default: hljs }, { default: java }] = await Promise.all([
    import("marked"),
    import("highlight.js/lib/core"),
    import("highlight.js/lib/languages/java"),
  ]);
  hljs.registerLanguage("java", java);
  // The notes are this app's own files under public/notes, not user input.
  into.innerHTML = await marked.parse(markdown, { gfm: true });
  into.querySelectorAll("pre code.language-java").forEach((el) => hljs.highlightElement(el as HTMLElement));
  // Ids on headings, so in-page links like (#sheets) have somewhere to go.
  into.querySelectorAll("h2, h3").forEach((h) => {
    h.id = (h.textContent ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  });

  const diagrams = [...into.querySelectorAll("pre code.language-mermaid")].map((code) => {
    const pre = code.parentElement!;
    pre.className = "mermaid";
    pre.textContent = code.textContent;
    return pre;
  });
  if (!diagrams.length) return;
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({ startOnLoad: false, theme: isDarkNow() ? "dark" : "default" });
  await mermaid.run({ nodes: diagrams, suppressErrors: true });
}

export function NotesPanel({ noteId, onNavigate }: { noteId: string | undefined; onNavigate: (hash: string) => void }) {
  const note = (noteId && NOTES_BY_ID[noteId]) || NOTE_SECTIONS[0].items[0];
  const article = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    if (article.current) article.current.textContent = "Loading…";
    fetch(note.file) // relative to the page, so it works wherever the app is hosted
      .then((res) => {
        if (!res.ok) throw new Error(`${note.file}: ${res.status}`);
        return res.text();
      })
      .then((md) => {
        if (!cancelled && article.current) return renderMarkdown(md, article.current);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    window.scrollTo(0, 0);
    return () => {
      cancelled = true;
    };
  }, [note]);

  return (
    <div className="md:grid md:grid-cols-[13rem_minmax(0,1fr)] gap-6">
      {/* A select on phones; the full index beside the note from md up. */}
      <select
        className="field md:hidden mb-4"
        aria-label="Choose a note"
        value={note.id}
        onChange={(e) => onNavigate(`#/notes/${e.target.value}`)}
      >
        {NOTE_SECTIONS.map((s) => (
          <optgroup key={s.section} label={s.section}>
            {s.items.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <nav className="max-md:hidden sticky top-5 self-start max-h-[calc(100vh-2.5rem)] overflow-y-auto pr-1">
        {NOTE_SECTIONS.map((s) => (
          <div key={s.section} className="mb-4">
            <div className="field-label px-2">{s.section}</div>
            {s.items.map((n) => (
              <a
                key={n.id}
                href={`#/notes/${n.id}`}
                aria-current={n.id === note.id ? "page" : undefined}
                className={cx(
                  "block rounded-md px-2 py-1 text-ui",
                  n.id === note.id ? "bg-accent-soft text-accent font-semibold" : "text-muted hover:text-fg hover:bg-row-hover"
                )}
              >
                {n.title}
              </a>
            ))}
          </div>
        ))}
      </nav>

      <article className="card min-w-0 px-4 py-5 md:px-7">
        {error ? (
          <p className="flex items-center gap-2 text-body text-hard m-0">
            <Icon name="alert" className="size-4" />
            Couldn't load this note ({error}).
          </p>
        ) : (
          <div ref={article} className="md" />
        )}
      </article>
    </div>
  );
}
