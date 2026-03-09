// Phase 3: Full pipeline WebSocket tests (ASR + Translation over WS gateway)
// Prereq: server running on :8080, audio fixtures generated
// Usage:  docker compose exec server npx tsx scripts/test-phase3.ts

import WebSocket from 'ws';
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, 'fixtures');
const WS_URL = 'ws://localhost:8080/ws';

interface WSMessage {
  type: string;
  [key: string]: unknown;
}

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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface PipelineTestResult {
  testName: string;
  pass: boolean;
  messages: WSMessage[];
  error?: string;
  details?: string;
}

async function runPipelineTest(
  testName: string,
  sessionConfig: Record<string, unknown>,
  audioFileId: string,
  expectations: {
    requiredTypes: string[];
    forbiddenTypes?: string[];
    validateMessages?: (msgs: WSMessage[]) => string | null;
  },
  timeoutMs = 30000,
): Promise<PipelineTestResult> {
  const messages: WSMessage[] = [];

  return new Promise<PipelineTestResult>((resolveTest) => {
    const ws = new WebSocket(WS_URL);
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.close();

      const receivedTypes = messages.map((m) => m.type);
      const missingTypes = expectations.requiredTypes.filter((t) => !receivedTypes.includes(t));

      if (missingTypes.length > 0) {
        resolveTest({
          testName,
          pass: false,
          messages,
          error: `Timeout: missing message types: ${missingTypes.join(', ')}`,
          details: `Received: ${receivedTypes.join(', ')}`,
        });
      } else {
        finalize();
      }
    }, timeoutMs);

    function finalize(): void {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      ws.close();

      const receivedTypes = messages.map((m) => m.type);

      const missingTypes = expectations.requiredTypes.filter((t) => !receivedTypes.includes(t));
      if (missingTypes.length > 0) {
        resolveTest({
          testName,
          pass: false,
          messages,
          error: `Missing required message types: ${missingTypes.join(', ')}`,
          details: `Received: ${receivedTypes.join(', ')}`,
        });
        return;
      }

      if (expectations.forbiddenTypes) {
        const forbidden = expectations.forbiddenTypes.filter((t) => receivedTypes.includes(t));
        if (forbidden.length > 0) {
          resolveTest({
            testName,
            pass: false,
            messages,
            error: `Received forbidden message types: ${forbidden.join(', ')}`,
            details: `Received: ${receivedTypes.join(', ')}`,
          });
          return;
        }
      }

      if (expectations.validateMessages) {
        const validationError = expectations.validateMessages(messages);
        if (validationError) {
          resolveTest({
            testName,
            pass: false,
            messages,
            error: validationError,
          });
          return;
        }
      }

      resolveTest({ testName, pass: true, messages });
    }

    ws.on('open', () => {
      ws.send(JSON.stringify({ type: 'session.start', config: sessionConfig }));
    });

    ws.on('message', async (raw: Buffer) => {
      const msg: WSMessage = JSON.parse(raw.toString());
      messages.push(msg);

      if (msg.type === 'session.status' && msg.status === 'connected') {
        sendAudioAndWait(ws, audioFileId).catch((err: unknown) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            ws.close();
            resolveTest({
              testName,
              pass: false,
              messages,
              error: `Audio send failed: ${err instanceof Error ? err.message : String(err)}`,
            });
          }
        });
      }

      if (msg.type === 'translation.final') {
        await sleep(1000);
        finalize();
      }
    });

    ws.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        resolveTest({
          testName,
          pass: false,
          messages,
          error: `WebSocket error: ${err.message}`,
        });
      }
    });

    ws.on('close', () => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        const receivedTypes = messages.map((m) => m.type);
        const missingTypes = expectations.requiredTypes.filter((t) => !receivedTypes.includes(t));
        if (missingTypes.length > 0) {
          resolveTest({
            testName,
            pass: false,
            messages,
            error: `Connection closed early. Missing: ${missingTypes.join(', ')}`,
          });
        } else {
          finalize();
        }
      }
    });
  });
}

