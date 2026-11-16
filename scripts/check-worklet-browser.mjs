import { build } from 'esbuild';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
const bundle = await build({ entryPoints: ['tests/browser/worklet-check.ts'], bundle: true, write: false, format: 'iife', target: 'chrome120' });
const script = bundle.outputFiles[0].text;
const worklet = await readFile('public/audio-capture-worklet.js');
let reported;
const heldResponses = new Set();
const server = createServer((request, response) => {
  if (request.url === '/audio-capture-worklet.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(worklet); return; }
  if (request.url === '/hold') {
    if (reported) response.end('done');
    else heldResponses.add(response);
    return;
  }
  if (request.url === '/result' && request.method === 'POST') {
    let body = '';
    request.on('data', chunk => { body += chunk; if (body.length > 10000) request.destroy(); });
    request.on('end', () => {
      try { reported = JSON.parse(body); } catch { reported = { passed: false, error: 'Invalid harness result.' }; }
      response.end('done');
      for (const held of heldResponses) held.end('done');
      heldResponses.clear();
    });
    return;
  }
  response.setHeader('Content-Type', 'text/html');
  response.end(`<!doctype html><title>Synthetic worklet test</title><pre id="result">PENDING</pre><iframe src="/hold" hidden></iframe><script>${script}</script>`);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
await mkdir('local-data/worklet-browser-profile', { recursive: true });
const profile = path.resolve('local-data/worklet-browser-profile');
try {
  const browser = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new', '--no-first-run', '--no-default-browser-check', `--user-data-dir=${profile}`,
    '--dump-dom', `http://127.0.0.1:${server.address().port}/`,
  ], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; browser.stdout.on('data', value => { output += value.toString(); });
  // Chromium diagnostic stderr is not needed; the harness records its own result.
  browser.stderr.resume();
  const timer = setTimeout(() => browser.kill(), 30000);
  const exitCode = await new Promise((resolve, reject) => { browser.once('error', reject); browser.once('exit', resolve); });
  clearTimeout(timer);
  const encoded = output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];
  const decoded = encoded?.replaceAll('&quot;', '"').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');
  let result = reported;
  if (!result) try { result = JSON.parse(decoded); } catch { result = { passed: false, error: 'Browser did not finish the synthetic harness.', exitCode }; }
  await writeFile('docs/WORKLET_BROWSER_RESULTS.json', JSON.stringify({ date: new Date().toISOString(), ...result }, null, 2) + '\n');
  console.log(JSON.stringify(result));
  if (!result.passed) process.exitCode = 1;
} finally {
  for (const held of heldResponses) held.end('stopped');
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
