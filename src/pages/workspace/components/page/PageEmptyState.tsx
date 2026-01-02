export function PageEmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-start pt-16 text-muted-foreground bg-background overflow-y-auto">
      <h2 className="text-3xl font-bold text-foreground mb-4">
        准备好记录想法了吗？
      </h2>
      <p className="text-base opacity-60 mb-8">
        点击左侧侧边栏新建页面，或选择现有页面开始。
      </p>

      <div className="w-full max-w-6xl px-12 pb-12 flex flex-col items-center justify-start">
        <img
          src="https://goose-notion-1257312034.cos.ap-guangzhou.myqcloud.com/welcome-cover.png"
          alt="Welcome"
          className="w-full h-auto max-h-[50vh] object-contain opacity-90"
        />
        <p className="text-sm text-muted-foreground/60 mt-4">
          💡 {getRandomTip()}
        </p>
      </div>
    </div>
  );
}
