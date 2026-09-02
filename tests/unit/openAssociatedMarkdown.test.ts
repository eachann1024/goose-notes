import { expect, test } from "playwright/test";
import {
  findContainingLocalFolderNotebook,
  openAssociatedMarkdownFile,
} from "../../src/lib/openAssociatedMarkdown";
import { useNotebooks, type Notebook } from "../../src/stores/useNotebooks";
import { usePages } from "../../src/stores/usePages";
import { useTabs } from "../../src/stores/useTabs";
import type { Page } from "../../src/types";

const vault: Notebook = {
  id: "vault-notes",
  name: "notes",
  source: "local-folder",
  localPath: "/notes",
  createdAt: 1,
  updatedAt: 1,
};

const nested: Notebook = {
  id: "vault-project",
  name: "project",
  source: "local-folder",
  localPath: "/notes/project",
  createdAt: 2,
  updatedAt: 2,
};

const page: Page = {
  id: "page-readme",
  workspaceId: "vault-project",
  content: [{ type: "paragraph", content: "hi" }],
  isLocked: false,
  fontSize: "default",
  fontFamily: "default",
  createdAt: 1,
  updatedAt: 1,
  localFilePath: "/notes/project/readme.md",
};

test.beforeEach(() => {
  useNotebooks.setState({
    notebooks: {
      [vault.id]: vault,
      [nested.id]: nested,
    },
    activeNotebookId: vault.id,
    setActiveNotebook: (id: string) => {
      useNotebooks.setState({ activeNotebookId: id });
    },
  });
  usePages.setState({
    pages: { [page.id]: page },
    activePageId: null,
    hydrated: true,
    loadLocalFolderPages: async () => undefined,
  });
  useTabs.setState({
    openTabs: [],
    activeTabId: null,
    tabHistory: [],
    tabHistoryIndex: -1,
  });
});

test("picks the longest matching local-folder vault for a file", () => {
  const found = findContainingLocalFolderNotebook("/notes/project/readme.md", [
    vault,
    nested,
  ]);
  expect(found?.id).toBe("vault-project");
});

test("opens a markdown file already inside a mounted vault", async () => {
  const opened = await openAssociatedMarkdownFile("/notes/project/readme.md");
  expect(opened).toBe(true);
  expect(useNotebooks.getState().activeNotebookId).toBe("vault-project");
  expect(usePages.getState().activePageId).toBe("page-readme");
  expect(useTabs.getState().openTabs[0]?.pageId).toBe("page-readme");
});

test("mounts the parent folder when the file is outside existing vaults", async () => {
  useNotebooks.setState({
    notebooks: {},
    activeNotebookId: null,
    setActiveNotebook: (id: string) => {
      useNotebooks.setState({ activeNotebookId: id });
    },
  });
  usePages.setState({
    pages: {},
    loadLocalFolderPages: async (notebookId, basePath) => {
      usePages.setState({
        pages: {
          "page-outside": {
            ...page,
            id: "page-outside",
            workspaceId: notebookId,
            localFilePath: `${basePath}/solo.md`,
          },
        },
      });
    },
  });

  const opened = await openAssociatedMarkdownFile("/tmp/docs/solo.md");
  expect(opened).toBe(true);
  const notebooks = Object.values(useNotebooks.getState().notebooks);
  expect(notebooks).toHaveLength(1);
  expect(notebooks[0]?.localPath).toBe("/tmp/docs");
  expect(usePages.getState().activePageId).toBe("page-outside");
});
