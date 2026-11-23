import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Wallet,
  Banknote,
  Smartphone,
  Landmark,
  ArrowDownLeft,
  ArrowUpRight,
  Edit3,
  Check,
  X,
  Download,
  Printer,
  CalendarDays,
} from "lucide-react";
import type {
  BusinessProfile,
  CashOpeningMap,
  CollectionRecord,
  ExpenseItem,
  Language,
  NewLoanLogItem,
  PersonalUseItem,
} from "../types";
import { translations } from "../translations";
import {
  formatCurrency,
  formatDateIN,
  getDayName,
  getTodayStr,
} from "../utils/dateUtils";
import {
  calculateDailyCashbook,
  getAllCashbookDates,
} from "../utils/financeUtils";
import { buildCashbookCsv, downloadCsvFile } from "../utils/exportUtils";

interface CashbookTabProps {
  collections: Record<string, CollectionRecord>;
  expenses: ExpenseItem[];
  newLoansLog: NewLoanLogItem[];
  personalLog: PersonalUseItem[];
  openingBalances: CashOpeningMap;
  onUpdateOpeningBalance: (dateStr: string, amount: number) => void;
  profile: BusinessProfile;
  onUpdateProfile: (p: BusinessProfile) => void;
  lang: Language;
  showToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

function shiftDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = y && m && d ? new Date(y, m - 1, d, 12, 0, 0) : new Date();
  dt.setDate(dt.getDate() + days);
  return getTodayStr(dt);
}

