export const places = ['workspace', 'settings', 'search', 'ai', 'quicknote'];
export const begin = '<!-- goose-ui-preview:begin -->';
export const end = '<!-- goose-ui-preview:end -->';
export const mediaName = /^(?:shot-[a-z0-9-]{1,60}\.png|preview\.mp4|poster\.png)$/;
export function isUIFile(file) {
  return /^(src\/|public\/|electron\/|\.github\/ui-preview\/)/.test(file) || /^(index|quicknote)\.html$|^vite|^package\.json$|^bun\.lock$|^\.github\/workflows\/ui-preview\.yml$/.test(file);
}
export function withBlock(body = '', inner) {
  const block = `${begin}\n${inner.trim()}\n${end}`;
  const a = body.indexOf(begin), b = body.indexOf(end, a + begin.length);
  return a >= 0 && b > a ? body.slice(0, a) + block + body.slice(b + end.length) : `${body.trimEnd()}\n\n${block}`.trimStart();
}
export function validatePlan(plan) {
  if (!plan || typeof plan.ui_change !== 'boolean' || !Array.isArray(plan.scenes)) throw new Error('Invalid plan');
  for (const key of ['summary', 'mismatch', 'unseen']) if (typeof plan[key] !== 'string' || plan[key].length > 2000) throw new Error(`Invalid ${key}`);
  if (plan.scenes.length > 5 || (!plan.ui_change && plan.scenes.length)) throw new Error('Invalid scene count');
  const names = new Set();
  for (const scene of plan.scenes) {
    if (!places.includes(scene.start) || typeof scene.title !== 'string' || scene.title.length > 120 || !Array.isArray(scene.steps) || scene.steps.length > 20) throw new Error('Invalid scene');
    for (const step of scene.steps) {
      if (!['click', 'hover', 'type', 'press', 'scroll', 'wait', 'shot'].includes(step.do)) throw new Error('Unsupported action');
      if (step.caption !== undefined && (typeof step.caption !== 'string' || step.caption.length > 160)) throw new Error('Invalid caption');
      if (['click', 'hover', 'type'].includes(step.do) && (typeof step.target !== 'string' || step.target.length > 500)) throw new Error('Invalid target');
      if (step.text !== undefined && (typeof step.text !== 'string' || step.text.length > 200)) throw new Error('Invalid text filter');
      if (step.do === 'type' && (typeof step.value !== 'string' || step.value.length > 1500)) throw new Error('Invalid input');
      if (step.do === 'press' && !/^(?:Enter|Escape|Tab|ArrowUp|ArrowDown|ArrowLeft|ArrowRight|Backspace|Home|End|ControlOrMeta\+[abfikp])$/.test(step.key)) throw new Error('Unsupported key');
      if (step.do === 'wait' && (!Number.isInteger(step.ms) || step.ms < 0 || step.ms > 2000)) throw new Error('Invalid wait');
      if (step.do === 'scroll' && (!Number.isFinite(step.dy) || Math.abs(step.dy) > 1200)) throw new Error('Invalid scroll');
      if (step.do === 'shot') {
        if (!/^[a-z0-9-]{1,60}$/.test(step.name) || names.has(step.name)) throw new Error('Invalid/duplicate shot name');
        names.add(step.name);
      }
    }
    if (!scene.steps.some(s => s.do === 'shot')) throw new Error('Every scene needs a screenshot');
  }
  if (plan.ui_change && !plan.scenes.length) throw new Error('Visible UI changes need scenes');
  return plan;
}
export function cleanManifest(m) {
  if (!m || !Array.isArray(m.scenes) || m.scenes.length > 5) throw new Error('Invalid manifest');
  const cleanText = (text, max = 2000) => String(text || '').slice(0, max);
  return {
    summary: cleanText(m.summary), mismatch: cleanText(m.mismatch), unseen: cleanText(m.unseen),
    skipped: cleanText(m.skipped), leak: m.leak === true,
    video: m.video === 'preview.mp4' ? m.video : null, poster: m.poster === 'poster.png' ? m.poster : null,
    errors: Array.isArray(m.errors) ? m.errors.slice(0, 30).map(e => cleanText(e, 500)) : [],
    scenes: m.scenes.map(s => ({ title: cleanText(s.title, 120), shots: (Array.isArray(s.shots) ? s.shots : []).slice(0, 20).map(x => {
      if (!/^shot-[a-z0-9-]{1,60}\.png$/.test(x.file)) throw new Error('Invalid screenshot path');
      return { file: x.file, caption: cleanText(x.caption, 160) };
    }) })),
  };
}
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function player(repo, pr, sha, m) {
  const esc = escapeHTML;
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>#${pr} 界面预览</title><style>body{margin:0;background:#f5f5f4;color:#292c29;font:15px/1.7 system-ui}main{max-width:1100px;margin:auto;padding:24px 16px}video,img{width:100%;border-radius:12px;background:white}figure{margin:24px 0}figcaption,p{color:#666}h1{font-size:24px}a{color:inherit}</style><main><h1>#${pr} 界面预览 · ${sha.slice(0,12)}</h1><a href="https://github.com/${repo}/pull/${pr}">返回 PR</a><p>${esc(m.summary)}</p>${m.mismatch ? `<p>描述与代码不符：${esc(m.mismatch)}</p>` : ''}${m.unseen ? `<p>沙盒不可见：${esc(m.unseen)}</p>` : ''}${m.video ? `<video controls playsinline preload="metadata" src="preview.mp4"${m.poster ? ' poster="poster.png"' : ''}></video>` : ''}${m.scenes.map(s => `<h2>${esc(s.title)}</h2>${s.shots.map(x => `<figure><img loading="lazy" src="${x.file}" alt="${esc(x.caption)}"><figcaption>${esc(x.caption)}</figcaption></figure>`).join('')}`).join('')}${m.errors.length ? `<p>未完成步骤：${m.errors.map(esc).join('；')}</p>` : ''}</main></html>`;
}
