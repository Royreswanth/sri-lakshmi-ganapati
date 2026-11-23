import type {
  Borrower,
  CollectionEntry,
  HistoryEntry,
  CollectionRecord,
  PersonalUseItem,
  ExpenseItem,
  NewLoanLogItem,
  CashOpeningMap,
  DailyCashbookSummary,
  CashbookVillageBreakdown,
  RepaymentFrequency,
  PaymentMethod,
  PastLoanCycle,
  Language,
  Village,
  DayOfWeek,
} from "../types.ts";

/**
 * Microfinance Installment EMI formula (works for Weekly, Daily, Monthly):
 * due = ceil(loan * (1 + interestPct/100) / periods)
 */
export function calculateInstallmentDue(
  loanAmt: number,
  interestPct: number,
  durationPeriods: number
): number {
  if (!loanAmt || loanAmt <= 0) return 0;
  const periods = durationPeriods || 12;
  const total = loanAmt * (1 + (interestPct || 0) / 100);
  return Math.ceil(total / periods);
}

/**
 * Calculates installment EMI directly from Total Amount to Pay (without exposing Interest %):
 * due = ceil(totalPayable / periods)
 */
export function calculateInstallmentDueFromTotal(
  totalPayable: number,
  durationPeriods: number
): number {
  if (!totalPayable || totalPayable <= 0) return 0;
  const periods = Math.max(1, durationPeriods || 12);
  return Math.ceil(totalPayable / periods);
}

/**
 * Computes implied flat interest % silently from principal and total repayable amount.
 */
export function computeImpliedInterestPct(
  loanAmt: number,
  totalReturn: number
): number {
  if (!loanAmt || loanAmt <= 0 || !totalReturn || totalReturn <= loanAmt) return 0;
  return Number((((totalReturn - loanAmt) / loanAmt) * 100).toFixed(2));
}

export function calculateWeeklyDue(
  loanAmt: number,
  interestPct: number,
  durationWeeks: number
): number {
  return calculateInstallmentDue(loanAmt, interestPct, durationWeeks);
}

/**
 * Returns total repayable amount expected for the loan cycle.
 */
export function getBorrowerTotalReturn(borrower: Borrower): number {
  return (
    Number(borrower.totalReturn) ||
    (Number(borrower.weeklyDue) || 0) * (Number(borrower.durationWeeks) || 12)
  );
}

/**
 * Returns whether a borrower loan is closed:
 * - Settled early (settledAt is set), OR
 * - Total amount paid >= total return expected (remaining balance is ₹0),
 *   whether paid across regular weekly EMIs or completed early via Extra payments.
 * A borrower who reached durationWeeks count while still owing money stays ACTIVE until total paid reaches totalReturn.
 */
export function isBorrowerClosed(borrower: Borrower): boolean {
  if (borrower.settledAt) return true;
  const totalReturn = getBorrowerTotalReturn(borrower);
  if (totalReturn > 0) {
    return calculateTotalPaid(borrower) >= totalReturn;
  }
  return (borrower.weeksPaid || 0) >= (borrower.durationWeeks || 12);
}

const WEEKDAY_ORDER_SUN_START: DayOfWeek[] = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Returns how many calendar days have elapsed since the village's most recent scheduled line day (0..6):
 * 0 = scheduled day (today)
 * 1 = 1 day after scheduled day (e.g. Tuesday for a Monday village)
 * 2 = 2 days after scheduled day (e.g. Wednesday for a Monday village)
 * 3..6 = locked until the next scheduled line day (e.g. Thursday..Sunday for a Monday village)
 */
export function getDaysSinceScheduledDay(
  scheduledDay: DayOfWeek | string,
  currentDayName: DayOfWeek | string
): number {
  const schedIdx = WEEKDAY_ORDER_SUN_START.indexOf(scheduledDay as DayOfWeek);
  const curIdx = WEEKDAY_ORDER_SUN_START.indexOf(currentDayName as DayOfWeek);
  if (schedIdx === -1 || curIdx === -1) return -1;
  return (curIdx - schedIdx + 7) % 7;
}

export interface VillageCollectionAccess {
  allowed: boolean;
  isScheduledDay: boolean;
  isGraceModifyWindow: boolean;
  daysAfterScheduled: number;
  graceDaysRemaining: number;
  targetDateStr: string;
}

/**
 * Determines collection & post-collection edit access for a village on todayIsoDate:
 * - Day 0 (scheduled line day): Open for normal collection, targeting todayIsoDate.
 * - Days +1 and +2 (2-day PhonePe / late-payment grace window): Open to modify that scheduled day's collection sheet,
 *   targeting the exact scheduled line date (todayIsoDate - daysAfterScheduled).
 * - Days +3..+6 (before next scheduled day): Strictly locked.
 */
export function getVillageCollectionAccess(
  village: Pick<Village, "day"> | null | undefined,
  todayIsoDate: string,
  graceDaysAfter: number = 2
): VillageCollectionAccess {
  if (!village || !todayIsoDate) {
    return {
      allowed: false,
      isScheduledDay: false,
      isGraceModifyWindow: false,
      daysAfterScheduled: -1,
      graceDaysRemaining: 0,
      targetDateStr: todayIsoDate,
    };
  }
  const [y, m, d] = todayIsoDate.split("-").map(Number);
  const dt = y && m && d ? new Date(y, m - 1, d, 12, 0, 0) : new Date();
  const currentDayName = WEEKDAY_ORDER_SUN_START[dt.getDay()] || "Monday";
  const daysAfter = getDaysSinceScheduledDay(village.day, currentDayName);

  if (daysAfter === 0) {
    return {
      allowed: true,
      isScheduledDay: true,
      isGraceModifyWindow: false,
      daysAfterScheduled: 0,
      graceDaysRemaining: 0,
      targetDateStr: todayIsoDate,
    };
  }

  if (daysAfter > 0 && daysAfter <= graceDaysAfter) {
    return {
      allowed: true,
      isScheduledDay: false,
      isGraceModifyWindow: true,
      daysAfterScheduled: daysAfter,
      graceDaysRemaining: graceDaysAfter - daysAfter + 1,
      targetDateStr: addDaysToIso(todayIsoDate, -daysAfter),
    };
  }

  return {
    allowed: false,
    isScheduledDay: false,
    isGraceModifyWindow: false,
    daysAfterScheduled: daysAfter,
    graceDaysRemaining: 0,
    targetDateStr: todayIsoDate,
  };
}

