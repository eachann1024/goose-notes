// 远程字体 URL（体积大，需预加载）
const REMOTE_FONTS = [
  "https://cdn.jsdelivr.net/gh/eachann1024/Resources@publish/%E9%B8%BF%E8%92%99%E9%BB%91%E4%BD%93-HarmonyOS%20Sans%20SC.woff2",
  "https://cdn.jsdelivr.net/gh/eachann1024/Resources@publish/%E4%BB%93%E8%80%B3%E4%BB%8A%E6%A5%B703W04.woff2",
];

/**
 * 应用启动时调用，后台静默预加载远程字体
 * 浏览器会自动缓存，下次访问秒加载
 */
export function preloadFonts() {
  REMOTE_FONTS.forEach((url) => {
    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "font";
    link.type = "font/woff2";
    link.href = url;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  });
}
