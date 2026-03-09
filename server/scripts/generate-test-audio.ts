// Usage: docker compose exec server npx tsx scripts/generate-test-audio.ts

import OpenAI from 'openai';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, 'fixtures');

const TEST_SENTENCES = [
  { id: 'banmal-01', text: '나 오늘 너무 피곤해', register: '반말' },
  { id: 'jondaenmal-01', text: '저는 오늘 너무 피곤합니다', register: '존댓말' },
  { id: 'banmal-02', text: '이거 어떻게 하는 거야?', register: '반말' },
  { id: 'jondaenmal-02', text: '이것은 어떻게 하는 건가요?', register: '존댓말' },
  { id: 'banmal-03', text: '밥 먹었어?', register: '반말' },
  { id: 'jondaenmal-03', text: '식사하셨습니까?', register: '존댓말' },
];

// OpenAI TTS outputs 24kHz PCM16; ASR adapters expect 16kHz. Downsample with linear interpolation.
function resample24kTo16k(input: Buffer): Buffer {
  const inputSamples = input.length / 2;
  const ratio = 16000 / 24000;
  const outputSamples = Math.floor(inputSamples * ratio);
  const output = Buffer.alloc(outputSamples * 2);

  for (let i = 0; i < outputSamples; i++) {
    const srcIdx = i / ratio;
    const srcFloor = Math.floor(srcIdx);
    const srcCeil = Math.min(srcFloor + 1, inputSamples - 1);
    const frac = srcIdx - srcFloor;

    const s0 = input.readInt16LE(srcFloor * 2);
    const s1 = input.readInt16LE(srcCeil * 2);
    const interpolated = Math.round(s0 + frac * (s1 - s0));

    output.writeInt16LE(Math.max(-32768, Math.min(32767, interpolated)), i * 2);
  }

  return output;
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not set');
    process.exit(1);
  }

  if (!existsSync(FIXTURES_DIR)) {
    mkdirSync(FIXTURES_DIR, { recursive: true });
  }

  const client = new OpenAI({ apiKey });

  console.log('Generating Korean test audio files via OpenAI TTS...\n');

  for (const sentence of TEST_SENTENCES) {
    const response = await client.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',
      input: sentence.text,
      response_format: 'pcm',
    });

    // OpenAI pcm format: raw 24kHz 16-bit mono little-endian PCM
    const pcm24k = Buffer.from(await response.arrayBuffer());
    const pcm16k = resample24kTo16k(pcm24k);

    const pcmPath = resolve(FIXTURES_DIR, `${sentence.id}.pcm`);
    writeFileSync(pcmPath, pcm16k);

    const durationMs = Math.round((pcm16k.length / 2 / 16000) * 1000);
    console.log(`  OK    ${sentence.id} (${sentence.register}): "${sentence.text}" — ${durationMs}ms, ${pcm16k.length} bytes`);
  }

  console.log(`\nDone. Files saved to ${FIXTURES_DIR}`);
}

main().catch((err) => {
  console.error('Audio generation failed:', err);
  process.exit(1);
});
