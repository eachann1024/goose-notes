import mixpanel from "mixpanel-browser";
import { getAIProviderMode, type AISettingsLike } from "@/lib/ai-provider";
import { getDbStorageItem, removeDbStorageItem, setDbStorageItem } from "@/lib/storage";
import type { Notebook } from "@/stores/useNotebooks";
import { UToolsAdapter } from "@/lib/utools";

export type ProviderSource = "utools" | "custom";
export type CustomProtocolValue = "openai" | "claude" | "none";

type Primitive = string | number | boolean;
type EventProps = Record<string, Primitive | null | undefined>;

const ANALYTICS_INSTALL_ID_KEY = "goose-note-analytics-install-id";
const DEFAULT_HOST_ENV = "utools";
const REPLAY_SAMPLE_RATE = 100;
const SESSION_ID_SEPARATOR = "-";

export interface AnalyticsContext {
  provider_source: ProviderSource;
  custom_protocol: CustomProtocolValue;
  ai_enabled: boolean;
  selected_model_id: string;
  notebook_count_current: number;
  has_multiple_notebooks: boolean;
  install_id: string;
  distinct_id: string;
  user_name: string;
  user_type: string;
  session_id: string;
  app_version: string;
  app_env: string;
  host_env: string;
  platform: string;
  is_dev: boolean;
}

export interface AnalyticsInitOptions {
  token: string;
  appVersion: string;
  appEnv: string;
  hostEnv?: string;
  platform?: string;
  isDev: boolean;
  enableReplay?: boolean;
}

const analyticsContext: AnalyticsContext = {
  provider_source: "utools",
  custom_protocol: "none",
  ai_enabled: false,
  selected_model_id: "",
  notebook_count_current: 1,
  has_multiple_notebooks: false,
  install_id: "",
  distinct_id: "",
  user_name: "",
  user_type: "",
  session_id: "",
  app_version: "",
  app_env: "unknown",
  host_env: DEFAULT_HOST_ENV,
  platform: "unknown",
  is_dev: false,
};

let analyticsInitialized = false;
let currentToken = "";

function safeAnalyticsCall<T>(callback: () => T): T | undefined {
  try {
    return callback();
  } catch {
    return undefined;
  }
}

function normalizeEventProps(props: EventProps = {}) {
  return Object.fromEntries(
    Object.entries(props).filter(([, value]) => value !== undefined && value !== null),
  ) as Record<string, Primitive>;
}

