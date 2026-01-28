
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export const HeadingCollapse = Extension.create({
  name: "headingCollapse",

  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          collapsed: {
            default: false,
            parseHTML: (element) =>
              element.hasAttribute("data-collapsed")
                ? element.getAttribute("data-collapsed") === "true"
                : false,
            renderHTML: (attributes) => {
              if (attributes.collapsed) {
                return { "data-collapsed": "true" };
              }
              return {};
            },
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("headingCollapse"),
        props: {
          decorations: (state) => {
            const { doc, selection } = state;
            const decorations: Decoration[] = [];
            let collapsedLevel: number | null = null;
            let hasFirstHeading = false;

            // 找到光标所在的顶级节点位置
            const $from = selection.$from;
            const cursorBlockStart = $from.start(1); // depth=1 是顶级块

            doc.forEach((node, offset) => {
              if (node.type.name === "heading") {
                const isCursorHere = offset === cursorBlockStart - 1;
                const isFirstHeading = !hasFirstHeading;
                if (!hasFirstHeading) hasFirstHeading = true;

                decorations.push(
                  Decoration.node(offset, offset + node.nodeSize, {
                    class: "heading-collapse-anchor",
                  }),
                );

                if (!isFirstHeading) {
                  const indicator = document.createElement("span");
                  indicator.className = "heading-collapse-indicator";
                  indicator.setAttribute("data-heading-pos", String(offset));
                  indicator.setAttribute("contenteditable", "false");
                  if (node.attrs.collapsed) {
                    indicator.classList.add("is-collapsed");
                  }
                  if (isCursorHere) {
                    indicator.classList.add("is-active");
                  }
                  indicator.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6"/></svg>`;
                  decorations.push(
                    Decoration.widget(offset + 1, indicator, {
                      side: -1,
                      key: `heading-${offset}-${node.attrs.collapsed}`,
                    }),
                  );
                }

                // Check if we need to end the current collapse
                if (
                  collapsedLevel !== null &&
                  node.attrs.level <= collapsedLevel
                ) {
                  collapsedLevel = null;
                }

                // Check if we need to start a new collapse
                if (node.attrs.collapsed) {
                  if (collapsedLevel === null) {
                    collapsedLevel = node.attrs.level;
                  }
                }
              }

              if (collapsedLevel !== null) {
                // Use a standard logic: if we are deeper than the collapsed level, we hide.
                // But since we are iterating flat nodes (in Tiptap schema's view of blocks),
                // we technically hide everything until the next heading of same or higher rank.

                // However, we must NOT hide the heading that initiated the collapse.
                // Since we iterate sequentially:
                // 1. Found H1 (collapsed=true). collapsedLevel=1.
                //    We are at H1. Should we hide it? No.
                // 2. Found P. collapsedLevel=1. Hide.

                // So we need to ensure we don't hide the *current* node if it's the one that switched on the collapse?
                // Actually, if node.attrs.collapsed is true and node.level == collapsedLevel, it IS the header.
                // But what if we have H1 (collapsed) ... H2 (collapsed)?
                // At H2: level(2) > collapsedLevel(1). It doesn't reset.
                // It is hidden by H1.
                // So correctly, H2 is hidden.

                // Logic check:
                // H1(collapsed) -> collapsedLevel=1. isTheCollapsingNode needs verification.
                // At this step, `node` is H1.
                // `if (node.level <= collapsedLevel)` -> 1 <= 1. It resets?
                // Wait, my logic:
                // `if (collapsedLevel !== null && node.attrs.level <= collapsedLevel)`
                // If I am at H1 (collapsed), I encounter H1.
                // If previously collapsedLevel was null:
                //   First check: node.level <= null (false).
                //   Second check: node.collapsed -> collapsedLevel = 1.
                //   Then render check:
                //     isTheCollapsingHeading = (1 === 1 && true). Yes.
                //     Don't hide.
                // Next P:
                //   First check: ...
                //   Rendering: collapsedLevel=1. P is not heading. Hide.
                // Next H1:
                //   First check: level(1) <= collapsedLevel(1). collapsedLevel = null.
                //   Second check: node.collapsed? Say no.
                //   Rendering: collapsedLevel is null. Don't hide.

                // What if H1(collapsed) followed by H1?
                // H1(c):
                //   collapsedLevel = 1.
                //   Not hidden.
                // H1:
                //   1 <= 1 -> collapsedLevel = null.
                //   Not hidden.

                // Looks correct.

                const isTheCollapsingHeading =
                  node.type.name === "heading" &&
                  node.attrs.level === collapsedLevel &&
                  node.attrs.collapsed;

                if (!isTheCollapsingHeading) {
                  decorations.push(
                    Decoration.node(offset, offset + node.nodeSize, {
                      class: "is-folded",
                    }),
                  );
                }
              }
            });

            return DecorationSet.create(doc, decorations);
          },
          handleClick: (view, _pos, event) => {
            const target = event.target as HTMLElement | null;
            const indicator = target?.closest?.(
              ".heading-collapse-indicator",
            ) as HTMLElement | null;
            if (!indicator) return false;

            const pos = Number(indicator.dataset.headingPos);
            if (Number.isNaN(pos)) return false;
            const node = view.state.doc.nodeAt(pos);
            if (!node || node.type.name !== "heading") return false;

            const tr = view.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              collapsed: !node.attrs.collapsed,
            });
            view.dispatch(tr);
            return true;
          },
        },
      }),
    ];
  },
});
