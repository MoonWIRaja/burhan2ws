/**
 * AI Model Pricing Database
 * Prices are in USD per 1M tokens
 * Source: Official provider pricing (as of 2024-2025)
 */

export interface ModelPricing {
  inputPrice: number;  // USD per 1M input tokens
  outputPrice: number; // USD per 1M output tokens
  provider: string;
}

export const AI_MODEL_PRICING: Record<string, ModelPricing> = {
  // ========== OpenAI ==========
  "gpt-4o": { inputPrice: 2.50, outputPrice: 10.00, provider: "OpenAI" },
  "gpt-4o-mini": { inputPrice: 0.15, outputPrice: 0.60, provider: "OpenAI" },
  "gpt-4-turbo": { inputPrice: 10.00, outputPrice: 30.00, provider: "OpenAI" },
  "gpt-4": { inputPrice: 30.00, outputPrice: 60.00, provider: "OpenAI" },
  "gpt-3.5-turbo": { inputPrice: 0.50, outputPrice: 1.50, provider: "OpenAI" },
  "o1-preview": { inputPrice: 15.00, outputPrice: 60.00, provider: "OpenAI" },
  "o1-mini": { inputPrice: 1.10, outputPrice: 4.40, provider: "OpenAI" },

  // ========== Anthropic Claude ==========
  "claude-sonnet-4-20250514": { inputPrice: 3.00, outputPrice: 15.00, provider: "Anthropic" },
  "claude-3-5-sonnet-20241022": { inputPrice: 3.00, outputPrice: 15.00, provider: "Anthropic" },
  "claude-3-5-sonnet-20240620": { inputPrice: 3.00, outputPrice: 15.00, provider: "Anthropic" },
  "claude-3-5-haiku-20241022": { inputPrice: 0.80, outputPrice: 4.00, provider: "Anthropic" },
  "claude-3-opus-20240229": { inputPrice: 15.00, outputPrice: 75.00, provider: "Anthropic" },
  "claude-3-sonnet-20240229": { inputPrice: 3.00, outputPrice: 15.00, provider: "Anthropic" },
  "claude-3-haiku-20240307": { inputPrice: 0.25, outputPrice: 1.25, provider: "Anthropic" },

  // ========== Google Gemini ==========
  "gemini-2.0-flash-exp": { inputPrice: 0.075, outputPrice: 0.30, provider: "Google" },
  "gemini-2.0-flash-thinking-exp": { inputPrice: 0.075, outputPrice: 0.30, provider: "Google" },
  "gemini-1.5-pro": { inputPrice: 1.25, outputPrice: 5.00, provider: "Google" },
  "gemini-1.5-flash": { inputPrice: 0.075, outputPrice: 0.30, provider: "Google" },
  "gemini-1.0-pro": { inputPrice: 0.50, outputPrice: 1.50, provider: "Google" },

  // ========== Groq ==========
  "llama-3.3-70b-versatile": { inputPrice: 0.59, outputPrice: 0.59, provider: "Groq" },
  "llama-3.1-70b-versatile": { inputPrice: 0.59, outputPrice: 0.59, provider: "Groq" },
  "mixtral-8x7b-32768": { inputPrice: 0.24, outputPrice: 0.24, provider: "Groq" },
  "gemma-7b-it": { inputPrice: 0.07, outputPrice: 0.07, provider: "Groq" },

  // ========== DeepSeek ==========
  "deepseek-chat": { inputPrice: 0.14, outputPrice: 0.28, provider: "DeepSeek" },
  "deepseek-coder": { inputPrice: 0.14, outputPrice: 0.28, provider: "DeepSeek" },
  "deepseek-reasoner": { inputPrice: 0.57, outputPrice: 5.70, provider: "DeepSeek" },

  // ========== Perplexity ==========
  "sonar-small-online": { inputPrice: 0.20, outputPrice: 0.20, provider: "Perplexity" },
  "sonar-medium-online": { inputPrice: 1.00, outputPrice: 1.00, provider: "Perplexity" },

  // ========== xAI Grok ==========
  "grok-beta": { inputPrice: 5.00, outputPrice: 5.00, provider: "xAI" },

  // ========== Mistral AI ==========
  "mistral-large-2407": { inputPrice: 2.00, outputPrice: 6.00, provider: "Mistral" },
  "mistral-large-2402": { inputPrice: 4.00, outputPrice: 12.00, provider: "Mistral" },
  "mixtral-8x7b": { inputPrice: 0.50, outputPrice: 0.50, provider: "Mistral" },
  "mistral-7b": { inputPrice: 0.17, outputPrice: 0.17, provider: "Mistral" },
  "codestral": { inputPrice: 0.79, outputPrice: 0.79, provider: "Mistral" },

  // ========== Cohere ==========
  "command-r-plus": { inputPrice: 3.00, outputPrice: 15.00, provider: "Cohere" },
  "command-r": { inputPrice: 0.50, outputPrice: 1.50, provider: "Cohere" },

  // ========== Replicate ==========
  "meta-llama-3.1-405b-instruct": { inputPrice: 0.70, outputPrice: 0.70, provider: "Meta" },
  "meta-llama-3.1-70b-instruct": { inputPrice: 0.13, outputPrice: 0.13, provider: "Meta" },
  "mistralai/mistral-7b-instruct": { inputPrice: 0.07, outputPrice: 0.07, provider: "Mistral" },

  // ========== Zhipu AI GLM ==========
  "glm-4": { inputPrice: 0.07, outputPrice: 0.28, provider: "Zhipu AI" },
  "glm-4-plus": { inputPrice: 0.10, outputPrice: 0.40, provider: "Zhipu AI" },
  "glm-4-air": { inputPrice: 0.01, outputPrice: 0.04, provider: "Zhipu AI" },
  "glm-4-flash": { inputPrice: 0.01, outputPrice: 0.04, provider: "Zhipu AI" },
  "glm-4.7": { inputPrice: 0.07, outputPrice: 0.28, provider: "Zhipu AI" },
  "glm-3-turbo": { inputPrice: 0.05, outputPrice: 0.25, provider: "Zhipu AI" },
};

