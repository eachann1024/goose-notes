import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SettingsSectionCard } from "./SettingsSectionCard";
import { getGooseDesktop } from "@/lib/electron/runtime";
import licenseText from "/LICENSE?raw";
import sourceInfo from "/SOURCE-CODE.md?raw";

const PROJECT_URL = "https://github.com/eachann1024/goose-note-app";
const textClass =
  "max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border p-4 text-xs leading-relaxed text-foreground";

export function SettingsAbout() {
  const [notices, setNotices] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadNotices() {
    setLoading(true);
    setError("");
    try {
      const text = await import("/THIRD-PARTY-NOTICES.txt?raw");
      setNotices(text.default);
    } catch {
      setError(
        "声明未能加载，请重试，或查看随应用提供的 THIRD-PARTY-NOTICES.txt。",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        关于与许可
      </h3>
      <SettingsSectionCard title="Goose Note · 鹅的笔记">
        <p className="text-sm text-foreground">
          Copyright © 2026 eachann 与贡献者
        </p>
        <p className="text-sm leading-relaxed text-foreground">
          本应用采用 GNU GPL
          第三版（GPL-3.0-only）。你可以依照许可使用、修改和再分发本应用；本应用不提供任何担保，包括适销性或特定用途适用性的担保，法律另有强制规定的除外。
        </p>
        <a
          href={PROJECT_URL}
          target="_blank"
          rel="noreferrer"
          className="inline-block min-h-6 break-all text-sm text-foreground underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          onClick={(event) => {
            const desktop = getGooseDesktop();
            if (desktop) {
              event.preventDefault();
              void desktop.openUrl(PROJECT_URL);
            }
          }}
        >
          {PROJECT_URL}
        </a>
        <details>
          <summary className="min-h-6 cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
            查看 GPL 第三版全文
          </summary>
          <pre
            tabIndex={0}
            aria-label="GPL 第三版许可全文"
            className={textClass}
          >
            {licenseText}
          </pre>
        </details>
      </SettingsSectionCard>
      <SettingsSectionCard title="对应版本源码">
        <p className="text-sm leading-relaxed text-foreground">
          分发本应用时，分发者应按 GPL
          提供与该版本匹配的完整源码及必要的构建、安装脚本。请使用随分发版本提供的源码包或源码下载地址；项目默认分支可能与已安装版本不同。
        </p>
        <details>
          <summary className="min-h-6 cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
            查看源码获取与构建说明
          </summary>
          <pre
            tabIndex={0}
            aria-label="源码获取与构建说明"
            className={textClass}
          >
            {sourceInfo}
          </pre>
        </details>
      </SettingsSectionCard>
      <SettingsSectionCard title="第三方与历史来源">
        <p className="text-sm leading-relaxed text-foreground">
          历史包含 Markdown Preview（Copyright © 2026 Pluk，MIT）及 Goose Note
          早期 MIT 版本。BlockNote XL 采用 GPLv3 路径；BlockNote
          基础库及其他组件保留各自的许可、版权和源码获取权利。
        </p>
        {notices ? (
          <details open>
            <summary className="min-h-6 cursor-pointer text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
              第三方声明全文
            </summary>
            <pre tabIndex={0} aria-label="第三方声明全文" className={textClass}>
              {notices}
            </pre>
          </details>
        ) : (
          <Button
            variant="outline"
            onClick={() => void loadNotices()}
            disabled={loading}
          >
            {loading ? "正在加载声明…" : "查看第三方声明"}
          </Button>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </SettingsSectionCard>
    </div>
  );
}
