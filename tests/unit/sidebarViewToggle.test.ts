import { expect, test } from "playwright/test";
import {
  flushSidebarViewPersist,
  toggleSidebarFolder,
  useSidebarView,
} from "../../src/stores/useSidebarView";

const NOTEBOOK_ID = "local-vault";
const FOLDER_A = "folder-a";
const FOLDER_B = "folder-b";

test.beforeEach(() => {
  useSidebarView.setState({
    expandedByNotebook: {},
    focusedByNotebook: {},
    selectedByNotebook: {},
  });
  flushSidebarViewPersist();
});

test("连点 toggle 每次都读最新状态，不会连续两次展开", () => {
  const { toggle } = useSidebarView.getState();
  toggle(NOTEBOOK_ID, FOLDER_A);
  toggle(NOTEBOOK_ID, FOLDER_A);
  toggle(NOTEBOOK_ID, FOLDER_A);
  expect(useSidebarView.getState().expandedByNotebook[NOTEBOOK_ID]).toEqual([
    FOLDER_A,
  ]);
  toggle(NOTEBOOK_ID, FOLDER_A);
  expect(useSidebarView.getState().expandedByNotebook[NOTEBOOK_ID]).toEqual([]);
});

test("toggleSidebarFolder 在同一事件里连点也能开合", () => {
  toggleSidebarFolder(NOTEBOOK_ID, FOLDER_A);
  toggleSidebarFolder(NOTEBOOK_ID, FOLDER_A);
  expect(useSidebarView.getState().expandedByNotebook[NOTEBOOK_ID]).toEqual([]);
  toggleSidebarFolder(NOTEBOOK_ID, FOLDER_A);
  toggleSidebarFolder(NOTEBOOK_ID, FOLDER_B);
  expect(useSidebarView.getState().expandedByNotebook[NOTEBOOK_ID]).toEqual([
    FOLDER_A,
    FOLDER_B,
  ]);
});

test("expand / collapse 仍按显式方向工作", () => {
  const { expand, collapse } = useSidebarView.getState();
  expand(NOTEBOOK_ID, FOLDER_A);
  expand(NOTEBOOK_ID, FOLDER_A);
  expect(useSidebarView.getState().expandedByNotebook[NOTEBOOK_ID]).toEqual([
    FOLDER_A,
  ]);
  collapse(NOTEBOOK_ID, FOLDER_A);
  collapse(NOTEBOOK_ID, FOLDER_A);
  expect(useSidebarView.getState().expandedByNotebook[NOTEBOOK_ID]).toEqual([]);
});

test("展开态写入 localStorage 会合并连点，不阻塞翻转", () => {
  const writes: string[] = [];
  const previous = (globalThis as { localStorage?: Storage }).localStorage;
  const memory = new Map<string, string>();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, value);
      writes.push(value);
    },
    removeItem: (key) => {
      memory.delete(key);
    },
    clear: () => memory.clear(),
    key: () => null,
    length: 0,
  } as Storage;

  try {
    const { toggle } = useSidebarView.getState();
    toggle(NOTEBOOK_ID, FOLDER_A);
    toggle(NOTEBOOK_ID, FOLDER_A);
    toggle(NOTEBOOK_ID, FOLDER_A);
    expect(useSidebarView.getState().expandedByNotebook[NOTEBOOK_ID]).toEqual([
      FOLDER_A,
    ]);
    expect(writes).toEqual([]);
    flushSidebarViewPersist();
    expect(writes.length).toBe(1);
    expect(writes[0]).toContain(FOLDER_A);
  } finally {
    (globalThis as { localStorage?: Storage }).localStorage = previous;
  }
});
