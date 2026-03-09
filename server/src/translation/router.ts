import type { ITranslationEngine, TranslationProviderType, TranslationResult } from './types.js';
import type { EnvConfig } from '../config/index.js';
import { GoogleNmtEngine } from './nmt.js';
import { GoogleTllmEngine } from './llm.js';
import { ClaudeEngine } from './claude.js';
import { OpenAIEngine } from './openai.js';
import { QwenLocalEngine } from './qwen-local.js';

export interface TranslationRouter {
  translateInterim(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult>;
  translateFinal(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult>;
  destroy(): Promise<void>;
}

function createEngine(provider: TranslationProviderType, model: string, env: EnvConfig): ITranslationEngine {
  switch (provider) {
    case 'google':
      if (model === 'tllm') {
        return new GoogleTllmEngine(env.GOOGLE_TRANSLATION_PROJECT_ID ?? '', env.GOOGLE_TRANSLATION_LOCATION);
      }
      return new GoogleNmtEngine(env.GOOGLE_TRANSLATION_PROJECT_ID ?? '');
    case 'claude':
      return new ClaudeEngine(env.CLAUDE_API_KEY ?? '', model || undefined);
    case 'openai':
      return new OpenAIEngine(env.OPENAI_API_KEY ?? '', model || undefined);
    case 'qwen-local':
      return new QwenLocalEngine(env.QWEN_TRANSLATION_URL, model || env.QWEN_TRANSLATION_MODEL);
  }
}

export function createTranslationRouter(envConfig: EnvConfig): TranslationRouter {
  const interimEngine = createEngine(envConfig.TRANSLATION_INTERIM_PROVIDER, envConfig.TRANSLATION_INTERIM_MODEL, envConfig);
  const finalEngine = createEngine(envConfig.TRANSLATION_FINAL_PROVIDER, envConfig.TRANSLATION_FINAL_MODEL, envConfig);

  return {
    async translateInterim(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult> {
      return interimEngine.translate(text, sourceLang, targetLang);
    },

    async translateFinal(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult> {
      return finalEngine.translate(text, sourceLang, targetLang);
    },

    async destroy(): Promise<void> {
      await Promise.all([interimEngine.destroy(), finalEngine.destroy()]);
    },
  };
}
