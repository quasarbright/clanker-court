import { chatJSON } from "../llm/openrouter";
import type { CaseFile, ExamStage } from "../game/types";
import { objectionLabel } from "../game/objections";

// The judge rules on an objection. It is told the rules and the direct-exam scope.
export async function judgeRuling(
  caseFile: CaseFile,
  persona: string,
  stage: ExamStage,
  question: string,
  objectionReason: string,
  directSummary: string[],
): Promise<{ sustained: boolean; explanation: string }> {
  const rules =
    "RULES YOU ENFORCE:\n" +
    "- Leading questions: ONLY objectionable on DIRECT examination. On cross, leading is " +
    "ALWAYS allowed — overrule any 'leading' objection raised during cross.\n" +
    "- Scope: cross-examination is limited to topics covered on direct. Sustain 'out_of_scope' " +
    "ONLY if the question clearly goes beyond every topic in the direct summary. If any direct " +
    "topic is even loosely related, overrule.\n" +
    "- Hearsay: sustain only if the question literally asks what someone else said out of court " +
    "for the truth of the matter. A question about observable facts is NOT hearsay — overrule.\n" +
    "- Speculation: sustain only if the question asks the witness to guess about facts they " +
    "cannot possibly know. Asking about their own observations is NOT speculation — overrule.\n" +
    "- Relevance: sustain only if the question has zero conceivable connection to the charge. " +
    "Nearly everything related to the people or events in this case is relevant — overrule.\n" +
    "- Argumentative: sustain only if counsel is making a speech or badgering, not asking a " +
    "genuine question.\n" +
    "- Asked and answered: sustain only if the exact same question was already asked and answered " +
    "in this examination.\n" +
    "When in doubt and the question seems fair, overrule.";

  const result = await chatJSON<{ sustained: boolean; explanation: string }>([
    {
      role: "system",
      content: `You are the trial judge. Persona: ${persona}\n${rules}`,
    },
    {
      role: "user",
      content:
        `Charge: ${caseFile.charge}\n` +
        `Examination stage: ${stage}\n` +
        `Topics covered on direct (for scope rulings):\n` +
        (directSummary.length ? directSummary.map((s) => `- ${s}`).join("\n") : "(none yet)") +
        `\n\nThe attorney asked: "${question}"\n` +
        `Opposing counsel objects on grounds: ${objectionLabel(objectionReason)} (${objectionReason}).\n\n` +
        'Rule on the objection. Return JSON: { "sustained": boolean, "explanation": string } ' +
        "(explanation is one short sentence spoken from the bench).",
    },
  ]);
  return result;
}
