import { expect, test } from "playwright/test";
import {
  imageBlockWithoutGeneratedCaption,
  isGeneratedDataImageName,
  normalizeParsedImageProps,
} from "../../src/components/editor/blocks/image/imageCaption";
import { normalizePageContent } from "../../src/components/editor/utils/blocknote-content";

test("剪贴板默认文件名不论 url 类型都视为生成名", () => {
  expect(isGeneratedDataImageName("image.png", "data:image/png;base64,AA==")).toBe(
    true,
  );
  expect(isGeneratedDataImageName("image.png", "att:img-1")).toBe(true);
  expect(isGeneratedDataImageName("image.webp", "blob:https://local/1")).toBe(
    true,
  );
  expect(isGeneratedDataImageName("image (1).png", "https://cdn.example/a.png")).toBe(
    true,
  );
  expect(isGeneratedDataImageName("image-2.jpg")).toBe(true);
  expect(isGeneratedDataImageName("部署流程图", "att:img-1")).toBe(false);
  expect(isGeneratedDataImageName("team.png", "att:img-1")).toBe(false);
});

test("normalizeParsedImageProps 把默认 caption 收回 name", () => {
  expect(
    normalizeParsedImageProps({
      url: "att:img-1",
      caption: "image.png",
      previewWidth: 320,
    }),
  ).toMatchObject({
    url: "att:img-1",
    name: "image.png",
    caption: "",
    previewWidth: 320,
  });

  expect(
    normalizeParsedImageProps({
      url: "att:img-1",
      caption: "部署流程图",
      name: "流程图",
    }),
  ).toMatchObject({
    caption: "部署流程图",
    name: "流程图",
  });
});

test("imageBlockWithoutGeneratedCaption 不改无默认 caption 的原对象", () => {
  const block = {
    type: "image",
    props: { url: "att:img-1", caption: "说明", name: "图" },
  };
  expect(imageBlockWithoutGeneratedCaption(block)).toBe(block);

  const generated = {
    type: "image",
    props: { url: "att:img-1", caption: "image.png", name: "image.png" },
  };
  const hidden = imageBlockWithoutGeneratedCaption(generated);
  expect(hidden).not.toBe(generated);
  expect(hidden.props.caption).toBe("");
  expect(hidden.props.name).toBe("image.png");
  expect(generated.props.caption).toBe("image.png");
});

test("打开已有笔记时 normalize 清掉 att 图上的 image.png 说明", () => {
  const normalized = normalizePageContent([
    { type: "heading", props: { level: 1 }, content: "标题" },
    {
      type: "image",
      props: {
        url: "att:img-1",
        name: "image.png",
        caption: "image.png",
        previewWidth: 176,
      },
    },
    {
      type: "image",
      props: {
        url: "att:img-2",
        name: "流程图",
        caption: "部署流程图",
      },
    },
  ]);
  const images = normalized.filter((block) => block.type === "image");
  expect(images[0]?.props).toMatchObject({
    url: "att:img-1",
    name: "image.png",
    caption: "",
    previewWidth: 176,
  });
  expect(images[1]?.props).toMatchObject({
    caption: "部署流程图",
    name: "流程图",
  });
});
