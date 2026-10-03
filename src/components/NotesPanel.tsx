"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";
import type { Topic } from "../types";

interface NoteItem {
  id: string;
  title: string;
  file: string;
}

interface NoteSection {
  section: string;
  items: NoteItem[];
}

export function NotesPanel({ topics }: { topics: Topic[] }) {
  const [sections, setSections] = useState<NoteSection[]>([]);
  const [activeNote, setActiveNote] = useState<NoteItem | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);

  // Build note sections from topics that have notes
  useEffect(() => {
    const noteSections: NoteSection[] = [
      {
        section: "DSA Patterns",
        items: topics
          .filter((t) => t.note)
          .map((t) => ({
            id: `${t.id}-notes`,
            title: t.name,
            file: t.note!,
          })),
      },
    ].filter((s) => s.items.length > 0);

    setSections(noteSections);

    // Set first note as active
    if (noteSections.length > 0 && noteSections[0].items.length > 0) {
      setActiveNote(noteSections[0].items[0]);
    }
  }, [topics]);

  // Load note content when active note changes
  useEffect(() => {
    if (!activeNote) return;

    const loadNote = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(activeNote.file);
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`);
        const text = await res.text();
        setContent(text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load note");
        setContent("");
      } finally {
        setLoading(false);
      }
    };

    loadNote();
  }, [activeNote]);

  // Render markdown and mermaid after content loads
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !content) return;

    const render = async () => {
      try {
        // Use require for CommonJS compatibility with these packages
        const { marked } = await import("marked");
        const mermaid = (await import("mermaid")).default;
        const hljs = (await import("highlight.js")).default;

        // Configure marked
        marked.setOptions({
          breaks: true,
          gfm: true,
        });

        // Configure mermaid
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            primaryColor: "var(--accent)",
            primaryTextColor: "var(--text)",
            primaryBorderColor: "var(--accent)",
            lineColor: "var(--border)",
            secondaryColor: "var(--panel)",
            tertiaryColor: "var(--bg)",
          },
        });

        // Render markdown
        const html = await marked.parse(content);
        container.innerHTML = html;

        // Highlight code blocks
        container.querySelectorAll("pre code").forEach((block) => {
          hljs.highlightElement(block as HTMLElement);
        });

        // Render mermaid diagrams
        const mermaidElements = container.querySelectorAll("pre.mermaid, code.language-mermaid");
        mermaidElements.forEach((el) => {
          const pre = el.tagName === "CODE" ? el.parentElement : el;
          if (pre) {
            pre.className = "mermaid";
            pre.textContent = el.textContent ?? "";
          }
        });

        await mermaid.run({ nodes: container.querySelectorAll(".mermaid"), suppressErrors: true });
      } catch (e) {
        console.warn("Note render error:", e);
      }
    };

    render();
  }, [content]);

  if (sections.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Icon name="book" className="size-10 text-faint mx-auto mb-3" />
        <p className="text-muted">No pattern notes available.</p>
        <p className="text-caption text-faint mt-1">Add <code>note</code> paths to topics to enable.</p>
      </div>
    );
  }

  return (
    <div className="notes-panel grid grid-cols-[220px_1fr] gap-4 h-[calc(100vh-14rem)] min-h-[500px]">
      {/* Sidebar - Note navigation */}
      <aside className="border-r border-border overflow-y-auto pr-3">
        {sections.map((section) => (
          <div key={section.section} className="mb-4">
            <h4 className="field-label px-2.5 mb-2">{section.section}</h4>
            <ul className="list-none p-0 m-0 space-y-1">
              {section.items.map((note) => (
                <li key={note.id}>
                  <button
                    type="button"
                    className={cx(
                      "w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors",
                      activeNote?.id === note.id
                        ? "bg-accent-soft text-accent font-medium"
                        : "text-muted hover:text-fg hover:bg-row-hover"
                    )}
                    onClick={() => setActiveNote(note)}
                    title={note.title}
                  >
                    {note.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </aside>

      {/* Content area */}
      <article className="min-w-0 overflow-y-auto">
        {loading && (
          <div className="flex items-center justify-center h-64 text-muted">
            <Icon name="loader" className="size-6 mr-2 animate-spin" />
            Loading…
          </div>
        )}
        {error && !loading && (
          <div className="card p-6 text-center text-hard">
            <Icon name="alert" className="size-10 mx-auto mb-3" />
            <p>{error}</p>
          </div>
        )}
        {!loading && !error && (
          <div
            ref={contentRef}
            className="prose prose-sm max-w-none dark:prose-invert p-4"
            // biome-ignore lint/suspicious/noExplicitAny: Tailwind prose custom properties
            style={{ "--tw-prose-body": "var(--text)", "--tw-prose-headings": "var(--text)" } as any}
          />
        )}
      </article>
    </div>
  );
}