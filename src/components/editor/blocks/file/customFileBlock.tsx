import { useCallback, useState } from "react";
import { createFileBlockConfig, fileParse } from "@blocknote/core";
import { createReactBlockSpec, useUploadLoading } from "@blocknote/react";
import { FilePanelExtension } from "@blocknote/core/extensions";

function CustomFileBlockContent({
  block,
  editor,
}: {
  block: any;
  editor: any;
}) {
  const showLoader = useUploadLoading(block.id);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState("");

  const handleAddFile = useCallback(() => {
    if (!editor.isEditable) return;
    const filePanel = editor.getExtension(FilePanelExtension);
    filePanel?.showMenu(block.id);
  }, [editor, block.id]);

  const handleDownload = useCallback(() => {
    const url = block.props.url;
    const name = block.props.name || "download";
    if (!url) return;

    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [block.props.url, block.props.name]);

  const handleDelete = useCallback(() => {
    editor.removeBlocks([block]);
  }, [editor, block]);

  const handleRenameStart = useCallback(() => {
    setDraftName(block.props.name || "");
    setRenaming(true);
  }, [block.props.name]);

  const handleRenameCommit = useCallback(() => {
    const trimmed = draftName.trim();
    if (trimmed) {
      editor.updateBlock(block, { props: { name: trimmed } });
    }
    setRenaming(false);
  }, [editor, block, draftName]);

  const handleRenameCancel = useCallback(() => {
    setRenaming(false);
  }, []);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        handleRenameCommit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleRenameCancel();
      }
    },
    [handleRenameCommit, handleRenameCancel]
  );

  if (showLoader) {
    return (
      <div className="bn-file-loading-preview">Loading...</div>
    );
  }

  if (!block.props.url) {
    return (
      <div className="bn-add-file-button" onClick={handleAddFile}>
        <div className="bn-add-file-button-icon">
          <LucideIcons.FileUp size={24} />
        </div>
        <div className="bn-add-file-button-text">添加文件</div>
      </div>
    );
  }

  return (
    <div className="goose-file-block-content">
      <div className="goose-file-block-info">
        <button
          type="button"
          className="goose-file-block-icon-btn"
          onClick={handleAddFile}
          title="更换文件"
        >
          <LucideIcons.FileText size={20} strokeWidth={1.75} />
        </button>
        {renaming ? (
          <input
            className="goose-file-block-name-input"
            value={draftName}
            autoFocus
            onFocus={(e) => e.target.select()}
            onChange={(e) => setDraftName(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={handleRenameCommit}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="goose-file-block-name">{block.props.name}</span>
        )}
      </div>
      <div className="goose-file-block-actions">
        <button
          type="button"
          className="goose-file-block-action-btn"
          onClick={handleRenameStart}
          title="重命名"
        >
          <LucideIcons.Pencil size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="goose-file-block-action-btn"
          onClick={handleDownload}
          title="下载"
        >
          <LucideIcons.Download size={16} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="goose-file-block-action-btn"
          onClick={handleDelete}
          title="删除"
        >
          <LucideIcons.Trash2 size={16} strokeWidth={1.75} />
        </button>
      </div>
    </div>
  );
}

export const customFileBlock = createReactBlockSpec(createFileBlockConfig(), {
  meta: {
    fileBlockAccept: ["*/*"],
  },
  render: (props) => <CustomFileBlockContent block={props.block} editor={props.editor} />,
  parse: fileParse(),
  toExternalHTML: ({ block }) => {
    if (!block.props.url) {
      return <p>添加文件</p>;
    }

    const link = (
      <a href={block.props.url}>{block.props.name || block.props.url}</a>
    );

    if (block.props.caption) {
      return (
        <div>
          {link}
          <p>{block.props.caption}</p>
        </div>
      );
    }

    return link;
  },
})();
