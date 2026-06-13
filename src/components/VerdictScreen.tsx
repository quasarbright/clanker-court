import { useGame } from "../store/gameStore";

export function VerdictScreen() {
  const { verdict, trueStory, caseFile, reset } = useGame();
  if (!verdict) return null;

  const correct = trueStory ? verdict.guilty === trueStory.groundTruthGuilty : null;

  return (
    <div className="stack">
      <div className="center">
        <span className="tag">Verdict</span>
        <h1>{verdict.guilty ? "GUILTY" : "NOT GUILTY"}</h1>
        <p className="muted">{caseFile?.defendant.name} — {caseFile?.charge}</p>
      </div>

      <div className="panel">
        <h3>The jury's reasoning</h3>
        <p>{verdict.rationale}</p>
      </div>

      {trueStory && (
        <div className="panel stack">
          <div>
            <h3>The truth (revealed)</h3>
            <p className="muted" style={{ marginBottom: 0 }}>
              The defendant was actually{" "}
              <strong>{trueStory.groundTruthGuilty ? "guilty" : "innocent"}</strong>.{" "}
              {correct ? "The jury reached the correct conclusion." : "The jury got it wrong."}
            </p>
          </div>

          <div>
            <h4 style={{ margin: "0 0 6px" }}>What really happened</h4>
            <p style={{ margin: 0 }}>{trueStory.crime}</p>
          </div>

          <div>
            <h4 style={{ margin: "0 0 6px" }}>Timeline</h4>
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              {trueStory.timeline.map((t, i) => <li key={i} style={{ marginBottom: 4 }}>{t}</li>)}
            </ol>
          </div>

          {trueStory.evidence?.length > 0 && (
            <div>
              <h4 style={{ margin: "0 0 6px" }}>Evidence</h4>
              <div className="stack">
                {trueStory.evidence.map((e) => (
                  <div key={e.id} className="card">
                    <strong>{e.name}</strong>
                    {!e.inPolicePossession && <span className="tag" style={{ marginLeft: 8 }}>not recovered</span>}
                    <p className="muted" style={{ margin: "4px 0 0" }}>{e.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 style={{ margin: "0 0 6px" }}>The people involved</h4>
            <div className="stack">
              {trueStory.pois.map((p) => (
                <div key={p.id} className="card">
                  <div className="row" style={{ marginBottom: 4 }}>
                    <strong>{p.name}</strong>
                    <span className="muted">— {p.role}</span>
                    {p.isDefendant && <span className="tag">defendant</span>}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {p.witnessed.map((f, i) => <li key={i} className="muted" style={{ fontSize: "0.9rem", marginBottom: 2 }}>{f}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="center">
        <button className="primary" onClick={() => reset()}>
          New case
        </button>
      </div>
    </div>
  );
}
