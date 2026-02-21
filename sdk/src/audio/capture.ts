import { resampleLinear, float32ToPcm16 } from './resampler.js';

const TARGET_SAMPLE_RATE = 16000;
const FRAME_DURATION_MS = 20;
const SAMPLES_PER_FRAME = TARGET_SAMPLE_RATE * FRAME_DURATION_MS / 1000;

const WORKLET_PROCESSOR_CODE = `
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      this.port.postMessage(input[0]);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

export type AudioFrameCallback = (pcm16Frame: ArrayBuffer) => void;

export class AudioCapture {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private frameBuffer = new Float32Array(0);
  private onFrame: AudioFrameCallback | null = null;
  private _active = false;

  get active(): boolean {
    return this._active;
  }

  async start(onFrame: AudioFrameCallback): Promise<void> {
    this.onFrame = onFrame;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    this.context = new AudioContext();
    const nativeSampleRate = this.context.sampleRate;

    const blob = new Blob([WORKLET_PROCESSOR_CODE], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    await this.context.audioWorklet.addModule(url);
    URL.revokeObjectURL(url);

    this.source = this.context.createMediaStreamSource(this.stream);
    this.workletNode = new AudioWorkletNode(this.context, 'pcm-processor');

    this.workletNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
      this.processAudioData(event.data, nativeSampleRate);
    };

    this.source.connect(this.workletNode);
    this.workletNode.connect(this.context.destination);
    this._active = true;
  }

  stop(): void {
    this._active = false;

    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.context) {
      void this.context.close();
      this.context = null;
    }
    this.frameBuffer = new Float32Array(0);
  }

  getSampleRate(): number {
    return this.context?.sampleRate ?? 0;
  }

  private processAudioData(rawSamples: Float32Array, nativeSampleRate: number): void {
    const resampled = resampleLinear(rawSamples, nativeSampleRate);

    const merged = new Float32Array(this.frameBuffer.length + resampled.length);
    merged.set(this.frameBuffer);
    merged.set(resampled, this.frameBuffer.length);
    this.frameBuffer = merged;

    while (this.frameBuffer.length >= SAMPLES_PER_FRAME) {
      const frame = this.frameBuffer.slice(0, SAMPLES_PER_FRAME);
      this.frameBuffer = this.frameBuffer.slice(SAMPLES_PER_FRAME);
      const pcm16 = float32ToPcm16(frame);
      this.onFrame?.(pcm16);
    }
  }
}
