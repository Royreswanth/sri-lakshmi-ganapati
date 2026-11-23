import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Building2,
  HandCoins,
  Receipt,
  Calendar as CalendarIcon,
  ArrowRight,
  Wallet,
} from "lucide-react";
import {
  Borrower,
  BusinessProfile,
  CollectionRecord,
  DayOfWeek,
  ExpenseItem,
  Language,
  NewLoanLogItem,
  PersonalUseItem,
  Village,
} from "../types";
import {
  ALL_DAYS_MON_FIRST,
  DAYS_EN,
  MONTHS_EN,
  MONTHS_TE,
  formatCurrency,
  formatDateIN,
  getDayName,
  getTodayStr,
  translateDayName,
} from "../utils/dateUtils";

interface CalendarTabProps {
  data?: { villages: Village[]; borrowers: Record<string, Borrower[]> };
  collections: Record<string, CollectionRecord>;
  expenses?: ExpenseItem[];
  newLoansLog?: NewLoanLogItem[];
  personalLog?: PersonalUseItem[];
  profile?: BusinessProfile;
  lang: Language;
  onNavigateTab?: (tab: any) => void;
}

export const CalendarTab: React.FC<CalendarTabProps> = ({
  data = { villages: [], borrowers: {} },
  collections,
  expenses = [],
  newLoansLog = [],
  personalLog = [],
  profile,
  lang,
  onNavigateTab,
}) => {
  const now = new Date();
  const todayStr = getTodayStr(now);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Determine which weekdays are configured line days (villages + lender schedule)
  const scheduledDaySet = useMemo(() => {
    const s = new Set<DayOfWeek>();
    data.villages.forEach((v) => s.add(v.day));
    if (profile?.lineDaysMode === "daily") {
      ALL_DAYS_MON_FIRST.forEach((d) => s.add(d));
    } else if (profile?.lineDays && profile.lineDays.length > 0) {
      profile.lineDays.forEach((d) => s.add(d));
    }
    return s;
  }, [data.villages, profile?.lineDaysMode, profile?.lineDays]);

  const collDates = useMemo(
    () => new Set(Object.values(collections).map((c) => c.date)),
    [collections]
  );

  const activityDates = useMemo(() => {
    const s = new Set<string>();
    newLoansLog.forEach((n) => s.add(n.date));
    expenses.forEach((e) => s.add(e.date));
    personalLog.forEach((p) => s.add(p.date));
    return s;
  }, [newLoansLog, expenses, personalLog]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const makeDateStr = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // Selected date inspector data
  const selectedDayNameEn = getDayName(selectedDate, "en") as DayOfWeek;
  const selectedScheduledVillages = data.villages.filter(
    (v) => v.day === selectedDayNameEn
  );
  const selectedCollections = Object.values(collections).filter(
    (c) => c.date === selectedDate
  );
  const selectedNewLoans = newLoansLog.filter((n) => n.date === selectedDate);
  const selectedExpenses = expenses.filter((e) => e.date === selectedDate);
  const selectedPersonal = personalLog.filter((p) => p.date === selectedDate);

  const selectedCollectedTotal = selectedCollections.reduce(
    (s, c) => s + (c.totalCollected || 0),
    0
  );
  const selectedLentTotal = selectedNewLoans.reduce((s, n) => s + (n.loanAmt || 0), 0);
  const selectedExpenseTotal = selectedExpenses.reduce((s, e) => s + (e.amt || 0), 0);

  // Monthly collection records
  const monthCollections = Object.values(collections)
    .filter((c) => {
      const cd = new Date(c.date + "T12:00:00");
      return cd.getMonth() === month && cd.getFullYear() === year;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const monthTotalCollected = monthCollections.reduce(
    (s, c) => s + (c.totalCollected || 0),
    0
  );

  return (
    <div className="pb-28 px-4 pt-3 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <div className="lg:col-span-7 space-y-4">
          {/* Calendar Card */}
          <div className="bg-white dark:bg-[#131B2E] rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            {/* Header */}
            <div className="bg-gradient-to-r from-sky-900 to-cyan-800 text-white p-4 flex items-center justify-between">
              <button
                type="button"
                onClick={prevMonth}
                className="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer"
                aria-label="Previous Month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-center">
                <h3 className="font-extrabold text-base tracking-wide">
                  {lang === "te" ? MONTHS_TE[month] : MONTHS_EN[month]} {year}
                </h3>
                <p className="text-[11px] text-sky-100 font-medium tabular-nums">
                  {lang === "te" ? "నెల వసూలు:" : "Month Collected:"}{" "}
                  {formatCurrency(monthTotalCollected)}
                </p>
              </div>
              <button
                type="button"
                onClick={nextMonth}
                className="w-11 h-11 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer"
                aria-label="Next Month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Day Name Labels */}
            <div className="grid grid-cols-7 bg-sky-50/70 dark:bg-slate-800/60 py-2.5 text-center text-xs font-bold text-slate-600 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((shortDay, idx) => {
                const fullName = DAYS_EN[idx] as DayOfWeek;
                const isScheduledWeekday = scheduledDaySet.has(fullName);
                return (
                  <div
                    key={shortDay}
                    className={
                      isScheduledWeekday
                        ? "text-sky-700 dark:text-sky-400 font-black"
                        : ""
                    }
                  >
                    {shortDay}
                  </div>
                );
              })}
            </div>

            {/* Interactive Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 p-2.5 text-center text-xs tabular-nums">
              {cells.map((d, i) => {
                if (!d) return <div key={i} className="h-11" />;

                const ds = makeDateStr(d);
                const weekdayName = DAYS_EN[new Date(year, month, d).getDay()] as DayOfWeek;
                const isVisitDay = scheduledDaySet.has(weekdayName);
                const isTod = ds === todayStr;
                const isSelected = ds === selectedDate;
                const hasColl = collDates.has(ds);
                const hasActivity = activityDates.has(ds);

                let bgClass =
                  "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 border border-transparent";
                if (hasColl) {
                  bgClass = "bg-emerald-600 text-white font-extrabold shadow-xs border border-emerald-600";
                } else if (isTod) {
                  bgClass = "bg-sky-700 text-white font-extrabold shadow-xs border border-sky-700";
                } else if (isVisitDay) {
                  bgClass =
                    "bg-sky-50 dark:bg-sky-950/50 text-sky-900 dark:text-sky-300 font-bold border border-sky-200/80 dark:border-sky-800/60";
                }

                const ringClass = isSelected
                  ? "ring-2 ring-amber-500 ring-offset-1 dark:ring-offset-[#131B2E]"
                  : "";

                return (
                  <button
                    type="button"
                    key={i}
                    onClick={() => setSelectedDate(ds)}
                    aria-label={`${formatDateIN(ds, lang)}${isVisitDay ? " scheduled line day" : ""}${hasColl ? " collection recorded" : ""}`}
                    aria-pressed={isSelected}
                    className={`h-11 rounded-xl flex flex-col items-center justify-center transition-all cursor-pointer ${bgClass} ${ringClass}`}
                  >
                    <span>{d}</span>
                    <div className="flex items-center gap-0.5 mt-0.5 h-1.5">
                      {isVisitDay && !hasColl && (
                        <span className="w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-sky-400" />
                      )}
                      {hasColl && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      {hasActivity && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Legend */}
          <div className="bg-white dark:bg-[#131B2E] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs text-xs grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 flex items-center justify-center shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-600 dark:bg-sky-400" />
              </div>
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {lang === "te" ? "లైన్ గ్రామం ఉన్న రోజు" : "Scheduled Line Day"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-emerald-600 flex items-center justify-center text-white text-[10px] shrink-0">
                ✓
              </div>
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {lang === "te" ? "వసూలు సేవ్ అయ్యింది" : "Collection Saved"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 flex items-center justify-center shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              </div>
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                {lang === "te" ? "కొత్త అప్పు / ఖర్చు" : "Loan / Expense Log"}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: SELECTED DATE INSPECTOR + MONTHLY HISTORY */}
        <div className="lg:col-span-5 space-y-4">
          {/* Selected Day Inspector */}
          <div className="bg-white dark:bg-[#131B2E] rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-300 flex items-center justify-center shrink-0">
                  <CalendarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                    {formatDateIN(selectedDate, lang)}
                  </h3>
                  <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                    {translateDayName(selectedDayNameEn, lang)}
                    {selectedDate === todayStr
                      ? ` · ${lang === "te" ? "ఈ రోజు" : "Today"}`
                      : ""}
                  </p>
                </div>
              </div>

              {selectedDate !== todayStr && (
                <button
                  type="button"
                  onClick={() => {
                    setYear(now.getFullYear());
                    setMonth(now.getMonth());
                    setSelectedDate(todayStr);
                  }}
                  className="min-h-[36px] px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {lang === "te" ? "ఈ రోజు" : "Today"}
                </button>
              )}
            </div>

            {/* Scheduled Villages for that Day */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                {lang === "te" ? "షెడ్యూల్ చేయబడిన గ్రామాలు" : "Scheduled Line Villages"}
              </span>
              {selectedScheduledVillages.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-1">
                  {lang === "te"
                    ? "ఈ వారపు రోజుకు గ్రామాలు సెట్ చేయలేదు."
                    : `No villages assigned to ${selectedDayNameEn}.`}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {selectedScheduledVillages.map((v) => {
                    const colForDay = selectedCollections.find(
                      (c) => c.villageId === v.id
                    );
                    const bCount = (data.borrowers[v.id] || []).length;
                    return (
                      <div
                        key={v.id}
                        className="p-2.5 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/50 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Building2 className="w-4 h-4 text-sky-700 dark:text-sky-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              {v.name}
                            </div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-400 tabular-nums">
                              {bCount} {lang === "te" ? "ఖాతాదారులు" : "borrowers"}
                            </div>
                          </div>
                        </div>
                        {colForDay ? (
                          <span className="font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                            ✓ {formatCurrency(colForDay.totalCollected)}
                          </span>
                        ) : onNavigateTab ? (
                          <button
                            type="button"
                            onClick={() => onNavigateTab("collect")}
                            className="px-2.5 py-1 rounded-lg bg-[#1E3A8A] text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            <span>{lang === "te" ? "వసూలు" : "Collect"}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Day Activity Summary */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center text-xs tabular-nums">
              <div className="p-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-800/50">
                <HandCoins className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 mx-auto mb-0.5" />
                <span className="text-[10px] text-slate-600 dark:text-slate-400 block">
                  {lang === "te" ? "వసూలు" : "Collected"}
                </span>
                <span className="font-black text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(selectedCollectedTotal)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-800/50">
                <Wallet className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 mx-auto mb-0.5" />
                <span className="text-[10px] text-slate-600 dark:text-slate-400 block">
                  {lang === "te" ? "కొత్త అప్పులు" : "New Loans"}
                </span>
                <span className="font-black text-blue-800 dark:text-blue-300">
                  {formatCurrency(selectedLentTotal)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-800/50">
                <Receipt className="w-3.5 h-3.5 text-rose-700 dark:text-rose-400 mx-auto mb-0.5" />
                <span className="text-[10px] text-slate-600 dark:text-slate-400 block">
                  {lang === "te" ? "ఖర్చులు" : "Expenses"}
                </span>
                <span className="font-black text-rose-700 dark:text-rose-400">
                  {formatCurrency(selectedExpenseTotal)}
                </span>
              </div>
            </div>

            {selectedPersonal.length > 0 && (
              <div className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold pt-1 tabular-nums">
                {lang === "te" ? "సొంత ఖర్చులు:" : "Personal withdrawals:"}{" "}
                {formatCurrency(selectedPersonal.reduce((s, p) => s + p.amt, 0))}
              </div>
            )}
          </div>

          {/* Collections This Month */}
          <div>
            <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2.5 px-1 tabular-nums">
              {lang === "te" ? "ఈ నెల సేకరణలు" : "This Month's Collections"} ({monthCollections.length})
            </h3>

            {monthCollections.length === 0 ? (
              <div className="bg-white dark:bg-[#131B2E] p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-600 dark:text-slate-400">
                {lang === "te"
                  ? "ఈ నెలలో ఇంకా వసూళ్లు నమోదు కాలేదు."
                  : "No collections recorded in this month."}
              </div>
            ) : (
              <div className="space-y-2">
                {monthCollections.slice(0, 8).map((c, idx) => (
                  <button
                    type="button"
                    key={idx}
                    onClick={() => setSelectedDate(c.date)}
                    className="w-full text-left bg-white dark:bg-[#131B2E] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs text-xs cursor-pointer hover:border-emerald-400/60"
                  >
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {c.villageName}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        {getDayName(c.date, lang)}, {formatDateIN(c.date, lang)}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-extrabold text-xs tabular-nums">
                      {formatCurrency(c.totalCollected)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
