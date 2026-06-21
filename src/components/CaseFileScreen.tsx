import { useGame } from "../store/gameStore";

export function CaseFileScreen() {
  const { caseFile, playerRole, startTrial, setReady, busy, busyLabel,
          multiplayerRole, hostReady, guestReady } = useGame();
  if (!caseFile) return null;

  return (
    <div className="stack">
      <div>
        <span className="tag">Police case file</span>
        <h1>{caseFile.title}</h1>
        <p className="muted">
          Charge against {caseFile.defendant.name}: <strong>{caseFile.charge}</strong>
        </p>
      </div>

      <div className="card">
        <p>{caseFile.summary}</p>
      </div>

      <div className="panel">
        <h3>Established facts</h3>
        <ul className="facts">
          {caseFile.knownFacts.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>

      {caseFile.evidence?.length > 0 && (
        <div className="panel">
          <h3>Evidence</h3>
          <div className="stack">
            {caseFile.evidence.map((e, i) => (
              <div key={i} className="card">
                <strong>{e.name}</strong>
                {!e.inPolicePossession && (
                  <span className="tag" style={{ marginLeft: 8, background: "var(--accent-muted)", color: "var(--fg-muted)" }}>
                    not in possession
                  </span>
                )}
                <p className="muted" style={{ marginTop: 4, marginBottom: 0 }}>{e.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <h3>Open questions</h3>
        <ul className="facts">
          {caseFile.openQuestions.map((q, i) => (
            <li key={i}>{q}</li>
          ))}
        </ul>
      </div>

      <div className="panel">
        <h3>Witnesses available</h3>
        <div className="stack">
          {caseFile.witnesses.map((w) => (
            <div key={w.id} className="card">
              <strong>{w.name}</strong> — <span className="muted">{w.role}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel center stack">
        <p className="muted">
          You are the <strong>{playerRole}</strong>.{" "}
          {multiplayerRole ? "When both players are ready, the trial begins." : "When you're ready, the trial begins."}
        </p>

        {multiplayerRole ? (
          <>
            {busy ? (
              <p className="busy"><span className="spin">⏳</span> {busyLabel}</p>
            ) : (() => {
              const myReady = multiplayerRole === "host" ? hostReady : guestReady;
              const theirReady = multiplayerRole === "host" ? guestReady : hostReady;
              return myReady ? (
                <p className="busy">
                  <span className="spin">⏳</span>{" "}
                  {theirReady ? "Starting..." : "Waiting for opponent to be ready..."}
                </p>
              ) : (
                <div className="stack" style={{ alignItems: "center", gap: 8 }}>
                  {theirReady && (
                    <p style={{ color: "var(--accent)", fontSize: "0.9rem", margin: 0 }}>
                      Opponent is ready!
                    </p>
                  )}
                  <button className="primary" onClick={() => setReady()}>
                    Ready — begin trial
                  </button>
                </div>
              );
            })()}
          </>
        ) : (
          <button className="primary" onClick={() => startTrial()} disabled={busy}>
            Ready — begin trial
          </button>
        )}
      </div>
    </div>
  );
}
