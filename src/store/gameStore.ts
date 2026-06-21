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
import { createRoom, joinRoom } from "../multiplayer/peer";

interface GameStore extends TrialState {
  // Multiplayer extras (not part of TrialState broadcast)
  multiplayerSend: null | ((msg: object) => void);
  roomCode: string | null;
  guestConnected: boolean;
  pendingPrompt: null; // unused, kept for reset symmetry

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
  hostGame: (role: Role) => Promise<void>;
  joinGame: (roomCode: string) => Promise<void>;
  setReady: () => void;
}

const initial: TrialState = {
  phase: "setup",
  playerRole: "defense",
  multiplayerRole: null,
  hostReady: false,
  guestReady: false,
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

// Extract only serializable TrialState fields for broadcast.
function toTrialState(s: TrialState): TrialState {
  return {
    phase: s.phase,
    playerRole: s.playerRole,
    multiplayerRole: s.multiplayerRole,
    hostReady: s.hostReady,
    guestReady: s.guestReady,
    trueStory: s.trueStory,
    briefs: s.briefs,
    caseFile: s.caseFile,
    personas: s.personas,
    transcript: s.transcript,
    calledWitnessIds: s.calledWitnessIds,
    exam: s.exam,
    verdict: s.verdict,
    busy: s.busy,
    busyLabel: s.busyLabel,
    error: s.error,
  };
}

// Subscription cleanup for host broadcast.
let broadcastUnsub: (() => void) | null = null;
// Peer destroy handle for cleanup on reset.
let peerDestroy: (() => void) | null = null;

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

  // Send action to host (guest only).
  function sendToHost(name: string, payload: object = {}) {
    get().multiplayerSend!({ type: "action", name, payload });
  }

  // Resolve a question after an objection decision.
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

    const caller = callerForPhase(s.phase);
    if (caller) {
      const exam = s.exam;
      if (!exam) {
        const rem = remainingWitnesses(s);
        if (rem.length === 0) {
          set(restSide(s));
        } else {
          set(beginExam(s, rem[0].id));
        }
        return false;
      }
      if (exam.pendingQuestion == null) {
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
      set({ busy: true, busyLabel: `${speakerLabel(opposite(exam.examiner))} is considering an objection...` });
      const dec = await counselObjection(npcCtx(), exam.stage, exam.pendingQuestion, s.transcript);
      await resolveObjection(dec.object ? dec.reason : null);
      return false;
    }

    return true;
  }

  // Returns true if either human player needs to act right now.
  function anyHumanInputNeeded(s: TrialState): boolean {
    if (playerInput(s)) return true;
    // In multiplayer the guest is also a human — check their perspective too.
    if (s.multiplayerRole === "host") {
      const guestRole: Role = s.playerRole === "prosecutor" ? "defense" : "prosecutor";
      if (playerInput({ ...s, playerRole: guestRole })) return true;
    }
    return false;
  }

  async function run() {
    // Guests never drive the engine — the host does.
    if (get().multiplayerRole === "guest") return;
    for (let i = 0; i < 500; i++) {
      const s = get();
      if (s.error) return;
      if (anyHumanInputNeeded(s)) return;
      const done = await autoStep();
      if (get().error) return;
      if (done) return;
    }
  }

  // Dispatch a guest action message on the host side.
  function handleGuestAction(msg: { name: string; payload: Record<string, unknown> }) {
    const store = get();
    switch (msg.name) {
      case "setReady": {
        set({ guestReady: true });
        if (get().hostReady) get().startTrial();
        break;
      }
      case "submitStatement": store.submitStatement(msg.payload.text as string); break;
      case "pickWitness": store.pickWitness(msg.payload.witnessId as string); break;
      case "restAsCaller": store.restAsCaller(); break;
      case "askQuestion": store.askQuestion(msg.payload.text as string); break;
      case "noFurtherQuestions": store.noFurtherQuestions(); break;
      case "submitObjection": store.submitObjection(msg.payload.reason as string | null); break;
    }
  }

  // Public actions ---------------------------------------------------------

  return {
    ...initial,
    multiplayerSend: null,
    roomCode: null,
    guestConnected: false,
    pendingPrompt: null,

    setRole: (role) => set({ playerRole: role }),

    hostGame: (role: Role) =>
      withError(async () => {
        set({ playerRole: role, multiplayerRole: "host", busy: true, busyLabel: "Creating room..." });
        const handle = await createRoom(
          (send) => {
            // Guest connected
            const guestRole: Role = role === "prosecutor" ? "defense" : "prosecutor";
            send({ type: "init", guestRole });
            send({ type: "stateUpdate", state: toTrialState(get()) });
            set({ multiplayerSend: send, guestConnected: true, busy: false, busyLabel: "" });
          },
          (msg) => {
            const m = msg as { type: string; name: string; payload: Record<string, unknown> };
            if (m.type === "action") handleGuestAction(m);
          },
        );
        peerDestroy = handle.destroy;

        // Auto-broadcast every state change to guest.
        broadcastUnsub = useGame.subscribe((state) => {
          if (state.multiplayerRole === "host" && state.multiplayerSend) {
            state.multiplayerSend({ type: "stateUpdate", state: toTrialState(state) });
          }
        });

        set({ roomCode: handle.roomCode, busy: false, busyLabel: "" });
      }) as Promise<void>,

    joinGame: (roomCode: string) =>
      withError(async () => {
        set({ multiplayerRole: "guest", busy: true, busyLabel: "Connecting to host..." });
        const handle = await joinRoom(roomCode, (msg) => {
          const m = msg as { type: string; guestRole?: Role; state?: TrialState };
          if (m.type === "init" && m.guestRole) {
            set({ playerRole: m.guestRole, busyLabel: "Waiting for host to start..." });
          } else if (m.type === "stateUpdate" && m.state) {
            const myRole = get().playerRole;
            set({
              ...m.state,
              playerRole: myRole,
              multiplayerRole: "guest",
              multiplayerSend: get().multiplayerSend,
            });
          }
        });
        peerDestroy = handle.destroy;
        set({ multiplayerSend: handle.send });
      }) as Promise<void>,

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
        if (get().multiplayerRole === "guest") {
          sendToHost("submitStatement", { text });
          return;
        }
        const s = get();
        const side = sideForRole(s.playerRole);
        const kind = s.phase.includes("Closing") ? "closing" : "opening";
        set(appendStatement(s, side, kind, text.trim()));
        await run();
      }) as Promise<void>,

    pickWitness: (witnessId) =>
      withError(async () => {
        if (get().multiplayerRole === "guest") {
          sendToHost("pickWitness", { witnessId });
          return;
        }
        set(beginExam(get(), witnessId));
        await run();
      }) as Promise<void>,

    restAsCaller: () =>
      withError(async () => {
        if (get().multiplayerRole === "guest") {
          sendToHost("restAsCaller");
          return;
        }
        set(restSide(get()));
        await run();
      }) as Promise<void>,

    askQuestion: (text) =>
      withError(async () => {
        if (get().multiplayerRole === "guest") {
          sendToHost("askQuestion", { text });
          return;
        }
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
        if (get().multiplayerRole === "guest") {
          sendToHost("noFurtherQuestions");
          return;
        }
        const s = get();
        set(endStage(s, s.exam!));
        await run();
      }) as Promise<void>,

    submitObjection: (reason) =>
      withError(async () => {
        if (get().multiplayerRole === "guest") {
          sendToHost("submitObjection", { reason });
          return;
        }
        await resolveObjection(reason);
        await run();
      }) as Promise<void>,

    setReady: () => {
      if (get().multiplayerRole === "guest") {
        sendToHost("setReady");
        set({ guestReady: true });
        return;
      }
      // Host
      set({ hostReady: true });
      if (get().guestReady) get().startTrial();
    },

    reset: () => {
      broadcastUnsub?.();
      broadcastUnsub = null;
      peerDestroy?.();
      peerDestroy = null;
      set({ ...initial, multiplayerSend: null, roomCode: null, guestConnected: false, pendingPrompt: null });
    },

    dismissError: () => set({ error: null }),
  };
});
