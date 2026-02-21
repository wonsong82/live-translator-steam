import type { Pool } from 'pg';
import { getLogger } from '../config/logger.js';

export interface StoredSession {
  readonly id: string;
  readonly apiKey: string;
  readonly sourceLanguage: string;
  readonly targetLanguage: string;
  readonly mode: string;
  readonly asrProvider: string;
  readonly createdAt: Date;
  readonly endedAt: Date | null;
}

export interface StoredTranscript {
  readonly sessionId: string;
  readonly sentenceIndex: number;
  readonly sourceText: string;
  readonly translatedText: string | null;
  readonly confidence: number;
  readonly timestampMs: number;
}

export class SessionStore {
  private readonly log = getLogger().child({ module: 'session-store' });

  constructor(private readonly pool: Pool) {}

  async createSession(params: {
    apiKey: string;
    sourceLanguage: string;
    targetLanguage: string;
    mode: string;
    asrProvider: string;
  }): Promise<string> {
    const result = await this.pool.query(
      `INSERT INTO sessions (api_key, source_language, target_language, mode, asr_provider)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [params.apiKey, params.sourceLanguage, params.targetLanguage, params.mode, params.asrProvider],
    );
    const id = result.rows[0]?.id as string;
    this.log.debug({ sessionId: id }, 'session created');
    return id;
  }

  async endSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE sessions SET ended_at = NOW() WHERE id = $1`,
      [sessionId],
    );
  }

  async saveTranscript(transcript: StoredTranscript): Promise<void> {
    await this.pool.query(
      `INSERT INTO transcripts (session_id, sentence_index, source_text, translated_text, confidence, timestamp_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [transcript.sessionId, transcript.sentenceIndex, transcript.sourceText, transcript.translatedText, transcript.confidence, transcript.timestampMs],
    );
  }
}
