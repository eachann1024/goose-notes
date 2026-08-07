/**
 * 鹅笔记 AI 动效预设
 *
 * - thinking-orbs：九种状态球，用于思考 / 工具进度 / 行内 AI
 * - border-beam：流式生成时输入 dock 的边界光束
 *
 * 设计原则：克制、贴 indigo 产品色，不彩虹轰炸；尊重 prefers-reduced-motion。
 * 短任务/状态连跳时做最短展示与粘滞，避免淡入未完就消失。
 * 文档：https://orbs.jakubantalik.com · https://beam.jakubantalik.com
 */
import {
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import { BorderBeam } from "border-beam";
import {
  ThinkingOrb,
  type OrbState,
  type ThinkingOrbProps,
} from "thinking-orbs";
import { cn } from "@/lib/utils";

// ─── timing ───────────────────────────────────────────────────

/**
 * BorderBeam 库内置 fade-in ≈ 0.6s；streaming 一圈默认 2.75s。
 * 约一圈可见即可：再拉长会在 onFinish 落盘/重渲染时更容易被感知为「输入框卡顿」。
 */
export const BEAM_MIN_ACTIVE_MS = 2200;
/** orb 状态连跳时至少稳住一帧动画语义，避免闪烁。 */
export const ORB_PHASE_HOLD_MS = 600;
/** 进度/忙碌指示从 true→false 的最短可见时间，避免「还没看清就没了」。 */
export const ORB_VISIBLE_MIN_MS = 1400;
/**
 * 发送后、首 token/工具进度出现前：thinking 占位最短展示。
 * 短回复也先让思考球/光束跑够一拍，再切正文。
 */
export const THINKING_PLACEHOLDER_MIN_MS = 1600;

// ─── reduced motion ───────────────────────────────────────────

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  return reduced;
}

/**
 * 真值立即生效；假值要等到「自上次变真起至少 minMs」才落下。
 * 用于流式很短时 beam 不至于刚淡入就淡出，或进度 orb 闪一下就消失。
 */
export function useMinHoldActive(active: boolean, minMs: number): boolean {
  const [held, setHeld] = useState(active);
  const activatedAtRef = useRef<number | null>(active ? Date.now() : null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (active) {
      activatedAtRef.current = Date.now();
      setHeld(true);
      return;
    }

    // 从未亮起过，直接保持灭
    if (activatedAtRef.current == null) {
      setHeld(false);
      return;
    }

    const elapsed = Date.now() - activatedAtRef.current;
    const remain = minMs - elapsed;
    if (remain <= 0) {
      setHeld(false);
      activatedAtRef.current = null;
      return;
    }

    timerRef.current = setTimeout(() => {
      setHeld(false);
      activatedAtRef.current = null;
      timerRef.current = null;
    }, remain);

    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [active, minMs]);

  return held;
}

/**
 * 值变化后至少 sticky minMs；期间忽略中间态，到期再跳到最新目标。
 * 用于工具进度 label 连跳时 orb 不狂切动画。
 */
