import type { Pool } from 'pg';
import { getLogger } from '../config/logger.js';

export interface UsageRecord {
  readonly apiKey: string;
  readonly sessionId?: string;
  readonly audioSeconds: number;
  readonly asrProvider: string;
  readonly translationCharacters: number;
}

export class UsageTracker {
  private readonly log = getLogger().child({ module: 'usage-tracker' });

  constructor(private readonly pool: Pool) {}

  async record(usage: UsageRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO usage (api_key, session_id, audio_seconds, asr_provider, translation_characters)
       VALUES ($1, $2, $3, $4, $5)`,
      [usage.apiKey, usage.sessionId ?? null, usage.audioSeconds, usage.asrProvider, usage.translationCharacters],
    );
    this.log.debug({ apiKey: usage.apiKey, audioSeconds: usage.audioSeconds }, 'usage recorded');
  }

  async getMonthlyUsage(apiKey: string): Promise<{ audioMinutes: number; translationCharacters: number }> {
    const result = await this.pool.query(
      `SELECT COALESCE(SUM(audio_seconds), 0) as total_seconds,
              COALESCE(SUM(translation_characters), 0) as total_chars
       FROM usage
       WHERE api_key = $1
         AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)`,
      [apiKey],
    );
    const row = result.rows[0];
    return {
      audioMinutes: Number(row?.total_seconds ?? 0) / 60,
      translationCharacters: Number(row?.total_chars ?? 0),
    };
  }
}
