import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(projectRoot, 'local-data');
const outputPath = path.join(outputDirectory, 'audio-signal-check.html');

await mkdir(outputDirectory, { recursive: true });
const bundle = await build({
  absWorkingDir: projectRoot,
  entryPoints: ['tests/browser/audio-signal-check.ts'],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  target: 'chrome120',
  sourcemap: false,
});
const script = bundle.outputFiles[0].text;

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Audio resampling signal check</title>
  <style>
    :root { color-scheme: light dark; font: 16px/1.5 system-ui, sans-serif; }
    body { max-width: 900px; margin: 2.5rem auto; padding: 0 1rem; }
    h1 { font-size: 1.6rem; }
    .scope { padding: 1rem; border-left: 4px solid #4787d1; background: color-mix(in srgb, CanvasText 7%, Canvas); }
    #summary { font-weight: 700; margin: 1.5rem 0 .75rem; }
    .pass { color: #16823b; } .fail { color: #c53131; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: .6rem .5rem; border-bottom: 1px solid color-mix(in srgb, CanvasText 20%, Canvas); }
    thead th { font-size: .9rem; }
    #run-status { margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>32 kHz audio resampling check</h1>
  <p class="scope">Synthetic-only browser check. Web Audio generates a deterministic 48 kHz mono signal containing 1, 6, and 10 kHz tones. The actual capture resampler encodes it as WAV; the browser then reads the WAV header and measures PCM tone amplitudes. The legacy comparison runs the same browser OfflineAudioContext resampler at 8 kHz. No microphone, tab capture, upload, network request, or API key is used.</p>
  <p id="summary" aria-live="polite">Running checks…</p>
  <table>
    <thead><tr><th scope="col">Measurement</th><th scope="col">Result</th><th scope="col">Observed</th><th scope="col">Requirement</th></tr></thead>
    <tbody id="results"></tbody>
  </table>
  <p id="run-status" role="status" aria-live="polite">Starting browser OfflineAudioContext checks…</p>
  <script>${script}</script>
</body>
</html>
`;

await writeFile(outputPath, html, 'utf8');
console.log(`Built synthetic browser audio check: ${outputPath}`);
