import { useEffect, useState } from "react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const NOTICE_STORAGE_KEY = "goose-note-ai-feature-notice-dismissed";
const NOTICE_EVENT_NAME = "goose-note:show-ai-feature-notice";

function openAISettings() {
  window.dispatchEvent(
    new CustomEvent("goose-note:open-settings", {
      detail: { tab: "ai" },
    }),
  );
}

function createNoticeContent(handleClose: () => void) {
  return (
    <div className="flex max-w-[360px] gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
        <LucideIcons.Sparkles className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="pr-6 text-sm font-semibold text-foreground">✨ AI 写作助手已上线</div>
        <div className="mt-1 space-y-1 text-[13px] leading-5 text-muted-foreground">
          <p>· 输入框内按空格 → 唤起 AI</p>
          <p>· 选中文字 → 一键润色改写</p>
          <p>支持 uTools AI 或自定义接入，前往设置配置。</p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-[10px] px-3 text-xs"
            onClick={() => {
              openAISettings();
              handleClose();
            }}
          >
            设置
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 rounded-[10px] px-3 text-xs text-muted-foreground hover:text-foreground"
            onClick={handleClose}
          >
            我知道了
          </Button>
        </div>
      </div>
    </div>
  );
}

export function AIFeatureNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(NOTICE_STORAGE_KEY) === "true";
    if (!dismissed) {
      setVisible(true);
    }

    const handleShowNotice = () => {
      localStorage.removeItem(NOTICE_STORAGE_KEY);
      setVisible(true);
    };

    window.addEventListener(NOTICE_EVENT_NAME, handleShowNotice);
    return () => {
      window.removeEventListener(NOTICE_EVENT_NAME, handleShowNotice);
    };
  }, []);

  useEffect(() => {
    if (!visible) return;

    const dismiss = () => {
      localStorage.setItem(NOTICE_STORAGE_KEY, "true");
      setVisible(false);
      toast.dismiss("ai-feature-notice");
    };

    toast.custom(() => createNoticeContent(dismiss), {
      id: "ai-feature-notice",
      duration: Infinity,
      dismissible: false,
    });

    return () => {
      toast.dismiss("ai-feature-notice");
    };
  }, [visible]);

  return null;
}

export function showAIFeatureNotice() {
  window.dispatchEvent(new CustomEvent(NOTICE_EVENT_NAME));
}
