import React, { useEffect, useState } from "react";
import {
  TrendingUp,
  Calendar,
  Building2,
  ChevronRight,
  ArrowLeft,
  Coins,
  CheckCircle2,
  AlertCircle,
  PiggyBank,
  Receipt,
  Wallet,
  Download,
  Printer,
  BookOpen,
} from "lucide-react";
import {
  Borrower,
  Village,
  CollectionRecord,
  ExpenseItem,
  Language,
  PersonalUseItem,
  NewLoanLogItem,
  CashOpeningMap,
  BusinessProfile,
} from "../types";
import { translations } from "../translations";
import {
  formatCurrency,
  formatDateIN,
  getMondayOfWeek,
  getWeekDates,
  getTodayStr,
} from "../utils/dateUtils";
import {
  calculateOutstandingInField,
  calculateLineCashStatus,
  calculateNetProfit,
  getAllCashbookDates,
  buildRecordBookReport,
} from "../utils/financeUtils";
import {
  buildBorrowersCsv,
  buildCollectionsCsv,
  buildCashbookCsv,
  buildRecordBookCsv,
  downloadCsvFile,
} from "../utils/exportUtils";

interface ReportsTabProps {
  data: { villages: Village[]; borrowers: Record<string, Borrower[]> };
  collections: Record<string, CollectionRecord>;
  expenses: ExpenseItem[];
  personalLog?: PersonalUseItem[];
  newLoansLog?: NewLoanLogItem[];
  openingBalances?: CashOpeningMap;
  profile?: BusinessProfile;
  requestedView?: {
    view: "summary" | "recordBook" | "weeks" | "villages";
    nonce: number;
  } | null;
  onUpdateProfile?: (p: BusinessProfile) => void;
  lang: Language;
  onNavigateTab?: (tab: any) => void;
  showToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

const CYCLE_DURATION_PRESETS = [
  { weeks: 12, months: 3 },
  { weeks: 16, months: 4 },
  { weeks: 20, months: 5 },
  { weeks: 25, months: 6 },
];

export const ReportsTab: React.FC<ReportsTabProps> = ({
  data,
  collections,
  expenses,
  personalLog = [],
  newLoansLog = [],
  openingBalances = {},
  profile,
  requestedView,
  onUpdateProfile,
  lang,
  onNavigateTab,
  showToast,
}) => {
  const [view, setView] = useState<"summary" | "recordBook" | "weeks" | "villages">(
    requestedView?.view || "summary"
  );
  const [recordPeriodMode, setRecordPeriodMode] = useState<"weekly" | "monthly" | "cycle">("weekly");
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);
  const [localCycleWeeks, setLocalCycleWeeks] = useState<number>(
    profile?.lineCycleWeeks || 12
  );

  useEffect(() => {
    if (requestedView?.view) {
      setView(requestedView.view);
      setSelectedWeek(null);
    }
  }, [requestedView?.nonce]);

  useEffect(() => {
    if (profile?.lineCycleWeeks && profile.lineCycleWeeks !== localCycleWeeks) {
      setLocalCycleWeeks(profile.lineCycleWeeks);
    }
  }, [profile?.lineCycleWeeks]);

  const activeCycleWeeks = Math.max(
    1,
    Math.round(profile?.lineCycleWeeks || localCycleWeeks || 12)
  );

  const handleChangeCycleWeeks = (weeksVal: number) => {
    const clean = Math.max(1, Math.min(104, Math.round(weeksVal || 12)));
    setLocalCycleWeeks(clean);
    if (profile && onUpdateProfile) {
      onUpdateProfile({ ...profile, lineCycleWeeks: clean });
    }
  };

  const t = translations[lang];
  const todayStr = getTodayStr();
  const isCashbookEnabled = profile?.enableDailyCashbook !== false;

  const handleDownloadBorrowersCsv = () => {
    const csv = buildBorrowersCsv(data.villages, data.borrowers, lang);
    downloadCsvFile(`LineBook_Borrowers_${todayStr}.csv`, csv);
    showToast?.(
      lang === "te" ? "ఖాతాదారుల CSV డౌన్‌లోడ్ అయింది ✓" : "Borrowers Ledger CSV downloaded ✓",
      "success"
    );
  };

