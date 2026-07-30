import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AnimatePresence, motion, MotionConfig, useScroll, useSpring } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  Command,
  Feather,
  FileText,
  LayoutPanelLeft,
  Menu,
  PanelLeftClose,
  RotateCcw,
  Search,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import {
  featureGroups,
  guideChapters,
  type FeatureGroup,
  type GuideChapter,
  type GuideFeature,
} from "./content/featureCatalog";

const PROGRESS_KEY = "goose-guide-completed-v1";
const VALID_CHAPTER_IDS = new Set(guideChapters.map((chapter) => chapter.id));

type WorkMode = "focus" | "workspace" | "quick";

const workModes: Array<{
  id: WorkMode;
  label: string;
  description: string;
  icon: typeof Feather;
}> = [
  { id: "focus", label: "极简", description: "当前只做一件事", icon: PanelLeftClose },
  { id: "workspace", label: "完整", description: "目录、多标签与 AI 都在手边", icon: LayoutPanelLeft },
  { id: "quick", label: "速记", description: "5 个草稿槽，随叫随到", icon: Zap },
];

const searchDocuments = [
  {
    title: "大版本发布检查清单",
    body: "完成全局搜索高亮、数据备份检查与新用户教程。",
    path: "项目 / 鹅的笔记",
  },
  {
    title: "用户反馈：如何更快找到文档",
    body: "搜索结果需要同时展示标题与正文片段，并标出命中的关键词。",
    path: "收件箱 / 反馈",
  },
  {
    title: "本地文件夹迁移记录",
    body: "把 Markdown 文档和 assets 一起迁移，完成后检查链接。",
    path: "知识库 / 维护",
  },
];

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightText({ text, query }: { text: string; query: string }) {
  const normalized = query.trim();
  if (!normalized) return text;
  const parts = text.split(new RegExp(`(${escapeRegExp(normalized)})`, "gi"));
  return parts.map((part, index) =>
    part.toLocaleLowerCase().includes(normalized.toLocaleLowerCase()) ? (
      <mark key={`${part}-${index}`}>{part}</mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    ),
  );
}

function GuideImage({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`guide-image ${failed ? "is-fallback" : ""} ${className}`}>
      {!failed ? (
        <img
          src={src}
          alt={alt}
          draggable={false}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="image-fallback" role="img" aria-label={alt}>
          <span className="fallback-rabbit" />
          <span className="fallback-goose" />
          <Sparkles aria-hidden="true" />
        </div>
      )}
    </div>
  );
}

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.14 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function WorkModeDemo() {
  const [mode, setMode] = useState<WorkMode>("focus");
  const selected = workModes.find((item) => item.id === mode)!;
  return (
    <div className="work-demo">
      <div className="segmented" aria-label="切换工作方式">
        {workModes.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className={mode === item.id ? "is-active" : ""}
              aria-pressed={mode === item.id}
              onClick={() => setMode(item.id)}
            >
              <Icon aria-hidden="true" />
              {item.label}
            </button>
          );
        })}
      </div>
      <div className={`workspace-stage mode-${mode}`}>
        <div className="workspace-window" aria-live="polite">
          {mode !== "quick" && (
            <aside className="mock-sidebar" aria-hidden="true">
              <span className="mock-logo"><Feather /></span>
              <i /><i /><i /><i />
            </aside>
          )}
          <div className="mock-editor">
            {mode === "workspace" && <div className="mock-tabs"><b /> <b /> <b /></div>}
            {mode === "quick" && (
              <div className="mock-slots" aria-hidden="true">
                {[1, 2, 3, 4, 5].map((slot) => <span key={slot}>{slot}</span>)}
              </div>
            )}
            <span className="mock-kicker">今天</span>
            <strong>{mode === "quick" ? "把想法先放这里" : "让记录回到内容本身"}</strong>
            <i /><i /><i />
          </div>
          {mode === "workspace" && <aside className="mock-ai" aria-hidden="true"><Sparkles /><i /><i /></aside>}
        </div>
      </div>
      <p className="demo-caption"><strong>{selected.label}工作方式：</strong>{selected.description}</p>
    </div>
  );
}

