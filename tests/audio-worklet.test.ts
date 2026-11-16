import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../public/audio-capture-worklet.js', import.meta.url), 'utf8');

interface WorkletHarness {
  new(options: { processorOptions: { maxFrames: number } }): {
    process(inputs: Float32Array[][], outputs: Float32Array[][]): boolean;
    port: { onmessage: ((event: { data: { type: string } }) => void) | null; postMessage: (message: unknown) => void };
  };
}

function loadWorklet(): { Processor: WorkletHarness; messages: Array<{ type: string; left?: Float32Array; right?: Float32Array }> } {
  let Processor: WorkletHarness | undefined;
  const messages: Array<{ type: string; left?: Float32Array; right?: Float32Array }> = [];
  class FakeAudioWorkletProcessor {
    port = { onmessage: null as ((event: { data: { type: string } }) => void) | null, postMessage: (message: unknown) => messages.push(message as typeof messages[number]) };
  }
  runInNewContext(source, {
    AudioWorkletProcessor: FakeAudioWorkletProcessor,
    registerProcessor: (_name: string, constructor: WorkletHarness) => { Processor = constructor; },
  });
  if (!Processor) throw new Error('Worklet did not register its processor.');
  return { Processor, messages };
}

describe('audio capture worklet', () => {
  it('copies stereo input into bounded batches, silences output, and stops at maxFrames', () => {
    const { Processor, messages } = loadWorklet();
    const processor = new Processor({ processorOptions: { maxFrames: 5000 } });
    const left = new Float32Array(128).fill(0.25);
    const right = new Float32Array(128).fill(-0.5);
    const output = new Float32Array(128).fill(1);

    for (let i = 0; i < 100 && messages.at(-1)?.type !== 'done'; i++) {
      processor.process([[left, right]], [[output]]);
      expect(output.every((sample) => sample === 0)).toBe(true);
    }

    const batches = messages.filter((message) => message.type === 'data');
    expect(batches.map((batch) => batch.left?.length)).toEqual([4096, 904]);
    expect(batches.reduce((sum, batch) => sum + (batch.left?.length ?? 0), 0)).toBe(5000);
    expect(batches[0]?.left?.[0]).toBe(0.25);
    expect(batches[0]?.right?.[0]).toBe(-0.5);
    expect(messages.at(-1)?.type).toBe('done');
    expect(processor.process([[left, right]], [[output]])).toBe(false);
    expect(messages.filter((message) => message.type === 'data').reduce((sum, batch) => sum + (batch.left?.length ?? 0), 0)).toBe(5000);
  });

  it('flushes a partial batch when the main thread requests stop', () => {
    const { Processor, messages } = loadWorklet();
    const processor = new Processor({ processorOptions: { maxFrames: 20_000 } });
    processor.process([[new Float32Array(128).fill(0.75)]], [[]]);
    processor.port.onmessage?.({ data: { type: 'stop' } });
    expect(messages.map((message) => message.type)).toEqual(['data', 'done']);
    expect(messages[0]?.left?.length).toBe(128);
    expect(messages[0]?.right?.[127]).toBe(0.75);
  });
});
