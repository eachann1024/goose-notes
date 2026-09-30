import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const repo=process.env.GITHUB_REPOSITORY || process.env.GH_REPO;
if(!/^[\w.-]+\/[\w.-]+$/.test(repo || ''))throw new Error('Set GH_REPO=owner/repository');
const gh=(...args)=>execFileSync('gh',args,{encoding:'utf8',maxBuffer:2*1024*1024});
const api=(route)=>JSON.parse(gh('api',`repos/${repo}/${route}`));
function writeAPI(route,data,method='POST'){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'goose-pages-setup-'));
 try{const file=path.join(dir,'payload.json');fs.writeFileSync(file,JSON.stringify(data));return JSON.parse(gh('api',`repos/${repo}/${route}`,'--method',method,'--input',file));}
 finally{fs.rmSync(dir,{recursive:true,force:true});}
}
const refs=api('git/matching-refs/heads/ui-previews');
if(!refs.some(r=>r.ref==='refs/heads/ui-previews')){
 const tree=writeAPI('git/trees',{tree:[
  {path:'.goose-ui-previews',mode:'100644',type:'blob',content:repo},
  {path:'.nojekyll',mode:'100644',type:'blob',content:''},
  {path:'index.html',mode:'100644',type:'blob',content:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Goose Note PR 预览</title><h1>Goose Note PR 预览</h1><p>PR 截图和录屏将在这里更新。</p>'},
 ]});
 const commit=writeAPI('git/commits',{message:'初始化 PR 界面预览目录',tree:tree.sha,parents:[]});
 writeAPI('git/refs',{ref:'refs/heads/ui-previews',sha:commit.sha});
}else{
 const marker=api('contents/.goose-ui-previews?ref=ui-previews');
 if(Buffer.from(marker.content,'base64').toString('utf8')!==repo)throw new Error('Existing ui-previews branch is unrelated; setup stopped');
}
let pages;
const probe=spawnSync('gh',['api',`repos/${repo}/pages`],{encoding:'utf8'});
if(probe.status===0)pages=JSON.parse(probe.stdout);
else if(JSON.parse(probe.stdout || '{}').status==='404')pages=writeAPI('pages',{build_type:'legacy',source:{branch:'ui-previews',path:'/'}});
else throw new Error('Could not inspect Pages configuration');
if(pages.source?.branch!=='ui-previews' || pages.source?.path!=='/')throw new Error('Pages already serves another branch; setup stopped');
const key=process.env.UI_PREVIEW_API_KEY || process.env.DEEPSEEK_API_KEY;
if(key)execFileSync('gh',['secret','set','UI_PREVIEW_API_KEY','--repo',repo],{input:key,encoding:'utf8',stdio:['pipe','pipe','pipe']});
gh('label','create','ui-preview','--repo',repo,'--description','Request a PR UI recording','--color','D4C5F9','--force');
console.log(`Pages ready: ${pages.html_url}`);
console.log(key?'Trusted planner secret configured.':'Set Actions secret UI_PREVIEW_API_KEY before the first recording.');
