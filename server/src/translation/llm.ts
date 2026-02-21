import { v3 } from '@google-cloud/translate';
import type { ITranslationEngine, TranslationResult } from './types.js';
import { TranslationError } from './types.js';
import { getLogger } from '../config/logger.js';

const { TranslationServiceClient } = v3;

export class GoogleTllmEngine implements ITranslationEngine {
  private readonly client: InstanceType<typeof TranslationServiceClient>;
  private readonly parent: string;
  private readonly modelPath: string;
  private readonly log = getLogger().child({ module: 'translation-tllm' });

  constructor(projectId: string, location = 'us-central1') {
    this.client = new TranslationServiceClient();
    this.parent = `projects/${projectId}/locations/${location}`;
    this.modelPath = `${this.parent}/models/general/translation-llm`;
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult> {
    const start = Date.now();

    try {
      const [response] = await this.client.translateText({
        parent: this.parent,
        contents: [text],
        mimeType: 'text/plain',
        sourceLanguageCode: sourceLang,
        targetLanguageCode: targetLang,
        model: this.modelPath,
      });

      const translation = response.translations?.[0];
      if (!translation?.translatedText) {
        throw new TranslationError('Empty TLLM response', 'PROVIDER_ERROR', 'google-tllm', true);
      }

      const latencyMs = Date.now() - start;
      this.log.debug({ sourceLang, targetLang, latencyMs }, 'TLLM translation complete');

      return {
        sourceText: text,
        translatedText: translation.translatedText,
        engine: 'llm',
        latencyMs,
      };
    } catch (err) {
      if (err instanceof TranslationError) throw err;
      const error = err as Error;
      throw new TranslationError(error.message, 'PROVIDER_ERROR', 'google-tllm', true);
    }
  }

  async destroy(): Promise<void> {
    await this.client.close();
  }
}
