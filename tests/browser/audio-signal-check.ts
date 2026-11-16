import { resampleMonoToWav } from '../../src/capture';

const SOURCE_RATE = 48_000;
const SOURCE_SECONDS = 1;
const SOURCE_FRAMES = SOURCE_RATE * SOURCE_SECONDS;
const OUTPUT_RATE = 32_000;
const LEGACY_RATE = 8_000;
const TONES = [
  { frequency: 1_000, amplitude: 0.20, label: '1 kHz reference' },
  { frequency: 6_000, amplitude: 0.15, label: '6 kHz detail' },
  { frequency: 10_000, amplitude: 0.10, label: '10 kHz detail', invert: true },
] as const;

type Check = { name: string; passed: boolean; observed: string; requirement: string };

function getUi(): { status: HTMLElement; summary: HTMLElement; rows: HTMLTableSectionElement } {
  const status = document.querySelector<HTMLElement>('#run-status');
  const summary = document.querySelector<HTMLElement>('#summary');
  const rows = document.querySelector<HTMLTableSectionElement>('#results');
  if (!status || !summary || !rows) throw new Error('The diagnostic result elements are missing.');
  return { status, summary, rows };
}

function addCheck(checks: Check[], name: string, value: number, requirement: string, passed: boolean, digits = 3): void {
  checks.push({ name, passed, observed: Number.isFinite(value) ? value.toFixed(digits) : 'non-finite', requirement });
}

async function renderToneMix(): Promise<Float32Array> {
  const context = new OfflineAudioContext(1, SOURCE_FRAMES, SOURCE_RATE);
  for (const tone of TONES) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = tone.frequency;
    gain.gain.value = tone.amplitude * ('invert' in tone && tone.invert ? -1 : 1);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(0);
    oscillator.stop(SOURCE_SECONDS);
  }
  const rendered = await context.startRendering();
  return new Float32Array(rendered.getChannelData(0));
}

async function renderTone(amplitude: number, frequency: number): Promise<Float32Array> {
  const context = new OfflineAudioContext(1, SOURCE_FRAMES, SOURCE_RATE);
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gain.gain.value = amplitude;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(0);
  oscillator.stop(SOURCE_SECONDS);
  const rendered = await context.startRendering();
  return new Float32Array(rendered.getChannelData(0));
}

function amplitudeAt(samples: Float32Array, sampleRate: number, frequency: number): number {
  let real = 0;
  let imaginary = 0;
  const angularStep = 2 * Math.PI * frequency / sampleRate;
  for (let index = 0; index < samples.length; index++) {
    const angle = angularStep * index;
    const value = samples[index] ?? 0;
    real += value * Math.cos(angle);
    imaginary -= value * Math.sin(angle);
  }
  return 2 * Math.hypot(real, imaginary) / samples.length;
}

async function decodePcm16(blob: Blob): Promise<{ samples: Float32Array; sampleRate: number; channels: number; format: number; clipped: number; peak: number }> {
  const bytes = await blob.arrayBuffer();
  if (bytes.byteLength < 44) throw new Error('Output WAV is shorter than its header.');
  const view = new DataView(bytes);
  const readText = (offset: number, length: number) => Array.from({ length }, (_, i) => String.fromCharCode(view.getUint8(offset + i))).join('');
  if (readText(0, 4) !== 'RIFF' || readText(8, 4) !== 'WAVE' || readText(36, 4) !== 'data') {
    throw new Error('Output does not have the expected PCM WAV header.');
  }
  const format = view.getUint16(20, true);
  const channels = view.getUint16(22, true);
  const sampleRate = view.getUint32(24, true);
  const bitsPerSample = view.getUint16(34, true);
  if (format !== 1 || channels !== 1 || bitsPerSample !== 16) {
    throw new Error(`Expected mono PCM16; found format ${format}, ${channels} channels, ${bitsPerSample} bits.`);
  }
  const dataLength = view.getUint32(40, true);
  if (44 + dataLength > bytes.byteLength || dataLength % 2 !== 0) throw new Error('WAV data chunk has an invalid length.');
  const samples = new Float32Array(dataLength / 2);
  let peak = 0;
  let clipped = 0;
  for (let index = 0; index < samples.length; index++) {
    const integer = view.getInt16(44 + index * 2, true);
    if (Math.abs(integer) >= 32767) clipped++;
    const sample = integer / 32768;
    samples[index] = sample;
    peak = Math.max(peak, Math.abs(sample));
  }
  return { samples, sampleRate, channels, format, clipped, peak };
}

