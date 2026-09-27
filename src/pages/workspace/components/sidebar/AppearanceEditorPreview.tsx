import { UI_FONT_SIZE_MAP } from "@/lib/appearance";
import type { UIFontSize } from "@/stores/settings/types";
import { useSettings } from "@/stores/useSettings";

interface Props {
  sidebarFontSize: number;
  editorFontSize: number;
  editorLineHeight: number;
  uiFontSize: UIFontSize;
}

function EditorSample({
  sidebarFontSize,
  editorFontSize,
  editorLineHeight,
  uiFontSize,
}: Props) {
  const layout = useSettings((state) => state.defaultPageLayout);
  return (
    <div
      data-page-layout={layout}
      className="flex h-full w-full flex-col overflow-hidden text-foreground"
      style={{ background: "var(--goose-editor-surface)" }}
    >
      <div
        className="flex h-11 shrink-0 items-center gap-3 border-b border-border/70 px-4"
        style={{
          background: "var(--goose-shell-surface)",
          fontFamily: "var(--font-ui)",
          fontSize: UI_FONT_SIZE_MAP[uiFontSize],
        }}
      >
        <span className="font-semibold">📁 当前文件夹</span>
        <span className="text-muted-foreground">/</span>
        <span>雨停后的星期三</span>
        <span className="ml-auto text-muted-foreground">•••</span>
      </div>
      <div className="flex min-h-0 flex-1">
        <div
          className="appearance-preview-sidebar w-44 shrink-0 border-r border-border/70 p-3"
          style={{
            background: "var(--goose-shell-surface)",
            fontFamily: "var(--font-sidebar)",
            fontSize: sidebarFontSize,
          }}
        >
          <p className="mb-5 truncate font-semibold">本地</p>
          <p className="truncate rounded-lg bg-[var(--goose-interactive-selected)] px-2 py-1.5 text-[var(--goose-interactive-selected-fg)]">
            ▤ 雨停后的星期三
          </p>
          <p className="mt-2 truncate px-2">▤ 项目计划</p>
        </div>
        <div className="page-layout-body flex min-w-0 flex-1">
          <div className="min-w-0 flex-1 overflow-y-auto">
            <div
              className="page-layout-document"
              style={{
                fontFamily: "var(--font-default)",
                fontSize: editorFontSize,
                lineHeight: editorLineHeight,
                letterSpacing: "normal",
                WebkitFontSmoothing: "auto",
              }}
            >
              <h3 className="mb-[var(--page-title-gap)] text-[2em] leading-[1.6] tracking-[-0.5px]" style={{ fontWeight: 650 }}>
                雨停后的星期三
              </h3>
              <p className="mb-[var(--page-paragraph-gap)]">
                傍晚下班时，雨刚好停了。街角的面包店还亮着灯，我买了一只热乎的可颂，绕着小公园慢慢走回家。
              </p>
              <ul className="mb-3 list-disc pl-6">
                <li>路灯下的树影拉得很长，长椅上还留着细小的水珠</li>
                <li>纸袋里的可颂带着热气，走到家门口还是酥的</li>
              </ul>
              <p className="mb-[var(--page-paragraph-gap)]">
                晚饭后给阳台的薄荷浇了水，新叶已经冒出来。窗外吹进一点凉风，屋里只开一盏台灯，读了几页搁置已久的书。
              </p>
              <ul aria-label="提醒事项" className="mb-3 list-none space-y-1 pl-0">
                <li className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-2 size-4 shrink-0 rounded border border-current" />
                  给妈妈打个电话，问问她最近睡得好不好
                </li>
                <li className="flex items-start gap-2">
                  <span aria-hidden="true" className="mt-2 size-4 shrink-0 rounded border border-current" />
                  把散步时拍的照片整理进相册
                </li>
              </ul>
              <blockquote
                className="my-[30px] border-l-2 border-muted-foreground py-[3px] pl-[20px] text-[calc(18em/17)] text-muted-foreground"
              >
                “日子不必安排得太满。留一点空白，才有时间看看窗外的云。”
              </blockquote>
              <p className="mb-2" style={{ fontFamily: "var(--font-serif)" }}>
                衬线体示例 · A little room to breathe.
              </p>
              <div className="goose-code-block-node">
                <div className="goose-code-content-wrapper !pt-0">
                  <pre className="goose-code-pre">
                    <code>
                      <span className="hljs-keyword">const</span>{" "}
                      <span className="hljs-variable">weekend</span> = [
                      <span className="hljs-string">"逛花市"</span>,{" "}
                      <span className="hljs-string">"买咖啡豆"</span>];
                    </code>
                  </pre>
                </div>
              </div>
              <h4 className="mt-[var(--page-title-gap)] mb-[14px] text-[calc(21em/17)] leading-[1.6] font-semibold tracking-[-0.25px]">周末的小计划</h4>
              <p className="mb-[var(--page-paragraph-gap)]">
                如果天气好，周六早晨去花市挑一盆迷迭香。回程买些咖啡豆，下午就在家煮一杯，慢慢整理上个月的照片。
              </p>
              <p>
                也想给自己留一段不赶时间的午后：翻到书签夹着的那一页，读完它，再把喜欢的句子记下来。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppearanceEditorPreview(props: Props) {
  return (
    <section
      aria-label="编辑器即时预览"
      className="min-w-0 overflow-hidden rounded-lg border border-border/70 shadow-sm"
    >
      <EditorSample {...props} />
    </section>
  );
}
