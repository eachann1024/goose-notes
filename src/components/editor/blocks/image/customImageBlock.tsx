import { createImageBlockConfig, imageParse } from "@blocknote/core";
import {
  createReactBlockSpec,
  useUploadLoading,
  ImagePreview,
  ImageToExternalHTML,
  ResizableFileBlockWrapper,
} from "@blocknote/react";
import {
  MediaLoadingPreview,
  MediaPlaceholder,
} from "@/components/editor/blocks/shared/MediaPlaceholder";
import { normalizeParsedImageProps } from "./imageCaption";

function CustomImageBlockContent({
  block,
  editor,
}: {
  block: any;
  editor: any;
}) {
  const showLoader = useUploadLoading(block.id);

  if (showLoader) {
    return <MediaLoadingPreview />;
  }

  if (!block.props.url) {
    return (
      <MediaPlaceholder
        variant="image"
        blockId={block.id}
        editor={editor}
        title="添加图片"
        hint="点击选择，或直接拖入编辑器"
        icon={<LucideIcons.Image size={22} strokeWidth={1.75} />}
      />
    );
  }

  return (
    <ResizableFileBlockWrapper block={block} editor={editor}>
      <ImagePreview block={block} editor={editor} />
    </ResizableFileBlockWrapper>
  );
}

export const customImageBlock = createReactBlockSpec(
  createImageBlockConfig({}),
  {
    meta: {
      fileBlockAccept: ["image/*"],
    },
    render: (props) => (
      <CustomImageBlockContent block={props.block} editor={props.editor} />
    ),
    parse: (element) => {
      const parsed = imageParse()(element);
      return parsed ? normalizeParsedImageProps(parsed) : undefined;
    },
    toExternalHTML: ImageToExternalHTML,
    runsBefore: ["file"],
  },
)();
