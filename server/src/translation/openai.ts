import OpenAI from 'openai';
import type { ITranslationEngine, TranslationResult } from './types.js';
import { TranslationError } from './types.js';
import { getLogger } from '../config/logger.js';

const SYSTEM_PROMPT = `You are a professional Korean-English translator. Translate the given text accurately while preserving:
- Formality register (반말/존댓말)
- Cultural context and idioms (translate meaning, not literal words)
- Natural English phrasing
Respond with ONLY the translated text. No explanations, no quotation marks.`;

export class OpenAIEngine implements ITranslationEngine {
  private readonly client: OpenAI;
  private readonly log = getLogger().child({ module: 'translation-openai' });

  constructor(apiKey: string, private readonly model = 'gpt-4.1-mini') {
    this.client = new OpenAI({ apiKey });
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult> {
    const start = Date.now();
    const direction = `${sourceLang} to ${targetLang}`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        max_tokens: 1024,
        temperature: 0.3,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Translate from ${direction}:\n${text}` },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new TranslationError('Empty OpenAI response', 'PROVIDER_ERROR', 'openai', true);
      }

      const latencyMs = Date.now() - start;
      this.log.debug({ sourceLang, targetLang, latencyMs, model: this.model }, 'OpenAI translation complete');

      return {
        sourceText: text,
        translatedText: content.trim(),
        engine: 'llm',
        latencyMs,
      };
    } catch (err) {
      if (err instanceof TranslationError) throw err;
      const error = err as Error & { status?: number };
      const code = error.status === 401 ? 'AUTH_ERROR' : error.status === 429 ? 'RATE_LIMIT' : 'PROVIDER_ERROR';
      throw new TranslationError(error.message, code, 'openai', code !== 'AUTH_ERROR');
    }
  }

  async destroy(): Promise<void> {
    return;
  }
}