export const CashbookTab: React.FC<CashbookTabProps> = ({
  collections,
  expenses,
  newLoansLog,
  personalLog,
  openingBalances,
  onUpdateOpeningBalance,
  profile,
  onUpdateProfile,
  lang,
  showToast,
}) => {
  const t = translations[lang];
  const todayStr = getTodayStr();
  const isCashbookEnabled = profile.enableDailyCashbook !== false;
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [editingOpening, setEditingOpening] = useState(false);
  const [openingInput, setOpeningInput] = useState("");

  const sources = useMemo(
    () => ({
      collections,
      expenses,
      newLoansLog,
      personalLog,
      openingBalances,
    }),
    [collections, expenses, newLoansLog, personalLog, openingBalances]
  );

  const summary = useMemo(
    () => calculateDailyCashbook(selectedDate, sources),
    [selectedDate, sources]
  );

  const allActiveDates = useMemo(
    () => getAllCashbookDates(sources, [todayStr]),
    [sources, todayStr]
  );

  const dayExpenses = useMemo(
    () => expenses.filter((e) => e.date === selectedDate),
    [expenses, selectedDate]
  );
  const dayNewLoans = useMemo(
    () => newLoansLog.filter((l) => l.date === selectedDate),
    [newLoansLog, selectedDate]
  );
  const dayPersonal = useMemo(
    () => personalLog.filter((p) => p.date === selectedDate),
    [personalLog, selectedDate]
  );

  const handleOpenEditOpening = () => {
    setOpeningInput(String(summary.openingCash || 0));
    setEditingOpening(true);
  };

  const handleSaveOpening = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Math.max(0, Math.round(Number(openingInput) || 0));
    onUpdateOpeningBalance(selectedDate, parsed);
    setEditingOpening(false);
  };

  const handleExportCsv = () => {
    const csv = buildCashbookCsv(allActiveDates, sources, lang);
    downloadCsvFile(`LineBook_Cashbook_${todayStr}.csv`, csv);
    showToast?.(
      lang === "te" ? "క్యాష్‌బుక్ CSV డౌన్‌లోడ్ అయింది ✓" : "Cashbook CSV downloaded ✓",
      "success"
    );
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isCashbookEnabled) {
    return (
      <div className="pb-28 px-4 pt-6 max-w-lg mx-auto">
        <div className="rounded-3xl p-6 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 mx-auto flex items-center justify-center">
            <Wallet className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {lang === "te" ? "రోజువారీ క్యాష్‌బుక్ ఆఫ్‌లో ఉంది" : "Daily Cashbook is Disabled"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {lang === "te"
                ? "మీరు రోజువారీ క్యాష్‌బుక్‌ను ఆఫ్ చేశారు. కావాలంటే ఇప్పుడే ఆన్ చేయవచ్చు (మీ రికార్డులు సురక్షితంగా ఉన్నాయి)."
                : "You turned off the Daily Cashbook feature. Enable it anytime below without losing any records."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onUpdateProfile({ ...profile, enableDailyCashbook: true });
              showToast?.(
                lang === "te" ? "రోజువారీ క్యాష్‌బుక్ ఆన్ చేయబడింది ✓" : "Daily Cashbook enabled ✓",
                "success"
              );
            }}
            className="w-full min-h-[44px] rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-black text-xs cursor-pointer transition-all"
          >
            {lang === "te" ? "రోజువారీ క్యాష్‌బుక్ ఆన్ చేయండి" : "Enable Daily Cashbook"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28 px-4 pt-3 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto space-y-4">
      {/* Feature Toggle Strip */}
      <div className="rounded-2xl px-3.5 py-2.5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 print:hidden">
        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
          {lang === "te" ? "📒 రోజువారీ క్యాష్‌బుక్ యాక్టివ్" : "📒 Daily Cashbook Active"}
        </span>
        <button
          type="button"
          onClick={() => {
            onUpdateProfile({ ...profile, enableDailyCashbook: false });
            showToast?.(
              lang === "te" ? "రోజువారీ క్యాష్‌బుక్ ఆఫ్ చేయబడింది" : "Daily Cashbook disabled",
              "info"
            );
          }}
          className="px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-[11px] font-extrabold cursor-pointer"
        >
          {lang === "te" ? "ఆఫ్ చేయండి" : "Disable"}
        </button>
      </div>

      {/* Date Navigation Bar */}
      <div className="rounded-2xl p-3 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5 print:hidden">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => setSelectedDate(shiftDateStr(selectedDate, -1))}
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex-1 flex items-center justify-center gap-2 min-w-0">
            <CalendarDays className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
            <input
              type="date"
              aria-label="Select cashbook date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 outline-none"
            />
            {selectedDate !== todayStr && (
              <button
                type="button"
                onClick={() => setSelectedDate(todayStr)}
                className="px-2.5 py-1.5 rounded-lg bg-[#1E3A8A] text-white text-[11px] font-bold cursor-pointer shrink-0"
              >
                {lang === "te" ? "ఈరోజు" : "Today"}
              </button>
            )}
          </div>

          <button
            type="button"
            aria-label="Next day"
            onClick={() => setSelectedDate(shiftDateStr(selectedDate, 1))}
            className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 shrink-0"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Active Dates Strip */}
        {allActiveDates.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {allActiveDates.slice(0, 8).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDate(d)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold whitespace-nowrap border cursor-pointer transition-all ${
                  selectedDate === d
                    ? "bg-[#1E3A8A] border-[#1E3A8A] text-white"
                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                }`}
              >
                {d === todayStr
                  ? lang === "te"
                    ? "ఈరోజు"
                    : "Today"
                  : formatDateIN(d, lang)}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Hero Closing Cash in Bag Card */}
      <div className="rounded-3xl p-5 bg-gradient-to-br from-[#0B1728] via-[#102A45] to-[#0A121E] text-white shadow-xl border border-slate-700/60 border-t-2 border-t-amber-400 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-widest text-amber-300 block">
              {getDayName(selectedDate, lang)} · {formatDateIN(selectedDate, lang)}
            </span>
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider mt-1">
              {t.closingCashInBag}
            </h2>
            <div
              data-testid="closing-bag-cash"
              className={`text-3xl sm:text-4xl font-black tracking-tight tabular-nums mt-0.5 ${
                summary.closingCashInBag < 0 ? "text-rose-300" : "text-white"
              }`}
            >
              {formatCurrency(summary.closingCashInBag)}
            </div>
          </div>

          <div className="flex items-center gap-1.5 print:hidden">
            <button
              type="button"
              onClick={handleExportCsv}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold flex items-center gap-1.5 border border-white/15 cursor-pointer"
              title={t.exportCsv}
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="min-h-[40px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-[11px] font-extrabold flex items-center gap-1.5 cursor-pointer"
              title={t.printPdf}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Opening Bag Cash Row + Inline Edit */}
        <div className="p-3 rounded-2xl bg-white/10 border border-white/10 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-amber-400" />
              <span>{t.openingCash}</span>
              {summary.carriedFromDate && !summary.isOpeningExplicit && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-200 border border-sky-400/30">
                  {lang === "te"
                    ? `క్యారీ ఫార్వర్డ్`
                    : `Auto-carried`}
                </span>
              )}
            </div>
            <div className="text-lg font-black text-amber-300 tabular-nums" data-testid="opening-bag-cash">
              {formatCurrency(summary.openingCash)}
            </div>
          </div>

          {!editingOpening ? (
            <button
              type="button"
              onClick={handleOpenEditOpening}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer print:hidden"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{lang === "te" ? "ప్రారంభ నగదు సవరించు" : "Set Opening"}</span>
            </button>
          ) : (
            <form onSubmit={handleSaveOpening} className="flex items-center gap-1.5 print:hidden">
              <input
                type="number"
                required
                min={0}
                aria-label="Opening cash amount"
                value={openingInput}
                onChange={(e) => setOpeningInput(e.target.value)}
                className="w-28 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-amber-400 text-white text-sm font-bold outline-none tabular-nums"
              />
              <button
                type="submit"
                aria-label="Save opening cash"
                className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center cursor-pointer"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label="Cancel opening cash edit"
                onClick={() => setEditingOpening(false)}
                className="w-9 h-9 rounded-xl bg-white/15 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        {/* Reconciliation Formula Bar */}
        <div className="grid grid-cols-3 gap-2 text-center pt-1 text-xs tabular-nums">
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-400/25 p-2">
            <span className="text-[10px] text-emerald-200 block font-semibold">
              {lang === "te" ? "+ క్యాష్ వసూలు" : "+ Cash In"}
            </span>
            <span className="font-black text-emerald-300">
              {formatCurrency(summary.cashCollected)}
            </span>
          </div>
          <div className="rounded-xl bg-sky-500/15 border border-sky-400/25 p-2">
            <span className="text-[10px] text-sky-200 block font-semibold">
              {lang === "te" ? "UPI / ఆన్‌లైన్" : "PhonePe / Bank"}
            </span>
            <span className="font-black text-sky-300">
              {formatCurrency(summary.digitalCollected)}
            </span>
          </div>
          <div className="rounded-xl bg-rose-500/15 border border-rose-400/25 p-2">
            <span className="text-[10px] text-rose-200 block font-semibold">
              {lang === "te" ? "− మొత్తం ఖర్చులు" : "− Outflows"}
            </span>
            <span className="font-black text-rose-300">
              {formatCurrency(summary.totalOutflows)}
            </span>
          </div>
        </div>
      </div>

      {/* Inflows vs Outflows Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Inflows by Payment Mode */}
        <div className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                {lang === "te" ? "వసూళ్లు (రకం వారీగా)" : "Collections (Inflows)"}
              </h3>
            </div>
            <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
              {formatCurrency(summary.totalCollected)}
            </span>
          </div>

          <div className="space-y-2 text-xs tabular-nums">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70">
              <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                <Banknote className="w-4 h-4 text-emerald-600" />
                {lang === "te" ? "చేతి నగదు (బ్యాగ్)" : "Physical Cash (Bag)"}
              </span>
              <span className="font-black text-slate-900 dark:text-slate-100">
                {formatCurrency(summary.cashCollected)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70">
              <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                <Smartphone className="w-4 h-4 text-purple-600" />
                PhonePe UPI
              </span>
              <span className="font-black text-slate-900 dark:text-slate-100">
                {formatCurrency(summary.phonePeCollected)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70">
              <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-300">
                <Landmark className="w-4 h-4 text-sky-600" />
                {lang === "te" ? "ఆన్‌లైన్ / బ్యాంక్" : "Online / Bank"}
              </span>
              <span className="font-black text-slate-900 dark:text-slate-100">
                {formatCurrency(summary.onlineCollected)}
              </span>
            </div>
          </div>
        </div>

        {/* Outflows */}
        <div className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                {lang === "te" ? "బయటకు వెళ్లిన సొమ్ము" : "Cash Outflows"}
              </h3>
            </div>
            <span className="text-sm font-black text-rose-600 dark:text-rose-400 tabular-nums">
              {formatCurrency(summary.totalOutflows)}
            </span>
          </div>

          <div className="space-y-2 text-xs tabular-nums">
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                🆕 {lang === "te" ? "ఇచ్చిన కొత్త అప్పులు" : "New Loans Disbursed"} ({dayNewLoans.length})
              </span>
              <span className="font-black text-slate-900 dark:text-slate-100">
                {formatCurrency(summary.newLoansTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                🧾 {lang === "te" ? "ఫీల్డ్ ఖర్చులు" : "Field Expenses"} ({dayExpenses.length})
              </span>
              <span className="font-black text-slate-900 dark:text-slate-100">
                {formatCurrency(summary.expensesTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70">
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                🏠 {lang === "te" ? "వ్యక్తిగత / ఇంటి వాడకం" : "Personal Drawings"} ({dayPersonal.length})
              </span>
              <span className="font-black text-slate-900 dark:text-slate-100">
                {formatCurrency(summary.personalTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Itemized Activity Register for Selected Date */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400 px-1">
          {lang === "te"
            ? `${formatDateIN(selectedDate, lang)} రోజువారీ చిట్టా`
            : `Day Register — ${formatDateIN(selectedDate, lang)}`}
        </h3>

        {summary.villageBreakdowns.length === 0 &&
        dayNewLoans.length === 0 &&
        dayExpenses.length === 0 &&
        dayPersonal.length === 0 ? (
          <div className="rounded-2xl p-6 text-center bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            {lang === "te"
              ? "ఈ తేదీలో వసూళ్లు లేదా ఖర్చులు నమోదు కాలేదు."
              : "No collections, loans, or expenses recorded on this date."}
          </div>
        ) : (
          <div className="space-y-2">
            {summary.villageBreakdowns.map((v) => (
              <div
                key={v.villageId}
                className="rounded-2xl p-3.5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    ✅ {v.villageName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                    {lang === "te" ? "క్యాష్:" : "Cash:"} {formatCurrency(v.cashCollected)} · PhonePe:{" "}
                    {formatCurrency(v.phonePeCollected)} · Bank: {formatCurrency(v.onlineCollected)}
                  </div>
                </div>
                <div className="text-right font-black text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0">
                  +{formatCurrency(v.totalCollected)}
                </div>
              </div>
            ))}

            {dayNewLoans.map((l) => (
              <div
                key={l.id}
                className="rounded-2xl p-3.5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    🆕 {l.seqNo ? `#${l.seqNo} ` : ""}
                    {l.borrowerName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {l.villageName} · {lang === "te" ? "కొత్త అప్పు" : "New Loan Issued"}
                  </div>
                </div>
                <div className="font-black text-rose-600 dark:text-rose-400 tabular-nums shrink-0">
                  -{formatCurrency(l.loanAmt)}
                </div>
              </div>
            ))}

            {dayExpenses.map((e) => (
              <div
                key={e.id}
                className="rounded-2xl p-3.5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    🧾 {e.desc}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase">
                    {e.cat} · {lang === "te" ? "లైన్ ఖర్చు" : "Expense"}
                  </div>
                </div>
                <div className="font-black text-rose-600 dark:text-rose-400 tabular-nums shrink-0">
                  -{formatCurrency(e.amt)}
                </div>
              </div>
            ))}

            {dayPersonal.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl p-3.5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                    🏠 {p.note || (lang === "te" ? "వ్యక్తిగత ఖర్చు" : "Personal Cash")}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {lang === "te" ? "సొంత అవసరాలు" : "Personal Withdrawal"}
                  </div>
                </div>
                <div className="font-black text-amber-700 dark:text-amber-400 tabular-nums shrink-0">
                  -{formatCurrency(p.amt)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
