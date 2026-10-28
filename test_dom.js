'use strict';
// DOM-event integration tests, not a browser, rendering or trusted-input test.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {parseHTML}=require('linkedom');
const html=fs.readFileSync(path.join(__dirname,'dist/index.html'),'utf8');
const scripts=['data.js','engine.js','app.js'].map(name=>({name,code:fs.readFileSync(path.join(__dirname,'dist',name),'utf8')}));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const header='timestamp,source,event,duration_ms,payload_kb,status';
const small=header+'\n1999-10-02T13:20:00Z,terminal-a,read,250,12,ok\n1999-10-02T03:13:00Z,unknown,whisper,999999,99999,error';
function fixture(mode='absent'){
 const {window,document,Event}=parseHTML(html),downloads=[],blobs=[],revoked=[],timers=[],warnings=[],tools=[];
 // Avoid any download or network side effect. Only record the anchor invocation.
 const create=document.createElement.bind(document);
 document.createElement=function(tag,...args){const el=create(tag,...args);if(tag==='a')el.click=()=>downloads.push({href:el.href,download:el.download});return el;};
 if(mode!=='absent')document.modelContext={registerTool(tool){if(mode==='throws')throw Error('Unavailable');if(mode==='rejects')return Promise.reject(Error('Unavailable'));tools.push(tool);}};
 const context=vm.createContext({window,self:window,document,Blob,TextEncoder,AbortController,
  URL:{createObjectURL(blob){blobs.push(blob);return 'blob:test-'+blobs.length;},revokeObjectURL(url){revoked.push(url);}},
  setTimeout(fn){timers.push(fn);return timers.length;},console:{warn(...args){warnings.push(args.join(' '));}}});
 scripts.forEach(s=>vm.runInContext(s.code,context,{filename:s.name}));
 const $=id=>document.getElementById(id);
 const click=id=>$(id).dispatchEvent(new Event('click',{bubbles:true}));
 const load=file=>{Object.defineProperty($('file'),'files',{configurable:true,value:[file]});$('file').dispatchEvent(new Event('change',{bubbles:true}));};
 return {window,document,Event,$,click,load,downloads,blobs,revoked,timers,warnings,tools};
}
test('boots without optional WebMCP and displays the actual haunted model result',()=>{
 const f=fixture();assert.equal(f.$('count').textContent,'180');assert.equal(f.$('flags').textContent,'8');assert.equal(f.$('rows').children.length,8);assert.equal(f.$('download').disabled,false);
});
test('ordinary preset events change and restore model outputs',()=>{
 const f=fixture();f.click('quiet');assert.equal(f.$('flags').textContent,'3');assert.equal(f.$('dataset').textContent,'Fictional / quieter');f.click('haunted');assert.equal(f.$('flags').textContent,'8');
});
test('ordinary row-count event toggles all rows and top eight',()=>{
 const f=fixture();f.click('all');assert.equal(f.$('rows').children.length,180);assert.equal(f.$('all').textContent,'Show top eight');f.click('all');assert.equal(f.$('rows').children.length,8);
});
test('a generated row button selects its own record and rebuilds visible detail',()=>{
 const f=fixture(),button=f.$('rows').children[1].querySelector('button');const number=Number(button.getAttribute('aria-label').match(/\d+/)[0]);button.dispatchEvent(new f.Event('click',{bubbles:true}));assert.match(f.$('detail').textContent,new RegExp('Record '+number+' /'));assert.equal(f.document.querySelectorAll('tr.selected').length,1);
});
test('paste/analyze event renders two actual parsed records',()=>{
 const f=fixture();f.$('csv').value=small;f.click('analyze');assert.equal(f.$('count').textContent,'2');assert.equal(f.$('flags').textContent,'1');assert.equal(f.$('rows').children.length,2);assert.equal(f.$('all').hidden,true);assert.equal(f.$('error').hidden,true);
});
test('invalid paste preserves results and selection and shows an error',()=>{
 const f=fixture(),before=f.$('detail').textContent;f.$('csv').value='invalid';f.click('analyze');assert.equal(f.$('count').textContent,'180');assert.equal(f.$('detail').textContent,before);assert.equal(f.$('error').hidden,false);assert.match(f.$('error').textContent,/Previous results remain displayed/);
});
test('HTML-like user names are literal DOM text with no new SVG elements',()=>{
 const f=fixture();f.$('csv').value=small.replace('terminal-a','<svg onload=alert(1)>');f.click('analyze');assert.ok(f.$('rows').textContent.includes('<svg onload=alert(1)>'));assert.equal(f.document.querySelectorAll('svg').length,0);
});
test('clear event resets inputs, errors, results, row details and export state',()=>{
 const f=fixture();f.$('csv').value='bad';f.click('analyze');f.click('clear');assert.equal(f.$('csv').value,'');assert.equal(f.$('file').value,'');assert.equal(f.$('dataset').textContent,'No archive open');assert.equal(f.$('error').hidden,true);assert.equal(f.$('rows').children.length,0);assert.equal(f.$('detail').children.length,0);assert.equal(f.$('results').hidden,true);assert.equal(f.$('empty').hidden,false);assert.equal(f.$('download').disabled,true);
});
test('export event builds a BOM CSV and invokes exactly one download anchor',async()=>{
 const f=fixture();f.$('csv').value=small;f.click('analyze');f.click('download');assert.deepEqual(f.downloads,[{href:'blob:test-1',download:'ghost-logbook-report.csv'}]);assert.equal(f.blobs[0].type,'text/csv;charset=utf-8');const raw=Buffer.from(await f.blobs[0].arrayBuffer());assert.equal(raw.subarray(0,3).toString('hex'),'efbbbf');assert.equal(raw.toString('utf8').split('\r\n').length,3);f.timers.forEach(fn=>fn());assert.deepEqual(f.revoked,['blob:test-1']);
});
test('file-change event consumes local text and produces the same two-row result',async()=>{
 const f=fixture();f.load({size:small.length,text:async()=>small});await tick();assert.equal(f.$('count').textContent,'2');assert.equal(f.$('csv').value,small);assert.equal(f.$('error').hidden,true);
});
test('oversized file is rejected without reading it or changing results',async()=>{
 const f=fixture();let read=false;f.load({size:1048577,text:async()=>{read=true;return small;}});await tick();assert.equal(read,false);assert.equal(f.$('count').textContent,'180');assert.match(f.$('error').textContent,/larger than 1 MB/);
});
test('active file read failure shows an explicit error and keeps prior results',async()=>{
 const f=fixture();f.load({size:100,text:async()=>{throw Error('Read failed');}});await tick();assert.match(f.$('error').textContent,/could not be read/);assert.equal(f.$('count').textContent,'180');
});
test('pending file completion cannot restore data after clear',async()=>{
 const f=fixture();let resolve;f.load({size:small.length,text:()=>new Promise(r=>resolve=r)});f.click('clear');resolve(small);await tick();assert.equal(f.$('csv').value,'');assert.equal(f.$('results').hidden,true);assert.equal(f.$('error').hidden,true);
});
test('pending file failure cannot restore a stale error after clear',async()=>{
 const f=fixture();let reject;f.load({size:100,text:()=>new Promise((_,r)=>reject=r)});f.click('clear');reject(Error('Read failed'));await tick();assert.equal(f.$('error').hidden,true);assert.equal(f.$('error').textContent,'');assert.equal(f.$('results').hidden,true);
});
test('old file completion cannot overwrite a newer preset',async()=>{
 const f=fixture();let resolve;f.load({size:small.length,text:()=>new Promise(r=>resolve=r)});f.click('quiet');resolve(small);await tick();assert.equal(f.$('count').textContent,'180');assert.equal(f.$('flags').textContent,'3');assert.equal(f.$('dataset').textContent,'Fictional / quieter');
});
test('old file failure cannot overwrite a newer successful file result',async()=>{
 const f=fixture();let reject;f.load({size:100,text:()=>new Promise((_,r)=>reject=r)});f.load({size:small.length,text:async()=>small});await tick();reject(Error('Read failed'));await tick();assert.equal(f.$('count').textContent,'2');assert.equal(f.$('error').hidden,true);
});
test('optional registry synchronous failures do not stop ordinary events',()=>{
 const f=fixture('throws');assert.equal(f.warnings.length,7);f.click('quiet');assert.equal(f.$('flags').textContent,'3');
});
test('optional registry promise failures do not stop ordinary events',async()=>{
 const f=fixture('rejects');await tick();assert.equal(f.warnings.length,7);f.click('quiet');assert.equal(f.$('flags').textContent,'3');
});
test('available optional registry registers seven unique tools after UI initialization',()=>{
 const f=fixture('available');assert.equal(f.tools.length,7);assert.equal(new Set(f.tools.map(x=>x.name)).size,7);f.click('quiet');assert.equal(f.tools.find(x=>x.name==='read_archive_state').execute({}).flagged,3);
});
