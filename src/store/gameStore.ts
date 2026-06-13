import { create } from "zustand";
import type { Role, Side, TrialState } from "../game/types";
import { sideForRole, speakerLabel } from "../game/types";
import {
  advanceExam,
  appendStatement,
  beginExam,
  callerForPhase,
  endStage,
  entry,
  opposite,
  playerInput,
  remainingWitnesses,
  restSide,
} from "../game/engine";
import { generateStory } from "../agents/storyGenerator";
import { buildAllBriefs } from "../agents/poiBuilder";
import { buildCaseFile } from "../agents/police";
import { buildPersonas } from "../agents/court";
import { counselObjection, counselQuestion, counselStatement } from "../agents/counsel";
import { judgeRuling } from "../agents/judge";
import { witnessAnswer } from "../agents/witness";
import { juryVerdict } from "../agents/jury";
import { objectionLabel } from "../game/objections";
import { OpenRouterError } from "../llm/openrouter";

interface GameStore extends TrialState {
  setRole: (role: Role) => void;
  generateCase: (prompt?: string) => Promise<void>;
  startTrial: () => Promise<void>;
  submitStatement: (text: string) => Promise<void>;
  pickWitness: (witnessId: string) => Promise<void>;
  restAsCaller: () => Promise<void>;
  askQuestion: (text: string) => Promise<void>;
  noFurtherQuestions: () => Promise<void>;
  submitObjection: (reason: string | null) => Promise<void>;
  reset: () => void;
  dismissError: () => void;
}

const initial: TrialState = {
  phase: "setup",
  playerRole: "defense",
  trueStory: null,
  briefs: [],
  caseFile: null,
  personas: null,
  transcript: [],
  calledWitnessIds: [],
  exam: null,
  verdict: null,
  busy: false,
  busyLabel: "",
  error: null,
};

