// Usage: docker compose exec server npx tsx scripts/test-phase2.ts

import { GoogleNmtEngine } from '../src/translation/nmt.js';
import { GoogleTllmEngine } from '../src/translation/llm.js';
import { ClaudeEngine } from '../src/translation/claude.js';
import { OpenAIEngine } from '../src/translation/openai.js';
import type { ITranslationEngine, TranslationResult } from '../src/translation/types.js';

const TEST_SENTENCES = [
  { korean: '나 오늘 너무 피곤해', register: '반말', gist: "I'm so tired today" },
  { korean: '저는 오늘 너무 피곤합니다', register: '존댓말', gist: "I'm so tired today" },
  { korean: '이거 어떻게 하는 거야?', register: '반말', gist: 'How do you do this?' },
  { korean: '밥 먹었어?', register: '반말', gist: 'Have you eaten?' },
  { korean: '그것은 정말 대단합니다', register: '존댓말', gist: "That's really amazing" },
];

interface TestResult {
  engine: string;
  sentence: string;
  register: string;
  translated: string;
  latencyMs: number;
  pass: boolean;
  error?: string;
}

async function testEngine(
  name: string,
  engine: ITranslationEngine,
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const s of TEST_SENTENCES) {
    try {
      const result: TranslationResult = await engine.translate(s.korean, 'ko', 'en');
      const pass = result.translatedText.length > 0;
      results.push({
        engine: name,
        sentence: s.korean,
        register: s.register,
        translated: result.translatedText,
        latencyMs: result.latencyMs,
        pass,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({
        engine: name,
        sentence: s.korean,
        register: s.register,
        translated: '',
        latencyMs: 0,
        pass: false,
        error,
      });
    }
  }

  return results;
}

function printResults(results: TestResult[]): void {
  for (const r of results) {
    const status = r.pass ? ' PASS ' : ' FAIL ';
    const latency = r.pass ? `${r.latencyMs}ms` : r.error ?? 'unknown error';
    console.log(`  ${status} [${r.register}] "${r.sentence}"`);
    if (r.pass) {
      console.log(`         → "${r.translated}" (${latency})`);
    } else {
      console.log(`         → ERROR: ${latency}`);
    }
  }
}

async function main(): Promise<void> {
  const projectId = process.env.GOOGLE_TRANSLATION_PROJECT_ID ?? '';
  const location = process.env.GOOGLE_TRANSLATION_LOCATION ?? 'us-central1';
  const claudeKey = process.env.CLAUDE_API_KEY ?? '';
  const openaiKey = process.env.OPENAI_API_KEY ?? '';

  let allPassed = true;

  console.log('\n=== 2a. Google NMT (Interim) ===\n');
  if (!projectId) {
    console.log('  SKIP  GOOGLE_TRANSLATION_PROJECT_ID not set');
  } else {
    const nmt = new GoogleNmtEngine(projectId);
    const results = await testEngine('google-nmt', nmt);
    printResults(results);
    if (results.some((r) => !r.pass)) allPassed = false;
    await nmt.destroy();
  }

  console.log('\n=== 2b. Google TLLM (Final) ===\n');
  if (!projectId) {
    console.log('  SKIP  GOOGLE_TRANSLATION_PROJECT_ID not set');
  } else {
    const tllm = new GoogleTllmEngine(projectId, location);
    const results = await testEngine('google-tllm', tllm);
    printResults(results);
    if (results.some((r) => !r.pass)) allPassed = false;
    await tllm.destroy();
  }

  console.log('\n=== 2c. Claude ===\n');
  if (!claudeKey) {
    console.log('  SKIP  CLAUDE_API_KEY not set');
  } else {
    const claude = new ClaudeEngine(claudeKey);
    const results = await testEngine('claude', claude);
    printResults(results);
    if (results.some((r) => !r.pass)) allPassed = false;
    await claude.destroy();
  }

  console.log('\n=== 2d. OpenAI GPT ===\n');
  if (!openaiKey) {
    console.log('  SKIP  OPENAI_API_KEY not set');
  } else {
    const openai = new OpenAIEngine(openaiKey);
    const results = await testEngine('openai', openai);
    printResults(results);
    if (results.some((r) => !r.pass)) allPassed = false;
    await openai.destroy();
  }

  console.log('\n' + '='.repeat(50));
  console.log(allPassed ? 'Phase 2: ALL PASSED' : 'Phase 2: SOME FAILURES');
  console.log('='.repeat(50) + '\n');

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Phase 2 test failed:', err);
  process.exit(1);
});
