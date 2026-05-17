"use client";

const XHTML_NAMESPACE = "http://www.w3.org/1999/xhtml";

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Unable to encode the PNG export."));
    }, "image/png");
  });

const loadImage = (objectUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to render the HTML preview as an image."));
    image.src = objectUrl;
  });

const downloadBlob = (blob: Blob, fileName: string) => {
  const objectUrl = URL.createObjectURL(blob);

  try {
    const link = document.createElement("a");
    link.download = fileName;
    link.href = objectUrl;
    link.click();
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};

const replaceExtension = (fileName: string, extension: string) => {
  if (/\.[^./\\]+$/.test(fileName)) {
    return fileName.replace(/\.[^./\\]+$/, extension);
  }

  return `${fileName}${extension}`;
};

const isCanvasSecurityError = (error: unknown) => {
  if (error instanceof DOMException && error.name === "SecurityError") {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /tainted canvases|operation is insecure|security/i.test(error.message);
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to inline image assets for the PNG export."));
    reader.readAsDataURL(blob);
  });

const imageSourceToDataUrl = async (src: string) => {
  if (!src || src.startsWith("data:")) return src;

  const response = await fetch(new URL(src, window.location.href).toString(), { cache: "force-cache" });

  if (!response.ok) {
    throw new Error("Unable to load image assets for the PNG export.");
  }

  return blobToDataUrl(await response.blob());
};

const inlineImages = async (source: HTMLElement, target: HTMLElement) => {
  const sourceImages = Array.from(source.querySelectorAll("img"));
  const targetImages = Array.from(target.querySelectorAll("img"));

  await Promise.all(
    sourceImages.map(async (sourceImage, index) => {
      const targetImage = targetImages[index];
      const sourceUrl = sourceImage.currentSrc || sourceImage.src || targetImage?.src;

      if (!targetImage || !sourceUrl) return;

      targetImage.src = await imageSourceToDataUrl(sourceUrl);
      targetImage.removeAttribute("srcset");
      targetImage.removeAttribute("crossorigin");
    })
  );
};

const copyComputedStyles = (source: HTMLElement, target: HTMLElement) => {
  const computedStyles = window.getComputedStyle(source);
  const serializedStyles = Array.from(computedStyles)
    .map((property) => `${property}:${computedStyles.getPropertyValue(property)};`)
    .join("");

  target.setAttribute("style", serializedStyles);

  if (source instanceof HTMLImageElement && target instanceof HTMLImageElement) {
    target.src = source.currentSrc || source.src;
  }

  if (source instanceof HTMLTextAreaElement && target instanceof HTMLTextAreaElement) {
    target.value = source.value;
  }

  if (source instanceof HTMLInputElement && target instanceof HTMLInputElement) {
    target.value = source.value;
  }

  if (source instanceof HTMLCanvasElement && target instanceof HTMLCanvasElement) {
    target.width = source.width;
    target.height = source.height;
    const context = target.getContext("2d");
    context?.drawImage(source, 0, 0);
  }

  Array.from(source.children).forEach((child, index) => {
    const targetChild = target.children.item(index);

    if (child instanceof HTMLElement && targetChild instanceof HTMLElement) {
      copyComputedStyles(child, targetChild);
    }
  });
};

export async function exportHtmlToPng(element: HTMLElement, fileName: string) {
  const width = Math.ceil(element.scrollWidth);
  const height = Math.ceil(element.scrollHeight);

  if (width <= 0 || height <= 0) {
    throw new Error("Unable to resolve preview dimensions.");
  }

  const clone = element.cloneNode(true) as HTMLElement;
  clone.setAttribute("xmlns", XHTML_NAMESPACE);
  copyComputedStyles(element, clone);
  await inlineImages(element, clone);

  const wrapper = document.createElement("div");
  wrapper.setAttribute("xmlns", XHTML_NAMESPACE);
  wrapper.appendChild(clone);

  const serializedMarkup = new XMLSerializer().serializeToString(wrapper);
  const svgMarkup = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">${serializedMarkup}</foreignObject>
    </svg>
  `;

  const svgBlob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(svgUrl);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to initialize the PNG export.");
    }

    context.drawImage(image, 0, 0, width, height);

    const pngBlob = await canvasToBlob(canvas);
    downloadBlob(pngBlob, fileName);
  } catch (error) {
    if (!isCanvasSecurityError(error)) {
      throw error;
    }

    // Some browsers mark foreignObject canvas renders as tainted. Keep export usable.
    downloadBlob(svgBlob, replaceExtension(fileName, ".svg"));
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
