import { useState } from "react";
import { useStore } from "../context";
import { ERROR_MESSAGE, validateKey } from "../llm/client";
import { getProvider, PROVIDERS, resolveModel } from "../llm/providers";
import type { ProviderId } from "../llm/providers";
import { GoalSettings } from "./GoalSettings";
import { Icon, type IconName } from "./Icon";

type ProbeState = { kind: "idle" } | { kind: "checking" } | { kind: "ok" } | { kind: "error"; message: string };

// A titled block inside the drawer. Replaces three sections that each had a
// different border/padding treatment for the same role.
function Section({ title, icon, children }: { title: string; icon: IconName; children: React.ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-4 last:border-b-0">
      <div className="flex items-center gap-2 mb-3">
        <Icon name={icon} className="size-3.5 text-accent" />
        <h3 className="text-ui font-bold m-0 tracking-tight">{title}</h3>
      </div>
      {children}
    </section>
  );
}

// A checkbox row rendered as a switch, so the two behaviour gates read as
// settings rather than as form fields.
function Switch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group/switch">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        className="mt-0.5 relative h-5 w-9 shrink-0 rounded-full bg-border-strong transition-colors
          peer-checked:bg-accent
          peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent
          peer-focus-visible:outline-offset-2
          after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white
          after:transition-transform after:content-[''] peer-checked:after:translate-x-4"
      />
      <span className="min-w-0">
        <span className="block text-ui font-medium">{label}</span>
        {hint && <span className="block text-micro text-muted mt-1 leading-relaxed">{hint}</span>}
      </span>
    </label>
  );
}

export function SettingsPanel() {
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
    <div>
      <Section title="Revision goal" icon="target">
        <GoalSettings />
      </Section>

      <Section title="Evaluation provider" icon="brain">
        <label className="field-label" htmlFor="settings-provider">
          Provider
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

        <label className="field-label mt-4" htmlFor="settings-model">
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

        <label className="field-label mt-4" htmlFor="settings-key">
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
        <div className="flex gap-2 mt-2 flex-wrap">
          <button
            type="button"
            className="btn btn-sm"
            onClick={runValidate}
            disabled={!keyDraft.trim() || probe.kind === "checking"}
          >
            <Icon name="check" className="size-3.5" />
            {probe.kind === "checking" ? "Checking…" : "Validate"}
          </button>
          <button type="button" className="btn btn-sm btn-quiet" onClick={clearKey} disabled={!settings.apiKey && !keyDraft}>
            <Icon name="trash" className="size-3.5" />
            Clear key
          </button>
        </div>

        {/* Both outcomes used to render as identical grey 11px text. */}
        {probe.kind === "ok" && (
          <p className="mt-2.5 mb-0 flex items-center gap-1.5 rounded-md bg-easy-soft px-2.5 py-2 text-micro font-medium text-easy">
            <Icon name="check" className="size-3.5 shrink-0" />
            Key works.
          </p>
        )}
        {probe.kind === "error" && (
          <p className="mt-2.5 mb-0 flex items-start gap-1.5 rounded-md bg-hard-soft px-2.5 py-2 text-micro font-medium text-hard">
            <Icon name="alert" className="size-3.5 shrink-0 mt-px" />
            {probe.message}
          </p>
        )}

        <p className="card-inset mt-3 p-2.5 text-micro text-muted leading-relaxed">
          Your key is stored only in this browser and is sent only to {provider.label}. It is never included in an
          export. Use a key dedicated to this app, and restrict it by HTTP referrer in your provider's console — any
          script running on this page can read a key kept in browser storage.
        </p>
      </Section>

      <Section title="Completion rules" icon="check">
        <div className="flex flex-col gap-4">
          <Switch
            checked={settings.requireEvidence}
            onChange={(v) => dispatchV2({ type: "SET_SETTINGS", patch: { requireEvidence: v } })}
            label="Require pseudocode or code before marking a question done"
          />
          <Switch
            checked={settings.gateOnRevisionDue !== false}
            onChange={(v) => dispatchV2({ type: "SET_SETTINGS", patch: { gateOnRevisionDue: v } })}
            label="Block new completions in a topic while its revision is due"
            hint={
              settings.apiKey.trim()
                ? "Turn this off if you'd rather never be blocked from ticking a question."
                : "Currently inactive anyway: with no API key nothing can grade a revision, so a blocked topic could never be unblocked."
            }
          />
        </div>
      </Section>
    </div>
  );
}

