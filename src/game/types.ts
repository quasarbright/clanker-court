// Domain types for the trial game.

export type Role = "prosecutor" | "defense";

// ---- Setup-phase data ----

export interface POI {
  id: string;
  name: string;
  role: string; // their relationship to the case, e.g. "the victim's brother"
  personality: string;
  relationships: string; // free text describing ties to other POIs
  isDefendant: boolean;
  isWitness: boolean; // callable to the stand
  witnessed: string[]; // ground-truth facts this POI personally knows
}

export interface Evidence {
  id: string;
  name: string;
  description: string;
  inPolicePossession: boolean;
}

export interface TrueStory {
  title: string;
  crime: string; // what actually happened
  charge: string; // the criminal charge against the defendant
  defendantId: string;
  groundTruthGuilty: boolean; // whether the defendant actually did it
  timeline: string[];
  evidence: Evidence[];
  pois: POI[];
}

// A single POI's first-person knowledge brief — the ONLY case context that POI's
// witness agent ever receives. The full TrueStory must never reach it.
export interface POIBrief {
  poiId: string;
  name: string;
  isDefendant: boolean;
  brief: string; // first-person account of what they know / saw / did
}

export interface CaseFile {
  title: string;
  charge: string;
  summary: string;
  knownFacts: string[];
  openQuestions: string[]; // deliberate ambiguities to keep the trial interesting
  evidence: { name: string; description: string; inPolicePossession: boolean }[];
  witnesses: { id: string; name: string; role: string }[]; // excludes defendant
  defendant: { id: string; name: string }; // may only be called by the defense
}

export interface Personas {
  judge: string;
  jury: string;
  opposingCounsel: string; // persona of the non-player lawyer
}

// ---- Trial-phase data ----

export type Phase =
  | "setup"
  | "caseFile"
  | "prosecutionOpening"
  | "defenseOpening"
  | "prosecutionWitnesses"
  | "defenseWitnesses"
  | "prosecutionClosing"
  | "defenseClosing"
  | "verdict";

export type Side = "prosecution" | "defense";

export type TranscriptKind =
  | "system" // stage directions, rulings
  | "opening"
  | "closing"
  | "question"
  | "answer"
  | "objection"
  | "ruling"
  | "verdict";

export interface TranscriptEntry {
  id: string;
  kind: TranscriptKind;
  speaker: string; // "Prosecutor", "Defense", witness name, "Judge", "Jury", "Court"
  text: string;
}

export type ExamStage = "direct" | "cross";

// State for an in-progress witness examination.
export interface Examination {
  witnessId: string;
  witnessName: string;
  stage: ExamStage;
  examiner: Side; // who is currently asking
  questionCount: number;
  directSummary: string[]; // questions asked during direct, for scope objections on cross
  pendingQuestion: string | null; // question awaiting objection/answer resolution
}

export interface Verdict {
  guilty: boolean;
  rationale: string;
}

export interface TrialState {
  phase: Phase;
  playerRole: Role; // which side the human plays
  multiplayerRole: null | "host" | "guest";
  hostReady: boolean;
  guestReady: boolean;
  trueStory: TrueStory | null;
  briefs: POIBrief[];
  caseFile: CaseFile | null;
  personas: Personas | null;
  transcript: TranscriptEntry[];
  calledWitnessIds: string[]; // a witness, once called, can't be recalled
  exam: Examination | null;
  verdict: Verdict | null;
  busy: boolean; // an agent call is in flight
  busyLabel: string;
  error: string | null;
}

export const MAX_QUESTIONS_PER_EXAM = 3;

export function sideForRole(role: Role): Side {
  return role === "prosecutor" ? "prosecution" : "defense";
}

export function speakerLabel(side: Side): string {
  return side === "prosecution" ? "Prosecutor" : "Defense";
}
