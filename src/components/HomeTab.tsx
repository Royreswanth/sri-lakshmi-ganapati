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
  Calendar,
  ArrowLeft,
  Wallet,
  HandCoins,
  Bell,
  MessageCircle,
  Calculator,
  BookOpen,
  ClipboardList,
  CheckCircle2,
  Circle,
  Sparkles,
  X,
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
  ALL_DAYS_MON_FIRST,
  formatCurrency,
  formatDateIN,
  getDayName,
  getMondayOfWeek,
  getWeekDates,
  getTodayStr,
  translateDayName,
} from "../utils/dateUtils";
import {
  calculateOutstandingInField,
  calculateLineCashStatus,
  calculateNetProfit,
  calculateTotalShortfall,
  isBorrowerClosed,
} from "../utils/financeUtils";
import { PWAInstallBanner } from "./PWAInstallBanner";
import { WhatsAppReminderCenter } from "./WhatsAppReminderCenter";
import {
  getTwoDayAdvanceInfo,
  getWhatsAppRules,
  shouldShowReminderBanner,
} from "../utils/whatsapp";
import { computeOnboardingProgress, OnboardingStepId } from "../utils/onboardingUtils";

interface HomeTabProps {
  data: { villages: Village[]; borrowers: Record<string, Borrower[]> };
  collections: Record<string, CollectionRecord>;
  expenses: ExpenseItem[];
  newLoansLog: NewLoanLogItem[];
  personalLog: PersonalUseItem[];
  profile: BusinessProfile;
  hasBackup?: boolean;
  lang: Language;
  theme?: ThemeMode;
  onNavigateTab: (
    tab: any,
    settingsSection?: any,
    reportsView?: "summary" | "recordBook" | "weeks" | "villages"
  ) => void;
  onRecordPersonalUse: (amt: number, note: string) => void;
  onUpdateProfile: (p: BusinessProfile) => void;
}

