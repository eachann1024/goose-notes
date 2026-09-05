import { expect, test } from "playwright/test";
import { migrateSettingsPersistedState } from "../../src/stores/settings/migrations";
import {
  DEFAULT_WEBDAV_REMOTE_DIR,
  WEBDAV_INITIAL_STATE,
} from "../../src/stores/settings/slices/webdavSlice";

test("新建 WebDAV 配置写入 goose-note-app 目录", () => {
  expect(DEFAULT_WEBDAV_REMOTE_DIR).toBe("goose-note-app");
  expect(WEBDAV_INITIAL_STATE.webdavRemoteDir).toBe(
    DEFAULT_WEBDAV_REMOTE_DIR,
  );
});

test("已保存的旧 WebDAV 目录保持不变以读取历史备份", () => {
  const migrated = migrateSettingsPersistedState({
    webdavRemoteDir: "goose-notes",
  });

  expect(migrated.webdavRemoteDir).toBe("goose-notes");
});
