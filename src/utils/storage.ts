import type { BusinessProfile, Language, ThemeMode } from "../types.ts";
import { saveOrShareTextFile } from "./platformUtils";

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
  CASH_OPENING: "slg_cash_opening",
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
  subscriptionPlan: "unsubscribed",
  subscriptionStatus: "unsubscribed",
  subscriptionExpiresAt: "",
  trialEndsAt: twoWeeksLater.toISOString().split("T")[0],
  lineDaysMode: "specific",
  lineDays: ["Monday", "Tuesday"],
  lineDaysConfigured: false,
  enableDailyCashbook: true,
  lineCycleWeeks: 12,
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
    STORAGE_KEYS.CASH_OPENING,
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
  const dateStr = new Date().toISOString().split("T")[0];
  const finalName = filename || `LineBookPro_Backup_${dateStr}.json`;

  void saveOrShareTextFile({
    filename: finalName,
    content: jsonStr,
    mimeType: "application/json",
    title: "LineBook Pro Backup",
    text: `Line Finance database backup dated ${dateStr}`,
  });
}

export async function shareBackupFile(payload: BackupPayload): Promise<boolean> {
  const jsonStr = JSON.stringify(payload, null, 2);
  const dateStr = new Date().toISOString().split("T")[0];
  const fileName = `LineBookPro_Backup_${dateStr}.json`;

  return saveOrShareTextFile({
    filename: fileName,
    content: jsonStr,
    mimeType: "application/json",
    title: "LineBook Pro Backup",
    text: `Line Finance database backup dated ${dateStr}`,
    preferShareSheet: true,
  });
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

const DEMO_VILLAGES = new Map<string, string>([
  ["v1", "Polamuru (పోలమూరు)"],
  ["v2", "Pippara (పిప్పర)"],
]);

const DEMO_BORROWERS = new Map<string, string>([
  ["b1", "వెంకటేశ్వరరావు (Venkateswara Rao)"],
  ["b2", "నాగమణి (Nagamani)"],
]);

/**
 * Returns true ONLY if the stored ledger contains strictly the untouched preview seed data
 * (Polamuru/Pippara + Venkateswara Rao/Nagamani) with zero user additions or recorded collections.
 * Guarantees real lender data is NEVER wiped.
 */
export function isUntouchedDemoData(
  data: { villages: Array<{ id: string; name: string }>; borrowers: Record<string, Array<{ id: string; name: string }>> },
  collections: Record<string, unknown> = {},
  expenses: unknown[] = [],
  newLoansLog: unknown[] = [],
  personalLog: unknown[] = []
): boolean {
  if (!data || !Array.isArray(data.villages) || data.villages.length === 0) {
    return false;
  }

  if (
    Object.keys(collections || {}).length > 0 ||
    (expenses || []).length > 0 ||
    (newLoansLog || []).length > 0 ||
    (personalLog || []).length > 0
  ) {
    return false;
  }

  // Every village must strictly match the exact seeded IDs and names
  for (const v of data.villages) {
    if (DEMO_VILLAGES.get(v.id) !== v.name) {
      return false;
    }
  }

  // Every borrower must strictly match the exact seeded IDs and names
  const allBorrowers = Object.values(data.borrowers || {}).flat();
  for (const b of allBorrowers) {
    if (DEMO_BORROWERS.get(b.id) !== b.name) {
      return false;
    }
  }

  return true;
}

/**
 * Clears all ledger/testing data from localStorage while keeping an internal safety copy.
 * Optionally resets Business Profile and PIN as well (Factory Reset).
 */
export function clearAllAppData(options: { includeProfileAndPin?: boolean } = {}): void {
  const { includeProfileAndPin = false } = options;

  try {
    const preReset = generateBackupPayload();
    if (Object.keys(preReset.keys).length > 0) {
      localStorage.setItem("slg_safety_pre_reset", JSON.stringify(preReset));
    }
  } catch {}

  const ledgerKeys = [
    STORAGE_KEYS.DATA,
    STORAGE_KEYS.COLS,
    STORAGE_KEYS.EXP,
    STORAGE_KEYS.NEW_LOANS,
    STORAGE_KEYS.PERSONAL,
    STORAGE_KEYS.RECEIPTS_SENT,
    STORAGE_KEYS.CASH_OPENING,
    "slg_last_cloud_backup",
    "slg_local_backup_at",
    "slg_onboarding_dismissed",
  ];

  for (const k of ledgerKeys) {
    DB.remove(k);
  }

  // Clean village/borrower-specific WhatsApp overrides while keeping master preferences
  const existingRules = DB.get<any>(STORAGE_KEYS.WHATSAPP_RULES, null);
  if (existingRules && typeof existingRules === "object") {
    DB.set(STORAGE_KEYS.WHATSAPP_RULES, {
      ...existingRules,
      villageConfigs: {},
      borrowerConfigs: {},
    });
  }

  if (includeProfileAndPin) {
    DB.remove(STORAGE_KEYS.PROFILE);
    DB.remove(STORAGE_KEYS.PIN);
    DB.remove("slg_lender_cloud_id");
  }
}

