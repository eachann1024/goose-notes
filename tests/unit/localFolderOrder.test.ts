import { expect, test } from "playwright/test";
import type { Page } from "../../src/types";
import {
  LOCAL_FOLDER_ROOT_DIR_KEY,
  appendLocalFolderOrderEntries,
  applyLocalFolderReorder,
  clearLocalFolderOrder,
  ensureLocalFolderOrdersLoaded,
  getLocalFolderOrders,
  insertLocalFolderOrder,
  reassignLocalFolderOrder,
  setLocalFolderOrder,
  sortLocalFolderChildren,
  useLocalFolderOrders,
} from "../../src/stores/localFolderOrder";

const ROOT = LOCAL_FOLDER_ROOT_DIR_KEY;
const STORAGE_KEY = "gn:local-order:nb";

// 排序模块只用 window.localStorage 持久化，测试里给一个可控的内存实现
let failWrites = false;
const fakeStorage = new Map<string, string>();
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: (key: string) => fakeStorage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (failWrites) throw new Error("quota exceeded");
      fakeStorage.set(key, value);
    },
    removeItem: (key: string) => void fakeStorage.delete(key),
  },
};

test.beforeEach(() => {
  failWrites = false;
  fakeStorage.clear();
  useLocalFolderOrders.setState({ ordersByNotebook: {} });
});

