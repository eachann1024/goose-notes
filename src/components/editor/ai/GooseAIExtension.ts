import { createExtension, createStore, type ExtensionOptions } from "@blocknote/core";
import type { AISettingsLike } from "@/lib/ai-provider/types";
import {
  applyPrivateInlineDraft, assertPrivateInlineTarget, capturePrivateInlineTarget,
  preparePrivateInlineDraft, locatePrivateInlineTarget,
} from "@/lib/notebook-ai/inlineMarkdownApplySelection";
import type { InlineMenuState } from "./inlineRewriteSession";
import { getPageInlineRewriteSession, type PageInlineRewriteSession } from "./pageInlineRewriteSession";
import { composeInlineBusyTicker } from "./inlineBusyTicker";
import { runInlineMarkdownRewrite } from "./transport/runInlineMarkdownRewrite";
import { createInlinePreviewPlugin, setInlinePreview, type InlinePreviewPart } from "./inlinePreview";
import { TextSelection } from "prosemirror-state";

type Options = {
  getScope: () => { pageId: string; editable: boolean; protectFirstTitle: boolean };
  getSettings: () => AISettingsLike & {
    enabled?: boolean;
    workspaceSelectedModelId?: string | null;
    customModelOptions?: Array<{ id: string }>;
  };
};

