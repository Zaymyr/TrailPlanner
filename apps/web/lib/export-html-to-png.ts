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
    const pngUrl = URL.createObjectURL(pngBlob);

    try {
      const link = document.createElement("a");
      link.download = fileName;
      link.href = pngUrl;
      link.click();
    } finally {
      URL.revokeObjectURL(pngUrl);
    }
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}
