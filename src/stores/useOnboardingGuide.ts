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
    title: "页面管理",
    description: "无限层级的页面结构，拖动修改页面顺序与层级，点击图标为页面设置图标，点击加号新增子页面。",
    position: "right",
  },
  {
    id: "local-folder",
    target: '[data-onboarding="open-local-folder"]',
    title: "打开本地文件夹",
    description: "选择本地 Markdown 文件夹后，可直接管理并编辑本地笔记。",
    position: "right",
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
  restart: () => void;
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

      restart: () => {
        set({ isActive: true, currentStepIndex: 0 });
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
