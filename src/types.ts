export type DayOfWeek =
  | "Monday"
  | "Tuesday"
  | "Wednesday"
  | "Thursday"
  | "Friday"
  | "Saturday"
  | "Sunday";

export type RepaymentFrequency = "weekly" | "daily" | "monthly";
export type LoanEntryMode = "principal_interest" | "principal_total" | "total_only";

export type PaymentStatus = "paid" | "skip" | "short" | "extra";
export type PaymentMethod = "cash" | "phonepe" | "online";

export interface HistoryEntry {
  date: string; // YYYY-MM-DD
  status: PaymentStatus;
  amtPaid: number;
  note?: string;
  payMethod?: PaymentMethod;
  extraAmt?: number;
  isSettlement?: boolean;
  discountAmt?: number;
}

export interface PastLoanCycle {
  cycle: number;
  loanAmt: number;
  interestPct: number;
  durationWeeks: number;
  repaymentFreq: RepaymentFrequency;
  weeklyDue: number;
  totalReturn: number;
  totalPaid: number;
  startDate: string;
  closedDate: string;
  closureType: "completed" | "settled_early" | "renewed";
  settlementDiscount?: number;
  note?: string;
  history: HistoryEntry[];
}

export interface Borrower {
  id: string;
  seqNo: string; // Roll number e.g. "1", "12", "A-5"
  name: string;
  phone?: string;
  careOf?: string; // Father / Husband / Shop name
  guarantorName?: string;
  guarantorPhone?: string;
  loanAmt: number;
  durationWeeks: number; // default 12 for weekly, 60/100 for daily, 3/6/12 for monthly (+1 on skip/short)
  repaymentFreq?: RepaymentFrequency; // defaults to "weekly"
  interestPct: number; // e.g. 20
  weeklyDue: number; // installment amount per period
  totalReturn: number; // weeklyDue * original periods
  weeksPaid: number;
  startDate: string;
  isOngoing?: boolean;
  settledAt?: string; // YYYY-MM-DD if closed early
  settlementDiscount?: number;
  loanCycle?: number; // starts at 1
  loanHistory?: PastLoanCycle[];
  history: HistoryEntry[];
  hasWhatsApp?: boolean; // true = smartphone with WhatsApp (default), false = keypad phone
  disableReceipt?: boolean; // true = lender disabled auto receipt for this borrower
  disableReminder?: boolean; // true = lender disabled 2-day reminder
  photo?: string; // compressed base64 JPEG portrait thumbnail
  gender?: "male" | "female" | "other";
  age?: string;
  occupation?: string;
  address?: string;
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

export type SubscriptionPlanType =
  | "unsubscribed"
  | "trial"
  | "half_yearly"
  | "yearly"
  | "custom_app"
  | "lifetime_free";

export type SubscriptionStatusType =
  | "unsubscribed"
  | "active"
  | "expired"
  | "revoked"
  | "lifetime_free";

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
  subscriptionPlan: SubscriptionPlanType;
  subscriptionStatus?: SubscriptionStatusType;
  subscriptionExpiresAt?: string; // YYYY-MM-DD
  activatedAt?: string; // ISO timestamp
  activatedBy?: "activation_key" | "cloud_license" | "legacy_family" | "owner_admin";
  deviceId?: string;
  trialEndsAt: string;
  licenseKey?: string;
  lineDaysMode?: "specific" | "daily";
  lineDays?: DayOfWeek[];
  lineDaysConfigured?: boolean;
  enableDailyCashbook?: boolean;
  lineCycleWeeks?: number;
  loanEntryMode?: LoanEntryMode;
}

export interface CloudLicenseRecord {
  licenseId: string;
  deviceId: string;
  lenderEmail: string;
  businessName: string;
  plan: "half_yearly" | "yearly" | "custom_app" | "lifetime_free";
  status: "active" | "revoked";
  expiresAt: string; // YYYY-MM-DD
  activationKey: string;
  grantedBy: string;
}

export type Language = "en" | "te";
export type ThemeMode = "light" | "dark";

export type CashOpeningMap = Record<string, number>;

export interface CashbookVillageBreakdown {
  villageId: string;
  villageName: string;
  totalExpected: number;
  totalCollected: number;
  cashCollected: number;
  phonePeCollected: number;
  onlineCollected: number;
  entryCount: number;
}

export interface DailyCashbookSummary {
  date: string;
  openingCash: number;
  isOpeningExplicit: boolean;
  carriedFromDate?: string;
  cashCollected: number;
  phonePeCollected: number;
  onlineCollected: number;
  digitalCollected: number;
  totalCollected: number;
  newLoansTotal: number;
  expensesTotal: number;
  personalTotal: number;
  totalOutflows: number;
  closingCashInBag: number;
  villageBreakdowns: CashbookVillageBreakdown[];
}

