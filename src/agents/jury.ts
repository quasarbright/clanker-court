import { chatJSON } from "../llm/openrouter";
import type { TranscriptEntry, Verdict } from "../game/types";

// The jury deliberates on the full trial transcript and returns a verdict.
export async function juryVerdict(
  persona: string,
  transcript: TranscriptEntry[],
): Promise<Verdict> {
  const record = transcript.map((e) => `${e.speaker}: ${e.text}`).join("\n");

  const result = await chatJSON<Verdict>([
    {
      role: "system",
      content:
        `You are the jury. Persona: ${persona}\n` +
        "You have heard the entire trial. Decide guilt based SOLELY on what was presented " +
        "in the courtroom — testimony, arguments, and evidence introduced at trial. " +
        "You have seen no documents outside the courtroom. Apply 'beyond a reasonable doubt'.",
    },
    {
      role: "user",
      content:
        `Full trial transcript:\n${record}\n\n` +
        'Return JSON: { "guilty": boolean, "rationale": string } — rationale is your spoken ' +
        "explanation to the court (2-4 sentences).",
    },
  ]);
  return result;
}
