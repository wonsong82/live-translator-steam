export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export type TranslationMode = 'hybrid' | 'final-only';

export interface Sentence {
  sourceText: string;
  translation: string | null;
  timestamp: number;
}

export interface TranslatorStore {
  isRecording: boolean;
  connectionStatus: ConnectionStatus;
  showTranscription: boolean;
  sentences: Sentence[];
  currentInterimSource: string;
  currentInterimTranslation: string;
  lastError: string | null;
  setRecording: (isRecording: boolean) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setShowTranscription: (show: boolean) => void;
  addSentence: (text: string, timestamp: number) => void;
  setTranslation: (index: number, translation: string) => void;
  setInterimSource: (text: string) => void;
  setInterimTranslation: (text: string) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}
