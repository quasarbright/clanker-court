import { chatJSON } from "../llm/openrouter";
import type { POI, POIBrief, TrueStory } from "../game/types";

// Builds a single POI's first-person knowledge brief. Crucially, this is the agent
// that decides what the POI knows. The witness runtime later receives ONLY this brief,
// never the full TrueStory — so leakage is prevented both here (careful scoping) and
// in code (the full story is never passed downstream).
export async function buildBrief(story: TrueStory, poi: POI): Promise<POIBrief> {
  // We pass the POI their own facts plus minimal context, but NOT other POIs' private
  // 'witnessed' facts or the groundTruthGuilty flag.
  const context = {
    caseTitle: story.title,
    charge: story.charge,
    you: {
      name: poi.name,
      role: poi.role,
      personality: poi.personality,
      relationships: poi.relationships,
      isDefendant: poi.isDefendant,
      thingsYouKnow: poi.witnessed,
    },
    otherPeople: story.pois
      .filter((p) => p.id !== poi.id)
      .map((p) => ({ name: p.name, role: p.role })), // names/roles only — not their secrets
  };

  const result = await chatJSON<{ brief: string }>([
    {
      role: "system",
      content:
        "You are the POI Builder. Given a character and the facts they personally know, write " +
        "their memory narrative — a first-person account of what they experienced, in their own " +
        "natural voice. Write it as the character remembering and recounting events, NOT as " +
        "instructions or bullet points. Use plain, conversational language that matches their " +
        "personality. Only include what they could genuinely know or have witnessed. Where they " +
        "have gaps, write that naturally too (e.g. 'I didn't see what happened after that'). " +
        "Do NOT invent facts beyond what is provided.",
    },
    {
      role: "user",
      content:
        "Character and known facts:\n" +
        JSON.stringify(context, null, 2) +
        "\n\nReturn JSON: { \"brief\": string }. The brief is a first-person memory narrative " +
        "in the character's natural voice — written as how they would remember and describe events, " +
        "not as rules or instructions.",
    },
  ]);

  return {
    poiId: poi.id,
    name: poi.name,
    isDefendant: poi.isDefendant,
    brief: result.brief,
  };
}

export async function buildAllBriefs(story: TrueStory): Promise<POIBrief[]> {
  const briefs: POIBrief[] = [];
  for (const poi of story.pois) {
    briefs.push(await buildBrief(story, poi));
  }
  return briefs;
}
