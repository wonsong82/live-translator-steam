import { describe, it, expect } from 'vitest';
import { serializeClientMessage, parseServerMessage } from '../src/transport/protocol.js';
import type { RoomCreateMessage, RoomJoinMessage, RoomLeaveMessage } from '../src/transport/protocol.js';

describe('serializeClientMessage', () => {
  it('serializes session.start', () => {
    const msg = serializeClientMessage({
      type: 'session.start',
      config: {
        sourceLanguage: 'ko',
        targetLanguage: 'en',
        mode: 'hybrid',
        audioFormat: { encoding: 'pcm16', sampleRate: 16000, channels: 1 },
      },
    });
    const parsed = JSON.parse(msg);
    expect(parsed.type).toBe('session.start');
    expect(parsed.config.sourceLanguage).toBe('ko');
    expect(parsed.config.audioFormat.sampleRate).toBe(16000);
  });

  it('serializes session.update', () => {
    const msg = serializeClientMessage({
      type: 'session.update',
      config: { mode: 'final-only' },
    });
    const parsed = JSON.parse(msg);
    expect(parsed.type).toBe('session.update');
    expect(parsed.config.mode).toBe('final-only');
  });

  it('serializes session.end', () => {
    const msg = serializeClientMessage({ type: 'session.end' });
    expect(JSON.parse(msg)).toEqual({ type: 'session.end' });
  });
});

describe('parseServerMessage', () => {
  it('parses transcription.interim', () => {
    const msg = parseServerMessage(JSON.stringify({
      type: 'transcription.interim',
      text: '나 오늘',
      language: 'ko',
      timestamp: 1000,
      confidence: 0.8,
    }));
    expect(msg?.type).toBe('transcription.interim');
    if (msg?.type === 'transcription.interim') {
      expect(msg.text).toBe('나 오늘');
      expect(msg.confidence).toBe(0.8);
    }
  });

  it('parses transcription.final', () => {
    const msg = parseServerMessage(JSON.stringify({
      type: 'transcription.final',
      text: '나 오늘 너무 피곤해',
      language: 'ko',
      timestamp: 2000,
      confidence: 0.95,
      sentenceIndex: 0,
    }));
    expect(msg?.type).toBe('transcription.final');
    if (msg?.type === 'transcription.final') {
      expect(msg.sentenceIndex).toBe(0);
    }
  });

  it('parses translation.final', () => {
    const msg = parseServerMessage(JSON.stringify({
      type: 'translation.final',
      sourceText: '나 오늘 너무 피곤해',
      translatedText: "I'm so tired today",
      sentenceIndex: 0,
    }));
    expect(msg?.type).toBe('translation.final');
    if (msg?.type === 'translation.final') {
      expect(msg.translatedText).toBe("I'm so tired today");
    }
  });

  it('parses error messages', () => {
    const msg = parseServerMessage(JSON.stringify({
      type: 'error',
      code: 'NO_SESSION',
      message: 'Send session.start before audio',
    }));
    expect(msg?.type).toBe('error');
    if (msg?.type === 'error') {
      expect(msg.code).toBe('NO_SESSION');
    }
  });

  it('returns null for invalid JSON', () => {
    expect(parseServerMessage('not json')).toBeNull();
  });

  it('returns null for missing type field', () => {
    expect(parseServerMessage(JSON.stringify({ foo: 'bar' }))).toBeNull();
  });
});

describe('room messages', () => {
  describe('client messages', () => {
    it('serializes room.create', () => {
      const msg: RoomCreateMessage = { type: 'room.create' };
      expect(serializeClientMessage(msg)).toBe('{"type":"room.create"}');
    });

    it('serializes room.join with roomId', () => {
      const msg: RoomJoinMessage = { type: 'room.join', roomId: 'ABC123' };
      expect(serializeClientMessage(msg)).toBe('{"type":"room.join","roomId":"ABC123"}');
    });

    it('serializes room.leave', () => {
      const msg: RoomLeaveMessage = { type: 'room.leave' };
      expect(serializeClientMessage(msg)).toBe('{"type":"room.leave"}');
    });
  });

  describe('server messages', () => {
    it('parses room.created', () => {
      const json = '{"type":"room.created","roomId":"XY7890"}';
      const msg = parseServerMessage(json);
      expect(msg).toEqual({ type: 'room.created', roomId: 'XY7890' });
    });

    it('parses room.joined', () => {
      const json = '{"type":"room.joined","roomId":"XY7890"}';
      const msg = parseServerMessage(json);
      expect(msg).toEqual({ type: 'room.joined', roomId: 'XY7890' });
    });

    it('parses room.error with code and message', () => {
      const json = '{"type":"room.error","code":"ROOM_NOT_FOUND","message":"Room not found"}';
      const msg = parseServerMessage(json);
      expect(msg).toEqual({ type: 'room.error', code: 'ROOM_NOT_FOUND', message: 'Room not found' });
    });

    it('parses room.viewerCount', () => {
      const json = '{"type":"room.viewerCount","count":42}';
      const msg = parseServerMessage(json);
      expect(msg).toEqual({ type: 'room.viewerCount', count: 42 });
    });
  });
});
