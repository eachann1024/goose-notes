import * as GooseIcons from "@/components/ui/icons";
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
import {
  imageBlockWithoutGeneratedCaption,
  normalizeParsedImageProps,
} from "./imageCaption";

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
        icon={<GooseIcons.Image size={22} strokeWidth={1.75} />}
      />
    );
  }

  const displayBlock = imageBlockWithoutGeneratedCaption(block);

  return (
    <ResizableFileBlockWrapper block={displayBlock} editor={editor}>
      <ImagePreview block={displayBlock} editor={editor} />
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
    toExternalHTML: (props) => (
      <ImageToExternalHTML
        {...props}
        block={imageBlockWithoutGeneratedCaption(props.block)}
      />
    ),
    runsBefore: ["file"],
  },
)();
