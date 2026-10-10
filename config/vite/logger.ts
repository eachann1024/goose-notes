import { createLogger } from "vite";
export function createAppLogger() {
  const logger = createLogger();
  const originalWarnOnce = logger.warnOnce.bind(logger);
  const originalWarn = logger.warn.bind(logger);
  const isKatexFontWarning = (msg: string) =>
    msg.includes("KaTeX_") && msg.includes("didn't resolve at build time");
  logger.warnOnce = (msg, options) => {
    if (isKatexFontWarning(msg)) return;
    originalWarnOnce(msg, options);
  };
  logger.warn = (msg, options) => {
    if (isKatexFontWarning(msg)) return;
    originalWarn(msg, options);
  };

  return logger;
}
