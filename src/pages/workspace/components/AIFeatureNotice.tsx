import { useEffect } from "react";
import * as LucideIcons from "lucide-react";
import { FeatureToastCard } from "@/components/ui/feature-toast-card";
import { usePersistentDismissState } from "@/hooks/usePersistentDismissState";
import { toast } from "sonner";

const NOTICE_ID = "feature-toast:ai-writing-assistant";
const NOTICE_EVENT_NAME = "goose-note:show-ai-feature-notice";
const NOTICE_TOAST_ID = "ai-feature-notice";

function openAISettings() {
  window.dispatchEvent(
    new CustomEvent("goose-note:open-settings", {
      detail: { tab: "ai" },
    }),
  );
}

function createNoticeContent(handleClose: () => void) {
  return (
    <FeatureToastCard
      icon={<LucideIcons.Sparkles className="h-4.5 w-4.5" />}
      title="✨ AI 写作助手已上线"
      actions={[
        {
          label: "设置",
          onClick: () => {
            openAISettings();
            handleClose();
          },
        },
        {
          label: "我知道了",
          onClick: handleClose,
          variant: "ghost",
          className: "text-muted-foreground hover:text-foreground",
        },
      ]}
    >
      <p>· 输入框内按空格 → 唤起 AI</p>
      <p>· 选中文字 → 一键润色改写</p>
      <p>支持 uTools AI 或自定义接入，前往设置配置。</p>
    </FeatureToastCard>
  );
}

export function AIFeatureNotice() {
  const { visible, dismiss, reset } = usePersistentDismissState(NOTICE_ID);

  useEffect(() => {
    const handleShowNotice = () => {
      reset();
    };

    window.addEventListener(NOTICE_EVENT_NAME, handleShowNotice);
    return () => {
      window.removeEventListener(NOTICE_EVENT_NAME, handleShowNotice);
    };
  }, [reset]);

  useEffect(() => {
    if (!visible) return;

    const handleClose = () => {
      dismiss();
      toast.dismiss(NOTICE_TOAST_ID);
    };

    toast.custom(() => createNoticeContent(handleClose), {
      id: NOTICE_TOAST_ID,
      duration: Infinity,
      dismissible: false,
    });

    return () => {
      toast.dismiss(NOTICE_TOAST_ID);
    };
  }, [dismiss, visible]);

  return null;
}

export function showAIFeatureNotice() {
  window.dispatchEvent(new CustomEvent(NOTICE_EVENT_NAME));
}
