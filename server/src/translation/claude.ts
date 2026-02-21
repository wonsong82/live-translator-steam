import Anthropic from '@anthropic-ai/sdk';
import type { ITranslationEngine, TranslationResult } from './types.js';
import { TranslationError } from './types.js';
import { getLogger } from '../config/logger.js';

const SYSTEM_PROMPT = `You are a professional Korean-English translator. Translate the given text accurately while preserving:
- Formality register (반말/존댓말)
- Cultural context and idioms (translate meaning, not literal words)
- Natural English phrasing
Respond with ONLY the translated text. No explanations, no quotation marks.`;

export class ClaudeEngine implements ITranslationEngine {
  private readonly client: Anthropic;
  private readonly log = getLogger().child({ module: 'translation-claude' });

  constructor(apiKey: string, private readonly model = 'claude-sonnet-4-20250514') {
    this.client = new Anthropic({ apiKey });
  }

  async translate(text: string, sourceLang: string, targetLang: string): Promise<TranslationResult> {
    const start = Date.now();
    const direction = `${sourceLang} to ${targetLang}`;

    try {
      const response = await this.client.messages.create({
        model: this.model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: `Translate from ${direction}:\n${text}` },
        ],
      });

      const block = response.content[0];
      if (block?.type !== 'text' || !block.text) {
        throw new TranslationError('Empty Claude response', 'PROVIDER_ERROR', 'claude', true);
      }

      const latencyMs = Date.now() - start;
      this.log.debug({ sourceLang, targetLang, latencyMs, model: this.model }, 'Claude translation complete');

      return {
        sourceText: text,
        translatedText: block.text.trim(),
        engine: 'llm',
        latencyMs,
      };
    } catch (err) {
      if (err instanceof TranslationError) throw err;
      const error = err as Error & { status?: number };
      const code = error.status === 401 ? 'AUTH_ERROR' : error.status === 429 ? 'RATE_LIMIT' : 'PROVIDER_ERROR';
      throw new TranslationError(error.message, code, 'claude', code !== 'AUTH_ERROR');
    }
  }

  async destroy(): Promise<void> {
    return;
  }
}