/**
 * Line-day collection gating with post-collection modify grace allowance:
 * Collections for a village are open on its scheduled line day (day 0) plus up to `graceDaysAfter` days
 * immediately after (default 2 days for PhonePe / next-day updates), and locked on all other days.
 */
export function canCollectVillageOnDate(
  village: Pick<Village, "day"> | null | undefined,
  currentDayName: DayOfWeek | string,
  graceDaysAfter: number = 2
): boolean {
  if (!village || !currentDayName) return false;
  const daysAfter = getDaysSinceScheduledDay(village.day, currentDayName);
  return daysAfter >= 0 && daysAfter <= graceDaysAfter;
}

/**
 * Unit prefix for installment labels ("Wk", "Day", "Mo")
 */
export function getFrequencyShortPrefix(freq?: RepaymentFrequency): string {
  if (freq === "daily") return "Day";
  if (freq === "monthly") return "Mo";
  return "Wk";
}

export function getFrequencyLabel(
  freq: RepaymentFrequency | undefined,
  lang: Language = "en"
): string {
  if (freq === "daily") return lang === "te" ? "రోజువారీ (Daily)" : "Daily";
  if (freq === "monthly") return lang === "te" ? "నెలవారీ (Monthly)" : "Monthly";
  return lang === "te" ? "వారంవారీ (Weekly)" : "Weekly";
}

/**
 * Calculates total cash actually paid by a borrower so far (Fix D3)
 * Takes into account actual history entries (paid, short, extra, settlement) plus
 * any pre-app periods paid for ongoing loans.
 */
export function calculateTotalPaid(borrower: Borrower): number {
  const historyPaid = (borrower.history || []).reduce((sum, h) => {
    if (h.status === "skip") return sum;
    return sum + (Number(h.amtPaid) || 0);
  }, 0);

  let preAppPaid = 0;
  if (
    borrower.isOngoing &&
    !borrower.settledAt &&
    borrower.weeksPaid > (borrower.history || []).length
  ) {
    const prePeriods = borrower.weeksPaid - (borrower.history || []).length;
    preAppPaid = prePeriods * borrower.weeklyDue;
  }

  return historyPaid + preAppPaid;
}

/**
 * Accurate Remaining Balance (Fix D3 + Early Settlement support):
 * If settled early, remaining balance is 0.
 * Otherwise remaining = max(0, totalReturn - totalPaid).
 */
export function calculateRemainingBalance(borrower: Borrower): number {
  if (borrower.settledAt) return 0;
  const totalReturn =
    borrower.totalReturn || borrower.weeklyDue * (borrower.durationWeeks || 12);
  const paid = calculateTotalPaid(borrower);
  return Math.max(0, totalReturn - paid);
}

/**
 * Total unpaid short amounts across borrower history (0 once loan is completed or settled early)
 */
export function calculateTotalShortfall(borrower: Borrower): number {
  if (isBorrowerClosed(borrower)) return 0;
  return (borrower.history || [])
    .filter((h) => h.status === "short")
    .reduce((sum, h) => {
      const unpaid = Math.max(borrower.weeklyDue - (Number(h.amtPaid) || 0), 0);
      return sum + unpaid;
    }, 0);
}

/**
 * Total Outstanding Money in the Field across all active borrowers
 * (Fix D8: true circulating balance that borrowers still owe)
 */
export function calculateOutstandingInField(borrowers: Borrower[]): number {
  return borrowers
    .filter((b) => !isBorrowerClosed(b))
    .reduce((sum, b) => sum + calculateRemainingBalance(b), 0);
}

/**
 * Line Cash in Hand / Bag for today:
 * Collections today - Line expenses today - New loans issued today - Personal withdrawals today
 */
export function calculateTodayCashInBag(
  todayCollected: number,
  todayExpenses: number,
  todayNewLoans: number,
  todayPersonal: number
): number {
  return Math.max(0, todayCollected - todayExpenses - todayNewLoans - todayPersonal);
}

/**
 * Total personal use withdrawals across both personal log and legacy collection records (Fix D6)
 */
export function calculateTotalPersonalUse(
  personalLog: PersonalUseItem[],
  collections: Record<string, CollectionRecord>
): number {
  const logTotal = (personalLog || []).reduce((s, p) => s + (Number(p.amt) || 0), 0);
  const colsTotal = Object.values(collections || {}).reduce(
    (s, c) => s + (Number(c.personalUse) || 0),
    0
  );
  return Math.max(logTotal, colsTotal);
}

/**
 * Net Line Cash Surplus (Fix D6 & D8)
 * Total Collected - Total Line Expenses - Total Personal Use
 */
export function calculateNetProfit(
  totalCollected: number,
  totalExpenses: number,
  totalPersonal: number
): number {
  return totalCollected - totalExpenses - totalPersonal;
}

/**
 * Settle an active loan early (with optional discount on remaining balance)
 */
export function settleBorrowerEarly(
  borrower: Borrower,
  settledAmt: number,
  discountAmt: number,
  settleDate: string,
  note: string = "",
  payMethod: PaymentMethod = "cash"
): Borrower {
  const cleanPaid = Math.max(0, Math.round(Number(settledAmt) || 0));
  const cleanDiscount = Math.max(0, Math.round(Number(discountAmt) || 0));

  const settlementEntry: HistoryEntry = {
    date: settleDate,
    status: "paid",
    amtPaid: cleanPaid,
    payMethod,
    isSettlement: true,
    discountAmt: cleanDiscount,
    note:
      note.trim() ||
      (cleanDiscount > 0
        ? `Early Settlement (Discount ₹${cleanDiscount})`
        : "Early Settlement"),
  };

  return {
    ...borrower,
    settledAt: settleDate,
    settlementDiscount: cleanDiscount,
    weeksPaid: Math.max(borrower.weeksPaid || 0, borrower.durationWeeks || 12),
    history: [...(borrower.history || []), settlementEntry],
  };
}

export interface RenewLoanTerms {
  loanAmt: number;
  interestPct?: number;
  totalReturn?: number;
  durationWeeks: number;
  repaymentFreq: RepaymentFrequency;
  weeklyDue?: number;
  isOngoing?: boolean;
  weeksPaid?: number;
  careOf?: string;
  guarantorName?: string;
  guarantorPhone?: string;
  startDate?: string;
}

/**
 * Renew / Top-Up a borrower loan while preserving previous cycle history
 */
