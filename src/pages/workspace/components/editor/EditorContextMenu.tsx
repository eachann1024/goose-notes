import type { Editor } from "@tiptap/react";

interface EditorContextMenuProps {
  editor: Editor;
  searchProviders: {
    id: string;
    name: string;
    urlTemplate: string;
    isEnabled: boolean;
  }[];
  openSearchInUtools: boolean;
  children: React.ReactNode;
}

export function EditorContextMenu({
  editor,
  searchProviders,
  openSearchInUtools,
  children,
}: EditorContextMenuProps) {
  const isEditable = editor?.isEditable;
  const [selectedText, setSelectedText] = useState("");

  useEffect(() => {
    if (!editor) {
      setSelectedText("");
      return;
    }

    const updateSelectedText = () => {
      const { state } = editor;
      if (!state || state.selection.empty) {
        setSelectedText("");
        return;
      }
      const { from, to } = state.selection;
      const text = state.doc.textBetween(from, to, " ").trim();
      setSelectedText(text);
    };

    updateSelectedText();
    editor.on("selectionUpdate", updateSelectedText);
    return () => {
      editor.off("selectionUpdate", updateSelectedText);
    };
  }, [editor]);

  const activeProviders = useMemo(
    () => searchProviders.filter((p) => p.isEnabled),
    [searchProviders],
  );
  const hasSearchText = selectedText.length > 0;
  const previewText =
    selectedText.length > 20 ? `${selectedText.slice(0, 20)}...` : selectedText;

  return (
    <ContextMenu>
      <ContextMenuTrigger>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-[160px]">
        {editor && hasSearchText && activeProviders.length > 0 && (
          <>
            <ContextMenuItem disabled className="text-xs text-muted-foreground">
              {previewText}
            </ContextMenuItem>
            <ContextMenuSeparator />
            {activeProviders.map((provider) => (
              <ContextMenuItem
                key={provider.id}
                onSelect={() => {
                  const url = provider.urlTemplate.replace(
                    "%s",
                    encodeURIComponent(selectedText),
                  );
                  UToolsAdapter.openUrl(url, openSearchInUtools);
                }}
              >
                <LucideIcons.Search className="mr-2 h-4 w-4" />用{" "}
                {provider.name} 搜索
              </ContextMenuItem>
            ))}
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem
          disabled={!isEditable}
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
          disabled={!isEditable}
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
