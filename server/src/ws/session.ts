import type { WebSocket } from 'ws';
import type { IASRProvider, ASRProviderConfig, TranscriptResult } from '../asr/types.js';
import type { EnvConfig, ServerProviderConfig } from '../config/index.js';
import type { TranslationRouter } from '../translation/router.js';
import { getLogger } from '../config/logger.js';

interface SessionConfig {
  readonly ws: WebSocket;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly mode: 'hybrid' | 'final-only';
  readonly providerConfig: ServerProviderConfig;
  readonly envConfig: EnvConfig;
  readonly asrProviderFactory: (config: ServerProviderConfig, envConfig: EnvConfig) => IASRProvider;
  readonly translationRouter: TranslationRouter;
}

export class Session {
  private readonly ws: WebSocket;
  private readonly log = getLogger().child({ module: 'session' });
  private readonly providerConfig: ServerProviderConfig;
  private readonly envConfig: EnvConfig;
  private readonly asrProviderFactory: SessionConfig['asrProviderFactory'];
  private readonly translationRouter: TranslationRouter;

  private sourceLanguage: string;
  private targetLanguage: string;
  private mode: 'hybrid' | 'final-only';
  private asrProvider: IASRProvider | null = null;
  private sentenceIndex = 0;
  private interimEpoch = 0;
  private alive = true;

  constructor(config: SessionConfig) {
    this.ws = config.ws;
    this.sourceLanguage = config.sourceLanguage;
    this.targetLanguage = config.targetLanguage;
    this.mode = config.mode;
    this.providerConfig = config.providerConfig;
    this.envConfig = config.envConfig;
    this.asrProviderFactory = config.asrProviderFactory;
    this.translationRouter = config.translationRouter;
  }

  async start(): Promise<void> {
    this.asrProvider = this.asrProviderFactory(this.providerConfig, this.envConfig);

    this.asrProvider.onTranscript((result) => this.handleTranscript(result));
    this.asrProvider.onError((err) => {
      this.log.error({ err, provider: this.providerConfig.asrProvider }, 'ASR error');
      this.send({ type: 'error', code: err.code, message: err.message });
    });
    this.asrProvider.onConnectionStateChange((state) => {
      this.log.info({ state, provider: this.providerConfig.asrProvider }, 'ASR state change');
      if (state === 'connected') {
        this.send({ type: 'session.status', status: 'connected' });
      } else if (state === 'reconnecting') {
        this.send({ type: 'session.status', status: 'reconnecting' });
      } else if (state === 'error') {
        this.send({ type: 'session.status', status: 'error' });
      }
    });

    const asrConfig: ASRProviderConfig = {
      provider: this.providerConfig.asrProvider,
      language: this.sourceLanguage,
      model: this.providerConfig.asrModel,
    };

    await this.asrProvider.connect(asrConfig);
    this.log.info({ provider: this.providerConfig.asrProvider, language: this.sourceLanguage }, 'session started');
  }

  sendAudio(chunk: Buffer): void {
    this.asrProvider?.sendAudio(chunk);
  }

  updateConfig(config: { sourceLanguage?: string; targetLanguage?: string; mode?: string }): void {
    if (config.sourceLanguage) this.sourceLanguage = config.sourceLanguage;
    if (config.targetLanguage) this.targetLanguage = config.targetLanguage;
    if (config.mode === 'hybrid' || config.mode === 'final-only') this.mode = config.mode;
    this.log.info({ sourceLanguage: this.sourceLanguage, targetLanguage: this.targetLanguage, mode: this.mode }, 'session config updated');
  }

  async stop(): Promise<void> {
    if (this.asrProvider) {
      await this.asrProvider.disconnect();
      this.asrProvider = null;
    }
    this.log.info('session stopped');
  }

  isAlive(): boolean {
    return this.alive;
  }

  markAlive(): void {
    this.alive = true;
  }

  markDead(): void {
    this.alive = false;
  }

  private handleTranscript(result: TranscriptResult): void {
    if (!result.text) return;

    if (!result.isFinal) {
      this.send({
        type: 'transcription.interim',
        text: result.text,
        language: result.language,
        timestamp: result.timestamp,
        confidence: result.confidence,
      });

      if (this.mode === 'hybrid') {
        this.translateInterim(result.text);
      }
    } else {
      this.interimEpoch++;
      const idx = this.sentenceIndex++;
      this.send({
        type: 'transcription.final',
        text: result.text,
        language: result.language,
        timestamp: result.timestamp,
        confidence: result.confidence,
        sentenceIndex: idx,
      });

      this.translateFinal(result.text, idx);
    }
  }

  private translateInterim(text: string): void {
    const epoch = this.interimEpoch;
    this.translationRouter
      .translateInterim(text, this.sourceLanguage, this.targetLanguage)
      .then((result) => {
        if (epoch !== this.interimEpoch) return;
        this.send({
          type: 'translation.interim',
          sourceText: result.sourceText,
          translatedText: result.translatedText,
          sentenceIndex: null,
        });
      })
      .catch((err: unknown) => {
        this.log.error({ err }, 'interim translation failed');
      });
  }

  private translateFinal(text: string, sentenceIndex: number): void {
    this.translationRouter
      .translateFinal(text, this.sourceLanguage, this.targetLanguage)
      .then((result) => {
        this.send({
          type: 'translation.final',
          sourceText: result.sourceText,
          translatedText: result.translatedText,
          sentenceIndex,
        });
      })
      .catch((err: unknown) => {
        this.log.error({ err, sentenceIndex }, 'final translation failed');
      });
  }

  private send(message: Record<string, unknown>): void {
    if (this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(message));
    }
  }
}
