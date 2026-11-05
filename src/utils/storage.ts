import type { BusinessProfile, Language, ThemeMode } from "../types.ts";

export const STORAGE_KEYS = {
  DATA: "slg_data",
  COLS: "slg_cols",
  EXP: "slg_exp",
  PIN: "slg_pin",
  NEW_LOANS: "slg_newloans",
  PERSONAL: "slg_personal",
  PROFILE: "slg_profile",
  LANG: "slg_lang",
  THEME: "slg_theme",
  WHATSAPP_RULES: "slg_whatsapp_rules",
  RECEIPTS_SENT: "slg_receipts_sent",
} as const;

export const DB = {
  get<T>(key: string, defaultValue: T): T {
    try {
      const val = localStorage.getItem(key);
      if (!val) return defaultValue;
      return JSON.parse(val) as T;
    } catch {
      return defaultValue;
    }
  },

  set<T>(key: string, value: T): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error(`Failed to write to localStorage for key: ${key}`, e);
      return false;
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {}
  }
};

const twoWeeksLater = new Date();
twoWeeksLater.setDate(twoWeeksLater.getDate() + 14);

export const DEFAULT_PROFILE: BusinessProfile = {
  businessName: "LineBook Pro",
  tagline: "Weekly Line Finance",
  ownerName: "Owner / Partner",
  phone: "",
  emblem: "ganesha",
  brandColor: "#D97706",
  modelType: "sole_owner",
  partners: [],
  workers: [],
  subscriptionPlan: "half_yearly",
  trialEndsAt: twoWeeksLater.toISOString().split("T")[0],
};

export interface BackupPayload {
  app: string;
  version: number;
  exportedAt: string;
  keys: Record<string, unknown>;
}

export function generateBackupPayload(): BackupPayload {
  const keysToBackup = [
    STORAGE_KEYS.DATA,
    STORAGE_KEYS.COLS,
    STORAGE_KEYS.EXP,
    STORAGE_KEYS.PIN,
    STORAGE_KEYS.NEW_LOANS,
    STORAGE_KEYS.PERSONAL,
    STORAGE_KEYS.PROFILE,
    STORAGE_KEYS.LANG,
    STORAGE_KEYS.THEME,
    STORAGE_KEYS.WHATSAPP_RULES,
    STORAGE_KEYS.RECEIPTS_SENT,
  ];

  const backupData: Record<string, unknown> = {};
  for (const k of keysToBackup) {
    const raw = localStorage.getItem(k);
    if (raw) {
      try {
        backupData[k] = JSON.parse(raw);
      } catch {
        backupData[k] = raw;
      }
    }
  }

  return {
    app: "LineBookPro",
    version: 3,
    exportedAt: new Date().toISOString(),
    keys: backupData
  };
}

export function downloadBackupFile(payload: BackupPayload, filename?: string): void {
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const dateStr = new Date().toISOString().split("T")[0];
  const finalName = filename || `LineBookPro_Backup_${dateStr}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = finalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function shareBackupFile(payload: BackupPayload): Promise<boolean> {
  const jsonStr = JSON.stringify(payload, null, 2);
  const dateStr = new Date().toISOString().split("T")[0];
  const fileName = `LineBookPro_Backup_${dateStr}.json`;
  const file = new File([jsonStr], fileName, { type: "application/json" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: "LineBook Pro Backup",
        text: `Line Finance database backup dated ${dateStr}`,
        files: [file]
      });
      return true;
    } catch {
      downloadBackupFile(payload, fileName);
      return false;
    }
  } else {
    downloadBackupFile(payload, fileName);
    return true;
  }
}

export function restoreBackupPayload(payload: any): { success: boolean; message: string; borrowerCount?: number } {
  if (!payload || typeof payload !== "object") {
    return { success: false, message: "Invalid backup file: not a JSON object" };
  }

  const keys = payload.keys || payload.data || payload;

  if (!keys[STORAGE_KEYS.DATA]) {
    return { success: false, message: "Backup missing core data (slg_data)" };
  }

  try {
    const safetySnapshot = generateBackupPayload();
    localStorage.setItem("slg_safety_pre_restore", JSON.stringify(safetySnapshot));

    for (const [k, v] of Object.entries(keys)) {
      if (k.startsWith("slg_")) {
        localStorage.setItem(k, JSON.stringify(v));
      }
    }

    const restoredData = keys[STORAGE_KEYS.DATA] as any;
    const borrowerTotal = restoredData?.borrowers
      ? Object.values(restoredData.borrowers).flat().length
      : 0;

    return {
      success: true,
      message: `Restore successful! Loaded data with ${borrowerTotal} borrowers.`,
      borrowerCount: borrowerTotal
    };
  } catch (err: any) {
    return { success: false, message: `Restore error: ${err?.message || "Unknown error"}` };
  }
}
