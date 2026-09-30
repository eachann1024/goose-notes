import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { validatePlan, cleanManifest, withBlock, isUIFile, player } from './contract.mjs';
const plan = () => ({ui_change:true,summary:'界面变化',mismatch:'',unseen:'',scenes:[{title:'编辑器',start:'workspace',steps:[{do:'shot',name:'editor',caption:'界面'}]}]});
test('PR block replacement keeps author content, including replacement syntax',()=>{
 const body='作者正文 $&\n<!-- goose-ui-preview:begin -->old<!-- goose-ui-preview:end -->\n结尾';
 const next=withBlock(body,'new');assert.ok(next.startsWith('作者正文 $&'));assert.ok(next.endsWith('结尾'));assert.ok(!next.includes('old'));assert.equal((next.match(/goose-ui-preview:begin/g)||[]).length,1);
});
test('plan action contract accepts UI interactions and rejects scripts/navigation/path traversal',()=>{
 assert.equal(validatePlan(plan()).scenes.length,1);
 for(const step of [{do:'eval',code:'alert(1)'},{do:'goto',url:'https://example.com'},{do:'shot',name:'../../secret'},{do:'press',key:'ControlOrMeta+Q'},{do:'wait',ms:30000}]){const p=plan();p.scenes[0].steps=[step];assert.throws(()=>validatePlan(p));}
 const p=plan();p.ui_change=false;assert.throws(()=>validatePlan(p));
});
test('media contract rejects traversal and player escapes model output',()=>{
 assert.throws(()=>cleanManifest({scenes:[{shots:[{file:'../../index.html'}]}]}));
 const m=cleanManifest({summary:'<script>alert(1)</script>',scenes:[{title:'<img src=x onerror=alert(1)>',shots:[{file:'shot-editor.png',caption:'<b>test</b>'}]}]});
 const html=player('example/note',7,'a'.repeat(40),m);assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('Content-Security-Policy'));
});
test('UI detection covers renderer, native shell and label override source paths',()=>{
 assert.ok(isUIFile('src/index.css'));assert.ok(isUIFile('electron/main/windows.ts'));assert.ok(!isUIFile('README.md'));assert.ok(!isUIFile('tests/e2e/a.spec.ts'));
});
function run(command,scenario='success'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'preview-integration-test-'));
 try{
  const callLog=path.join(dir,'calls.jsonl'),bodyLog=path.join(dir,'body.json'),out=path.join(dir,'out');fs.mkdirSync(out);
  const manifest={summary:'实际 UI 变化',mismatch:'',unseen:'',scenes:[{title:'场景',shots:[{file:'shot-editor.png',caption:'打开编辑器'}]}],errors:[],video:null,poster:null,leak:false};
  if(scenario==='leak')manifest.leak=true;
  if(scenario==='traversal')manifest.scenes[0].shots[0].file='../evil.html';
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest));
  fs.writeFileSync(path.join(out,'shot-editor.png'),scenario==='invalid-media'?'not png':Buffer.from([137,80,78,71,13,10,26,10]));
  fs.writeFileSync(path.join(out,'untrusted.mjs'),'throw new Error("must not execute")');
  fs.writeFileSync(path.join(dir,'gh'),`#!/usr/bin/env node
import fs from 'node:fs';
const a=process.argv.slice(2),s=process.env.SCENARIO,sha='a'.repeat(40);
fs.appendFileSync(process.env.CALL_LOG,JSON.stringify(a)+'\\n');
const out=x=>console.log(JSON.stringify(x));
if(a[0]==='auth'){console.log('test-only-credential');}
else if(a[0]==='api'){
 const route=a[1];
 if(a.includes('PATCH')){fs.writeFileSync(process.env.BODY_LOG,fs.readFileSync(a[a.indexOf('--input')+1]));out({});}
 else if(a.includes('Accept: application/vnd.github.diff'))console.log('diff --git a/src/index.css b/src/index.css\\n+button{color:red}');
 else if(route.endsWith('/pulls/7'))out({number:7,state:s==='closed'?'closed':'open',head:{sha:s==='stale'?'b'.repeat(40):sha},base:{sha:'c'.repeat(40)},title:'PR title',body:'作者正文 $&',labels:[]});
 else if(route.includes('/pulls/7/files'))out([{filename:s==='non-ui'?'README.md':'src/index.css',status:'modified',patch:'@@ -1 +1 @@'}]);
 else if(route.includes('/contents/'))out({size:100,encoding:'base64',content:Buffer.from('button{color:red}').toString('base64')});
 else if(route.includes('/pulls?'))out([{number:7}]);
 else if(route.includes('/git/matching-refs/'))out([]);
 else if(route.endsWith('/pages/builds'))out({status:'queued'});
 else if(route.endsWith('/pages'))out({html_url:'https://example.github.io/note/'});
 else throw new Error('Unexpected route '+route);
}
`);fs.chmodSync(path.join(dir,'gh'),0o755);
  fs.writeFileSync(path.join(dir,'git'),`#!/usr/bin/env node
import fs from 'node:fs';
fs.appendFileSync(process.env.CALL_LOG,JSON.stringify(['git',...process.argv.slice(2)])+'\\n');
`);fs.chmodSync(path.join(dir,'git'),0o755);
  const result=spawnSync(process.execPath,['.github/ui-preview/publish.mjs',command],{encoding:'utf8',env:{...process.env,PATH:`${dir}:${process.env.PATH}`,GITHUB_REPOSITORY:'example/note',PR:'7',SHA:'a'.repeat(40),OUT_DIR:out,RUN_URL:'https://github.com/example/note/actions/runs/123',SCENARIO:scenario,CALL_LOG:callLog,BODY_LOG:bodyLog,GITHUB_OUTPUT:path.join(dir,'outputs')}});
  return {status:result.status,stderr:result.stderr,calls:fs.existsSync(callLog)?fs.readFileSync(callLog,'utf8').trim().split('\n').map(JSON.parse):[],body:fs.existsSync(bodyLog)?JSON.parse(fs.readFileSync(bodyLog,'utf8')).body:null,request:fs.existsSync(path.join(out,'request.json'))?JSON.parse(fs.readFileSync(path.join(out,'request.json'),'utf8')):null};
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
}
test('detect binds actual PR diff/title/head to recording and updates pending status',()=>{
 const r=run('detect');assert.equal(r.status,0,r.stderr);assert.equal(r.request.sha,'a'.repeat(40));assert.ok(r.request.diff.includes('button{color:red}'));assert.match(r.body,/正在读取本次差异/);assert.ok(r.body.startsWith('作者正文 $&'));
});
test('non-UI PR does not create a recording request',()=>{const r=run('detect','non-ui');assert.equal(r.status,0,r.stderr);assert.equal(r.request,null);assert.equal(r.body,null);});
test('publisher creates PR/head-specific Pages preview and keeps PR text',()=>{
 const r=run('publish');assert.equal(r.status,0,r.stderr);assert.ok(r.body.startsWith('作者正文 $&'));assert.match(r.body,/https:\/\/example.github.io\/note\/pr-7\/a{40}\//);assert.ok(r.calls.some(a=>a[0]==='git'&&a[1]==='push'));assert.ok(!r.calls.some(a=>a[0]==='release'));
});
for(const scenario of ['stale','closed','leak','traversal','invalid-media'])test(`${scenario} cannot push media`,()=>{
 const r=run('publish',scenario);assert.ok(!r.calls.some(a=>a[0]==='git'&&a[1]==='push'));if(['stale','closed'].includes(scenario))assert.equal(r.body,null);if(scenario==='invalid-media')assert.notEqual(r.status,0);
});
test('cleanup ignores a reopened PR',()=>{const r=run('cleanup');assert.equal(r.status,0,r.stderr);assert.equal(r.body,null);assert.ok(!r.calls.some(a=>a[0]==='git'));});
