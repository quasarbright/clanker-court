const KEY_STORAGE = "clanker.openrouter.key";
const MODEL_STORAGE = "clanker.openrouter.model";

export const DEFAULT_MODEL = "openai/gpt-4o-mini";

export function getApiKey(): string {
  return localStorage.getItem(KEY_STORAGE) ?? "";
}

export function setApiKey(key: string): void {
  localStorage.setItem(KEY_STORAGE, key.trim());
}

export function clearApiKey(): void {
  localStorage.removeItem(KEY_STORAGE);
}

export function hasApiKey(): boolean {
  return getApiKey().length > 0;
}

export function getSavedModel(): string | null {
  return localStorage.getItem(MODEL_STORAGE);
}

export function saveModel(model: string): void {
  localStorage.setItem(MODEL_STORAGE, model.trim());
}

export function clearSavedModel(): void {
  localStorage.removeItem(MODEL_STORAGE);
}

// Runtime model — prefers localStorage (remembered), then sessionStorage (this session only), then default.
export function getModel(): string {
  return (
    localStorage.getItem(MODEL_STORAGE) ??
    sessionStorage.getItem("clanker.session.model") ??
    DEFAULT_MODEL
  );
}
