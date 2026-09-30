import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { begin, end, isUIFile, withBlock, cleanManifest, mediaName, player, escapeHTML } from './contract.mjs';
const repo=process.env.GITHUB_REPOSITORY || process.env.GH_REPO;
const number=Number(process.env.PR);
const runURL=process.env.RUN_URL || '';
if(!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !Number.isSafeInteger(number) || number<1)throw new Error('Repository and PR are required');
const cli=(...args)=>execFileSync('gh',args,{encoding:'utf8',maxBuffer:16*1024*1024});
const api=(route, args=[])=>JSON.parse(cli('api',`repos/${repo}/${route}`,...args));
async function all(route){let rows=[];for(let page=1;page<=30;page++){const batch=api(`${route}${route.includes('?')?'&':'?'}per_page=100&page=${page}`);rows.push(...batch);if(batch.length<100)return rows;}throw new Error('Pagination limit exceeded');}
async function setBlock(sha,inner){
 const current=api(`pulls/${number}`);
 if(current.head.sha!==sha || (current.state!=='open' && process.argv[2]!=='cleanup')){console.log('Stale or closed PR; skip description update');return false;}
 const body=withBlock(current.body || '',inner);
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'goose-pr-body-'));
 try{const file=path.join(dir,'body.json');await fs.writeFile(file,JSON.stringify({body}));cli('api',`repos/${repo}/pulls/${number}`,'--method','PATCH','--input',file);}
 finally{await fs.rm(dir,{recursive:true,force:true});}return true;
}
const header=sha=>`### 🎬 界面预览\n提交：\`${sha.slice(0,12)}\`${runURL?` · [运行记录](${runURL})`:''}\n\n基于此 PR 的构建和独立样例笔记，按代码差异规划并操作 Web 界面。`;
async function detect(){
 const pr=api(`pulls/${number}`),files=await all(`pulls/${number}/files`);
 const ui=pr.state==='open' && (files.some(f=>isUIFile(f.filename)) || pr.labels.some(l=>l.name==='ui-preview'));
 if(process.env.GITHUB_OUTPUT)await fs.appendFile(process.env.GITHUB_OUTPUT,`ui=${ui}\nsha=${pr.head.sha}\nnumber=${number}\n`);
 if(!ui){if(pr.state==='open' && pr.body?.includes(begin))await setBlock(pr.head.sha,`${header(pr.head.sha)}\n\n这次提交没有需要演示的界面变化。`);return;}
 const out=process.env.OUT_DIR || 'request';await fs.mkdir(out,{recursive:true});
 const diff=cli('api',`repos/${repo}/pulls/${number}`,'-H','Accept: application/vnd.github.diff');
 let codeContext='';
 for(const file of files.filter(f=>isUIFile(f.filename) && f.status!=='removed').slice(0,12)){
  if(!/\.(tsx?|jsx?|css|html|mjs)$/.test(file.filename))continue;
  try{
   const content=api(`contents/${file.filename.split('/').map(encodeURIComponent).join('/')}?ref=${pr.head.sha}`);
   if(content.encoding!=='base64' || content.size>500000)continue;
   const lines=Buffer.from(content.content,'base64').toString('utf8').split('\n');
   const starts=[...String(file.patch || '').matchAll(/@@ .*?\+(\d+)/g)].slice(0,3).map(m=>Math.max(0,Number(m[1])-20));
   codeContext+=`\n=== ${file.filename} ===\n${(starts.length?starts:[0]).map(start=>lines.slice(start,start+60).join('\n')).join('\n').slice(0,8000)}`;
   if(codeContext.length>24000)break;
  }catch{/* deleted/large source stays available in the diff */}
 }
 const body=String(pr.body || '').replace(/<!-- goose-ui-preview:begin -->[\s\S]*?<!-- goose-ui-preview:end -->/g,'');
 await fs.writeFile(path.join(out,'request.json'),JSON.stringify({number,sha:pr.head.sha,base:pr.base.sha,title:pr.title,body,diff,codeContext,files:files.map(f=>f.filename)},null,2));
 await setBlock(pr.head.sha,`${header(pr.head.sha)}\n\n⏳ 正在读取本次差异、规划并录制界面演示…`);
}
async function gitMedia(sha,dir,m,cleanup=false){
 const work=await fs.mkdtemp(path.join(os.tmpdir(),'goose-preview-pages-'));
 const token=process.env.GH_TOKEN || process.env.GITHUB_TOKEN || cli('auth','token').trim();
 const env={...process.env,GIT_TERMINAL_PROMPT:'0',GIT_CONFIG_COUNT:'1',GIT_CONFIG_KEY_0:'http.https://github.com/.extraheader',GIT_CONFIG_VALUE_0:`AUTHORIZATION: basic ${Buffer.from(`x-access-token:${token}`).toString('base64')}`};
 const git=(...args)=>{try{return execFileSync('git',args,{cwd:work,env,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}catch{throw new Error(`Preview media git ${args[0]} failed`);}};
 try{
  git('init','-q');git('config','user.name','github-actions[bot]');git('config','user.email','41898282+github-actions[bot]@users.noreply.github.com');
  const open=new Set((await all('pulls?state=open')).map(p=>p.number));
  for(let attempt=0;attempt<4;attempt++){
   let base='';
   const exists=api('git/matching-refs/heads/ui-previews').some(r=>r.ref==='refs/heads/ui-previews');
   if(exists){git('fetch','-q','--depth=1',`https://github.com/${repo}.git`,'ui-previews');base=git('rev-parse','FETCH_HEAD');git('checkout','-q','-f','--detach','FETCH_HEAD');
    if((await fs.readFile(path.join(work,'.goose-ui-previews'),'utf8').catch(()=>''))!==repo)throw new Error('Refusing to replace an unrelated ui-previews branch');
   }else if(cleanup)return;
   for(const item of await fs.readdir(work)){const match=/^pr-(\d+)$/.exec(item);if(match && (Number(match[1])===number || !open.has(Number(match[1]))))await fs.rm(path.join(work,item),{recursive:true,force:true});}
   if(!cleanup){
    const target=path.join(work,`pr-${number}`,sha);await fs.mkdir(target,{recursive:true});
    const files=new Set(m.scenes.flatMap(s=>s.shots.map(x=>x.file)));if(m.video)files.add(m.video);if(m.poster)files.add(m.poster);
    for(const file of files){
     if(!mediaName.test(file))throw new Error('Media path rejected');
     const input=path.join(dir,file),stat=await fs.lstat(input);
     if(!stat.isFile() || stat.isSymbolicLink() || stat.size>50*1024*1024)throw new Error('Invalid media file');
     const bytes=await fs.readFile(input);
     if(file.endsWith('.png')?!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.toString('ascii',4,8)!=='ftyp')throw new Error('Invalid media signature');
     await fs.writeFile(path.join(target,file),bytes);
    }
    await fs.writeFile(path.join(target,'index.html'),player(repo,number,sha,m));
   }
   await fs.writeFile(path.join(work,'.goose-ui-previews'),repo);await fs.writeFile(path.join(work,'.nojekyll'),'');
   const links=[];
   for(const item of await fs.readdir(work)){if(!/^pr-\d+$/.test(item))continue;for(const head of await fs.readdir(path.join(work,item)))if(/^[a-f0-9]{40}$/.test(head))links.push(`<li><a href="${item}/${head}/">${item} · ${head.slice(0,12)}</a></li>`);}
   await fs.writeFile(path.join(work,'index.html'),`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Goose Note PR 预览</title><h1>Goose Note PR 预览</h1><ul>${links.join('')}</ul>`);
   git('checkout','-q','--orphan',`snapshot-${attempt}`);git('add','-A');git('commit','-q','-m',`PR #${number} ${cleanup?'cleanup':'UI preview'} ${sha.slice(0,12)}`);
   try{git('push','-q',`--force-with-lease=refs/heads/ui-previews:${base}`,`https://github.com/${repo}.git`,'HEAD:refs/heads/ui-previews');return;}
   catch{if(attempt===3)throw new Error('Media branch changed repeatedly');}
  }
 }finally{await fs.rm(work,{recursive:true,force:true});}
}
async function publish(){
 const sha=process.env.SHA,current=api(`pulls/${number}`);
 if(!/^[a-f0-9]{40}$/.test(sha || '') || current.head.sha!==sha || current.state!=='open'){console.log('Skip stale preview');return;}
 const dir=process.env.OUT_DIR || 'out';
 let m;try{m=cleanManifest(JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8')));}catch{}
 const result=process.env.RECORD_RESULT || 'failure';
 if(!m || m.leak || (!m.video && !m.scenes.some(s=>s.shots.length))){
  const reason=m?.leak?'录制中发现疑似凭据，全部媒体已丢弃。':m?.skipped?'按 diff 未发现可见界面变化，无需录制。':`预览未完成（${result}）。请查看运行记录。`;
  await setBlock(sha,`${header(sha)}\n\n${m?.summary || ''}\n\n${reason}`);return;
 }
 await gitMedia(sha,dir,m);
 // GITHUB_TOKEN pushes do not automatically start branch-based Pages builds.
 api('pages/builds',['--method','POST']);
 const pages=api('pages');
 const site=`${pages.html_url.replace(/\/$/,'')}/pr-${number}/${sha}/`;
 const raw=`https://raw.githubusercontent.com/${repo}/ui-previews/pr-${number}/${sha}/`;
 let inner=`${header(sha)}\n\n**改动（按代码）：** ${m.summary}\n\n[完整预览页面](${site})\n\n`;
 if(m.mismatch)inner+=`> **描述与代码不符：** ${m.mismatch}\n\n`;
 if(m.unseen)inner+=`> **沙盒无法展示：** ${m.unseen}\n\n`;
 if(m.video)inner+=`[![播放录屏](${raw}${m.poster || m.scenes.flatMap(s=>s.shots)[0]?.file})](${site})\n\n[▶ 打开播放器](${site}) · [下载 MP4](${raw}${m.video})\n\n`;
 for(const scene of m.scenes)for(const shot of scene.shots)inner+=`![${shot.caption.replace(/[\]\r\n]/g,' ')}](${raw}${shot.file})\n\n${shot.caption}\n\n`;
 if(m.errors.length)inner+=`⚠️ 有 ${m.errors.length} 个步骤未完成，请结合[运行记录](${runURL})审查。\n\n`;
 inner+=`浏览器演示不代替原生窗口、系统功能或真实模型调用验收。`;
 await setBlock(sha,inner);
 console.log(`PR #${number} preview: ${site}`);
}
async function cleanup(){const pr=api(`pulls/${number}`);if(pr.state!=='closed'){console.log('Reopened PR, skip cleanup');return;}await gitMedia(pr.head.sha,null,null,true);api('pages/builds',['--method','POST']);await setBlock(pr.head.sha,`${header(pr.head.sha)}\n\nPR 已关闭，预览媒体已清理。`);}
const command=process.argv[2];
await ({detect,publish,cleanup}[command] || (()=>{throw new Error('detect | publish | cleanup');}))();
