import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Cloud,
  Command,
  FileInput,
  FolderOpen,
  History,
  Keyboard,
  LayoutPanelLeft,
  Palette,
  Paperclip,
  Search,
  ShieldCheck,
  Sparkles,
  Terminal,
  WandSparkles,
  Zap,
} from "lucide-react";

export type FeatureGroup =
  | "记录"
  | "查找"
  | "创作"
  | "AI"
  | "本地"
  | "数据"
  | "个性化";

export type GuideFeature = {
  title: string;
  summary: string;
  detail: string;
  icon: LucideIcon;
  impact: "重点" | "效率" | "进阶";
};

export type GuideChapter = {
  id: string;
  number: string;
  group: FeatureGroup;
  navTitle: string;
  title: string;
  lead: string;
  accent: "purple" | "yellow" | "mint" | "coral";
  features: GuideFeature[];
};

export const guideChapters: GuideChapter[] = [
  {
    id: "workspace",
    number: "01",
    group: "记录",
    navTitle: "工作方式",
    title: "界面可以很轻，能力一直都在",
    lead: "按当下任务选择工作方式：专注写一页、并行处理多页，或用小窗快速收集。",
    accent: "purple",
    features: [
      {
        title: "极简工作区",
        summary: "隐藏标签管理，只保留当前笔记。",
        detail: "适合专注书写；需要同时保留多个上下文时再恢复完整工作区，不会创建另一套数据。",
        icon: LayoutPanelLeft,
        impact: "重点",
      },
      {
        title: "多标签编辑",
        summary: "在同一窗口保留多个上下文。",
        detail: "常用页面可保持打开，减少在目录树中反复来回定位。",
        icon: Command,
        impact: "效率",
      },
      {
        title: "5 槽速记小窗",
        summary: "五个可命名草稿槽位，各自持久化。",
        detail: "临时想法、待办和摘录可以分槽保存；小窗与常规笔记本是清晰隔离的工作入口。",
        icon: Zap,
        impact: "重点",
      },
    ],
  },
  {
    id: "search",
    number: "02",
    group: "查找",
    navTitle: "全局搜索",
    title: "先找到那一页，再进入页内定位",
    lead: "全局搜索同时匹配标题和正文，并保留最近访问；页内查找则只处理当前文档。",
    accent: "yellow",
    features: [
      {
        title: "标题与正文检索",
        summary: "一个关键词同时查标题和页面内容。",
        detail: "结果会显示命中片段；高亮标题与正文中的关键词，帮助从大量文档中快速识别目标。",
        icon: Search,
        impact: "重点",
      },
      {
        title: "最近访问",
        summary: "未输入关键词时，先回到刚才的工作。",
        detail: "最近页面可以单独移除，也能在设置中关闭整个分区。",
        icon: History,
        impact: "效率",
      },
      {
        title: "页内查找",
        summary: "在已打开的长文中逐个跳转命中项。",
        detail: "它与全局搜索职责不同：前者找当前页中的位置，后者从整个笔记本找文档。",
        icon: FileInput,
        impact: "进阶",
      },
    ],
  },
  {
    id: "create",
    number: "03",
    group: "创作",
    navTitle: "输入与附件",
    title: "素材进来以后，少做一次整理",
    lead: "命令、粘贴与拖入共同服务编辑：文字保持可编辑，文件保留明确去向。",
    accent: "mint",
    features: [
      {
        title: "“/”与“、”命令菜单",
        summary: "中英文输入状态下都能唤出内容块。",
        detail: "无需离开键盘即可插入标题、列表、代码、媒体等支持的块类型。",
        icon: Command,
        impact: "重点",
      },
      {
        title: "智能粘贴",
        summary: "识别 Markdown、代码围栏与常见富文本。",
        detail: "尽量保留结构并转换为可继续编辑的内容，而不是只留下失去语义的纯文本。",
        icon: WandSparkles,
        impact: "效率",
      },
      {
        title: "附件与拖入",
        summary: "添加附件，或直接拖入 Markdown 与文件夹。",
        detail: "拖入 Markdown 可进入笔记；拖入文件夹可作为本地文件夹工作区打开。",
        icon: Paperclip,
        impact: "重点",
      },
    ],
  },
  {
    id: "ai",
    number: "04",
    group: "AI",
    navTitle: "AI 协作",
    title: "模型可替换，工作边界由你决定",
    lead: "AI 面板保留多协议接入、本地规则、技能与引用；多步任务在执行前展示计划。",
    accent: "coral",
    features: [
      {
        title: "三种模型协议",
        summary: "OpenAI Responses、兼容 Chat Completions、Anthropic。",
        detail: "可按服务商与模型能力配置，不把 AI 多步能力绑定在单一接口协议上。",
        icon: Bot,
        impact: "重点",
      },
      {
        title: "本地规则与技能",
        summary: "读取 ~/AGENTS.md 与 ~/.agents/skills。",
        detail: "用本地说明约束协作方式，用技能沉淀可复用流程；内容由用户自己管理。",
        icon: Sparkles,
        impact: "进阶",
      },
      {
        title: "@ 引用与计划审批",
        summary: "明确上下文，批量写入或删除笔记前确认计划。",
        detail: "引用相关页面或资料；批量写入或删除笔记时，可在变更计划审批卡片中查看并决定是否继续。",
        icon: ShieldCheck,
        impact: "重点",
      },
    ],
  },
  {
    id: "local",
    number: "05",
    group: "本地",
    navTitle: "本地文件",
    title: "笔记也可以就是你的文件夹",
    lead: "直接管理本地 Markdown 结构，并与习惯的编辑器、终端和附件目录协作。",
    accent: "purple",
    features: [
      {
        title: "本地文件夹工作区",
        summary: "目录与 Markdown 文件保持在本地磁盘。",
        detail: "适合已有知识库或需要与其他工具共同编辑的场景。",
        icon: FolderOpen,
        impact: "重点",
      },
      {
        title: "外部编辑器与终端",
        summary: "从当前文件或目录进入熟悉的工具。",
        detail: "设置外部编辑器后可快捷打开；终端入口帮助继续处理 Git、脚本等本地工作。",
        icon: Terminal,
        impact: "效率",
      },
      {
        title: "目录显示规则",
        summary: "将指定目录从侧栏隐藏，并集中管理 assets。",
        detail: "不希望参与浏览的目录可按名称从侧栏隐藏；图片和附件可以落入工作区的 assets 目录，便于随库迁移。",
        icon: Paperclip,
        impact: "进阶",
      },
    ],
  },
  {
    id: "data",
    number: "06",
    group: "数据",
    navTitle: "历史与迁移",
    title: "写作会变化，恢复和迁移都留有余地",
    lead: "自动历史、手动里程碑、远程备份和常见格式导入导出，分别解决不同的数据风险。",
    accent: "mint",
    features: [
      {
        title: "自动历史与里程碑",
        summary: "停笔或心跳自动保存，也可手动标记关键版本。",
        detail: "历史记录用于回看和恢复；里程碑适合保留定稿前、重大调整前等有意义的节点。",
        icon: History,
        impact: "重点",
      },
      {
        title: "WebDAV",
        summary: "配置远程备份与恢复，并设置保留周期。",
        detail: "它是可选的远程备份与恢复通道；是否启用、服务器地址和凭据均由用户设置。",
        icon: Cloud,
        impact: "进阶",
      },
      {
        title: "导入与导出",
        summary: "支持 ZIP、Markdown、HTML 等迁移路径。",
        detail: "按入口选择整库或单篇处理；实际可用格式以对应导入、导出菜单展示为准。",
        icon: FileInput,
        impact: "重点",
      },
    ],
  },
  {
    id: "personalize",
    number: "07",
    group: "个性化",
    navTitle: "外观与快捷",
    title: "常用的留下，不常用的安静退后",
    lead: "外观、布局、快捷键和 uTools 动作都能按工作习惯调整，默认界面依然保持克制。",
    accent: "yellow",
    features: [
      {
        title: "阅读与代码外观",
        summary: "主题、字体、表格布局与代码主题。",
        detail: "正文与代码可分别选择更合适的显示方式，表格也能按可用宽度整齐排布。",
        icon: Palette,
        impact: "效率",
      },
      {
        title: "快捷键",
        summary: "为高频动作查看或调整键盘入口。",
        detail: "设置页集中管理快捷方式，降低频繁打开菜单的成本。",
        icon: Keyboard,
        impact: "重点",
      },
      {
        title: "搜索引擎与 uTools 动作",
        summary: "右键搜索可配置，常用动作可从 uTools 直接触发。",
        detail: "搜索服务支持整理与排序；uTools 快捷动作则用于更快进入创建、搜索等支持的流程。",
        icon: Search,
        impact: "进阶",
      },
    ],
  },
];

export const featureGroups: Array<"全部" | FeatureGroup> = [
  "全部",
  "记录",
  "查找",
  "创作",
  "AI",
  "本地",
  "数据",
  "个性化",
];
