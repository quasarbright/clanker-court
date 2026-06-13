import {
  MAX_QUESTIONS_PER_EXAM,
  sideForRole,
  speakerLabel,
} from "./types";
import type {
  Examination,
  ExamStage,
  Phase,
  Side,
  TranscriptEntry,
  TranscriptKind,
  TrialState,
} from "./types";

// ---- Pure helpers driving the trial sequence ----

export function opposite(side: Side): Side {
  return side === "prosecution" ? "defense" : "prosecution";
}

export function callerForPhase(phase: Phase): Side | null {
  if (phase === "prosecutionWitnesses") return "prosecution";
  if (phase === "defenseWitnesses") return "defense";
  return null;
}

const PHASE_ORDER: Phase[] = [
  "prosecutionOpening",
  "defenseOpening",
  "prosecutionWitnesses",
  "defenseWitnesses",
  "prosecutionClosing",
  "defenseClosing",
  "verdict",
];

export function nextPhase(phase: Phase): Phase {
  const i = PHASE_ORDER.indexOf(phase);
  if (i === -1 || i === PHASE_ORDER.length - 1) return phase;
  return PHASE_ORDER[i + 1];
}

export function remainingWitnesses(state: TrialState) {
  const all = state.caseFile?.witnesses ?? [];
  const remaining = all.filter((w) => !state.calledWitnessIds.includes(w.id));
  // The defendant may only be called by the defense, and only once.
  if (
    state.phase === "defenseWitnesses" &&
    state.caseFile?.defendant &&
    !state.calledWitnessIds.includes(state.caseFile.defendant.id)
  ) {
    remaining.push({ ...state.caseFile.defendant, role: "defendant" });
  }
  return remaining;
}

export function entry(
  kind: TranscriptKind,
  speaker: string,
  text: string,
): TranscriptEntry {
  const id = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return { id, kind, speaker, text };
}

// What the human player must do right now. null means an automatic agent step is due.
export type PlayerPrompt =
  | { kind: "opening" | "closing"; side: Side }
  | { kind: "pickWitness"; side: Side }
  | { kind: "question"; stage: ExamStage }
  | { kind: "objection"; stage: ExamStage; question: string };

export function playerInput(state: TrialState): PlayerPrompt | null {
  const me = sideForRole(state.playerRole);
  switch (state.phase) {
    case "prosecutionOpening":
      return me === "prosecution" ? { kind: "opening", side: "prosecution" } : null;
    case "defenseOpening":
      return me === "defense" ? { kind: "opening", side: "defense" } : null;
    case "prosecutionClosing":
      return me === "prosecution" ? { kind: "closing", side: "prosecution" } : null;
    case "defenseClosing":
      return me === "defense" ? { kind: "closing", side: "defense" } : null;
    case "prosecutionWitnesses":
    case "defenseWitnesses": {
      const caller = callerForPhase(state.phase)!;
      const exam = state.exam;
      if (!exam) {
        return me === caller ? { kind: "pickWitness", side: caller } : null;
      }
      if (exam.pendingQuestion == null) {
        return me === exam.examiner ? { kind: "question", stage: exam.stage } : null;
      }
      const objector = opposite(exam.examiner);
      return me === objector
        ? { kind: "objection", stage: exam.stage, question: exam.pendingQuestion }
        : null;
    }
    default:
      return null; // setup, caseFile, verdict are not interactive
  }
}

// ---- State transitions (return a new partial to merge) ----

export function appendStatement(
  state: TrialState,
  side: Side,
  kind: "opening" | "closing",
  text: string,
): Partial<TrialState> {
  const t = [...state.transcript, entry(kind, speakerLabel(side), text)];
  return { transcript: t, phase: nextPhase(state.phase) };
}

export function beginExam(state: TrialState, witnessId: string): Partial<TrialState> {
  const caller = callerForPhase(state.phase)!;
  const cf = state.caseFile;
  const w = (cf?.witnesses ?? []).find((x) => x.id === witnessId)
    ?? (cf?.defendant.id === witnessId ? cf.defendant : null);
  const name = w?.name ?? witnessId;
  const exam: Examination = {
    witnessId,
    witnessName: name,
    stage: "direct",
    examiner: caller,
    questionCount: 0,
    directSummary: [],
    pendingQuestion: null,
  };
  const t = [
    ...state.transcript,
    entry("system", "Court", `The ${caller} calls ${name} to the stand.`),
  ];
  return { exam, transcript: t };
}

export function restSide(state: TrialState): Partial<TrialState> {
  const caller = callerForPhase(state.phase)!;
  const t = [...state.transcript, entry("system", "Court", `The ${caller} rests.`)];
  return { transcript: t, phase: nextPhase(state.phase), exam: null };
}

// Advance examination after a question is fully resolved (answered or struck).
export function advanceExam(state: TrialState, exam: Examination): Partial<TrialState> {
  const reachedMax = exam.questionCount >= MAX_QUESTIONS_PER_EXAM;
  if (!reachedMax) {
    return { exam: { ...exam, pendingQuestion: null } };
  }
  return endStage(state, exam);
}

// End the current stage: direct -> cross, or cross -> witness excused.
export function endStage(state: TrialState, exam: Examination): Partial<TrialState> {
  if (exam.stage === "direct") {
    const crossExaminer = opposite(exam.examiner);
    const t = [
      ...state.transcript,
      entry("system", "Court", `Cross-examination of ${exam.witnessName} begins.`),
    ];
    return {
      transcript: t,
      exam: {
        ...exam,
        stage: "cross",
        examiner: crossExaminer,
        questionCount: 0,
        pendingQuestion: null,
      },
    };
  }
  // cross finished
  const t = [
    ...state.transcript,
    entry("system", "Court", `${exam.witnessName} is excused.`),
  ];
  return {
    transcript: t,
    exam: null,
    calledWitnessIds: [...state.calledWitnessIds, exam.witnessId],
  };
}
