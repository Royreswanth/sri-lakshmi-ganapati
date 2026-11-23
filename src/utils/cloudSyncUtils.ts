import type { BackupPayload } from "./storage";

export const BLUEPRINT_LIMITS = {
  ID_MAX: 128,
  ID_REGEX: /^[a-zA-Z0-9_-]+$/,
  EMAIL_MAX: 200,
  DISPLAY_NAME_MAX: 120,
  BUSINESS_NAME_MAX: 120,
  EXPORTED_AT_MAX: 40,
  MAX_VILLAGES: 500,
  MAX_BORROWERS: 5000,
  MAX_LIST_ITEMS: 5000,
  MAX_TOTAL_LENT: 1000000000,
  MAX_DOC_BYTES: 900000,
} as const;

export const ALLOWED_LEDGER_KEYS = [
  "slg_data",
  "slg_cols",
  "slg_exp",
  "slg_pin",
  "slg_newloans",
  "slg_personal",
  "slg_profile",
  "slg_lang",
  "slg_theme",
  "slg_whatsapp_rules",
  "slg_receipts_sent",
  "slg_cash_opening",
] as const;

/**
 * Recursively removes `undefined` fields and non-finite numbers so Firestore never
 * throws on malformed JS objects while preserving exact values for backup/restore.
 */
export function sanitizeForFirestore<T>(val: T): T {
  if (val === null || val === undefined) return null as unknown as T;
  if (typeof val === "number") {
    return (Number.isFinite(val) ? val : 0) as unknown as T;
  }
  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as unknown as T;
  }
  if (typeof val === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = sanitizeForFirestore(v);
      }
    }
    return out as T;
  }
  return val;
}

export function clampNumber(value: unknown, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function clipString(value: unknown, maxLen: number, fallback = ""): string {
  const s = typeof value === "string" ? value.trim() : fallback;
  return (s || fallback).slice(0, maxLen);
}

/**
 * Normalizes a local BackupPayload into the native Firestore `ledger` map structure
 * strictly matching `firebase-blueprint.json` and `firestore.rules`.
 */
export function buildSanitizedLedgerMap(payload: BackupPayload): Record<string, unknown> {
  const rawKeys = payload?.keys || {};
  const ledger: Record<string, unknown> = {};

  const rawData = (rawKeys.slg_data as any) || {};
  const rawVillages = Array.isArray(rawData.villages)
    ? rawData.villages.slice(0, BLUEPRINT_LIMITS.MAX_VILLAGES)
    : [];
  const rawBorrowers =
    rawData.borrowers && typeof rawData.borrowers === "object" && !Array.isArray(rawData.borrowers)
      ? rawData.borrowers
      : {};

  ledger.slg_data = {
    villages: sanitizeForFirestore(rawVillages),
    borrowers: sanitizeForFirestore(rawBorrowers),
  };

  const mapKeys = [
    "slg_cols",
    "slg_profile",
    "slg_whatsapp_rules",
    "slg_receipts_sent",
    "slg_cash_opening",
  ] as const;

  for (const key of mapKeys) {
    const v = rawKeys[key];
    if (v && typeof v === "object" && !Array.isArray(v)) {
      ledger[key] = sanitizeForFirestore(v);
    }
  }

  const listKeys = ["slg_exp", "slg_newloans", "slg_personal"] as const;
  for (const key of listKeys) {
    const v = rawKeys[key];
    if (Array.isArray(v)) {
      ledger[key] = sanitizeForFirestore(v.slice(0, BLUEPRINT_LIMITS.MAX_LIST_ITEMS));
    }
  }

  if (typeof rawKeys.slg_pin === "string" && /^[0-9]{4}$/.test(rawKeys.slg_pin)) {
    ledger.slg_pin = rawKeys.slg_pin;
  }

  if (rawKeys.slg_lang === "en" || rawKeys.slg_lang === "te") {
    ledger.slg_lang = rawKeys.slg_lang;
  }

  if (rawKeys.slg_theme === "light" || rawKeys.slg_theme === "dark") {
    ledger.slg_theme = rawKeys.slg_theme;
  }

  return ledger;
}

/**
 * Estimates UTF-8 byte size of a plain JSON-serializable object before uploading to Firestore.
 */
export function estimateJsonBytes(obj: unknown): number {
  const json = JSON.stringify(obj);
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(json).length;
  }
  return json.length;
}
