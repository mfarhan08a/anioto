// Store artwork renders the actual built popup with clearly labeled example data.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'docs/store-assets');
const browser = process.env.ANIOTO_SCREENSHOT_BROWSER ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
await mkdir(output, { recursive: true });
const views = {
  result: { title: 'Find the anime<br>behind the song.', detail: 'Song credits, anime titles, and source links<br>in one compact result.', note: 'Illustrative result · example song data' },
  search: { title: 'Search by<br>song title.', detail: 'Enter a song title and artist to explore<br>its documented anime connections.', note: 'Interface preview · manual song search' },
  loading: { title: 'Follow every<br>step of a scan.', detail: 'See the current step and elapsed time.<br>Cancel whenever you need to.', note: 'Interface preview · simulated scan progress' },
};

function shim(view) {
  const now = Date.now();
  const result = {
    song: { title: 'Sign', artist: 'FLOW' },
    anime: [{ id: 1735, title: 'Naruto Shippuden', romajiTitle: 'NARUTO: Shippuuden', type: 'Opening 6', matchKind: 'confirmed', sourceUrl: 'https://anisongdb.com/', evidence: 'Example display of the documented Sign opening credit by FLOW.' }],
  };
  const job = view === 'result' ? { id: 'store-example', stage: 'complete', message: 'Song and anime associations found.', result, startedAt: now - 8000, finishedAt: now }
    : view === 'loading' ? { id: 'store-progress', stage: 'listening and recognizing', message: 'Checking the 3-second sample while listening continues.', startedAt: now - 3000, stageStartedAt: now - 3000, captureSeconds: 12 } : null;
  return `const exampleJob=${JSON.stringify(job)};window.chrome={storage:{session:{get:async()=>({job:exampleJob})},local:{get:async()=>({history:[]})},onChanged:{addListener(){}}},runtime:{getURL:p=>location.origin+'/'+p,sendMessage:async()=>({ok:true}),openOptionsPage:async()=>{}}};window.addEventListener('load',()=>{${view === 'search' ? "document.getElementById('nav-search').click();document.getElementById('title').value='Akuma no Ko';document.getElementById('artist').value='Ai Higuchi';" : ''}});`;
}

const assets = new Set(['style.css', 'anioto.css', 'anioto-tokens.css', 'anioto-manga.jpg', 'anioto-icons.svg', 'popup.js']);
const types = { '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const view = Object.hasOwn(views, url.searchParams.get('view')) ? url.searchParams.get('view') : 'result';
    if (url.pathname === '/') {
      const copy = views[view];
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Anioto store screenshot</title><style>
        *{box-sizing:border-box}body{margin:0;width:1280px;height:800px;background:#f6f3eb;color:#202020;font-family:'Segoe UI',Arial,sans-serif}
        header{display:flex;align-items:center;gap:12px;margin:48px 100px 0;font-size:30px;font-weight:800}header img{width:46px;height:46px}header small{font-size:13px;letter-spacing:3px;color:#a51c25;margin-left:12px}
        main{display:grid;grid-template-columns:1fr 390px;align-items:center;gap:80px;margin:30px 100px}h1{font-size:58px;line-height:1.05;letter-spacing:-2px;margin:0 0 28px;font-weight:850}h1:before{content:'';display:block;width:52px;height:6px;background:#b91c2c;margin-bottom:30px}
        p{font-size:20px;line-height:1.6;margin:0;color:#4e4b46}iframe{width:390px;height:560px;border:0;box-shadow:0 12px 35px #2422201c;border-radius:5px}footer{position:absolute;left:100px;bottom:44px;font-size:13px;color:#625d54}
      </style><header><img src="/logo.png" alt="">anioto <small>アニオト</small></header><main><section><h1>${copy.title}</h1><p>${copy.detail}</p></section><iframe title="Anioto interface" src="/popup.html?view=${view}"></iframe></main><footer>${copy.note}</footer></html>`);
      return;
    }
    if (url.pathname === '/popup.html') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      const html = await readFile(path.join(root, 'dist/popup.html'), 'utf8');
      response.end(html.replace('<script src="popup.js">', `<script>${shim(view)}</script><script src="popup.js">`));
      return;
    }
    if (url.pathname === '/logo.png') {
      response.setHeader('Content-Type', 'image/png');
      response.end(await readFile(path.join(root, 'public/anioto-icon.png')));
      return;
    }
    const file = url.pathname.slice(1);
    if (!assets.has(file)) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', types[path.extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(path.join(root, 'dist', file)));
  } catch { response.writeHead(500).end('Screenshot rendering failed.'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
try {
  const port = server.address().port;
  for (const view of Object.keys(views)) {
    const file = path.join(output, `anioto-${view}.png`);
    const profile = path.join(root, 'local-data', `store-render-${crypto.randomUUID()}`);
    await new Promise((resolve, reject) => {
      const child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1', '--window-size=1280,800', '--virtual-time-budget=2000', `--user-data-dir=${profile}`, `--screenshot=${file}`, `http://127.0.0.1:${port}/?view=${view}`], { windowsHide: true, stdio: 'ignore' });
      const timer = setTimeout(() => { child.kill(); reject(new Error(`Screenshot timed out for ${view}`)); }, 30_000);
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); code === 0 ? resolve() : reject(new Error(`Screenshot failed for ${view} with ${code}`)); });
    });
    const png = await readFile(file);
    if (png.readUInt32BE(16) !== 1280 || png.readUInt32BE(20) !== 800) throw new Error(`Unexpected screenshot dimensions for ${view}`);
    console.log(file);
  }
} finally { server.close(); }