export function renewBorrowerLoan(
  borrower: Borrower,
  terms: RenewLoanTerms,
  renewDate: string
): Borrower {
  const currentCycleNum = borrower.loanCycle || 1;
  const totalPaidPrev = calculateTotalPaid(borrower);
  const closureType: PastLoanCycle["closureType"] = borrower.settledAt
    ? "settled_early"
    : isBorrowerClosed(borrower)
    ? "completed"
    : "renewed";

  const archivedCycle: PastLoanCycle = {
    cycle: currentCycleNum,
    loanAmt: borrower.loanAmt,
    interestPct: borrower.interestPct,
    durationWeeks: borrower.durationWeeks || 12,
    repaymentFreq: borrower.repaymentFreq || "weekly",
    weeklyDue: borrower.weeklyDue,
    totalReturn: borrower.totalReturn || borrower.weeklyDue * (borrower.durationWeeks || 12),
    totalPaid: totalPaidPrev,
    startDate: borrower.startDate,
    closedDate: borrower.settledAt || renewDate,
    closureType,
    settlementDiscount: borrower.settlementDiscount,
    history: borrower.history || [],
  };

  const nextDuration = Math.max(1, Math.round(terms.durationWeeks || 12));
  const hasExplicitTotal = typeof terms.totalReturn === "number" && terms.totalReturn > 0;
  const nextDue =
    terms.weeklyDue && terms.weeklyDue > 0
      ? Math.round(terms.weeklyDue)
      : hasExplicitTotal
      ? calculateInstallmentDueFromTotal(terms.totalReturn!, nextDuration)
      : calculateInstallmentDue(terms.loanAmt, terms.interestPct || 0, nextDuration);
  const nextTotalReturn =
    terms.weeklyDue && terms.weeklyDue > 0
      ? nextDue * nextDuration
      : hasExplicitTotal
      ? Math.round(terms.totalReturn!)
      : nextDue * nextDuration;
  const nextInterestPct =
    typeof terms.interestPct === "number"
      ? Number(terms.interestPct) || 0
      : computeImpliedInterestPct(terms.loanAmt, nextTotalReturn);

  return {
    ...borrower,
    careOf: terms.careOf !== undefined ? terms.careOf : borrower.careOf,
    guarantorName:
      terms.guarantorName !== undefined ? terms.guarantorName : borrower.guarantorName,
    guarantorPhone:
      terms.guarantorPhone !== undefined ? terms.guarantorPhone : borrower.guarantorPhone,
    loanAmt: Math.round(terms.loanAmt),
    interestPct: nextInterestPct,
    durationWeeks: nextDuration,
    repaymentFreq: terms.repaymentFreq || "weekly",
    weeklyDue: nextDue,
    totalReturn: nextTotalReturn,
    weeksPaid: terms.isOngoing ? Math.max(0, Math.round(terms.weeksPaid || 0)) : 0,
    isOngoing: Boolean(terms.isOngoing),
    startDate: terms.startDate || renewDate,
    settledAt: undefined,
    settlementDiscount: undefined,
    loanCycle: currentCycleNum + 1,
    loanHistory: [...(borrower.loanHistory || []), archivedCycle],
    history: [],
  };
}

/**
 * Commercial Loan Interest Calculator engine
 */
export interface LoanCalculationInput {
  principal: number;
  rateValue: number; // either flat % OR ₹ per 100 monthly
  rateMode: "flat_pct" | "per_100_monthly";
  periods: number;
  freq: RepaymentFrequency;
  deductUpfront: boolean;
  customInstallment?: number;
}

export interface LoanCalculationResult {
  principal: number;
  cashHandedOut: number;
  interestAmount: number;
  effectiveFlatPct: number;
  installmentDue: number;
  totalRepayable: number;
  netProfit: number;
  roiPct: number;
  annualizedAprPct: number;
}

export function calculateLoanBreakdown(input: LoanCalculationInput): LoanCalculationResult {
  const principal = Math.max(0, Number(input.principal) || 0);
  const periods = Math.max(1, Math.round(Number(input.periods) || 1));
  const rateVal = Math.max(0, Number(input.rateValue) || 0);

  let effectiveFlatPct = rateVal;
  if (input.rateMode === "per_100_monthly") {
    const monthsApprox =
      input.freq === "monthly"
        ? periods
        : input.freq === "weekly"
        ? periods / 4
        : periods / 30;
    effectiveFlatPct = Number((rateVal * monthsApprox).toFixed(2));
  }

  const rawInterest = Math.round(principal * (effectiveFlatPct / 100));

  let cashHandedOut = principal;
  let baseRepayable = principal + rawInterest;
  if (input.deductUpfront) {
    cashHandedOut = Math.max(0, principal - rawInterest);
    baseRepayable = principal;
  }

  const autoInstallment = principal > 0 ? Math.ceil(baseRepayable / periods) : 0;
  const installmentDue =
    input.customInstallment && input.customInstallment > 0
      ? Math.round(input.customInstallment)
      : autoInstallment;

  const totalRepayable = installmentDue * periods;
  const netProfit = totalRepayable - cashHandedOut;
  const roiPct =
    cashHandedOut > 0 ? Number(((netProfit / cashHandedOut) * 100).toFixed(1)) : 0;

  const yearsDuration =
    input.freq === "daily"
      ? periods / 365
      : input.freq === "weekly"
      ? periods / 52
      : periods / 12;
  const annualizedAprPct =
    yearsDuration > 0 && cashHandedOut > 0
      ? Number(((roiPct / yearsDuration)).toFixed(1))
      : 0;

  return {
    principal,
    cashHandedOut,
    interestAmount: rawInterest,
    effectiveFlatPct,
    installmentDue,
    totalRepayable,
    netProfit,
    roiPct,
    annualizedAprPct,
  };
}

export interface SchedulePreviewRow {
  installmentNumber: number;
  dueDate: string;
  amount: number;
  cumulativePaid: number;
  remainingAfter: number;
}

