import { chatJSON } from "../llm/openrouter";
import type { CaseFile, Personas, Role } from "../game/types";

// Creates the judge, jury, and opposing-counsel personas, seeded only with the case file.
export async function buildPersonas(caseFile: CaseFile, playerRole: Role): Promise<Personas> {
  const opposingSide = playerRole === "prosecutor" ? "defense attorney" : "prosecutor";

  const personas = await chatJSON<Personas>([
    {
      role: "system",
      content:
        "You are the Court Character Creator. Using only the case file, write short, vivid " +
        "persona descriptions for the judge, the jury (as a collective body), and the opposing " +
        "counsel. These personas guide how each will behave during the trial.",
    },
    {
      role: "user",
      content:
        "Case file:\n" +
        JSON.stringify(caseFile, null, 2) +
        `\n\nThe human player is the ${playerRole}. The opposing counsel is the ${opposingSide}.\n` +
        'Return JSON: { "judge": string, "jury": string, "opposingCounsel": string }',
    },
  ]);

  return personas;
}
