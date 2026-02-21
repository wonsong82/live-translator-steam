import type { IASRProvider } from './types.js';
import type { EnvConfig, ServerProviderConfig } from '../config/index.js';
import { DeepgramAdapter } from './deepgram.js';
import { GoogleAdapter } from './google.js';
import { OpenAIAdapter } from './openai.js';
import { Qwen3AsrAdapter } from './qwen3-asr.js';

export function createASRProvider(
  providerConfig: ServerProviderConfig,
  envConfig: EnvConfig,
): IASRProvider {
  switch (providerConfig.asrProvider) {
    case 'deepgram':
      return new DeepgramAdapter(envConfig.DEEPGRAM_API_KEY ?? '');
    case 'google':
      return new GoogleAdapter();
    case 'openai':
      return new OpenAIAdapter(envConfig.OPENAI_API_KEY ?? '');
    case 'qwen3-asr':
      return new Qwen3AsrAdapter(envConfig.QWEN3_ASR_HOST, envConfig.QWEN3_ASR_PORT);
    default:
      throw new Error(`Unknown ASR provider: ${providerConfig.asrProvider}`);
  }
}
