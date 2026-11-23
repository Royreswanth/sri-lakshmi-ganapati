import React, { useState } from "react";
import {
  Search,
  ChevronRight,
  MessageCircle,
  X,
  ArrowLeft,
  Phone,
  Bell,
  RefreshCw,
  CheckCircle2,
  ShieldCheck,
  History,
  BookOpen,
  UserPlus,
  User,
  Camera,
  Calendar,
  MapPin,
  Briefcase,
  Edit3,
} from "lucide-react";
import { BorrowerPassbookModal } from "./BorrowerPassbookModal";
import { compressBorrowerPhoto } from "../utils/imageUtils";
import {
  Borrower,
  Village,
  Language,
  BusinessProfile,
  RepaymentFrequency,
  PaymentMethod,
  DayOfWeek,
} from "../types";
import { translations } from "../translations";
import {
  formatCurrency,
  formatDateIN,
  getTodayStr,
  calculateRemainingBalance,
  calculateTotalPaid,
  translateDayName,
} from "../utils/dateUtils";
import {
  buildWhatsAppReceiptText,
  buildAdvanceReminderText,
  buildSkipWarningText,
  openWhatsApp,
  isBorrowerReceiptDisabled,
  getWhatsAppRules,
  getTelHref,
} from "../utils/whatsapp";
import {
  buildLoanCompletedWeeksSummary,
  calculateInstallmentDueFromTotal,
  computeImpliedInterestPct,
  getFrequencyLabel,
  getFrequencyShortPrefix,
  isBorrowerClosed,
  renewBorrowerLoan,
  settleBorrowerEarly,
} from "../utils/financeUtils";

interface BorrowersTabProps {
  data: { villages: Village[]; borrowers: Record<string, Borrower[]> };
  profile: BusinessProfile;
  lang: Language;
  onUpdateData: (newData: {
    villages: Village[];
    borrowers: Record<string, Borrower[]>;
  }) => void;
  onAddNewLoanLog: (item: any) => void;
  onNavigateCollect?: () => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

const FREQ_DURATION_DEFAULTS: Record<RepaymentFrequency, number[]> = {
  weekly: [8, 10, 12, 16, 20, 24],
  daily: [30, 50, 60, 100],
  monthly: [3, 6, 10, 12, 24],
};

export const BorrowersTab: React.FC<BorrowersTabProps> = ({
  data,
  profile,
  lang,
  onUpdateData,
  onAddNewLoanLog,
  onNavigateCollect,
  showToast,
}) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "skipped">("all");
  const [selectedVillageFilter, setSelectedVillageFilter] = useState<string>("all");
  const [selectedBorrower, setSelectedBorrower] = useState<{
    borrower: Borrower;
    villageId: string;
    villageName: string;
  } | null>(null);

  const [detailTab, setDetailTab] = useState<"ledger" | "profile">("ledger");

