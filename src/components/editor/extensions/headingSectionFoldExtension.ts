import { createExtension } from "@blocknote/core";
import type { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  isCollapsedProp,
  updateFoldSnapshots,
  type SectionFoldBlock,
} from "@/components/editor/core/headingSectionFold";

export const SECTION_HIDDEN_ATTR = "data-goose-section-hidden";
export const HEADING_COLLAPSED_ATTR = "data-goose-heading-collapsed";
const SECTION_HIDDEN_CLASS = "goose-section-hidden";


function isCollapsedHeadingContent(
  content: Node | null | undefined,
  container?: Node,
): boolean {
  if (content?.type.name !== "heading") return false;
  return (
    isCollapsedProp(content.attrs.collapsed) ||
    isCollapsedProp(container?.attrs.collapsed)
  );
}

/** PM doc → SectionFoldBlock 树（blockGroup > blockContainer 结构拍平成块树）。 */
function sectionTreeFromDoc(doc: Node): SectionFoldBlock[] {
  const fromGroup = (group: Node): SectionFoldBlock[] => {
    const blocks: SectionFoldBlock[] = [];
    group.forEach((child) => {
      if (child.type.name !== "blockContainer") return;
      const content = child.firstChild;
      let children: SectionFoldBlock[] | undefined;
      child.forEach((grand) => {
        if (grand.type.name === "blockGroup") {
          children = fromGroup(grand);
        }
      });
      blocks.push({
        id: String(child.attrs.id ?? ""),
        type: content?.type.name ?? "",
        props: content ? { ...content.attrs } : {},
        children,
      });
    });
    return blocks;
  };
  return doc.firstChild ? fromGroup(doc.firstChild) : [];
}

function firstContainerId(doc: Node): string | undefined {
  let id: string | undefined;
  doc.descendants((node) => {
    if (id !== undefined) return false;
    if (node.type.name === "blockContainer") {
      id = String(node.attrs.id ?? "");
      return false;
    }
    return true;
  });
  return id;
}

type FoldSnapshots = Map<string, string[]>;

/**
 * 收集 decorations：
 * - 隐藏区间 = snapshot 里仍存在的 sibling blockContainer + 标题残留 children；
 * - 折叠中的 heading 自身 blockContainer 打 data-goose-heading-collapsed。
 */
export function collectSectionFoldDecorations(
  doc: Node,
  snapshots: FoldSnapshots,
): DecorationSet {
  const decorations: Decoration[] = [];

  const walkGroup = (group: Node, groupPos: number, isRoot: boolean) => {
    if (group.type.name !== "blockGroup") return;

    const containers: Array<{ node: Node; pos: number }> = [];
    let offset = groupPos + 1;
    for (let index = 0; index < group.childCount; index += 1) {
      const child = group.child(index);
      if (child.type.name === "blockContainer") {
        containers.push({ node: child, pos: offset });
      }
      offset += child.nodeSize;
    }

    const firstBlockId = isRoot
      ? String(containers[0]?.node.attrs.id ?? "")
      : "";

    for (let index = 0; index < containers.length; index += 1) {
      const container = containers[index];
      const content = container.node.firstChild;
      const containerId = String(container.node.attrs.id ?? "");
      const collapsed =
        isCollapsedHeadingContent(content, container.node) &&
        containerId !== firstBlockId;

      if (collapsed) {
        decorations.push(
          Decoration.node(container.pos, container.pos + container.node.nodeSize, {
            [HEADING_COLLAPSED_ATTR]: "true",
          }),
        );

        // 标题残留 children（旧 isToggleable 数据）属于标题自身，折叠时一直藏。
        let innerOffset = 1;
        container.node.forEach((grand) => {
          if (grand.type.name === "blockGroup") {
            const nestedPos = container.pos + innerOffset;
            let childPos = nestedPos + 1;
            for (let childIndex = 0; childIndex < grand.childCount; childIndex += 1) {
              const nestedChild = grand.child(childIndex);
              if (nestedChild.type.name === "blockContainer") {
                decorations.push(
                  Decoration.node(childPos, childPos + nestedChild.nodeSize, {
                    [SECTION_HIDDEN_ATTR]: "true",
                    class: SECTION_HIDDEN_CLASS,
                  }),
                );
              }
              childPos += nestedChild.nodeSize;
            }
          }
          innerOffset += grand.nodeSize;
        });

        const snapshot = snapshots.get(containerId);
        if (snapshot?.length) {
          const hiddenIds = new Set(snapshot);
          for (let next = index + 1; next < containers.length; next += 1) {
            const sibling = containers[next];
            if (hiddenIds.has(String(sibling.node.attrs.id ?? ""))) {
              decorations.push(
                Decoration.node(sibling.pos, sibling.pos + sibling.node.nodeSize, {
                  [SECTION_HIDDEN_ATTR]: "true",
                  class: SECTION_HIDDEN_CLASS,
                }),
              );
            }
          }
        }
      }

      let innerOffset = 1;
      container.node.forEach((grand) => {
        if (grand.type.name === "blockGroup") {
          walkGroup(grand, container.pos + innerOffset, false);
        }
        innerOffset += grand.nodeSize;
      });
    }
  };

  if (doc.firstChild) {
    walkGroup(doc.firstChild, 0, true);
  }
  return DecorationSet.create(doc, decorations);
}

const headingSectionFoldPluginKey = new PluginKey<FoldSnapshots>(
  "goose-heading-section-fold",
);

const headingSectionFoldPlugin = new Plugin<FoldSnapshots>({
  key: headingSectionFoldPluginKey,
  state: {
    init(_, state) {
      return updateFoldSnapshots(
        new Map(),
        null,
        sectionTreeFromDoc(state.doc),
        firstContainerId(state.doc),
      );
    },
    apply(tr, value, oldState, newState) {
      if (!tr.docChanged) return value;
      return updateFoldSnapshots(
        value,
        sectionTreeFromDoc(oldState.doc),
        sectionTreeFromDoc(newState.doc),
        firstContainerId(newState.doc),
      );
    },
  },
  props: {
    decorations(state): DecorationSet {
      return collectSectionFoldDecorations(
        state.doc,
        headingSectionFoldPluginKey.getState(state) ?? new Map(),
      );
    },
  },
});

export const gooseHeadingSectionFoldExtension = createExtension({
  key: "goose-heading-section-fold",
  prosemirrorPlugins: [headingSectionFoldPlugin],
});
