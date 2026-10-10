import { useEffect } from "react";
import * as GooseIcons from "@/components/ui/icons";
import { FeatureToastCard } from "@/components/ui/feature-toast-card";
import { useSettings } from "@/stores/useSettings";
import { toast } from "@/components/ui/sonner";

const NOTICE_ID = "ai-writing-assistant";
const NOTICE_TOAST_ID = "ai-feature-notice";

function openAISettings() {
  window.dispatchEvent(
    new CustomEvent("goose-note:open-settings", {
      detail: { tab: "ai" },
    }),
  );
}

function createNoticeContent(handleClose: () => void) {
  const settingsRef = { current: false };
  const closeRef = { current: false };
  return (
    <FeatureToastCard
      icon={<GooseIcons.Sparkles className="h-5 w-5" />}
      title="✨ AI 写作助手已就绪"
      actions={[
        {
          label: "去配置",
          onPointerDown: (e) => { e.preventDefault(); settingsRef.current = true; openAISettings(); handleClose(); },
          onClick: () => { if (settingsRef.current) { settingsRef.current = false; return; } openAISettings(); handleClose(); },
        },
        {
          label: "知道了",
          onPointerDown: (e) => { e.preventDefault(); closeRef.current = true; handleClose(); },
          onClick: () => { if (closeRef.current) { closeRef.current = false; return; } handleClose(); },
          variant: "ghost",
          className: "text-muted-foreground hover:text-[var(--goose-interactive-hover-fg)]",
        },
      ]}
    >
      <p>· 空白行按空格或输入 / 即可唤起 AI 续写</p>
      <p>· 选中文字即可进行润色、精简或翻译</p>
      <p>支持 DeepSeek、Claude、OpenAI 等主流模型，配置 API Key 即可开启体验。</p>
    </FeatureToastCard>
  );
}

export function AIFeatureNotice() {
  const dismissed = useSettings(
    (s) => s.dismissedNotices[NOTICE_ID] === true,
  );
  const hydrated = useSettings((s) => s._hasHydrated === true);
  const dismissNotice = useSettings((s) => s.dismissNotice);

  useEffect(() => {
    // 等 hydration 完成后再决定是否弹窗，避免读到默认值
    if (!hydrated || dismissed) return;

    const handleClose = () => {
      dismissNotice(NOTICE_ID);
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
  }, [dismissed, hydrated, dismissNotice]);

  return null;
}
