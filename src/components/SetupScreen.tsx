import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useGame } from "../store/gameStore";
import { hasApiKey } from "../store/settings";
import { SettingsModal } from "./ApiKeyGate";

const SUGGESTIONS = [
  "Murder", "Manslaughter", "Poisoning", "Arson", "Kidnapping",
  "Blackmail / extortion", "Fraud / embezzlement", "Theft / heist",
  "Forgery / counterfeiting", "Sabotage", "Hit and run", "Assault",
];

type Screen = "home" | "solo" | "host";

function joinUrl(roomCode: string) {
  return `${window.location.origin}${window.location.pathname}?join=${roomCode}`;
}

export function SetupScreen() {
  const { playerRole, setRole, generateCase, hostGame,
          busy, busyLabel, multiplayerRole, roomCode, guestConnected } = useGame();
  const [screen, setScreen] = useState<Screen>("home");
  const [prompt, setPrompt] = useState("");
  const [needsKey, setNeedsKey] = useState(false);
  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (!roomCode) return;
    navigator.clipboard.writeText(joinUrl(roomCode)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Guest: waiting for host to generate ──────────────────────────────────

  if (multiplayerRole === "guest") {
    return (
      <div className="stack">
        <div className="center"><h1>⚖️ Clanker Court</h1></div>
        <div className="panel stack">
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            You are playing as <strong>{playerRole}</strong>.
          </p>
          <p className="busy">
            <span className="spin">⏳</span>{" "}
            {busy ? busyLabel : "Waiting for host to generate the case..."}
          </p>
        </div>
      </div>
    );
  }

  // ── Host: waiting for opponent to join ───────────────────────────────────

  if (screen === "host" && multiplayerRole === "host" && !guestConnected) {
    return (
      <div className="stack">
        <div className="center"><h1>⚖️ Clanker Court</h1></div>
        <div className="panel stack" style={{ alignItems: "center" }}>
          <p>Have your opponent scan or open this link:</p>
          {roomCode && (
            <div style={{ background: "white", padding: 12, borderRadius: 8 }}>
              <QRCodeSVG value={joinUrl(roomCode)} size={180} />
            </div>
          )}
          <button onClick={copyLink} style={{ marginTop: 4 }}>
            {copied ? "✓ Link copied!" : "Copy join link"}
          </button>
          <p className="busy"><span className="spin">⏳</span> Waiting for opponent to join...</p>
        </div>
      </div>
    );
  }

  // ── Host: opponent connected — generate the case ─────────────────────────

  if (screen === "host" && multiplayerRole === "host" && guestConnected) {
    function handleGenerate() {
      if (!hasApiKey()) { setNeedsKey(true); return; }
      generateCase(prompt.trim() || undefined);
    }
    return (
      <div className="stack">
        {needsKey && (
          <SettingsModal dismissable={false} onClose={() => {
            setNeedsKey(false);
            if (hasApiKey()) generateCase(prompt.trim() || undefined);
          }} />
        )}
        <div className="center">
          <h1>⚖️ Clanker Court</h1>
          <p style={{ color: "var(--accent)", fontSize: "0.9rem" }}>Opponent connected!</p>
        </div>
        <div className="panel stack">
          <div>
            <label>Case idea <span className="muted" style={{ fontWeight: 400 }}>(optional)</span></label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Leave blank for a surprise, or describe what you want..."
              disabled={busy}
              autoFocus
            />
            {!prompt && (
              <div className="row" style={{ marginTop: 8, gap: 6 }}>
                {SUGGESTIONS.map((s) => (
                  <button key={s} style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                    disabled={busy} onClick={() => setPrompt(s)}>{s}</button>
                ))}
              </div>
            )}
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="primary" onClick={handleGenerate} disabled={busy}>
              {busy ? "Working..." : "Generate case"}
            </button>
          </div>
          {busy && <p className="busy"><span className="spin">⏳</span> {busyLabel}</p>}
        </div>
      </div>
    );
  }

  // ── Home ──────────────────────────────────────────────────────────────────

  if (screen === "home") {
    return (
      <div className="stack">
        <div className="center">
          <h1>⚖️ Clanker Court</h1>
          <p className="muted">
            An LLM-powered trial. You're the attorney; the witnesses, opposing counsel, judge,
            and jury are all AI. Generate a case and take it to trial.
          </p>
        </div>
        <div className="panel stack">
          <button className="primary" style={{ fontSize: "1.05rem", padding: "14px" }}
            onClick={() => setScreen("solo")}>
            Solo — play vs AI
          </button>
          <button style={{ fontSize: "1.05rem", padding: "14px" }}
            onClick={() => setScreen("host")}>
            Host a multiplayer game
          </button>
        </div>
      </div>
    );
  }

  // ── Host setup / Solo setup ───────────────────────────────────────────────

  const isHost = screen === "host";

  function handleCreateRoom() {
    if (!hasApiKey()) { setNeedsKey(true); return; }
    hostGame(playerRole);
  }

  function handleGenerateSolo() {
    if (!hasApiKey()) { setNeedsKey(true); return; }
    generateCase(prompt.trim() || undefined);
  }

  return (
    <div className="stack">
      {needsKey && (
        <SettingsModal dismissable={false} onClose={() => {
          setNeedsKey(false);
          if (hasApiKey()) {
            if (isHost) handleCreateRoom();
            else handleGenerateSolo();
          }
        }} />
      )}

      <div className="center">
        <h1>⚖️ Clanker Court</h1>
        {isHost && (
          <p className="muted">Pick your side, then create a room. Your opponent joins via QR code or link.</p>
        )}
      </div>

      <div className="panel stack">
        <div>
          <label>Play as</label>
          <div className="row">
            <button className={playerRole === "defense" ? "primary" : ""}
              onClick={() => setRole("defense")} disabled={busy}>
              Defense attorney
            </button>
            <button className={playerRole === "prosecutor" ? "primary" : ""}
              onClick={() => setRole("prosecutor")} disabled={busy}>
              Prosecutor
            </button>
          </div>
          <p className="muted" style={{ fontSize: "0.85rem", marginTop: 8 }}>
            {playerRole === "prosecutor"
              ? "You open first, call your witnesses first, and bear the burden of proof."
              : "You open second and present your case after the prosecution rests."}
            {isHost && " Your opponent automatically plays the other side."}
          </p>
        </div>

        {!isHost && (
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
                  <button key={s} style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                    disabled={busy} onClick={() => setPrompt(s)}>{s}</button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="row" style={{ justifyContent: "space-between" }}>
          <button onClick={() => setScreen("home")} disabled={busy}>Back</button>
          <button className="primary"
            onClick={isHost ? handleCreateRoom : handleGenerateSolo}
            disabled={busy}>
            {busy ? "Working..." : isHost ? "Create room" : "Generate case"}
          </button>
        </div>

        {busy && <p className="busy"><span className="spin">⏳</span> {busyLabel}</p>}
      </div>
    </div>
  );
}
