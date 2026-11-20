import type { Borrower, CollectionEntry, HistoryEntry, CollectionRecord, ExpenseItem, PersonalUseItem } from "../types.ts";

/**
 * Microfinance Loan EMI formula:
 * weeklyDue = ceil(loan * (1 + interestPct/100) / weeks)
 */
export function calculateWeeklyDue(
  loanAmt: number,
  interestPct: number,
  durationWeeks: number
): number {
  if (!loanAmt || loanAmt <= 0) return 0;
  const weeks = durationWeeks || 12;
  const total = loanAmt * (1 + (interestPct || 0) / 100);
  return Math.ceil(total / weeks);
}

/**
 * Calculates total cash actually paid by a borrower so far (Fix D3)
 * Takes into account actual history entries (paid, short, extra) plus
 * any pre-app weeks paid for ongoing loans.
 */
export function calculateTotalPaid(borrower: Borrower): number {
  const historyPaid = (borrower.history || []).reduce((sum, h) => {
    if (h.status === "skip") return sum;
    return sum + (Number(h.amtPaid) || 0);
  }, 0);

  let preAppPaid = 0;
  if (borrower.isOngoing && borrower.weeksPaid > (borrower.history || []).length) {
    const preWeeks = borrower.weeksPaid - (borrower.history || []).length;
    preAppPaid = preWeeks * borrower.weeklyDue;
  }

  return historyPaid + preAppPaid;
}

/**
 * Accurate Remaining Balance (Fix D3):
 * remaining = max(0, totalReturn - totalPaid)
 * Unlike the old formula which deducted a full weeklyDue even on short payments,
 * this accurately preserves any unpaid short amounts.
 */
export function calculateRemainingBalance(borrower: Borrower): number {
  const totalReturn =
    borrower.totalReturn || borrower.weeklyDue * (borrower.durationWeeks || 12);
  const paid = calculateTotalPaid(borrower);
  return Math.max(0, totalReturn - paid);
}

/**
 * Total unpaid short amounts across borrower history
 */
export function calculateTotalShortfall(borrower: Borrower): number {
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
    .filter((b) => b.weeksPaid < (b.durationWeeks || 12))
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
  // Also check if any collections had personalUse recorded before slg_personal was introduced
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
 * Idempotent Collection Updater (Fix D5 & D4):
 * Updates borrower week counts and history idempotently when saving collections
 * on the same calendar day.
 * Reverts any previous entry from today before applying the new entry.
 */
export function applyCollectionEntriesIdempotently(
  borrowers: Borrower[],
  entries: Record<string, CollectionEntry>,
  todayDateStr: string
): Borrower[] {
  return borrowers.map((b) => {
    const e = entries[b.id];
    const prevTodayEntry = (b.history || []).find((h) => h.date === todayDateStr);

    // If no entry for this borrower today and no previous entry today, leave untouched
    if (!e && !prevTodayEntry) {
      return b;
    }

    // Step 1: Start with existing weeksPaid and durationWeeks
    let wPaid = b.weeksPaid;
    let dWeeks = b.durationWeeks || 12;

    // Step 2: If there was an entry recorded earlier today, reverse its effect
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

    // Step 3: Filter out today's previous entry to create clean baseline history
    const cleanHistory = (b.history || []).filter((h) => h.date !== todayDateStr);

    // Step 4: If borrower is now unmarked/cleared today, return with reverted values
    if (!e) {
      return {
        ...b,
        weeksPaid: Math.max(0, wPaid),
        durationWeeks: Math.max(1, dWeeks),
        history: cleanHistory,
      };
    }

    // Step 5: Apply new entry
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
