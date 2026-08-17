import { useEffect, useState } from "react";

// Not yet consumed -- App.tsx has a single view until Phase 6 adds #/revision routes.
export function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash || "#/tracker");
  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || "#/tracker");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return hash;
}
