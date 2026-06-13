import { chat, chatJSON } from "../llm/openrouter";
import type { CaseFile, ExamStage, Side, TranscriptEntry } from "../game/types";
import { objectionsForStage } from "../game/objections";

interface CounselContext {
  caseFile: CaseFile;
  persona: string;
  side: Side;
}

function sideName(side: Side): string {
  return side === "prosecution" ? "the prosecution" : "the defense";
}

function recent(transcript: TranscriptEntry[], n = 12): string {
  return transcript
    .slice(-n)
    .map((e) => `${e.speaker}: ${e.text}`)
    .join("\n");
}

function strategyFor(side: Side): string {
  if (side === "prosecution") {
    return (
      "Your job is to secure a conviction. Be aggressive and strategic:\n" +
      "- Build a damning narrative around the evidence and the defendant's opportunity, motive, and behavior.\n" +
      "- On direct, draw out every detail that implicates the defendant — inconsistencies, suspicious actions, damaging admissions.\n" +
      "- On cross, attack the defense witness's credibility, expose contradictions, and force concessions. " +
      "Use leading questions to control the narrative.\n" +
      "- Never let a witness off the stand without extracting something useful. " +
      "If their testimony is unhelpful, undermine their reliability.\n" +
      "- Exploit circumstantial evidence fully — juries convict on it all the time."
    );
  } else {
    return (
      "Your job is to create reasonable doubt and protect your client. Be tenacious and sharp:\n" +
      "- Relentlessly probe for gaps, inconsistencies, and alternative explanations in the prosecution's case.\n" +
      "- On direct, build your client's credibility and present a coherent innocent narrative.\n" +
      "- On cross, challenge every assumption the prosecution's witnesses make. " +
      "Force them to admit what they don't know, didn't see, or can't be certain of.\n" +
      "- Point out what evidence is missing, what was never tested, and who else could have done it.\n" +
      "- You don't need to prove innocence — you only need the jury to doubt guilt."
    );
  }
}

// Opening or closing statement.
export async function counselStatement(
  ctx: CounselContext,
  kind: "opening" | "closing",
  transcript: TranscriptEntry[],
): Promise<string> {
  const text = await chat(
    [
      {
        role: "system",
        content:
          `You are the opposing counsel representing ${sideName(ctx.side)}. Persona: ${ctx.persona}\n\n` +
          strategyFor(ctx.side) + "\n\n" +
          "You only know what is in the case file. Stay in character. " +
          "Respond with only your spoken words — no name prefix, no stage directions.",
      },
      {
        role: "user",
        content:
          `Case file:\n${JSON.stringify(ctx.caseFile, null, 2)}\n\n` +
          (transcript.length ? `Trial so far:\n${recent(transcript, 20)}\n\n` : "") +
          `Deliver your ${kind} statement to the jury (2-4 short paragraphs). Make it compelling.`,
      },
    ],
    { temperature: 0.8 },
  );
  return text.trim();
}

// Generate the next examination question, or decide to rest.
export async function counselQuestion(
  ctx: CounselContext,
  stage: ExamStage,
  witnessName: string,
  transcript: TranscriptEntry[],
  questionCount: number,
): Promise<{ question: string | null }> {
  const result = await chatJSON<{ done: boolean; question: string }>([
    {
      role: "system",
      content:
        `You are ${sideName(ctx.side)} counsel. Persona: ${ctx.persona}\n\n` +
        strategyFor(ctx.side) + "\n\n" +
        `You are conducting ${stage} examination of ${witnessName}. ` +
        (stage === "cross"
          ? "On cross you may ask leading questions but must stay within the scope of the direct examination. "
          : "On direct you should avoid leading questions. ") +
        `You have asked ${questionCount} questions so far (max 3). ` +
        "Only rest if you have nothing more useful to extract.",
    },
    {
      role: "user",
      content:
        `Case file:\n${JSON.stringify(ctx.caseFile, null, 2)}\n\n` +
        `Examination so far:\n${recent(transcript, 16)}\n\n` +
        'Either ask your next question or rest. Return JSON: { "done": boolean, "question": string }. ' +
        "If done is true, question is ignored.",
    },
  ]);
  if (result.done || !result.question?.trim()) return { question: null };
  return { question: result.question.trim() };
}

// Decide whether to object to the examiner's question.
export async function counselObjection(
  ctx: CounselContext,
  stage: ExamStage,
  question: string,
  transcript: TranscriptEntry[],
): Promise<{ object: boolean; reason: string | null }> {
  const allowed = objectionsForStage(stage);
  const result = await chatJSON<{ object: boolean; reason: string }>([
    {
      role: "system",
      content:
        `You are ${sideName(ctx.side)} counsel and may object to the opposing attorney's question. ` +
        "Only object when there is a genuine legal basis — do not object frivolously. " +
        `Valid objection reason ids for ${stage} examination: ` +
        allowed.map((o) => `${o.id} (${o.description})`).join("; "),
    },
    {
      role: "user",
      content:
        `Examination context:\n${recent(transcript, 8)}\n\n` +
        `The opposing attorney just asked: "${question}"\n\n` +
        'Return JSON: { "object": boolean, "reason": string }. reason must be one of the valid ' +
        "ids above when object is true, else empty string.",
    },
  ]);
  if (!result.object) return { object: false, reason: null };
  const valid = allowed.some((o) => o.id === result.reason);
  return { object: true, reason: valid ? result.reason : allowed[0].id };
}
