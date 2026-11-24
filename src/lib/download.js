/** Browser helpers for exporting generated artwork. */

export function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Rasterizes a same-origin SVG (outlined paths, no external fonts) to PNG.
 * `scale` multiplies the SVG's intrinsic size.
 */
export async function downloadSvgAsPng(svgUrl, filename, scale = 4) {
  const res = await fetch(svgUrl, { credentials: "same-origin" });
  if (!res.ok) throw new Error("Could not load the logo.");
  const svgText = await res.text();
  const blobUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("Could not render the logo."));
      img.src = blobUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    triggerDownload(png, filename);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/** Rasterizes SVG text to a PNG blob at `scale` × its intrinsic size. */
export async function svgTextToPng(svgText, scale = 1) {
  const blobUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("Could not render the design."));
      img.src = blobUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Prints SVG artwork on its own page via a hidden iframe (the browser's print
 * dialog also offers "Save as PDF"). `paper` sets the @page size, e.g. "A4".
 */
export function printSvg(svgText, { paper } = {}) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const blobUrl = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
  const doc = frame.contentDocument;
  doc.open();
  doc.write(
    `<!doctype html><html><head><title>Print</title><style>@page{${paper ? `size:${paper};` : ""}margin:0}html,body{margin:0;height:100%}img{display:block;width:100%;height:100%;object-fit:contain}</style></head><body><img alt=""></body></html>`,
  );
  doc.close();
  const img = doc.querySelector("img");
  img.onload = () => {
    frame.contentWindow.focus();
    frame.contentWindow.print();
    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
      frame.remove();
    }, 1000);
  };
  img.src = blobUrl;
}
