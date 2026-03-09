import { describe, it, expect } from 'vitest';
import { resampleLinear, float32ToPcm16 } from '../src/audio/resampler.js';

describe('resampleLinear', () => {
  it('returns input unchanged when rates match', () => {
    const input = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const result = resampleLinear(input, 16000);
    expect(result).toBe(input);
  });

  it('downsamples 48kHz to 16kHz (3:1 ratio)', () => {
    const input = new Float32Array(480);
    for (let i = 0; i < 480; i++) input[i] = Math.sin(2 * Math.PI * i / 480);
    const result = resampleLinear(input, 48000);
    expect(result.length).toBe(160);
  });

  it('downsamples 44100Hz to 16kHz', () => {
    const input = new Float32Array(441);
    const result = resampleLinear(input, 44100);
    expect(result.length).toBe(160);
  });

  it('preserves signal amplitude approximately', () => {
    const input = new Float32Array(300);
    input.fill(0.5);
    const result = resampleLinear(input, 48000);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBeCloseTo(0.5, 3);
    }
  });
});

describe('float32ToPcm16', () => {
  it('converts silence (zeros) correctly', () => {
    const input = new Float32Array(10);
    input.fill(0);
    const result = new Int16Array(float32ToPcm16(input));
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBe(0);
    }
  });

  it('converts max positive (1.0) to 32767', () => {
    const input = new Float32Array([1.0]);
    const result = new Int16Array(float32ToPcm16(input));
    expect(result[0]).toBe(32767);
  });

  it('converts max negative (-1.0) to -32768', () => {
    const input = new Float32Array([-1.0]);
    const result = new Int16Array(float32ToPcm16(input));
    expect(result[0]).toBe(-32768);
  });

  it('clamps values beyond [-1, 1]', () => {
    const input = new Float32Array([1.5, -1.5]);
    const result = new Int16Array(float32ToPcm16(input));
    expect(result[0]).toBe(32767);
    expect(result[1]).toBe(-32768);
  });

  it('preserves correct output length', () => {
    const input = new Float32Array(320);
    const result = new Int16Array(float32ToPcm16(input));
    expect(result.length).toBe(320);
  });
});
