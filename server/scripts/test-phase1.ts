// Prereq: docker compose exec server npx tsx scripts/generate-test-audio.ts
// Usage:  docker compose exec server npx tsx scripts/test-phase1.ts

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { GoogleAdapter } from '../src/asr/google.js';
import { DeepgramAdapter } from '../src/asr/deepgram.js';
import { OpenAIAdapter } from '../src/asr/openai.js';
import type { IASRProvider, ASRProviderConfig, TranscriptResult } from '../src/asr/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, 'fixtures');

const TEST_AUDIO_FILES = [
  { id: 'banmal-01', text: '나 오늘 너무 피곤해' },
  { id: 'jondaenmal-01', text: '저는 오늘 너무 피곤합니다' },
];

function loadAudioChunks(fileId: string, chunkSizeBytes: number): Buffer[] {
  const pcmPath = resolve(FIXTURES_DIR, `${fileId}.pcm`);
  if (!existsSync(pcmPath)) {
    throw new Error(`Audio fixture not found: ${pcmPath}. Run generate-test-audio.ts first.`);
  }

  const raw = readFileSync(pcmPath);
  const chunks: Buffer[] = [];
  for (let offset = 0; offset < raw.length; offset += chunkSizeBytes) {
    chunks.push(raw.subarray(offset, Math.min(offset + chunkSizeBytes, raw.length)));
  }
  return chunks;
}

interface ASRTestResult {
  provider: string;
  audioId: string;
  expectedText: string;
  interimCount: number;
  finalText: string;
  confidence: number;
  pass: boolean;
  error?: string;
}

async function testProvider(
  name: string,
  provider: IASRProvider,
  config: ASRProviderConfig,
  timeoutMs: number = 15000,
): Promise<ASRTestResult[]> {
  const results: ASRTestResult[] = [];

  for (const audio of TEST_AUDIO_FILES) {
    let interimCount = 0;
    let finalText = '';
    let confidence = 0;
    let error: string | undefined;

    try {
      // 640 bytes = 20ms frame at 16kHz mono PCM16 (16000 Hz × 2 bytes × 0.02s)
      const chunks = loadAudioChunks(audio.id, 640);

      const transcriptPromise = new Promise<void>((resolveP, rejectP) => {
        const timeout = setTimeout(() => {
          rejectP(new Error(`Timeout after ${timeoutMs}ms — no final transcript received`));
        }, timeoutMs);

        provider.onTranscript((result: TranscriptResult) => {
          if (!result.isFinal) {
            interimCount++;
            return;
          }
          finalText = result.text;
          confidence = result.confidence;
          clearTimeout(timeout);
          resolveP();
        });

        provider.onError((err) => {
          clearTimeout(timeout);
          rejectP(err);
        });
      });

      await provider.connect(config);

      for (const chunk of chunks) {
        provider.sendAudio(chunk);
        await sleep(20);
      }

      // Send 3s of silence so VAD detects end-of-speech and emits a final result
      const silenceChunk = Buffer.alloc(640);
      for (let i = 0; i < 150; i++) {
        provider.sendAudio(silenceChunk);
        await sleep(20);
      }

      await transcriptPromise;

      results.push({
        provider: name,
        audioId: audio.id,
        expectedText: audio.text,
        interimCount,
        finalText,
        confidence,
        pass: finalText.length > 0,
      });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      results.push({
        provider: name,
        audioId: audio.id,
        expectedText: audio.text,
        interimCount,
        finalText,
        confidence,
        pass: false,
        error,
      });
    } finally {
      await provider.disconnect();
    }
  }

  return results;
}

function printResults(results: ASRTestResult[]): void {
  for (const r of results) {
    const status = r.pass ? ' PASS ' : ' FAIL ';
    console.log(`  ${status} [${r.audioId}] expected: "${r.expectedText}"`);
    if (r.pass) {
      console.log(`         → got: "${r.finalText}" (confidence: ${r.confidence.toFixed(2)}, interims: ${r.interimCount})`);
    } else {
      console.log(`         → ERROR: ${r.error ?? 'empty final text'}`);
      if (r.finalText) console.log(`         → partial: "${r.finalText}"`);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  if (!existsSync(FIXTURES_DIR)) {
    console.error('No fixtures directory. Run: docker compose exec server npx tsx scripts/generate-test-audio.ts');
    process.exit(1);
  }

  const deepgramKey = process.env.DEEPGRAM_API_KEY ?? '';
  const openaiKey = process.env.OPENAI_API_KEY ?? '';

  let allPassed = true;

  console.log('\n=== 1a. Google Cloud STT ===\n');
  {
    const provider = new GoogleAdapter();
    const config: ASRProviderConfig = {
      provider: 'google',
      language: 'ko',
      model: 'latest_long',
    };
    const results = await testProvider('google', provider, config);
    printResults(results);
    if (results.some((r) => !r.pass)) allPassed = false;
  }

  console.log('\n=== 1b. Deepgram ===\n');
  if (!deepgramKey) {
    console.log('  SKIP  DEEPGRAM_API_KEY not set');
  } else {
    const provider = new DeepgramAdapter(deepgramKey);
    const config: ASRProviderConfig = {
      provider: 'deepgram',
      language: 'ko',
      model: 'nova-3',
    };
    const results = await testProvider('deepgram', provider, config);
    printResults(results);
    if (results.some((r) => !r.pass)) allPassed = false;
  }

  console.log('\n=== 1c. OpenAI Realtime ===\n');
  if (!openaiKey) {
    console.log('  SKIP  OPENAI_API_KEY not set');
  } else {
    const provider = new OpenAIAdapter(openaiKey);
    const config: ASRProviderConfig = {
      provider: 'openai',
      language: 'ko',
      model: 'gpt-4o-transcribe',
    };
    const results = await testProvider('openai', provider, config, 20000);
    printResults(results);
    if (results.some((r) => !r.pass)) allPassed = false;
  }

  console.log('\n' + '='.repeat(50));
  console.log(allPassed ? 'Phase 1: ALL PASSED' : 'Phase 1: SOME FAILURES');
  console.log('='.repeat(50) + '\n');

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Phase 1 test failed:', err);
  process.exit(1);
});
