import type { ITranslationEngine, TranslationResult } from './types.js';
import { TranslationError } from './types.js';
import { getLogger } from '../config/logger.js';

const SYSTEM_PROMPT = `You are a professional Korean-English translator. Translate the given text accurately while preserving:
- Formality register (반말/존댓말)
- Cultural context and idioms (translate meaning, not literal words)
- Natural English phrasing
Respond with ONLY the translated text. No explanations, no quotation marks.`;

interface ChatCompletionResponse {
  readonly choices: ReadonlyArray<{
    readonly message: {
      readonly content: string;
    };
  }>;
}

export class QwenLocalEngine implements ITranslationEngine {
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly log = getLogger().child({ module: 'translation-qwen-local' });

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.model = model;
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult> {
    const start = Date.now();
    const direction = `${sourceLang} to ${targetLang}`;
    const url = `${this.baseUrl}/chat/completions`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: `Translate from ${direction}:\n${text}` },
          ],
          max_tokens: 1024,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new TranslationError(
          `Qwen local API returned ${response.status}: ${body}`,
          response.status === 429 ? 'RATE_LIMIT' : 'PROVIDER_ERROR',
          'qwen-local',
          true,
        );
      }

      const data = (await response.json()) as ChatCompletionResponse;
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new TranslationError('Empty response from Qwen local', 'PROVIDER_ERROR', 'qwen-local', true);
      }

      const latencyMs = Date.now() - start;
      this.log.debug({ sourceLang, targetLang, latencyMs, model: this.model }, 'Qwen local translation complete');

      return {
        sourceText: text,
        translatedText: content.trim(),
        engine: 'llm',
        latencyMs,
      };
    } catch (err) {
      if (err instanceof TranslationError) throw err;
      const error = err as Error;
      throw new TranslationError(error.message, 'PROVIDER_ERROR', 'qwen-local', true);
    }
  }

  async destroy(): Promise<void> {
    return;
  }
}
