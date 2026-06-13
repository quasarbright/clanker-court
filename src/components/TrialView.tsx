import { useEffect, useRef, useState } from "react";
import { useGame } from "../store/gameStore";
import { playerInput, remainingWitnesses } from "../game/engine";
import { objectionsForStage } from "../game/objections";
import type { TranscriptEntry } from "../game/types";
import { MAX_QUESTIONS_PER_EXAM } from "../game/types";

function Entry({ e }: { e: TranscriptEntry }) {
  return (
    <div className={`entry kind-${e.kind}`}>
      <div className="who">{e.speaker}</div>
      <div className="what">{e.text}</div>
    </div>
  );
}

function StatementControl({ kind }: { kind: "opening" | "closing" }) {
  const submit = useGame((s) => s.submitStatement);
  const [text, setText] = useState("");
  return (
    <div className="controls">
      <h3>Your {kind} statement</h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={`Address the jury with your ${kind}...`}
      />
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
        <button className="primary" disabled={!text.trim()} onClick={() => submit(text)}>
          Deliver {kind}
        </button>
      </div>
    </div>
  );
}

function WitnessControl() {
  const state = useGame();
  const rem = remainingWitnesses(state);
  return (
    <div className="controls">
      <h3>Call your next witness</h3>
      {rem.length === 0 ? (
        <p className="muted">No witnesses remain to be called.</p>
      ) : (
        <div className="stack">
          {rem.map((w) => (
            <button key={w.id} onClick={() => state.pickWitness(w.id)}>
              Call <strong>{w.name}</strong> — <span className="muted">{w.role}</span>
            </button>
          ))}
        </div>
      )}
      <div className="row" style={{ justifyContent: "flex-end", marginTop: 10 }}>
        <button onClick={() => state.restAsCaller()}>Rest (call no more witnesses)</button>
      </div>
    </div>
  );
}

function QuestionControl({ stage }: { stage: "direct" | "cross" }) {
  const { exam, askQuestion, noFurtherQuestions } = useGame();
  const [text, setText] = useState("");
  if (!exam) return null;
  return (
    <div className="controls">
      <h3>
        {stage === "direct" ? "Direct" : "Cross"}-examining {exam.witnessName}{" "}
        <span className="muted">({exam.questionCount}/{MAX_QUESTIONS_PER_EXAM} questions)</span>
      </h3>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          stage === "cross"
            ? "Ask a question (leading is allowed, but stay within direct's scope)..."
            : "Ask a question (avoid leading questions on direct)..."
        }
      />
      <div className="row" style={{ justifyContent: "space-between", marginTop: 10 }}>
        <button onClick={() => noFurtherQuestions()}>No further questions</button>
        <button
          className="primary"
          disabled={!text.trim()}
          onClick={() => {
            askQuestion(text);
            setText("");
          }}
        >
          Ask
        </button>
      </div>
    </div>
  );
}

function ObjectionControl({ stage, question }: { stage: "direct" | "cross"; question: string }) {
  const submit = useGame((s) => s.submitObjection);
  const reasons = objectionsForStage(stage);
  return (
    <div className="controls controls-inline">
      <h3>Opposing counsel asks:</h3>
      <p className="card" style={{ marginBottom: 12, overflow: "hidden" }}>"{question}"</p>
      <p className="muted" style={{ marginBottom: 8 }}>Object, or let the witness answer.</p>
      <div className="objbtns">
        {reasons.map((r) => (
          <button key={r.id} className="danger" title={r.description} onClick={() => submit(r.id)}>
            Object: {r.label}
          </button>
        ))}
        <button className="primary" onClick={() => submit(null)}>
          No objection
        </button>
      </div>
    </div>
  );
}

export function TrialView({ onOpenCaseFile: _ }: { onOpenCaseFile: () => void }) {
  const state = useGame();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.transcript.length, state.busy]);

  const prompt = playerInput(state);

  return (
    <div style={{ maxWidth: "100%", overflowX: "hidden" }}>
      <div className="topbar">
        <span className="tag">{state.caseFile?.title}</span>
        <span className="tag">You: {state.playerRole}</span>
      </div>

      <div className="transcript">
        {state.transcript.map((e) => (
          <Entry key={e.id} e={e} />
        ))}
        <div ref={endRef} />
      </div>

      {state.busy ? (
        <div className="controls">
          <p className="busy">
            <span className="spin">⏳</span> {state.busyLabel || "The court is in session..."}
          </p>
        </div>
      ) : prompt?.kind === "opening" || prompt?.kind === "closing" ? (
        <StatementControl kind={prompt.kind} />
      ) : prompt?.kind === "pickWitness" ? (
        <WitnessControl />
      ) : prompt?.kind === "question" ? (
        <QuestionControl stage={prompt.stage} />
      ) : prompt?.kind === "objection" ? (
        <ObjectionControl stage={prompt.stage} question={prompt.question} />
      ) : (
        <div className="controls">
          <p className="busy">
            <span className="spin">⏳</span> Waiting on the court...
          </p>
        </div>
      )}
    </div>
  );
}
