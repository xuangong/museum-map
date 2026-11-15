/** Models the AI guide can run on, and the reasoning efforts each one accepts. */

export type AiFamily = "Claude" | "GPT" | "Grok" | "DeepSeek"

export interface AiModel {
  id: string
  family: AiFamily
  /** Short name shown in the picker. */
  label: string
  efforts: readonly string[]
}

export const AI_MODELS: readonly AiModel[] = [
  { id: "claude-opus-5.5", family: "Claude", label: "Opus 5.5", efforts: ["low", "medium", "high", "xhigh", "max"] },
  { id: "claude-sonnet-5.5", family: "Claude", label: "Sonnet 5.5", efforts: ["low", "medium", "high", "xhigh", "max"] },
  { id: "claude-haiku-5.5", family: "Claude", label: "Haiku 5.5", efforts: ["low", "medium", "high", "xhigh", "max"] },
  { id: "gpt-6-astra", family: "GPT", label: "GPT-6 Astra", efforts: ["low", "medium", "xhigh", "max", "ultra"] },
  { id: "gpt-6.1-sol", family: "GPT", label: "GPT-6.1 Sol", efforts: ["low", "medium", "xhigh", "max", "ultra"] },
  { id: "gpt-6.1-terra", family: "GPT", label: "GPT-6.1 Terra", efforts: ["low", "medium", "xhigh", "max", "ultra"] },
  { id: "gpt-6-luna", family: "GPT", label: "GPT-6 Luna", efforts: ["low", "medium", "xhigh", "max", "ultra"] },
  { id: "grok-4.7", family: "Grok", label: "Grok 4.7", efforts: ["low", "medium", "high", "xhigh"] },
  { id: "deepseek-v4-pro", family: "DeepSeek", label: "DeepSeek V4 Pro", efforts: ["low", "high", "max"] },
  { id: "deepseek-flash", family: "DeepSeek", label: "DeepSeek Flash", efforts: ["low", "high", "max"] },
]

export const DEFAULT_AI_MODEL = "gpt-6.1-sol"
export const DEFAULT_AI_EFFORT = "medium"

/** Validate a client's choice: unknown model → default; unsupported effort → medium, else the model's first. */
export function resolveAi(model: unknown, effort: unknown): { model: string; effort: string } {
  const m = AI_MODELS.find((x) => x.id === model) ?? AI_MODELS.find((x) => x.id === DEFAULT_AI_MODEL)!
  const e =
    typeof effort === "string" && m.efforts.includes(effort)
      ? effort
      : m.efforts.includes(DEFAULT_AI_EFFORT)
        ? DEFAULT_AI_EFFORT
        : m.efforts[0]!
  return { model: m.id, effort: e }
}

/** Each model on its native protocol: Claude speaks Anthropic Messages, the rest OpenAI chat completions. */
export function nativeProtocol(modelId: string): "anthropic" | "openai" {
  return AI_MODELS.find((x) => x.id === modelId)?.family === "Claude" || /^claude-/.test(modelId) ? "anthropic" : "openai"
}
