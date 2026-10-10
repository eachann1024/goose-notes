export function BootstrapScreen({
  lean,
  error,
}: {
  lean: boolean;
  error?: unknown;
}) {
  const message =
    error instanceof Error && error.message
      ? error.message
      : error
        ? String(error)
        : "";
  return (
    <main className="bootstrap-screen" role={error ? "alert" : "status"}>
      <div className="bootstrap-screen__mark" aria-hidden="true">
        🪿
      </div>
      {error ? (
        <>
          <h1>鹅的笔记暂时无法打开</h1>
          <p>
            {lean
              ? "速记初始化没有完成，草稿数据仍保留在本地。"
              : "初始化没有完成，本地数据不会因此被清除。"}
          </p>
          {message && <code>{message}</code>}
          <button type="button" onClick={() => window.location.reload()}>
            重新加载
          </button>
        </>
      ) : (
        <>
          <h1>{lean ? "正在打开速记" : "正在打开鹅的笔记"}</h1>
          <p>{lean ? "正在恢复草稿…" : "正在恢复本地笔记与设置…"}</p>
          <span className="bootstrap-screen__progress" aria-hidden="true" />
        </>
      )}
    </main>
  );
}