export const GooseAIExtension = createExtension(
  ({ editor, options }: ExtensionOptions<Options>) => {
    const store = createStore<{ aiMenuState: InlineMenuState }>({ aiMenuState: "closed" });
    let boundPageId: string | undefined = options.getScope().pageId;
    let session: PageInlineRewriteSession | undefined;
    let unsubscribe: (() => void) | undefined;
    let refreshing = false;
    const preview = createInlinePreviewPlugin();
    const current = () => boundPageId && options.getScope().pageId === boundPageId ? session : undefined;
    const validate = (owned: PageInlineRewriteSession) => {
      const scope = options.getScope();
      if (current() !== owned || !scope.editable || options.getSettings().enabled === false)
        throw new Error("当前页面已删除、锁定或不可编辑，原文未修改。");
      if (!owned.target) throw new Error("请重新选择正文。");
      if (scope.protectFirstTitle && owned.target.sourceBlockIds.includes(editor.document[0]?.id))
        throw new Error("页面标题不支持行内 AI 改写，请选择正文。");
      assertPrivateInlineTarget(editor, owned.target);
    };
    const refresh = () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const owned = current();
        let visible = owned?.state ?? "closed";
        let parts: InlinePreviewPart[] = [];
        if (owned?.target && visible !== "closed") {
          try {
            validate(owned);
            const locations = locatePrivateInlineTarget(editor, owned.target);
            const draft = visible.status === "user-reviewing" ? preparePrivateInlineDraft(editor, owned.target, owned.drafts) : undefined;
            parts = locations.map((part, index) => ({
              from: part.from, to: part.to,
              blockFrom: part.from - part.offsetFrom - 1,
              blockTo: part.from - part.offsetFrom - 1 + part.node.firstChild!.nodeSize,
              oldText: part.node.firstChild!.textBetween(part.offsetFrom, part.offsetTo, "\n", "\n"),
              newText: draft?.edits[index]?.text,
              reviewing: visible !== "closed" && visible.status === "user-reviewing",
              formattingChanged: draft?.edits[index]?.formattingChanged,
            }));
          } catch (error) {
            // A stale split pane may fail locally; it must never cancel another pane's request.
            visible = { ...visible, status: "error", error };
          }
        }
        store.setState(() => ({ aiMenuState: visible }));
        if (editor.prosemirrorView) setInlinePreview(editor.prosemirrorView, preview.key, parts);
      } finally { refreshing = false; }
    };
    const detachPage = () => {
      unsubscribe?.(); unsubscribe = undefined;
      session = undefined; boundPageId = undefined;
      refresh();
    };
    const attachPage = (pageId: string) => {
      if (boundPageId === pageId && session) {
        unsubscribe ??= session.subscribe(refresh);
        refresh(); return;
      }
      unsubscribe?.();
      boundPageId = pageId;
      session = getPageInlineRewriteSession(pageId);
      unsubscribe = session.subscribe(refresh);
      refresh();
    };
    const submit = async (prompt: string) => {
      const owned = current();
      if (!owned) return;
      try {
        validate(owned);
        // Capture only provider options, never a page/editor closure, for the in-flight request.
        const settings = options.getSettings();
        const models = settings.customModelOptions ?? [];
        const preferred = settings.workspaceSelectedModelId?.trim();
        const modelId = (preferred && models.some((model) => model.id === preferred) ? preferred : "") ||
          settings.selectedModelId?.trim() || models[0]?.id || "";
        if (!modelId) throw new Error("请先选择模型后再使用行内 AI。");
        await owned.submit(prompt, (oldMarkdown, userPrompt, abortSignal, update) => runInlineMarkdownRewrite({
          settings, modelId, userPrompt, oldMarkdown, abortSignal,
          onUpdate: (value) => update(composeInlineBusyTicker(value)),
        }));
      } catch (error) { owned.fail(error); }
    };
    const dismiss = () => {
      const owned = current();
      if (!owned) return;
      const target = owned.target;
      const view = editor.prosemirrorView;
      let selection;
      if (target && view && !view.isDestroyed) {
        try {
          const parts = locatePrivateInlineTarget(editor, target);
          selection = view.state.doc.eq(target.document) ? target.bookmark.resolve(view.state.doc) :
            TextSelection.create(view.state.doc, parts[0].from, parts.at(-1)!.to);
        } catch { /* A conflicting draft can still be dismissed without restoring stale offsets. */ }
      }
      owned.close();
      if (view && !view.isDestroyed && editor.domElement?.isConnected) {
        if (selection) view.dispatch(view.state.tr.setSelection(selection).setMeta("addToHistory", false));
        view.focus();
      }
    };
    // Non-mounted core editors can use the same API in tests; React explicitly detaches around page replacement.
    if (boundPageId) { session = getPageInlineRewriteSession(boundPageId); unsubscribe = session.subscribe(refresh); }
    return {
      key: "goose-inline-ai" as const,
      store,
      prosemirrorPlugins: [preview.plugin],
      attachPage,
      detachPage,
      invalidateIfNeeded: refresh,
      getSelectionAnchor() {
        const owned = current();
        if (!owned?.target) return undefined;
        try {
          const parts = locatePrivateInlineTarget(editor, owned.target);
          return { from: parts[0].from, to: parts.at(-1)!.to };
        } catch { return undefined; }
      },
      openAIMenuAtBlock(blockId: string) {
        const owned = current();
        if (!owned) return;
        try {
          const scope = options.getScope();
          if (!scope.editable || options.getSettings().enabled === false || !editor.isEditable)
            throw new Error("当前页面不可编辑或 AI 未开启。");
          const target = capturePrivateInlineTarget(editor, blockId);
          if (scope.protectFirstTitle && target.sourceBlockIds.includes(editor.document[0]?.id))
            throw new Error("页面标题不支持行内 AI 改写，请选择正文。");
          owned.open(target);
        } catch (error) { owned.close(); owned.fail(error, blockId); }
      },
      closeAIMenu: dismiss,
      rejectChanges: dismiss,
      setInput(input: string) { current()?.setInput(input); },
      abort() { current()?.stop(); },
      submit,
      retry() { const owned = current(); if (owned && owned.state !== "closed") return submit(owned.state.prompt); },
      acceptChanges() {
        const owned = current();
        if (!owned || owned.state === "closed" || owned.state.status !== "user-reviewing" || !owned.target) return;
        try {
          validate(owned);
          const draft = preparePrivateInlineDraft(editor, owned.target, owned.drafts);
          applyPrivateInlineDraft(editor, owned.target, draft);
          owned.close();
          if (editor.domElement?.isConnected && !editor.prosemirrorView.isDestroyed) editor.focus();
        } catch (error) { owned.fail(error); }
      },
      mount() {
        if (boundPageId) attachPage(boundPageId);
        const stop = editor.onChange(refresh);
        return () => { stop(); unsubscribe?.(); unsubscribe = undefined; };
      },
    };
  },
);
