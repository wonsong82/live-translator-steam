export interface TranscriptResult {
  readonly text: string;
  readonly isFinal: boolean;
  readonly confidence: number;
  readonly language: string;
  readonly timestamp: number;
  readonly metadata?: Record<string, unknown>;
}

export interface ASRProviderConfig {
  readonly provider: ASRProviderType;
  readonly apiKey?: string;
  readonly region?: string;
  readonly model?: string;
  readonly language: string;
  readonly options?: Record<string, unknown>;
}

export type ASRProviderType = 'google' | 'deepgram' | 'openai' | 'qwen-local';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface IASRProvider {
  connect(config: ASRProviderConfig): Promise<void>;
  disconnect(): Promise<void>;
  sendAudio(audioChunk: Buffer): void;
  onTranscript(callback: (result: TranscriptResult) => void): void;
  onError(callback: (error: ASRError) => void): void;
  onConnectionStateChange(callback: (state: ConnectionState) => void): void;
  getConnectionState(): ConnectionState;
}

export type ASRErrorCode =
  | 'CONNECTION_FAILED'
  | 'AUTH_ERROR'
  | 'PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'STREAM_LIMIT'
  | 'AUDIO_FORMAT_ERROR'
  | 'UNKNOWN';

export class ASRError extends Error {
  constructor(
    message: string,
    public readonly code: ASRErrorCode,
    public readonly provider: string,
    public readonly recoverable: boolean,
  ) {
    super(message);
    this.name = 'ASRError';
  }
}
