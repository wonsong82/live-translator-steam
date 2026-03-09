import { z } from 'zod';

export const googleSttConfigSchema = z.object({
  languageCode: z.string().default('ko-KR'),
  model: z.string().default('latest_long'),
  useEnhanced: z.boolean().default(true),
  enableAutomaticPunctuation: z.boolean().default(true),
});

export const deepgramConfigSchema = z.object({
  model: z.string().default('nova-3'),
  language: z.string().default('ko'),
  interimResults: z.boolean().default(true),
  smartFormat: z.boolean().default(true),
  endpointing: z.number().default(300),
  utteranceEndMs: z.number().default(1000),
  vadEvents: z.boolean().default(true),
});

export const openaiRealtimeConfigSchema = z.object({
  model: z.string().default('gpt-4o-transcribe'),
  language: z.string().default('ko'),
  vadThreshold: z.number().default(0.5),
  silenceDurationMs: z.number().default(700),
  prefixPaddingMs: z.number().default(300),
  noiseReduction: z.enum(['near_field', 'far_field']).default('near_field'),
});

export const qwenLocalAsrConfigSchema = z.object({
  host: z.string().default('qwen3-asr'),
  port: z.number().default(8001),
  model: z.string().default('Qwen/Qwen3-ASR-1.7B'),
  chunkSizeMs: z.number().default(2000),
});

export type GoogleSttConfig = z.infer<typeof googleSttConfigSchema>;
export type DeepgramConfig = z.infer<typeof deepgramConfigSchema>;
export type OpenAIRealtimeConfig = z.infer<typeof openaiRealtimeConfigSchema>;
export type QwenLocalAsrConfig = z.infer<typeof qwenLocalAsrConfigSchema>;
