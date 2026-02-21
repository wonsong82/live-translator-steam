import { v3 } from '@google-cloud/translate';
import type { ITranslationEngine, TranslationResult } from './types.js';
import { TranslationError } from './types.js';
import { getLogger } from '../config/logger.js';

const { TranslationServiceClient } = v3;

export class GoogleNmtEngine implements ITranslationEngine {
  private readonly client: InstanceType<typeof TranslationServiceClient>;
  private readonly parent: string;
  private readonly log = getLogger().child({ module: 'translation-nmt' });

  constructor(projectId: string, location = 'global') {
    this.client = new TranslationServiceClient();
    this.parent = `projects/${projectId}/locations/${location}`;
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
      });

      const translation = response.translations?.[0];
      if (!translation?.translatedText) {
        throw new TranslationError('Empty NMT response', 'PROVIDER_ERROR', 'google-nmt', true);
      }

      const latencyMs = Date.now() - start;
      this.log.debug({ sourceLang, targetLang, latencyMs }, 'NMT translation complete');

      return {
        sourceText: text,
        translatedText: translation.translatedText,
        engine: 'nmt',
        latencyMs,
      };
    } catch (err) {
      if (err instanceof TranslationError) throw err;
      const error = err as Error;
      throw new TranslationError(error.message, 'PROVIDER_ERROR', 'google-nmt', true);
    }
  }

  async destroy(): Promise<void> {
    await this.client.close();
  }
}
