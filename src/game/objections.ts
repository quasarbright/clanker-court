import type { ExamStage } from "./types";

export interface ObjectionReason {
  id: string;
  label: string;
  description: string;
  stages: ExamStage[]; // which examination stages this objection is valid in
}

// Fixed set of objection reasons. Leading is only objectionable on direct;
// out-of-scope only on cross. The rest apply in both stages.
export const OBJECTION_REASONS: ObjectionReason[] = [
  {
    id: "leading",
    label: "Leading",
    description: "The question suggests its own answer (only objectionable on direct).",
    stages: ["direct"],
  },
  {
    id: "out_of_scope",
    label: "Out of scope",
    description: "Cross-examination must stay within what direct covered.",
    stages: ["cross"],
  },
  {
    id: "hearsay",
    label: "Hearsay",
    description: "Asks for an out-of-court statement offered for its truth.",
    stages: ["direct", "cross"],
  },
  {
    id: "speculation",
    label: "Speculation",
    description: "Asks the witness to guess about things they don't know.",
    stages: ["direct", "cross"],
  },
  {
    id: "relevance",
    label: "Relevance",
    description: "The question has no bearing on the case.",
    stages: ["direct", "cross"],
  },
  {
    id: "argumentative",
    label: "Argumentative",
    description: "The question argues rather than seeks facts.",
    stages: ["direct", "cross"],
  },
  {
    id: "asked_and_answered",
    label: "Asked & answered",
    description: "The witness has already answered this question.",
    stages: ["direct", "cross"],
  },
];

export function objectionsForStage(stage: ExamStage): ObjectionReason[] {
  return OBJECTION_REASONS.filter((o) => o.stages.includes(stage));
}

export function objectionLabel(id: string): string {
  return OBJECTION_REASONS.find((o) => o.id === id)?.label ?? id;
}
