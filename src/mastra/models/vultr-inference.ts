import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

export function getVultrInferenceApiKey(): string | undefined {
  return (
    process.env.VULTR_INFERENCE_API_KEY ??
    process.env.VULTR_SERVERLESS_INFERENCE_API_KEY
  )?.trim();
}

export function getVultrInferenceConfigurationError(): string | undefined {
  if (getVultrInferenceApiKey()) {
    return undefined;
  }

  return 'Vultr Inference is not configured. Set VULTR_INFERENCE_API_KEY in .env, then restart the development server.';
}

const vultrInference = createOpenAICompatible({
  apiKey: getVultrInferenceApiKey(),
  baseURL: 'https://api.vultrinference.com/v1',
  name: 'vultrinference',
});

export const vultrInferenceModel = vultrInference('glm-5.3');

const DEFAULT_HEAVY_ANALYSIS_OUTPUT_TOKENS = 32_000;
const MAX_VULTR_OUTPUT_TOKENS = 160_000;

function getHeavyAnalysisOutputTokens() {
  const configuredValue = Number(process.env.VULTR_HEAVY_MAX_OUTPUT_TOKENS);

  if (
    !Number.isInteger(configuredValue) ||
    configuredValue < 1 ||
    configuredValue > MAX_VULTR_OUTPUT_TOKENS
  ) {
    return DEFAULT_HEAVY_ANALYSIS_OUTPUT_TOKENS;
  }

  return configuredValue;
}

export const vultrHeavyAnalysisOptions = {
  maxSteps: 20,
  modelSettings: {
    maxOutputTokens: getHeavyAnalysisOutputTokens(),
    temperature: 0.2,
  },
};
