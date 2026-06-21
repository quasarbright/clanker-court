import { useState, useEffect } from "react";
import { useGame } from "./store/gameStore";
import { ApiKeyGate, SettingsModal } from "./components/ApiKeyGate";
import { SetupScreen } from "./components/SetupScreen";
import { CaseFileScreen } from "./components/CaseFileScreen";
import { CaseFileModal } from "./components/CaseFileModal";
import { TrialView } from "./components/TrialView";
import { VerdictScreen } from "./components/VerdictScreen";

function Screen({ onOpenCaseFile }: { onOpenCaseFile: () => void }) {
  const phase = useGame((s) => s.phase);
  const verdict = useGame((s) => s.verdict);

  useEffect(() => {
    if (verdict) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [verdict]);

  if (phase === "setup") return <SetupScreen />;
  if (phase === "caseFile") return <CaseFileScreen />;
  if (phase === "verdict" && verdict) return <VerdictScreen />;
  return <TrialView onOpenCaseFile={onOpenCaseFile} />;
}

export default function App() {
  const error = useGame((s) => s.error);
  const dismissError = useGame((s) => s.dismissError);
  const phase = useGame((s) => s.phase);
  const caseFile = useGame((s) => s.caseFile);
  const joinGame = useGame((s) => s.joinGame);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [caseFileOpen, setCaseFileOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("join");
    if (code) {
      history.replaceState(null, "", window.location.pathname);
      joinGame(code);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inTrial = phase !== "setup" && phase !== "caseFile";

  return (
    <ApiKeyGate>
      <header className="site-header">
        <span className="site-title">⚖️ Clanker Court</span>
        {inTrial && caseFile && (
          <button onClick={() => setCaseFileOpen(true)}>📋 Case File</button>
        )}
        <button onClick={() => setSettingsOpen(true)}>⚙️ Settings</button>
      </header>

      {error && (
        <div className="banner error">
          <span>{error}</span>
          <button onClick={dismissError}>Dismiss</button>
        </div>
      )}

      <Screen onOpenCaseFile={() => setCaseFileOpen(true)} />

      <footer style={{ textAlign: "center", padding: "40px 0 16px", fontSize: "0.85rem", color: "var(--muted)" }}>
        Made by <a href="https://quasarbright.github.io" target="_blank" rel="noreferrer">Mike Delmonaco</a>
      </footer>

      {settingsOpen && <SettingsModal dismissable onClose={() => setSettingsOpen(false)} />}
      {caseFileOpen && caseFile && (
        <CaseFileModal caseFile={caseFile} onClose={() => setCaseFileOpen(false)} />
      )}
    </ApiKeyGate>
  );
}
