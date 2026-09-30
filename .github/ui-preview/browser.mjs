import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { places, validatePlan } from './contract.mjs';
const [mode, url, out, planFile] = process.argv.slice(2);
const view = { width: 1440, height: 900 };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const browser = await chromium.launch();
async function seed(page, where) {
  await page.addInitScript(() => { localStorage.clear(); sessionStorage.clear(); });
  if (where === 'quicknote') { await page.goto(`${url}/quicknote.html`); await page.locator('.quicknote-root').waitFor({ state: 'visible' }); await page.evaluate(() => document.fonts.ready); return; }
  await page.goto(`${url}/?e2eLocalMock`);
  await page.waitForFunction(() => Boolean(window.__gooseTest && window.__GOOSE_TEST__?.getPagesState().hydrated));
  await page.evaluate(async () => {
    const { useSettings } = await import('/src/stores/useSettings.ts');
    useSettings.setState(s => ({ setupGuideSeen: true, setupGuideOpen: false, ai: { ...s.ai, enabled: true } }));
    const h = window.__gooseTest;
    h.setMockFile('/mock-notes/PR 界面预览.md', '# PR 界面预览\n\n这是独立样例笔记，用于展示本次 PR 改动。\n\n## 计划与进展\n\n- [ ] 检查侧栏和编辑器\n- [x] 打开设置\n\n> 样例引用内容\n\n| 项目 | 状态 |\n| --- | --- |\n| 界面演示 | 进行中 |\n\n```javascript\nconst greeting = "Hello Goose Note";\n```\n\n[参考链接](https://example.com)');
    const { pages } = await h.setupMockNotebook();
    h.stores.useTabs.getState().openPermanentTab(pages.find(p => p.title === 'PR 界面预览').id);
  });
  await page.locator('.bn-editor[contenteditable="true"]').first().waitFor({ state: 'visible' });
  if (where === 'settings') await page.locator('button[aria-label="设置"]').click();
  if (where === 'search') {
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('goose-note:open-search')));
    await page.locator('.goose-search-panel').or(page.getByRole('region', { name: '全局搜索' })).first().waitFor({ state: 'visible' });
  }
  if (where === 'ai') {
    await page.getByRole('button', { name: '打开 AI 面板', exact: true }).click();
    await page.locator('[data-ai-panel-layout]').waitFor({ state: 'visible' });
  }
  await page.evaluate(() => document.fonts.ready);
  await sleep(500);
}
async function outline(page) {
  return page.evaluate(() => {
    const rows = [];
    for (const el of document.querySelectorAll('button,input,textarea,select,a,[role],[contenteditable],h1,h2,h3,summary,[data-block-type]')) {
      if (!el.getClientRects().length || getComputedStyle(el).visibility === 'hidden') continue;
      const attrs = [...el.attributes].filter(a => /^(id|class|role|aria-label|aria-current|placeholder|title|type|data-.*)$/.test(a.name)).map(a => `${a.name}=${JSON.stringify(a.value.slice(0,200))}`).join(' ');
      rows.push(`<${el.tagName.toLowerCase()} ${attrs}> ${el.textContent?.trim().replace(/\s+/g, ' ').slice(0,160) || ''}`);
      if (rows.length >= 180) break;
    }
    return rows.join('\n');
  });
}
async function annotate(page) {
  await page.evaluate(() => {
    const cursor = document.createElement('div'); cursor.id = 'goose-preview-pointer';
    cursor.style.cssText = 'position:fixed;left:-40px;top:-40px;width:14px;height:14px;background:#ea5828;border:2px solid white;border-radius:50%;box-shadow:0 1px 5px #0008;z-index:2147483647;pointer-events:none';
    const caption = document.createElement('div'); caption.id = 'goose-preview-caption';
    caption.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:10px 20px;color:white;background:#202420e8;border-radius:9px;font:16px/1.5 system-ui;z-index:2147483647;pointer-events:none;max-width:80%'; caption.hidden = true;
    document.body.append(cursor, caption);
    document.addEventListener('mousemove', e => {
      cursor.style.left = `${e.clientX-8}px`; cursor.style.top = `${e.clientY-8}px`;
      const trail = document.createElement('div'); trail.style.cssText = `position:fixed;left:${e.clientX-2}px;top:${e.clientY-2}px;width:4px;height:4px;border-radius:50%;background:#ec582b;pointer-events:none;z-index:2147483646`;
      document.body.append(trail); trail.animate([{ opacity: .8 }, { opacity: 0 }], 500).onfinish = () => trail.remove();
    });
    document.addEventListener('mousedown', e => {
      const ring = document.createElement('div'); ring.style.cssText = `position:fixed;left:${e.clientX-14}px;top:${e.clientY-14}px;width:28px;height:28px;border:2px solid #ec582b;border-radius:50%;pointer-events:none;z-index:2147483646`;
      document.body.append(ring); ring.animate([{ transform:'scale(.5)',opacity:1 },{ transform:'scale(2)',opacity:0 }], 600).onfinish = () => ring.remove();
    });
  });
}
async function caption(page, text) {
  await page.evaluate(text => { const c = document.getElementById('goose-preview-caption'); if (c) { c.textContent = text; c.hidden = !text; } }, text);
}
async function locate(page, step) {
  let targets = page.locator(step.target);
  if (step.text) targets = targets.filter({ hasText: step.text });
  const visible = [];
  for (let i=0, n=await targets.count(); i<n; i++) if (await targets.nth(i).isVisible()) visible.push(targets.nth(i));
  if (visible.length !== 1) throw new Error(`Target needs exactly one visible match: ${step.target} (${visible.length})`);
  return visible[0];
}
async function point(page, target) {
  await target.scrollIntoViewIfNeeded({ timeout: 5000 });
  const box = await target.boundingBox();
  if (!box) throw new Error('Target has no box');
  await page.mouse.move(box.x+box.width/2, box.y+box.height/2, { steps: 24 });
  await sleep(250);
}
const blocked = /删除|移除|重置|清空|卸载|重启|退出|登出|注销|同步|发布|更新并|安装更新|delete|remove|uninstall|restart|sign.?out|sync|publish/i;
async function leakCheck(page) {
  return page.evaluate(() => {
    const text = document.body.innerText + [...document.querySelectorAll('input,textarea')].map(e => e.value).join('\n');
    return /(?:sk-|sk_)[a-zA-Z0-9_-]{20,}|gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|AIza[a-zA-Z0-9_-]{30,}/.test(text);
  });
}
try {
  await fs.mkdir(out, { recursive: true });
  if (mode === 'inspect') {
    const ctx = await browser.newContext({ viewport: view, locale:'zh-CN' });
    const outlines = {};
    for (const place of places) {
      const page = await ctx.newPage();
      try { await seed(page, place); outlines[place] = await outline(page); }
      catch(e) { outlines[place] = `Unavailable: ${e.message.split('\n')[0]}`; }
      finally { await page.close(); }
    }
    await fs.writeFile(path.join(out,'inspection.json'), JSON.stringify({ outlines },null,2));
    await ctx.close();
  } else {
    const plan = validatePlan(JSON.parse(await fs.readFile(planFile,'utf8')));
    const m = { summary:plan.summary,mismatch:plan.mismatch,unseen:plan.unseen,scenes:[],errors:[],leak:false,video:null,poster:null,skipped:plan.ui_change?'':'no-visible-ui-change' };
    let context;
    try {
      if (plan.ui_change) {
        context = await browser.newContext({ viewport:view,locale:'zh-CN',recordVideo:{dir:path.join(out,'raw'),size:view} });
        const page = await context.newPage();
        const videoStart = Date.now(); let videoLead = null;
        // Browser previews must stay within the local PR app. No external services.
        await page.route('**/*', route => {
          const requestURL = new URL(route.request().url());
          const allowed = requestURL.origin === new URL(url).origin || requestURL.protocol === 'data:' || requestURL.protocol === 'blob:';
          return allowed ? route.continue() : route.abort();
        });
        page.on('dialog', d => d.dismiss());
        page.on('popup', p => p.close());
        for (const scene of plan.scenes) {
          const captured = { title:scene.title, shots:[] }; m.scenes.push(captured);
          try {
            await seed(page,scene.start);
            if (videoLead === null) videoLead = Math.max(0, (Date.now() - videoStart) / 1000 - 0.25);
            await annotate(page); await caption(page,scene.title);
            for (const step of scene.steps) {
              await caption(page,step.caption || scene.title);
              if (['click','hover','type'].includes(step.do)) {
                const target = await locate(page,step); await point(page,target);
                if (step.do === 'click') {
                  const label = await target.evaluate(el => [el.textContent,el.getAttribute('aria-label'),el.getAttribute('title')].join(' '));
                  if (blocked.test(label)) throw new Error('Destructive/external action blocked');
                  await target.click({timeout:5000});
                } else if (step.do==='hover') await target.hover({timeout:5000});
                else { await target.fill(step.value,{timeout:5000}); }
              } else if (step.do==='press') await page.keyboard.press(step.key);
              else if (step.do==='scroll') await page.mouse.wheel(0,step.dy);
              else if (step.do==='wait') await sleep(step.ms);
              else if (step.do==='shot') {
                await sleep(400);
                const file=`shot-${step.name}.png`;
                await page.evaluate(() => { for (const id of ['goose-preview-pointer','goose-preview-caption']) document.getElementById(id)?.style.setProperty('visibility','hidden'); });
                await page.screenshot({path:path.join(out,file)});
                await page.evaluate(() => { for (const id of ['goose-preview-pointer','goose-preview-caption']) document.getElementById(id)?.style.removeProperty('visibility'); });
                captured.shots.push({file,caption:step.caption || scene.title});
              }
              if (new URL(page.url()).origin !== new URL(url).origin) throw new Error('External navigation blocked');
              if (await leakCheck(page)) { m.leak=true; throw new Error('Possible credential visible; discarding media'); }
              await sleep(250);
            }
            await sleep(700);
          } catch(e) {
            m.errors.push(`${scene.title}: ${e.message.split('\n')[0]}`);
            await fs.writeFile(path.join(out,'failure.json'),JSON.stringify({plan,failedScene:scene.title,error:m.errors.at(-1),outline:await outline(page).catch(()=> 'Page unavailable')},null,2));
          }
          if(m.leak)break;
        }
        const raw=await page.video().path(); await context.close(); context=null;
        if(!m.leak && (plan.scenes.length>1 || plan.scenes.some(s=>s.steps.some(st=>['click','hover','type','press','scroll'].includes(st.do))))) {
          execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-ss',String(videoLead || 0),'-i',raw,'-c:v','libx264','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart','-an',path.join(out,'preview.mp4')]); m.video='preview.mp4';
          const first=m.scenes.flatMap(s=>s.shots)[0]; if(first){await fs.copyFile(path.join(out,first.file),path.join(out,'poster.png'));m.poster='poster.png';}
        }
      }
    } catch(e) {m.errors.push(e.message.split('\n')[0]);}
    finally {if(context)await context.close();await fs.rm(path.join(out,'raw'),{recursive:true,force:true});}
    if(m.leak){for(const file of await fs.readdir(out))if(/\.png$|\.mp4$/.test(file))await fs.rm(path.join(out,file));m.scenes=[];m.video=null;m.poster=null;}
    await fs.writeFile(path.join(out,'manifest.json'),JSON.stringify(m,null,2));
    console.log(`Captured ${m.scenes.flatMap(s=>s.shots).length} screenshots; video ${!!m.video}; errors ${m.errors.length}`);
    if(m.errors.length || m.leak)process.exitCode=1;
  }
} finally {await browser.close();}
