import { z } from 'zod';
import type { ASRProviderType } from '../asr/types.js';
import type { TranslationProviderType } from '../translation/types.js';

const envSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  ASR_PROVIDER: z.enum(['google', 'deepgram', 'openai', 'qwen3-asr']).default('deepgram'),
  ASR_MODEL: z.string().optional(),

  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  DEEPGRAM_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),

  TRANSLATION_NMT_PROVIDER: z.enum(['google']).default('google'),
  TRANSLATION_LLM_PROVIDER: z.enum(['google', 'claude']).default('google'),
  TRANSLATION_LLM_MODEL: z.string().optional(),
  CLAUDE_API_KEY: z.string().optional(),
  GOOGLE_TRANSLATION_PROJECT_ID: z.string().optional(),
  GOOGLE_TRANSLATION_LOCATION: z.string().default('us-central1'),

  QWEN3_ASR_ENABLED: z.coerce.boolean().default(false),
  QWEN3_ASR_HOST: z.string().default('qwen3-asr'),
  QWEN3_ASR_PORT: z.coerce.number().default(8001),

  REDIS_URL: z.string().default('redis://localhost:6379'),
  DATABASE_URL: z.string().default('postgresql://user:pass@localhost:5432/translate'),
});

export type EnvConfig = z.infer<typeof envSchema>;

let cachedConfig: EnvConfig | null = null;

export function loadConfig(): EnvConfig {
  if (cachedConfig) return cachedConfig;
  cachedConfig = envSchema.parse(process.env);
  return cachedConfig;
}

export interface ServerProviderConfig {
  readonly asrProvider: ASRProviderType;
  readonly asrModel?: string;
  readonly translationNmtProvider: 'google';
  readonly translationLlmProvider: TranslationProviderType;
  readonly translationLlmModel?: string;
}

export function resolveProviderConfig(env: EnvConfig): ServerProviderConfig {
  return {
    asrProvider: env.ASR_PROVIDER,
    asrModel: env.ASR_MODEL,
    translationNmtProvider: env.TRANSLATION_NMT_PROVIDER,
    translationLlmProvider: env.TRANSLATION_LLM_PROVIDER,
    translationLlmModel: env.TRANSLATION_LLM_MODEL,
  };
}
