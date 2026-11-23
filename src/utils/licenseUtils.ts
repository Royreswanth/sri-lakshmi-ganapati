import type {
  BusinessProfile,
  CloudLicenseRecord,
  Language,
  SubscriptionPlanType,
} from "../types";
import { getTodayStr } from "./dateUtils";

export const OWNER_WHATSAPP_NUMBER = "919573328444";
export const OWNER_WHATSAPP_DISPLAY = "+91 95733 28444";
export const OWNER_ADMIN_EMAIL = "reswanth6789@gmail.com";

export type PaidOrFreePlanId =
  | "half_yearly"
  | "yearly"
  | "custom_app"
  | "lifetime_free";

export interface PlanCatalogItem {
  id: PaidOrFreePlanId;
  code: "6M" | "12M" | "CUST" | "FREE";
  nameEn: string;
  nameTe: string;
  priceInr: number;
  priceLabel: string;
  durationDays: number;
  periodLabelEn: string;
  periodLabelTe: string;
  badgeEn?: string;
  badgeTe?: string;
}

export const SUBSCRIPTION_PLANS: Record<PaidOrFreePlanId, PlanCatalogItem> = {
  half_yearly: {
    id: "half_yearly",
    code: "6M",
    nameEn: "6 Months Plan",
    nameTe: "6 నెలల ప్లాన్",
    priceInr: 1599,
    priceLabel: "₹1,599",
    durationDays: 180,
    periodLabelEn: "/ 6 Months (₹267/mo)",
    periodLabelTe: "/ 6 నెలలు (నెలకు ₹267)",
  },
  yearly: {
    id: "yearly",
    code: "12M",
    nameEn: "12 Months Plan",
    nameTe: "12 నెలల ప్లాన్",
    priceInr: 2599,
    priceLabel: "₹2,599",
    durationDays: 365,
    periodLabelEn: "/ 12 Months (₹217/mo · Save ₹599)",
    periodLabelTe: "/ 12 నెలలు (నెలకు ₹217 · ₹599 ఆదా)",
    badgeEn: "BEST VALUE ★",
    badgeTe: "ఉత్తమ విలువ ★",
  },
  custom_app: {
    id: "custom_app",
    code: "CUST",
    nameEn: "Custom App Plan",
    nameTe: "కస్టమ్ యాప్ ప్లాన్",
    priceInr: 4999,
    priceLabel: "₹4,999+",
    durationDays: 365,
    periodLabelEn: "Bespoke Setup + 1 Year",
    periodLabelTe: "కస్టమ్ సెటప్ + 1 సం.",
  },
  lifetime_free: {
    id: "lifetime_free",
    code: "FREE",
    nameEn: "Dad / Family Free Pass",
    nameTe: "ఉచిత ఫ్యామిలీ పాస్",
    priceInr: 0,
    priceLabel: "FREE",
    durationDays: 36500,
    periodLabelEn: "Lifetime Free Access",
    periodLabelTe: "జీవితకాలం ఉచితం",
  },
};

const CODE_TO_PLAN: Record<string, PaidOrFreePlanId> = {
  "6M": "half_yearly",
  "12M": "yearly",
  CUST: "custom_app",
  FREE: "lifetime_free",
};

const DEVICE_STORAGE_KEY = "slg_device_id";
const DEVICE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const KEY_SIGNATURE_SECRET = "SLG_LBP_SAAS_2026_RESWANTH_9573328444";

export function normalizeDeviceId(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_STORAGE_KEY);
    if (existing && /^LBP-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(existing)) {
      return existing;
    }
    const randBytes = new Uint8Array(8);
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
      crypto.getRandomValues(randBytes);
    } else {
      for (let i = 0; i < randBytes.length; i++) {
        randBytes[i] = Math.floor(Math.random() * 256);
      }
    }
    const chars = Array.from(
      randBytes,
      (b) => DEVICE_ALPHABET[b % DEVICE_ALPHABET.length]
    );
    const id = `LBP-${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}`;
    localStorage.setItem(DEVICE_STORAGE_KEY, id);
    return id;
  } catch {
    return "LBP-OFFL-0001";
  }
}

