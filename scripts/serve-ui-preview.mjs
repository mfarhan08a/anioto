// Development-only visual fixture server. It serves the actual built popup with
// in-memory browser storage/messages; it cannot capture or submit real audio.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
const reports = new Map();
const a11yCheck = `let auditTimer;const audit=()=>{clearTimeout(auditTimer);auditTimer=setTimeout(async()=>{if(!window.axe)return;try{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa','wcag22aa']}});const view=[...document.querySelectorAll('.view-panel')].find(e=>!e.hidden)?.id;const report={view,loading:!document.getElementById('progress').hidden,violations:r.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>({target:n.target,failureSummary:n.failureSummary}))}))};document.getElementById('fixture-a11y').textContent=JSON.stringify(report);await fetch('/a11y-report',{method:'POST',body:JSON.stringify(report)});}catch(e){document.getElementById('fixture-a11y').textContent=String(e);}},180);};window.addEventListener('load',audit);document.addEventListener('click',audit);`;
const fixture = {
  id: 'ui-fixture', stage: 'complete', message: 'Song and anime associations found.', startedAt: Date.now() - 8000, finishedAt: Date.now(),
  result: { song: { title: 'CHE.R.RY', artist: 'アーリャ (CV: 上坂すみれ)', album: 'A long album title for layout verification' }, anime: [
    { id: 1, title: 'Alya Sometimes Hides Her Feelings in Russian', type: 'Ending 8', matchKind: 'possible', evidence: 'The catalog credits CHE.R.RY to Sumire Uesaka. The recognized character credit has not been verified as the same performer.', sourceUrl: 'https://anisongdb.com/', coverUrl: 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/small/bx162804-TBeptcAfvqTd.jpg' },
    { id: 2, title: 'ReLIFE: Final Arc', type: 'Ending 2', matchKind: 'possible', evidence: 'The catalog lists YUI. The recognized performer differs, so this is a possible underlying-song connection.', sourceUrl: 'https://anisongdb.com/' },
  ] },
};
const shim = `const initial=${JSON.stringify(fixture)};let job=location.search.includes('empty')?undefined:initial;const listeners=[];const local={history:[{id:'ui-fixture',result:initial.result}]};window.chrome={storage:{session:{get:async()=>({job})},local:{get:async()=>local,set:async v=>Object.assign(local,v),remove:async key=>{delete local[key]}},onChanged:{addListener:f=>listeners.push(f)}},runtime:{getURL:p=>location.origin+'/'+p,openOptionsPage:async()=>{},sendMessage:async m=>{if(m.type==='START'){job={id:'preview-listening',stage:'listening and recognizing',message:'Checking the 3-second sample while listening continues.',startedAt:Date.now(),stageStartedAt:Date.now()};}else if(m.type==='CANCEL'){job={...job,stage:'cancelled',message:'Identification cancelled.',finishedAt:Date.now()};}else if(m.type==='LOOKUP'){job={...initial,id:'manual-fixture',result:{...initial.result,song:m.song}};}listeners.forEach(f=>f({job:{newValue:job}},'session'));return{ok:true};}}};`;
createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  try {
    if (pathname === '/a11y-report' && request.method === 'POST') {
      let raw = ''; for await (const chunk of request) { raw += chunk; if (raw.length > 65536) { response.writeHead(413).end(); return; } }
      const report = JSON.parse(raw); reports.set(`${report.view}:${report.loading}`, report);
      await writeFile('docs/OTONE_A11Y_RESULTS.json', JSON.stringify({ date: new Date().toISOString(), scope: 'axe-core 4.10.3 WCAG tags on built-popup mocked browser fixtures; not a conformance claim.', reports: [...reports.values()] }, null, 2));
      response.end('saved'); return;
    }
    if (pathname === '/axe.min.js') { response.setHeader('Content-Type', 'text/javascript'); response.end(await readFile('local-data/axe.min.js')); return; }
    if (pathname === '/cover.svg') {
      response.setHeader('Content-Type', 'image/svg+xml');
      response.end('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="112"><rect width="80" height="112" fill="#718898"/><path d="M0 80L80 18V112H0Z" fill="#c7b0cf"/><text x="8" y="100" font-family="sans-serif" font-size="13" fill="#172137">PREVIEW</text></svg>'); return;
    }
    if (pathname === '/' || pathname === '/popup.html') {
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end((await readFile('dist/popup.html', 'utf8')).replace('<script src="popup.js">', `<output id="fixture-a11y" hidden></output><script src="axe.min.js"></script><script>${shim}</script><script>${a11yCheck}</script><script src="popup.js">`)); return;
    }
    const types = { '/style.css': 'text/css', '/anioto.css': 'text/css', '/anioto-tokens.css': 'text/css', '/popup.js': 'text/javascript', '/anioto-manga.jpg': 'image/jpeg', '/anioto-icons.svg': 'image/svg+xml' };
    if (!Object.hasOwn(types, pathname)) { response.writeHead(404).end(); return; }
    response.setHeader('Content-Type', types[pathname]);
    response.end(await readFile(`dist${pathname}`));
  } catch { response.writeHead(500).end('Preview failed'); }
}).listen(18743, '127.0.0.1', () => console.log('Otone UI fixtures: http://127.0.0.1:18743 (mocked browser APIs; no audio)'));
