// Minimal client for OpenRouter's OpenAI-compatible chat completions endpoint.
// All calls happen client-side using the user's stored API key.

import { getApiKey, getModel } from "../store/settings";

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
  const raw = await chat(augmented, { ...opts, jsonMode: true, temperature: opts.temperature ?? 0.9 });
  return extractJSON(raw) as T;
}
