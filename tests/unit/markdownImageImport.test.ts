import { expect, test } from "playwright/test";
import { markdownToJsonContent } from "../../src/lib/export/markdown/parse/block";
import { renderBlock } from "../../src/lib/imageExport/serializer/renderer";
import { getCardTheme } from "../../src/lib/imageExport/themes";
import { jsonContentToMarkdown } from "../../src/lib/export/markdown/serialize";
import { normalizeParsedImageProps } from "../../src/components/editor/blocks/image/imageCaption";

test("base64 图片的剪贴板默认名只保留为 alt，不成为可见说明", async ({ page }) => {
  const [image] = markdownToJsonContent(
    "![image-1.webp](data:image/webp;base64,AA==){width=320 align=center}",
  );
  expect(image).toMatchObject({
    type: "image",
    props: {
      url: "data:image/webp;base64,AA==",
      name: "image-1.webp",
      previewWidth: 320,
      textAlignment: "center",
    },
  });
  expect(image.props.caption).toBeUndefined();

  await page.setContent(renderBlock(image, getCardTheme("github-light")));
  await expect(page.locator("figcaption")).toHaveCount(0);
  await expect(page.locator("img")).toHaveAttribute("alt", "image-1.webp");
  await expect(page.locator("img")).toHaveAttribute(
    "style",
    /max-width:320px/,
  );
});

test("base64 图片的明确说明保留为 caption 和 alt", async ({ page }) => {
  const [image] = markdownToJsonContent(
    "![部署流程图](data:image/png;base64,AA==){width=480}",
  );
  expect(image.props).toMatchObject({
    name: "部署流程图",
    caption: "部署流程图",
    previewWidth: 480,
  });

  await page.setContent(renderBlock(image, getCardTheme("github-light")));
  await expect(page.locator("figcaption")).toHaveText("部署流程图");
  await expect(page.locator("img")).toHaveAttribute("alt", "部署流程图");
  await expect(page.locator("img")).toHaveAttribute(
    "style",
    /max-width:480px/,
  );
});

test("figure 解析来的默认 caption 归一到 name，明确说明不变", () => {
  const generated = normalizeParsedImageProps({
    url: "data:image/png;base64,AA==",
    caption: "image (1).png",
    previewWidth: 320,
  });
  expect(generated).toMatchObject({
    name: "image (1).png",
    caption: "",
    previewWidth: 320,
  });

  const described = normalizeParsedImageProps({
    url: "data:image/png;base64,AA==",
    name: "流程图替代文本",
    caption: "用户填写的说明",
    previewWidth: 480,
  });
  expect(described).toMatchObject({
    name: "流程图替代文本",
    caption: "用户填写的说明",
    previewWidth: 480,
  });
});

test("仅有 name 的 data 图片序列化后仍能保留名称和宽度", () => {
  const markdown = jsonContentToMarkdown([
    {
      type: "image",
      props: {
        url: "data:image/png;base64,AA==",
        name: "image.png",
        previewWidth: 320,
      },
    },
  ] as any);
  expect(markdown).toContain("![image.png](data:image/png;base64,AA==){width=320}");

  const [roundTripped] = markdownToJsonContent(markdown);
  expect(roundTripped.props).toMatchObject({
    name: "image.png",
    previewWidth: 320,
  });
  expect(roundTripped.props.caption).toBeUndefined();
});

test("上传后的 att 图也不把 image.png 升级为可见说明", () => {
  const [image] = markdownToJsonContent(
    "![image.png](att:img-1){width=176}",
  );
  expect(image).toMatchObject({
    type: "image",
    props: {
      url: "att:img-1",
      name: "image.png",
      previewWidth: 176,
    },
  });
  expect(image.props.caption).toBeUndefined();

  const markdown = jsonContentToMarkdown([
    {
      type: "image",
      props: {
        url: "att:img-1",
        name: "image.png",
        caption: "image.png",
        previewWidth: 176,
      },
    },
  ] as any);
  const [roundTripped] = markdownToJsonContent(markdown);
  expect(roundTripped.props).toMatchObject({
    url: "att:img-1",
    name: "image.png",
    previewWidth: 176,
  });
  expect(roundTripped.props.caption).toBeUndefined();
});
