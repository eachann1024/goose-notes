/**
 * 速记窗与 workspace 互不隶属。show / close / app.focus({ steal: true })
 * 都会让 macOS 补发 app.activate；这段时间里所有 activate 都忽略，
 * 避免把大窗拉到前台。TTL 只防止令牌残留，真实 Dock 点击发生在窗口之后。
 */
export function createQuicknoteActivateSuppression(
  ttlMs = 1_500,
  now: () => number = Date.now,
): { mark: () => void; shouldSuppress: () => boolean } {
  let expiresAt = 0;

  return {
    mark: () => {
      expiresAt = now() + ttlMs;
    },
    shouldSuppress: () => expiresAt > now(),
  };
}