function SearchDemo() {
  const [query, setQuery] = useState("文档");
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return searchDocuments;
    return searchDocuments.filter((doc) =>
      `${doc.title} ${doc.body}`.toLocaleLowerCase().includes(normalized),
    );
  }, [query]);

  return (
    <div className="search-demo">
      <label htmlFor="guide-search">试着搜索标题或正文</label>
      <div className="search-input-wrap">
        <Search aria-hidden="true" />
        <input
          id="guide-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="例如：文档、搜索、Markdown"
          autoComplete="off"
        />
        {query && (
          <button type="button" onClick={() => setQuery("")} aria-label="清空搜索词">
            <X aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="search-results" aria-live="polite">
        <div className="result-summary">
          <span>全局搜索</span>
          <span>{matches.length} 个结果</span>
        </div>
        {matches.length ? (
          matches.map((doc) => (
            <div className="search-result" key={doc.title}>
              <FileText aria-hidden="true" />
              <div>
                <strong><HighlightText text={doc.title} query={query} /></strong>
                <p><HighlightText text={doc.body} query={query} /></p>
                <small>{doc.path}</small>
              </div>
              <ArrowRight aria-hidden="true" />
            </div>
          ))
        ) : (
          <div className="empty-result">
            <Search aria-hidden="true" />
            <strong>没有找到匹配文档</strong>
            <span>换个更短的关键词试试</span>
          </div>
        )}
      </div>
      <p className="search-note">
        <Command aria-hidden="true" /> 全局搜索负责找文档；页内查找负责在当前文档中跳转。
      </p>
    </div>
  );
}

function FeatureCard({ feature }: { feature: GuideFeature }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = feature.icon;
  const toggleExpanded = () => setExpanded((value) => !value);
  return (
    <article
      className={`feature-card ${expanded ? "is-expanded" : ""}`}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={toggleExpanded}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggleExpanded();
      }}
    >
      <div className="feature-heading">
        <span className="feature-icon"><Icon aria-hidden="true" /></span>
        <span className={`impact impact-${feature.impact}`}>{feature.impact}</span>
      </div>
      <h3>{feature.title}</h3>
      <p>{feature.summary}</p>
      <div className="feature-expand" aria-hidden="true">
        {expanded ? "收起说明" : "查看说明"}
        <ChevronDown aria-hidden="true" />
      </div>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="feature-detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p>{feature.detail}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}

function Chapter({
  chapter,
  completed,
  onToggle,
}: {
  chapter: GuideChapter;
  completed: boolean;
  onToggle: () => void;
}) {
  const media: Record<string, { src: string; alt: string } | undefined> = {
    create: {
      src: "./guide/images/create-anything.webp",
      alt: "原创高能兔子与白鹅一起整理文字、附件和文件夹",
    },
    ai: {
      src: "./guide/images/ai-and-safety.webp",
      alt: "原创高能兔子与白鹅在计划审批面板前协作",
    },
    search: {
      src: "./guide/images/search-highlight.webp",
      alt: "原创高能兔子与白鹅从搜索结果中定位高亮关键词",
    },
  };
  const chapterMedia = media[chapter.id];
  return (
    <section className={`chapter accent-${chapter.accent}`} id={chapter.id}>
      <Reveal className="chapter-inner">
        <header className="chapter-header">
          <div>
            <span className="chapter-number">{chapter.number} · {chapter.group}</span>
            <h2>{chapter.title}</h2>
            <p>{chapter.lead}</p>
          </div>
          <button
            type="button"
            className={`complete-button ${completed ? "is-complete" : ""}`}
            onClick={onToggle}
            aria-pressed={completed}
          >
            {completed ? <CheckCircle2 aria-hidden="true" /> : <Circle aria-hidden="true" />}
            {completed ? "已学会" : "标记学会"}
          </button>
        </header>
        {chapter.id === "workspace" && <WorkModeDemo />}
        {chapter.id === "search" && <SearchDemo />}
        {chapterMedia && (
          <GuideImage src={chapterMedia.src} alt={chapterMedia.alt} className="chapter-image" />
        )}
        <div className="feature-grid">
          {chapter.features.map((feature) => <FeatureCard feature={feature} key={feature.title} />)}
        </div>
      </Reveal>
    </section>
  );
}

export function GuideApp() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 30, restDelta: 0.001 });
  const [menuOpen, setMenuOpen] = useState(false);
  const [group, setGroup] = useState<"全部" | FeatureGroup>("全部");
  const [pendingScrollId, setPendingScrollId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>(() => {
    try {
      const saved = window.localStorage.getItem(PROGRESS_KEY);
      if (!saved) return [];
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return [...new Set(parsed.filter(
        (item): item is string => typeof item === "string" && VALID_CHAPTER_IDS.has(item),
      ))];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(completed));
    } catch {
      // 隐私模式或存储额度不足时，当前会话中的进度仍可正常使用。
    }
  }, [completed]);

  useEffect(() => {
    if (!pendingScrollId || group !== "全部") return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(pendingScrollId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setPendingScrollId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [group, pendingScrollId]);

  const visibleChapters = group === "全部"
    ? guideChapters
    : guideChapters.filter((chapter) => chapter.group === group);
  const completionPercent = Math.round((completed.length / guideChapters.length) * 100);

  const scrollTo = (id: string) => {
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    } else if (VALID_CHAPTER_IDS.has(id)) {
      setPendingScrollId(id);
      setGroup("全部");
    }
    setMenuOpen(false);
  };

  const toggleComplete = (id: string) => {
    setCompleted((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  return (
    <MotionConfig reducedMotion="user">
      <motion.div className="scroll-progress" style={{ scaleX }} />
      <header className="site-header">
        <a className="brand" href="#top" aria-label="鹅的笔记功能指南首页">
          <span><Feather aria-hidden="true" /></span>
          <strong>鹅的笔记</strong>
          <em>功能指南</em>
        </a>
        <nav className={menuOpen ? "is-open" : ""} aria-label="章节导航">
          {guideChapters.map((chapter) => (
            <button type="button" key={chapter.id} onClick={() => scrollTo(chapter.id)}>
              <span>{chapter.number}</span>{chapter.navTitle}
              {completed.includes(chapter.id) && <Check aria-label="已完成" />}
            </button>
          ))}
        </nav>
        <button
          className="menu-button"
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "关闭章节导航" : "打开章节导航"}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <motion.span
              className="eyebrow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Sparkles aria-hidden="true" /> 需要时展开，不需要时安静隐藏
            </motion.span>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.06 }}
            >
              先轻松记下来，<br />再把强大慢慢调出来。
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.12 }}
            >
              这不是设置项清单。用 7 个真实场景，快速体验鹅的笔记从速记、搜索、创作到 AI 与数据保护的完整工作方式。
            </motion.p>
            <motion.div
              className="hero-actions"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.18 }}
            >
              <button type="button" className="primary-button" onClick={() => scrollTo("workspace")}>
                开始体验 <ArrowRight aria-hidden="true" />
              </button>
              <button type="button" className="secondary-button" onClick={() => scrollTo("feature-map")}>
                先看功能地图
              </button>
            </motion.div>
            <div className="hero-proof" aria-label="指南特点">
              <span><Check /> 7 个章节</span>
              <span><Check /> 可操作演示</span>
              <span><Check /> 进度自动保存</span>
            </div>
          </div>
          <motion.div
            className="hero-visual"
            initial={{ opacity: 0, scale: 0.96, rotate: 1.5 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ duration: 0.65, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <GuideImage
              src="./guide/images/hero-rabbit-goose.webp"
              alt="原创高能兔子与白鹅搭档带着笔记和星星向前冲"
              priority
            />
            <span className="visual-sticker sticker-one">快捷，但不草率</span>
            <span className="visual-sticker sticker-two">冲呀！</span>
          </motion.div>
        </section>

        <Reveal className="guide-toolbar" >
          <div className="progress-card">
            <div className="progress-copy">
              <span>你的教程进度</span>
              <strong>{completed.length} / {guideChapters.length} 章</strong>
            </div>
            <div className="progress-track" aria-label={`已完成 ${completionPercent}%`}>
              <motion.span animate={{ width: `${completionPercent}%` }} transition={{ duration: 0.25 }} />
            </div>
            <span className="progress-percent">{completionPercent}%</span>
            <button
              type="button"
              className="reset-button"
              onClick={() => setCompleted([])}
              disabled={completed.length === 0}
            >
              <RotateCcw aria-hidden="true" /> 重置
            </button>
          </div>
        </Reveal>

        <section className="feature-map" id="feature-map">
          <Reveal>
            <div className="section-heading">
              <span>功能地图</span>
              <h2>按你现在想做的事来找</h2>
              <p>筛选只改变下面展示的章节。每个功能都可以展开查看边界和用法。</p>
            </div>
            <div className="filter-row" aria-label="功能分类筛选">
              {featureGroups.map((item) => (
                <button
                  type="button"
                  key={item}
                  className={group === item ? "is-active" : ""}
                  aria-pressed={group === item}
                  onClick={() => setGroup(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </Reveal>
        </section>

        <AnimatePresence mode="popLayout">
          <motion.div
            key={group}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {visibleChapters.map((chapter) => (
              <Chapter
                chapter={chapter}
                key={chapter.id}
                completed={completed.includes(chapter.id)}
                onToggle={() => toggleComplete(chapter.id)}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        <section className="finish-section">
          <Reveal className="finish-card">
            <span className="finish-icon"><CheckCircle2 /></span>
            <div>
              <span>接下来</span>
              <h2>{completionPercent === 100 ? "你已经走完功能地图" : "不必一次学完所有功能"}</h2>
              <p>
                {completionPercent === 100
                  ? "回到笔记，从最适合当前任务的一种工作方式开始。"
                  : "先体验极简记录和全局搜索；遇到复杂任务时，再回来打开对应章节。"}
              </p>
            </div>
            <button type="button" onClick={() => scrollTo("top")}>回到顶部 <ArrowRight /></button>
          </Reveal>
        </section>
      </main>

      <footer>
        <span><Feather /> 鹅的笔记</span>
        <p>简单记录，需要时很强大。</p>
      </footer>
    </MotionConfig>
  );
}
