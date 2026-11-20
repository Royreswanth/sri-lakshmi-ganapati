import { Borrower, Language, PaymentStatus, Village, PaymentMethod, WhatsAppRules } from "../types";
import { formatCurrency, formatDateIN, getTodayStr, getDayName, parseLocalDate } from "./dateUtils";
import { DB, STORAGE_KEYS } from "./storage";

export const REMINDERS_STORAGE_KEY = "slg_reminders";

export const DEFAULT_WHATSAPP_RULES: WhatsAppRules = {
  masterEnabled: true,
  autoReceiptOnPayment: true,
  autoTwoDayReminder: true,
  borrowerConfigs: {},
  villageConfigs: {},
};

interface ReceiptParams {
  borrower: Borrower;
  amtPaid: number;
  status: PaymentStatus;
  dateStr: string;
  villageName: string;
  businessName: string;
  payMethod?: PaymentMethod;
  note?: string;
  extraAmt?: number;
  remainingBal: number;
  lang?: Language;
}

/**
 * Builds a friendly, professional WhatsApp payment confirmation receipt
 * Formatted cleanly for Indian WhatsApp users with Telugu and English support.
 */
export function buildWhatsAppReceiptText({
  borrower,
  amtPaid,
  status,
  dateStr,
  villageName,
  businessName,
  payMethod = "cash",
  note = "",
  extraAmt = 0,
  remainingBal,
  lang = "te",
}: ReceiptParams): string {
  const currentWeek = borrower.weeksPaid;
  const totalWeeks = borrower.durationWeeks || 12;
  const formattedDate = formatDateIN(dateStr, lang);
  const day = getDayName(dateStr, lang);

  const payModeText =
    payMethod === "phonepe"
      ? "ఫోన్‌పే (PhonePe UPI)"
      : payMethod === "online"
      ? "ఆన్‌లైన్ / బ్యాంక్ ట్రాన్స్‌ఫర్ (Online Transfer)"
      : "నగదు (Cash in Hand)";

  if (lang === "te") {
    let statusText = "పూర్తి వాయిదా చెల్లించారు ✅";
    if (status === "short") {
      const shortfall = Math.max(borrower.weeklyDue - amtPaid, 0);
      statusText = `పాక్షిక మొత్తం (బాకీ: ${formatCurrency(shortfall)}) ⚡`;
    }
    if (status === "extra") {
      statusText = `అదనపు మొత్తం (+${formatCurrency(extraAmt)}) ➕`;
    }

    const lines = [
      `🙏 *${businessName}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `🧾 *వారం వాయిదా చెల్లింపు రశీదు*`,
      ``,
      `👤 *ఖాతాదారు:* ${borrower.name}${borrower.seqNo ? ` (#${borrower.seqNo})` : ""}`,
      `📍 *గ్రామం:* ${villageName}`,
      `📅 *తేదీ:* ${day}, ${formattedDate}`,
      `📊 *వాయిదా వారం:* Wk ${currentWeek} / ${totalWeeks}`,
      `💵 *వాయిదా మొత్తం:* ${formatCurrency(borrower.weeklyDue)}`,
      `✅ *చెల్లించిన మొత్తం:* ${formatCurrency(amtPaid)} (${statusText})`,
      `💳 *చెల్లింపు విధానం:* ${payModeText}`,
    ];

    if (note) {
      lines.push(`📝 *గమనిక:* ${note}`);
    }

    lines.push(
      `⏳ *మిగిలిన మొత్తం బాకీ:* ${formatCurrency(remainingBal)}`,
      ``,
      `ధన్యవాదాలు! మీ చెల్లింపు విజయవంతంగా నమోదైంది. 🙏`,
      `━━━━━━━━━━━━━━━━━━━━`
    );

    return lines.join("\n");
  }

  // English receipt fallback
  let statusTextEn = "Full Installment Paid ✅";
  if (status === "short") {
    const shortfall = Math.max(borrower.weeklyDue - amtPaid, 0);
    statusTextEn = `Short Payment (Balance: ${formatCurrency(shortfall)}) ⚡`;
  }
  if (status === "extra") {
    statusTextEn = `Extra Paid (+${formatCurrency(extraAmt)}) ➕`;
  }

  const payModeTextEn =
    payMethod === "phonepe"
      ? "PhonePe UPI"
      : payMethod === "online"
      ? "Online Bank Transfer"
      : "Cash in Hand";

  const linesEn = [
    `🙏 *${businessName}*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `🧾 *Weekly Loan EMI Receipt*`,
    ``,
    `👤 *Borrower:* ${borrower.name}${borrower.seqNo ? ` (#${borrower.seqNo})` : ""}`,
    `📍 *Village:* ${villageName}`,
    `📅 *Date:* ${day}, ${formattedDate}`,
    `📊 *Installment:* Wk ${currentWeek} / ${totalWeeks}`,
    `💵 *Weekly Due:* ${formatCurrency(borrower.weeklyDue)}`,
    `✅ *Amount Paid:* ${formatCurrency(amtPaid)} (${statusTextEn})`,
    `💳 *Payment Mode:* ${payModeTextEn}`,
  ];

  if (note) {
    linesEn.push(`📝 *Note:* ${note}`);
  }

  linesEn.push(
    `⏳ *Remaining Balance:* ${formatCurrency(remainingBal)}`,
    ``,
    `Thank you! Your payment has been successfully recorded. 🙏`,
    `━━━━━━━━━━━━━━━━━━━━`
  );

  return linesEn.join("\n");
}

/**
 * Builds a 2-day advance collection reminder message
 * Delivered from the lender's WhatsApp number to borrower.
 */
export function buildAdvanceReminderText({
  borrower,
  villageName,
  visitDate,
  businessName,
  remainingBal,
  lang = "te",
}: {
  borrower: Borrower;
  villageName: string;
  visitDate: string;
  businessName: string;
  remainingBal: number;
  lang?: Language;
}): string {
  const formattedDate = formatDateIN(visitDate, lang);
  const visitDayName = getDayName(visitDate, lang);
  const nextWeek = borrower.weeksPaid + 1;
  const totalWeeks = borrower.durationWeeks || 12;

  if (lang === "te") {
    return [
      `🙏 నమస్కారం *${borrower.name}* గారు,`,
      ``,
      `*${businessName}* వారి తరపున ముందస్తు సమాచారం.`,
      `మా ప్రతినిధి *${visitDayName} (${formattedDate})* నాడు మీ గ్రామం (*${villageName}*) కు వారం వాయిదా సేకరణ కోసం వస్తున్నారు.`,
      ``,
      `💵 *ఈ వారం వాయిదా:* ${formatCurrency(borrower.weeklyDue)}`,
      `📊 *వాయిదా వారం:* Wk ${nextWeek} / ${totalWeeks}`,
      `⏳ *మొత్తం మిగిలిన బాకీ:* ${formatCurrency(remainingBal)}`,
      ``,
      `దయచేసి మీ వాయిదా మొత్తాన్ని సిద్ధంగా ఉంచుకోగలరని కోరుతున్నాము. నగదు లేదా PhonePe ద్వారా చెల్లించవచ్చు.`,
      `ధన్యవాదాలు! 🙏`
    ].join("\n");
  }

  return [
    `🙏 Hello *${borrower.name}*,`,
    ``,
    `Advance notice from *${businessName}*.`,
    `Our agent will visit *${villageName}* on *${visitDayName} (${formattedDate})* for weekly loan collection.`,
    ``,
    `💵 *Weekly Due:* ${formatCurrency(borrower.weeklyDue)}`,
    `📊 *Installment Week:* Wk ${nextWeek} / ${totalWeeks}`,
    `⏳ *Remaining Balance:* ${formatCurrency(remainingBal)}`,
    ``,
    `Please keep the installment amount ready. (Cash or PhonePe accepted).`,
    `Thank you! 🙏`
  ].join("\n");
}

/**
 * Builds an overdue / skip warning notice
 */
export function buildSkipWarningText({
  borrower,
  businessName,
  remainingBal,
  lang = "te",
}: {
  borrower: Borrower;
  businessName: string;
  remainingBal: number;
  lang?: Language;
}): string {
  if (lang === "te") {
    return [
      `⚠️ *ముఖ్య గమనిక - ${businessName}*`,
      ``,
      `*${borrower.name}* గారు,`,
      `మీ వారం వాయిదా గడువు దాటిపోయింది లేదా వాయిదా దాటవేయబడింది.`,
      ``,
      `💵 *వాయిదా మొత్తం:* ${formatCurrency(borrower.weeklyDue)}`,
      `⏳ *మొత్తం మిగిలిన బాకీ:* ${formatCurrency(remainingBal)}`,
      ``,
      `దయచేసి వెంటనే సంప్రదించి బకాయిని చెల్లించగలరు. ఆలస్యమైతే రుణం వ్యవధి పెరుగుతుంది.`,
      `ధన్యవాదాలు! 🙏`
    ].join("\n");
  }

  return [
    `⚠️ *Overdue Notice - ${businessName}*`,
    ``,
    `Dear *${borrower.name}*,`,
    `Your weekly loan installment was skipped or pending.`,
    ``,
    `💵 *Weekly Due:* ${formatCurrency(borrower.weeklyDue)}`,
    `⏳ *Total Balance:* ${formatCurrency(remainingBal)}`,
    ``,
    `Please clear the pending amount at the earliest to prevent tenure extension.`,
    `Thank you! 🙏`
  ].join("\n");
}

/**
 * Normalizes phone numbers to standard 10-digit Indian numbers or includes 91
 */
export function normalizePhoneNumber(phone?: string): string {
  if (!phone) return "";
  let digits = phone.replace(/[^0-9]/g, "");
  // Strip leading zero if 11 digits (e.g. 09876543210 -> 9876543210)
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }
  // Strip country code if entered with 91 and 12 digits
  if (digits.length === 12 && digits.startsWith("91")) {
    digits = digits.slice(2);
  }
  return digits;
}

/**
 * Builds the direct WhatsApp click-to-chat URL
 */
export function getWhatsAppUrl(phone: string | undefined, text: string): string {
  const normalized = normalizePhoneNumber(phone);
  const finalPhone = normalized.length === 10 ? `91${normalized}` : normalized;
  const encodedText = encodeURIComponent(text);

  if (finalPhone) {
    return `https://wa.me/${finalPhone}?text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/**
 * Open WhatsApp with pre-filled text from lender's personal WhatsApp
 * Uses link dispatch + location fallback for reliable Android Chrome / PWA behavior.
 */
export function openWhatsApp(phone: string | undefined, text: string): void {
  const url = getWhatsAppUrl(phone, text);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) {
        document.body.removeChild(a);
      }
    }, 100);
  } catch {
    window.location.href = url;
  }
}

/**
 * Calculate 2-Day Advance Line Information
 * E.g., Saturday (day 6) -> Monday is 2 days ahead!
 * Sunday (day 0) -> Tuesday is 2 days ahead!
 */
export interface TwoDayAdvanceInfo {
  isTwoDaysAhead: boolean;
  currentDayName: string;
  targetDayName: "Monday" | "Tuesday";
  targetDateStr: string;
  matchingVillages: Village[];
}

export function getTwoDayAdvanceInfo(
  villages: Village[],
  currentDate = new Date()
): TwoDayAdvanceInfo {
  const currentDayIndex = currentDate.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDayName = dayNames[currentDayIndex];

  // Exactly 2 days ahead:
  // Saturday (6) + 2 days = Monday (1)
  // Sunday (0) + 2 days = Tuesday (2)
  let targetDayName: "Monday" | "Tuesday" = "Monday";
  let daysToAdd = 2;
  let isTwoDaysAhead = false;

  if (currentDayIndex === 6) {
    // Today is Saturday -> Target is Monday (2 days ahead)
    targetDayName = "Monday";
    daysToAdd = 2;
    isTwoDaysAhead = true;
  } else if (currentDayIndex === 0) {
    // Today is Sunday -> Target is Tuesday (2 days ahead)
    targetDayName = "Tuesday";
    daysToAdd = 2;
    isTwoDaysAhead = true;
  } else if (currentDayIndex === 5) {
    // Friday -> upcoming Monday is 3 days ahead
    targetDayName = "Monday";
    daysToAdd = 3;
  } else if (currentDayIndex === 1) {
    // Monday -> upcoming Tuesday is 1 day ahead
    targetDayName = "Tuesday";
    daysToAdd = 1;
  } else {
    // Other days default to next Monday
    const diffToMon = (8 - currentDayIndex) % 7;
    targetDayName = "Monday";
    daysToAdd = diffToMon === 0 ? 7 : diffToMon;
  }

  const targetDate = new Date(currentDate);
  targetDate.setDate(currentDate.getDate() + daysToAdd);
  const targetDateStr = getTodayStr(targetDate);

  const matchingVillages = villages.filter((v) => v.day === targetDayName);

  return {
    isTwoDaysAhead,
    currentDayName,
    targetDayName,
    targetDateStr,
    matchingVillages,
  };
}

/**
 * Storage helpers for tracking sent reminders
 */
export function getSentRemindersMap(): Record<string, boolean> {
  return DB.get<Record<string, boolean>>(REMINDERS_STORAGE_KEY, {});
}

export function isReminderSent(borrowerId: string, visitDate: string): boolean {
  const map = getSentRemindersMap();
  return !!map[`${borrowerId}_${visitDate}`];
}

export function markReminderSent(borrowerId: string, visitDate: string): void {
  const map = getSentRemindersMap();
  map[`${borrowerId}_${visitDate}`] = true;
  DB.set(REMINDERS_STORAGE_KEY, map);
}

/**
 * Storage helpers for tracking sent WhatsApp receipts
 */
export function getSentReceiptsMap(): Record<string, boolean> {
  return DB.get<Record<string, boolean>>(STORAGE_KEYS.RECEIPTS_SENT, {});
}

export function isReceiptSent(borrowerId: string, dateStr: string): boolean {
  const map = getSentReceiptsMap();
  return !!map[`${borrowerId}_${dateStr}`];
}

export function markReceiptSent(borrowerId: string, dateStr: string): void {
  const map = getSentReceiptsMap();
  map[`${borrowerId}_${dateStr}`] = true;
  DB.set(STORAGE_KEYS.RECEIPTS_SENT, map);
}

/**
 * Get and save WhatsApp Rules from local storage
 */
export function getWhatsAppRules(): WhatsAppRules {
  const saved = DB.get<WhatsAppRules>(STORAGE_KEYS.WHATSAPP_RULES, DEFAULT_WHATSAPP_RULES);
  return {
    ...DEFAULT_WHATSAPP_RULES,
    ...saved,
    borrowerConfigs: saved.borrowerConfigs || {},
    villageConfigs: saved.villageConfigs || {},
  };
}

export function saveWhatsAppRules(rules: WhatsAppRules): void {
  DB.set(STORAGE_KEYS.WHATSAPP_RULES, rules);
}

/**
 * Checks whether a borrower uses a basic keypad mobile (no WhatsApp)
 */
export function isBorrowerKeypad(borrower: Borrower, rules?: WhatsAppRules): boolean {
  const r = rules || getWhatsAppRules();
  const borrowerCfg = r.borrowerConfigs?.[borrower.id];
  if (borrowerCfg && typeof borrowerCfg.hasWhatsApp === "boolean") {
    return !borrowerCfg.hasWhatsApp;
  }
  return borrower.hasWhatsApp === false;
}

/**
 * Checks whether receipt dispatch is disabled for a borrower.
 * Evaluates borrower profile (`disableReceipt`), borrower config in rules,
 * village-level overrides, and keypad mobile status.
 */
export function isBorrowerReceiptDisabled(
  borrower: Borrower | null | undefined,
  villageId?: string,
  rules?: WhatsAppRules
): boolean {
  if (!borrower) return true;
  const r = rules || getWhatsAppRules();

  // 1. Basic keypad mobile check (no WhatsApp capability)
  if (isBorrowerKeypad(borrower, r)) return true;

  // 2. Borrower profile setting: strictly check boolean or string truthiness
  if (Boolean(borrower.disableReceipt) || String(borrower.disableReceipt) === "true") {
    return true;
  }

  // 3. Borrower config override in WhatsApp rules
  const bCfg = r.borrowerConfigs?.[borrower.id];
  if (bCfg && (Boolean(bCfg.disableReceipt) || String(bCfg.disableReceipt) === "true")) {
    return true;
  }

  // 4. Village-level override check (if villageId is provided)
  if (villageId && r.villageConfigs?.[villageId]?.disableReceipt) {
    return true;
  }

  return false;
}

/**
 * Check whether a payment receipt should be automatically dispatched via WhatsApp.
 * Strictly blocks dispatch if receipt option is disabled in borrower's profile,
 * even if general WhatsApp is fully enabled.
 */
export function canAutoSendReceipt(
  borrower: Borrower,
  villageId: string,
  rules?: WhatsAppRules
): boolean {
  const r = rules || getWhatsAppRules();

  // 1. Master enable check (general WhatsApp feature & auto-receipt toggle)
  if (!r.masterEnabled || !r.autoReceiptOnPayment) return false;

  // 2. Strict borrower profile & config check:
  // If disabled in profile or settings, strictly block dispatch!
  if (isBorrowerReceiptDisabled(borrower, villageId, r)) return false;

  // 3. Valid 10-digit phone number check
  const normalized = normalizePhoneNumber(borrower.phone);
  if (normalized.length < 10) return false;

  return true;
}

/**
 * Check whether a 2-day advance reminder should be dispatched to borrower
 */
export function canAutoSendReminder(
  borrower: Borrower,
  villageId: string,
  rules?: WhatsAppRules
): boolean {
  const r = rules || getWhatsAppRules();

  // 1. Master enable check
  if (!r.masterEnabled || !r.autoTwoDayReminder) return false;

  // 2. Keypad mobile check
  if (isBorrowerKeypad(borrower, r)) return false;

  // 3. Village-level override check
  if (r.villageConfigs?.[villageId]?.disableReminder) return false;

  // 4. Borrower-level override check
  if (borrower.disableReminder) return false;
  if (r.borrowerConfigs?.[borrower.id]?.disableReminder) return false;

  // 5. Valid 10-digit phone number check
  const normalized = normalizePhoneNumber(borrower.phone);
  if (normalized.length < 10) return false;

  return true;
}
