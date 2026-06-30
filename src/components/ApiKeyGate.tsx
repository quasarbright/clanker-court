import { useState, useMemo, useEffect } from "react";
import {
  DEFAULT_MODEL,
  clearApiKey,
  clearSavedModel,
  getApiKey,
  getSavedModel,
  saveModel,
  setApiKey,
  validateApiKey,
} from "../store/settings";

async function fetchOpenRouterModels(): Promise<string[]> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${getApiKey()}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data?.data ?? [])
      .map((m: { id: string }) => m.id)
      .sort() as string[];
  } catch {
    return [];
  }
}

function fuzzyMatch(model: string, query: string): boolean {
  const q = query.toLowerCase().replace(/\s+/g, "");
  const m = model.toLowerCase();
  let i = 0;
  for (const ch of q) {
    const idx = m.indexOf(ch, i);
    if (idx === -1) return false;
    i = idx + 1;
  }
  return true;
}

export function SettingsModal({ onClose, dismissable }: { onClose: () => void; dismissable: boolean }) {
  const [key, setKey] = useState(getApiKey());
  const savedModel = getSavedModel();
  const [modelQuery, setModelQuery] = useState(savedModel ?? DEFAULT_MODEL);
  const [rememberModel, setRememberModel] = useState(savedModel !== null && savedModel !== DEFAULT_MODEL ? true : savedModel !== null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [allModels, setAllModels] = useState<string[]>([DEFAULT_MODEL]);
  const [validating, setValidating] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    fetchOpenRouterModels().then((models) => {
      if (models.length > 0) setAllModels(models);
    });
  }, []);

  async function validateAndSave() {
    setValidating(true);
    setKeyError(null);
    const valid = await validateApiKey(key);
    setValidating(false);
    if (!valid) {
      setKeyError("Invalid API key — check it and try again.");
      return;
    }
    save();
  }

  const suggestions = useMemo(() => {
    const q = modelQuery.trim();
    if (!q) return allModels.slice(0, 50);
    return allModels.filter((m) => fuzzyMatch(m, q)).slice(0, 50);
  }, [modelQuery, allModels]);

  function save() {
    setApiKey(key);
    const model = modelQuery.trim() || DEFAULT_MODEL;
    if (rememberModel) {
      saveModel(model);
    } else {
      clearSavedModel();
      // Write to a session-scoped variable so getModel() returns it for this session
      // without persisting. We do this by temporarily writing then clearing on next load,
      // but simpler: just store it for the session via sessionStorage.
      sessionStorage.setItem("clanker.session.model", model);
    }
    onClose();
  }

  function removeKey() {
    clearApiKey();
    setKey("");
  }

  return (
    <div className="modal-backdrop" onClick={dismissable ? onClose : undefined}>
      <div className="panel modal stack" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <div>
          <label>
            OpenRouter API key <span style={{ color: "var(--danger)" }}>*</span>
          </label>
          <input
            type="password"
            value={key}
            onChange={(e) => { setKey(e.target.value); setKeyError(null); }}
            placeholder="sk-or-..."
            autoFocus={!key}
          />
          <div className="row" style={{ marginTop: 6, justifyContent: "space-between", alignItems: "flex-start" }}>
            <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
              Required. You can{" "}
              <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">
                create one at openrouter.ai/keys
              </a>
              . Stored only in your browser — never sent anywhere except OpenRouter.
            </p>
            {key && (
              <button style={{ fontSize: "0.8rem", padding: "3px 8px", flexShrink: 0, color: "var(--danger)", borderColor: "var(--danger)" }} onClick={removeKey}>
                Remove
              </button>
            )}
          </div>
          {keyError && (
            <p style={{ color: "var(--danger)", fontSize: "0.85rem", margin: "6px 0 0" }}>{keyError}</p>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <label>Model</label>
          <input
            type="text"
            value={modelQuery}
            onChange={(e) => { setModelQuery(e.target.value); setShowSuggestions(true); }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder={DEFAULT_MODEL}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 10,
              background: "var(--panel-2)", border: "1px solid var(--line)", borderRadius: 8,
              maxHeight: 200, overflowY: "auto", marginTop: 2,
            }}>
              {suggestions.map((m) => (
                <div
                  key={m}
                  onMouseDown={() => { setModelQuery(m); setShowSuggestions(false); }}
                  style={{
                    padding: "8px 12px", cursor: "pointer", fontSize: "0.88rem",
                    fontFamily: "monospace", borderBottom: "1px solid var(--line)",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--panel)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  {m}
                </div>
              ))}
            </div>
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={rememberModel}
              onChange={(e) => setRememberModel(e.target.checked)}
              style={{ width: "auto" }}
            />
            Remember my choice
          </label>
        </div>

        <div className="row" style={{ justifyContent: "flex-end" }}>
          {dismissable && <button onClick={onClose}>Cancel</button>}
          <button className="primary" onClick={validateAndSave} disabled={!key.trim() || validating}>
            {validating ? "Checking key..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ApiKeyGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