async function legacyEightKhz(samples: Float32Array): Promise<Float32Array> {
  // This mirrors the former OfflineAudioContext target rate, using the browser's real resampler.
  const outputLength = Math.ceil(samples.length * LEGACY_RATE / SOURCE_RATE);
  const context = new OfflineAudioContext(1, outputLength, LEGACY_RATE);
  const buffer = context.createBuffer(1, samples.length, SOURCE_RATE);
  buffer.copyToChannel(new Float32Array(samples), 0);
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  source.start();
  return new Float32Array((await context.startRendering()).getChannelData(0));
}

function renderResults(checks: Check[]): void {
  const { status, summary, rows } = getUi();
  rows.innerHTML = '';
  for (const check of checks) {
    const row = document.createElement('tr');
    row.innerHTML = `<th scope="row"></th><td></td><td></td><td></td>`;
    row.cells[0]!.textContent = check.name;
    row.cells[1]!.textContent = check.passed ? 'PASS' : 'FAIL';
    row.cells[1]!.className = check.passed ? 'pass' : 'fail';
    row.cells[2]!.textContent = check.observed;
    row.cells[3]!.textContent = check.requirement;
    rows.append(row);
  }
  const passed = checks.filter((check) => check.passed).length;
  const allPassed = passed === checks.length;
  summary.textContent = `${allPassed ? 'PASS' : 'FAIL'} — ${passed} of ${checks.length} checks passed.`;
  summary.className = allPassed ? 'pass' : 'fail';
  status.textContent = allPassed ? 'Synthetic audio check complete: all checks passed.' : 'Synthetic audio check complete: one or more checks failed.';
  status.className = allPassed ? 'pass' : 'fail';
}

async function run(): Promise<void> {
  const { status, summary } = getUi();
  status.textContent = 'Running browser OfflineAudioContext checks…';
  try {
    const checks: Check[] = [];
    const original = await renderToneMix();
    const wav = await resampleMonoToWav(original, SOURCE_RATE);
    const decoded = await decodePcm16(wav);

    addCheck(checks, 'WAV sample rate', decoded.sampleRate, '32,000 Hz', decoded.sampleRate === OUTPUT_RATE, 0);
    addCheck(checks, 'WAV duration', decoded.samples.length / decoded.sampleRate, '1.000 s ± 0.001 s', Math.abs(decoded.samples.length / decoded.sampleRate - SOURCE_SECONDS) <= 0.001, 3);
    addCheck(checks, 'WAV channels', decoded.channels, '1 mono channel', decoded.channels === 1, 0);
    addCheck(checks, 'WAV PCM format', decoded.format, '1 (integer PCM16)', decoded.format === 1, 0);
    addCheck(checks, 'Peak level', decoded.peak, '< 0.99 full scale', decoded.peak < 0.99, 3);
    addCheck(checks, 'Clipped PCM samples', decoded.clipped, '0 samples at int16 rails', decoded.clipped === 0, 0);

    const sourceAmplitudes = new Map(TONES.map((tone) => [tone.frequency, amplitudeAt(original, SOURCE_RATE, tone.frequency)]));
    for (const tone of TONES) {
      const measured = amplitudeAt(decoded.samples, decoded.sampleRate, tone.frequency);
      const reference = sourceAmplitudes.get(tone.frequency) ?? tone.amplitude;
      const ratio = measured / reference;
      addCheck(checks, `${tone.label} retained at 32 kHz`, ratio, 'amplitude ratio ≥ 0.80', ratio >= 0.80, 3);
    }

    const legacyReference = await renderTone(TONES[0].amplitude, TONES[0].frequency);
    const legacyLow = await legacyEightKhz(legacyReference);
    const legacyLowRatio = amplitudeAt(legacyLow, LEGACY_RATE, TONES[0].frequency) / amplitudeAt(legacyReference, SOURCE_RATE, TONES[0].frequency);
    addCheck(checks, 'Legacy 8 kHz retains 1 kHz reference', legacyLowRatio, 'amplitude ratio ≥ 0.80', legacyLowRatio >= 0.80, 3);

    for (const tone of TONES.slice(1)) {
      const isolated = await renderTone(tone.amplitude, tone.frequency);
      const legacy = await legacyEightKhz(isolated);
      const aliasFrequency = LEGACY_RATE - tone.frequency;
      const ratio = amplitudeAt(legacy, LEGACY_RATE, aliasFrequency) / amplitudeAt(isolated, SOURCE_RATE, tone.frequency);
      addCheck(checks, `Legacy 8 kHz suppresses ${tone.frequency / 1_000} kHz detail`, ratio, 'aliased amplitude ratio ≤ 0.10', ratio <= 0.10, 3);
    }

    renderResults(checks);
  } catch (error) {
    summary.textContent = `FAIL — ${error instanceof Error ? error.message : String(error)}`;
    summary.className = 'fail';
    status.textContent = 'Synthetic audio check failed before all measurements completed.';
    status.className = 'fail';
  }
}

void run();