export function buildLoanSchedulePreview(
  startDateStr: string,
  periods: number,
  freq: RepaymentFrequency,
  installmentDue: number,
  totalRepayable: number
): SchedulePreviewRow[] {
  const [y, m, d] = startDateStr.split("-").map(Number);
  const base = y && m && d ? new Date(y, m - 1, d, 12, 0, 0) : new Date();
  const count = Math.min(Math.max(1, Math.round(periods)), 120);
  const rows: SchedulePreviewRow[] = [];

  for (let i = 1; i <= count; i++) {
    const dt = new Date(base);
    if (freq === "daily") {
      dt.setDate(base.getDate() + i);
    } else if (freq === "monthly") {
      dt.setMonth(base.getMonth() + i);
    } else {
      dt.setDate(base.getDate() + i * 7);
    }
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate()
    ).padStart(2, "0")}`;
    const cumulativePaid = installmentDue * i;
    rows.push({
      installmentNumber: i,
      dueDate: iso,
      amount: installmentDue,
      cumulativePaid,
      remainingAfter: Math.max(0, totalRepayable - cumulativePaid),
    });
  }
  return rows;
}

/**
 * Idempotent Collection Updater (Fix D5 & D4):
 * Updates borrower period counts and history idempotently when saving collections
 * on the same calendar day.
 */
export function applyCollectionEntriesIdempotently(
  borrowers: Borrower[],
  entries: Record<string, CollectionEntry>,
  todayDateStr: string
): Borrower[] {
  return borrowers.map((b) => {
    const e = entries[b.id];
    const prevTodayEntry = (b.history || []).find((h) => h.date === todayDateStr);

    if (!e && !prevTodayEntry) {
      return b;
    }

    let wPaid = b.weeksPaid;
    let dWeeks = b.durationWeeks || 12;

    if (prevTodayEntry) {
      if (prevTodayEntry.status === "paid") {
        wPaid -= 1;
      } else if (prevTodayEntry.status === "skip") {
        dWeeks -= 1;
      } else if (prevTodayEntry.status === "short") {
        wPaid -= 1;
        dWeeks -= 1;
      } else if (prevTodayEntry.status === "extra") {
        wPaid -= 1;
      }
    }

    const cleanHistory = (b.history || []).filter((h) => h.date !== todayDateStr);

    if (!e) {
      return {
        ...b,
        weeksPaid: Math.max(0, wPaid),
        durationWeeks: Math.max(1, dWeeks),
        history: cleanHistory,
      };
    }

    const newHistEntry: HistoryEntry = {
      date: todayDateStr,
      status: e.status,
      amtPaid: Number(e.amtPaid) || 0,
      note: e.note || "",
      payMethod: e.payMethod || "cash",
      extraAmt: e.extraAmt ? Number(e.extraAmt) : undefined,
    };

    if (e.status === "paid") {
      wPaid += 1;
    } else if (e.status === "skip") {
      dWeeks += 1;
    } else if (e.status === "short") {
      wPaid += 1;
      dWeeks += 1;
    } else if (e.status === "extra") {
      wPaid += 1;
    }

    return {
      ...b,
      weeksPaid: Math.max(0, wPaid),
      durationWeeks: Math.max(1, dWeeks),
      history: [...cleanHistory, newHistEntry],
    };
  });
}

export interface CashbookDataSources {
  collections: Record<string, CollectionRecord>;
  expenses: ExpenseItem[];
  newLoansLog: NewLoanLogItem[];
  personalLog: PersonalUseItem[];
  openingBalances?: CashOpeningMap;
}

/**
 * Returns sorted descending list of all unique YYYY-MM-DD dates with cashbook activity
 */
export function getAllCashbookDates(
  sources: CashbookDataSources,
  extraDates: string[] = []
): string[] {
  const set = new Set<string>(extraDates.filter(Boolean));
  Object.values(sources.collections || {}).forEach((c) => c.date && set.add(c.date));
  (sources.expenses || []).forEach((e) => e.date && set.add(e.date));
  (sources.newLoansLog || []).forEach((l) => l.date && set.add(l.date));
  (sources.personalLog || []).forEach((p) => p.date && set.add(p.date));
  Object.keys(sources.openingBalances || {}).forEach((d) => d && set.add(d));
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

interface DayFlowTotals {
  cashCollected: number;
  phonePeCollected: number;
  onlineCollected: number;
  totalCollected: number;
  newLoansTotal: number;
  expensesTotal: number;
  personalTotal: number;
  villageBreakdowns: CashbookVillageBreakdown[];
}

function computeRawDayFlows(dateStr: string, sources: CashbookDataSources): DayFlowTotals {
  const dayCollections = Object.values(sources.collections || {}).filter(
    (c) => c.date === dateStr
  );

  let cashCollected = 0;
  let phonePeCollected = 0;
  let onlineCollected = 0;
  let totalCollected = 0;

  const villageBreakdowns: CashbookVillageBreakdown[] = dayCollections.map((col) => {
    const entries = col.entries || [];
    let vCash = 0;
    let vPhonePe = 0;
    let vOnline = 0;

    if (entries.length > 0) {
      for (const e of entries) {
        if (e.status === "skip") continue;
        const amt = Number(e.amtPaid) || 0;
        if (amt <= 0) continue;
        if (e.payMethod === "phonepe") {
          vPhonePe += amt;
        } else if (e.payMethod === "online") {
          vOnline += amt;
        } else {
          vCash += amt;
        }
      }
    } else if ((col.totalCollected || 0) > 0) {
      vCash = Number(col.totalCollected) || 0;
    }

    const colSum = vCash + vPhonePe + vOnline;
    cashCollected += vCash;
    phonePeCollected += vPhonePe;
    onlineCollected += vOnline;
    totalCollected += colSum > 0 ? colSum : Number(col.totalCollected) || 0;

    return {
      villageId: col.villageId,
      villageName: col.villageName,
      totalExpected: Number(col.totalExpected) || 0,
      totalCollected: colSum > 0 ? colSum : Number(col.totalCollected) || 0,
      cashCollected: vCash,
      phonePeCollected: vPhonePe,
      onlineCollected: vOnline,
      entryCount: entries.length,
    };
  });

  const newLoansTotal = (sources.newLoansLog || [])
    .filter((l) => l.date === dateStr)
    .reduce((sum, l) => sum + (Number(l.loanAmt) || 0), 0);

  const expensesTotal = (sources.expenses || [])
    .filter((e) => e.date === dateStr)
    .reduce((sum, e) => sum + (Number(e.amt) || 0), 0);

  const personalLogDay = (sources.personalLog || [])
    .filter((p) => p.date === dateStr)
    .reduce((sum, p) => sum + (Number(p.amt) || 0), 0);

  const legacyColPersonal = dayCollections.reduce(
    (sum, c) => sum + (Number(c.personalUse) || 0),
    0
  );
  const personalTotal = Math.max(personalLogDay, legacyColPersonal);

  return {
    cashCollected,
    phonePeCollected,
    onlineCollected,
    totalCollected,
    newLoansTotal,
    expensesTotal,
    personalTotal,
    villageBreakdowns,
  };
}

/**
 * Resolves explicit or carried-forward Opening Bag Cash for a given date.
 * If an explicit opening balance exists for dateStr, returns it directly.
 * Otherwise carries forward physical bag cash from the latest earlier explicit opening balance date.
 */
export function resolveOpeningCashForDate(
  dateStr: string,
  sources: CashbookDataSources
): { openingCash: number; isOpeningExplicit: boolean; carriedFromDate?: string } {
  const openings = sources.openingBalances || {};
  if (typeof openings[dateStr] === "number" && Number.isFinite(openings[dateStr])) {
    return { openingCash: openings[dateStr], isOpeningExplicit: true };
  }

  const priorOpeningDates = Object.keys(openings)
    .filter(
      (d) => d < dateStr && typeof openings[d] === "number" && Number.isFinite(openings[d])
    )
    .sort((a, b) => b.localeCompare(a));

  if (priorOpeningDates.length === 0) {
    return { openingCash: 0, isOpeningExplicit: false };
  }

  const anchorDate = priorOpeningDates[0];
  const allDatesAsc = getAllCashbookDates(sources, [anchorDate, dateStr]).sort((a, b) =>
    a.localeCompare(b)
  );

  let runningBag = openings[anchorDate];
  for (const d of allDatesAsc) {
    if (d < anchorDate || d >= dateStr) continue;
    const flows = computeRawDayFlows(d, sources);
    runningBag =
      runningBag +
      flows.cashCollected -
      (flows.newLoansTotal + flows.expensesTotal + flows.personalTotal);
  }

  return {
    openingCash: runningBag,
    isOpeningExplicit: false,
    carriedFromDate: anchorDate,
  };
}

/**
 * Computes full Daily Cashbook reconciliation for a single date:
 * Closing Cash in Bag = Opening Bag Cash + Physical Cash Collected - (New Loans + Expenses + Personal Drawings)
 * Digital collections (PhonePe + Online) are tracked cleanly beside Cash Collected so bank/UPI transfers do not inflate physical bag cash.
 */
export function calculateDailyCashbook(
  dateStr: string,
  sources: CashbookDataSources
): DailyCashbookSummary {
  const flows = computeRawDayFlows(dateStr, sources);
  const openingInfo = resolveOpeningCashForDate(dateStr, sources);
  const totalOutflows =
    flows.newLoansTotal + flows.expensesTotal + flows.personalTotal;
  const closingCashInBag =
    openingInfo.openingCash + flows.cashCollected - totalOutflows;

  return {
    date: dateStr,
    openingCash: openingInfo.openingCash,
    isOpeningExplicit: openingInfo.isOpeningExplicit,
    carriedFromDate: openingInfo.carriedFromDate,
    cashCollected: flows.cashCollected,
    phonePeCollected: flows.phonePeCollected,
    onlineCollected: flows.onlineCollected,
    digitalCollected: flows.phonePeCollected + flows.onlineCollected,
    totalCollected: flows.totalCollected,
    newLoansTotal: flows.newLoansTotal,
    expensesTotal: flows.expensesTotal,
    personalTotal: flows.personalTotal,
    totalOutflows,
    closingCashInBag,
    villageBreakdowns: flows.villageBreakdowns,
  };
}

function addDaysToIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d + days, 12, 0, 0);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

function addMonthsToIso(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1 + months, d, 12, 0, 0);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

function stepPeriodIso(baseIso: string, periodOffset: number, freq: RepaymentFrequency): string {
  if (freq === "daily") return addDaysToIso(baseIso, periodOffset);
  if (freq === "monthly") return addMonthsToIso(baseIso, periodOffset);
  return addDaysToIso(baseIso, periodOffset * 7);
}

function mondayOfIsoWeek(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  const day = dt.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  dt.setDate(dt.getDate() + diff);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
    dt.getDate()
  ).padStart(2, "0")}`;
}

