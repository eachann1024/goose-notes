// ── Loading Overlay ────────────────────────────────────────────
export function createLoadingOverlay(): HTMLElement {
  document
    .querySelectorAll("#goose-image-export-loading")
    .forEach((staleOverlay) => staleOverlay.remove());

  const overlay = document.createElement("div");
  overlay.id = "goose-image-export-loading";
  overlay.style.cssText = `
    position:fixed;inset:0;z-index:9999;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    background:rgba(8,8,14,0.6);
    backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
    animation:ge-in .5s cubic-bezier(.16,1,.3,1) both;
    overflow:hidden;
  `;

  const C = ["#58d7b8", "#4f9cf7", "#9b72f2", "#f472b6", "#ffb56a", "#22d3ee"];
  const particles = Array.from({ length: 14 }, (_, i) => {
    const c = C[i % C.length];
    const x = 34 + i * 2.4;
    const s = 2 + (i % 3);
    const d = (i * 0.32).toFixed(1);
    const dur = (3 + (i % 4) * 0.8).toFixed(1);
    return `<div style="position:absolute;left:${x}%;bottom:38%;width:${s}px;height:${s}px;border-radius:50%;background:${c};box-shadow:0 0 ${s * 3}px ${c};opacity:0;animation:ge-float ${dur}s ease-out ${d}s infinite;will-change:transform,opacity"></div>`;
  }).join("");

  overlay.innerHTML = `<style>
@keyframes ge-in{from{opacity:0}to{opacity:1}}
@keyframes ge-out{to{opacity:0;transform:scale(1.06)}}
@keyframes ge-blob1{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(40px,-28px) scale(1.1)}66%{transform:translate(-28px,32px) scale(.92)}}
@keyframes ge-blob2{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(-36px,28px) scale(1.14)}66%{transform:translate(32px,-36px) scale(.86)}}
@keyframes ge-blob3{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(28px,36px) scale(.94)}66%{transform:translate(-36px,-16px) scale(1.1)}}
@keyframes ge-conic{to{transform:translate(-50%,-50%) rotate(360deg)}}
@keyframes ge-glow{0%,100%{transform:scale(1);opacity:.7}50%{transform:scale(1.14);opacity:1}}
@keyframes ge-cw{to{transform:rotate(360deg)}}
@keyframes ge-ccw{to{transform:rotate(-360deg)}}
@keyframes ge-pulse{0%{transform:scale(.85);opacity:.5}50%{transform:scale(1.3);opacity:0}100%{transform:scale(.85);opacity:0}}
@keyframes ge-pulse2{0%{transform:scale(.85);opacity:.4}50%{transform:scale(1.4);opacity:0}100%{transform:scale(.85);opacity:0}}
@keyframes ge-float{0%{transform:translateY(0) scale(1);opacity:0}12%{opacity:.8}80%{opacity:.5}100%{transform:translateY(-150px) scale(.2);opacity:0}}
@keyframes ge-shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
@keyframes ge-enter{from{transform:scale(.55);opacity:0}to{transform:scale(1);opacity:1}}
@media(prefers-reduced-motion:reduce){#goose-image-export-loading,#goose-image-export-loading *{animation-duration:.01s!important;animation-iteration-count:1!important}}
</style>

<div style="position:absolute;inset:0;overflow:hidden;pointer-events:none">
  <div style="position:absolute;width:360px;height:360px;border-radius:50%;background:radial-gradient(circle,rgba(88,215,184,.22),transparent 70%);top:calc(50% - 240px);left:calc(50% - 90px);filter:blur(72px);animation:ge-blob1 8s ease-in-out infinite;will-change:transform"></div>
  <div style="position:absolute;width:320px;height:320px;border-radius:50%;background:radial-gradient(circle,rgba(159,114,242,.22),transparent 70%);top:calc(50% - 60px);left:calc(50% + 40px);filter:blur(72px);animation:ge-blob2 10s ease-in-out infinite;will-change:transform"></div>
  <div style="position:absolute;width:300px;height:300px;border-radius:50%;background:radial-gradient(circle,rgba(255,181,106,.18),transparent 70%);top:calc(50% - 180px);left:calc(50% - 240px);filter:blur(72px);animation:ge-blob3 12s ease-in-out infinite;will-change:transform"></div>
</div>

<div style="position:relative;width:120px;height:120px;display:flex;align-items:center;justify-content:center;animation:ge-enter .65s cubic-bezier(.16,1,.3,1) .08s both">
  <div style="position:absolute;inset:-46px;border-radius:50%;border:.5px solid rgba(255,181,106,.1);animation:ge-cw 22s linear infinite;will-change:transform"></div>
  <div style="position:absolute;inset:-28px;border-radius:50%;border:1px solid rgba(159,114,242,.16);animation:ge-ccw 13s linear infinite;will-change:transform"></div>
  <div style="position:absolute;inset:-12px;border-radius:50%;border:1.5px dashed rgba(88,215,184,.28);animation:ge-cw 5.5s linear infinite;will-change:transform"></div>

  <div style="position:absolute;width:80px;height:80px;border-radius:50%;border:1.5px solid rgba(88,215,184,.25);animation:ge-pulse 2.8s ease-out infinite;will-change:transform,opacity"></div>
  <div style="position:absolute;width:80px;height:80px;border-radius:50%;border:1.5px solid rgba(159,114,242,.2);animation:ge-pulse2 2.8s ease-out 1.4s infinite;will-change:transform,opacity"></div>

  <div style="position:relative;width:56px;height:56px;border-radius:50%;overflow:hidden;animation:ge-glow 2.6s ease-in-out infinite;will-change:transform,opacity">
    <div style="position:absolute;inset:-30%;width:160%;height:160%;top:50%;left:50%;background:conic-gradient(from 0deg,#58d7b8,#4f9cf7,#9b72f2,#f472b6,#ffb56a,#22d3ee,#58d7b8);animation:ge-conic 3s linear infinite;will-change:transform"></div>
    <div style="position:absolute;inset:5px;border-radius:50%;background:rgba(10,10,18,.88);backdrop-filter:blur(4px)"></div>
  </div>

  <div style="position:absolute;inset:-8px;animation:ge-cw 3.2s linear infinite;will-change:transform"><div style="position:absolute;top:-3px;left:50%;transform:translateX(-50%);width:6px;height:6px;border-radius:50%;background:#58d7b8;box-shadow:0 0 10px rgba(88,215,184,.8)"></div></div>
  <div style="position:absolute;inset:-22px;animation:ge-ccw 5s linear infinite;will-change:transform"><div style="position:absolute;bottom:-2px;left:50%;transform:translateX(-50%);width:4px;height:4px;border-radius:50%;background:#ffb56a;box-shadow:0 0 8px rgba(255,181,106,.8)"></div></div>
  <div style="position:absolute;inset:-38px;animation:ge-cw 7.5s linear infinite;will-change:transform"><div style="position:absolute;top:50%;right:-2px;transform:translateY(-50%);width:4px;height:4px;border-radius:50%;background:#9b72f2;box-shadow:0 0 8px rgba(159,114,242,.7)"></div></div>
  <div style="position:absolute;inset:-16px;animation:ge-cw 4s linear infinite;will-change:transform"><div style="position:absolute;left:-2px;top:50%;transform:translateY(-50%);width:3px;height:3px;border-radius:50%;background:#f472b6;box-shadow:0 0 6px rgba(244,114,182,.7)"></div></div>
</div>

<div style="margin-top:30px;font-size:15px;font-weight:600;letter-spacing:.05em;background:linear-gradient(90deg,#58d7b8,#4f9cf7,#9b72f2,#f472b6,#ffb56a,#58d7b8);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;animation:ge-shimmer 2.5s linear infinite,ge-enter .65s cubic-bezier(.16,1,.3,1) .18s both">正在生成图片</div>

<div style="position:absolute;inset:0;overflow:hidden;pointer-events:none">${particles}</div>`;

  document.body.appendChild(overlay);
  return overlay;
}

export function removeLoadingOverlay(overlay: HTMLElement): void {
  if (!overlay.isConnected) return;
  overlay.style.animation = "ge-out .4s cubic-bezier(.33,1,.68,1) forwards";
  setTimeout(() => overlay.remove(), 420);
}
