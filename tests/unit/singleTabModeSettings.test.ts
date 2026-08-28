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
