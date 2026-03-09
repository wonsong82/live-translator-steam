import { describe, it, expect, beforeEach } from 'vitest';
import { useTranslatorStore } from '../src/store/useTranslatorStore';

describe('useTranslatorStore', () => {
  beforeEach(() => {
    useTranslatorStore.getState().reset();
  });

  it('starts with default state', () => {
    const state = useTranslatorStore.getState();
    expect(state.isRecording).toBe(false);
    expect(state.connectionStatus).toBe('disconnected');
    expect(state.showTranscription).toBe(true);
    expect(state.sentences).toEqual([]);
    expect(state.currentInterimSource).toBe('');
    expect(state.currentInterimTranslation).toBe('');
    expect(state.lastError).toBeNull();
  });

  it('setRecording', () => {
    useTranslatorStore.getState().setRecording(true);
    expect(useTranslatorStore.getState().isRecording).toBe(true);
  });

  it('setConnectionStatus', () => {
    useTranslatorStore.getState().setConnectionStatus('connected');
    expect(useTranslatorStore.getState().connectionStatus).toBe('connected');
  });

  it('setShowTranscription', () => {
    useTranslatorStore.getState().setShowTranscription(false);
    expect(useTranslatorStore.getState().showTranscription).toBe(false);
  });

  it('addSentence adds a sentence and clears interims', () => {
    const store = useTranslatorStore.getState();
    store.setInterimSource('나 오늘');
    store.setInterimTranslation('I today');
    store.addSentence('나 오늘 너무 피곤해', 1000);

    const state = useTranslatorStore.getState();
    expect(state.sentences).toHaveLength(1);
    expect(state.sentences[0]?.sourceText).toBe('나 오늘 너무 피곤해');
    expect(state.sentences[0]?.translation).toBeNull();
    expect(state.sentences[0]?.timestamp).toBe(1000);
    expect(state.currentInterimSource).toBe('');
    expect(state.currentInterimTranslation).toBe('');
  });

  it('setTranslation updates a specific sentence', () => {
    const store = useTranslatorStore.getState();
    store.addSentence('문장 1', 1000);
    store.addSentence('문장 2', 2000);
    store.setTranslation(1, 'Sentence 2');

    const state = useTranslatorStore.getState();
    expect(state.sentences[0]?.translation).toBeNull();
    expect(state.sentences[1]?.translation).toBe('Sentence 2');
  });

  it('setTranslation is a no-op for invalid index', () => {
    const store = useTranslatorStore.getState();
    store.addSentence('문장 1', 1000);
    store.setTranslation(99, 'ghost');

    const state = useTranslatorStore.getState();
    expect(state.sentences).toHaveLength(1);
    expect(state.sentences[0]?.translation).toBeNull();
  });

  it('setInterimSource', () => {
    useTranslatorStore.getState().setInterimSource('나 오늘');
    expect(useTranslatorStore.getState().currentInterimSource).toBe('나 오늘');
  });

  it('setInterimTranslation', () => {
    useTranslatorStore.getState().setInterimTranslation('I today');
    expect(useTranslatorStore.getState().currentInterimTranslation).toBe('I today');
  });

  it('setError', () => {
    useTranslatorStore.getState().setError('Connection failed');
    expect(useTranslatorStore.getState().lastError).toBe('Connection failed');
    useTranslatorStore.getState().setError(null);
    expect(useTranslatorStore.getState().lastError).toBeNull();
  });

  it('reset restores initial state', () => {
    const store = useTranslatorStore.getState();
    store.setRecording(true);
    store.setConnectionStatus('connected');
    store.setShowTranscription(false);
    store.addSentence('test', 1000);
    store.setInterimSource('interim');
    store.setInterimTranslation('trans');
    store.setError('error');

    store.reset();

    const state = useTranslatorStore.getState();
    expect(state.isRecording).toBe(false);
    expect(state.connectionStatus).toBe('disconnected');
    expect(state.showTranscription).toBe(true);
    expect(state.sentences).toEqual([]);
    expect(state.currentInterimSource).toBe('');
    expect(state.currentInterimTranslation).toBe('');
    expect(state.lastError).toBeNull();
  });
});