async function sendAudioAndWait(ws: WebSocket, audioFileId: string): Promise<void> {
  // 640 bytes = 20ms frame at 16kHz mono PCM16
  const chunks = loadAudioChunks(audioFileId, 640);

  for (const chunk of chunks) {
    if (ws.readyState !== WebSocket.OPEN) break;
    ws.send(chunk);
    await sleep(20);
  }

  // Send 3s of silence for VAD end-of-speech detection
  const silenceChunk = Buffer.alloc(640);
  for (let i = 0; i < 150; i++) {
    if (ws.readyState !== WebSocket.OPEN) break;
    ws.send(silenceChunk);
    await sleep(20);
  }
}

function printResult(result: PipelineTestResult): void {
  const status = result.pass ? ' PASS ' : ' FAIL ';
  console.log(`  ${status} ${result.testName}`);
  if (result.pass) {
    const types = result.messages.map((m) => m.type);
    const typeCounts: Record<string, number> = {};
    for (const t of types) {
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
    const summary = Object.entries(typeCounts)
      .map(([t, c]) => `${t}(${c})`)
      .join(', ');
    console.log(`         → messages: ${summary}`);

    const finalTranslation = result.messages.find((m) => m.type === 'translation.final');
    if (finalTranslation) {
      console.log(`         → source: "${finalTranslation.sourceText}"`);
      console.log(`         → translated: "${finalTranslation.translatedText}"`);
    }
  } else {
    console.log(`         → ERROR: ${result.error}`);
    if (result.details) console.log(`         → ${result.details}`);
  }
}

async function test3a_hybridMode(): Promise<PipelineTestResult> {
  console.log('\n--- 3a. Hybrid Mode (ASR → interim translation → final translation) ---\n');

  const result = await runPipelineTest(
    'Hybrid mode: banmal-01',
    { sourceLanguage: 'ko', targetLanguage: 'en', mode: 'hybrid' },
    'banmal-01',
    {
      requiredTypes: [
        'session.status',
        'transcription.interim',
        'transcription.final',
        'translation.interim',
        'translation.final',
      ],
      validateMessages: (msgs) => {
        const finalTranscript = msgs.find((m) => m.type === 'transcription.final');
        if (!finalTranscript?.text) return 'No text in transcription.final';

        const finalTranslation = msgs.find((m) => m.type === 'translation.final');
        if (!finalTranslation?.translatedText) return 'No translatedText in translation.final';
        if (typeof finalTranslation.translatedText !== 'string') return 'translatedText is not a string';

        if (finalTranscript.sentenceIndex === undefined) return 'Missing sentenceIndex on transcription.final';
        if (finalTranslation.sentenceIndex === undefined) return 'Missing sentenceIndex on translation.final';

        return null;
      },
    },
  );

  printResult(result);
  return result;
}

async function test3b_finalOnlyMode(): Promise<PipelineTestResult> {
  console.log('\n--- 3b. Final-Only Mode (no interim translation) ---\n');

  const result = await runPipelineTest(
    'Final-only mode: jondaenmal-01',
    { sourceLanguage: 'ko', targetLanguage: 'en', mode: 'final-only' },
    'jondaenmal-01',
    {
      requiredTypes: [
        'session.status',
        'transcription.final',
        'translation.final',
      ],
      forbiddenTypes: ['translation.interim'],
      validateMessages: (msgs) => {
        const finalTranslation = msgs.find((m) => m.type === 'translation.final');
        if (!finalTranslation?.translatedText) return 'No translatedText in translation.final';
        return null;
      },
    },
  );

  printResult(result);
  return result;
}

async function test3c_connectionLifecycle(): Promise<PipelineTestResult> {
  console.log('\n--- 3c. Connection Lifecycle (connect → start → end → close) ---\n');

  return new Promise<PipelineTestResult>((resolveTest) => {
    const messages: WSMessage[] = [];
    const ws = new WebSocket(WS_URL);
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.close();
      resolveTest({
        testName: 'Connection lifecycle',
        pass: false,
        messages,
        error: 'Timeout waiting for lifecycle completion',
      });
    }, 10000);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'session.start',
        config: { sourceLanguage: 'ko', targetLanguage: 'en', mode: 'hybrid' },
      }));
    });

    ws.on('message', (raw: Buffer) => {
      const msg: WSMessage = JSON.parse(raw.toString());
      messages.push(msg);

      if (msg.type === 'session.status' && msg.status === 'connected') {
        ws.send(JSON.stringify({ type: 'session.end' }));
        setTimeout(() => {
          ws.close();
        }, 500);
      }
    });

    ws.on('close', () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);

      const hasStatus = messages.some((m) => m.type === 'session.status' && m.status === 'connected');
      const hasError = messages.some((m) => m.type === 'error');

      const result: PipelineTestResult = {
        testName: 'Connection lifecycle',
        pass: hasStatus && !hasError,
        messages,
      };

      if (!hasStatus) result.error = 'Never received session.status connected';
      if (hasError) result.error = `Unexpected error: ${JSON.stringify(messages.find((m) => m.type === 'error'))}`;

      printResult(result);
      resolveTest(result);
    });

    ws.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const result: PipelineTestResult = {
        testName: 'Connection lifecycle',
        pass: false,
        messages,
        error: `WebSocket error: ${err.message}`,
      };
      printResult(result);
      resolveTest(result);
    });
  });
}

