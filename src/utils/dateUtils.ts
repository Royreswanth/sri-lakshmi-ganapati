import type { Borrower, Language } from "../types.ts";

export const DAYS_EN = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const DAYS_TE = ["ఆదివారం", "సోమవారం", "మంగళవారం", "బుధవారం", "గురువారం", "శుక్రవారం", "శనివారం"] as const;

export const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
] as const;

export const MONTHS_TE = [
  "జనవరి", "ఫిబ్రవరి", "మార్చి", "ఏప్రిల్", "మే", "జూన్",
  "జూలై", "ఆగస్టు", "సెప్టెంబర్", "అక్టోబర్", "నవంబర్", "డిసెంబర్"
] as const;

/**
 * Returns YYYY-MM-DD in LOCAL timezone (Never UTC to avoid IST date-shift bugs)
 */
export function getTodayStr(d = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parse YYYY-MM-DD as local date object without timezone shifts
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0); // noon to avoid any DST or edge effects
}

export function formatDateIN(dateStr: string, lang: Language = "en"): string {
  if (!dateStr) return "";
  try {
    const d = parseLocalDate(dateStr);
    const day = d.getDate();
    const monthIndex = d.getMonth();
    const year = d.getFullYear();

    if (lang === "te") {
      return `${day} ${MONTHS_TE[monthIndex]} ${year}`;
    }
    const shortMonth = MONTHS_EN[monthIndex].slice(0, 3);
    return `${String(day).padStart(2, "0")} ${shortMonth} ${year}`;
  } catch {
    return dateStr;
  }
}

export function getDayName(dateStr: string, lang: Language = "en"): string {
  if (!dateStr) return "";
  try {
    const d = parseLocalDate(dateStr);
    const dayIdx = d.getDay();
    return lang === "te" ? DAYS_TE[dayIdx] : DAYS_EN[dayIdx];
  } catch {
    return "";
  }
}

/**
 * Calculates the exact Monday date string (YYYY-MM-DD) for any given local date string.
 * Sunday (0) maps back to the previous Monday (-6 days).
 */
export function getMondayOfWeek(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday ... 6 is Saturday
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return getTodayStr(d);
}

/**
 * Returns all 7 dates (Mon through Sun) for a week starting on a given Monday.
 */
export function getWeekDates(mondayStr: string): string[] {
  const start = parseLocalDate(mondayStr);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(getTodayStr(d));
  }
  return dates;
}

/**
 * Indian Rupee formatting (e.g. ₹10,000)
 */
export function formatCurrency(amount: number | string | undefined | null): string {
  const num = Math.round(Number(amount) || 0);
  return `₹${num.toLocaleString("en-IN")}`;
}

/**
 * Microfinance Loan EMI formula:
 * weeklyDue = ceil(loan * (1 + interestPct/100) / weeks)
 */
export function calculateWeeklyDue(loanAmt: number, interestPct: number, durationWeeks: number): number {
  if (!loanAmt || loanAmt <= 0) return 0;
  const weeks = durationWeeks || 12;
  const total = loanAmt * (1 + (interestPct || 0) / 100);
  return Math.ceil(total / weeks);
}

/**
 * Precise Remaining Balance calculation (fixes D3):
 * remaining = totalReturn - actual total paid in history (or ongoing weeks paid if history empty)
 */
export function calculateRemainingBalance(borrower: Borrower): number {
  const totalReturn = borrower.totalReturn || (borrower.weeklyDue * (borrower.durationWeeks || 12));
  
  if (borrower.history && borrower.history.length > 0) {
    const totalActualPaid = borrower.history.reduce((sum, h) => {
      if (h.status === "skip") return sum;
      return sum + (h.amtPaid || 0);
    }, 0);
    
    // For ongoing loans where some weeks were paid before app recording
    let preAppPaid = 0;
    if (borrower.isOngoing && borrower.weeksPaid > borrower.history.length) {
      const preWeeks = borrower.weeksPaid - borrower.history.length;
      preAppPaid = preWeeks * borrower.weeklyDue;
    }
    
    const balance = totalReturn - totalActualPaid - preAppPaid;
    return Math.max(0, balance);
  }
  
  // If no history items recorded yet:
  const paidEstimate = (borrower.weeksPaid || 0) * borrower.weeklyDue;
  return Math.max(0, totalReturn - paidEstimate);
}

/**
 * Total actual cash paid by a borrower so far
 */
export function calculateTotalPaid(borrower: Borrower): number {
  if (borrower.history && borrower.history.length > 0) {
    const histPaid = borrower.history.reduce((s, h) => s + (h.amtPaid || 0), 0);
    let preAppPaid = 0;
    if (borrower.isOngoing && borrower.weeksPaid > borrower.history.length) {
      preAppPaid = (borrower.weeksPaid - borrower.history.length) * borrower.weeklyDue;
    }
    return histPaid + preAppPaid;
  }
  return (borrower.weeksPaid || 0) * borrower.weeklyDue;
}
