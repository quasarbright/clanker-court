// Minimal client for OpenRouter's OpenAI-compatible chat completions endpoint.
// All calls happen client-side using the user's stored API key.

import { getApiKey, getModel } from "../store/settings";

// Set to true to skip real API calls and return placeholder responses (for UI dev/testing).
const DEV_BYPASS = false;

const DEV_CHAT_RESPONSE = "Placeholder counsel statement. The evidence clearly supports my client's position and the jury should return a verdict in our favor.";

// chatJSON returns this object for every call — it must satisfy all agent return shapes
// simultaneously since we use a single bypass response.
const DEV_JSON_RESPONSE: Record<string, unknown> = {
  // storyGenerator → TrueStory
  title: "The Placeholder Affair",
  charge: "Murder in the First Degree",
  defendantId: "p1",
  groundTruthGuilty: true,
  crime: "John Doe poisoned Victor Grant at the Harlow Hotel after a business dispute over stolen patents.",
  pois: [
    { id: "p1", name: "John Doe", role: "Defendant", personality: "Nervous and evasive", relationships: { "p2": "Former business partner", "p3": "Acquaintance" }, isDefendant: true, isWitness: false, witnessed: ["I was at the hotel that night.", "I had a drink with Victor."] },
    { id: "p2", name: "Jane Smith", role: "Hotel bartender", personality: "Observant and direct", relationships: { "p1": "Regular customer", "p3": "Coworker" }, isDefendant: false, isWitness: true, witnessed: ["I saw the defendant arguing with the victim at the bar.", "The defendant ordered two drinks and carried them both away."] },
    { id: "p3", name: "Marcus Webb", role: "Hotel security guard", personality: "By-the-book, cautious", relationships: { "p1": "Recognized him from past visits", "p2": "Colleague" }, isDefendant: false, isWitness: true, witnessed: ["I saw the defendant leave the victim's room at 11:43 PM.", "The victim was found unresponsive at midnight."] },
  ],
  timeline: [
    { time: "9:00 PM", event: "John Doe checks into the Harlow Hotel." },
    { time: "10:15 PM", event: "Doe and Victor Grant seen arguing in the hotel bar." },
    { time: "11:40 PM", event: "Doe enters Grant's room." },
    { time: "11:43 PM", event: "Doe exits Grant's room." },
    { time: "12:00 AM", event: "Grant found unresponsive by hotel staff. Pronounced dead at the scene." },
  ],
  evidence: [
    { name: "Poison vial", description: "A small glass vial containing traces of potassium cyanide, found in Doe's jacket pocket.", inPolicePossession: true, reason: "Recovered during arrest search." },
    { name: "Hotel security footage", description: "CCTV showing Doe entering and exiting Grant's room.", inPolicePossession: true, reason: "Obtained from hotel management." },
    { name: "Threatening email", description: "An email from Doe to Grant reading 'You'll regret stealing from me', sent two days before the death.", inPolicePossession: true, reason: "Retrieved from Grant's inbox." },
  ],

  // poiBuilder → { brief }
  brief: "I remember that night clearly. I was at the hotel — I had every right to be there. Victor and I had unfinished business about the patents, yes, but I didn't kill him. When I left his room he was fine, sitting up in bed. Whatever happened after I left, I didn't do it.",

  // police → CaseFile fields
  summary: "Victor Grant, 54, was found dead in his hotel room at the Harlow Hotel. The medical examiner confirmed death by cyanide poisoning. Defendant John Doe was seen entering the victim's room minutes before the body was discovered and was found in possession of a cyanide vial at time of arrest.",
  knownFacts: [
    "Victim died of cyanide poisoning between 11:43 PM and 12:00 AM.",
    "Defendant was the last known person to enter the victim's room.",
    "A cyanide vial was recovered from the defendant's jacket.",
    "Security footage places the defendant outside the victim's room at 11:43 PM.",
    "Witnesses observed the defendant and victim arguing earlier that evening.",
  ],
  openQuestions: [
    "How did the poison enter the victim's system?",
    "Was anyone else present in the hotel room?",
    "What was the nature of the business dispute between defendant and victim?",
  ],

  // court → Personas
  judge: "Judge Patricia Hollis — stern, procedurally exacting, intolerant of theatrics. She runs a tight courtroom and expects counsel to know the rules.",
  jury: "A mixed panel: two retired professionals, a teacher, a small business owner, and several working adults. Generally skeptical of circumstantial evidence but swayed by clear physical proof.",
  opposingCounsel: "Assistant DA Raymond Cross — methodical, confident, and aggressive on cross-examination. He never asks a question he doesn't already know the answer to.",

  // judge → { sustained, explanation }
  sustained: false,
  explanation: "Objection overruled — the question goes to the witness's direct observations.",

  // counsel question → { done, question }
  done: false,
  question: "Isn't it true that you saw the defendant carrying two drinks away from the bar that night?",

  // counsel objection → { object, reason }
  object: false,
  reason: "",

  // jury → Verdict
  guilty: true,
  rationale: "The jury finds the defendant guilty. The physical evidence — the cyanide vial found on the defendant's person, combined with eyewitness testimony placing him at the scene immediately before the victim's death — establishes guilt beyond a reasonable doubt.",
};

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  jsonMode?: boolean;
  model?: string;
  maxTokens?: number;
}

