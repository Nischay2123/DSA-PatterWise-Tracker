import { useState } from "react";
import { useStore } from "../context";
import { cx } from "../cx";
import { ERROR_MESSAGE, validateKey } from "../llm/client";
import { getProvider, PROVIDERS, resolveModel } from "../llm/providers";
import type { ProviderId } from "../llm/providers";
import type { Theme } from "../useTheme";

type ProbeState = { kind: "idle" } | { kind: "checking" } | { kind: "ok" } | { kind: "error"; message: string };

const THEMES: { id: Theme; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { v2Store, dispatchV2 } = useStore();
  const { settings } = v2Store;
  const [keyDraft, setKeyDraft] = useState(settings.apiKey);
  const [probe, setProbe] = useState<ProbeState>({ kind: "idle" });

  const provider = getProvider(settings.provider);
  const activeTheme: Theme = settings.theme === "light" || settings.theme === "dark" ? settings.theme : "system";

  const saveKey = () => {
    dispatchV2({ type: "SET_SETTINGS", patch: { apiKey: keyDraft.trim() } });
    setProbe({ kind: "idle" });
  };

  const clearKey = () => {
    setKeyDraft("");
    dispatchV2({ type: "SET_SETTINGS", patch: { apiKey: "" } });
    setProbe({ kind: "idle" });
  };

  // One cheap call so a bad key is reported here and now, rather than at the
  // end of a revision (plan §9 key lifecycle, step 3).
  const runValidate = async () => {
    const key = keyDraft.trim();
    dispatchV2({ type: "SET_SETTINGS", patch: { apiKey: key } });
    setProbe({ kind: "checking" });
    const result = await validateKey(key, settings.provider, settings.model);
    setProbe(result.ok ? { kind: "ok" } : { kind: "error", message: ERROR_MESSAGE[result.error] });
  };

  return (
    <div className="card p-4 shadow-lg shadow-black/5 text-left">
      <div className="flex items-center justify-between mb-3">
        <strong className="text-head">Settings</strong>
        <button type="button" onClick={onClose} className="btn-link text-ui">
          Close
        </button>
      </div>

      <section className="mb-4">
        <span className="field-label">Appearance</span>
        <div role="group" aria-label="Theme" className="flex gap-1.5">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={activeTheme === t.id}
              className={cx("btn btn-sm flex-1", activeTheme === t.id && "btn-primary")}
              onClick={() => dispatchV2({ type: "SET_SETTINGS", patch: { theme: t.id } })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="border-t border-border pt-3">
        <label className="field-label" htmlFor="settings-provider">
          Evaluation provider
        </label>
        <select
          id="settings-provider"
          className="field"
          value={settings.provider}
          onChange={(e) => dispatchV2({ type: "SET_SETTINGS", patch: { provider: e.target.value as ProviderId } })}
        >
          {Object.values(PROVIDERS).map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <label className="field-label mt-3" htmlFor="settings-model">
          Model
        </label>
        <input
          id="settings-model"
          className="field"
          value={settings.model}
          placeholder={provider.defaultModel}
          onChange={(e) => dispatchV2({ type: "SET_SETTINGS", patch: { model: e.target.value } })}
        />
        <p className="text-micro text-muted mt-1.5 mb-0">
          Leave blank for {provider.defaultModel}. Using {resolveModel(settings.provider, settings.model)}.
        </p>

        <label className="field-label mt-3" htmlFor="settings-key">
          API key
        </label>
        <input
          id="settings-key"
          type="password"
          className="field"
          value={keyDraft}
          autoComplete="off"
          spellCheck={false}
          placeholder="Paste your key"
          onChange={(e) => setKeyDraft(e.target.value)}
          onBlur={saveKey}
        />
        <div className="flex gap-1.5 mt-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm"
            onClick={runValidate}
            disabled={!keyDraft.trim() || probe.kind === "checking"}
          >
            {probe.kind === "checking" ? "Checking…" : "Validate"}
          </button>
          <button type="button" className="btn btn-sm btn-quiet" onClick={clearKey} disabled={!settings.apiKey && !keyDraft}>
            Clear key
          </button>
        </div>
        {probe.kind === "ok" && <p className="text-micro text-progress mt-2 mb-0">Key works.</p>}
        {probe.kind === "error" && <p className="text-micro text-badge-hard mt-2 mb-0">{probe.message}</p>}

        <p className="text-micro text-muted mt-3 mb-0 leading-relaxed">
          Your key is stored only in this browser and is sent only to {provider.label}. It is never included in an
          export. Use a key dedicated to this app, and restrict it by HTTP referrer in your provider's console — any
          script running on this page can read a key kept in browser storage.
        </p>
      </section>

      <section className="border-t border-border mt-4 pt-3 flex flex-col gap-2.5">
        <label className="flex items-start gap-2.5 text-ui cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={settings.requireEvidence}
            onChange={(e) => dispatchV2({ type: "SET_SETTINGS", patch: { requireEvidence: e.target.checked } })}
          />
          <span>Require pseudocode or code before marking a question done</span>
        </label>

        <div>
          <label className="flex items-start gap-2.5 text-ui cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={settings.gateOnRevisionDue !== false}
              onChange={(e) => dispatchV2({ type: "SET_SETTINGS", patch: { gateOnRevisionDue: e.target.checked } })}
            />
            <span>Block new completions in a topic while its revision is due</span>
          </label>
          <p className="text-micro text-muted mt-1.5 mb-0 pl-[26px]">
            {settings.apiKey.trim()
              ? "Turn this off if you'd rather never be blocked from ticking a question."
              : "Currently inactive anyway: with no API key nothing can grade a revision, so a blocked topic could never be unblocked."}
          </p>
        </div>
      </section>
    </div>
  );
}
