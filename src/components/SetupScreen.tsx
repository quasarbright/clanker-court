import { useState } from "react";
import { useGame } from "../store/gameStore";
import { hasApiKey } from "../store/settings";
import { SettingsModal } from "./ApiKeyGate";

const SUGGESTIONS = [
  "Murder", "Manslaughter", "Poisoning", "Arson", "Kidnapping",
  "Blackmail / extortion", "Fraud / embezzlement", "Theft / heist",
  "Forgery / counterfeiting", "Sabotage", "Hit and run", "Assault",
];

export function SetupScreen() {
  const { playerRole, setRole, generateCase, busy, busyLabel } = useGame();
  const [prompt, setPrompt] = useState("");
  const [needsKey, setNeedsKey] = useState(false);

  function handleGenerate() {
    if (!hasApiKey()) { setNeedsKey(true); return; }
    generateCase(prompt.trim() || undefined);
  }

  return (
    <div className="stack">
      {needsKey && (
        <SettingsModal
          dismissable={false}
          onClose={() => {
            setNeedsKey(false);
            if (hasApiKey()) generateCase(prompt.trim() || undefined);
          }}
        />
      )}

      <div className="center">
        <h1>⚖️ Clanker Court</h1>
        <p className="muted">
          An LLM-powered trial. You're the attorney; the witnesses, opposing counsel, judge,
          and jury are all AI. Generate a case and take it to trial.
        </p>
      </div>

      <div className="panel stack">
        <div>
          <label>Play as</label>
          <div className="row">
            <button
              className={playerRole === "defense" ? "primary" : ""}
              onClick={() => setRole("defense")}
              disabled={busy}
            >
              Defense attorney
            </button>
            <button
              className={playerRole === "prosecutor" ? "primary" : ""}
              onClick={() => setRole("prosecutor")}
              disabled={busy}
            >
              Prosecutor
            </button>
          </div>
          <p className="muted" style={{ fontSize: "0.85rem", marginTop: 8 }}>
            {playerRole === "prosecutor"
              ? "You open first, call your witnesses first, and bear the burden of proof."
              : "You open second and present your case after the prosecution rests."}
          </p>
        </div>

        <div>
          <label>Case idea <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Leave blank for a surprise, or describe what you want..."
            disabled={busy}
          />
          {!prompt && (
            <div className="row" style={{ marginTop: 8, gap: 6 }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                  disabled={busy}
                  onClick={() => setPrompt(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="primary" onClick={handleGenerate} disabled={busy}>
          {busy ? "Working..." : "Generate case"}
        </button>

        {busy && (
          <p className="busy">
            <span className="spin">⏳</span> {busyLabel}
          </p>
        )}
      </div>
    </div>
  );
}
