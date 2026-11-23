import type { DayOfWeek, Language } from "../types.ts";
import {
  calculateWeeklyDue,
  calculateTotalPaid,
  calculateRemainingBalance,
} from "./financeUtils.ts";

export { calculateWeeklyDue, calculateTotalPaid, calculateRemainingBalance };

export const ALL_DAYS_MON_FIRST: DayOfWeek[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export const DAYS_EN = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const DAYS_TE = [
  "ఆదివారం",
  "సోమవారం",
  "మంగళవారం",
  "బుధవారం",
  "గురువారం",
  "శుక్రవారం",
  "శనివారం",
] as const;

export function translateDayName(day: DayOfWeek, lang: Language = "en"): string {
  if (lang === "en") return day;
  const idx = DAYS_EN.indexOf(day);
  return idx >= 0 ? DAYS_TE[idx] : day;
}

export const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export const MONTHS_TE = [
  "జనవరి", "ఫిబ్రవరి", "మార్చి", "ఏప్రిల్", "మే", "జూన్",
  "జూలై", "ఆగస్టు", "సెప్టెంబర్", "అక్టోబర్", "నవంబర్", "డిసెంబర్",
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
  return new Date(y, m - 1, d, 12, 0, 0);
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
  const day = d.getDay();
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