function daysBetweenIso(earlierIso: string, laterIso: string): number {
  const [y1, m1, d1] = earlierIso.split("-").map(Number);
  const [y2, m2, d2] = laterIso.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 0;
  const t1 = Date.UTC(y1, m1 - 1, d1);
  const t2 = Date.UTC(y2, m2 - 1, d2);
  return Math.round((t2 - t1) / 86400000);
}

export interface AutoHomeTakenEvent {
  date: string;
  sourceCollectionDate: string;
  amount: number;
}

export interface LineCashStatusResult {
  lineCashInHand: number;
  autoHomeTakenTotal: number;
  autoHomeTakenEvents: AutoHomeTakenEvent[];
  manualPersonalTotal: number;
  totalTakenCash: number;
  lastCollectionDate: string | null;
  daysSinceLastCollection: number | null;
}

/**
 * Tracks live physical Line Cash in Hand across collection days:
 * - Collected cash stays in Line Cash in Hand (not reset to 0 at midnight).
 * - Giving a new loan, recording expenses, or taking personal cash reduces Line Cash in Hand.
 * - If 2 days pass after collection with NO new loan given, any remaining Line Cash in Hand
 *   is automatically recognized as "Auto Home Taken" for the lender's personal use.
 */
export function calculateLineCashStatus(params: {
  collections: Record<string, CollectionRecord>;
  newLoansLog: NewLoanLogItem[];
  expenses: ExpenseItem[];
  personalLog: PersonalUseItem[];
  todayStr: string;
}): LineCashStatusResult {
  const { collections, newLoansLog, expenses, personalLog, todayStr } = params;
  const sources: CashbookDataSources = {
    collections: collections || {},
    newLoansLog: newLoansLog || [],
    expenses: expenses || [],
    personalLog: personalLog || [],
  };

  const datesAsc = getAllCashbookDates(sources)
    .filter((d) => !todayStr || d <= todayStr)
    .sort((a, b) => a.localeCompare(b));

  let bagCash = 0;
  let lastCollectionDate: string | null = null;
  let newLoanGivenSinceLastCollection = false;
  let autoHomeTakenTotal = 0;
  const autoHomeTakenEvents: AutoHomeTakenEvent[] = [];

  for (const d of datesAsc) {
    if (bagCash > 0 && lastCollectionDate && !newLoanGivenSinceLastCollection) {
      const cutoffDate = addDaysToIso(lastCollectionDate, 2);
      if (d > cutoffDate) {
        autoHomeTakenTotal += bagCash;
        autoHomeTakenEvents.push({
          date: cutoffDate,
          sourceCollectionDate: lastCollectionDate,
          amount: bagCash,
        });
        bagCash = 0;
      }
    }

    const flows = computeRawDayFlows(d, sources);

    if (flows.cashCollected > 0) {
      bagCash += flows.cashCollected;
      lastCollectionDate = d;
      newLoanGivenSinceLastCollection = false;
    }

    if (flows.newLoansTotal > 0 && lastCollectionDate) {
      newLoanGivenSinceLastCollection = true;
    }

    const outflows = flows.newLoansTotal + flows.expensesTotal + flows.personalTotal;
    bagCash = Math.max(0, bagCash - outflows);
  }

  if (
    todayStr &&
    bagCash > 0 &&
    lastCollectionDate &&
    !newLoanGivenSinceLastCollection
  ) {
    const cutoffDate = addDaysToIso(lastCollectionDate, 2);
    if (todayStr >= cutoffDate) {
      autoHomeTakenTotal += bagCash;
      autoHomeTakenEvents.push({
        date: cutoffDate,
        sourceCollectionDate: lastCollectionDate,
        amount: bagCash,
      });
      bagCash = 0;
    }
  }

  const manualPersonalTotal = calculateTotalPersonalUse(personalLog || [], collections || {});
  const totalTakenCash = manualPersonalTotal + autoHomeTakenTotal;
  const daysSinceLastCollection =
    lastCollectionDate && todayStr ? daysBetweenIso(lastCollectionDate, todayStr) : null;

  return {
    lineCashInHand: bagCash,
    autoHomeTakenTotal,
    autoHomeTakenEvents,
    manualPersonalTotal,
    totalTakenCash,
    lastCollectionDate,
    daysSinceLastCollection,
  };
}