  const handleDownloadCollectionsCsv = () => {
    const csv = buildCollectionsCsv(collections, lang);
    downloadCsvFile(`LineBook_Collections_${todayStr}.csv`, csv);
    showToast?.(
      lang === "te" ? "వసూళ్ల CSV డౌన్‌లోడ్ అయింది ✓" : "Collections CSV downloaded ✓",
      "success"
    );
  };

  const handleDownloadCashbookCsv = () => {
    const sources = { collections, expenses, newLoansLog, personalLog, openingBalances };
    const dates = getAllCashbookDates(sources, [todayStr]);
    const csv = buildCashbookCsv(dates, sources, lang);
    downloadCsvFile(`LineBook_Cashbook_${todayStr}.csv`, csv);
    showToast?.(
      lang === "te" ? "క్యాష్‌బుక్ CSV డౌన్‌లోడ్ అయింది ✓" : "Cashbook CSV downloaded ✓",
      "success"
    );
  };

  const allBorrowers = Object.values(data.borrowers).flat();
  const totalLent = allBorrowers.reduce((s, b) => s + (b.loanAmt || 0), 0);
  const totalReturn = allBorrowers.reduce(
    (s, b) => s + (b.totalReturn || b.weeklyDue * (b.durationWeeks || 12)),
    0
  );
  const totalInterest = totalReturn - totalLent;

  // Real Outstanding in Field (Fix D8)
  const outstandingInField = calculateOutstandingInField(allBorrowers);

  const allCollections = Object.values(collections);
  const totalCollected = allCollections.reduce(
    (s, c) => s + (c.totalCollected || 0),
    0
  );
  const totalExpenses = expenses.reduce((s, e) => s + (e.amt || 0), 0);
  const lineCashStatus = calculateLineCashStatus({
    collections,
    newLoansLog,
    expenses,
    personalLog,
    todayStr,
  });
  const totalPersonal = lineCashStatus.totalTakenCash;
  const netProfit = calculateNetProfit(totalCollected, totalExpenses, totalPersonal);

  const recordBook = buildRecordBookReport({
    villages: data.villages,
    borrowers: data.borrowers,
    collections,
    expenses,
    newLoansLog,
    personalLog,
    todayStr,
    cycleWeeks: activeCycleWeeks,
  });

  const handleDownloadRecordBookCsv = () => {
    const mode = recordPeriodMode;
    const rows =
      mode === "monthly"
        ? recordBook.monthlyRows
        : mode === "cycle"
        ? recordBook.cyclePeriodRows
        : recordBook.weeklyRows;
    const csv = buildRecordBookCsv(rows, mode, lang);
    downloadCsvFile(`LineBook_RecordBook_${mode}_${todayStr}.csv`, csv);
    showToast?.(
      lang === "te" ? "రికార్డు పుస్తకం CSV డౌన్‌లోడ్ అయింది ✓" : "Record Book CSV downloaded ✓",
      "success"
    );
  };

  const allMondays = Array.from(
    new Set(allCollections.map((c) => getMondayOfWeek(c.date)))
  ).sort((a, b) => b.localeCompare(a));

