import { useEffect, useState } from "react";

// No router dependency (plan decision #2) -- just the browser's own
// hashchange event, which already fires for both back/forward navigation
// and programmatic `location.hash =` assignment.
function currentHash(): string {
  return window.location.hash || "#/tracker";
}

export function useHash(): [string, (hash: string) => void] {
  const [hash, setHash] = useState(currentHash);

  useEffect(() => {
    const onHashChange = () => setHash(currentHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const navigate = (next: string) => {
    window.location.hash = next;
  };

  return [hash, navigate];
}
