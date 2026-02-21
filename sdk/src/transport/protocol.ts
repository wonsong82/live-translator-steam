export interface SessionStartMessage {
  readonly type: 'session.start';
  readonly config: {
    readonly sourceLanguage: string;
    readonly targetLanguage: string;
    readonly mode: 'hybrid' | 'final-only';
    readonly audioFormat: {
      readonly encoding: 'pcm16';
      readonly sampleRate: 16000;
      readonly channels: 1;
    };
  };
}

export interface SessionUpdateMessage {
  readonly type: 'session.update';
  readonly config: {
    readonly sourceLanguage?: string;
    readonly targetLanguage?: string;
    readonly mode?: 'hybrid' | 'final-only';
  };
}

export interface SessionEndMessage {
  readonly type: 'session.end';
}

export type ClientMessage = SessionStartMessage | SessionUpdateMessage | SessionEndMessage;

export interface TranscriptionInterimMessage {
  readonly type: 'transcription.interim';
  readonly text: string;
  readonly language: string;
  readonly timestamp: number;
  readonly confidence: number;
}

export interface TranscriptionFinalMessage {
  readonly type: 'transcription.final';
  readonly text: string;
  readonly language: string;
  readonly timestamp: number;
  readonly confidence: number;
  readonly sentenceIndex: number;
}

export interface TranslationInterimMessage {
  readonly type: 'translation.interim';
  readonly sourceText: string;
  readonly translatedText: string;
  readonly sentenceIndex: null;
}

export interface TranslationFinalMessage {
  readonly type: 'translation.final';
  readonly sourceText: string;
  readonly translatedText: string;
  readonly sentenceIndex: number;
}

export interface ErrorMessage {
  readonly type: 'error';
  readonly code: string;
  readonly message: string;
}

export interface SessionStatusMessage {
  readonly type: 'session.status';
  readonly status: 'connected' | 'reconnecting' | 'error';
}

export type ServerMessage =
  | TranscriptionInterimMessage
  | TranscriptionFinalMessage
  | TranslationInterimMessage
  | TranslationFinalMessage
  | ErrorMessage
  | SessionStatusMessage;

export function serializeClientMessage(msg: ClientMessage): string {
  return JSON.stringify(msg);
}

export function parseServerMessage(data: string): ServerMessage | null {
  try {
    const parsed = JSON.parse(data) as ServerMessage;
    if (!parsed.type) return null;
    return parsed;
  } catch {
    return null;
  }
}
