import { useEffect, type ReactNode } from "react";
import { cx } from "../cx";
import { Icon } from "./Icon";

// Settings and mobile navigation used to be inline blocks pushed into the
// header, which read as neither panel nor dialog. Both are now slide-overs
// with a real backdrop and an owner.
//
// Deliberately NOT a focus trap and not <dialog>: the previous panel was
// inline and non-modal, and native alert()/confirm() are still used for the
// destructive paths. Escape and a backdrop click close it, which is what a
// non-modal slide-over owes the keyboard.
export function Drawer({
  open,
  onClose,
  side = "right",
  title,
  icon,
  children,
}: {
  open: boolean;
  onClose: () => void;
  side?: "left" | "right";
  title: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // The page behind a slide-over must not scroll under it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="presentation">
      <button
        type="button"
        aria-label={`Close ${title}`}
        onClick={onClose}
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px] border-0 cursor-default
          motion-safe:animate-[fade-in_140ms_ease-out]"
      />
      <aside
        role="dialog"
        aria-label={title}
        style={{ ["--drawer-from" as string]: side === "left" ? "-100%" : "100%" }}
        className={cx(
          "relative z-10 flex h-full w-[min(22rem,88vw)] flex-col bg-surface shadow-pop",
          "motion-safe:animate-[drawer-in_200ms_cubic-bezier(0.32,0.72,0,1)]",
          side === "left" ? "mr-auto border-r border-border" : "ml-auto border-l border-border"
        )}
      >
        <header className="flex items-center gap-2.5 px-4 h-14 border-b border-border shrink-0">
          {icon && <span className="text-accent">{icon}</span>}
          <h2 className="text-head font-semibold m-0 flex-1 min-w-0 truncate">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label={`Close ${title}`}>
            <Icon name="x" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </aside>
    </div>
  );
}
