import { useEffect, useState } from "react";
import { gistUrl, SYNC_ERROR_MESSAGE, type SyncErrorCode } from "../sync/gist";
import { useSync } from "../sync/useGistSync";
import { cx } from "../cx";
import { Icon } from "./Icon";

// A classic token limited to gists: it can't read or touch any repository.
const TOKEN_URL = "https://github.com/settings/tokens/new?scopes=gist&description=DSA%20Tracker%20sync";

export function syncedAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return "not yet";
  const min = Math.round((now - Date.parse(iso)) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString();
}

/** Re-renders every minute so "3 min ago" doesn't freeze. */
export function useMinuteTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);
}

export function SyncSettings() {
  const sync = useSync();
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<SyncErrorCode | null>(null);
  useMinuteTick();

  const connect = async () => {
    setConnecting(true);
    setConnectError(null);
    const err = await sync.connect(token);
    setConnecting(false);
    if (err === "bad-token" || err === "no-permission") setConnectError(err);
    else setToken("");
  };

  if (!sync.configured) {
    return (
      <div>
        <p className="text-caption text-muted mt-0 mb-3 leading-relaxed">
          Keep your laptop and phone in step through one private file in your own GitHub account — no server, no database.
          Do this once on each device, with the same token.
        </p>
        <ol className="m-0 mb-3 pl-4 text-caption text-muted leading-relaxed flex flex-col gap-1">
          <li>
            <a href={TOKEN_URL} target="_blank" rel="noopener" className="text-accent font-semibold">
              Create a GitHub token
            </a>{" "}
            with only the <b>gist</b> scope ticked (pick a long expiry).
          </li>
          <li>Paste it below and connect.</li>
          <li>On your other device, open the tracker and do the same.</li>
        </ol>
        <label className="field-label" htmlFor="sync-token">
          GitHub token
        </label>
        <div className="flex gap-2">
          <input
            id="sync-token"
            type="password"
            autoComplete="off"
            spellCheck={false}
            className="field font-mono text-caption"
            placeholder="ghp_…"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && token.trim() && !connecting && connect()}
          />
          <button type="button" className="btn btn-primary btn-sm shrink-0" disabled={!token.trim() || connecting} onClick={connect}>
            {connecting ? "Connecting…" : "Connect"}
          </button>
        </div>
        {connectError && <p className="text-caption text-hard mt-2 mb-0">{SYNC_ERROR_MESSAGE[connectError]}</p>}
        <p className="text-micro text-faint mt-3 mb-0 leading-relaxed">
          The token is saved only in this browser — never in exports or in the synced file. The gist is secret: unlisted,
          readable only by someone with its exact link. Like Merge, sync only ever adds: un-ticking a problem or deleting a
          mistake on one device won't carry over.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className={cx("flex items-center gap-2 text-ui m-0 mb-3", sync.error && !sync.syncing && "text-hard")}>
        <Icon
          name={sync.syncing ? "clock" : sync.error ? "alert" : "check"}
          className={cx("size-4 shrink-0", !sync.error && !sync.syncing && "text-easy")}
        />
        {sync.syncing
          ? "Syncing…"
          : sync.error
            ? SYNC_ERROR_MESSAGE[sync.error]
            : `Synced ${syncedAgo(sync.lastSyncedAt)}`}
      </p>
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn btn-sm" onClick={sync.syncNow} disabled={sync.syncing}>
          <Icon name="repeat" className="size-3.5" />
          Sync now
        </button>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          onClick={() => confirm("Stop syncing on this device? Your progress here and the gist both stay as they are.") && sync.disconnect()}
        >
          Disconnect this device
        </button>
        {sync.gistId && (
          <a href={gistUrl(sync.gistId)} target="_blank" rel="noopener" className="btn btn-quiet btn-sm">
            <Icon name="external" className="size-3.5" />
            Gist
          </a>
        )}
      </div>
      <p className="text-micro text-faint mt-3 mb-0 leading-relaxed">
        Syncs when the app opens, a few seconds after a change, and when you come back to the tab. Sync only ever adds:
        un-ticking or deleting on one device won't carry over.
      </p>
    </div>
  );
}

// The sidebar's one-line view: start here, see it worked, tap to sync again.
export function SyncStatusItem({ onOpenSettings }: { onOpenSettings: () => void }) {
  const sync = useSync();
  useMinuteTick();
  if (!sync.configured) {
    return (
      <button type="button" className="nav-item" onClick={onOpenSettings} title="Sync progress between your devices">
        <Icon name="repeat" className="size-4" />
        Sync devices
      </button>
    );
  }
  const failed = !!sync.error && !sync.syncing;
  return (
    <button
      type="button"
      className={cx("nav-item", failed && "text-hard")}
      onClick={failed ? onOpenSettings : sync.syncNow}
      title={failed ? SYNC_ERROR_MESSAGE[sync.error!] : "Sync now"}
    >
      <Icon name={sync.syncing ? "clock" : failed ? "alert" : "repeat"} className="size-4" />
      {sync.syncing ? "Syncing…" : failed ? "Sync problem" : `Synced ${syncedAgo(sync.lastSyncedAt)}`}
    </button>
  );
}