async function test3d_errorHandling(): Promise<PipelineTestResult> {
  console.log('\n--- 3d. Error Handling (audio before session.start) ---\n');

  return new Promise<PipelineTestResult>((resolveTest) => {
    const messages: WSMessage[] = [];
    const ws = new WebSocket(WS_URL);
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      ws.close();
      resolveTest({
        testName: 'Error: audio before session.start',
        pass: false,
        messages,
        error: 'Timeout — no error message received',
      });
    }, 5000);

    ws.on('open', () => {
      ws.send(Buffer.alloc(640));
    });

    ws.on('message', (raw: Buffer) => {
      const msg: WSMessage = JSON.parse(raw.toString());
      messages.push(msg);

      if (msg.type === 'error') {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        ws.close();

        const result: PipelineTestResult = {
          testName: 'Error: audio before session.start',
          pass: msg.code === 'NO_SESSION',
          messages,
        };
        if (msg.code !== 'NO_SESSION') {
          result.error = `Expected error code NO_SESSION, got ${String(msg.code)}`;
        }

        printResult(result);
        resolveTest(result);
      }
    });

    ws.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      const result: PipelineTestResult = {
        testName: 'Error: audio before session.start',
        pass: false,
        messages,
        error: `WebSocket error: ${err.message}`,
      };
      printResult(result);
      resolveTest(result);
    });
  });
}

async function main(): Promise<void> {
  if (!existsSync(FIXTURES_DIR)) {
    console.error('No fixtures directory. Run: docker compose exec server npx tsx scripts/generate-test-audio.ts');
    process.exit(1);
  }

  console.log('\n=== Phase 3: Full Pipeline WebSocket Tests ===');

  const results: PipelineTestResult[] = [];

  results.push(await test3a_hybridMode());
  results.push(await test3b_finalOnlyMode());
  results.push(await test3c_connectionLifecycle());
  results.push(await test3d_errorHandling());

  const allPassed = results.every((r) => r.pass);

  console.log('\n' + '='.repeat(50));
  console.log(allPassed ? 'Phase 3: ALL PASSED' : 'Phase 3: SOME FAILURES');
  console.log('='.repeat(50) + '\n');

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Phase 3 test failed:', err);
  process.exit(1);
});
