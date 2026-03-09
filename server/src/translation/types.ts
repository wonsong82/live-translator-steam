export interface TranslationResult {
  readonly sourceText: string;
  readonly translatedText: string;
  readonly engine: TranslationEngineType;
  readonly latencyMs: number;
}

export type TranslationEngineType = 'nmt' | 'llm';

export type TranslationProviderType = 'google' | 'claude' | 'openai' | 'qwen-local';

export interface ITranslationEngine {
  translate(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<TranslationResult>;

  destroy(): Promise<void>;
}

export type TranslationErrorCode =
  | 'PROVIDER_ERROR'
  | 'AUTH_ERROR'
  | 'RATE_LIMIT'
  | 'TIMEOUT'
  | 'UNKNOWN';

export class TranslationError extends Error {
  constructor(
    message: string,
    public readonly code: TranslationErrorCode,
    public readonly provider: string,
    public readonly recoverable: boolean,
  ) {
    super(message);
    this.name = 'TranslationError';
  }
}
