import { describe, it, expect } from 'vitest';
import { SessionState } from '../src/state/session-state.js';

describe('SessionState', () => {
  it('initializes with provided values', () => {
    const state = new SessionState('ko', 'en', 'hybrid');
    expect(state.sourceLanguage).toBe('ko');
    expect(state.targetLanguage).toBe('en');
    expect(state.mode).toBe('hybrid');
    expect(state.status).toBe('disconnected');
    expect(state.recording).toBe(false);
  });

  it('tracks interim transcription', () => {
    const state = new SessionState('ko', 'en', 'hybrid');
    state.setInterim('나 오늘');
    expect(state.currentInterim).toBe('나 오늘');
    expect(state.getTranscript().currentInterim).toBe('나 오늘');
  });

  it('clears interim when final is added', () => {
    const state = new SessionState('ko', 'en', 'hybrid');
    state.setInterim('나 오늘');
    state.addFinal('나 오늘 너무 피곤해');
    expect(state.currentInterim).toBe('');
    expect(state.getTranscript().finals).toEqual(['나 오늘 너무 피곤해']);
  });

  it('accumulates multiple finals', () => {
    const state = new SessionState('ko', 'en', 'hybrid');
    state.addFinal('첫 번째 문장');
    state.addFinal('두 번째 문장');
    expect(state.getTranscript().finals).toEqual(['첫 번째 문장', '두 번째 문장']);
  });

  it('tracks translations by sentence index', () => {
    const state = new SessionState('ko', 'en', 'hybrid');
    state.setTranslation(0, "I'm so tired today");
    state.setTranslation(1, 'How do you do this?');
    const translations = state.getTranslations();
    expect(translations[0]).toBe("I'm so tired today");
    expect(translations[1]).toBe('How do you do this?');
  });

  it('tracks interim translation', () => {
    const state = new SessionState('ko', 'en', 'hybrid');
    state.setInterimTranslation('I am so tired...');
    expect(state.currentInterimTranslation).toBe('I am so tired...');
  });

  it('returns defensive copies from getTranscript and getTranslations', () => {
    const state = new SessionState('ko', 'en', 'hybrid');
    state.addFinal('test');
    state.setTranslation(0, 'test translation');

    const transcript = state.getTranscript();
    const translations = state.getTranslations();

    transcript.finals.push('mutated');
    translations[99] = 'mutated';

    expect(state.getTranscript().finals).toEqual(['test']);
    expect(state.getTranslations()[99]).toBeUndefined();
  });

  it('resets all state', () => {
    const state = new SessionState('ko', 'en', 'hybrid');
    state.status = 'connected';
    state.recording = true;
    state.setInterim('interim');
    state.addFinal('final');
    state.setTranslation(0, 'translation');
    state.setInterimTranslation('interim trans');

    state.reset();

    expect(state.status).toBe('disconnected');
    expect(state.recording).toBe(false);
    expect(state.currentInterim).toBe('');
    expect(state.getTranscript().finals).toEqual([]);
    expect(state.getTranslations()).toEqual({});
    expect(state.currentInterimTranslation).toBe('');
  });
});
