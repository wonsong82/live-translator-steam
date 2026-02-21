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

  TRANSLATION_INTERIM_PROVIDER: z.enum(['google-nmt', 'google-tllm', 'claude', 'qwen-local']).default('google-nmt'),
  TRANSLATION_FINAL_PROVIDER: z.enum(['google-nmt', 'google-tllm', 'claude', 'qwen-local']).default('google-tllm'),
  TRANSLATION_INTERIM_MODEL: z.string().optional(),
  TRANSLATION_FINAL_MODEL: z.string().optional(),
  CLAUDE_API_KEY: z.string().optional(),
  GOOGLE_TRANSLATION_PROJECT_ID: z.string().optional(),
  GOOGLE_TRANSLATION_LOCATION: z.string().default('us-central1'),
  QWEN_TRANSLATION_URL: z.string().default('http://localhost:8002/v1'),
  QWEN_TRANSLATION_MODEL: z.string().default('Qwen/Qwen3-30B-A3B'),

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
  readonly translationInterimProvider: TranslationProviderType;
  readonly translationInterimModel?: string;
  readonly translationFinalProvider: TranslationProviderType;
  readonly translationFinalModel?: string;
}

export function resolveProviderConfig(env: EnvConfig): ServerProviderConfig {
  return {
    asrProvider: env.ASR_PROVIDER,
    asrModel: env.ASR_MODEL,
    translationInterimProvider: env.TRANSLATION_INTERIM_PROVIDER,
    translationInterimModel: env.TRANSLATION_INTERIM_MODEL,
    translationFinalProvider: env.TRANSLATION_FINAL_PROVIDER,
    translationFinalModel: env.TRANSLATION_FINAL_MODEL,
  };
}
