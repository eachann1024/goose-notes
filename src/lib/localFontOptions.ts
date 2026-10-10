import { isLocalFontAvailable } from "@/lib/fontLoader";

export type LocalFontOption = { family: string; label: string };

const candidates: LocalFontOption[] = [
  { family: "PingFang SC", label: "苹方" },
  { family: "Songti SC", label: "宋体" },
  { family: "Kaiti SC", label: "楷体" },
  { family: "Heiti SC", label: "黑体" },
  { family: "Hiragino Sans GB", label: "冬青黑体" },
  { family: "Microsoft YaHei", label: "微软雅黑" },
  { family: "SimSun", label: "中易宋体" },
  { family: "SimHei", label: "中易黑体" },
  { family: "KaiTi", label: "中易楷体" },
  { family: "Noto Sans SC", label: "Noto Sans SC" },
  { family: "Noto Serif SC", label: "Noto Serif SC" },
  { family: "Source Han Sans SC", label: "思源黑体" },
  { family: "Source Han Serif SC", label: "思源宋体" },
  ...[
    "Arial",
    "Helvetica Neue",
    "Georgia",
    "Times New Roman",
    "Menlo",
    "Monaco",
    "Consolas",
    "DM Mono",
  ].map((family) => ({ family, label: family })),
];

// local() resolves face names / PostScript names, which may differ from the CSS family.
const localFaceAliases: Record<string, string[]> = {
  "PingFang SC": ["PingFang SC Regular", "PingFangSC-Regular"],
  "Songti SC": ["Songti SC Regular", "SongtiSC-Regular"],
  "Kaiti SC": ["Kaiti SC Regular", "KaitiSC-Regular"],
  "Heiti SC": ["Heiti SC Light", "STHeitiSC-Light", "STHeitiSC-Medium"],
  "Hiragino Sans GB": ["Hiragino Sans GB W3", "HiraginoSansGB-W3"],
  "Microsoft YaHei": ["Microsoft YaHei Regular", "MicrosoftYaHei"],
  "Noto Sans SC": ["Noto Sans SC Regular", "NotoSansSC-Regular"],
  "Noto Serif SC": ["Noto Serif SC Regular", "NotoSerifSC-Regular"],
  "Source Han Sans SC": [
    "Source Han Sans SC Regular",
    "SourceHanSansSC-Regular",
  ],
  "Source Han Serif SC": [
    "Source Han Serif SC Regular",
    "SourceHanSerifSC-Regular",
  ],
  "Helvetica Neue": ["HelveticaNeue", "Helvetica Neue Regular"],
  "Times New Roman": ["TimesNewRomanPSMT"],
  Menlo: ["Menlo Regular", "Menlo-Regular"],
  "DM Mono": ["DM Mono Regular", "DMMono-Regular"],
};

async function probeLocalFaces(family: string): Promise<boolean> {
  if (await isLocalFontAvailable(family)) return true;
  const names = localFaceAliases[family] ?? [
    `${family} Regular`,
    `${family.replaceAll(" ", "")}-Regular`,
  ];
  for (const name of names) {
    if (await isLocalFontAvailable(name)) return true;
  }
  return false;
}

const probes = new Map<string, Promise<boolean>>();
let availableFonts: Promise<LocalFontOption[]> | undefined;

export function probeLocalFont(family: string): Promise<boolean> {
  let probe = probes.get(family);
  if (!probe) {
    probe = probeLocalFaces(family);
    probes.set(family, probe);
  }
  return probe;
}

export function getAvailableLocalFonts(): Promise<LocalFontOption[]> {
  availableFonts ??= Promise.all(
    candidates.map(async (option) =>
      (await probeLocalFont(option.family)) ? option : null,
    ),
  ).then((options) =>
    options.filter((option): option is LocalFontOption => option !== null),
  );
  return availableFonts;
}
