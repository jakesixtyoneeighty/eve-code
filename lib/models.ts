export const MODEL_OPTIONS = [
  { label: "GPT 5.6 Terra", value: "openai/gpt-5.6-terra" },
  { label: "Claude Sonnet 5", value: "anthropic/claude-sonnet-5" },
  { label: "Gemini 3.6 Flash", value: "google/gemini-3.6-flash" },
  { label: "Kimi K2.7 Code", value: "moonshotai/kimi-k2.7-code" },
] as const;

export type ModelId = (typeof MODEL_OPTIONS)[number]["value"];

export const DEFAULT_MODEL_ID: ModelId = MODEL_OPTIONS[0].value;
export const MODEL_HEADER = "x-eve-model";

export function isModelId(value: unknown): value is ModelId {
  return MODEL_OPTIONS.some((model) => model.value === value);
}
