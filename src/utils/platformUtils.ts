import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";

/**
 * Returns true when running inside the compiled native Android / iOS Capacitor APK wrapper.
 */
export function isNativeAndroidApk(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export interface SaveTextFileOptions {
  filename: string;
  content: string;
  mimeType: string;
  title?: string;
  text?: string;
  preferShareSheet?: boolean;
}

/**
 * Validates and sanitizes an export/backup filename to prevent path traversal or invalid Android chars.
 */
export function sanitizeExportFilename(rawName: string, fallback = "linebook_export.txt"): string {
  const cleaned = rawName
    .replace(/[/\\?%*:|"<>]/g, "_")
    .replace(/\.{2,}/g, ".")
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

/**
 * Saves or shares a generated text file (CSV / JSON backup) reliably across BOTH:
 * 1) Native Android APK (via Capacitor Filesystem Cache + Android Share/Save Sheet)
 * 2) Web / PWA Browser (via Web Share File API when requested or clean <a download>)
 */
export async function saveOrShareTextFile(options: SaveTextFileOptions): Promise<boolean> {
  const safeName = sanitizeExportFilename(options.filename);

  // Path 1: Inside Native Android APK WebView
  if (isNativeAndroidApk()) {
    try {
      await Filesystem.writeFile({
        path: safeName,
        data: options.content,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });
      const uriRes = await Filesystem.getUri({
        path: safeName,
        directory: Directory.Cache,
      });
      await Share.share({
        title: options.title || safeName,
        text: options.text || options.title || safeName,
        url: uriRes.uri,
        dialogTitle: options.title || safeName,
      });
      return true;
    } catch (err) {
      console.warn("Native Capacitor file share failed, trying browser fallback:", err);
    }
  }

  // Path 2: Browser Web Share File API (when user clicked Share)
  if (options.preferShareSheet && typeof navigator !== "undefined") {
    try {
      const file = new File([options.content], safeName, { type: options.mimeType });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: options.title || safeName,
          text: options.text || "",
          files: [file],
        });
        return true;
      }
    } catch {
      // Fall through to standard browser download
    }
  }

  // Path 3: Standard Desktop / Android Chrome Blob Download
  if (typeof document !== "undefined") {
    const blob = new Blob([options.content], { type: options.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }

  return false;
}
