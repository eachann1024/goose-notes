import { expect, test } from "playwright/test";
import { APPEARANCE_INITIAL_STATE } from "../../src/stores/settings/slices/appearanceSlice";
import { migrateSettingsPersistedState } from "../../src/stores/settings/migrations";

test("全新用户默认开启极简工作区", () => {
  expect(APPEARANCE_INITIAL_STATE.singleTabMode).toBe(true);
});

test("已有用户也会被迁到极简工作区", () => {
  expect(migrateSettingsPersistedState({ theme: "dark" })).toMatchObject({
    theme: "dark",
    singleTabMode: true,
    randomIconOnCreate: true,
  });
  expect(
    migrateSettingsPersistedState({ singleTabMode: false }).singleTabMode,
  ).toBe(true);
});

test("迁移时丢弃已废弃的全宽和表格两端对齐设置", () => {
  const migrated = migrateSettingsPersistedState({
    globalEditorFullWidth: false,
    tableEvenColumnWidth: false,
  });
  expect(migrated).not.toHaveProperty("globalEditorFullWidth");
  expect(migrated).not.toHaveProperty("tableEvenColumnWidth");
});

test("旧默认全局搜索 Mod+Shift+K 迁到 Mod+K", () => {
  const migrated = migrateSettingsPersistedState({
    appShortcuts: { openSearch: "Mod+Shift+K", toggleAIPanel: "Mod+J" },
    desktop: { searchHotkey: "CmdOrCtrl+Shift+K" },
  });
  expect(migrated.appShortcuts).toMatchObject({
    openSearch: "Mod+K",
    toggleAIPanel: "Mod+J",
  });
  expect(migrated.desktop).toMatchObject({
    searchHotkey: "CmdOrCtrl+K",
  });
});

test("用户自定义的 Shift+K 搜索快捷键不会被迁移覆盖", () => {
  const migrated = migrateSettingsPersistedState({
    appShortcuts: { openSearch: "Alt+K" },
    desktop: { searchHotkey: "CmdOrCtrl+Alt+K" },
  });
  expect(migrated.appShortcuts).toMatchObject({ openSearch: "Alt+K" });
  expect(migrated.desktop).toMatchObject({
    searchHotkey: "CmdOrCtrl+Alt+K",
  });
});