function useStickyValue<T>(value: T, minMs: number): T {
  const [sticky, setSticky] = useState(value);
  const stickyRef = useRef(value);
  const changedAtRef = useRef(Date.now());
  const pendingRef = useRef(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pendingRef.current = value;
    if (Object.is(value, stickyRef.current)) return;

    const elapsed = Date.now() - changedAtRef.current;
    const remain = minMs - elapsed;

    const commit = (next: T) => {
      stickyRef.current = next;
      changedAtRef.current = Date.now();
      setSticky(next);
    };

    if (remain <= 0) {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      commit(value);
      return;
    }

    if (timerRef.current != null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      commit(pendingRef.current);
    }, remain);

    return () => {
      if (timerRef.current != null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [value, minMs]);

  return sticky;
}

// ─── Thinking Orb ─────────────────────────────────────────────

/** 业务阶段 → orb 状态（语义对齐动画语义，而非字面翻译） */
export type GooseAiOrbPhase =
  | "thinking" // 连模型 / 等首 token
  | "writing" // 写正文
  | "searching" // 搜笔记 / 联网
  | "reading" // 读页 / 读网页
  | "planning" // 解谜式整理 / 批量计划
  | "loading" // 加载 skill 等能力
  | "listening" // 等用户输入 / 审批
  | "working"; // 通用工具执行

const PHASE_TO_ORB: Record<GooseAiOrbPhase, OrbState> = {
  thinking: "connecting",
  writing: "composing",
  searching: "searching",
  reading: "listening",
  planning: "solving",
  loading: "weaving",
  listening: "breathing",
  working: "working",
};

/** 按文案关键词推断阶段（工具进度摘要等） */
export function inferOrbPhaseFromLabel(label: string): GooseAiOrbPhase {
  if (/搜索|联网|查找|检索/.test(label)) return "searching";
  if (/读取|查看|打开|网页/.test(label)) return "reading";
  if (/写入|创建|修改|追加|替换|重命名|删除|生成|展示/.test(label))
    return "writing";
  if (/计划|批量|审批|整理/.test(label)) return "planning";
  if (/加载|能力|skill/i.test(label)) return "loading";
  if (/等待|审批|确认/.test(label)) return "listening";
  return "working";
}

export function resolveGooseOrbState(phase: GooseAiOrbPhase): OrbState {
  return PHASE_TO_ORB[phase];
}

export type GooseThinkingOrbProps = Omit<
  ThinkingOrbProps,
  "state" | "size" | "speed" | "theme"
> & {
  phase?: GooseAiOrbPhase;
  /** 直接指定 orb 状态时覆盖 phase */
  state?: OrbState;
  /**
   * inline = 20px 进度行 / 工具条
   * avatar = 64px 空态或大状态
   */
  scale?: "inline" | "avatar";
  /**
   * calm 略慢（连接等待），snappy 略快（写入），default 预设原速
   */
  tempo?: "calm" | "default" | "snappy";
  theme?: ThinkingOrbProps["theme"];
};

const TEMPO_SPEED: Record<NonNullable<GooseThinkingOrbProps["tempo"]>, number> =
  {
    calm: 0.88,
    default: 1,
    snappy: 1.18,
  };

/**
 * 产品化 ThinkingOrb：固定尺寸预设 + 阶段映射 + 节奏。
 * 库本身已处理 reduced-motion / 离屏暂停 / 主题探测。
 */
export function GooseThinkingOrb({
  phase = "working",
  state,
  scale = "inline",
  tempo = "default",
  theme = "auto",
  className,
  ...rest
}: GooseThinkingOrbProps) {
  // 外部 phase 连跳时粘滞，避免工具文案 50ms 一切导致动画闪烁
  const heldPhase = useStickyValue(phase, ORB_PHASE_HOLD_MS);
  const orbState = state ?? resolveGooseOrbState(heldPhase);
  const size = scale === "avatar" ? 64 : 20;
  // 连接/呼吸偏慢，写作/编织略快（按粘滞后的阶段算节奏）
  const phaseTempo: GooseThinkingOrbProps["tempo"] =
    tempo !== "default"
      ? tempo
      : heldPhase === "thinking" || heldPhase === "listening"
        ? "calm"
        : heldPhase === "writing" || heldPhase === "loading"
          ? "snappy"
          : "default";

  return (
    <ThinkingOrb
      state={orbState}
      size={size}
      theme={theme}
      speed={TEMPO_SPEED[phaseTempo]}
      className={cn("shrink-0", className)}
      {...rest}
    />
  );
}

// ─── Border Beam ──────────────────────────────────────────────

export type GooseBeamPreset = "streaming" | "soft-pulse" | "focus-line";

type BorderBeamProps = ComponentPropsWithoutRef<typeof BorderBeam>;

/** 与鹅笔记 indigo 气质对齐的 beam 预设（避免默认彩虹） */
export const GOOSE_BEAM_PRESETS: Record<
  GooseBeamPreset,
  Pick<
    BorderBeamProps,
    | "size"
    | "colorVariant"
    | "theme"
    | "strength"
    | "duration"
    | "brightness"
    | "saturation"
    | "hueRange"
    | "staticColors"
  >
> = {
  /**
   * 流式生成：输入 dock 环绕光束
   * ocean 贴 primary indigo，强度压低，偏慢一圈更稳
   */
  streaming: {
    size: "md",
    colorVariant: "ocean",
    theme: "auto",
    strength: 0.52,
    duration: 2.75,
    brightness: 1.12,
    saturation: 0.95,
    hueRange: 18,
    staticColors: false,
  },
  /**
   * 轻脉冲：等待审批 / 长任务但非 token 流
   */
  "soft-pulse": {
    size: "pulse-inner",
    colorVariant: "mono",
    theme: "auto",
    strength: 0.38,
    duration: 2.5,
    brightness: 1.05,
    saturation: 0.85,
    hueRange: 0,
    staticColors: true,
  },
  /**
   * 底边扫描线：窄条输入 / 搜索类（备用）
   */
  "focus-line": {
    size: "line",
    colorVariant: "ocean",
    theme: "auto",
    strength: 0.6,
    duration: 3.1,
    brightness: 1.15,
    saturation: 1,
    hueRange: 20,
    staticColors: false,
  },
};

export interface GooseAiBorderBeamProps
  extends Omit<BorderBeamProps, "size" | "colorVariant" | "children"> {
  children: ReactNode;
  /** 产品预设；显式 props 可覆盖 */
  preset?: GooseBeamPreset;
  /** 是否播放；false 时平滑淡出。reduced-motion 时强制静止 */
  active?: boolean;
  size?: BorderBeamProps["size"];
  colorVariant?: BorderBeamProps["colorVariant"];
}

/**
 * 产品化 BorderBeam。
 * - 默认 streaming 预设
 * - active 真值立即开；假值最短保持 BEAM_MIN_ACTIVE_MS，避免短回复只闪一下
 * - reduced-motion 时不播
 */
export function GooseAiBorderBeam({
  children,
  preset = "streaming",
  active = true,
  className,
  borderRadius,
  size,
  colorVariant,
  strength,
  duration,
  brightness,
  saturation,
  hueRange,
  staticColors,
  theme,
  ...rest
}: GooseAiBorderBeamProps) {
  const reduced = usePrefersReducedMotion();
  const heldActive = useMinHoldActive(active, BEAM_MIN_ACTIVE_MS);
  const base = GOOSE_BEAM_PRESETS[preset];
  const playing = heldActive && !reduced;

  return (
    <BorderBeam
      {...base}
      size={size ?? base.size}
      colorVariant={colorVariant ?? base.colorVariant}
      theme={theme ?? base.theme}
      strength={strength ?? base.strength}
      duration={duration ?? base.duration}
      brightness={brightness ?? base.brightness}
      saturation={saturation ?? base.saturation}
      hueRange={hueRange ?? base.hueRange}
      staticColors={staticColors ?? base.staticColors}
      active={playing}
      borderRadius={borderRadius}
      // contain 减轻上层消息列表大重绘时把 beam 动画一起带崩的概率
      className={cn("w-full min-w-0 [contain:layout]", className)}
      {...rest}
    >
      {children}
    </BorderBeam>
  );
}
