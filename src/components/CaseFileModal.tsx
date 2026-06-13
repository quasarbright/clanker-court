import type { CaseFile } from "../game/types";

export function CaseFileModal({ caseFile, onClose }: { caseFile: CaseFile; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="panel modal stack"
        style={{ maxHeight: "80vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <span className="tag">Police case file</span>
            <h2 style={{ marginTop: 6 }}>{caseFile.title}</h2>
            <p className="muted">
              Charge against {caseFile.defendant.name}: <strong>{caseFile.charge}</strong>
            </p>
          </div>
          <button onClick={onClose} style={{ flexShrink: 0 }}>✕ Close</button>
        </div>

        <div className="card"><p style={{ margin: 0 }}>{caseFile.summary}</p></div>

        <div>
          <h3>Established facts</h3>
          <ul className="facts">
            {caseFile.knownFacts.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        </div>

        {caseFile.evidence?.length > 0 && (
          <div>
            <h3>Evidence</h3>
            <div className="stack">
              {caseFile.evidence.map((e, i) => (
                <div key={i} className="card">
                  <strong>{e.name}</strong>
                  {!e.inPolicePossession && (
                    <span className="tag" style={{ marginLeft: 8 }}>not in possession</span>
                  )}
                  <p className="muted" style={{ marginTop: 4, marginBottom: 0 }}>{e.description}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3>Open questions</h3>
          <ul className="facts">
            {caseFile.openQuestions.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>

        <div>
          <h3>Witnesses</h3>
          <div className="stack">
            {caseFile.witnesses.map((w) => (
              <div key={w.id} className="card">
                <strong>{w.name}</strong> — <span className="muted">{w.role}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