  // Profile Edit Modal state
  const [profileEditModal, setProfileEditModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    seqNo: "",
    phone: "",
    gender: "" as "" | "male" | "female" | "other",
    age: "",
    occupation: "",
    address: "",
    careOf: "",
    guarantorName: "",
    guarantorPhone: "",
    startDate: "",
    photo: "",
  });

  // Early Settlement Modal state
  const [passbookModal, setPassbookModal] = useState(false);
  const [settleModal, setSettleModal] = useState(false);
  const [settleCashAmt, setSettleCashAmt] = useState("");
  const [settleDiscountAmt, setSettleDiscountAmt] = useState("0");
  const [settlePayMethod, setSettlePayMethod] = useState<PaymentMethod>("cash");
  const [settleNote, setSettleNote] = useState("");

  // Top-Up / Renewal Modal state
  const [renewModal, setRenewModal] = useState(false);
  const [renewForm, setRenewForm] = useState({
    repaymentFreq: "weekly" as RepaymentFrequency,
    loanAmt: "10000",
    totalPayable: "12000",
    durationWeeks: "12",
    weeklyOverride: "",
    isOngoing: false,
    weeksPaid: "0",
    careOf: "",
    guarantorName: "",
    guarantorPhone: "",
    startDate: getTodayStr(),
  });

  const t = translations[lang];
  const waRules = getWhatsAppRules();

  // Ordered villages (configured order first, plus any orphan keys in borrowers map)
  const orderedVillageEntries: { villageId: string; villageName: string; villageDay: DayOfWeek | "" }[] = [
    ...data.villages.map((v) => ({
      villageId: v.id,
      villageName: v.name,
      villageDay: v.day,
    })),
    ...Object.keys(data.borrowers)
      .filter((vid) => !data.villages.some((v) => v.id === vid))
      .map((vid) => ({
        villageId: vid,
        villageName: "Village",
        villageDay: "" as const,
      })),
  ];

  // Flatten borrowers preserving village order and sorting numerically by Roll # within each village
  const allBorrowersList = orderedVillageEntries.flatMap(({ villageId, villageName, villageDay }) => {
    const bs = [...(data.borrowers[villageId] || [])].sort((a, b) => {
      const na = a.seqNo ? parseInt(a.seqNo, 10) || 0 : 99999;
      const nb = b.seqNo ? parseInt(b.seqNo, 10) || 0 : 99999;
      if (na !== nb) return na - nb;
      return (a.seqNo || "").localeCompare(b.seqNo || "");
    });
    return bs.map((b) => ({
      borrower: b,
      villageName,
      villageDay,
      villageId,
    }));
  });

  const filtered = allBorrowersList.filter(({ borrower, villageId, villageName }) => {
    if (selectedVillageFilter !== "all" && villageId !== selectedVillageFilter) {
      return false;
    }

    const q = search.toLowerCase();
    const matchesSearch =
      borrower.name.toLowerCase().includes(q) ||
      (borrower.phone || "").includes(q) ||
      (borrower.guarantorName || "").toLowerCase().includes(q) ||
      (borrower.guarantorPhone || "").includes(q) ||
      (borrower.careOf || "").toLowerCase().includes(q) ||
      villageName.toLowerCase().includes(q) ||
      (borrower.seqNo || "").includes(q);

    if (!matchesSearch) return false;

    const closed = isBorrowerClosed(borrower);
    const hasSkips = (borrower.history || []).some((h) => h.status === "skip");

    if (filter === "active") return !closed;
    if (filter === "completed") return closed;
    if (filter === "skipped") return hasSkips && !closed;
    return true;
  });

  // Group filtered borrowers under their village section headers
  const villageGroups = orderedVillageEntries
    .map((v) => ({
      ...v,
      items: filtered.filter((item) => item.villageId === v.villageId),
    }))
    .filter((group) => group.items.length > 0);

  const handleSendWarning = (b: Borrower) => {
    const rem = calculateRemainingBalance(b);
    const msg = buildSkipWarningText({
      borrower: b,
      businessName: profile.businessName,
      remainingBal: rem,
      lang,
    });
    openWhatsApp(b.phone, msg);
  };

  const handleSendReminder = (b: Borrower, villageName: string) => {
    const rem = calculateRemainingBalance(b);
    const msg = buildAdvanceReminderText({
      borrower: b,
      villageName,
      visitDate: getTodayStr(),
      businessName: profile.businessName,
      remainingBal: rem,
      lang,
    });
    openWhatsApp(b.phone, msg);
  };

  const handleSendLatestReceipt = (b: Borrower, villageName: string) => {
    const rules = getWhatsAppRules();
    if (isBorrowerReceiptDisabled(b, undefined, rules)) {
      return;
    }

    const lastPaid = [...(b.history || [])].reverse().find((h) => h.status !== "skip");
    const amtPaid = lastPaid ? lastPaid.amtPaid : b.weeklyDue;
    const dateStr = lastPaid ? lastPaid.date : getTodayStr();
    const rem = calculateRemainingBalance(b);

    const msg = buildWhatsAppReceiptText({
      borrower: b,
      amtPaid,
      status: lastPaid ? lastPaid.status : "paid",
      payMethod: lastPaid?.payMethod || "cash",
      dateStr,
      villageName,
      businessName: profile.businessName,
      remainingBal: rem,
      lang,
    });
    openWhatsApp(b.phone, msg);
  };

  const openEarlySettlement = () => {
    if (!selectedBorrower) return;
    const rem = calculateRemainingBalance(selectedBorrower.borrower);
    setSettleCashAmt(String(rem));
    setSettleDiscountAmt("0");
    setSettlePayMethod("cash");
    setSettleNote("");
    setSettleModal(true);
  };

  const handleConfirmSettlement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBorrower) return;
    const { borrower, villageId, villageName } = selectedBorrower;
    const cash = Math.max(0, parseInt(settleCashAmt, 10) || 0);
    const discount = Math.max(0, parseInt(settleDiscountAmt, 10) || 0);
    const settledBorrower = settleBorrowerEarly(
      borrower,
      cash,
      discount,
      getTodayStr(),
      settleNote,
      settlePayMethod
    );

    const updatedVillageBorrowers = (data.borrowers[villageId] || []).map((b) =>
      b.id === borrower.id ? settledBorrower : b
    );

    onUpdateData({
      ...data,
      borrowers: { ...data.borrowers, [villageId]: updatedVillageBorrowers },
    });
    setSelectedBorrower({ borrower: settledBorrower, villageId, villageName });
    setSettleModal(false);
    showToast(
      lang === "te" ? `${borrower.name} లోన్ సెటిల్ అయ్యింది ✓` : `${borrower.name} loan settled ✓`,
      "success"
    );
  };

  const openBorrowerModal = (
    borrower: Borrower,
    villageId: string,
    villageName: string,
    initialTab: "ledger" | "profile" = "ledger"
  ) => {
    setDetailTab(initialTab);
    setSelectedBorrower({ borrower, villageId, villageName });
  };

  const openProfileEditModal = () => {
    if (!selectedBorrower) return;
    const b = selectedBorrower.borrower;
    setProfileForm({
      name: b.name || "",
      seqNo: b.seqNo || "",
      phone: b.phone || "",
      gender: b.gender || "",
      age: b.age || "",
      occupation: b.occupation || "",
      address: b.address || "",
      careOf: b.careOf || "",
      guarantorName: b.guarantorName || "",
      guarantorPhone: b.guarantorPhone || "",
      startDate: b.startDate || getTodayStr(),
      photo: b.photo || "",
    });
    setProfileEditModal(true);
  };

  const handleSaveProfileEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBorrower || !profileForm.name.trim()) return;
    const { borrower, villageId, villageName } = selectedBorrower;
    const updatedBorrower: Borrower = {
      ...borrower,
      name: profileForm.name.trim(),
      seqNo: profileForm.seqNo.trim(),
      phone: profileForm.phone.trim(),
      gender: profileForm.gender || undefined,
      age: profileForm.age.trim() || undefined,
      occupation: profileForm.occupation.trim() || undefined,
      address: profileForm.address.trim() || undefined,
      careOf: profileForm.careOf.trim() || undefined,
      guarantorName: profileForm.guarantorName.trim() || undefined,
      guarantorPhone: profileForm.guarantorPhone.trim() || undefined,
      startDate: profileForm.startDate || borrower.startDate,
      photo: profileForm.photo || undefined,
    };

    const updatedVillageBorrowers = (data.borrowers[villageId] || []).map((b) =>
      b.id === borrower.id ? updatedBorrower : b
    );
    onUpdateData({
      ...data,
      borrowers: { ...data.borrowers, [villageId]: updatedVillageBorrowers },
    });
    setSelectedBorrower({ borrower: updatedBorrower, villageId, villageName });
    setProfileEditModal(false);
    showToast(
      lang === "te" ? "ఖాతాదారు ప్రొఫైల్ సేవ్ అయింది ✓" : "Borrower profile updated ✓",
      "success"
    );
  };

  const openRenewalModal = () => {
    if (!selectedBorrower) return;
    const b = selectedBorrower.borrower;
    const freq = b.repaymentFreq || "weekly";
    const defaultTotal =
      b.totalReturn || (b.weeklyDue || 0) * (b.durationWeeks || 12) || Math.round((b.loanAmt || 10000) * 1.2);
    setRenewForm({
      repaymentFreq: freq,
      loanAmt: String(b.loanAmt || 10000),
      totalPayable: String(defaultTotal),
      durationWeeks: String(FREQ_DURATION_DEFAULTS[freq].includes(b.durationWeeks) ? b.durationWeeks : FREQ_DURATION_DEFAULTS[freq][0]),
      weeklyOverride: "",
      isOngoing: false,
      weeksPaid: "0",
      careOf: b.careOf || "",
      guarantorName: b.guarantorName || "",
      guarantorPhone: b.guarantorPhone || "",
      startDate: getTodayStr(),
    });
    setRenewModal(true);
  };

  const handleConfirmRenewal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBorrower) return;
    const { borrower, villageId, villageName } = selectedBorrower;
    const loanAmt = parseInt(renewForm.loanAmt, 10) || 10000;
    const durationWeeks = Math.max(1, parseInt(renewForm.durationWeeks, 10) || 12);
    const totalPayable = Math.max(0, parseInt(renewForm.totalPayable, 10) || 0);
    const overrideDue = parseInt(renewForm.weeklyOverride, 10) || undefined;
    const finalTotalReturn = overrideDue ? overrideDue * durationWeeks : totalPayable;
    const silentInterestPct = computeImpliedInterestPct(loanAmt, finalTotalReturn);
    const renewDateStr = renewForm.startDate || getTodayStr();

    const renewedBorrower = renewBorrowerLoan(
      borrower,
      {
        loanAmt,
        interestPct: silentInterestPct,
        totalReturn: finalTotalReturn,
        durationWeeks,
        repaymentFreq: renewForm.repaymentFreq,
        weeklyDue: overrideDue,
        isOngoing: renewForm.isOngoing,
        weeksPaid: renewForm.isOngoing ? parseInt(renewForm.weeksPaid, 10) || 0 : 0,
        careOf: renewForm.careOf.trim() || undefined,
        guarantorName: renewForm.guarantorName.trim() || undefined,
        guarantorPhone: renewForm.guarantorPhone.trim() || undefined,
        startDate: renewDateStr,
      },
      renewDateStr
    );

    const updatedVillageBorrowers = (data.borrowers[villageId] || []).map((b) =>
      b.id === borrower.id ? renewedBorrower : b
    );

    onUpdateData({
      ...data,
      borrowers: { ...data.borrowers, [villageId]: updatedVillageBorrowers },
    });

    if (!renewForm.isOngoing) {
      onAddNewLoanLog({
        id: `nl${Date.now()}`,
        borrowerName: `${renewedBorrower.name} (Cycle ${renewedBorrower.loanCycle})`,
        seqNo: renewedBorrower.seqNo,
        villageName,
        villageId,
        loanAmt,
        date: renewDateStr,
      });
    }

    setSelectedBorrower({ borrower: renewedBorrower, villageId, villageName });
    setRenewModal(false);
    showToast(
      lang === "te"
        ? `కొత్త లోన్ సైకిల్ #${renewedBorrower.loanCycle} ప్రారంభమైంది ✓`
        : `Loan Cycle #${renewedBorrower.loanCycle} started ✓`,
      "success"
    );
  };

  const renewPreviewPeriods = Math.max(1, parseInt(renewForm.durationWeeks, 10) || 12);
  const renewOverrideVal = parseInt(renewForm.weeklyOverride, 10) || 0;
  const renewPreviewTotalInput = Math.max(0, parseInt(renewForm.totalPayable, 10) || 0);
  const renewPreviewDue =
    renewOverrideVal > 0
      ? renewOverrideVal
      : calculateInstallmentDueFromTotal(renewPreviewTotalInput, renewPreviewPeriods);
  const renewPreviewTotal =
    renewOverrideVal > 0 ? renewPreviewDue * renewPreviewPeriods : renewPreviewTotalInput;

  return (
    <>
    <div className="pb-28 px-4 pt-3 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto space-y-3.5 print-hide-when-passbook">
      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full min-h-[44px] pl-10 pr-10 py-3 rounded-2xl neu-inset text-sm font-semibold text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="w-9 h-9 absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 flex items-center justify-center cursor-pointer"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Village Dropdown Filter */}
      {orderedVillageEntries.length > 0 && (
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
          <select
            aria-label={lang === "te" ? "గ్రామం వారీగా ఎంచుకోండి" : "Filter by village"}
            value={selectedVillageFilter}
            onChange={(e) => setSelectedVillageFilter(e.target.value)}
            className="flex-1 min-h-[42px] px-3.5 py-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B2E] text-xs font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="all">
              {lang === "te"
                ? `అన్ని గ్రామాలు (${allBorrowersList.length})`
                : `All Villages (${allBorrowersList.length})`}
            </option>
            {orderedVillageEntries.map((v) => {
              const vCount = (data.borrowers[v.villageId] || []).length;
              const vDayText = v.villageDay ? translateDayName(v.villageDay, lang) : "";
              return (
                <option key={v.villageId} value={v.villageId}>
                  {v.villageName}
                  {vDayText ? ` (${vDayText})` : ""} · {vCount}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex neu-inset p-1 rounded-2xl text-xs font-bold gap-1 overflow-x-auto">
        {(
          [
            ["all", lang === "te" ? "అన్నీ" : "All"],
            ["active", lang === "te" ? "యాక్టివ్" : "Active"],
            ["skipped", lang === "te" ? "దాటవేతలు ⚠️" : "With Skips ⚠️"],
            ["completed", lang === "te" ? "పూర్తయినవి ✓" : "Closed ✓"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`flex-1 min-h-[40px] py-2 px-3 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              filter === k
                ? "bg-[#1E3A8A] text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-medium px-1 tabular-nums">
        <span>
          {filtered.length} {t.borrowers}{" "}
          {search ? (lang === "te" ? "కనిపించాయి" : "found") : lang === "te" ? "మొత్తం" : "total"}
        </span>
        {villageGroups.length > 0 && (
          <span>
            {villageGroups.length} {lang === "te" ? "గ్రామాలు" : villageGroups.length === 1 ? "village" : "villages"}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="neu-card rounded-2xl p-8 text-center text-xs text-slate-600 dark:text-slate-400 space-y-3">
          <p>{lang === "te" ? "ఈ ఫిల్టర్‌లో ఖాతాదారులు లేరు." : "No borrowers matching this filter."}</p>
          {allBorrowersList.length === 0 && onNavigateCollect && (
            <button
              type="button"
              onClick={onNavigateCollect}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {lang === "te"
                  ? "లైన్ వసూలులో మొదటి ఖాతాదారుని జోడించండి →"
                  : "Go to Village & Give New Loan →"}
              </span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {villageGroups.map((group) => {
            const groupDayLabel = group.villageDay ? translateDayName(group.villageDay, lang) : "";
            return (
              <section key={group.villageId} className="space-y-2.5">
                {/* Village Section Header */}
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MapPin className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400 shrink-0" />
                    <h3 className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                      {group.villageName}
                    </h3>
                    {groupDayLabel && (
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 shrink-0">
                        · {groupDayLabel}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 tabular-nums shrink-0">
                    {group.items.length}{" "}
                    {lang === "te"
                      ? t.borrowers
                      : group.items.length === 1
                      ? "borrower"
                      : "borrowers"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {group.items.map(({ borrower: b, villageId, villageName }, i) => {
                    const rem = calculateRemainingBalance(b);
                    const closed = isBorrowerClosed(b);
                    const prefix = getFrequencyShortPrefix(b.repaymentFreq);
                    const telHref = getTelHref(b.phone);

                    return (
                      <div
                        key={b.id}
                        className="w-full neu-card rounded-2xl p-4 hover:border-blue-500/40 transition-all space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => openBorrowerModal(b, villageId, villageName, "ledger")}
                            className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer"
                          >
                            {b.photo ? (
                              <img
                                src={b.photo}
                                alt={b.name}
                                className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-xl neu-inset text-blue-900 dark:text-blue-400 flex items-center justify-center font-extrabold text-xs shrink-0 tabular-nums">
                                {b.seqNo ? `#${b.seqNo}` : String(i + 1).padStart(2, "0")}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                                  {b.name}
                                </h4>
                                {(b.loanCycle || 1) > 1 && (
                                  <span className="text-[10px] font-extrabold text-blue-700 dark:text-blue-300">
                                    · Cycle #{b.loanCycle}
                                  </span>
                                )}
                                {b.hasWhatsApp === false && (
                                  <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[9px] font-black">
                                    📵 కీప్యాడ్
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                                {villageName} · {b.phone || (lang === "te" ? "ఫోన్ లేదు" : "No phone")}
                                {b.startDate ? ` · 📅 ${formatDateIN(b.startDate, lang)}` : ""}
                              </p>
                            </div>
                          </button>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => openBorrowerModal(b, villageId, villageName, "profile")}
                              title={t.profileTab}
                              className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold flex items-center gap-1 cursor-pointer hover:bg-blue-100"
                            >
                              <User className="w-3 h-3" />
                              <span>{lang === "te" ? "ప్రొఫైల్" : "Profile"}</span>
                            </button>
                            {telHref && (
                              <a
                                href={telHref}
                                aria-label={`Call ${b.name}`}
                                title={`${t.callNow} ${b.name}`}
                                className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-100"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <button
                              type="button"
                              onClick={() => openBorrowerModal(b, villageId, villageName, "ledger")}
                              aria-label={`Open details for ${b.name}`}
                              className="flex items-center gap-1 cursor-pointer"
                            >
                              {closed ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                                  {b.settledAt
                                    ? `✓ ${t.settledEarlyBadge}`
                                    : lang === "te"
                                    ? "✓ పూర్తయింది"
                                    : "✓ Completed"}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full neu-inset text-blue-900 dark:text-blue-300 text-[10px] font-bold tabular-nums">
                                  {prefix} {b.weeksPaid}/{b.durationWeeks || 12}
                                </span>
                              )}
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            </button>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => openBorrowerModal(b, villageId, villageName, "ledger")}
                          className="w-full grid grid-cols-4 gap-2 neu-inset p-2 rounded-xl text-center text-xs tabular-nums cursor-pointer"
                        >
                          <div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                              {lang === "te" ? "అప్పు" : "Loan"}
                            </span>
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              {formatCurrency(b.loanAmt)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                              {prefix} {lang === "te" ? "వాయిదా" : "Due"}
                            </span>
                            <span className="font-bold text-amber-700 dark:text-amber-400">
                              {formatCurrency(b.weeklyDue)}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                              {lang === "te" ? "చెల్లింపు" : "Paid"}
                            </span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              {formatCurrency(calculateTotalPaid(b))}
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                              {lang === "te" ? "బాకీ" : "Left"}
                            </span>
                            <span
                              className={`font-bold ${
                                rem > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                              }`}
                            >
                              {formatCurrency(rem)}
                            </span>
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Borrower Detail Modal */}
      {selectedBorrower && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          onClick={(e) => e.target === e.currentTarget && setSelectedBorrower(null)}
        >
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
            {/* Top Bar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={() => setSelectedBorrower(null)}
                  className="w-11 h-11 rounded-full neu-circle-btn flex items-center justify-center text-slate-800 dark:text-slate-100 cursor-pointer shrink-0"
                  aria-label="Close details"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                {selectedBorrower.borrower.photo ? (
                  <img
                    src={selectedBorrower.borrower.photo}
                    alt={selectedBorrower.borrower.name}
                    className="w-11 h-11 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                  />
                ) : null}
                <div className="min-w-0">
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">
                    {selectedBorrower.borrower.seqNo
                      ? `#${selectedBorrower.borrower.seqNo} · `
                      : ""}
                    {selectedBorrower.borrower.name}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                    {selectedBorrower.villageName} · Cycle #{selectedBorrower.borrower.loanCycle || 1} ·{" "}
                    {getFrequencyLabel(selectedBorrower.borrower.repaymentFreq, lang)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {getTelHref(selectedBorrower.borrower.phone) && (
                  <a
                    href={getTelHref(selectedBorrower.borrower.phone)!}
                    aria-label={`Call ${selectedBorrower.borrower.name}`}
                    className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs hover:bg-emerald-700"
                    title={t.callNow}
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                )}
                {waRules.masterEnabled && selectedBorrower.borrower.phone && selectedBorrower.borrower.hasWhatsApp !== false && (
                  <button
                    onClick={() => handleSendWarning(selectedBorrower.borrower)}
                    className="w-10 h-10 rounded-full neu-circle-btn text-emerald-600 dark:text-emerald-400 flex items-center justify-center cursor-pointer"
                    aria-label="Send WhatsApp overdue warning"
                    title="WhatsApp Warning"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>

            {/* Modal Sub-Tab Switcher: Ledger & Weeks vs Full Profile */}
            <div className="flex neu-inset p-1 rounded-2xl text-xs font-extrabold gap-1">
              <button
                type="button"
                onClick={() => setDetailTab("ledger")}
                className={`flex-1 min-h-[38px] rounded-xl transition-all cursor-pointer ${
                  detailTab === "ledger"
                    ? "bg-[#1E3A8A] text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {lang === "te" ? "📋 ఖాతా & వారాలు" : "📋 Ledger & Weeks"}
              </button>
              <button
                type="button"
                onClick={() => setDetailTab("profile")}
                className={`flex-1 min-h-[38px] rounded-xl transition-all cursor-pointer ${
                  detailTab === "profile"
                    ? "bg-[#1E3A8A] text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {lang === "te" ? "👤 పూర్తి ప్రొఫైల్" : "👤 Full Profile"}
              </button>
            </div>

            {detailTab === "profile" ? (
              <div className="space-y-3">
                {/* Portrait Photo + Edit Profile Header */}
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {selectedBorrower.borrower.photo ? (
                      <img
                        src={selectedBorrower.borrower.photo}
                        alt={selectedBorrower.borrower.name}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-blue-500/40 shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 flex items-center justify-center font-black text-xl shrink-0">
                        {(selectedBorrower.borrower.name || "B").slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="font-black text-base text-slate-900 dark:text-white truncate">
                        {selectedBorrower.borrower.name}
                      </h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {selectedBorrower.villageName}
                        {selectedBorrower.borrower.seqNo ? ` · Roll #${selectedBorrower.borrower.seqNo}` : ""}
                      </p>
                      <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 mt-0.5">
                        📅 {t.loanStartDate}: {formatDateIN(selectedBorrower.borrower.startDate, lang)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openProfileEditModal}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{lang === "te" ? "సవరించు" : "Edit"}</span>
                  </button>
                </div>

                {/* Personal KYC Attributes */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">{t.gender}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100 capitalize">
                      {selectedBorrower.borrower.gender
                        ? selectedBorrower.borrower.gender === "male"
                          ? lang === "te" ? "పురుషుడు (Male)" : "Male"
                          : selectedBorrower.borrower.gender === "female"
                          ? lang === "te" ? "స్త్రీ (Female)" : "Female"
                          : lang === "te" ? "ఇతరులు (Other)" : "Other"
                        : "—"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">{t.age}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {selectedBorrower.borrower.age ? `${selectedBorrower.borrower.age} yrs` : "—"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {lang === "te" ? "ఫోన్ నంబర్" : "Phone"}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {selectedBorrower.borrower.phone || "—"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                      <Briefcase className="w-3 h-3" /> {t.occupation}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {selectedBorrower.borrower.occupation || "—"}
                    </span>
                  </div>
                  <div className="col-span-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {t.address}
                    </span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {selectedBorrower.borrower.address || "—"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">{t.careOf}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {selectedBorrower.borrower.careOf || "—"}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-bold uppercase text-slate-500 block">{t.guarantor}</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {selectedBorrower.borrower.guarantorName
                        ? `${selectedBorrower.borrower.guarantorName}${selectedBorrower.borrower.guarantorPhone ? ` (${selectedBorrower.borrower.guarantorPhone})` : ""}`
                        : "—"}
                    </span>
                  </div>
                </div>

                {/* Loan Terms & Dates Summary */}
                {(() => {
                  const wk = buildLoanCompletedWeeksSummary(selectedBorrower.borrower, getTodayStr());
                  return (
                    <div className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 space-y-2 text-xs">
                      <div className="font-extrabold text-blue-900 dark:text-blue-200 flex items-center justify-between">
                        <span>{lang === "te" ? "రుణం & తేదీల వివరాలు" : "Loan & Dates Summary"}</span>
                        <span>Cycle #{selectedBorrower.borrower.loanCycle || 1}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 text-[11px] tabular-nums">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">{t.loanStartDate}: </span>
                          <strong className="text-slate-900 dark:text-white">{formatDateIN(wk.startDate, lang)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">{lang === "te" ? "ముగింపు తేదీ: " : "Est. End: "}</span>
                          <strong className="text-slate-900 dark:text-white">{formatDateIN(wk.expectedEndDate, lang)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">{lang === "te" ? "అసలు: " : "Loan: "}</span>
                          <strong className="text-slate-900 dark:text-white">{formatCurrency(selectedBorrower.borrower.loanAmt)}</strong>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">{lang === "te" ? "పూర్తయిన వారాలు: " : "Completed: "}</span>
                          <strong className="text-emerald-700 dark:text-emerald-300">{wk.completedPeriods} / {wk.totalPeriods}</strong>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <>
            {/* Care-Of & Guarantor Information */}
            {(selectedBorrower.borrower.careOf ||
              selectedBorrower.borrower.guarantorName ||
              selectedBorrower.borrower.guarantorPhone) && (
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0" />
                  <div className="min-w-0">
                    {selectedBorrower.borrower.careOf && (
                      <div className="text-slate-700 dark:text-slate-300 font-semibold truncate">
                        {t.careOf}: {selectedBorrower.borrower.careOf}
                      </div>
                    )}
                    {selectedBorrower.borrower.guarantorName && (
                      <div className="text-slate-900 dark:text-slate-100 font-bold truncate">
                        {t.guarantor}: {selectedBorrower.borrower.guarantorName}
                        {selectedBorrower.borrower.guarantorPhone
                          ? ` (${selectedBorrower.borrower.guarantorPhone})`
                          : ""}
                      </div>
                    )}
                  </div>
                </div>
                {getTelHref(selectedBorrower.borrower.guarantorPhone) && (
                  <a
                    href={getTelHref(selectedBorrower.borrower.guarantorPhone)!}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center gap-1 shrink-0"
                  >
                    <Phone className="w-3 h-3" />
                    <span>{lang === "te" ? "హామీదారు" : "Call G."}</span>
                  </a>
                )}
              </div>
            )}

            {/* Loan Start Date & Highlighted Completed Weeks Tracker */}
            {(() => {
              const weeksSummary = buildLoanCompletedWeeksSummary(selectedBorrower.borrower, getTodayStr());
              const prefix = getFrequencyShortPrefix(weeksSummary.freq);
              return (
                <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-extrabold text-slate-900 dark:text-slate-100">
                      <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>
                        {lang === "te" ? "ప్రారంభ తేదీ:" : "Started:"}{" "}
                        {formatDateIN(weeksSummary.startDate, lang)}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-black tabular-nums">
                      {isBorrowerClosed(selectedBorrower.borrower)
                        ? lang === "te"
                          ? "✓ రుణం పూర్తయింది"
                          : "✓ Loan Completed"
                        : `${weeksSummary.completedPeriods}/${weeksSummary.totalPeriods} ${
                            lang === "te" ? "పూర్తి" : "Done"
                          }`}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-44 overflow-y-auto pr-0.5">
                    {weeksSummary.items.map((item) => {
                      const isDone =
                        item.status === "completed_pre" ||
                        item.status === "paid" ||
                        item.status === "extra" ||
                        item.status === "settled";
                      const badgeCls = isDone
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-900 dark:text-emerald-200"
                        : item.status === "short"
                        ? "bg-amber-500/15 border-amber-500 text-amber-900 dark:text-amber-200"
                        : item.status === "skip"
                        ? "bg-rose-500/15 border-rose-500 text-rose-900 dark:text-rose-200"
                        : item.status === "due_today"
                        ? "bg-blue-500/15 border-blue-500 text-blue-900 dark:text-blue-200"
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400";

                      return (
                        <div
                          key={`${item.periodNumber}_${item.date}`}
                          className={`p-1.5 rounded-xl border text-[10px] leading-tight tabular-nums ${badgeCls}`}
                        >
                          <div className="font-black flex items-center justify-between">
                            <span>
                              {prefix} {item.periodNumber}
                            </span>
                            <span>
                              {isDone
                                ? "✓"
                                : item.status === "short"
                                ? "⚡"
                                : item.status === "skip"
                                ? "✕"
                                : ""}
                            </span>
                          </div>
                          <div className="text-[9px] font-semibold opacity-90 truncate mt-0.5">
                            {formatDateIN(item.date, lang)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Financial Status Summary */}
            <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 grid grid-cols-2 gap-3 text-center tabular-nums">
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">
                  {lang === "te" ? "మొత్తం చెల్లింపు" : "Total Paid"}
                </span>
                <span className="text-lg font-black text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(calculateTotalPaid(selectedBorrower.borrower))}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">
                  {lang === "te" ? "మిగిలిన బాకీ" : "Balance Remaining"}
                </span>
                <span
                  className={`text-lg font-black ${
                    calculateRemainingBalance(selectedBorrower.borrower) <= 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatCurrency(calculateRemainingBalance(selectedBorrower.borrower))}
                </span>
              </div>
            </div>

            {selectedBorrower.borrower.settledAt && (
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs flex items-center justify-between">
                <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {t.settledEarlyBadge} ({formatDateIN(selectedBorrower.borrower.settledAt, lang)})
                  </span>
                </span>
                {(selectedBorrower.borrower.settlementDiscount || 0) > 0 && (
                  <span className="font-black text-emerald-700 dark:text-emerald-300 tabular-nums">
                    Disc: {formatCurrency(selectedBorrower.borrower.settlementDiscount)}
                  </span>
                )}
              </div>
            )}

            {/* Loan Lifecycle Actions: Top-Up/Renew & Early Settlement */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={openRenewalModal}
                className="min-h-[44px] py-2.5 px-3 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{t.renewLoan}</span>
              </button>

              {!isBorrowerClosed(selectedBorrower.borrower) ? (
                <button
                  type="button"
                  onClick={openEarlySettlement}
                  className="min-h-[44px] py-2.5 px-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t.settleEarly}</span>
                </button>
              ) : (
                <div className="min-h-[44px] py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center justify-center">
                  ✓ {lang === "te" ? "ఖాతా ముగిసింది" : "Cycle Closed"}
                </div>
              )}
            </div>

            {/* Digital Passbook & PDF Statement Button */}
            <button
              type="button"
              onClick={() => setPassbookModal(true)}
              className="w-full min-h-[44px] py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-all"
            >
              <BookOpen className="w-4 h-4" />
              <span>{t.passbook}</span>
            </button>

            {/* WhatsApp Quick Actions Bar (Hidden when WhatsApp master is off) */}
            {waRules.masterEnabled && (
              <div className="grid grid-cols-2 gap-2">
                {(() => {
                  const isReceiptOff = isBorrowerReceiptDisabled(selectedBorrower.borrower, selectedBorrower.villageId, waRules);

                  if (isReceiptOff) {
                    return (
                      <div className="min-h-[44px] py-2.5 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 opacity-90 text-center">
                        <span>🔕</span>
                        <span>{lang === "te" ? "రశీదు ఆఫ్" : "Receipt Off"}</span>
                      </div>
                    );
                  }

                  return (
                    <button
                      onClick={() =>
                        handleSendLatestReceipt(
                          selectedBorrower.borrower,
                          selectedBorrower.villageName
                        )
                      }
                      className="min-h-[44px] py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
                    >
                      <MessageCircle className="w-3.5 h-3.5 fill-white" />
                      <span>{lang === "te" ? "వాట్సాప్ రశీదు" : "Send Receipt"}</span>
                    </button>
                  );
                })()}

                {waRules.autoTwoDayReminder &&
                  selectedBorrower.borrower.hasWhatsApp !== false &&
                  !selectedBorrower.borrower.disableReminder &&
                  !waRules.borrowerConfigs?.[selectedBorrower.borrower.id]?.disableReminder &&
                  !waRules.villageConfigs?.[selectedBorrower.villageId]?.disableReminder && (
                    <button
                      onClick={() =>
                        handleSendReminder(
                          selectedBorrower.borrower,
                          selectedBorrower.villageName
                        )
                      }
                      className="min-h-[44px] py-2.5 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
                    >
                      <Bell className="w-3.5 h-3.5" />
                      <span>{lang === "te" ? "2-రోజుల రిమైండర్" : "2-Day Reminder"}</span>
                    </button>
                  )}
              </div>
            )}

            {/* Payment History */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider px-1">
                {lang === "te" ? "వాయిదాల చెల్లింపు చరిత్ర" : "Installment Payment History"}
              </h4>

              {(selectedBorrower.borrower.history || []).length === 0 ? (
                <div className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-4 rounded-xl text-center text-xs text-slate-600 dark:text-slate-400">
                  {lang === "te" ? "ఇంకా వసూలు వివరాలు లేవు." : "No collection entries recorded yet."}
                </div>
              ) : (
                <div className="space-y-2">
                  {(selectedBorrower.borrower.history || []).map((h, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">
                          {h.isSettlement
                            ? "🏁"
                            : h.status === "paid"
                            ? "✅"
                            : h.status === "skip"
                            ? "❌"
                            : h.status === "short"
                            ? "⚡"
                            : "➕"}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {h.isSettlement
                              ? t.settledEarlyBadge
                              : `${getFrequencyShortPrefix(selectedBorrower.borrower.repaymentFreq)} ${idx + 1} (${h.status.toUpperCase()})`}
                          </div>
                          <div className="text-[10px] text-slate-600 dark:text-slate-400">
                            {formatDateIN(h.date, lang)}
                            {h.payMethod && ` · ${h.payMethod}`}
                          </div>
                        </div>
                      </div>

                      <div className="text-right tabular-nums">
                        <div className="font-black text-slate-900 dark:text-slate-100">
                          {h.status === "skip" ? "—" : formatCurrency(h.amtPaid)}
                        </div>
                        {h.note && (
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                            {h.note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Past Loan Cycles Archive */}
            {(selectedBorrower.borrower.loanHistory || []).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider px-1 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5" />
                  <span>{lang === "te" ? "పాత లోన్ సైకిళ్ళు" : "Previous Loan Cycles"}</span>
                </h4>
                <div className="space-y-2">
                  {[...(selectedBorrower.borrower.loanHistory || [])].reverse().map((cycle) => (
                    <div
                      key={cycle.cycle}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs flex items-center justify-between tabular-nums"
                    >
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-slate-100">
                          Cycle #{cycle.cycle} · {formatCurrency(cycle.loanAmt)} ({getFrequencyLabel(cycle.repaymentFreq, lang)})
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                          {formatDateIN(cycle.startDate, lang)} → {formatDateIN(cycle.closedDate, lang)} · {cycle.closureType.replace("_", " ")}
                        </div>
                      </div>
                      <div className="text-right font-black text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(cycle.totalPaid)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
              </>
            )}

            <button
              onClick={() => setSelectedBorrower(null)}
              className="w-full min-h-[44px] py-3 rounded-2xl neu-btn text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              {lang === "te" ? "మూసివేయండి" : "Close"}
            </button>
          </div>
        </div>
      )}

      {/* Early Settlement Modal */}
      {settleModal && selectedBorrower && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setSettleModal(false)}
        >
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              🏁 {t.settleEarly}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
              {selectedBorrower.borrower.name} ·{" "}
              {lang === "te" ? "ప్రస్తుత బాకీ:" : "Current Balance:"}{" "}
              <strong className="text-red-600 dark:text-red-400">
                {formatCurrency(calculateRemainingBalance(selectedBorrower.borrower))}
              </strong>
            </p>

            <form onSubmit={handleConfirmSettlement} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {lang === "te" ? "వసూలైన నగదు (₹)" : "Cash Received (₹)"}
                  </label>
                  <input
                    type="number"
                    required
                    value={settleCashAmt}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSettleCashAmt(val);
                      const rem = calculateRemainingBalance(selectedBorrower.borrower);
                      const disc = Math.max(0, rem - (parseInt(val, 10) || 0));
                      setSettleDiscountAmt(String(disc));
                    }}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {lang === "te" ? "డిస్కౌంట్ / మాఫీ (₹)" : "Discount Given (₹)"}
                  </label>
                  <input
                    type="number"
                    value={settleDiscountAmt}
                    onChange={(e) => setSettleDiscountAmt(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-emerald-700 dark:text-emerald-400 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {lang === "te" ? "చెల్లింపు విధానం" : "Payment Method"}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(["cash", "phonepe", "online"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSettlePayMethod(m)}
                      className={`min-h-[38px] rounded-xl text-xs font-bold capitalize border cursor-pointer ${
                        settlePayMethod === m
                          ? "bg-[#1E3A8A] border-[#1E3A8A] text-white"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {lang === "te" ? "గమనిక (ఐచ్ఛికం)" : "Note (Optional)"}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Full and final settlement"
                  value={settleNote}
                  onChange={(e) => setSettleNote(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-semibold text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSettleModal(false)}
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {lang === "te" ? "రద్దు" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold cursor-pointer shadow-md"
                >
                  {lang === "te" ? "సెటిల్ & క్లోజ్ ✓" : "Confirm Settlement ✓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Loan Renewal / Top-Up Modal */}
      {renewModal && selectedBorrower && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setRenewModal(false)}
        >
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto space-y-3">
            <h3 className="text-base font-black text-slate-900 dark:text-slate-100">
              🔄 {t.renewLoan} — {selectedBorrower.borrower.name}
            </h3>
            <p className="text-[11px] text-slate-600 dark:text-slate-400">
              {lang === "te"
                ? `పాత సైకిల్ #${selectedBorrower.borrower.loanCycle || 1} హిస్టరీలో భద్రపరచబడుతుంది.`
                : `Cycle #${selectedBorrower.borrower.loanCycle || 1} will be archived safely in Cycle History.`}
            </p>

            <form onSubmit={handleConfirmRenewal} className="space-y-3">
              {/* Frequency Toggle */}
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                {(["weekly", "daily", "monthly"] as const).map((fq) => (
                  <button
                    key={fq}
                    type="button"
                    onClick={() =>
                      setRenewForm((f) => ({
                        ...f,
                        repaymentFreq: fq,
                        durationWeeks: String(FREQ_DURATION_DEFAULTS[fq][fq === "weekly" ? 2 : 1]),
                      }))
                    }
                    className={`min-h-[38px] rounded-lg text-xs font-bold capitalize cursor-pointer ${
                      renewForm.repaymentFreq === fq
                        ? "bg-[#1E3A8A] text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    {fq}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {lang === "te" ? "కొత్త అప్పు (₹)" : "New Loan (₹)"}
                  </label>
                  <input
                    type="number"
                    required
                    value={renewForm.loanAmt}
                    onChange={(e) => setRenewForm((f) => ({ ...f, loanAmt: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {lang === "te" ? "చెల్లించాల్సిన మొత్తం (₹) *" : "Total to Pay (₹) *"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={renewForm.totalPayable}
                    onChange={(e) => setRenewForm((f) => ({ ...f, totalPayable: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {lang === "te" ? "వాయిదాల సంఖ్య" : "Tenure"}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={renewForm.durationWeeks}
                    onChange={(e) =>
                      setRenewForm((f) => ({ ...f, durationWeeks: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {lang === "te" ? "వాయిదా మార్పు" : "EMI Override"}
                  </label>
                  <input
                    type="number"
                    placeholder={`Auto ${formatCurrency(renewPreviewDue)}`}
                    value={renewForm.weeklyOverride}
                    onChange={(e) =>
                      setRenewForm((f) => ({ ...f, weeklyOverride: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between text-xs tabular-nums">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {getFrequencyShortPrefix(renewForm.repaymentFreq)} EMI:{" "}
                  <strong className="text-amber-700 dark:text-amber-400">
                    {formatCurrency(renewPreviewDue)}
                  </strong>
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {lang === "te" ? "మొత్తం:" : "Total:"}{" "}
                  <strong>
                    {formatCurrency(renewPreviewTotal)}
                  </strong>
                </span>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {t.loanStartDate}
                </label>
                <input
                  type="date"
                  value={renewForm.startDate}
                  onChange={(e) => setRenewForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {t.guarantor}
                  </label>
                  <input
                    type="text"
                    placeholder="Optional"
                    value={renewForm.guarantorName}
                    onChange={(e) =>
                      setRenewForm((f) => ({ ...f, guarantorName: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {lang === "te" ? "హామీదారు ఫోన్" : "Guarantor Phone"}
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit"
                    value={renewForm.guarantorPhone}
                    onChange={(e) =>
                      setRenewForm((f) => ({ ...f, guarantorPhone: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRenewModal(false)}
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {lang === "te" ? "రద్దు" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-[#1E3A8A] text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  {lang === "te" ? "సైకిల్ ప్రారంభించు ✓" : "Start Cycle ✓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

    {/* Edit Borrower KYC Profile Modal */}
    {profileEditModal && selectedBorrower && (
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-xs z-[65] flex items-end sm:items-center justify-center p-0 sm:p-4"
        onClick={(e) => e.target === e.currentTarget && setProfileEditModal(false)}
      >
        <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              👤 {lang === "te" ? "ఖాతాదారు ప్రొఫైల్ సవరణ" : "Edit Borrower Profile"}
            </h3>
            <button
              type="button"
              onClick={() => setProfileEditModal(false)}
              className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSaveProfileEdit} className="space-y-3">
            {/* Photo Upload */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              {profileForm.photo ? (
                <img
                  src={profileForm.photo}
                  alt="Preview"
                  className="w-14 h-14 rounded-2xl object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                  <Camera className="w-6 h-6" />
                </div>
              )}
              <div className="flex-1 space-y-1.5">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer">
                  <Camera className="w-3.5 h-3.5" />
                  <span>{lang === "te" ? "ఫోటో ఎంచుకోండి" : "Upload Photo"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const compressed = await compressBorrowerPhoto(file);
                        setProfileForm((f) => ({ ...f, photo: compressed }));
                      } catch {
                        showToast(
                          lang === "te" ? "ఫోటో లోడ్ కాలేదు" : "Could not process photo",
                          "error"
                        );
                      }
                    }}
                  />
                </label>
                {profileForm.photo && (
                  <button
                    type="button"
                    onClick={() => setProfileForm((f) => ({ ...f, photo: "" }))}
                    className="block text-[11px] font-bold text-rose-600 cursor-pointer"
                  >
                    {lang === "te" ? "ఫోటో తొలగించు" : "Remove Photo"}
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {lang === "te" ? "రోల్ నెం" : "Roll #"}
                </label>
                <input
                  type="text"
                  value={profileForm.seqNo}
                  onChange={(e) => setProfileForm((f) => ({ ...f, seqNo: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {lang === "te" ? "పేరు *" : "Full Name *"}
                </label>
                <input
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {t.gender}
                </label>
                <select
                  value={profileForm.gender}
                  onChange={(e) =>
                    setProfileForm((f) => ({
                      ...f,
                      gender: e.target.value as "" | "male" | "female" | "other",
                    }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                >
                  <option value="">{lang === "te" ? "ఎంచుకోండి" : "Select"}</option>
                  <option value="male">{lang === "te" ? "పురుషుడు" : "Male"}</option>
                  <option value="female">{lang === "te" ? "స్త్రీ" : "Female"}</option>
                  <option value="other">{lang === "te" ? "ఇతరులు" : "Other"}</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {t.age}
                </label>
                <input
                  type="number"
                  value={profileForm.age}
                  onChange={(e) => setProfileForm((f) => ({ ...f, age: e.target.value }))}
                  placeholder="e.g. 34"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {lang === "te" ? "ఫోన్ నంబర్" : "Phone"}
                </label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {t.loanStartDate}
                </label>
                <input
                  type="date"
                  value={profileForm.startDate}
                  onChange={(e) => setProfileForm((f) => ({ ...f, startDate: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                {t.occupation}
              </label>
              <input
                type="text"
                value={profileForm.occupation}
                onChange={(e) => setProfileForm((f) => ({ ...f, occupation: e.target.value }))}
                placeholder={lang === "te" ? "ఉదా: కిరాణా షాపు, వ్యవసాయం" : "e.g. Kirana Shop, Farming"}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                {t.address}
              </label>
              <input
                type="text"
                value={profileForm.address}
                onChange={(e) => setProfileForm((f) => ({ ...f, address: e.target.value }))}
                placeholder={lang === "te" ? "వీధి, ఇంటి నెంబర్" : "Door #, Street / Landmark"}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                {t.careOf}
              </label>
              <input
                type="text"
                value={profileForm.careOf}
                onChange={(e) => setProfileForm((f) => ({ ...f, careOf: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {t.guarantor}
                </label>
                <input
                  type="text"
                  value={profileForm.guarantorName}
                  onChange={(e) =>
                    setProfileForm((f) => ({ ...f, guarantorName: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {lang === "te" ? "హామీ ఫోన్" : "Guarantor Phone"}
                </label>
                <input
                  type="tel"
                  value={profileForm.guarantorPhone}
                  onChange={(e) =>
                    setProfileForm((f) => ({ ...f, guarantorPhone: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setProfileEditModal(false)}
                className="flex-1 min-h-[42px] rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                {lang === "te" ? "రద్దు" : "Cancel"}
              </button>
              <button
                type="submit"
                className="flex-1 min-h-[42px] rounded-xl bg-[#1E3A8A] text-white text-xs font-black cursor-pointer"
              >
                {lang === "te" ? "సేవ్ చేయండి ✓" : "Save Profile ✓"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {/* Printable & Shareable Digital Passbook Modal */}
    {passbookModal && selectedBorrower && (
      <BorrowerPassbookModal
        borrower={selectedBorrower.borrower}
        villageName={selectedBorrower.villageName}
        profile={profile}
        lang={lang}
        onClose={() => setPassbookModal(false)}
        showToast={showToast}
      />
    )}
    </>
  );
};
