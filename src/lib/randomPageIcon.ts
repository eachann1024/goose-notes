/**
 * 新建内部笔记时抽一个页面图标。
 * 池子来自图标选择器里适合当笔记封面的项，不含文件夹。
 */
const RANDOM_PAGE_ICONS = [
  "BookOpen",
  "Book",
  "BookMarked",
  "NotebookPen",
  "Notebook",
  "Library",
  "FileText",
  "Files",
  "ClipboardList",
  "StickyNote",
  "FileCode",
  "Newspaper",
  "CalendarDays",
  "Kanban",
  "Lightbulb",
  "Brain",
  "GraduationCap",
  "Pencil",
  "Palette",
  "Camera",
  "Music",
  "Coffee",
  "Home",
  "Sparkles",
  "Star",
  "Heart",
  "Target",
  "Flag",
  "Puzzle",
  "Compass",
  "Flower2",
  "Mountain",
  "Earth",
  "Gift",
  "Film",
  "Gamepad2",
  "Plane",
  "Bike",
] as const;

export function pickRandomPageIcon(): string {
  const index = Math.floor(Math.random() * RANDOM_PAGE_ICONS.length);
  return RANDOM_PAGE_ICONS[index] ?? RANDOM_PAGE_ICONS[0];
}

export function isRandomPageIcon(name: string): boolean {
  return (RANDOM_PAGE_ICONS as readonly string[]).includes(name);
}
