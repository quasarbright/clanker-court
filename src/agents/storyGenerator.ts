import { chatJSON } from "../llm/openrouter";
import type { TrueStory } from "../game/types";

// Generates the rich, self-consistent "true story" of what actually happened.
export async function generateStory(idea?: string): Promise<TrueStory> {
  const story = await chatJSON<TrueStory>([
    {
      role: "system",
      content:
        "You are the Story Generator for a courtroom trial game. You invent the COMPLETE, " +
        "omniscient true account of a crime — the hidden reality that no character fully knows. " +
        "Be richly detailed and internally consistent: specify exactly what happened, who did " +
        "what, their real motives, and a clear timeline, so that ANY question asked at trial " +
        "can be answered from this material. Decide definitively whether the defendant is " +
        "actually guilty. Write as an all-knowing narrator, not an investigator — no hedging, " +
        "no 'allegedly', no ambiguity about the truth itself. " +
        "The defendant should be innocent roughly half the time — an innocent person wrongly " +
        "accused, framed, or caught by circumstance is just as dramatically compelling as a " +
        "guilty one. Do not default to guilty.",
    },
    {
      role: "user",
      content:
        (idea
          ? `Case idea to build on: ${idea}\n\n`
          : "Make this a compelling, dramatic case — the kind that would be the centerpiece of a prestige crime drama or courtroom thriller. High stakes, morally complex, with surprising twists that emerge through testimony.\n\n") +
        "Invent a single criminal case. Return JSON with this exact shape:\n" +
        "{\n" +
        '  "title": string,\n' +
        '  "crime": string (the definitive omniscient account of exactly what happened and why — ' +
        'written as the hidden truth revealed after the trial, not as a police summary. ' +
        'State facts directly: who did what, their real motive, what witnesses missed or lied about. ' +
        'No hedging, no "allegedly", no unsolved gaps),\n' +
        '  "charge": string (the specific charge against the defendant),\n' +
        '  "defendantId": string (matches one poi id),\n' +
        '  "groundTruthGuilty": boolean,\n' +
        '  "timeline": string[] (chronological key events),\n' +
        '  "evidence": [\n' +
        "    {\n" +
        '      "id": string (short slug),\n' +
        '      "name": string (e.g. "Security footage from 11:42 PM"),\n' +
        '      "description": string (what it shows or proves),\n' +
        '      "inPolicePossession": boolean (true = police have it, false = missing/destroyed/unrecovered)\n' +
        "    }\n" +
        "  ],\n" +
        '  "pois": [\n' +
        "    {\n" +
        '      "id": string (short slug),\n' +
        '      "name": string,\n' +
        '      "role": string (relationship to the case),\n' +
        '      "personality": string,\n' +
        '      "relationships": string (ties to other characters),\n' +
        '      "isDefendant": boolean,\n' +
        '      "isWitness": boolean (can be called to the stand),\n' +
        '      "witnessed": string[] (specific facts THIS person personally knows or saw)\n' +
        "    }\n" +
        "  ]\n" +
        "}\n\n" +
        "Include 4-6 POIs. Exactly one has isDefendant true. At least 3 should have " +
        "isWitness true. Make the 'witnessed' arrays accurate to the true story but limited " +
        "to what each person could realistically know — different people know different things.\n\n" +
        "EVIDENCE RULES: Include 3-6 pieces of evidence. Every physical item or recording " +
        "mentioned anywhere in the story MUST appear in the evidence array. If security footage " +
        "exists in the story, it must be listed. If a weapon, phone, or document is mentioned, " +
        "it must be listed. Mark inPolicePossession carefully — if a piece of evidence is NOT in " +
        "police possession, the description MUST explain a concrete, believable reason why: the " +
        "camera only covered the entrance and the relevant area was off-frame, the footage was " +
        "recorded over before detectives arrived, the weapon was disposed of in a specific location, " +
        "etc. Do NOT say evidence is missing without a specific reason. Vague gaps like 'the " +
        "footage didn't capture the critical moment' with no explanation are not acceptable.",
    },
  ], { maxTokens: 4000 });
  return story;
}