export const HomeTab: React.FC<HomeTabProps> = ({
  data,
  collections,
  expenses,
  newLoansLog,
  personalLog,
  profile,
  hasBackup = false,
  lang,
  theme = "light",
  onNavigateTab,
  onRecordPersonalUse,
  onUpdateProfile,
}) => {
  const [showBalance, setShowBalance] = useState(true);
  const [personalModal, setPersonalModal] = useState(false);
  const [personalAmt, setPersonalAmt] = useState("");
  const [personalNote, setPersonalNote] = useState("");
  const [selectedWeekDetail, setSelectedWeekDetail] = useState<string | null>(null);
  const [showReminderCenter, setShowReminderCenter] = useState(false);
  const [scheduleModeDraft, setScheduleModeDraft] = useState<"specific" | "daily">(
    profile.lineDaysMode || "specific"
  );
  const [scheduleDaysDraft, setScheduleDaysDraft] = useState(
    profile.lineDays && profile.lineDays.length > 0
      ? profile.lineDays
      : (["Monday", "Tuesday"] as typeof ALL_DAYS_MON_FIRST)
  );
  const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("slg_onboarding_dismissed") === "true";
    } catch {
      return false;
    }
  });

  const advanceInfo = useMemo(() => getTwoDayAdvanceInfo(data.villages), [data.villages]);
  const waRules = getWhatsAppRules();
  const showWaReminderBanner = shouldShowReminderBanner(data, waRules);

  const t = translations[lang];
  const todayStr = getTodayStr();
  const dayOfWeek = getDayName(todayStr, "en");

  const allBorrowers = Object.values(data.borrowers).flat();
  const onboarding = useMemo(
    () =>
      computeOnboardingProgress({
        profile,
        villagesCount: data.villages.length,
        borrowersCount: allBorrowers.length,
        hasCloudOrLocalBackup: hasBackup,
      }),
    [profile, data.villages.length, allBorrowers.length, hasBackup]
  );

  const handleOnboardingStepClick = (stepId: OnboardingStepId) => {
    if (stepId === "profile") onNavigateTab("settings", "profile");
    else if (stepId === "village") onNavigateTab("settings", "villages");
    else if (stepId === "borrower") {
      onNavigateTab(data.villages.length > 0 ? "collect" : "borrowers");
    } else if (stepId === "backup") onNavigateTab("settings", "backup");
  };

  const handleDismissOnboarding = () => {
    setOnboardingDismissed(true);
    try {
      localStorage.setItem("slg_onboarding_dismissed", "true");
    } catch {}
  };
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
  // Real Line Cash in Hand + 2-day automatic Home-Taken recognition
  const lineCashStatus = calculateLineCashStatus({
    collections,
    newLoansLog,
    expenses,
    personalLog,
    todayStr,
  });
  const totalPersonal = lineCashStatus.totalTakenCash;
  const totalExpenses = expenses.reduce((s, e) => s + (e.amt || 0), 0);
  const netProfit = calculateNetProfit(totalCollected, totalExpenses, totalPersonal);

  const activeCount = allBorrowers.filter((b) => !isBorrowerClosed(b)).length;
  const completedCount = allBorrowers.filter((b) => isBorrowerClosed(b)).length;

  // Total Unpaid Short Amount across active borrowers (Fix D3)
  const totalShortAmount = allBorrowers.reduce(
    (sum, b) => sum + calculateTotalShortfall(b),
    0
  );

  // Today's scheduled villages on the LINE
  const todayLineVillages = data.villages.filter((v) => v.day === dayOfWeek);

  // Live accumulated physical Cash in Hand on the line (auto-deducted for new loans & auto home-taken after 2 days)
  const lineBagCash = lineCashStatus.lineCashInHand;

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
          <div className="text-3xl sm:text-4xl font-black text-white tracking-tight font-sans tabular-nums">
            {showBalance ? formatCurrency(outstandingInField) : "₹ ••••••••"}
          </div>

          <div className="flex items-center gap-2 mt-2.5 flex-wrap text-xs">
            <span className="font-bold px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-200 border border-blue-400/30 tabular-nums">
              {lang === "te" ? "అప్పు:" : "Lent:"} {formatCurrency(totalLent)}
            </span>
            <span className="font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 tabular-nums">
              ↑ {formatCurrency(totalCollected)} {lang === "te" ? "వసూలు" : "collected"}
            </span>
            <span className="font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30 tabular-nums">
              {activeCount} {lang === "te" ? "యాక్టివ్" : "active"}
            </span>
          </div>
        </div>

        {/* Quick In-Hand Cash Strip */}
        <div className="mt-4 pt-3.5 border-t border-white/15 space-y-1.5 relative z-10">
          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-slate-200">
              <Coins className="w-3.5 h-3.5 text-amber-400" />
              <span>
                {lang === "te" ? "లైన్ చేతిలో ఉన్న నగదు:" : "Line Cash in Hand:"}
              </span>
            </div>
            <span className="text-amber-300 font-black text-sm tracking-wide tabular-nums">
              {showBalance ? formatCurrency(lineBagCash) : "₹ •••••"}
            </span>
          </div>
          {lineCashStatus.autoHomeTakenTotal > 0 && (
            <div className="flex items-center justify-between text-[11px] text-amber-200/90">
              <span>
                {lang === "te"
                  ? "🏠 2 రోజులలో కొత్త అప్పు ఇవ్వనందున ఇంటికి తీసుకున్నది:"
                  : "🏠 Auto Home-Taken (no new loan within 2 days):"}
              </span>
              <span className="font-bold tabular-nums">
                {showBalance ? formatCurrency(lineCashStatus.autoHomeTakenTotal) : "₹ •••••"}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. FOUR REFINED SQUIRCLE QUICK ACTIONS */}
      <div className="grid grid-cols-4 gap-2.5 text-center pt-1">
        {/* 1. Start Line Collection */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onNavigateTab("collect")}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-[22px] bg-white dark:bg-[#131B2E] flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm hover:border-amber-500/60 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            title="Start Line Collection"
          >
            <HandCoins className="w-6 h-6 sm:w-7 sm:h-7 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform" strokeWidth={2.2} />
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 tracking-tight">
            {lang === "te" ? "లైన్ వసూలు" : "Start Line"}
          </span>
        </div>

        {/* 2. New Loan */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onNavigateTab("collect")}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-[22px] bg-white dark:bg-[#131B2E] flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm hover:border-blue-500/60 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            title="Add New Loan"
          >
            <UserPlus className="w-6 h-6 sm:w-7 sm:h-7 text-blue-700 dark:text-sky-400 group-hover:scale-110 transition-transform" strokeWidth={2.2} />
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 tracking-tight">
            {lang === "te" ? "కొత్త అప్పు" : "New Loan"}
          </span>
        </div>

        {/* 3. Expenses */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onNavigateTab("expenses")}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-[22px] bg-white dark:bg-[#131B2E] flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm hover:border-rose-500/60 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            title="Expenses & Fuel"
          >
            <Receipt className="w-6 h-6 sm:w-7 sm:h-7 text-rose-600 dark:text-rose-400 group-hover:scale-110 transition-transform" strokeWidth={2.2} />
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 tracking-tight">
            {lang === "te" ? "ఖర్చులు" : "Expenses"}
          </span>
        </div>

        {/* 4. Reports & History */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={() => onNavigateTab("reports")}
            className="w-14 h-14 sm:w-16 sm:h-16 rounded-[22px] bg-white dark:bg-[#131B2E] flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm hover:border-emerald-500/60 hover:scale-105 active:scale-95 transition-all cursor-pointer group"
            title="Reports & Analytics"
          >
            <BarChart3 className="w-6 h-6 sm:w-7 sm:h-7 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" strokeWidth={2.2} />
          </button>
          <span className="text-[11px] sm:text-xs font-bold text-slate-700 dark:text-slate-300 tracking-tight">
            {lang === "te" ? "నివేదికలు" : "Reports"}
          </span>
        </div>
      </div>

      {/* Quick Personal Cash Withdrawal Action Button */}
      <button
        onClick={() => setPersonalModal(true)}
        className="w-full min-h-[44px] py-2.5 px-4 rounded-2xl bg-white dark:bg-[#131B2E] border border-dashed border-amber-500/70 dark:border-amber-500/50 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center justify-center gap-2 hover:bg-amber-50/70 dark:hover:bg-amber-950/30 active:scale-98 transition-all cursor-pointer shadow-xs"
      >
        <span>🏠</span>
        <span>
          {lang === "te"
            ? "నేటి వసూళ్ల నుండి వ్యక్తిగత/ఇంటి ఖర్చు నమోదు చేయండి"
            : "Record Personal / Home Use Cash Withdrawal"}
        </span>
      </button>

      {/* Commercial Launch Onboarding Checklist (Auto-hides once 4/4 done or dismissed) */}
      {!onboarding.allComplete && !onboardingDismissed && (
        <section
          aria-label={lang === "te" ? "త్వరిత ప్రారంభ చెక్‌లిస్ట్" : "Launch Setup Checklist"}
          className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-[#131B2E] border-2 border-blue-200 dark:border-blue-800/70 shadow-sm space-y-3.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#1E3A8A] text-amber-300 flex items-center justify-center shrink-0 shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider text-blue-700 dark:text-blue-400">
                    {lang === "te" ? "త్వరిత సెటప్ గైడ్" : "Quick Start Checklist"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-[10px] font-black tabular-nums">
                    {onboarding.completedCount}/{onboarding.totalCount}{" "}
                    {lang === "te" ? "పూర్తయ్యాయి" : "Done"}
                  </span>
                </div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white leading-snug mt-0.5">
                  {lang === "te"
                    ? "మీ లైన్ వ్యాపారాన్ని 4 దశల్లో సిద్ధం చేయండి"
                    : "Launch Your Digital Line Ledger in 4 Steps"}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={handleDismissOnboarding}
              aria-label={lang === "te" ? "చెక్‌లిస్ట్ దాచండి" : "Dismiss setup checklist"}
              title={lang === "te" ? "దాచండి" : "Dismiss"}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white flex items-center justify-center shrink-0 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#1E3A8A] to-emerald-500 transition-all duration-300"
              style={{ width: `${onboarding.percentComplete}%` }}
            />
          </div>

          {/* Interactive Step Rows */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {onboarding.steps.map((step) => {
              const isNext = onboarding.nextStepId === step.id;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => handleOnboardingStepClick(step.id)}
                  className={`text-left p-3 rounded-2xl border flex items-center justify-between gap-2.5 cursor-pointer transition-all ${
                    step.completed
                      ? "bg-emerald-50/70 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-900/60"
                      : isNext
                      ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-400 dark:border-blue-600 shadow-xs"
                      : "bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    {step.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <Circle
                        className={`w-5 h-5 shrink-0 mt-0.5 ${
                          isNext
                            ? "text-blue-700 dark:text-blue-400"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                      />
                    )}
                    <div className="min-w-0">
                      <div
                        className={`text-xs font-black leading-snug ${
                          step.completed
                            ? "text-emerald-900 dark:text-emerald-200 line-through decoration-emerald-500/60"
                            : "text-slate-900 dark:text-slate-100"
                        }`}
                      >
                        {step.number}. {lang === "te" ? step.titleTe : step.titleEn}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-1 mt-0.5">
                        {lang === "te" ? step.descTe : step.descEn}
                      </p>
                    </div>
                  </div>
                  {!step.completed && (
                    <span
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-black shrink-0 ${
                        isNext
                          ? "bg-[#1E3A8A] text-white"
                          : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {lang === "te" ? step.ctaTe : step.ctaEn}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Line Operating Days Prompt (asks user whether Specific Days or Daily) */}
      {!profile.lineDaysConfigured && (
        <section
          aria-label={lang === "te" ? "లైన్ రోజుల ఎంపిక" : "Line Schedule Setup"}
          className="rounded-3xl p-4 sm:p-5 bg-white dark:bg-[#131B2E] border border-sky-200 dark:border-sky-800/70 shadow-sm space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 dark:text-sky-400">
                {lang === "te" ? "లైన్ షెడ్యూల్ సెటప్" : "Your Weekly Line Schedule"}
              </span>
              <h3 className="text-sm font-black text-slate-900 dark:text-white mt-0.5">
                {lang === "te"
                  ? "మీరు వారంలో ఏ రోజుల్లో లైన్ వసూలు చేస్తారు?"
                  : "Which days in a week do you run your collection line?"}
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScheduleModeDraft("specific")}
              className={`min-h-[42px] rounded-xl px-3 py-2 text-xs font-extrabold border cursor-pointer transition-all ${
                scheduleModeDraft === "specific"
                  ? "bg-sky-700 text-white border-sky-700"
                  : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              {lang === "te" ? "ఎంచుకున్న రోజులు" : "Specific Days"}
            </button>
            <button
              type="button"
              onClick={() => setScheduleModeDraft("daily")}
              className={`min-h-[42px] rounded-xl px-3 py-2 text-xs font-extrabold border cursor-pointer transition-all ${
                scheduleModeDraft === "daily"
                  ? "bg-sky-700 text-white border-sky-700"
                  : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              {lang === "te" ? "ప్రతి రోజు (Daily)" : "Daily (All 7 Days)"}
            </button>
          </div>

          {scheduleModeDraft === "specific" && (
            <div className="flex flex-wrap gap-1.5">
              {ALL_DAYS_MON_FIRST.map((day) => {
                const selected = scheduleDaysDraft.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => {
                      setScheduleDaysDraft((prev) =>
                        prev.includes(day)
                          ? prev.length > 1
                            ? prev.filter((d) => d !== day)
                            : prev
                          : [...prev, day]
                      );
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border cursor-pointer transition-all ${
                      selected
                        ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {lang === "te" ? translateDayName(day, "te") : day.slice(0, 3)}
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              onUpdateProfile({
                ...profile,
                lineDaysMode: scheduleModeDraft,
                lineDays:
                  scheduleModeDraft === "daily"
                    ? [...ALL_DAYS_MON_FIRST]
                    : scheduleDaysDraft,
                lineDaysConfigured: true,
              })
            }
            className="w-full min-h-[42px] rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-black text-xs cursor-pointer transition-all"
          >
            {lang === "te" ? "లైన్ రోజులు సేవ్ చేయండి ✓" : "Save Line Days ✓"}
          </button>
        </section>
      )}

      {/* 2-Day Advance WhatsApp Pre-Collection Reminders Alert Card (only when enabled) */}
      {showWaReminderBanner && (
        <div className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-amber-300 dark:border-amber-700/60 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm">
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
                {lang === "te"
                  ? `${advanceInfo.targetDayName} లైన్ (${
                      advanceInfo.matchingVillages.map((v) => v.name).join(", ") || "రాబోయే గ్రామాలు"
                    })`
                  : `${advanceInfo.targetDayName} Line (${
                      advanceInfo.matchingVillages.map((v) => v.name).join(", ") || "Upcoming"
                    })`}
              </h3>
              <p className="text-[11px] text-slate-600 dark:text-slate-400">
                {lang === "te"
                  ? "ఖాతాదారులకు వారం వాయిదా వాట్సాప్ రిమైండర్లు పంపండి"
                  : "Send advance WhatsApp collection notices to borrowers"}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowReminderCenter(true)}
            className="min-h-[44px] py-2 px-3.5 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-xs flex items-center gap-1.5 shrink-0 shadow-sm cursor-pointer transition-all active:scale-95"
          >
            <MessageCircle className="w-4 h-4 fill-white" />
            <span>{lang === "te" ? "రిమైండర్లు" : "Send"}</span>
          </button>
        </div>
      )}

      {/* 3. FINANCE SUMMARY & TOOLS (7 uniform cards: 2-col mobile / 4-col desktop Grid) */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">
            {lang === "te" ? "ఆర్థిక సారాంశం" : "Finance Summary"}
          </h2>
          <button
            onClick={() => onNavigateTab("reports")}
            className="min-h-[44px] px-2 text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center gap-0.5 hover:underline cursor-pointer"
          >
            <span>{lang === "te" ? "అన్నీ చూడండి" : "View All"}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Active Loans */}
          <button
            type="button"
            onClick={() => onNavigateTab("borrowers")}
            className="text-left rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm cursor-pointer hover:border-blue-500/50 active:scale-98 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3 w-full">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                <Wallet className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                {lang === "te" ? "యాక్టివ్ అప్పులు" : "Active Loans"}
              </span>
              <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5 tabular-nums">
                {activeCount} {lang === "te" ? "ఖాతాలు" : "Loans"}
              </div>
            </div>
          </button>

          {/* 2. Line Collections */}
          <button
            type="button"
            onClick={() => onNavigateTab("reports")}
            className="text-left rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm cursor-pointer hover:border-emerald-500/50 active:scale-98 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3 w-full">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                <BarChart3 className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                {lang === "te" ? "లైన్ వసూళ్లు" : "Line Collections"}
              </span>
              <div className="text-lg font-black text-emerald-700 dark:text-emerald-400 mt-0.5 tabular-nums">
                {formatCurrency(totalCollected)}
              </div>
            </div>
          </button>

          {/* 3. Unpaid Short Amount */}
          <button
            type="button"
            onClick={() => onNavigateTab("borrowers")}
            className="text-left rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm cursor-pointer hover:border-purple-500/50 active:scale-98 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3 w-full">
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                {lang === "te" ? "తరుగు బ్యాలెన్స్" : "Unpaid Short"}
              </span>
              <div className="text-lg font-black text-purple-700 dark:text-purple-400 mt-0.5 tabular-nums">
                {formatCurrency(totalShortAmount)}
              </div>
            </div>
          </button>

          {/* 4. Expenses & Rent */}
          <button
            type="button"
            onClick={() => onNavigateTab("expenses")}
            className="text-left rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm cursor-pointer hover:border-amber-500/50 active:scale-98 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3 w-full">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                <PiggyBank className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                {lang === "te" ? "ఖర్చులు & పెట్రోల్" : "Expenses & Rent"}
              </span>
              <div className="text-lg font-black text-amber-700 dark:text-amber-400 mt-0.5 tabular-nums">
                {formatCurrency(totalExpenses)}
              </div>
            </div>
          </button>

          {/* 5. Interest Calculator */}
          <button
            type="button"
            onClick={() => onNavigateTab("calc")}
            className="text-left rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm cursor-pointer hover:border-orange-500/50 active:scale-98 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3 w-full">
              <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 flex items-center justify-center">
                <Calculator className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                {t.interestCalc}
              </span>
              <div className="text-lg font-black text-orange-700 dark:text-orange-400 mt-0.5">
                {lang === "te" ? "వడ్డీ లెక్క" : "Loan EMI"}
              </div>
            </div>
          </button>

          {/* 6. Line Calendar */}
          <button
            type="button"
            onClick={() => onNavigateTab("calendar")}
            className="text-left rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm cursor-pointer hover:border-sky-500/50 active:scale-98 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3 w-full">
              <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400 flex items-center justify-center">
                <Calendar className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                {t.scheduleCalendar}
              </span>
              <div className="text-lg font-black text-sky-700 dark:text-sky-400 mt-0.5 tabular-nums">
                {todayLineVillages.length > 0
                  ? `${todayLineVillages.length} ${lang === "te" ? "నేటి లైన్" : "Today"}`
                  : `${data.villages.length} ${lang === "te" ? "గ్రామాలు" : "Villages"}`}
              </div>
            </div>
          </button>

          {/* 7. Daily Cashbook (Hidden when disabled in Settings) */}
          {profile.enableDailyCashbook !== false && (
            <button
              type="button"
              onClick={() => onNavigateTab("cashbook")}
              className="text-left rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm cursor-pointer hover:border-teal-500/50 active:scale-98 transition-all flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-3 w-full">
                <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 flex items-center justify-center">
                  <BookOpen className="w-5 h-5" />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                  {t.dailyCashbook}
                </span>
                <div className="text-lg font-black text-teal-700 dark:text-teal-400 mt-0.5 tabular-nums">
                  {showBalance ? formatCurrency(lineBagCash) : "₹ •••••"}
                </div>
              </div>
            </button>
          )}

          {/* 8. Record Book (Under Line Calendar in 2-col mobile grid) */}
          <button
            type="button"
            onClick={() => onNavigateTab("reports", undefined, "recordBook")}
            className="text-left rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm cursor-pointer hover:border-indigo-500/50 active:scale-98 transition-all flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-3 w-full">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center">
                <ClipboardList className="w-5 h-5" />
              </div>
              <ChevronRight className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                {t.recordBook}
              </span>
              <div className="text-xs sm:text-sm font-black text-indigo-700 dark:text-indigo-400 mt-1">
                {lang === "te" ? "వారం · నెల · సైకిల్" : "Weekly · Monthly · Cycle"}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* 4. Today's Scheduled Line Villages Alert */}
      {todayLineVillages.length > 0 && (
        <div className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-amber-300 dark:border-amber-700/50 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center font-bold text-sm">
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
              className="min-h-[44px] px-4 py-1.5 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer shadow-sm active:scale-95 transition-all"
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {allMondays.slice(0, 4).map((monday, i) => {
              const weekDates = getWeekDates(monday);
              const weekColls = Object.values(collections).filter((c) =>
                weekDates.includes(c.date)
              );
              const wColl = weekColls.reduce((s, c) => s + (c.totalCollected || 0), 0);
              const weekNumber = allMondays.length - i;

              return (
                <button
                  type="button"
                  key={monday}
                  onClick={() => setSelectedWeekDetail(monday)}
                  className="w-full text-left rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-500/40 active:scale-99 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 font-black text-sm text-blue-700 dark:text-blue-400 flex items-center justify-center tabular-nums">
                      W{weekNumber}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {lang === "te" ? `వారం ${weekNumber}` : `Week ${weekNumber}`}
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                        {formatDateIN(monday, lang)} → {formatDateIN(weekDates[6], lang)}
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <div>
                      <div className="text-sm font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {formatCurrency(wColl)}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        {weekColls.length} {lang === "te" ? "గ్రామాలు" : "visits"}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
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