export class OpenRouterError extends Error {}

export async function chat(messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  if (DEV_BYPASS) {
    console.log("[DEV_BYPASS] chat called, returning placeholder.");
    return DEV_CHAT_RESPONSE;
  }
  const key = getApiKey();
  if (!key) throw new OpenRouterError("No OpenRouter API key set.");

  const body: Record<string, unknown> = {
    model: opts.model ?? getModel(),
    messages,
    temperature: opts.temperature ?? 0.8,
  };
  if (opts.jsonMode) {
    body.response_format = { type: "json_object" };
  }
  if (opts.maxTokens) {
    body.max_tokens = opts.maxTokens;
  }

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": location.origin,
        "X-Title": "Clanker Court",
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new OpenRouterError(`Network error reaching OpenRouter: ${(e as Error).message}`);
  }

  if (!res.ok) {
    let detail = "";
    try {
      const j = await res.json();
      detail = j?.error?.message ?? JSON.stringify(j);
    } catch {
      detail = await res.text().catch(() => "");
    }
    if (res.status === 401) throw new OpenRouterError("Invalid OpenRouter API key (401).");
    if (res.status === 402) throw new OpenRouterError("Insufficient OpenRouter credits (402).");
    if (res.status === 429) throw new OpenRouterError("Rate limited by OpenRouter (429). Try again shortly.");
    throw new OpenRouterError(`OpenRouter error ${res.status}: ${detail}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string") {
    throw new OpenRouterError("OpenRouter returned an unexpected response shape.");
  }
  return text;
}

// Strip code fences / prose and parse the outermost JSON object or array.
function extractJSON(raw: string): unknown {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  // Find first { or [ and matching last } or ]
  const start = s.search(/[{[]/);
  if (start === -1) throw new OpenRouterError("Model did not return JSON.");
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  const end = s.lastIndexOf(close);
  if (end <= start) throw new OpenRouterError("Model returned malformed JSON.");
  const slice = s.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch (e) {
    console.error("[openrouter] Raw model output that failed to parse:\n", raw);
    throw new OpenRouterError(`Failed to parse model JSON: ${(e as Error).message}`);
  }
}

export async function chatJSON<T>(messages: ChatMessage[], opts: ChatOptions = {}): Promise<T> {
  const augmented: ChatMessage[] = [
    ...messages,
    { role: "system", content: "Respond with valid JSON only. No prose, no code fences." },
  ];
  if (DEV_BYPASS) {
    console.log("[DEV_BYPASS] chatJSON called, returning placeholder.");
    return DEV_JSON_RESPONSE as T;
  }
  const maxAttempts = 3;
  let lastErr: Error = new OpenRouterError("Unknown error");
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const raw = await chat(augmented, { ...opts, jsonMode: true, temperature: opts.temperature ?? 0.9 });
    try {
      return extractJSON(raw) as T;
    } catch (e) {
      lastErr = e as Error;
      console.warn(`[openrouter] JSON parse failed (attempt ${attempt}/${maxAttempts}):`, (e as Error).message);
    }
  }
  throw lastErr;
}
