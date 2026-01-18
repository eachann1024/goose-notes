import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { uToolsStorage } from "@/lib/storage";

interface OnboardingStep {
  id: string;
  target: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: "sidebar",
    target: '[data-onboarding="sidebar-tree"]',
    title: "📂 页面管理",
    description: "这里管理你的所有笔记，点击顶部的 + 号可以新建页面。",
    position: "right",
  },
  {
    id: "context-menu",
    target: '[data-onboarding="page-item"]',
    title: "🖱️ 右键操作",
    description: "右键点击页面，可以快速进行收藏、重命名、复制或删除操作。",
    position: "right",
  },
  {
    id: "editor",
    target: '[data-onboarding="editor"]',
    title: "✍️ 沉浸写作",
    description: "点击这里开始写作。内容会实时保存，无需担心数据丢失。",
    position: "bottom",
  },
  {
    id: "slash-command",
    target: '[data-onboarding="editor-content"]',
    title: "⚡ 斜杠命令",
    description:
      "输入 '/' 即可唤起功能菜单，插入标题、列表、公式、图表等各种区块。",
    position: "top",
  },
  {
    id: "drag-handle",
    target: '[data-onboarding="drag-handle"]',
    title: "↕️ 拖拽排序",
    description: "每一段左侧都有手柄，按住并拖拽可以自由调整段落顺序。",
    position: "right",
  },
  {
    id: "tips",
    target: '[data-onboarding="footer-tips"]',
    title: "🌟 发现技巧",
    description: "这里会随机展示进阶技巧，帮助你更好地使用鹅的笔记。",
    position: "top",
  },
];

interface OnboardingGuideState {
  isActive: boolean;
  currentStepIndex: number;
  completed: boolean;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
  complete: () => void;
}

export const useOnboardingGuide = create<OnboardingGuideState>()(
  persist(
    (set, get) => ({
      isActive: false,
      currentStepIndex: 0,
      completed: false,

      start: () => {
        if (!get().completed) {
          set({ isActive: true, currentStepIndex: 0 });
        }
      },

      next: () => {
        const { currentStepIndex } = get();
        if (currentStepIndex < ONBOARDING_STEPS.length - 1) {
          set({ currentStepIndex: currentStepIndex + 1 });
        } else {
          get().complete();
        }
      },

      prev: () => {
        const { currentStepIndex } = get();
        if (currentStepIndex > 0) {
          set({ currentStepIndex: currentStepIndex - 1 });
        }
      },

      skip: () => {
        set({ isActive: false, completed: true });
      },

      complete: () => {
        set({ isActive: false, completed: true });
      },
    }),
    {
      name: "goose-note-onboarding-guide",
      storage: createJSONStorage(() => uToolsStorage),
    },
  ),
);
