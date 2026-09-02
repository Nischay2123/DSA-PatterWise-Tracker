import { useState } from "react";
import { useStore } from "../context";
import { ERROR_MESSAGE, validateKey } from "../llm/client";
import { getProvider, PROVIDERS, resolveModel } from "../llm/providers";
import type { ProviderId } from "../llm/providers";

const FIELD_CLASS =
  "w-full font-[inherit] text-[0.85rem] p-1.5 border border-border rounded-md bg-bg text-fg max-[700px]:text-base";
const BUTTON_CLASS =
  "text-[0.8rem] px-2.5 py-1 border border-border rounded-md bg-transparent text-fg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

type ProbeState = { kind: "idle" } | { kind: "checking" } | { kind: "ok" } | { kind: "error"; message: string };

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { v2Store, dispatchV2 } = useStore();
  const { settings } = v2Store;
  const [keyDraft, setKeyDraft] = useState(settings.apiKey);
  const [probe, setProbe] = useState<ProbeState>({ kind: "idle" });

  const provider = getProvider(settings.provider);

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
    <div className="border border-border rounded-lg p-3 mt-2.5 text-left">
      <div className="flex items-center justify-between mb-2">
        <strong className="text-[0.9rem]">Settings</strong>
        <button type="button" onClick={onClose} className="text-[0.8rem] text-muted bg-transparent border-0 cursor-pointer underline">
          Close
        </button>
      </div>

      <label className="block text-[0.7rem] font-semibold text-muted mb-0.5">Evaluation provider</label>
      <select
        className={FIELD_CLASS}
        value={settings.provider}
        onChange={(e) => dispatchV2({ type: "SET_SETTINGS", patch: { provider: e.target.value as ProviderId } })}
      >
        {Object.values(PROVIDERS).map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>

      <label className="block text-[0.7rem] font-semibold text-muted mb-0.5 mt-2">Model</label>
      <input
        className={FIELD_CLASS}
        value={settings.model}
        placeholder={provider.defaultModel}
        onChange={(e) => dispatchV2({ type: "SET_SETTINGS", patch: { model: e.target.value } })}
      />
      <div className="text-[0.7rem] text-muted mt-0.5">
        Leave blank to use {provider.defaultModel}. Currently using {resolveModel(settings.provider, settings.model)}.
      </div>

      <label className="block text-[0.7rem] font-semibold text-muted mb-0.5 mt-2">API key</label>
      <input
        type="password"
        className={FIELD_CLASS}
        value={keyDraft}
        autoComplete="off"
        spellCheck={false}
        placeholder="Paste your key"
        onChange={(e) => setKeyDraft(e.target.value)}
        onBlur={saveKey}
      />
      <div className="flex gap-2 mt-2 flex-wrap">
        <button type="button" className={BUTTON_CLASS} onClick={runValidate} disabled={!keyDraft.trim() || probe.kind === "checking"}>
          {probe.kind === "checking" ? "Checking…" : "Validate"}
        </button>
        <button type="button" className={BUTTON_CLASS} onClick={clearKey} disabled={!settings.apiKey && !keyDraft}>
          Clear key
        </button>
      </div>
      {probe.kind === "ok" && <div className="text-[0.75rem] mt-1.5">Key works.</div>}
      {probe.kind === "error" && <div className="text-[0.75rem] mt-1.5">{probe.message}</div>}

      <p className="text-[0.7rem] text-muted mt-2 mb-0 leading-relaxed">
        Your key is stored only in this browser and is sent only to {provider.label}. It is never included in an
        export. Use a key dedicated to this app, and restrict it by HTTP referrer in your provider's console — any
        script running on this page can read a key kept in browser storage.
      </p>

      <label className="flex items-center gap-2 mt-3 text-[0.8rem] cursor-pointer">
        <input
          type="checkbox"
          checked={settings.requireEvidence}
          onChange={(e) => dispatchV2({ type: "SET_SETTINGS", patch: { requireEvidence: e.target.checked } })}
        />
        Require pseudocode or code before marking a question done
      </label>

      <label className="flex items-center gap-2 mt-2 text-[0.8rem] cursor-pointer">
        <input
          type="checkbox"
          checked={settings.gateOnRevisionDue !== false}
          onChange={(e) => dispatchV2({ type: "SET_SETTINGS", patch: { gateOnRevisionDue: e.target.checked } })}
        />
        Block new completions in a topic while its revision is due
      </label>
      <div className="text-[0.7rem] text-muted mt-1">
        {settings.apiKey.trim()
          ? "Turn this off if you'd rather never be blocked from ticking a question."
          : "Currently inactive anyway: with no API key nothing can grade a revision, so a blocked topic could never be unblocked."}
      </div>
    </div>
  );
}
