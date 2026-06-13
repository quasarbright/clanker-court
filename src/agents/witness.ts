import { chat } from "../llm/openrouter";
import type { POIBrief, TranscriptEntry } from "../game/types";

// A witness answers a question. The system prompt contains ONLY this witness's brief —
// never the full true story or other POIs' private knowledge.
export async function witnessAnswer(
  brief: POIBrief,
  question: string,
  recentExchange: TranscriptEntry[],
): Promise<string> {
  const fifth = brief.isDefendant
    ? "You are the DEFENDANT. You MAY plead the Fifth Amendment to refuse to answer any " +
      "question that could incriminate you (say so plainly). "
    : "You are a witness, not the defendant. You MUST answer every question truthfully; you " +
      "cannot plead the Fifth. ";

  const history = recentExchange
    .map((e) => `${e.speaker}: ${e.text}`)
    .join("\n");

  const reply = await chat(
    [
      {
        role: "system",
        content:
          `You are ${brief.name}. You're on the witness stand being questioned by an attorney.\n\n` +
          brief.brief +
          "\n\n" +
          fifth +
          "If you're asked about something you weren't there for or don't know, just say so " +
          "naturally — 'I wasn't there', 'I don't know', 'I don't remember' — whatever fits. " +
          "Keep answers to 1-4 sentences. Respond with only your spoken words, no name prefix, " +
          "no stage directions, no quotation marks.",
      },
      {
        role: "user",
        content:
          (history ? `Recent exchange:\n${history}\n\n` : "") +
          `The examining attorney asks you: "${question}"\n\nGive your spoken answer.`,
      },
    ],
    { temperature: 0.7 },
  );
  return reply.trim();
}
