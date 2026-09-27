import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useCreateBlockNote, BlockNoteViewRaw as BlockNoteView } from "@blocknote/react";
import { zh } from "@blocknote/core/locales";
import "@blocknote/react/style.css";
import { ArrowRight, Check, FolderOpen, Layout, Palette, ShieldCheck, Laptop, Sun, Moon } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/stores/useSettings";
import { DEFAULT_APP_SHORTCUTS } from "@/stores/settings/slices/shortcutsSlice";
import { formatShortcut } from "@/lib/utils";
import type { PageLayout } from "@/types";
import type { Theme } from "@/stores/useSettings";
import { ReadingPreferences } from "./ReadingPreferences";
import { getGooseDesktop } from "@/lib/electron/runtime";
import { editorSchema } from "@/components/editor/core/schema";
import { createEditorSafeContent, normalizePageContent, type BlockNoteContent } from "@/components/editor/utils/blocknote-content";
import "./setup-guide.css";

const layouts = [["standard", "标准", "适度留白，专心书写"], ["full", "全宽", "把可用空间留给内容"]] as const;

const sampleNote: BlockNoteContent = [
  { type: "heading", props: { level: 1 }, content: "周会纪要" },
  { type: "paragraph", content: "本周梳理了搜索和编辑体验中的问题，优先解决影响日常使用的细节。" },
  { type: "heading", props: { level: 2 }, content: "讨论结论" },
  { type: "paragraph", content: "搜索结果需要标明所属笔记；打开结果后保留当前定位，方便继续阅读。" },
  { type: "heading", props: { level: 2 }, content: "提醒事项" },
  { type: "checkListItem", props: { checked: true }, content: "汇总本周收到的搜索反馈" },
  { type: "checkListItem", props: { checked: false }, content: "确定搜索问题的修复顺序" },
  { type: "checkListItem", props: { checked: false }, content: "邀请团队成员试用编辑区调整并收集意见" },
];

const guideNoteKey = "goose-note:setup-guide-note";

function SetupGuideNote({ theme }: { theme: "light" | "dark" }) {
  const [initialContent] = useState(() => {
    try {
      const saved = localStorage.getItem(guideNoteKey);
      return saved && saved.length < 1_000_000
        ? createEditorSafeContent(normalizePageContent(JSON.parse(saved)), editorSchema)
        : sampleNote;
    } catch {
      return sampleNote;
    }
  });
  const [saveError, setSaveError] = useState(false);
  const editor = useCreateBlockNote({
    schema: editorSchema,
    dictionary: { ...zh, placeholders: { ...zh.placeholders, default: "输入笔记内容…" } },
    initialContent: initialContent as any,
    domAttributes: { editor: { class: "goose-blocknote-editor" } },
  });
  return <div className="workspace-editor-surface" data-font-family="default">
    <BlockNoteView editor={editor} theme={theme} slashMenu={false} sideMenu={false} tableHandles={false} filePanel={false} onChange={() => {
      try {
        localStorage.setItem(guideNoteKey, JSON.stringify(editor.document));
        if (saveError) setSaveError(false);
      } catch {
        setSaveError(true);
      }
    }} />
    {saveError && <p role="alert">暂时无法保存编辑，请先复制内容。</p>}
  </div>;
}

export function SetupGuide() {
  const hydrated = useSettings(state => state._hasHydrated);
  const seen = useSettings(state => state.setupGuideSeen);
  const open = useSettings(state => state.setupGuideOpen);
  useEffect(() => {
    if (hydrated && !seen) useSettings.setState({ setupGuideOpen: true });
  }, [hydrated, seen]);
  useEffect(() => { if (open) void getGooseDesktop()?.maximizeWindow?.(); }, [open]);
  return open ? <SetupGuideSteps /> : null;
}

