import React, { useState, useMemo } from "react";
import {
  Eye,
  EyeOff,
  Coins,
  UserPlus,
  Receipt,
  BarChart3,
  AlertCircle,
  PiggyBank,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowLeft,
  Wallet,
  HandCoins,
  Bell,
  MessageCircle,
} from "lucide-react";
import {
  Borrower,
  Village,
  CollectionRecord,
  ExpenseItem,
  NewLoanLogItem,
  PersonalUseItem,
  BusinessProfile,
  Language,
  ThemeMode,
} from "../types";
import { translations } from "../translations";
import {
  formatCurrency,
  formatDateIN,
  getDayName,
  getMondayOfWeek,
  getWeekDates,
  getTodayStr,
} from "../utils/dateUtils";
import {
  calculateOutstandingInField,
  calculateTotalPersonalUse,
  calculateTodayCashInBag,
  calculateNetProfit,
  calculateTotalShortfall,
  calculateRemainingBalance,
  calculateTotalPaid,
} from "../utils/financeUtils";
import { PWAInstallBanner } from "./PWAInstallBanner";
import { WhatsAppReminderCenter } from "./WhatsAppReminderCenter";
import { getTwoDayAdvanceInfo } from "../utils/whatsapp";

interface HomeTabProps {
  data: { villages: Village[]; borrowers: Record<string, Borrower[]> };
  collections: Record<string, CollectionRecord>;
  expenses: ExpenseItem[];
  newLoansLog: NewLoanLogItem[];
  personalLog: PersonalUseItem[];
  profile: BusinessProfile;
  lang: Language;
  theme?: ThemeMode;
  onNavigateTab: (tab: any) => void;
  onRecordPersonalUse: (amt: number, note: string) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  data,
  collections,
  expenses,
  newLoansLog,
  personalLog,
  profile,
  lang,
  theme = "light",
  onNavigateTab,
  onRecordPersonalUse,
}) => {
  const [showBalance, setShowBalance] = useState(true);
  const [personalModal, setPersonalModal] = useState(false);
  const [personalAmt, setPersonalAmt] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [selectedWeekDetail, setSelectedWeekDetail] = useState<string | null>(null);
  const [showReminderCenter, setShowReminderCenter] = useState(false);

  const advanceInfo = useMemo(() => getTwoDayAdvanceInfo(data.villages), [data.villages]);

  const t = translations[lang];
  const todayStr = getTodayStr();
  const dayOfWeek = getDayName(todayStr, "en");

  const allBorrowers = Object.values(data.borrowers).flat();
  const totalLent = allBorrowers.reduce((s, b) => s + (b.loanAmt || 0), 0);
  const totalReturn = allBorrowers.reduce(
    (s, b) => s + (b.totalReturn || b.weeklyDue * (b.durationWeeks || 12)),
    0
  );
  const totalInterest = totalReturn - totalLent;

  // Real Outstanding Balance still owed by borrowers in the field (Fix D8)
  const outstandingInField = calculateOutstandingInField(allBorrowers);

  const totalCollected = Object.values(collections).reduce(
    (s, c) => s + (c.totalCollected || 0),
    0
  );
  // Source of truth for personal use withdrawals (Fix D6)
  const totalPersonal = calculateTotalPersonalUse(personalLog, collections);
  const totalExpenses = expenses.reduce((s, e) => s + (e.amt || 0), 0);
  const netProfit = calculateNetProfit(totalCollected, totalExpenses, totalPersonal);

  const activeCount = allBorrowers.filter(
    (b) => b.weeksPaid < (b.durationWeeks || 12)
  ).length;
  const completedCount = allBorrowers.filter(
    (b) => b.weeksPaid >= (b.durationWeeks || 12)
  ).length;

  // Total Unpaid Short Amount across active borrowers (Fix D3)
  const totalShortAmount = allBorrowers.reduce(
    (sum, b) => sum + calculateTotalShortfall(b),
    0
  );

  // Today's scheduled villages on the LINE
  const todayLineVillages = data.villages.filter((v) => v.day === dayOfWeek);

  // Today's collections
  const todayColls = Object.values(collections).filter((c) => c.date === todayStr);
  const todayCollectedAmt = todayColls.reduce((s, c) => s + (c.totalCollected || 0), 0);

  // Today's expenses
  const todayExpenses = expenses.filter((e) => e.date === todayStr);
  const todayExpAmt = todayExpenses.reduce((s, e) => s + (e.amt || 0), 0);

  // Today's new loans
  const todayNewLoans = newLoansLog.filter((l) => l.date === todayStr);
  const todayNewLoansAmt = todayNewLoans.reduce((s, l) => s + (l.loanAmt || 0), 0);

  // Today's personal withdrawals (Fix D6)
  const todayPersonal = (personalLog || []).filter((p) => p.date === todayStr);
  const todayPersonalAmt = todayPersonal.reduce((s, p) => s + (p.amt || 0), 0);

  // Cash in Hand / Bag for today (Fix D6 & D8)
  const lineBagCash = calculateTodayCashInBag(
    todayCollectedAmt,
    todayExpAmt,
    todayNewLoansAmt,
    todayPersonalAmt
  );

  // Weeks list for reports
  const allMondays = Array.from(
    new Set(Object.values(collections).map((c) => getMondayOfWeek(c.date)))
  ).sort((a, b) => b.localeCompare(a));

  const handleSavePersonal = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(personalAmt);
    if (!isNaN(val) && val > 0) {
      onRecordPersonalUse(val, personalNote || "Personal / Home cash withdrawal");
      setPersonalAmt("");
      setPersonalNote("");
      setPersonalModal(false);
    }
  };

  // If viewing a specific week's details
  if (selectedWeekDetail) {
    const weekDates = getWeekDates(selectedWeekDetail);
    const weekColls = Object.values(collections).filter((c) => weekDates.includes(c.date));
    const wColl = weekColls.reduce((s, c) => s + (c.totalCollected || 0), 0);
    const wExp = weekColls.reduce((s, c) => s + (c.totalExpected || 0), 0);
    const wShort = Math.max(wExp - wColl, 0);

    return (
      <div className="p-4 sm:p-5 space-y-4 pb-28">
        {/* Prominent Back Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedWeekDetail(null)}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-all"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-black text-slate-900 dark:text-slate-100">
              {lang === "te" ? "వారం నివేదిక" : "Weekly Report"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {formatDateIN(selectedWeekDetail, lang)} → {formatDateIN(weekDates[6], lang)}
            </p>
          </div>
        </div>

        {/* Big Total Collected Card */}
        <div className="rounded-3xl p-5 text-center bg-gradient-to-br from-emerald-600 via-teal-700 to-emerald-900 text-white shadow-xl shadow-emerald-950/20 border border-emerald-500/30">
          <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">
            {lang === "te" ? "ఈ వారం వసూలు" : "Total Collected This Week"}
          </span>
          <div className="text-3xl font-black text-white mt-1">
            {formatCurrency(wColl)}
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-white/20 text-xs font-semibold">
            <span className="text-emerald-100">
              {lang === "te" ? "లక్ష్యం:" : "Target:"} {formatCurrency(wExp)}
            </span>
            {wShort > 0 && (
              <span className="text-amber-300 font-bold">
                {lang === "te" ? "తరుగు:" : "Shortfall:"} -{formatCurrency(wShort)}
              </span>
            )}
          </div>
        </div>

        {/* Village breakdown for this week */}
        <div className="space-y-3">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            {lang === "te" ? "గ్రామాల వారీగా వసూళ్లు" : "Village Collections"}
          </h3>

          {weekColls.length === 0 ? (
            <div className="rounded-2xl p-6 text-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              {lang === "te" ? "ఈ వారంలో వసూళ్లు లేవు" : "No collection recorded for this week."}
            </div>
          ) : (
            weekColls.map((c) => (
              <div
                key={`${c.villageId}_${c.date}`}
                className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {c.villageName}
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      {formatDateIN(c.date, lang)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(c.totalCollected)}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {lang === "te" ? "లక్ష్యం:" : "target"} {formatCurrency(c.totalExpected)}
                    </div>
                  </div>
                </div>

                {/* Entries List */}
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  {(c.entries || []).map((entry, idx) => {
                    const b = (data.borrowers[c.villageId] || []).find((x) => x.id === entry.borrowerId);
                    const isPaid = entry.status === "paid";
                    const isSkip = entry.status === "skip";
                    const isShort = entry.status === "short";
                    const isExtra = entry.status === "extra";

                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-slate-50 dark:bg-slate-800/50"
                      >
                        <div className="flex items-center gap-1.5 truncate max-w-[70%]">
                          <span className="text-xs">
                            {isPaid ? "✅" : isSkip ? "❌" : isShort ? "⚡" : "➕"}
                          </span>
                          <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                            {b?.seqNo ? `#${b.seqNo} ` : ""}
                            {b?.name || "Borrower"}
                          </span>
                          {entry.payMethod && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">
                              ({entry.payMethod})
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {isSkip ? "—" : formatCurrency(entry.amtPaid)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 space-y-5 pb-28">
      {/* In-App PWA Install Banner */}
      <PWAInstallBanner lang={lang} />

      {/* 1. UPGRADED TOTAL BALANCE CARD - Luxurious Jewel Surface */}
      <div className="rounded-3xl p-5 sm:p-6 relative overflow-hidden bg-gradient-to-br from-[#0B1728] via-[#102A45] to-[#0A121E] text-white shadow-xl shadow-slate-900/30 border border-slate-700/60 border-t-2 border-t-amber-400">
        {/* Subtle decorative background watermarks */}
        <div className="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-amber-400/5 blur-2xl pointer-events-none" />
        <div className="absolute -left-8 -top-8 w-36 h-36 rounded-full bg-blue-500/10 blur-2xl pointer-events-none" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">
              {lang === "te" ? "ఫీల్డులో ఉన్న బకాయి (సర్క్యులేషన్)" : "Outstanding in Field"}
            </span>
          </div>

          <button
            onClick={() => setShowBalance(!showBalance)}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 flex items-center justify-center text-slate-200 cursor-pointer transition-all border border-white/10"
            title={showBalance ? "Hide Balance" : "Show Balance"}
          >
            {showBalance ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
        </div>

        {/* Balance Display */}
        <div className="mt-3 relative z-10">
          <div className="text-3xl sm:text-4xl font-black text-white tracking-tight font-sans">
            {showBalance ? formatCurrency(outstandingInField) : "₹ ••••••••"}
          </div>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap text-xs">
            <span className="font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
              {lang === "te" ? "అప్పు:" : "Lent:"} {formatCurrency(totalLent)}
            </span>
            <span className="font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              ↑ {formatCurrency(totalCollected)} {lang === "te" ? "వసూలు" : "collected"}
            </span>
            <span className="font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {activeCount} {lang === "te" ? "యాక్టివ్" : "active"}
            </span>
          </div>
        </div>

        {/* Quick In-Hand Cash Strip */}
        <div className="mt-4 pt-3.5 border-t border-white/10 flex items-center justify-between text-xs font-semibold relative z-10">
          <div className="flex items-center gap-1.5 text-slate-300">
            <Coins className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {lang === "te" ? "లైన్ క్యాష్ (నేటి చేతిలో):" : "Line Cash in Hand:"}
            </span>
          </div>
          <span className="text-amber-300 font-black text-sm tracking-wide">
            {showBalance ? formatCurrency(lineBagCash) : "₹ •••••"}
          </span>
        </div>
      </div>

      {/* 2. FOUR REFINED SQUIRCLE QUICK ACTIONS (Structure from Image 2, Colours from Image 1) */}
      <div className="grid grid-cols-4 gap-2.5 text-center pt-1">
        {/* 1. Start Line Collection */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onNavigateTab("collect")}
            style={{ backgroundColor: "#0E1726" }}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-[22px] flex items-center justify-center border border-slate-700/60 shadow-[0_4px_14px_rgba(0,0,0,0.18)] hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            title="Start Line Collection"
          >
            <HandCoins className="w-6 h-6 sm:w-7 sm:h-7 text-[#FBBF24] group-hover:scale-110 transition-transform" strokeWidth={2.2} />
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">
            {lang === "te" ? "లైన్ వసూలు" : "Start Line"}
          </span>
        </div>

        {/* 2. New Loan */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onNavigateTab("collect")}
            style={{ backgroundColor: "#0E1726" }}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-[22px] flex items-center justify-center border border-slate-700/60 shadow-[0_4px_14px_rgba(0,0,0,0.18)] hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            title="Add New Loan"
          >
            <UserPlus className="w-6 h-6 sm:w-7 sm:h-7 text-[#38BDF8] group-hover:scale-110 transition-transform" strokeWidth={2.2} />
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">
            {lang === "te" ? "కొత్త అప్పు" : "New Loan"}
          </span>
        </div>

        {/* 3. Expenses */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onNavigateTab("expenses")}
            style={{ backgroundColor: "#0E1726" }}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-[22px] flex items-center justify-center border border-slate-700/60 shadow-[0_4px_14px_rgba(0,0,0,0.18)] hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            title="Expenses & Fuel"
          >
            <Receipt className="w-6 h-6 sm:w-7 sm:h-7 text-[#F43F5E] group-hover:scale-110 transition-transform" strokeWidth={2.2} />
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">
            {lang === "te" ? "ఖర్చులు" : "Expenses"}
          </span>
        </div>

        {/* 4. Reports & History */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onNavigateTab("reports")}
            style={{ backgroundColor: "#0E1726" }}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-[22px] flex items-center justify-center border border-slate-700/60 shadow-[0_4px_14px_rgba(0,0,0,0.18)] hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            title="Reports & Analytics"
          >
            <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-[#10B981] group-hover:scale-110 transition-transform" strokeWidth={2.2} />
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 tracking-tight">
            {lang === "te" ? "నివేదికలు" : "Reports"}
          </span>
        </div>
      </div>

      {/* Quick Personal Cash Withdrawal Action Button */}
      <button
        onClick={() => setPersonalModal(true)}
        style={{ backgroundColor: "#3c539a" }}
        className="w-full py-2.5 px-4 rounded-2xl border border-dashed border-amber-600/40 text-xs font-bold flex items-center justify-center gap-2 hover:opacity-95 active:scale-98 transition-all cursor-pointer"
      >
        <span>🏠</span>
        <span style={{ color: "#c0b2b2" }}>
          {lang === "te"
            ? "నేటి వసూళ్ల నుండి వ్యక్తిగత/ఇంటి ఖర్చు నమోదు చేయండి"
            : "Record Personal / Home Use Cash Withdrawal"}
        </span>
      </button>

      {/* 2-Day Advance WhatsApp Pre-Collection Reminders Alert Card */}
      <div className="rounded-2xl p-4 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-300/60 dark:border-amber-700/60 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-md">
            <Bell className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                {advanceInfo.isTwoDaysAhead
                  ? lang === "te"
                    ? "⚡ 2 రోజుల ముందస్తు రిమైండర్"
                    : "⚡ 2-Day Reminder Active"
                  : lang === "te"
                  ? "లైన్ రిమైండర్లు"
                  : "Line Reminders"}
              </span>
            </div>
            <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
              {advanceInfo.targetDayName} Line (
              {advanceInfo.matchingVillages.map((v) => v.name).join(", ") || "Upcoming"}
              )
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {lang === "te"
                ? "ఖాతాదారులకు వారం వాయిదా వాట్సాప్ రిమైండర్లు పంపండి"
                : "Send advance WhatsApp collection notices to borrowers"}
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowReminderCenter(true)}
          className="py-2.5 px-3.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-xs flex items-center gap-1.5 shrink-0 shadow-md cursor-pointer transition-all active:scale-95"
        >
          <MessageCircle className="w-4 h-4 fill-white" />
          <span>{lang === "te" ? "రిమైండర్లు" : "Send"}</span>
        </button>
      </div>

      {/* 3. FINANCE SUMMARY (2x2 Grid) - Adaptive & Premium */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {lang === "te" ? "ఆర్థిక సారాంశం" : "Finance Summary"}
          </h2>
          <button
            onClick={() => onNavigateTab("reports")}
            className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-0.5 hover:underline cursor-pointer"
          >
            <span>{lang === "te" ? "అన్నీ చూడండి" : "View All"}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3.5">
          {/* Active Loans */}
          <div
            onClick={() => onNavigateTab("borrowers")}
            className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm cursor-pointer hover:border-blue-500/50 active:scale-98 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                {lang === "te" ? "యాక్టివ్ అప్పులు" : "Active Loans"}
              </span>
              <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5">
                {activeCount} {lang === "te" ? "ఖాతాలు" : "Loans"}
              </div>
            </div>
          </div>

          {/* Line Collections */}
          <div
            onClick={() => onNavigateTab("reports")}
            className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm cursor-pointer hover:border-emerald-500/50 active:scale-98 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                {lang === "te" ? "లైన్ వసూళ్లు" : "Line Collections"}
              </span>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {formatCurrency(totalCollected)}
              </div>
            </div>
          </div>

          {/* Unpaid Short Amount */}
          <div
            onClick={() => onNavigateTab("borrowers")}
            className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm cursor-pointer hover:border-purple-500/50 active:scale-98 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                {lang === "te" ? "తరుగు బ్యాలెన్స్" : "Unpaid Short"}
              </span>
              <div className="text-lg font-black text-purple-600 dark:text-purple-400 mt-0.5">
                {formatCurrency(totalShortAmount)}
              </div>
            </div>
          </div>

          {/* Expenses & Fuel */}
          <div
            onClick={() => onNavigateTab("expenses")}
            className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm cursor-pointer hover:border-amber-500/50 active:scale-98 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <PiggyBank className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                {lang === "te" ? "ఖర్చులు & పెట్రోల్" : "Expenses & Rent"}
              </span>
              <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5">
                {formatCurrency(totalExpenses)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Today's Scheduled Line Villages Alert */}
      {todayLineVillages.length > 0 && (
        <div className="rounded-2xl p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
                📍
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {lang === "te" ? "నేటి లైన్ గ్రామాలు" : "Today's Line Route"}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                  {todayLineVillages.map((v) => v.name).join(", ")}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigateTab("collect")}
              className="px-3.5 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer shadow-sm active:scale-95 transition-all"
            >
              {lang === "te" ? "ప్రారంభించు" : "Start"}
            </button>
          </div>
        </div>
      )}

      {/* 5. Completed Weeks on Line */}
      {allMondays.length > 0 && (
        <div className="space-y-3 pt-1">
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight px-1">
            {lang === "te" ? "పూర్తయిన వారాల రికార్డులు" : "Completed Weeks on Line"}
          </h2>

          <div className="space-y-2.5">
            {allMondays.slice(0, 4).map((monday, i) => {
              const weekDates = getWeekDates(monday);
              const weekColls = Object.values(collections).filter((c) =>
                weekDates.includes(c.date)
              );
              const wColl = weekColls.reduce((s, c) => s + (c.totalCollected || 0), 0);
              const weekNumber = allMondays.length - i;

              return (
                <div
                  key={monday}
                  onClick={() => setSelectedWeekDetail(monday)}
                  className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-500/40 active:scale-99 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 font-black text-sm text-blue-600 dark:text-blue-400 flex items-center justify-center">
                      W{weekNumber}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {lang === "te" ? `వారం ${weekNumber}` : `Week ${weekNumber}`}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        {formatDateIN(monday, lang)} → {formatDateIN(weekDates[6], lang)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <div>
                      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(wColl)}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {weekColls.length} {lang === "te" ? "గ్రామాలు" : "visits"}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Personal Use Modal Dialog */}
      {personalModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setPersonalModal(false)}
        >
          <div className="w-full max-w-sm rounded-3xl p-5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                {lang === "te" ? "వ్యక్తిగత ఖర్చు నమోదు" : "Record Personal Cash"}
              </h3>
              <button
                onClick={() => setPersonalModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center cursor-pointer hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === "te"
                ? "నేటి వసూలు నగదు నుండి మీరు తీసుకున్న సొంత ఖర్చు."
                : "Cash taken from today's collection for home/personal use."}
            </p>

            <form onSubmit={handleSavePersonal} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {lang === "te" ? "మొత్తం (₹) *" : "Amount (₹) *"}
                </label>
                <input
                  type="number"
                  required
                  value={personalAmt}
                  onChange={(e) => setPersonalAmt(e.target.value)}
                  placeholder="e.g. 1000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {lang === "te" ? "వివరణ (ఐచ్ఛికం)" : "Note (Optional)"}
                </label>
                <input
                  type="text"
                  value={personalNote}
                  onChange={(e) => setPersonalNote(e.target.value)}
                  placeholder={lang === "te" ? "ఉదా: ఇంటి ఖర్చు, కిరాణా" : "e.g. groceries, medical"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPersonalModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {lang === "te" ? "రద్దు" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer shadow-md"
                >
                  {lang === "te" ? "సేవ్ చేయండి" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2-Day WhatsApp Reminder Center Modal */}
      {showReminderCenter && (
        <WhatsAppReminderCenter
          data={data}
          profile={profile}
          lang={lang}
          onClose={() => setShowReminderCenter(false)}
        />
      )}
    </div>
  );
};
