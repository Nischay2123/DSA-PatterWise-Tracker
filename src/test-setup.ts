import { beforeEach, vi } from "vitest";

// This jsdom build exposes window/document but no localStorage, so the
// persistence layer would be untestable without a real Storage to write to.
// A faithful in-memory implementation beats mocking store.ts's callers.
if (typeof localStorage === "undefined") {
  const backing = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return backing.size;
    },
    clear: () => backing.clear(),
    getItem: (k) => (backing.has(k) ? backing.get(k)! : null),
    key: (i) => [...backing.keys()][i] ?? null,
    removeItem: (k) => void backing.delete(k),
    setItem: (k, v) => void backing.set(k, String(v)),
  };
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true, writable: true });
}

// jsdom implements neither of these, and the backup download legitimately
// uses both. Stubbing them here (rather than guarding the production code)
// keeps the real download path exercised by tests.
if (!URL.createObjectURL) {
  URL.createObjectURL = vi.fn(() => "blob:mock");
  URL.revokeObjectURL = vi.fn();
}

// jsdom has no real navigation, so an <a download>.click() would warn.
HTMLAnchorElement.prototype.click = vi.fn();

beforeEach(() => {
  // Some suites stub localStorage themselves (persistence/db.test.ts), which
  // can leave the global unset between files.
  if (typeof localStorage !== "undefined" && typeof localStorage?.clear === "function") localStorage.clear();
});
