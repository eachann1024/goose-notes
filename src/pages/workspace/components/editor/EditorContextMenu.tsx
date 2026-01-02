import type { Editor } from "@tiptap/react";

interface EditorContextMenuProps {
  editor: Editor;
  searchProviders: { id: string; name: string; urlTemplate: string; isEnabled: boolean }[];
  children: React.ReactNode;
}

export function EditorContextMenu({ editor, searchProviders, children }: EditorContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-[160px]">
        {editor && !editor.state.selection.empty && (
          <>
            <ContextMenuItem disabled className="text-xs text-muted-foreground">
              {(() => {
                const { from, to } = editor.state.selection;
                const text = editor.state.doc.textBetween(from, to, " ");
                return text.length > 20 ? text.slice(0, 20) + "..." : text;
              })()}
            </ContextMenuItem>
            <ContextMenuSeparator />
            {searchProviders
              .filter((p) => p.isEnabled)
              .map((provider) => (
                <ContextMenuItem
                  key={provider.id}
                  onSelect={() => {
                    const { from, to } = editor.state.selection;
                    const text = editor.state.doc.textBetween(from, to, " ");
                    const url = provider.urlTemplate.replace(
                      "%s",
                      encodeURIComponent(text),
                    );
                    window.open(url, "_blank");
                  }}
                >
                  <LucideIcons.Search className="mr-2 h-4 w-4" />用 {provider.name} 搜索
                </ContextMenuItem>
              ))}
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem
          onSelect={() => {
            const { from, to } = editor.state.selection;
            const text = editor.state.doc.textBetween(from, to, " ");
            navigator.clipboard.writeText(text);
            editor?.commands.deleteSelection();
          }}
        >
          <LucideIcons.Scissors className="mr-2 h-4 w-4" />
          剪切
          <span className="ml-auto text-xs tracking-widest text-muted-foreground">
            ⌘X
          </span>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => {
            const { from, to } = editor.state.selection;
            const text = editor.state.doc.textBetween(from, to, " ");
            navigator.clipboard.writeText(text);
          }}
        >
          <LucideIcons.Copy className="mr-2 h-4 w-4" />
          拷贝
          <span className="ml-auto text-xs tracking-widest text-muted-foreground">
            ⌘C
          </span>
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={async () => {
            try {
              const text = await navigator.clipboard.readText();
              editor?.commands.insertContent(text);
            } catch (err) {
              console.error("Failed to read clipboard contents: ", err);
            }
          }}
        >
          <LucideIcons.Clipboard className="mr-2 h-4 w-4" />
          粘贴
          <span className="ml-auto text-xs tracking-widest text-muted-foreground">
            ⌘V
          </span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