export type CompletedWeekItemStatus =
  | "completed_pre"
  | "paid"
  | "extra"
  | "short"
  | "skip"
  | "settled"
  | "due_today"
  | "overdue"
  | "upcoming";

export interface CompletedWeekItem {
  periodNumber: number;
  date: string;
  status: CompletedWeekItemStatus;
  amtPaid: number;
  payMethod?: PaymentMethod;
  note?: string;
}

export interface LoanCompletedWeeksSummary {
  startDate: string;
  expectedEndDate: string;
  freq: RepaymentFrequency;
  totalPeriods: number;
  completedPeriods: number;
  remainingPeriods: number;
  skippedCount: number;
  shortCount: number;
  items: CompletedWeekItem[];
}

/**
 * Builds a complete week/period timeline from loan start date,
 * highlighting completed pre-app periods, recorded payment dates, skips/shorts,
 * and remaining projected dates up to expected completion.
 */
export function buildLoanCompletedWeeksSummary(
  borrower: Borrower,
  todayStr: string
): LoanCompletedWeeksSummary {
  const freq: RepaymentFrequency = borrower.repaymentFreq || "weekly";
  const startDate = borrower.startDate || todayStr;
  const totalPeriods = Math.max(1, borrower.durationWeeks || 12);
  const completedPeriods = Math.max(0, borrower.weeksPaid || 0);
  const sortedHistory = [...(borrower.history || [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const nonSkipHistCount = sortedHistory.filter((h) => h.status !== "skip").length;
  const preAppCompleted = borrower.isOngoing
    ? Math.max(0, completedPeriods - nonSkipHistCount)
    : 0;

  const items: CompletedWeekItem[] = [];

  for (let i = 1; i <= preAppCompleted; i++) {
    items.push({
      periodNumber: i,
      date: stepPeriodIso(startDate, i, freq),
      status: "completed_pre",
      amtPaid: borrower.weeklyDue,
    });
  }

  for (const h of sortedHistory) {
    items.push({
      periodNumber: items.length + 1,
      date: h.date,
      status: h.isSettlement ? "settled" : h.status,
      amtPaid: Number(h.amtPaid) || 0,
      payMethod: h.payMethod,
      note: h.note,
    });
  }

  const closed = isBorrowerClosed(borrower);
  const remainingPeriods = closed ? 0 : Math.max(0, totalPeriods - completedPeriods);
  const lastDate = items.length > 0 ? items[items.length - 1].date : startDate;

  for (let r = 1; r <= remainingPeriods; r++) {
    const dueDate = stepPeriodIso(lastDate, r, freq);
    const status: CompletedWeekItemStatus =
      todayStr && dueDate === todayStr
        ? "due_today"
        : todayStr && dueDate < todayStr
        ? "overdue"
        : "upcoming";
    items.push({
      periodNumber: items.length + 1,
      date: dueDate,
      status,
      amtPaid: 0,
    });
  }

  const expectedEndDate =
    items.length > 0
      ? items[items.length - 1].date
      : stepPeriodIso(startDate, totalPeriods, freq);

  return {
    startDate,
    expectedEndDate,
    freq,
    totalPeriods,
    completedPeriods,
    remainingPeriods,
    skippedCount: sortedHistory.filter((h) => h.status === "skip").length,
    shortCount: sortedHistory.filter((h) => h.status === "short").length,
    items,
  };
}

export interface RecordBookPeriodRow {
  key: string;
  startDate: string;
  endDate: string;
  expected: number;
  collected: number;
  cashCollected: number;
  digitalCollected: number;
  shortage: number;
  newLoansCount: number;
  givenNewLoans: number;
  manualTakenCash: number;
  autoHomeTakenCash: number;
  takenCash: number;
  expenses: number;
  netBalance: number;
  visitsCount: number;
}

export interface RecordBookCycleRow {
  borrowerId: string;
  seqNo: string;
  borrowerName: string;
  villageId: string;
  villageName: string;
  cycleNumber: number;
  startDate: string;
  endDate?: string;
  status: "active" | "completed" | "settled_early" | "renewed";
  givenPrincipal: number;
  expectedReturn: number;
  collected: number;
  shortage: number;
  remainingBalance: number;
  weeksPaid: number;
  totalWeeks: number;
}

export interface RecordBookOverallTotals {
  expected: number;
  collected: number;
  cashCollected: number;
  digitalCollected: number;
  shortage: number;
  newLoansCount: number;
  givenNewLoans: number;
  manualTakenCash: number;
  autoHomeTakenCash: number;
  takenCash: number;
  expenses: number;
  netBalance: number;
  lineCashInHand: number;
  outstandingInField: number;
  activeLoansCount: number;
  closedLoansCount: number;
}

export interface RecordBookLineCycleRow extends RecordBookPeriodRow {
  cycleNumber: number;
  cycleWeeks: number;
  approxMonths: number;
}

export interface RecordBookReport {
  weeklyRows: RecordBookPeriodRow[];
  monthlyRows: RecordBookPeriodRow[];
  cyclePeriodRows: RecordBookLineCycleRow[];
  cycleRows: RecordBookCycleRow[];
  cycleWeeks: number;
  cycleApproxMonths: number;
  overallTotals: RecordBookOverallTotals;
}

export function getApproxCycleMonths(weeks: number): number {
  const clean = Math.max(1, Math.round(weeks));
  if (clean >= 24 && clean <= 26) return 6;
  if (clean >= 12 && clean <= 13) return 3;
  if (clean >= 50 && clean <= 53) return 12;
  return Math.max(1, Math.round(clean / 4.2));
}

/**
 * Generates Weekly, Monthly, and Cycle Record Book statements covering:
 * Collected, Given (New Loans), Shortage, Taken Cash (Manual + Auto 2-Day Home Taken),
 * Expenses, and Net Balance.
 * Cycle groups all line activity into fixed N-week cycles (e.g. 12 weeks = 3 months, 25 weeks = 6 months).
 */
export function buildRecordBookReport(params: {
  villages: Village[];
  borrowers: Record<string, Borrower[]>;
  collections: Record<string, CollectionRecord>;
  expenses: ExpenseItem[];
  newLoansLog: NewLoanLogItem[];
  personalLog: PersonalUseItem[];
  todayStr: string;
  cycleWeeks?: number;
}): RecordBookReport {
  const { villages, borrowers, collections, expenses, newLoansLog, personalLog, todayStr } = params;

  const cashStatus = calculateLineCashStatus({
    collections,
    newLoansLog,
    expenses,
    personalLog,
    todayStr,
  });

  const sources: CashbookDataSources = {
    collections: collections || {},
    expenses: expenses || [],
    newLoansLog: newLoansLog || [],
    personalLog: personalLog || [],
  };

  const allActivityDates = new Set<string>(getAllCashbookDates(sources));
  cashStatus.autoHomeTakenEvents.forEach((ev) => ev.date && allActivityDates.add(ev.date));

  const buildPeriodBucket = (key: string, startDate: string, endDate: string): RecordBookPeriodRow => ({
    key,
    startDate,
    endDate,
    expected: 0,
    collected: 0,
    cashCollected: 0,
    digitalCollected: 0,
    shortage: 0,
    newLoansCount: 0,
    givenNewLoans: 0,
    manualTakenCash: 0,
    autoHomeTakenCash: 0,
    takenCash: 0,
    expenses: 0,
    netBalance: 0,
    visitsCount: 0,
  });

  const weeklyMap = new Map<string, RecordBookPeriodRow>();
  const monthlyMap = new Map<string, RecordBookPeriodRow>();

  const ensureWeekBucket = (dateStr: string) => {
    const mon = mondayOfIsoWeek(dateStr);
    const sun = addDaysToIso(mon, 6);
    let row = weeklyMap.get(mon);
    if (!row) {
      row = buildPeriodBucket(mon, mon, sun);
      weeklyMap.set(mon, row);
    }
    return row;
  };

  const ensureMonthBucket = (dateStr: string) => {
    const ym = dateStr.slice(0, 7);
    let row = monthlyMap.get(ym);
    if (!row) {
      const [y, m] = ym.split("-").map(Number);
      const lastDay = y && m ? new Date(y, m, 0).getDate() : 30;
      row = buildPeriodBucket(ym, `${ym}-01`, `${ym}-${String(lastDay).padStart(2, "0")}`);
      monthlyMap.set(ym, row);
    }
    return row;
  };

  for (const d of allActivityDates) {
    if (!d) continue;
    const flows = computeRawDayFlows(d, sources);
    const dayCols = Object.values(collections || {}).filter((c) => c.date === d);
    const dayExpected = dayCols.reduce((s, c) => s + (Number(c.totalExpected) || 0), 0);
    const dayShortage = dayCols.reduce(
      (s, c) => s + Math.max(0, (Number(c.totalExpected) || 0) - (Number(c.totalCollected) || 0)),
      0
    );
    const dayNewLoanCount = (newLoansLog || []).filter((l) => l.date === d).length;
    const dayAutoTaken = cashStatus.autoHomeTakenEvents
      .filter((ev) => ev.date === d)
      .reduce((s, ev) => s + ev.amount, 0);

    const targets = [ensureWeekBucket(d), ensureMonthBucket(d)];
    for (const bucket of targets) {
      bucket.expected += dayExpected;
      bucket.collected += flows.totalCollected;
      bucket.cashCollected += flows.cashCollected;
      bucket.digitalCollected += flows.phonePeCollected + flows.onlineCollected;
      bucket.shortage += dayShortage;
      bucket.newLoansCount += dayNewLoanCount;
      bucket.givenNewLoans += flows.newLoansTotal;
      bucket.manualTakenCash += flows.personalTotal;
      bucket.autoHomeTakenCash += dayAutoTaken;
      bucket.takenCash += flows.personalTotal + dayAutoTaken;
      bucket.expenses += flows.expensesTotal;
      bucket.visitsCount += dayCols.length;
      bucket.netBalance =
        bucket.collected - bucket.givenNewLoans - bucket.expenses - bucket.takenCash;
    }
  }

  const weeklyRows = Array.from(weeklyMap.values()).sort((a, b) => b.key.localeCompare(a.key));
  const monthlyRows = Array.from(monthlyMap.values()).sort((a, b) => b.key.localeCompare(a.key));

  // Build period-by-period Line Cycle statements (e.g., 12 weeks = 3 months, 25 weeks = 6 months)
  const resolvedCycleWeeks = Math.max(1, Math.round(params.cycleWeeks || 12));
  const cycleApproxMonths = getApproxCycleMonths(resolvedCycleWeeks);
  const sortedDatesAsc = Array.from(allActivityDates).filter(Boolean).sort((a, b) => a.localeCompare(b));
  const cyclePeriodMap = new Map<number, RecordBookLineCycleRow>();

  if (sortedDatesAsc.length > 0) {
    const anchorMonday = mondayOfIsoWeek(sortedDatesAsc[0]);
    const cycleDays = resolvedCycleWeeks * 7;

    const ensureCycleBucket = (dateStr: string): RecordBookLineCycleRow => {
      const diff = Math.max(0, daysBetweenIso(anchorMonday, dateStr));
      const cycleIdx = Math.floor(diff / cycleDays);
      const cycleNum = cycleIdx + 1;
      let existing = cyclePeriodMap.get(cycleNum);
      if (!existing) {
        const startDate = addDaysToIso(anchorMonday, cycleIdx * cycleDays);
        const endDate = addDaysToIso(startDate, cycleDays - 1);
        existing = {
          ...buildPeriodBucket(`Cycle #${cycleNum}`, startDate, endDate),
          cycleNumber: cycleNum,
          cycleWeeks: resolvedCycleWeeks,
          approxMonths: cycleApproxMonths,
        };
        cyclePeriodMap.set(cycleNum, existing);
      }
      return existing;
    };

    for (const d of sortedDatesAsc) {
      const flows = computeRawDayFlows(d, sources);
      const dayCols = Object.values(collections || {}).filter((c) => c.date === d);
      const dayExpected = dayCols.reduce((s, c) => s + (Number(c.totalExpected) || 0), 0);
      const dayShortage = dayCols.reduce(
        (s, c) => s + Math.max(0, (Number(c.totalExpected) || 0) - (Number(c.totalCollected) || 0)),
        0
      );
      const dayNewLoanCount = (newLoansLog || []).filter((l) => l.date === d).length;
      const dayAutoTaken = cashStatus.autoHomeTakenEvents
        .filter((ev) => ev.date === d)
        .reduce((s, ev) => s + ev.amount, 0);

      const bucket = ensureCycleBucket(d);
      bucket.expected += dayExpected;
      bucket.collected += flows.totalCollected;
      bucket.cashCollected += flows.cashCollected;
      bucket.digitalCollected += flows.phonePeCollected + flows.onlineCollected;
      bucket.shortage += dayShortage;
      bucket.newLoansCount += dayNewLoanCount;
      bucket.givenNewLoans += flows.newLoansTotal;
      bucket.manualTakenCash += flows.personalTotal;
      bucket.autoHomeTakenCash += dayAutoTaken;
      bucket.takenCash += flows.personalTotal + dayAutoTaken;
      bucket.expenses += flows.expensesTotal;
      bucket.visitsCount += dayCols.length;
      bucket.netBalance =
        bucket.collected - bucket.givenNewLoans - bucket.expenses - bucket.takenCash;
    }
  }

  const cyclePeriodRows = Array.from(cyclePeriodMap.values()).sort(
    (a, b) => b.cycleNumber - a.cycleNumber
  );

  const cycleRows: RecordBookCycleRow[] = [];
  const allBorrowersList: Borrower[] = [];

  for (const v of villages || []) {
    const list = borrowers?.[v.id] || [];
    for (const b of list) {
      allBorrowersList.push(b);

      for (const past of b.loanHistory || []) {
        cycleRows.push({
          borrowerId: b.id,
          seqNo: b.seqNo || "",
          borrowerName: b.name,
          villageId: v.id,
          villageName: v.name,
          cycleNumber: past.cycle,
          startDate: past.startDate,
          endDate: past.closedDate,
          status: past.closureType,
          givenPrincipal: past.loanAmt,
          expectedReturn: past.totalReturn,
          collected: past.totalPaid,
          shortage: Math.max(0, past.totalReturn - past.totalPaid - (past.settlementDiscount || 0)),
          remainingBalance: 0,
          weeksPaid: past.durationWeeks,
          totalWeeks: past.durationWeeks,
        });
      }

      const expectedReturn = b.totalReturn || b.weeklyDue * (b.durationWeeks || 12);
      const collected = calculateTotalPaid(b);
      const remaining = calculateRemainingBalance(b);
      const closed = isBorrowerClosed(b);
      const status: RecordBookCycleRow["status"] = b.settledAt
        ? "settled_early"
        : closed
        ? "completed"
        : "active";

      cycleRows.push({
        borrowerId: b.id,
        seqNo: b.seqNo || "",
        borrowerName: b.name,
        villageId: v.id,
        villageName: v.name,
        cycleNumber: b.loanCycle || 1,
        startDate: b.startDate,
        endDate: b.settledAt,
        status,
        givenPrincipal: b.loanAmt,
        expectedReturn,
        collected,
        shortage: calculateTotalShortfall(b),
        remainingBalance: remaining,
        weeksPaid: b.weeksPaid || 0,
        totalWeeks: b.durationWeeks || 12,
      });
    }
  }

  cycleRows.sort((a, b) => (b.startDate || "").localeCompare(a.startDate || ""));

  const totalCollected = Object.values(collections || {}).reduce(
    (s, c) => s + (Number(c.totalCollected) || 0),
    0
  );
  const totalExpected = Object.values(collections || {}).reduce(
    (s, c) => s + (Number(c.totalExpected) || 0),
    0
  );
  const totalCashCollected = monthlyRows.reduce((s, r) => s + r.cashCollected, 0);
  const totalDigitalCollected = monthlyRows.reduce((s, r) => s + r.digitalCollected, 0);
  const totalShortage = allBorrowersList.reduce((s, b) => s + calculateTotalShortfall(b), 0);
  const totalGivenNewLoans =
    (newLoansLog || []).length > 0
      ? (newLoansLog || []).reduce((s, l) => s + (Number(l.loanAmt) || 0), 0)
      : allBorrowersList.reduce((s, b) => s + (Number(b.loanAmt) || 0), 0);
  const totalExpenses = (expenses || []).reduce((s, e) => s + (Number(e.amt) || 0), 0);

  return {
    weeklyRows,
    monthlyRows,
    cyclePeriodRows,
    cycleRows,
    cycleWeeks: resolvedCycleWeeks,
    cycleApproxMonths,
    overallTotals: {
      expected: totalExpected,
      collected: totalCollected,
      cashCollected: totalCashCollected,
      digitalCollected: totalDigitalCollected,
      shortage: totalShortage,
      newLoansCount: (newLoansLog || []).length || allBorrowersList.length,
      givenNewLoans: totalGivenNewLoans,
      manualTakenCash: cashStatus.manualPersonalTotal,
      autoHomeTakenCash: cashStatus.autoHomeTakenTotal,
      takenCash: cashStatus.totalTakenCash,
      expenses: totalExpenses,
      netBalance:
        totalCollected - totalGivenNewLoans - totalExpenses - cashStatus.totalTakenCash,
      lineCashInHand: cashStatus.lineCashInHand,
      outstandingInField: calculateOutstandingInField(allBorrowersList),
      activeLoansCount: allBorrowersList.filter((b) => !isBorrowerClosed(b)).length,
      closedLoansCount: allBorrowersList.filter((b) => isBorrowerClosed(b)).length,
    },
  };
}


