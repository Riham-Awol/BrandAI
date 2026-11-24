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
