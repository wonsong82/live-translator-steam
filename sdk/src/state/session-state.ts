import type { ConnectionStatus, TranscriptState, TranslationMode } from '../types.js';

export class SessionState {
  private _status: ConnectionStatus = 'disconnected';
  private _recording = false;
  private _finals: string[] = [];
  private _currentInterim = '';
  private _translations: Record<number, string> = {};
  currentInterimTranslation = '';

  sourceLanguage: string;
  targetLanguage: string;
  mode: TranslationMode;

  constructor(sourceLanguage: string, targetLanguage: string, mode: TranslationMode) {
    this.sourceLanguage = sourceLanguage;
    this.targetLanguage = targetLanguage;
    this.mode = mode;
  }

  get status(): ConnectionStatus { return this._status; }
  set status(val: ConnectionStatus) { this._status = val; }

  get recording(): boolean { return this._recording; }
  set recording(val: boolean) { this._recording = val; }

  get currentInterim(): string { return this._currentInterim; }

  setInterim(text: string): void {
    this._currentInterim = text;
  }

  addFinal(text: string): void {
    this._finals.push(text);
    this._currentInterim = '';
  }

  setTranslation(sentenceIndex: number, translatedText: string): void {
    this._translations[sentenceIndex] = translatedText;
  }

  setInterimTranslation(text: string): void {
    this.currentInterimTranslation = text;
  }

  getTranscript(): TranscriptState {
    return {
      finals: [...this._finals],
      currentInterim: this._currentInterim,
    };
  }

  getTranslations(): Record<number, string> {
    return { ...this._translations };
  }

  reset(): void {
    this._status = 'disconnected';
    this._recording = false;
    this._finals = [];
    this._currentInterim = '';
    this._translations = {};
    this.currentInterimTranslation = '';
  }
}