  // If week report is open
  if (selectedWeek) {
    const weekDates = getWeekDates(selectedWeek);
    const wColls = allCollections.filter((c) => weekDates.includes(c.date));
    const wColl = wColls.reduce((s, c) => s + (c.totalCollected || 0), 0);
    const wExp = wColls.reduce((s, c) => s + (c.totalExpected || 0), 0);

    return (
      <div className="pb-28 px-4 pt-3 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedWeek(null)}
            className="w-11 h-11 rounded-full neu-circle-btn flex items-center justify-center text-slate-800 dark:text-slate-100 cursor-pointer"
            title="Back to Reports"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {lang === "te" ? "వారం నివేదిక" : "Week Report"}
            </h2>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              {formatDateIN(selectedWeek, lang)} → {formatDateIN(weekDates[6], lang)}
            </p>
          </div>
        </div>

        <div className="neu-card rounded-3xl p-5 text-center">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            {lang === "te" ? "మొత్తం వసూలు" : "Total Collected"}
          </span>
          <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
            {formatCurrency(wColl)}
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-300/40 dark:border-slate-700/60 text-xs font-semibold tabular-nums">
            <span className="text-slate-700 dark:text-slate-300">
              {lang === "te" ? "లక్ష్యం:" : "Expected:"} {formatCurrency(wExp)}
            </span>
            <span className="text-red-600 dark:text-red-400">
              {lang === "te" ? "తరుగు:" : "Shortfall:"} {formatCurrency(Math.max(wExp - wColl, 0))}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {wColls.map((c, i) => (
            <div key={i} className="neu-card rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{c.villageName}</h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">{formatDateIN(c.date, lang)}</p>
                </div>
                <div className="text-right">
                  <div className="font-black text-emerald-700 dark:text-emerald-400 text-sm tabular-nums">
                    {formatCurrency(c.totalCollected)}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {lang === "te" ? "లక్ష్యం" : "of"} {formatCurrency(c.totalExpected)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28 px-4 pt-3 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto space-y-4">
      {/* Print-only Business Report Header */}
      <div className="hidden print:block border-b-2 border-slate-800 pb-3 mb-4">
        <h1 className="text-xl font-black text-slate-900">
          {profile?.businessName || "LineBook Pro"} — {lang === "te" ? "ఆర్థిక నివేదిక" : "Line Financial Report"}
        </h1>
        <p className="text-xs text-slate-600">
          {formatDateIN(todayStr, lang)} {profile?.phone ? `· 📞 ${profile.phone}` : ""}
        </p>
      </div>

      {/* Exports & Daily Cashbook Action Strip */}
      <div className="rounded-2xl p-3 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
            {isCashbookEnabled
              ? lang === "te"
                ? "ఎగుమతి & క్యాష్‌బుక్"
                : "Exports & Cashbook"
              : lang === "te"
              ? "ఎగుమతి & రిపోర్టులు"
              : "Exports & Reports"}
          </span>
          {onNavigateTab && isCashbookEnabled && (
            <button
              type="button"
              onClick={() => onNavigateTab("cashbook")}
              className="min-h-[36px] px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t.dailyCashbook}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={handleDownloadBorrowersCsv}
            className="min-h-[40px] px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>{lang === "te" ? "ఖాతాదారులు CSV" : "Borrowers CSV"}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCollectionsCsv}
            className="min-h-[40px] px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{lang === "te" ? "వసూళ్లు CSV" : "Collections CSV"}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadCashbookCsv}
            className="min-h-[40px] px-2.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>{lang === "te" ? "క్యాష్‌బుక్ CSV" : "Cashbook CSV"}</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="min-h-[40px] px-2.5 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 shrink-0" />
            <span>{t.printPdf}</span>
          </button>
        </div>
      </div>

      {/* Switcher */}
      <div className="grid grid-cols-2 sm:grid-cols-4 neu-inset p-1 rounded-2xl text-xs font-bold gap-1 print:hidden">
        {(
          [
            ["summary", lang === "te" ? "📊 సారాంశం" : "📊 Summary"],
            ["recordBook", lang === "te" ? "📒 రికార్డు పుస్తకం" : "📒 Record Book"],
            ["weeks", lang === "te" ? "📅 వారాలు" : "📅 Weeks"],
            ["villages", lang === "te" ? "🏘️ గ్రామాలు" : "🏘️ Villages"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`min-h-[40px] py-2 px-2.5 rounded-xl transition-all cursor-pointer truncate ${
              view === k
                ? "bg-[#1E3A8A] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "summary" && (
        <div className="space-y-3.5">
          {/* Net Profit Card */}
          <div className="neu-card rounded-3xl p-5 text-center">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              {lang === "te" ? "మొత్తం నికర లాభం" : "Overall Net Profit"}
            </span>
            <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400 mt-1 tabular-nums">
              {formatCurrency(netProfit)}
            </div>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
              {lang === "te"
                ? "వసూలు – లైన్ ఖర్చులు – వ్యక్తిగత ఖర్చులు"
                : "Collected – Line Expenses – Personal Withdrawals"}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {[
              { label: lang === "te" ? "ఫీల్డులో ఉన్న బకాయి" : "Outstanding in Field", val: formatCurrency(outstandingInField), badge: "badge-pastel-amber", icon: <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400" /> },
              { label: lang === "te" ? "మొత్తం ఇచ్చిన అప్పు" : "Total Capital Lent Out", val: formatCurrency(totalLent), badge: "badge-pastel-blue", icon: <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" /> },
              { label: lang === "te" ? "రావలసిన మొత్తం" : "Total Expected Return", val: formatCurrency(totalReturn), badge: "badge-pastel-green", icon: <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> },
              { label: lang === "te" ? "రావలసిన వడ్డీ" : "Total Expected Interest", val: formatCurrency(totalInterest), badge: "badge-pastel-amber", icon: <Coins className="w-5 h-5 text-amber-600 dark:text-amber-400" /> },
              { label: lang === "te" ? "మొత్తం వసూలైనది" : "Total Collected So Far", val: formatCurrency(totalCollected), badge: "badge-pastel-green", icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> },
              { label: lang === "te" ? "లైన్ ఖర్చులు (మొత్తం)" : "Total Line Expenses", val: formatCurrency(totalExpenses), badge: "badge-pastel-red", icon: <Receipt className="w-5 h-5 text-rose-600 dark:text-rose-400" /> },
              { label: lang === "te" ? "వ్యక్తిగత ఖర్చులు (సొంతం)" : "Personal Cash Withdrawals", val: formatCurrency(totalPersonal), badge: "badge-pastel-purple", icon: <PiggyBank className="w-5 h-5 text-purple-600 dark:text-purple-400" /> },
            ].map((item, idx) => (
              <div key={idx} className="neu-card rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${item.badge} flex items-center justify-center shrink-0`}>
                    {item.icon}
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{item.label}</span>
                </div>
                <span className="text-sm font-black text-slate-900 dark:text-slate-100 tabular-nums">{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "recordBook" && (
        <div className="space-y-4">
          {/* Sub-Tabs: Weekly | Monthly | Cycle */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex neu-inset p-1 rounded-xl text-xs font-extrabold gap-1 flex-1 min-w-[230px]">
              {(
                [
                  ["weekly", lang === "te" ? "వారంవారీ (Weekly)" : "Weekly"],
                  ["monthly", lang === "te" ? "నెలవారీ (Monthly)" : "Monthly"],
                  ["cycle", lang === "te" ? "సైకిల్ (Cycle)" : "Cycle"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRecordPeriodMode(mode)}
                  className={`flex-1 min-h-[36px] px-2.5 py-1.5 rounded-lg cursor-pointer transition-all ${
                    recordPeriodMode === mode
                      ? "bg-amber-500 text-slate-950 shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleDownloadRecordBookCsv}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{lang === "te" ? "రికార్డు CSV" : "Record Book CSV"}</span>
            </button>
          </div>

          {/* Overall Line Cycle Summary Strip */}
          <div className="rounded-3xl p-4 bg-gradient-to-br from-[#0F2447] via-[#17366B] to-[#0B172E] text-white shadow-md border border-blue-900/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                {lang === "te" ? "మొత్తం లైన్ రికార్డు సారాంశం" : "Overall Line Record Summary"}
              </span>
              <span className="text-[11px] font-bold text-slate-300 tabular-nums">
                {recordBook.overallTotals.activeLoansCount} {lang === "te" ? "యాక్టివ్" : "Active"} ·{" "}
                {recordBook.overallTotals.closedLoansCount} {lang === "te" ? "ముగిసినవి" : "Closed"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2.5 rounded-2xl bg-white/10">
                <span className="text-[10px] text-emerald-200 font-bold block">
                  {lang === "te" ? "మొత్తం వసూలు" : "Collected"}
                </span>
                <span className="text-sm font-black text-white tabular-nums">
                  {formatCurrency(recordBook.overallTotals.collected)}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/10">
                <span className="text-[10px] text-sky-200 font-bold block">
                  {lang === "te" ? `కొత్త రుణాలు (${recordBook.overallTotals.newLoansCount})` : `Given (${recordBook.overallTotals.newLoansCount} Loans)`}
                </span>
                <span className="text-sm font-black text-white tabular-nums">
                  {formatCurrency(recordBook.overallTotals.givenNewLoans)}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/10">
                <span className="text-[10px] text-rose-200 font-bold block">
                  {lang === "te" ? "తరుగు మొత్తం" : "Shortage Amount"}
                </span>
                <span className="text-sm font-black text-rose-200 tabular-nums">
                  {formatCurrency(recordBook.overallTotals.shortage)}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/10">
                <span className="text-[10px] text-amber-200 font-bold block">
                  {lang === "te" ? "తీసుకున్న నగదు (సొంతం+ఆటో)" : "Taken Cash (Home/Use)"}
                </span>
                <span className="text-sm font-black text-amber-200 tabular-nums">
                  {formatCurrency(recordBook.overallTotals.takenCash)}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/10">
                <span className="text-[10px] text-orange-200 font-bold block">
                  {lang === "te" ? "లైన్ ఖర్చులు" : "Expenses"}
                </span>
                <span className="text-sm font-black text-white tabular-nums">
                  {formatCurrency(recordBook.overallTotals.expenses)}
                </span>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/10">
                <span className="text-[10px] text-teal-200 font-bold block">
                  {lang === "te" ? "చేతిలో నగదు" : "Line Cash in Hand"}
                </span>
                <span className="text-sm font-black text-teal-200 tabular-nums">
                  {formatCurrency(recordBook.overallTotals.lineCashInHand)}
                </span>
              </div>
            </div>
          </div>

          {/* Weekly or Monthly Detailed List */}
          {recordPeriodMode !== "cycle" && (
            <div className="space-y-3">
              {(recordPeriodMode === "weekly" ? recordBook.weeklyRows : recordBook.monthlyRows)
                .length === 0 ? (
                <div className="neu-card rounded-2xl p-8 text-center text-xs text-slate-600 dark:text-slate-400">
                  {lang === "te"
                    ? "ఈ విభాగంలో ఇంకా రికార్డులు లేవు."
                    : "No activity recorded yet for this period view."}
                </div>
              ) : (
                (recordPeriodMode === "weekly"
                  ? recordBook.weeklyRows
                  : recordBook.monthlyRows
                ).map((row) => (
                  <div
                    key={row.key}
                    className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <div>
                        <h4 className="text-sm font-black text-slate-900 dark:text-white">
                          {recordPeriodMode === "weekly"
                            ? `${formatDateIN(row.startDate, lang)} → ${formatDateIN(row.endDate, lang)}`
                            : row.key}
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                          {row.visitsCount} {lang === "te" ? "గ్రామ వసూళ్లు" : "collection sheets"} ·{" "}
                          {row.newLoansCount} {lang === "te" ? "కొత్త రుణాలు" : "new loans"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">
                          {lang === "te" ? "నికర నిల్వ" : "Net Flow"}
                        </span>
                        <span
                          className={`text-sm font-black tabular-nums ${
                            row.netBalance >= 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {row.netBalance >= 0 ? "+" : ""}
                          {formatCurrency(row.netBalance)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30">
                        <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 block">
                          {lang === "te" ? "వసూలైన మొత్తం" : "Collected"}
                        </span>
                        <span className="font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                          {formatCurrency(row.collected)}
                        </span>
                        {row.digitalCollected > 0 && (
                          <span className="block text-[10px] text-emerald-700/80 dark:text-emerald-400/80 tabular-nums">
                            {lang === "te" ? "నగదు:" : "Cash:"} {formatCurrency(row.cashCollected)} · UPI:{" "}
                            {formatCurrency(row.digitalCollected)}
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30">
                        <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 block">
                          {lang === "te" ? `ఇచ్చిన అప్పులు (${row.newLoansCount})` : `Given (${row.newLoansCount})`}
                        </span>
                        <span className="font-black text-blue-700 dark:text-blue-300 tabular-nums">
                          {formatCurrency(row.givenNewLoans)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30">
                        <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 block">
                          {lang === "te" ? "తరుగు (Shortage)" : "Shortage"}
                        </span>
                        <span className="font-black text-rose-700 dark:text-rose-300 tabular-nums">
                          {formatCurrency(row.shortage)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/30">
                        <span className="text-[10px] font-bold text-purple-800 dark:text-purple-300 block">
                          {lang === "te" ? "తీసుకున్న నగదు" : "Taken Cash"}
                        </span>
                        <span className="font-black text-purple-700 dark:text-purple-300 tabular-nums">
                          {formatCurrency(row.takenCash)}
                        </span>
                        {row.autoHomeTakenCash > 0 && (
                          <span className="block text-[10px] text-purple-700/80 dark:text-purple-300/80 tabular-nums">
                            {lang === "te" ? "ఆటో 2రో:" : "Auto 2d:"} {formatCurrency(row.autoHomeTakenCash)}
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30">
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 block">
                          {lang === "te" ? "లైన్ ఖర్చులు" : "Expenses"}
                        </span>
                        <span className="font-black text-amber-700 dark:text-amber-300 tabular-nums">
                          {formatCurrency(row.expenses)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">
                          {lang === "te" ? "లక్ష్యం" : "Target"}
                        </span>
                        <span className="font-black text-slate-800 dark:text-slate-200 tabular-nums">
                          {formatCurrency(row.expected)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Cycle Details: Recurring Line Period Cycles (e.g., 12 Weeks = 3 Months, 25 Weeks = 6 Months) */}
          {recordPeriodMode === "cycle" && (
            <div className="space-y-3.5">
              {/* Line Cycle Duration Selector */}
              <div className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      {lang === "te" ? "లైన్ సైకిల్ వ్యవధి (Cycle Duration)" : "Line Cycle Duration"}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === "te"
                        ? `ప్రస్తుతం: ${recordBook.cycleWeeks} వారాలు (సుమారు ${recordBook.cycleApproxMonths} నెలలు)`
                        : `Active period: ${recordBook.cycleWeeks} Weeks (≈ ${recordBook.cycleApproxMonths} Months)`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <label
                      htmlFor="custom-cycle-weeks"
                      className="text-[11px] font-bold text-slate-600 dark:text-slate-400"
                    >
                      {lang === "te" ? "వారాలు:" : "Weeks:"}
                    </label>
                    <input
                      id="custom-cycle-weeks"
                      type="number"
                      min={1}
                      max={104}
                      value={activeCycleWeeks}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0) handleChangeCycleWeeks(val);
                      }}
                      className="w-16 px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs font-black text-center tabular-nums outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {CYCLE_DURATION_PRESETS.map((preset) => {
                    const isActive = activeCycleWeeks === preset.weeks;
                    return (
                      <button
                        key={preset.weeks}
                        type="button"
                        onClick={() => handleChangeCycleWeeks(preset.weeks)}
                        className={`min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-extrabold border cursor-pointer transition-all tabular-nums ${
                          isActive
                            ? "bg-[#1E3A8A] text-white border-[#1E3A8A] shadow-xs"
                            : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-blue-400"
                        }`}
                      >
                        {lang === "te"
                          ? `${preset.weeks} వారాలు (${preset.months} నెలలు)`
                          : `${preset.weeks} Wks (${preset.months} Mo)`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Recurring Line Cycle Statements */}
              {recordBook.cyclePeriodRows.length === 0 ? (
                <div className="neu-card rounded-2xl p-8 text-center text-xs text-slate-600 dark:text-slate-400">
                  {lang === "te"
                    ? "ఈ సైకిల్‌లో ఇంకా ఆర్థిక లావాదేవీలు నమోదు కాలేదు."
                    : "No line financial activity recorded yet for cycle tracking."}
                </div>
              ) : (
                recordBook.cyclePeriodRows.map((row) => (
                  <div
                    key={row.key}
                    className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white">
                            {lang === "te" ? `సైకిల్ #${row.cycleNumber}` : `Line Cycle #${row.cycleNumber}`}
                          </h4>
                          <span className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-[10px] font-black tabular-nums">
                            {lang === "te"
                              ? `${row.cycleWeeks} వారాలు (${row.approxMonths} నెలలు)`
                              : `${row.cycleWeeks} Weeks (${row.approxMonths} Months)`}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          📅 {formatDateIN(row.startDate, lang)} → {formatDateIN(row.endDate, lang)} ·{" "}
                          {row.visitsCount} {lang === "te" ? "వసూళ్లు" : "collections"}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 block">
                          {lang === "te" ? "నికర నిల్వ" : "Net Flow"}
                        </span>
                        <span
                          className={`text-sm font-black tabular-nums ${
                            row.netBalance >= 0
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {row.netBalance >= 0 ? "+" : ""}
                          {formatCurrency(row.netBalance)}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30">
                        <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 block">
                          {lang === "te" ? "వసూలైన మొత్తం" : "Collected"}
                        </span>
                        <span className="font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                          {formatCurrency(row.collected)}
                        </span>
                        {row.digitalCollected > 0 && (
                          <span className="block text-[10px] text-emerald-700/80 dark:text-emerald-400/80 tabular-nums">
                            {lang === "te" ? "నగదు:" : "Cash:"} {formatCurrency(row.cashCollected)} · UPI:{" "}
                            {formatCurrency(row.digitalCollected)}
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 rounded-xl bg-blue-50/80 dark:bg-blue-950/30">
                        <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 block">
                          {lang === "te" ? `ఇచ్చిన అప్పులు (${row.newLoansCount})` : `Given (${row.newLoansCount})`}
                        </span>
                        <span className="font-black text-blue-700 dark:text-blue-300 tabular-nums">
                          {formatCurrency(row.givenNewLoans)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30">
                        <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 block">
                          {lang === "te" ? "తరుగు (Shortage)" : "Shortage"}
                        </span>
                        <span className="font-black text-rose-700 dark:text-rose-300 tabular-nums">
                          {formatCurrency(row.shortage)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-purple-50/80 dark:bg-purple-950/30">
                        <span className="text-[10px] font-bold text-purple-800 dark:text-purple-300 block">
                          {lang === "te" ? "తీసుకున్న నగదు" : "Taken Cash"}
                        </span>
                        <span className="font-black text-purple-700 dark:text-purple-300 tabular-nums">
                          {formatCurrency(row.takenCash)}
                        </span>
                        {row.autoHomeTakenCash > 0 && (
                          <span className="block text-[10px] text-purple-700/80 dark:text-purple-300/80 tabular-nums">
                            {lang === "te" ? "ఆటో 2రో:" : "Auto 2d:"} {formatCurrency(row.autoHomeTakenCash)}
                          </span>
                        )}
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30">
                        <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 block">
                          {lang === "te" ? "లైన్ ఖర్చులు" : "Expenses"}
                        </span>
                        <span className="font-black text-amber-700 dark:text-amber-300 tabular-nums">
                          {formatCurrency(row.expenses)}
                        </span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80">
                        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 block">
                          {lang === "te" ? "లక్ష్యం" : "Target"}
                        </span>
                        <span className="font-black text-slate-800 dark:text-slate-200 tabular-nums">
                          {formatCurrency(row.expected)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Individual Borrower Loan Cycles (Collapsible secondary ledger) */}
              {recordBook.cycleRows.length > 0 && (
                <details className="rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 p-4">
                  <summary className="text-xs font-extrabold text-slate-800 dark:text-slate-200 cursor-pointer flex items-center justify-between">
                    <span>
                      {lang === "te"
                        ? `ఖాతాదారుల వారీ రుణ సైకిళ్లు (${recordBook.cycleRows.length})`
                        : `Individual Borrower Loan Cycles (${recordBook.cycleRows.length})`}
                    </span>
                  </summary>
                  <div className="space-y-2.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    {recordBook.cycleRows.map((c, idx) => (
                      <div
                        key={`${c.borrowerId}_${c.cycleNumber}_${idx}`}
                        className="rounded-xl p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {c.seqNo && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-[10px] font-black">
                                  #{c.seqNo}
                                </span>
                              )}
                              <h4 className="text-xs font-black text-slate-900 dark:text-white">
                                {c.borrowerName}
                              </h4>
                              <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                                {lang === "te" ? `సైకిల్ #${c.cycleNumber}` : `Cycle #${c.cycleNumber}`}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                              {c.villageName} · 📅 {formatDateIN(c.startDate, lang)}
                              {c.endDate ? ` → ${formatDateIN(c.endDate, lang)}` : ""}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              c.status === "active"
                                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300"
                                : c.status === "settled_early"
                                ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300"
                                : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                            }`}
                          >
                            {c.status === "active"
                              ? lang === "te"
                                ? "నడుస్తోంది"
                                : "Active"
                              : c.status === "settled_early"
                              ? lang === "te"
                                ? "సెటిల్డ్"
                                : "Settled"
                              : lang === "te"
                              ? "పూర్తయింది"
                              : "Completed"}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] tabular-nums">
                          <div className="p-2 rounded-lg bg-white dark:bg-slate-800/70">
                            <span className="text-[9px] text-slate-500 block font-semibold">
                              {lang === "te" ? "ఇచ్చిన అసలు" : "Given"}
                            </span>
                            <span className="font-black text-slate-900 dark:text-white">
                              {formatCurrency(c.givenPrincipal)}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                            <span className="text-[9px] text-emerald-700 dark:text-emerald-400 block font-semibold">
                              {lang === "te" ? "వసూలు" : "Collected"}
                            </span>
                            <span className="font-black text-emerald-700 dark:text-emerald-300">
                              {formatCurrency(c.collected)}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/30">
                            <span className="text-[9px] text-rose-700 dark:text-rose-400 block font-semibold">
                              {lang === "te" ? "తరుగు" : "Shortage"}
                            </span>
                            <span className="font-black text-rose-700 dark:text-rose-300">
                              {formatCurrency(c.shortage)}
                            </span>
                          </div>
                          <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                            <span className="text-[9px] text-amber-700 dark:text-amber-400 block font-semibold">
                              {lang === "te"
                                ? `బాకీ (${c.weeksPaid}/${c.totalWeeks})`
                                : `Remaining (${c.weeksPaid}/${c.totalWeeks})`}
                            </span>
                            <span className="font-black text-amber-700 dark:text-amber-300">
                              {formatCurrency(c.remainingBalance)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {view === "weeks" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {allMondays.length === 0 ? (
            <div className="md:col-span-2 neu-card rounded-2xl p-8 text-center text-xs text-slate-600 dark:text-slate-400">
              {lang === "te" ? "ఇంకా వారం వసూలు రికార్డులు లేవు." : "No weekly collection records yet."}
            </div>
          ) : (
            allMondays.map((monday, idx) => {
              const weekDates = getWeekDates(monday);
              const wColls = allCollections.filter((c) => weekDates.includes(c.date));
              const wColl = wColls.reduce((s, c) => s + (c.totalCollected || 0), 0);
              const weekNum = allMondays.length - idx;

              return (
                <button
                  type="button"
                  key={monday}
                  onClick={() => setSelectedWeek(monday)}
                  className="w-full text-left neu-card rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-blue-500/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl neu-inset font-black text-blue-900 dark:text-blue-400 flex items-center justify-center text-sm tabular-nums">
                      W{weekNum}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                        {lang === "te" ? `వారం ${weekNum}` : `Week ${weekNum}`}
                      </h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        {formatDateIN(monday, lang)} → {formatDateIN(weekDates[6], lang)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <div className="font-black text-emerald-700 dark:text-emerald-400 text-sm tabular-nums">
                      {formatCurrency(wColl)}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {view === "villages" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.villages.map((v) => {
            const bs = data.borrowers[v.id] || [];
            const tL = bs.reduce((s, b) => s + b.loanAmt, 0);
            const vCols = allCollections.filter((c) => c.villageId === v.id);
            const vCollected = vCols.reduce((s, c) => s + (c.totalCollected || 0), 0);
            const vOutstanding = calculateOutstandingInField(bs);

            return (
              <div key={v.id} className="neu-card rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl badge-pastel-blue flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{v.name}</h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400">
                        {v.day} · {bs.length} {lang === "te" ? "ఖాతాదారులు" : "borrowers"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 neu-inset p-2.5 rounded-xl text-center text-xs tabular-nums">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">{lang === "te" ? "అప్పు" : "Lent"}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(tL)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">{lang === "te" ? "వసూలు" : "Collected"}</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(vCollected)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">{lang === "te" ? "బకాయి" : "Outstanding"}</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">{formatCurrency(vOutstanding)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
