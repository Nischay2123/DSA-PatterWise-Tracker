import { useEffect, useRef } from "react";
import { useHash } from "../useHash";
import { useStore } from "../context";

export function OOPJavaPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [, navigate] = useHash();
  const { v2Store } = useStore();

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Listen for messages from the iframe (e.g., theme changes, navigation)
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data.type === "oop-navigate") {
        navigate(event.data.hash);
      } else if (event.data.type === "oop-theme") {
        // The iframe can request theme sync
        console.log("Theme change requested:", event.data.theme);
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]);

  // Sync theme to iframe
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.contentWindow?.postMessage(
      { type: "theme", theme: v2Store.settings.theme },
      window.location.origin
    );
  }, [v2Store.settings.theme]);

  return (
    <div className="h-screen w-full">
      <iframe
        ref={iframeRef}
        src="/oop-java.html"
        title="OOP in Java"
        className="w-full h-full border-0"
        allow="clipboard-read; clipboard-write"
        sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-top-navigation-by-user-activation"
      />
    </div>
  );
}