function page(id: string, overrides: Partial<Page> = {}): Page {
  return {
    id,
    workspaceId: "nb",
    content: { type: "doc", content: [] },
    isLocked: false,
    fontSize: "default",
    fontFamily: "default",
    localFilePath: `/notes/${id}.md`,
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

const ids = (list: Page[], manualOrder?: string[]): string[] =>
  sortLocalFolderChildren(list, manualOrder).map((item) => item.id);
const rootOrder = (notebookId = "nb"): string[] | undefined =>
  getLocalFolderOrders(notebookId)[ROOT];

test("目录内首次有效拖动后切手动顺序，落回原位不算", () => {
  const list = [page("a"), page("b"), page("c")];

  // c 落到最前（rct 的 childIndex 基于含被拖项的列表）
  expect(
    applyLocalFolderReorder("nb", ROOT, list, ["c"], 0),
  ).toBe(true);
  expect(getLocalFolderOrders("nb")).toEqual({ [ROOT]: ["c", "a", "b"] });

  // 在已有手动顺序的目录里把 b 拖回末尾原位：顺序不变，也不重复落盘
  expect(applyLocalFolderReorder("nb", ROOT, list, ["b"], 3)).toBe(false);
  expect(getLocalFolderOrders("nb")).toEqual({ [ROOT]: ["c", "a", "b"] });
});

test("手动顺序下新增条目追加末尾：后新增的 a 不会插到先新增的 z 前，重命名也不移动", () => {
  // 目录已有手动顺序，b 在手动表内
  setLocalFolderOrder("nb", ROOT, ["b"]);
  const b = page("b");

  // 新建 / 扫描发现 z，再发现 a：都追加到末尾（不是按名称排到中间）
  appendLocalFolderOrderEntries("nb", [page("z")]);
  appendLocalFolderOrderEntries("nb", [page("a")]);
  expect(rootOrder()).toEqual(["b", "z", "a"]);

  const z = page("z");
  const a = page("a");
  expect(ids([b, z, a], rootOrder())).toEqual(["b", "z", "a"]);

  // 重命名走 idmap，pageId 不变：即使新名字排序更靠前位置也不动
  const renamedZ = page("z", { localFilePath: "/notes/0-aaa.md" });
  expect(ids([b, renamedZ, a], rootOrder())).toEqual(["b", "z", "a"]);

  // 草稿（未落盘）与待创建占位不进顺序；非手动顺序的目录不追加
  appendLocalFolderOrderEntries("nb", [
    page("draft", { localUnsaved: true }),
    page("pending", { localPendingCreate: "file" }),
    page("in-plain-dir", { parentId: "plain" }),
  ]);
  expect(rootOrder()).toEqual(["b", "z", "a"]);
  expect(getLocalFolderOrders("nb").plain).toBeUndefined();

  // 重复调用同一个新条目不会写两次
  appendLocalFolderOrderEntries("nb", [a]);
  expect(rootOrder()).toEqual(["b", "z", "a"]);
});

test("移出清源目录旧槽位、移入追加目标末尾，目录自身移动保留孩子顺序", () => {
  setLocalFolderOrder("nb", ROOT, ["x", "y", "dir"]);
  setLocalFolderOrder("nb", "dir", ["child-b", "child-a"]);

  // dir 从根移出：根的槽位清掉；dir 孩子的手动顺序以 dir 的 pageId 为键，不受影响
  reassignLocalFolderOrder("nb", "dir", undefined, "other");
  expect(rootOrder()).toEqual(["x", "y"]);
  expect(getLocalFolderOrders("nb").dir).toEqual(["child-b", "child-a"]);

  // 再移回根：追加到末尾，不回到旧槽位
  reassignLocalFolderOrder("nb", "dir", "other", undefined);
  expect(rootOrder()).toEqual(["x", "y", "dir"]);

  // 目标目录处于手动顺序时才追加；目标非手动目录不动
  reassignLocalFolderOrder("nb", "z", undefined, "dir");
  expect(getLocalFolderOrders("nb").dir).toEqual(["child-b", "child-a", "z"]);
  reassignLocalFolderOrder("nb", "w", undefined, "plain");
  expect(getLocalFolderOrders("nb").plain).toBeUndefined();

  // 同目录（移动失败 / 无变化的分支）不动顺序
  const before = JSON.stringify(getLocalFolderOrders("nb"));
  reassignLocalFolderOrder("nb", "x", undefined, undefined);
  expect(JSON.stringify(getLocalFolderOrders("nb"))).toBe(before);
});

test("跨目录移动后按落点插入：顶部落根级第一、末位仍在末尾、写盘失败不改顺序", () => {
  // 根已有手动顺序，empty 在子目录 sub 里（截图场景：empty 拖到根级顶部落点）
  setLocalFolderOrder("nb", ROOT, ["a", "b"]);
  setLocalFolderOrder("nb", "sub", ["empty"]);
  const rootChildren = [page("a"), page("b"), page("empty")];

  // 移动成功后移动动作先清源目录槽位、把 empty 追加到根手动序末尾
  reassignLocalFolderOrder("nb", "empty", "sub", undefined);
  expect(getLocalFolderOrders("nb").sub).toEqual([]);
  expect(rootOrder()).toEqual(["a", "b", "empty"]);

  // edge 顶部目标 childIndex = 0：empty 应落根级第一，而不是停在末尾
  expect(insertLocalFolderOrder("nb", ROOT, rootChildren, ["empty"], 0)).toBe(
    true,
  );
  expect(rootOrder()).toEqual(["empty", "a", "b"]);
  expect(ids(rootChildren, rootOrder())).toEqual(["empty", "a", "b"]);

  // 在同一个顶部落点再落一次：顺序不变，不重复落盘
  expect(insertLocalFolderOrder("nb", ROOT, rootChildren, ["empty"], 0)).toBe(
    false,
  );
  expect(rootOrder()).toEqual(["empty", "a", "b"]);

  // edge 底部目标 childIndex = 根子项数：回到末尾，不往前插
  expect(
    insertLocalFolderOrder("nb", ROOT, rootChildren, ["empty"], rootChildren.length),
  ).toBe(true);
  expect(ids(rootChildren, rootOrder())).toEqual(["a", "b", "empty"]);

  // 写盘失败：不谎报成功、内存顺序不变（磁盘上的移动不强回滚）
  failWrites = true;
  expect(insertLocalFolderOrder("nb", ROOT, rootChildren, ["empty"], 0)).toBe(
    false,
  );
  expect(rootOrder()).toEqual(["a", "b", "empty"]);
  failWrites = false;

  // 目标目录还没手动顺序时，顶部落点仍能建立顺序并把移入项放第一
  clearLocalFolderOrder("nb", ROOT);
  expect(insertLocalFolderOrder("nb", ROOT, rootChildren, ["empty"], 0)).toBe(
    true,
  );
  expect(ids(rootChildren, rootOrder())).toEqual(["empty", "a", "b"]);
});

test("加载时消毒损坏的持久化数据（null / 数组 / 非字符串 / 重复 id / 坏 JSON）", () => {
  const cases: Array<[string, string, Record<string, string[]>]> = [
    ["null", "null", {}],
    ["数组", '["a","b"]', {}],
    ["坏 JSON", "{oops", {}],
    ["值不是数组", '{"root":"a"}', {}],
    ["非字符串项", '{"root":["a",2,null,"","b"]}', { root: ["a", "b"] }],
    ["重复 id", '{"root":["a","a","b"]}', { root: ["a", "b"] }],
  ];

  for (const [label, raw, expected] of cases) {
    fakeStorage.set(STORAGE_KEY, raw);
    useLocalFolderOrders.setState({ ordersByNotebook: {} });
    ensureLocalFolderOrdersLoaded("nb");
    expect(getLocalFolderOrders("nb"), label).toEqual(expected);
    // 消毒后的顺序仍然可用：手动表内按表排，表外排末尾
    const manual = getLocalFolderOrders("nb")[ROOT];
    expect(ids([page("a"), page("b")], manual), label).toEqual(
      manual ? manual : ["a", "b"],
    );
  }
});

test("写盘失败时不改内存顺序、不抛异常，恢复名称排序也不谎报成功", () => {
  setLocalFolderOrder("nb", ROOT, ["b", "a"]);
  expect(rootOrder()).toEqual(["b", "a"]);

  failWrites = true;
  expect(setLocalFolderOrder("nb", ROOT, ["a", "b"])).toBe(false);
  expect(rootOrder()).toEqual(["b", "a"]);
  expect(clearLocalFolderOrder("nb", ROOT)).toBe(false);
  expect(rootOrder()).toEqual(["b", "a"]);
  // 拖动落点：写盘失败 → 返回 false（调用方不做后续移动），顺序保持
  expect(
    applyLocalFolderReorder("nb", ROOT, [page("a"), page("b")], ["a"], 0),
  ).toBe(false);
  expect(rootOrder()).toEqual(["b", "a"]);
  // 扫描/新增追加失败也不改变内存
  expect(() => appendLocalFolderOrderEntries("nb", [page("z")])).not.toThrow();
  expect(rootOrder()).toEqual(["b", "a"]);

  // 恢复可写后正常工作
  failWrites = false;
  expect(clearLocalFolderOrder("nb", ROOT)).toBe(true);
  expect(rootOrder()).toBeUndefined();
});

test("恢复名称排序只清当前目录，其他目录和记事本不受影响", () => {
  setLocalFolderOrder("nb", "dir", ["y", "x"]);
  setLocalFolderOrder("nb", ROOT, ["b", "a"]);
  setLocalFolderOrder("nb2", "dir", ["y", "x"]);

  expect(clearLocalFolderOrder("nb", "dir")).toBe(true);
  expect(getLocalFolderOrders("nb")).toEqual({ [ROOT]: ["b", "a"] });
  expect(getLocalFolderOrders("nb2")).toEqual({ dir: ["y", "x"] });

  // 该目录恢复名称排序（文件夹优先，再看名称）；根目录仍按手动顺序，
  // 不在手动表内的文件夹排末尾
  const list = [page("b"), page("a"), page("dir", { isFolder: true })];
  expect(ids(list, undefined)).toEqual(["dir", "a", "b"]);
  expect(ids(list, rootOrder())).toEqual(["b", "a", "dir"]);
});

test("手动顺序落盘，重启（内存清空后 ensure 读回）仍在", () => {
  setLocalFolderOrder("nb", ROOT, ["c", "a", "b"]);
  const list = [page("a"), page("b"), page("c")];

  useLocalFolderOrders.setState({ ordersByNotebook: {} });
  // 未加载前先按名称排序，加载完订阅方会重渲染成手动顺序
  expect(ids(list, rootOrder())).toEqual(["a", "b", "c"]);

  ensureLocalFolderOrdersLoaded("nb");
  expect(getLocalFolderOrders("nb")).toEqual({ [ROOT]: ["c", "a", "b"] });
  expect(ids(list, rootOrder())).toEqual(["c", "a", "b"]);
});