/**
 * Find pricing for a model name
 * Supports partial matching (e.g., "gpt-4o" matches "gpt-4o")
 */
export function getModelPricing(modelName: string): ModelPricing | null {
  // Exact match
  if (AI_MODEL_PRICING[modelName]) {
    return AI_MODEL_PRICING[modelName];
  }

  // Partial match (for models with version suffixes)
  for (const [key, pricing] of Object.entries(AI_MODEL_PRICING)) {
    if (modelName.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(modelName.toLowerCase())) {
      return pricing;
    }
  }

  // Try to match by provider prefix
  const lowerModel = modelName.toLowerCase();
  if (lowerModel.includes("gpt")) return { inputPrice: 2.50, outputPrice: 10.00, provider: "OpenAI (est)" };
  if (lowerModel.includes("claude")) return { inputPrice: 3.00, outputPrice: 15.00, provider: "Anthropic (est)" };
  if (lowerModel.includes("gemini")) return { inputPrice: 1.25, outputPrice: 5.00, provider: "Google (est)" };
  if (lowerModel.includes("llama")) return { inputPrice: 0.70, outputPrice: 0.70, provider: "Meta (est)" };
  if (lowerModel.includes("mistral")) return { inputPrice: 0.50, outputPrice: 0.50, provider: "Mistral (est)" };
  if (lowerModel.includes("deepseek")) return { inputPrice: 0.14, outputPrice: 0.28, provider: "DeepSeek (est)" };
  if (lowerModel.includes("grok")) return { inputPrice: 5.00, outputPrice: 5.00, provider: "xAI (est)" };
  if (lowerModel.includes("mixtral")) return { inputPrice: 0.24, outputPrice: 0.24, provider: "Mistral (est)" };
  if (lowerModel.includes("gemma")) return { inputPrice: 0.07, outputPrice: 0.07, provider: "Google (est)" };
  if (lowerModel.includes("glm")) return { inputPrice: 0.07, outputPrice: 0.28, provider: "Zhipu AI (est)" };

  return null;
}

/**
 * Get popular model names for autocomplete
 */
export function getPopularModelNames(): string[] {
  return [
    "gpt-4o",
    "gpt-4o-mini",
    "gpt-3.5-turbo",
    "claude-3-5-sonnet-20241022",
    "claude-3-5-haiku-20241022",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
    "deepseek-chat",
    "llama-3.1-70b-instruct",
    "mixtral-8x7b",
  ];
}