function createRandomId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}${SESSION_ID_SEPARATOR}${crypto.randomUUID()}`;
  }

  return `${prefix}${SESSION_ID_SEPARATOR}${Date.now().toString(36)}${SESSION_ID_SEPARATOR}${Math.random().toString(36).slice(2, 10)}`;
}

function getMixpanelReplayProps() {
  return safeAnalyticsCall(() => mixpanel.get_session_recording_properties()) ?? {};
}

function getCurrentDistinctId() {
  return (
    safeAnalyticsCall(() => mixpanel.get_distinct_id()) ??
    analyticsContext.distinct_id ??
    analyticsContext.install_id
  );
}

function getStableInstallId() {
  const storedInstallId = getDbStorageItem(ANALYTICS_INSTALL_ID_KEY);
  if (storedInstallId) return storedInstallId;

  const installId = createRandomId("install");
  setDbStorageItem(ANALYTICS_INSTALL_ID_KEY, installId);
  return installId;
}

function createSessionId() {
  return createRandomId("session");
}

function getUToolsDistinctProfile(installId: string) {
  const user = UToolsAdapter.getUser();
  const nickname = user?.nickname?.trim() ?? "";
  const userType = user?.type?.trim() ?? "";

  if (!nickname && !userType) {
    return {
      distinctId: installId,
      userName: "",
      userType: "",
    };
  }

  return {
    distinctId: `utools:${nickname || "anonymous"}:${userType || "unknown"}`,
    userName: nickname,
    userType,
  };
}

function getIdentifyId() {
  return analyticsContext.distinct_id || analyticsContext.install_id;
}

function getUserProfileProps() {
  return {
    distinct_id: analyticsContext.distinct_id,
    user_name: analyticsContext.user_name,
    user_type: analyticsContext.user_type,
  } satisfies Record<string, Primitive>;
}

function getIdentityContextPayload() {
  return {
    install_id: analyticsContext.install_id,
    distinct_id: analyticsContext.distinct_id,
    user_name: analyticsContext.user_name,
    user_type: analyticsContext.user_type,
  } satisfies Record<string, Primitive>;
}

function getAnalyticsPayload() {
  return {
    ...getPublicContextPayload(),
    ...getIdentityContextPayload(),
  };
}

function getRuntimePlatform() {
  if (typeof navigator === "undefined") return "unknown";
  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  return navigatorWithUserAgentData.userAgentData?.platform || navigator.platform || "unknown";
}

function getPublicContextPayload() {
  return {
    provider_source: analyticsContext.provider_source,
    custom_protocol: analyticsContext.custom_protocol,
    ai_enabled: analyticsContext.ai_enabled,
    selected_model_id: analyticsContext.selected_model_id,
    notebook_count_current: analyticsContext.notebook_count_current,
    has_multiple_notebooks: analyticsContext.has_multiple_notebooks,
    session_id: analyticsContext.session_id,
    app_version: analyticsContext.app_version,
    app_env: analyticsContext.app_env,
    host_env: analyticsContext.host_env,
    platform: analyticsContext.platform,
    is_dev: analyticsContext.is_dev,
  } satisfies Record<string, Primitive>;
}

function registerSuperProperties(partial?: Partial<AnalyticsContext>) {
  const basePayload = getAnalyticsPayload();
  const merged = partial ? { ...basePayload, ...normalizeEventProps(partial) } : basePayload;
  safeAnalyticsCall(() => {
    mixpanel.register(merged);
  });
}

export function getAnalyticsContext() {
  return { ...analyticsContext };
}

export function getAnalyticsInstallId() {
  return analyticsContext.install_id || getStableInstallId();
}

export function getAnalyticsSessionId() {
  return analyticsContext.session_id;
}

export function isAnalyticsInitialized() {
  return analyticsInitialized;
}

export function initAnalytics(options: AnalyticsInitOptions) {
  if (!options.token) return null;

  const installId = getStableInstallId();
  const sessionId = createSessionId();
  const hostEnv = options.hostEnv ?? DEFAULT_HOST_ENV;
  const platform = options.platform ?? getRuntimePlatform();
  const identityProfile = getUToolsDistinctProfile(installId);

  analyticsContext.install_id = installId;
  analyticsContext.distinct_id = identityProfile.distinctId;
  analyticsContext.user_name = identityProfile.userName;
  analyticsContext.user_type = identityProfile.userType;
  analyticsContext.session_id = sessionId;
  analyticsContext.app_version = options.appVersion;
  analyticsContext.app_env = options.appEnv;
  analyticsContext.host_env = hostEnv;
  analyticsContext.platform = platform;
  analyticsContext.is_dev = options.isDev;

  const shouldReinit = !analyticsInitialized || currentToken !== options.token;
  if (shouldReinit) {
    safeAnalyticsCall(() => {
      mixpanel.init(options.token, {
        persistence: "localStorage",
        debug: options.isDev,
        autocapture: false,
        track_pageview: false,
        record_sessions_percent: options.enableReplay === false ? 0 : REPLAY_SAMPLE_RATE,
        record_mask_all_text: false,
        record_mask_all_inputs: false,
      });
    });
    currentToken = options.token;
    analyticsInitialized = true;
  }

  safeAnalyticsCall(() => {
    mixpanel.identify(getIdentifyId());
  });

  registerSuperProperties();

  if (options.enableReplay !== false) {
    safeAnalyticsCall(() => {
      mixpanel.start_session_recording();
    });
  }

  return {
    installId,
    sessionId,
    distinctId: getCurrentDistinctId(),
  };
}

export function syncAnalyticsContext(partial: Partial<AnalyticsContext>) {
  Object.assign(analyticsContext, partial);
  registerSuperProperties(partial);
}

export function resetAnalytics() {
  safeAnalyticsCall(() => {
    mixpanel.reset();
  });
  removeDbStorageItem(ANALYTICS_INSTALL_ID_KEY);
  analyticsInitialized = false;
  currentToken = "";
  analyticsContext.install_id = "";
  analyticsContext.distinct_id = "";
  analyticsContext.user_name = "";
  analyticsContext.user_type = "";
  analyticsContext.session_id = "";
}

export function getAIAnalyticsContext(ai: AISettingsLike) {
  const providerSource = getAIProviderMode(ai);
  return {
    provider_source: providerSource,
    custom_protocol: providerSource === "custom" ? ai.customProtocol : "none",
    ai_enabled: ai.enabled,
    selected_model_id: ai.selectedModelId ?? "",
  } satisfies Pick<
    AnalyticsContext,
    "provider_source" | "custom_protocol" | "ai_enabled" | "selected_model_id"
  >;
}

export function getNotebookAnalyticsContext(notebooks: Record<string, Notebook>) {
  const notebookCountCurrent = Object.keys(notebooks).length;
  return {
    notebook_count_current: notebookCountCurrent,
    has_multiple_notebooks: notebookCountCurrent > 1,
  } satisfies Pick<
    AnalyticsContext,
    "notebook_count_current" | "has_multiple_notebooks"
  >;
}

export function syncAIAnalyticsContext(ai: AISettingsLike) {
  syncAnalyticsContext(getAIAnalyticsContext(ai));
}

export function syncNotebookAnalyticsContext(notebooks: Record<string, Notebook>) {
  syncAnalyticsContext(getNotebookAnalyticsContext(notebooks));
}

export function trackEvent(name: string, props: EventProps = {}) {
  if (!analyticsInitialized) return;

  const payload = {
    ...getAnalyticsPayload(),
    ...getMixpanelReplayProps(),
    distinct_id: getCurrentDistinctId(),
    ...normalizeEventProps(props),
  };

  safeAnalyticsCall(() => {
    mixpanel.track(name, payload);
  });
}

export function getAIErrorType(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("auth") || message.includes("api key") || message.includes("鉴权")) {
      return "auth";
    }
    if (message.includes("timeout") || message.includes("network") || message.includes("fetch")) {
      return "network";
    }
    if (message.includes("model") || message.includes("模型")) {
      return "model";
    }
  }

  return "unknown";
}