function SetupGuideSteps() {
  const settings = useSettings.getState();
  const [step, setStep] = useState(0);
  const [layout, setLayout] = useState<PageLayout>(settings.defaultPageLayout);
  const [theme, setTheme] = useState<Theme>(settings.theme);
  const [fontSize, setFontSize] = useState(settings.editorFontSize);
  const [lineHeight, setLineHeight] = useState(settings.editorLineHeight);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const heading = useRef<HTMLHeadingElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const toggleAiShortcut = useSettings(state => state.appShortcuts.toggleAIPanel ?? DEFAULT_APP_SHORTCUTS.toggleAIPanel);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const close = () => useSettings.setState({ setupGuideSeen: true, setupGuideOpen: false });
  const finish = () => {
    settings.setTheme(theme);
    settings.setEditorFontSize(fontSize);
    settings.setEditorLineHeight(lineHeight);
    useSettings.setState({ defaultPageLayout: layout, setupGuideSeen: true, setupGuideOpen: false });
  };
  const openSettings = (tab: "ai" | "shortcuts") => {
    finish();
    window.dispatchEvent(new CustomEvent("goose-note:open-settings"));
    window.dispatchEvent(new CustomEvent("goose-note:settings-tab-change", { detail: { tab } }));
  };
  const titles = ["让笔记，更合你的习惯", "给内容合适的空间", "选择舒服的阅读方式", "笔记在本地，备份多一份", "在笔记里使用 AI"];
  const descriptions = ["一分钟，设好书写空间。随时都能修改。", "默认用于未单独指定布局的笔记。", "先看看效果，完成后再应用。", "无需现在配置云服务，先了解保存方式。", "先连接 AI 服务，再用下面三种方式开始。"];
  return <Dialog open onOpenChange={value => { if (!value) close(); }}>
    <DialogContent hideClose className="setup-guide" data-setup-theme={theme === "dark" || (theme === "system" && systemDark) ? "dark" : "light"}>
      <section className="setup-preview" aria-label={step === 4 ? "AI 使用指南" : "笔记编辑区"}>
        <header className="setup-preview-header">
          <h2>{step === 4 ? "AI 使用指南" : "笔记编辑区"}</h2>
          <span>{step === 4 ? "完成引导后，在笔记中试用" : "点击正文输入，试试勾选提醒事项"}</span>
        </header>
        {step === 4 ? <div className="setup-ai-guide">
          <ol>
            <li><span>01</span><div><h3>从空白段落开始写</h3><p>在笔记的空白段落按 <kbd>空格</kbd>，唤起行内 AI，再输入你希望它完成的任务。</p></div></li>
            <li><span>02</span><div><h3>处理已有文字</h3><p>选中一段文字，点击浮动格式工具栏上的「AI」，可以润色、改写或翻译。</p></div></li>
            <li><span>03</span><div><h3>打开 AI 对话</h3><p>按 {toggleAiShortcut ? <kbd>{formatShortcut(toggleAiShortcut)}</kbd> : "自定义快捷键"}，或点击笔记顶部的 AI 图标，打开面板提问。</p></div></li>
          </ol>
          <p className="setup-ai-guide-note">这些入口在正式笔记中使用；此处的练习笔记不唤起 AI。</p>
        </div> : <>
        <div className="setup-preview-body" data-preview-layout={layout}>
          <div className="setup-preview-scroll" ref={preview}>
            <div className="setup-preview-document" style={{ "--editor-font-size": `${fontSize}px`, "--editor-line-height": lineHeight } as CSSProperties}>
              <SetupGuideNote theme={theme === "dark" || (theme === "system" && systemDark) ? "dark" : "light"} />
            </div>
          </div>
        </div>
        </>}
      </section>
      <section className="setup-panel">
        <header>
          <div className="setup-progress" aria-label={`第 ${step + 1} 步，共 ${titles.length} 步`}>{titles.map((_, i) => <i key={i} data-complete={i <= step} />)}</div>
          <div className="setup-eyebrow">YOUR SPACE, YOUR WAY</div>
          <DialogTitle ref={heading} tabIndex={-1}>{titles[step]}</DialogTitle>
          <DialogDescription>{descriptions[step]}</DialogDescription>
        </header>
        <div className="setup-step-body">
          {step === 0 && <div>
            {[[Layout, "书写空间", "标准与全宽，按习惯选择。"], [Palette, "阅读偏好", "主题、字号与行高，调到看得舒服。"], [ShieldCheck, "本地与备份", "了解文件保存方式与备份入口。"]].map(([Icon, title, text]) => {
              const ItemIcon = Icon as typeof Layout;
              return <div key={String(title)} className="setup-feature"><span><ItemIcon size={18} /></span><div><strong>{String(title)}</strong><p>{String(text)}</p></div></div>;
            })}
          </div>}
          {step === 1 && <>
            <div className="setup-layouts" role="group" aria-label="默认编辑布局">
              {layouts.map(([value, label, text]) => <button type="button" key={value} aria-pressed={layout === value} onClick={() => setLayout(value)}>
                <div className="setup-mini" data-layout={value} aria-hidden="true"><div>{[1, 2, 3, 4].map(n => <i key={n} />)}</div></div>
                <div><strong>{label}{layout === value && <Check size={14} />}</strong><small>{text}</small></div>
              </button>)}
            </div>
          </>}
          {step === 2 && <div className="setup-reading">
            <div className="setup-theme" role="group" aria-label="主题">
              {([["system", "跟随系统", Laptop], ["light", "浅色", Sun], ["dark", "深色", Moon]] as const).map(([value, label, Icon]) => (
                <button type="button" key={value} aria-pressed={theme === value} onClick={() => setTheme(value)}>
                  <Icon size={18} aria-hidden="true" />{label}
                </button>
              ))}
            </div>
            <ReadingPreferences showPreview={false} fontSize={fontSize} lineHeight={lineHeight} onFontSizeChange={setFontSize} onLineHeightChange={setLineHeight} />
          </div>}
          {step === 3 && <div className="setup-backup">
            <FolderOpen size={24} /><h3>本地文件夹，就是你的笔记本</h3>
            <p>从左下角文件夹菜单添加文件夹。笔记保存在本地，单篇布局随笔记的 YAML 一起记录。</p>
            <div>设置 → 数据管理 → 本地备份</div>
            <p>导出 ZIP 留存副本。WebDAV 可稍后配置，当前不会自动开启。</p>
          </div>}
          {step === 4 && <div className="setup-ai-settings">
            <div><h3>先连接 AI 服务</h3><p>到「设置 → AI 助手」开启写作助手，在「AI 服务」填写 API Key 并选择模型；默认不会自动开启。</p><Button variant="outline" size="sm" onClick={() => openSettings("ai")}>完成引导并打开 AI 设置</Button></div>
            <div><h3>面板快捷键可以修改</h3><p>当前：{toggleAiShortcut ? <kbd>{formatShortcut(toggleAiShortcut)}</kbd> : "未设置"}。到「设置 → 快捷键 → 应用内动作 → 开关 AI 面板」，点击输入框按下新组合键；清空即关闭。</p><Button variant="outline" size="sm" onClick={() => openSettings("shortcuts")}>完成引导并修改快捷键</Button></div>
            <p>空白段落的空格是行内 AI 入口，与可修改的面板快捷键不同。</p>
          </div>}
        </div>
        <footer className="setup-footer">
          <Button variant="ghost" onClick={close}>暂时跳过</Button>
          <span aria-live="polite">{step + 1} / {titles.length}</span>
          {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>上一步</Button>}
          <Button onClick={() => step === titles.length - 1 ? finish() : setStep(step + 1)}>{step === titles.length - 1 ? "完成设置" : step === 0 ? "开始设置" : "下一步"}<ArrowRight className="ml-2 h-4 w-4" /></Button>
        </footer>
      </section>
    </DialogContent>
  </Dialog>;
}
