import type { ITranslationEngine, TranslationResult } from './types.js';
import type { EnvConfig } from '../config/index.js';
import { GoogleNmtEngine } from './nmt.js';
import { GoogleTllmEngine } from './llm.js';
import { ClaudeEngine } from './claude.js';

export interface TranslationRouter {
  translateInterim(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult>;
  translateFinal(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult>;
  destroy(): Promise<void>;
}

export function createTranslationRouter(envConfig: EnvConfig): TranslationRouter {
  const projectId = envConfig.GOOGLE_TRANSLATION_PROJECT_ID ?? '';
  const location = envConfig.GOOGLE_TRANSLATION_LOCATION;

  const nmtEngine: ITranslationEngine = new GoogleNmtEngine(projectId);

  let llmEngine: ITranslationEngine;
  if (envConfig.TRANSLATION_LLM_PROVIDER === 'claude') {
    llmEngine = new ClaudeEngine(envConfig.CLAUDE_API_KEY ?? '');
  } else {
    llmEngine = new GoogleTllmEngine(projectId, location);
  }

  return {
    async translateInterim(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult> {
      return nmtEngine.translate(text, sourceLang, targetLang);
    },

    async translateFinal(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult> {
      return llmEngine.translate(text, sourceLang, targetLang);
    },

    async destroy(): Promise<void> {
      await Promise.all([nmtEngine.destroy(), llmEngine.destroy()]);
    },
  };
}
