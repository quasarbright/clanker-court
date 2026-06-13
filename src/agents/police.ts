import { chatJSON } from "../llm/openrouter";
import type { CaseFile, TrueStory } from "../game/types";

// The police agent decides what the lawyers (and judge/jury) get to know. It produces
// a redacted case file consistent with the true story but with deliberate ambiguity.
export async function buildCaseFile(story: TrueStory): Promise<CaseFile> {
  const defendant = story.pois.find((p) => p.id === story.defendantId)!;
  const witnesses = story.pois.filter((p) => p.isWitness && !p.isDefendant);

  // Deliberately withhold groundTruthGuilty AND the omniscient crime narrative.
  // The police agent only sees what investigators could have observed: the charge,
  // timeline of known events, physical evidence, and who is involved.
  const context = {
    title: story.title,
    charge: story.charge,
    timeline: story.timeline,
    evidence: story.evidence ?? [],
    defendantName: defendant.name,
    people: story.pois.map((p) => ({ name: p.name, role: p.role, isWitness: p.isWitness && !p.isDefendant })),
  };

  const file = await chatJSON<Omit<CaseFile, "witnesses" | "defendant">>([
    {
      role: "system",
      content:
        "You are the Police case-file agent. Write the official case file that both lawyers receive. " +
        "You only know what investigators could have observed: the charge, timeline of known events, " +
        "physical evidence, and the people involved. Write impartially and neutrally — present facts " +
        "without implying guilt or innocence. Leave genuine ambiguity where it exists. " +
        "Do not draw conclusions about what happened.",
    },
    {
      role: "user",
      content:
        "True case context:\n" +
        JSON.stringify(context, null, 2) +
        '\n\nReturn JSON: {\n  "title": string,\n  "charge": string,\n  "summary": string,\n' +
        '  "knownFacts": string[],\n  "openQuestions": string[],\n' +
        '  "evidence": [{ "name": string, "description": string, "inPolicePossession": boolean }]\n}\n\n' +
        "IMPORTANT: The evidence array must include EVERY physical item, recording, or document " +
        "from the true case context. Do not omit any evidence that exists in the story.",
    },
  ]);

  return {
    title: file.title || story.title,
    charge: file.charge || story.charge,
    summary: file.summary,
    knownFacts: file.knownFacts ?? [],
    openQuestions: file.openQuestions ?? [],
    evidence: file.evidence ?? story.evidence?.map((e) => ({
      name: e.name,
      description: e.description,
      inPolicePossession: e.inPolicePossession,
    })) ?? [],
    defendant: { id: defendant.id, name: defendant.name },
    witnesses: witnesses.map((w) => ({ id: w.id, name: w.name, role: w.role })),
  };
}
