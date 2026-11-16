import { mixStereoForAnalysis, resampleMonoToWav } from '../../src/capture';

async function check() {
  const frames = 48_000;
  const context = new OfflineAudioContext(1, frames, 48_000);
  await context.audioWorklet.addModule('/audio-capture-worklet.js');
  const node = new AudioWorkletNode(context, 'anime-song-capture', {
    numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], processorOptions: { maxFrames: frames },
  });
  const left: Float32Array[] = [], right: Float32Array[] = [];
  let done!: () => void;
  const completed = new Promise<void>(resolve => { done = resolve; });
  node.port.onmessage = event => {
    if (event.data.type === 'data') { left.push(event.data.left); right.push(event.data.right); }
    if (event.data.type === 'done') done();
  };
  const buffer = context.createBuffer(2, frames, 48_000);
  const a = buffer.getChannelData(0), b = buffer.getChannelData(1);
  for (let i = 0; i < frames; i++) {
    a[i] = 0.3 * Math.sin(2 * Math.PI * 1000 * i / 48000);
    b[i] = 0.1 * Math.sin(2 * Math.PI * 1000 * i / 48000);
  }
  const source = context.createBufferSource(); source.buffer = buffer;
  source.connect(node); node.connect(context.destination); source.start();
  const rendered = await context.startRendering();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { await Promise.race([completed, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Worklet completion not received.')), 2000); })]); }
  finally { if (timer) clearTimeout(timer); node.port.close(); node.disconnect(); }
  const total = left.reduce((sum, part) => sum + part.length, 0);
  const samples = new Float32Array(total);
  let offset = 0;
  left.forEach((part, index) => { const mono = mixStereoForAnalysis(part, right[index]!); samples.set(mono, offset); offset += mono.length; });
  const wav = await resampleMonoToWav(samples, 48000);
  const bytes = new DataView(await wav.arrayBuffer());
  let peak = 0; for (const value of samples) peak = Math.max(peak, Math.abs(value));
  let outputPeak = 0; for (const value of rendered.getChannelData(0)) outputPeak = Math.max(outputPeak, Math.abs(value));
  return { passed: total === frames && wav.size === 64044 && bytes.getUint32(24, true) === 32000 && Math.abs(peak - 0.2) < 0.005 && outputPeak === 0,
    frames: total, batches: left.length, wavBytes: wav.size, wavRate: bytes.getUint32(24, true), mixedPeak: peak, processorOutputPeak: outputPeak,
    scope: 'Actual packaged AudioWorklet and production mixing/WAV resampling in Chrome offline audio engine. Synthetic stereo input; no tab capture or song recognition.' };
}
async function report(result: unknown) {
  document.getElementById('result')!.textContent = JSON.stringify(result);
  await fetch('/result', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(result) });
}
void check().then(report).catch(error => report({ passed: false, error: String(error) }));
