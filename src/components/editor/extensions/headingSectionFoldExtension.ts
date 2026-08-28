import { createExtension } from "@blocknote/core";
import type { Node } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { isCollapsedProp } from "@/components/editor/core/headingSectionFold";

export const SECTION_HIDDEN_ATTR = "data-goose-section-hidden";
const SECTION_HIDDEN_CLASS = "goose-section-hidden";

function headingLevelFromContent(content: Node | null | undefined): number {
  if (content?.type.name !== "heading") return 0;
  const level = content.attrs.level;
  if (typeof level === "number" && level > 0) return level;
  const parsed = Number(level);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

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

/** 收集应收起的 blockContainer 区间：后续同级兄弟 + 标题残留 children。 */
export function collectHiddenBlockContainerRanges(
  doc: Node,
): Array<{ from: number; to: number }> {
  const ranges: Array<{ from: number; to: number }> = [];

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
      const collapsed =
        isCollapsedHeadingContent(content, container.node) &&
        String(container.node.attrs.id ?? "") !== firstBlockId;
      const level = headingLevelFromContent(content);

      if (collapsed) {
        let innerOffset = 1;
        container.node.forEach((grand) => {
          if (grand.type.name === "blockGroup") {
            const nestedPos = container.pos + innerOffset;
            let childPos = nestedPos + 1;
            for (let childIndex = 0; childIndex < grand.childCount; childIndex += 1) {
              const nestedChild = grand.child(childIndex);
              if (nestedChild.type.name === "blockContainer") {
                ranges.push({
                  from: childPos,
                  to: childPos + nestedChild.nodeSize,
                });
              }
              childPos += nestedChild.nodeSize;
            }
          }
          innerOffset += grand.nodeSize;
        });

        for (let next = index + 1; next < containers.length; next += 1) {
          const sibling = containers[next];
          const siblingLevel = headingLevelFromContent(sibling.node.firstChild);
          if (siblingLevel > 0 && siblingLevel <= level) break;
          ranges.push({
            from: sibling.pos,
            to: sibling.pos + sibling.node.nodeSize,
          });
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
  return ranges;
}

function buildSectionFoldDecorations(doc: Node): DecorationSet {
  const decorations = collectHiddenBlockContainerRanges(doc).map((range) =>
    Decoration.node(range.from, range.to, {
      [SECTION_HIDDEN_ATTR]: "true",
      class: SECTION_HIDDEN_CLASS,
    }),
  );
  return DecorationSet.create(doc, decorations);
}

const headingSectionFoldPlugin = new Plugin({
  key: new PluginKey("goose-heading-section-fold"),
  props: {
    decorations(state) {
      return buildSectionFoldDecorations(state.doc);
    },
  },
});

export const gooseHeadingSectionFoldExtension = createExtension({
  key: "goose-heading-section-fold",
  prosemirrorPlugins: [headingSectionFoldPlugin],
});
