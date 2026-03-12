export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type TranslationMode = 'hybrid' | 'final-only';

export interface TranslateSDKConfig {
  readonly serverUrl: string;
  readonly apiKey: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly mode: TranslationMode;
  readonly deviceId?: string;
  readonly onTranscriptionInterim?: (data: TranscriptionInterimEvent) => void;
  readonly onTranscriptionFinal?: (data: TranscriptionFinalEvent) => void;
  readonly onTranslationInterim?: (data: TranslationInterimEvent) => void;
  readonly onTranslationFinal?: (data: TranslationFinalEvent) => void;
  readonly onStatusChange?: (status: ConnectionStatus) => void;
  readonly onError?: (error: TranslateSDKError) => void;
  readonly onRoomCreated?: (data: { roomId: string }) => void;
  readonly onRoomError?: (data: { code: string; message: string }) => void;
  readonly onViewerCountChange?: (data: { count: number }) => void;
}

export interface TranscriptionInterimEvent {
  readonly text: string;
  readonly language: string;
  readonly timestamp: number;
  readonly confidence: number;
}

export interface TranscriptionFinalEvent {
  readonly text: string;
  readonly language: string;
  readonly timestamp: number;
  readonly confidence: number;
  readonly sentenceIndex: number;
}

export interface TranslationInterimEvent {
  readonly sourceText: string;
  readonly translatedText: string;
  readonly sentenceIndex: null;
}

export interface TranslationFinalEvent {
  readonly sourceText: string;
  readonly translatedText: string;
  readonly sentenceIndex: number;
}

export interface TranslateSDKError {
  readonly code: string;
  readonly message: string;
}

export interface TranscriptState {
  readonly finals: string[];
  readonly currentInterim: string;
}

export interface TranslateSDKInstance {
  start(): Promise<void>;
  stop(): void;
  resume(): Promise<void>;
  destroy(): void;
  setSourceLanguage(lang: string): void;
  setTargetLanguage(lang: string): void;
  setMode(mode: TranslationMode): void;
  getStatus(): ConnectionStatus;
  isRecording(): boolean;
  getTranscript(): TranscriptState;
  getTranslations(): Record<number, string>;
  createRoom(customCode?: string): Promise<{ roomId: string }>;
  destroyRoom(): void;
}

export interface ViewerConfig {
  readonly serverUrl: string;
  readonly roomId: string;
  readonly apiKey: string;
  readonly onTranscriptionInterim?: (data: TranscriptionInterimEvent) => void;
  readonly onTranscriptionFinal?: (data: TranscriptionFinalEvent) => void;
  readonly onTranslationInterim?: (data: TranslationInterimEvent) => void;
  readonly onTranslationFinal?: (data: TranslationFinalEvent) => void;
  readonly onStatusChange?: (status: ConnectionStatus) => void;
  readonly onError?: (error: TranslateSDKError) => void;
  readonly onRoomError?: (data: { code: string; message: string }) => void;
}

export interface ViewerInstance {
  connect(): void;
  disconnect(): void;
  destroy(): void;
  getStatus(): ConnectionStatus;
}