export const useGame = create<GameStore>((set, get) => {
  // Helpers ----------------------------------------------------------------

  const me = (): Side => sideForRole(get().playerRole);
  const npcSide = (): Side => opposite(me());

  const npcCtx = () => ({
    caseFile: get().caseFile!,
    persona: get().personas!.opposingCounsel,
    side: npcSide(),
  });

  const recentEntries = (n = 6) => get().transcript.slice(-n);

  function withError<T>(fn: () => Promise<T>): Promise<T | void> {
    return fn().catch((e) => {
      const msg = e instanceof OpenRouterError ? e.message : (e as Error).message;
      set({ error: msg, busy: false, busyLabel: "" });
    });
  }

  // Resolve a question after an objection decision (used by both player and NPC paths).
  async function resolveObjection(reason: string | null) {
    const s = get();
    const exam = s.exam!;
    const examinerLabel = speakerLabel(exam.examiner);
    const objectorLabel = speakerLabel(opposite(exam.examiner));
    let transcript = [...s.transcript];
    let struck = false;

    if (reason) {
      transcript = [
        ...transcript,
        entry("objection", objectorLabel, `Objection — ${objectionLabel(reason)}.`),
      ];
      set({ transcript, busy: true, busyLabel: "The judge is ruling..." });
      const ruling = await judgeRuling(
        s.caseFile!,
        s.personas!.judge,
        exam.stage,
        exam.pendingQuestion!,
        reason,
        exam.directSummary,
      );
      struck = ruling.sustained;
      transcript = [
        ...transcript,
        entry(
          "ruling",
          "Judge",
          `${ruling.sustained ? "Sustained" : "Overruled"}. ${ruling.explanation}`,
        ),
      ];
    }

    if (!struck) {
      set({ transcript, busy: true, busyLabel: `${exam.witnessName} is answering...` });
      const brief = s.briefs.find((b) => b.poiId === exam.witnessId)!;
      const answer = await witnessAnswer(brief, exam.pendingQuestion!, recentEntries());
      transcript = [...transcript, entry("answer", exam.witnessName, answer)];
    } else {
      transcript = [
        ...transcript,
        entry("system", "Court", `(Question withdrawn — ${examinerLabel} moves on.)`),
      ];
    }

    const directSummary =
      exam.stage === "direct"
        ? [...exam.directSummary, exam.pendingQuestion!]
        : exam.directSummary;
    const updatedExam = {
      ...exam,
      questionCount: exam.questionCount + 1,
      directSummary,
    };
    const stateWithExam = { ...get(), transcript, exam: updatedExam };
    const adv = advanceExam(stateWithExam, updatedExam);
    set({ transcript, busy: false, busyLabel: "", ...adv });
  }

  // Perform one automatic (NPC / auto) step based on current state.
  async function autoStep(): Promise<boolean> {
    const s = get();

    // Verdict: jury deliberates, then we're done.
    if (s.phase === "verdict") {
      if (s.verdict) return true;
      set({ busy: true, busyLabel: "The jury is deliberating..." });
      const v = await juryVerdict(s.personas!.jury, s.transcript);
      set({
        verdict: v,
        transcript: [
          ...get().transcript,
          entry(
            "verdict",
            "Jury",
            `We find the defendant ${v.guilty ? "GUILTY" : "NOT GUILTY"}. ${v.rationale}`,
          ),
        ],
        busy: false,
        busyLabel: "",
      });
      return true;
    }

    // Openings / closings by the NPC side.
    if (s.phase === "prosecutionOpening" || s.phase === "defenseOpening") {
      const side: Side = s.phase === "prosecutionOpening" ? "prosecution" : "defense";
      set({ busy: true, busyLabel: `${speakerLabel(side)} is giving an opening...` });
      const text = await counselStatement(npcCtx(), "opening", s.transcript);
      set({ busy: false, busyLabel: "", ...appendStatement(get(), side, "opening", text) });
      return false;
    }
    if (s.phase === "prosecutionClosing" || s.phase === "defenseClosing") {
      const side: Side = s.phase === "prosecutionClosing" ? "prosecution" : "defense";
      set({ busy: true, busyLabel: `${speakerLabel(side)} is giving a closing...` });
      const text = await counselStatement(npcCtx(), "closing", s.transcript);
      set({ busy: false, busyLabel: "", ...appendStatement(get(), side, "closing", text) });
      return false;
    }

    // Witness phases.
    const caller = callerForPhase(s.phase);
    if (caller) {
      const exam = s.exam;
      if (!exam) {
        // NPC caller: call the next remaining witness, or rest.
        const rem = remainingWitnesses(s);
        if (rem.length === 0) {
          set(restSide(s));
        } else {
          set(beginExam(s, rem[0].id));
        }
        return false;
      }
      if (exam.pendingQuestion == null) {
        // NPC examiner asks or rests.
        set({ busy: true, busyLabel: `${speakerLabel(exam.examiner)} is questioning...` });
        const res = await counselQuestion(
          npcCtx(),
          exam.stage,
          exam.witnessName,
          s.transcript,
          exam.questionCount,
        );
        if (res.question == null) {
          set({ busy: false, busyLabel: "", ...endStage(get(), exam) });
        } else {
          set({
            busy: false,
            busyLabel: "",
            exam: { ...exam, pendingQuestion: res.question },
            transcript: [
              ...get().transcript,
              entry("question", speakerLabel(exam.examiner), res.question),
            ],
          });
        }
        return false;
      }
      // NPC objector decides.
      set({ busy: true, busyLabel: `${speakerLabel(opposite(exam.examiner))} is considering an objection...` });
      const dec = await counselObjection(npcCtx(), exam.stage, exam.pendingQuestion, s.transcript);
      await resolveObjection(dec.object ? dec.reason : null);
      return false;
    }

    return true; // nothing to do
  }

  // Drive automatic steps until the human is needed or the trial ends.
  async function run() {
    // Loop guard against runaway loops.
    for (let i = 0; i < 500; i++) {
      const s = get();
      if (s.error) return;
      if (playerInput(s)) return; // waiting on the human
      const done = await autoStep();
      if (get().error) return;
      if (done) return;
    }
  }

  // Public actions ---------------------------------------------------------

  return {
    ...initial,

    setRole: (role) => set({ playerRole: role }),

    generateCase: (prompt?: string) =>
      withError(async () => {
        set({ busy: true, busyLabel: "Generating the true story...", error: null });
        const story = await generateStory(prompt);
        set({ trueStory: story, busyLabel: "Building witness minds..." });
        const briefs = await buildAllBriefs(story);
        set({ briefs, busyLabel: "Compiling the police case file..." });
        const caseFile = await buildCaseFile(story);
        set({ caseFile, busyLabel: "Seating the court..." });
        const personas = await buildPersonas(caseFile, get().playerRole);
        set({ personas, phase: "caseFile", busy: false, busyLabel: "" });
      }) as Promise<void>,

    startTrial: () =>
      withError(async () => {
        set({ phase: "prosecutionOpening" });
        await run();
      }) as Promise<void>,

    submitStatement: (text) =>
      withError(async () => {
        const s = get();
        const side = sideForRole(s.playerRole);
        const kind = s.phase.includes("Closing") ? "closing" : "opening";
        set(appendStatement(s, side, kind, text.trim()));
        await run();
      }) as Promise<void>,

    pickWitness: (witnessId) =>
      withError(async () => {
        set(beginExam(get(), witnessId));
        await run();
      }) as Promise<void>,

    restAsCaller: () =>
      withError(async () => {
        set(restSide(get()));
        await run();
      }) as Promise<void>,

    askQuestion: (text) =>
      withError(async () => {
        const s = get();
        const exam = s.exam!;
        set({
          exam: { ...exam, pendingQuestion: text.trim() },
          transcript: [
            ...s.transcript,
            entry("question", speakerLabel(exam.examiner), text.trim()),
          ],
        });
        await run();
      }) as Promise<void>,

    noFurtherQuestions: () =>
      withError(async () => {
        const s = get();
        set(endStage(s, s.exam!));
        await run();
      }) as Promise<void>,

    submitObjection: (reason) =>
      withError(async () => {
        await resolveObjection(reason);
        await run();
      }) as Promise<void>,

    reset: () => set({ ...initial }),
    dismissError: () => set({ error: null }),
  };
});
