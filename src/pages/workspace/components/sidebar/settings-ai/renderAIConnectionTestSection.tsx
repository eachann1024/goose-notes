import * as GooseIcons from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { SettingsSectionCard } from "../settings/SettingsSectionCard";
import { cn } from "@/lib/utils";
import type { useAIModelRefresh } from "./useAIModelRefresh";

export function renderAIConnectionTestSection(
  context: ReturnType<typeof useAIModelRefresh>,
) {
  const {
    enabled,
    isOnboarding,
    testingConnection,
    connectionTestResult,
    connectionTestMessage,
    cancelConnectionTest,
    setupAIStatus,
    canTestConnection,
    handleTestConnection,
  } = context;
  return isOnboarding ? (
    <SettingsSectionCard
      className="p-4"
      title="连接测试"
      description="仅发送测试请求以验证接口连通性，不会读取任何笔记或本地配置。"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!canTestConnection}
          onClick={() => void handleTestConnection()}
        >
          {testingConnection ? (
            <GooseIcons.LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <GooseIcons.PlugZap className="h-4 w-4" />
          )}
          {testingConnection ? "测试中…" : "测试连接"}
        </Button>
        {testingConnection ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={cancelConnectionTest}
          >
            取消测试
          </Button>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-3 text-sm",
          connectionTestResult === "success"
            ? "text-foreground"
            : connectionTestResult === "failed" ||
                connectionTestResult === "timeout"
              ? "text-danger"
              : "text-muted-foreground",
        )}
        role="status"
        aria-live="polite"
      >
        {testingConnection
          ? "正在测试连接…"
          : connectionTestResult !== "idle"
            ? connectionTestMessage
            : !enabled
              ? "启用 AI 并保存配置、获取模型后可测试连接。"
              : setupAIStatus.dirty
                ? "请先保存当前服务商配置。"
                : !setupAIStatus.ready
                  ? "请先保存配置并获取可用模型。"
                  : "测试不会读取笔记或本地上下文。"}
      </p>
    </SettingsSectionCard>
  ) : null;
}
