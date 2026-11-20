export type DayOfWeek = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";

export type PaymentStatus = "paid" | "skip" | "short" | "extra";
export type PaymentMethod = "cash" | "phonepe" | "online";

export interface HistoryEntry {
  date: string; // YYYY-MM-DD
  status: PaymentStatus;
  amtPaid: number;
  note?: string;
  payMethod?: PaymentMethod;
  extraAmt?: number;
}

export interface Borrower {
  id: string;
  seqNo: string; // Roll number e.g. "1", "12", "A-5"
  name: string;
  phone?: string;
  loanAmt: number;
  durationWeeks: number; // default 12, +1 on skip, +1 on short
  interestPct: number; // e.g. 20
  weeklyDue: number; // ceil(loan * (1 + pct/100) / weeks)
  totalReturn: number; // weeklyDue * originalWeeks
  weeksPaid: number;
  startDate: string;
  isOngoing?: boolean;
  history: HistoryEntry[];
  hasWhatsApp?: boolean; // true = smartphone with WhatsApp (default), false = keypad phone
  disableReceipt?: boolean; // true = lender disabled auto receipt for this borrower
  disableReminder?: boolean; // true = lender disabled 2-day reminder
}

export interface Village {
  id: string;
  name: string;
  day: DayOfWeek;
  routeOrder?: number;
}

export interface CollectionEntry {
  borrowerId: string;
  status: PaymentStatus;
  amtPaid: number;
  payMethod?: PaymentMethod;
  note?: string;
  extraAmt?: number;
  receiptSent?: boolean;
}

export interface BorrowerWhatsAppConfig {
  hasWhatsApp: boolean; // default true. If false -> keypad mobile
  disableReceipt?: boolean; // mute receipt for good payers
  disableReminder?: boolean; // mute 2-day reminder
}

export interface VillageWhatsAppConfig {
  disableReceipt?: boolean;
  disableReminder?: boolean;
}

export interface WhatsAppRules {
  masterEnabled: boolean; // default true
  autoReceiptOnPayment: boolean; // default true - immediately opens WhatsApp
  autoTwoDayReminder: boolean; // default true
  borrowerConfigs: Record<string, BorrowerWhatsAppConfig>;
  villageConfigs: Record<string, VillageWhatsAppConfig>;
}

export interface CollectionRecord {
  villageId: string;
  villageName: string;
  date: string; // YYYY-MM-DD
  entries: CollectionEntry[];
  totalExpected: number;
  totalCollected: number;
  newLoans: number;
  personalUse: number;
  savedAt: string;
}

export interface ExpenseItem {
  id: number;
  desc: string;
  amt: number;
  cat: "travel" | "food" | "rent" | "fuel" | "other";
  date: string;
}

export interface NewLoanLogItem {
  id: string;
  borrowerName: string;
  seqNo: string;
  villageName: string;
  villageId: string;
  loanAmt: number;
  date: string;
}

export interface PersonalUseItem {
  id: string;
  amt: number;
  note: string;
  date: string;
}

export interface PartnerConfig {
  name: string;
  sharePct: number; // e.g. 50%
  capitalInvested: number;
}

export interface WorkerConfig {
  name: string;
  phone: string;
  monthlySalary: number;
  dailyAllowance: number; // petrol + food
}

export type BusinessModelType = "partnership" | "owner_worker" | "sole_owner";

export type EmblemType =
  | "ganesha"
  | "lakshmi"
  | "venkateswara"
  | "shiva"
  | "cross"
  | "crescent"
  | "crown"
  | "tree";

export interface BusinessProfile {
  businessName: string;
  tagline: string;
  ownerName: string;
  phone: string;
  emblem?: EmblemType;
  brandColor?: string;
  modelType: BusinessModelType;
  partners: PartnerConfig[];
  workers: WorkerConfig[];
  subscriptionPlan: "trial" | "half_yearly" | "yearly" | "custom_app";
  trialEndsAt: string;
  licenseKey?: string;
}

export type Language = "en" | "te";
export type ThemeMode = "light" | "dark";