export function addDaysToDateStr(baseDateStr: string, days: number): string {
  const [y, m, d] = baseDateStr.split("-").map((v) => parseInt(v, 10));
  if (!y || !m || !d) return baseDateStr;
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function computeExpiryForPlan(
  plan: PaidOrFreePlanId,
  baseDateStr: string = getTodayStr()
): string {
  if (plan === "lifetime_free") return "2099-12-31";
  const days = SUBSCRIPTION_PLANS[plan].durationDays;
  return addDaysToDateStr(baseDateStr, days);
}

/**
 * Deterministic 8-character cryptographic-style mixing signature binding a license
 * strictly to (deviceId, planCode, expiryDate) so keys cannot be shared across devices.
 */
function computeLicenseSignature(
  normalizedDeviceId: string,
  planCode: string,
  expiryCompact: string
): string {
  const input = `${normalizedDeviceId}|${planCode}|${expiryCompact}|${KEY_SIGNATURE_SECRET}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 = Math.imul(h2 ^ (ch + i * 17), 0x85ebca6b);
    h2 ^= h2 >>> 13;
  }
  const part1 = (h1 >>> 0).toString(36).toUpperCase().padStart(4, "0").slice(-4);
  const part2 = (h2 >>> 0).toString(36).toUpperCase().padStart(4, "0").slice(-4);
  return `${part1}${part2}`;
}

export function generateActivationKey(
  deviceId: string,
  plan: PaidOrFreePlanId,
  expiresAt?: string
): { key: string; expiresAt: string } {
  const normId = normalizeDeviceId(deviceId);
  const resolvedExpiry = expiresAt || computeExpiryForPlan(plan);
  const compactExpiry = resolvedExpiry.replace(/-/g, "");
  const code = SUBSCRIPTION_PLANS[plan].code;
  const sig = computeLicenseSignature(normId, code, compactExpiry);
  return {
    key: `SLG-${code}-${compactExpiry}-${sig}`,
    expiresAt: resolvedExpiry,
  };
}

export interface KeyVerificationResult {
  valid: boolean;
  plan?: PaidOrFreePlanId;
  expiresAt?: string;
  error?: string;
}

export function verifyActivationKey(
  rawKey: string,
  deviceId: string,
  todayStr: string = getTodayStr()
): KeyVerificationResult {
  const cleaned = rawKey.trim().toUpperCase();
  const match = /^SLG-(6M|12M|CUST|FREE)-(\d{8})-([A-Z0-9]{8})$/.exec(cleaned);
  if (!match) {
    return {
      valid: false,
      error: "Invalid key format. Example: SLG-6M-20270520-XXXX1234",
    };
  }

  const [, code, compactExpiry, suppliedSig] = match;
  const plan = CODE_TO_PLAN[code];
  if (!plan) {
    return { valid: false, error: "Unknown subscription plan code." };
  }

  const normId = normalizeDeviceId(deviceId);
  const expectedSig = computeLicenseSignature(normId, code, compactExpiry);
  if (suppliedSig !== expectedSig) {
    return {
      valid: false,
      error: "This Activation Key does not match your Device ID.",
    };
  }

  const expiresAt = `${compactExpiry.slice(0, 4)}-${compactExpiry.slice(4, 6)}-${compactExpiry.slice(6, 8)}`;
  if (plan !== "lifetime_free" && todayStr > expiresAt) {
    return {
      valid: false,
      error: `This Activation Key expired on ${expiresAt}.`,
    };
  }

  return { valid: true, plan, expiresAt };
}

export interface SubscriptionAccessEvaluation {
  allowed: boolean;
  reason:
    | "owner_admin"
    | "lifetime_free"
    | "active"
    | "expired"
    | "revoked"
    | "unsubscribed";
  plan: SubscriptionPlanType;
  planLabel: string;
  expiresAt?: string;
  daysRemaining?: number;
  isOwner?: boolean;
}

export function calculateDaysRemaining(
  expiresAt: string,
  todayStr: string = getTodayStr()
): number {
  const t1 = Date.parse(`${todayStr}T00:00:00Z`);
  const t2 = Date.parse(`${expiresAt}T00:00:00Z`);
  if (!Number.isFinite(t1) || !Number.isFinite(t2)) return 0;
  return Math.max(0, Math.ceil((t2 - t1) / (1000 * 60 * 60 * 24)));
}

export function isOwnerAdminEmail(
  email?: string | null,
  emailVerified?: boolean | null
): boolean {
  return Boolean(
    emailVerified &&
      email &&
      email.trim().toLowerCase() === OWNER_ADMIN_EMAIL.toLowerCase()
  );
}

export function evaluateSubscriptionAccess(params: {
  profile: BusinessProfile;
  userEmail?: string | null;
  emailVerified?: boolean | null;
  todayStr?: string;
}): SubscriptionAccessEvaluation {
  const { profile, userEmail, emailVerified, todayStr = getTodayStr() } = params;

  if (isOwnerAdminEmail(userEmail, emailVerified)) {
    return {
      allowed: true,
      reason: "owner_admin",
      plan: "lifetime_free",
      planLabel: "Owner Admin",
      isOwner: true,
    };
  }

  if (profile.subscriptionStatus === "revoked") {
    return {
      allowed: false,
      reason: "revoked",
      plan: profile.subscriptionPlan || "unsubscribed",
      planLabel: "License Revoked",
      expiresAt: profile.subscriptionExpiresAt,
    };
  }

  if (
    profile.subscriptionStatus === "lifetime_free" ||
    profile.subscriptionPlan === "lifetime_free"
  ) {
    return {
      allowed: true,
      reason: "lifetime_free",
      plan: "lifetime_free",
      planLabel: "Free Family Pass",
      expiresAt: "2099-12-31",
    };
  }

  if (
    profile.subscriptionStatus === "active" &&
    profile.subscriptionExpiresAt &&
    /^\d{4}-\d{2}-\d{2}$/.test(profile.subscriptionExpiresAt)
  ) {
    if (todayStr <= profile.subscriptionExpiresAt) {
      const daysRemaining = calculateDaysRemaining(
        profile.subscriptionExpiresAt,
        todayStr
      );
      const catalog =
        SUBSCRIPTION_PLANS[profile.subscriptionPlan as PaidOrFreePlanId];
      return {
        allowed: true,
        reason: "active",
        plan: profile.subscriptionPlan,
        planLabel: catalog ? catalog.nameEn : "Subscribed",
        expiresAt: profile.subscriptionExpiresAt,
        daysRemaining,
      };
    }

    return {
      allowed: false,
      reason: "expired",
      plan: profile.subscriptionPlan,
      planLabel: "Expired",
      expiresAt: profile.subscriptionExpiresAt,
      daysRemaining: 0,
    };
  }

  return {
    allowed: false,
    reason: "unsubscribed",
    plan: "unsubscribed",
    planLabel: "Not Subscribed",
  };
}

export function applyActivationToProfile(
  profile: BusinessProfile,
  params: {
    plan: PaidOrFreePlanId;
    expiresAt: string;
    licenseKey: string;
    deviceId: string;
    activatedBy: "activation_key" | "cloud_license" | "legacy_family" | "owner_admin";
  }
): BusinessProfile {
  return {
    ...profile,
    subscriptionPlan: params.plan,
    subscriptionStatus:
      params.plan === "lifetime_free" ? "lifetime_free" : "active",
    subscriptionExpiresAt: params.expiresAt,
    licenseKey: params.licenseKey,
    deviceId: params.deviceId,
    activatedAt: new Date().toISOString(),
    activatedBy: params.activatedBy,
  };
}

export function applyCloudLicenseToProfile(
  profile: BusinessProfile,
  license: CloudLicenseRecord,
  deviceId: string
): BusinessProfile {
  if (license.status === "revoked") {
    return {
      ...profile,
      subscriptionStatus: "revoked",
      subscriptionExpiresAt: license.expiresAt,
    };
  }
  return applyActivationToProfile(profile, {
    plan: license.plan,
    expiresAt: license.expiresAt,
    licenseKey: license.activationKey,
    deviceId: license.deviceId || deviceId,
    activatedBy: "cloud_license",
  });
}

export function buildSubscriptionWhatsAppUrl(params: {
  plan: PaidOrFreePlanId;
  deviceId: string;
  businessName?: string;
  googleEmail?: string;
  lang?: Language;
}): string {
  const { plan, deviceId, businessName, googleEmail, lang = "en" } = params;
  const item = SUBSCRIPTION_PLANS[plan];

  const lines =
    plan === "custom_app"
      ? [
          lang === "te"
            ? `నమస్కారం! నా ఫైనాన్స్ వ్యాపారం కోసం LineBook Pro కస్టమ్ యాప్ (${item.priceLabel}) కావాలి.`
            : `Hi! I want to request a Custom App (${item.priceLabel}) for my finance business.`,
          `Business: ${businessName || "New Lender"}`,
          `Device ID: ${deviceId}`,
          ...(googleEmail ? [`Google Email: ${googleEmail}`] : []),
        ]
      : [
          lang === "te"
            ? `నమస్కారం! LineBook Pro ${item.nameTe} (${item.priceLabel}) సబ్‌స్క్రిప్షన్ యాక్టివేట్ చేయాలనుకుంటున్నాను.`
            : `Hi! I want to activate LineBook Pro ${item.nameEn} (${item.priceLabel}).`,
          `Business: ${businessName || "New Lender"}`,
          `Device ID: ${deviceId}`,
          ...(googleEmail ? [`Google Email: ${googleEmail}`] : []),
          "Please share UPI payment details & my Activation Key.",
        ];

  return `https://wa.me/${OWNER_WHATSAPP_NUMBER}?text=${encodeURIComponent(lines.join("\n"))}`;
}
