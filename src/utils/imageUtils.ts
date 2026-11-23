/**
 * Compresses a selected image file into a compact base64 JPEG portrait thumbnail
 * suitable for storing safely in device localStorage without exceeding quota.
 */
export async function compressBorrowerPhoto(
  file: File,
  maxSize = 220,
  quality = 0.72
): Promise<string> {
  if (!file || !file.type.startsWith("image/")) {
    throw new Error("Please select a valid image file.");
  }

  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not decode selected image."));
    image.src = rawDataUrl;
  });

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  if (!width || !height) {
    throw new Error("Invalid image dimensions.");
  }

  const scale = Math.min(1, maxSize / Math.max(width, height));
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas image processing is unavailable.");
  }

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, targetW, targetH);
  ctx.drawImage(img, 0, 0, targetW, targetH);

  return canvas.toDataURL("image/jpeg", quality);
}
