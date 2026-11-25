import React, { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  Share2,
  MessageCircle,
  Trash2,
  Edit2,
  Coins,
  ChevronRight,
  ArrowLeft,
  Calendar,
  Wallet,
  Building2,
  Navigation,
  Bell,
  PhoneOff,
  Phone,
  ShieldCheck,
  Camera,
  Lock,
} from "lucide-react";
import { compressBorrowerPhoto } from "../utils/imageUtils";
import {
  Borrower,
  Village,
  CollectionRecord,
  CollectionEntry,
  PaymentMethod,
  Language,
  BusinessProfile,
  HistoryEntry,
  PaymentStatus,
  DayOfWeek,
  RepaymentFrequency,
  LoanEntryMode,
} from "../types";
import { translations } from "../translations";
import {
  formatCurrency,
  formatDateIN,
  getTodayStr,
  getDayName,
  calculateRemainingBalance,
  ALL_DAYS_MON_FIRST,
  translateDayName,
} from "../utils/dateUtils";
import {
  applyCollectionEntriesIdempotently,
  calculateInstallmentDueFromTotal,
  computeImpliedInterestPct,
  getDaysSinceScheduledDay,
  getFrequencyLabel,
  getFrequencyShortPrefix,
  getVillageCollectionAccess,
  isBorrowerClosed,
  resolveLoanTermsByMode,
} from "../utils/financeUtils";
import {
  buildWhatsAppReceiptText,
  buildAdvanceReminderText,
  openWhatsApp,
  getWhatsAppRules,
  saveWhatsAppRules,
  canAutoSendReceipt,
  isBorrowerKeypad,
  isBorrowerReceiptDisabled,
  isReceiptSent,
  markReceiptSent,
  getTelHref,
} from "../utils/whatsapp";
import { WhatsAppReceiptModal } from "./WhatsAppReceiptModal";
import { WhatsAppReminderCenter } from "./WhatsAppReminderCenter";

interface CollectTabProps {
  data: { villages: Village[]; borrowers: Record<string, Borrower[]> };
  onUpdateData: (newData: {
    villages: Village[];
    borrowers: Record<string, Borrower[]>;
  }) => void;
  collections: Record<string, CollectionRecord>;
  onSaveCollection: (
    col: CollectionRecord,
    updatedBorrowers: Record<string, Borrower[]>
  ) => void;
  onAddNewLoanLog: (item: any) => void;
  profile: BusinessProfile;
  lang: Language;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const CollectTab: React.FC<CollectTabProps> = ({
  data,
  onUpdateData,
  collections,
  onSaveCollection,
  onAddNewLoanLog,
  profile,
  lang,
  showToast,
}) => {
  const [screen, setScreen] = useState<"villages" | "detail" | "sheet">("villages");
  const [selectedVillage, setSelectedVillage] = useState<Village | null>(null);
  const [entries, setEntries] = useState<Record<string, CollectionEntry>>({});

  // Modals
  const [payModalBorrower, setPayModalBorrower] = useState<Borrower | null>(null);
  const [shortModalBorrower, setShortModalBorrower] = useState<Borrower | null>(null);
  const [shortAmt, setShortAmt] = useState("");
  const [shortNote, setShortNote] = useState("");

  const [extraModalBorrower, setExtraModalBorrower] = useState<Borrower | null>(null);
  const [extraAmt, setExtraAmt] = useState("");
  const [extraNote, setExtraNote] = useState("");

  const [cashCloseModal, setCashCloseModal] = useState(false);
  const [personalUseAmt, setPersonalUseAmt] = useState("");

  // WhatsApp Receipt & Reminder Modals
  const [receiptModalData, setReceiptModalData] = useState<{
    borrower: Borrower;
    amtPaid: number;
    status: PaymentStatus;
    payMethod: PaymentMethod;
    note?: string;
    extraAmt?: number;
    remainingBal: number;
  } | null>(null);
  const [showReminderCenter, setShowReminderCenter] = useState(false);

  const getPreferredLineDay = (): DayOfWeek => {
    const todayDay = (getDayName(getTodayStr(), "en") as DayOfWeek) || "Monday";
    if (profile.lineDaysMode === "specific" && profile.lineDays && profile.lineDays.length > 0) {
      return profile.lineDays.includes(todayDay) ? todayDay : profile.lineDays[0];
    }
    return todayDay;
  };

  // Quick Add Village Modal (supports choosing any of the 7 weekdays)
  const [addVillageModal, setAddVillageModal] = useState(false);
  const [newVillageName, setNewVillageName] = useState("");
  const [newVillageDay, setNewVillageDay] = useState<DayOfWeek>(getPreferredLineDay);

  // Add & Edit Borrower Modals
  const [addBorrowerModal, setAddBorrowerModal] = useState(false);
  const [newBorrowerForm, setNewBorrowerForm] = useState({
    name: "",
    phone: "",
    seqNo: "",
    careOf: "",
    guarantorName: "",
    guarantorPhone: "",
    repaymentFreq: "weekly" as RepaymentFrequency,
    loanAmt: "10000",
    interestPct: "20",
    totalPayable: "12000",
    durationWeeks: "12",
    weeklyOverride: "",
    startDate: getTodayStr(),
    isOngoing: false,
    weeksPaid: "0",
    hasWhatsApp: true,
    disableReceipt: false,
    disableReminder: false,
    photo: "",
    gender: "" as "" | "male" | "female" | "other",
    age: "",
    occupation: "",
    address: "",
  });

  const [editBorrowerModal, setEditBorrowerModal] = useState<Borrower | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    seqNo: "",
    careOf: "",
    guarantorName: "",
    guarantorPhone: "",
    startDate: getTodayStr(),
    hasWhatsApp: true,
    disableReceipt: false,
    disableReminder: false,
    photo: "",
    gender: "" as "" | "male" | "female" | "other",
    age: "",
    occupation: "",
    address: "",
  });
  const [deleteConfirmBorrower, setDeleteConfirmBorrower] = useState<Borrower | null>(null);

  const t = translations[lang];
  const todayStr = getTodayStr();
  const todayEn = (getDayName(todayStr, "en") as DayOfWeek) || "Monday";
  const waRules = getWhatsAppRules();

  const getCollectionAccess = (v: Village) => getVillageCollectionAccess(v, todayStr);
  const getCollectionKey = (v: Village) => `${v.id}_${getCollectionAccess(v).targetDateStr}`;
  const selectedAccess = selectedVillage ? getCollectionAccess(selectedVillage) : null;
  const activeCollectionDate = selectedAccess?.targetDateStr || todayStr;

  // Sorted borrowers for currently selected village (numerical by seqNo)
  const currentBorrowers = selectedVillage
    ? [...(data.borrowers[selectedVillage.id] || [])].sort((a, b) => {
        const na = a.seqNo ? parseInt(a.seqNo) || 0 : 99999;
        const nb = b.seqNo ? parseInt(b.seqNo) || 0 : 99999;
        if (na !== nb) return na - nb;
        return (a.seqNo || "").localeCompare(b.seqNo || "");
      })
    : [];

  const openVillage = (v: Village) => {
    setSelectedVillage(v);
    const existing = collections[getCollectionKey(v)];
    if (existing && existing.entries) {
      const map: Record<string, CollectionEntry> = {};
      existing.entries.forEach((e) => {
        map[e.borrowerId] = e;
      });
      setEntries(map);
    } else {
      setEntries({});
    }
    setScreen("detail");
  };

  // Status marking handlers
  const handlePaidClick = (b: Borrower) => {
    const existing = entries[b.id];
    if (existing && existing.status === "paid") {
      const copy = { ...entries };
      delete copy[b.id];
      setEntries(copy);
    } else {
      setPayModalBorrower(b);
    }
  };

  const confirmPaidMethod = (method: PaymentMethod) => {
    if (!payModalBorrower || !selectedVillage) return;
    const b = payModalBorrower;
    const amt = b.weeklyDue;
    const villageId = selectedVillage.id;

    // Calculate remaining balance after this installment
    const curRem = calculateRemainingBalance(b);
    const updatedRem = Math.max(0, curRem - amt);

    const rules = getWhatsAppRules();
    const canAuto = canAutoSendReceipt(b, villageId, rules);

    setEntries((prev) => ({
      ...prev,
      [b.id]: {
        borrowerId: b.id,
        status: "paid",
        amtPaid: amt,
        payMethod: method,
        receiptSent: canAuto,
      },
    }));

    if (canAuto) {
      const msg = buildWhatsAppReceiptText({
        borrower: { ...b, weeksPaid: b.weeksPaid + 1 },
        amtPaid: amt,
        status: "paid",
        dateStr: activeCollectionDate,
        villageName: selectedVillage.name,
        businessName: profile.businessName,
        payMethod: method,
        remainingBal: updatedRem,
        lang,
      });
      openWhatsApp(b.phone, msg);
      markReceiptSent(b.id, activeCollectionDate);
      showToast(
        lang === "te"
          ? `${b.name} కి వాట్సాప్ రశీదు పంపబడింది ✓`
          : `Receipt sent to ${b.name} on WhatsApp ✓`,
        "success"
      );
    } else {
      if (isBorrowerKeypad(b, rules)) {
        showToast(
          lang === "te"
            ? `${b.name} - వాయిదా నమోదైంది (కీప్యాడ్ మొబైల్ 📵)`
            : `${b.name} - Payment recorded (Keypad phone 📵)`,
          "info"
        );
      } else {
        showToast(
          lang === "te"
            ? `${b.name} - వాయిదా నమోదైంది ✓`
            : `${b.name} - Payment recorded ✓`,
          "success"
        );
      }
    }

    setPayModalBorrower(null);
  };

  const handleSkipClick = (b: Borrower) => {
    const existing = entries[b.id];
    if (existing && existing.status === "skip") {
      const copy = { ...entries };
      delete copy[b.id];
      setEntries(copy);
    } else {
      setEntries((prev) => ({
        ...prev,
        [b.id]: {
          borrowerId: b.id,
          status: "skip",
          amtPaid: 0,
        },
      }));
    }
  };

  const openShortModal = (b: Borrower) => {
    const existing = entries[b.id];
    setShortAmt(existing && existing.status === "short" ? String(existing.amtPaid) : "");
    setShortNote(existing?.note || "");
    setShortModalBorrower(b);
  };

  const saveShortPayment = () => {
    if (!shortModalBorrower || !selectedVillage) return;
    const b = shortModalBorrower;
    const paid = parseInt(shortAmt) || 0;
    const note = shortNote.trim() || "Balance next week";
    const villageId = selectedVillage.id;

    const curRem = calculateRemainingBalance(b);
    const updatedRem = Math.max(0, curRem - paid);

    const rules = getWhatsAppRules();
    const canAuto = canAutoSendReceipt(b, villageId, rules);

    setEntries((prev) => ({
      ...prev,
      [b.id]: {
        borrowerId: b.id,
        status: "short",
        amtPaid: paid,
        note,
        receiptSent: canAuto,
      },
    }));

    if (canAuto) {
      const msg = buildWhatsAppReceiptText({
        borrower: { ...b, weeksPaid: b.weeksPaid + 1 },
        amtPaid: paid,
        status: "short",
        dateStr: activeCollectionDate,
        villageName: selectedVillage.name,
        businessName: profile.businessName,
        payMethod: "cash",
        note,
        remainingBal: updatedRem,
        lang,
      });
      openWhatsApp(b.phone, msg);
      markReceiptSent(b.id, activeCollectionDate);
      showToast(
        lang === "te"
          ? `${b.name} కి పాక్షిక రశీదు వాట్సాప్‌లో పంపబడింది ✓`
          : `Short receipt sent to ${b.name} on WhatsApp ✓`,
        "success"
      );
    } else {
      showToast(
        lang === "te"
          ? `${b.name} - పాక్షిక వాయిదా నమోదైంది ⚡`
          : `${b.name} - Short payment recorded ⚡`,
        "info"
      );
    }

    setShortModalBorrower(null);
  };

  const openExtraModal = (b: Borrower) => {
    const existing = entries[b.id];
    setExtraAmt(existing?.extraAmt ? String(existing.extraAmt) : "");
    setExtraNote(existing?.note || "");
    setExtraModalBorrower(b);
  };

  const saveExtraPayment = () => {
    if (!extraModalBorrower || !selectedVillage) return;
    const b = extraModalBorrower;
    const extra = parseInt(extraAmt) || 0;
    const totalCollectedForB = b.weeklyDue + extra;
    const note = extraNote.trim();
    const villageId = selectedVillage.id;

    const curRem = calculateRemainingBalance(b);
    const updatedRem = Math.max(0, curRem - totalCollectedForB);

    const rules = getWhatsAppRules();
    const canAuto = canAutoSendReceipt(b, villageId, rules);

    setEntries((prev) => ({
      ...prev,
      [b.id]: {
        borrowerId: b.id,
        status: "extra",
        amtPaid: totalCollectedForB,
        extraAmt: extra,
        note,
        receiptSent: canAuto,
      },
    }));

    if (canAuto) {
      const msg = buildWhatsAppReceiptText({
        borrower: { ...b, weeksPaid: b.weeksPaid + 1 },
        amtPaid: totalCollectedForB,
        status: "extra",
        extraAmt: extra,
        dateStr: activeCollectionDate,
        villageName: selectedVillage.name,
        businessName: profile.businessName,
        payMethod: "cash",
        note,
        remainingBal: updatedRem,
        lang,
      });
      openWhatsApp(b.phone, msg);
      markReceiptSent(b.id, activeCollectionDate);
      showToast(
        lang === "te"
          ? `${b.name} కి అదనపు రశీదు వాట్సాప్‌లో పంపబడింది ✓`
          : `Extra receipt sent to ${b.name} on WhatsApp ✓`,
        "success"
      );
    } else {
      showToast(
        lang === "te"
          ? `${b.name} - అదనపు వాయిదా నమోదైంది ➕`
          : `${b.name} - Extra payment recorded ➕`,
        "info"
      );
    }

    setExtraModalBorrower(null);
  };

  // Calculations for current village collection sheet (exclude closed/settled unless already marked today)
  const activeOrMarkedBorrowers = currentBorrowers.filter(
    (b) => !isBorrowerClosed(b) || Boolean(entries[b.id])
  );
  const totalExpected = activeOrMarkedBorrowers.reduce((sum, b) => sum + b.weeklyDue, 0);
  const totalCollected = Object.values(entries).reduce((sum, e) => sum + (e.amtPaid || 0), 0);
  const paidCount = Object.values(entries).filter((e) => e.status === "paid").length;
  const skipCount = Object.values(entries).filter((e) => e.status === "skip").length;
  const shortCount = Object.values(entries).filter((e) => e.status === "short").length;
  const extraCount = Object.values(entries).filter((e) => e.status === "extra").length;
  const pendingCount = Math.max(
    0,
    activeOrMarkedBorrowers.length - (paidCount + skipCount + shortCount + extraCount)
  );

  // Apply entries to borrowers idempotently (Fixes D4, D5)
  const applyEntriesToBorrowers = (personalVal: number = 0) => {
    if (!selectedVillage) return;
    const villageId = selectedVillage.id;
    const currentList = data.borrowers[villageId] || [];

    // Pure, idempotent calculation that supports editing collections on the active line date (including 2-day grace updates)
    const updatedBorrowers = applyCollectionEntriesIdempotently(
      currentList,
      entries,
      activeCollectionDate
    );

    const newBorrowersMap = {
      ...data.borrowers,
      [villageId]: updatedBorrowers,
    };

    const collectionRecord: CollectionRecord = {
      villageId,
      villageName: selectedVillage.name,
      date: activeCollectionDate,
      entries: Object.values(entries),
      totalExpected,
      totalCollected,
      newLoans: 0,
      personalUse: personalVal,
      savedAt: new Date().toISOString(),
    };

    onSaveCollection(collectionRecord, newBorrowersMap);
  };

  const handleQuickSave = () => {
    applyEntriesToBorrowers(0);
    showToast(lang === "te" ? "రికార్డులు సేవ్ అయ్యాయి ✓" : "Saved & borrowers updated ✓", "success");
  };

  const handleFinishCashClose = () => {
    applyEntriesToBorrowers(0);
    setCashCloseModal(false);
    showToast(lang === "te" ? "వసూలు ముగిసింది ✓" : "Collection saved & closed ✓", "success");
    setScreen("detail");
  };

  const loanEntryMode: LoanEntryMode = profile.loanEntryMode || "principal_total";

  // Add Borrower Submit (Fix D7: Check seqNo uniqueness in same village)
  const handleAddBorrower = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVillage || !newBorrowerForm.name) return;
    if (loanEntryMode === "total_only") {
      if (!newBorrowerForm.totalPayable) return;
    } else if (!newBorrowerForm.loanAmt) {
      return;
    }

    const villageId = selectedVillage.id;
    const existingBs = data.borrowers[villageId] || [];

    if (newBorrowerForm.seqNo.trim()) {
      const dup = existingBs.find(
        (b) => b.seqNo.toLowerCase() === newBorrowerForm.seqNo.trim().toLowerCase()
      );
      if (dup) {
        showToast(
          lang === "te"
            ? `నెం #${newBorrowerForm.seqNo} ఇప్పటికే ${dup.name} కి కేటాయించబడింది`
            : `Roll #${newBorrowerForm.seqNo} already used by ${dup.name}`,
          "error"
        );
        return;
      }
    }

    const defaultPeriods =
      newBorrowerForm.repaymentFreq === "daily"
        ? 60
        : newBorrowerForm.repaymentFreq === "monthly"
        ? 10
        : 12;
    const resolvedTerms = resolveLoanTermsByMode({
      mode: loanEntryMode,
      loanAmtInput: parseInt(newBorrowerForm.loanAmt, 10) || 10000,
      interestPctInput: parseFloat(newBorrowerForm.interestPct) || 0,
      totalPayableInput: parseInt(newBorrowerForm.totalPayable, 10) || 0,
      periods: Math.max(1, parseInt(newBorrowerForm.durationWeeks, 10) || defaultPeriods),
      weeklyOverride: parseInt(newBorrowerForm.weeklyOverride, 10) || 0,
    });
    const loan = resolvedTerms.loanAmt;
    const weeks = resolvedTerms.periods;
    const weeklyDue = resolvedTerms.weeklyDue;
    const totalReturn = resolvedTerms.totalReturn;
    const pct = resolvedTerms.interestPct;
    const weeksPaid = newBorrowerForm.isOngoing ? parseInt(newBorrowerForm.weeksPaid) || 0 : 0;

    const newBorrower: Borrower = {
      id: `b${Date.now()}`,
      seqNo: newBorrowerForm.seqNo.trim(),
      name: newBorrowerForm.name.trim(),
      phone: newBorrowerForm.phone.trim(),
      careOf: newBorrowerForm.careOf.trim() || undefined,
      guarantorName: newBorrowerForm.guarantorName.trim() || undefined,
      guarantorPhone: newBorrowerForm.guarantorPhone.trim() || undefined,
      repaymentFreq: newBorrowerForm.repaymentFreq,
      loanCycle: 1,
      loanAmt: loan,
      durationWeeks: weeks,
      interestPct: pct,
      weeklyDue,
      totalReturn,
      weeksPaid,
      startDate: newBorrowerForm.startDate || todayStr,
      isOngoing: newBorrowerForm.isOngoing,
      history: [],
      hasWhatsApp: newBorrowerForm.hasWhatsApp,
      disableReceipt: newBorrowerForm.disableReceipt,
      disableReminder: newBorrowerForm.disableReminder,
      photo: newBorrowerForm.photo || undefined,
      gender: newBorrowerForm.gender || undefined,
      age: newBorrowerForm.age.trim() || undefined,
      occupation: newBorrowerForm.occupation.trim() || undefined,
      address: newBorrowerForm.address.trim() || undefined,
    };

    onUpdateData({
      ...data,
      borrowers: {
        ...data.borrowers,
        [villageId]: [...existingBs, newBorrower],
      },
    });

    // Keep WhatsApp rules storage strictly in sync
    const currentWaRules = getWhatsAppRules();
    saveWhatsAppRules({
      ...currentWaRules,
      borrowerConfigs: {
        ...currentWaRules.borrowerConfigs,
        [newBorrower.id]: {
          hasWhatsApp: newBorrowerForm.hasWhatsApp,
          disableReceipt: newBorrowerForm.disableReceipt,
          disableReminder: newBorrowerForm.disableReminder,
        },
      },
    });

    if (!newBorrowerForm.isOngoing) {
      onAddNewLoanLog({
        id: `nl${Date.now()}`,
        borrowerName: newBorrower.name,
        seqNo: newBorrower.seqNo,
        villageName: selectedVillage.name,
        villageId,
        loanAmt: loan,
        date: newBorrowerForm.startDate || todayStr,
      });
    }

    setNewBorrowerForm({
      name: "",
      phone: "",
      seqNo: "",
      careOf: "",
      guarantorName: "",
      guarantorPhone: "",
      repaymentFreq: "weekly",
      loanAmt: "10000",
      interestPct: "20",
      totalPayable: "12000",
      durationWeeks: "12",
      weeklyOverride: "",
      startDate: todayStr,
      isOngoing: false,
      weeksPaid: "0",
      hasWhatsApp: true,
      disableReceipt: false,
      disableReminder: false,
      photo: "",
      gender: "",
      age: "",
      occupation: "",
      address: "",
    });
    setAddBorrowerModal(false);
    showToast(lang === "te" ? "కొత్త ఖాతాదారుడు చేర్చబడ్డాడు ✓" : "Borrower added ✓", "success");
  };

  const handleSaveEditBorrower = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBorrowerModal || !selectedVillage) return;
    const villageId = selectedVillage.id;

    if (editForm.seqNo.trim()) {
      const dup = (data.borrowers[villageId] || []).find(
        (b) =>
          b.id !== editBorrowerModal.id &&
          b.seqNo.toLowerCase() === editForm.seqNo.trim().toLowerCase()
      );
      if (dup) {
        showToast(
          lang === "te"
            ? `నెం #${editForm.seqNo} ఇప్పటికే ${dup.name} కి కేటాయించబడింది`
            : `Roll #${editForm.seqNo} already used by ${dup.name}`,
          "error"
        );
        return;
      }
    }

    const updated = (data.borrowers[villageId] || []).map((b) =>
      b.id === editBorrowerModal.id
        ? {
            ...b,
            name: editForm.name.trim() || b.name,
            phone: editForm.phone.trim(),
            seqNo: editForm.seqNo.trim(),
            careOf: editForm.careOf.trim() || undefined,
            guarantorName: editForm.guarantorName.trim() || undefined,
            guarantorPhone: editForm.guarantorPhone.trim() || undefined,
            startDate: editForm.startDate || b.startDate,
            hasWhatsApp: editForm.hasWhatsApp,
            disableReceipt: editForm.disableReceipt,
            disableReminder: editForm.disableReminder,
            photo: editForm.photo || undefined,
            gender: editForm.gender || undefined,
            age: editForm.age.trim() || undefined,
            occupation: editForm.occupation.trim() || undefined,
            address: editForm.address.trim() || undefined,
          }
        : b
    );

    onUpdateData({
      ...data,
      borrowers: { ...data.borrowers, [villageId]: updated },
    });

    // Keep WhatsApp rules storage strictly in sync
    const currentWaRules = getWhatsAppRules();
    saveWhatsAppRules({
      ...currentWaRules,
      borrowerConfigs: {
        ...currentWaRules.borrowerConfigs,
        [editBorrowerModal.id]: {
          hasWhatsApp: editForm.hasWhatsApp,
          disableReceipt: editForm.disableReceipt,
          disableReminder: editForm.disableReminder,
        },
      },
    });

    setEditBorrowerModal(null);
    showToast(lang === "te" ? "వివరాలు మారాయి ✓" : "Borrower updated ✓", "success");
  };

  const handleDeleteBorrower = (bId: string) => {
    if (!selectedVillage) return;
    const villageId = selectedVillage.id;
    const updated = (data.borrowers[villageId] || []).filter((b) => b.id !== bId);
    onUpdateData({
      ...data,
      borrowers: { ...data.borrowers, [villageId]: updated },
    });
    setDeleteConfirmBorrower(null);
    showToast(lang === "te" ? "తొలగించబడింది" : "Borrower removed", "info");
  };

  // 1-Click WhatsApp Receipt Trigger
  const handleSendReceipt = (b: Borrower) => {
    const rules = getWhatsAppRules();
    const isKeypad = isBorrowerKeypad(b, rules);
    const receiptDisabled =
      b.disableReceipt ||
      rules.borrowerConfigs[b.id]?.disableReceipt ||
      (selectedVillage ? rules.villageConfigs[selectedVillage.id]?.disableReceipt : false);

    if (isKeypad) {
      showToast(
        lang === "te"
          ? `${b.name} సాధారణ కీప్యాడ్ మొబైల్ గలవారు (వాట్సాప్ లేదు 📵)`
          : `${b.name} has a keypad mobile (No WhatsApp 📵)`,
        "info"
      );
      return;
    }

    if (receiptDisabled) {
      showToast(
        lang === "te"
          ? `${b.name} కి వాట్సాప్ రశీదు ఆపివేయబడింది 🔕`
          : `WhatsApp receipts are disabled for ${b.name} 🔕`,
        "info"
      );
      return;
    }

    const e = entries[b.id];
    const amtPaid = e?.amtPaid !== undefined ? e.amtPaid : b.weeklyDue;
    const status = e?.status || "paid";
    const payMethod = e?.payMethod || "cash";
    const note = e?.note || "";
    const extraAmt = e?.extraAmt || 0;
    const rem = calculateRemainingBalance(b);

    setReceiptModalData({
      borrower: b,
      amtPaid,
      status,
      payMethod,
      note,
      extraAmt,
      remainingBal: rem,
    });
  };

  // 1-Click Advance Reminder Trigger
  const handleSendAdvanceReminder = (b: Borrower) => {
    const rem = calculateRemainingBalance(b);
    const msg = buildAdvanceReminderText({
      borrower: b,
      villageName: selectedVillage?.name || "",
      visitDate: todayStr,
      businessName: profile.businessName,
      remainingBal: rem,
      lang,
    });
    openWhatsApp(b.phone, msg);
  };

  // SCREEN 1: Villages List (shows strictly the days & villages added by the lender)
  if (screen === "villages") {
    const configuredDaysSet = new Set(data.villages.map((v) => v.day));
    const orderedConfiguredDays: DayOfWeek[] = [...ALL_DAYS_MON_FIRST]
      .filter((d) => configuredDaysSet.has(d))
      .sort((a, b) => {
        const da = getDaysSinceScheduledDay(a, todayEn);
        const db = getDaysSinceScheduledDay(b, todayEn);
        const ra = da === 0 ? 0 : da > 0 && da <= 2 ? da : 10 + ALL_DAYS_MON_FIRST.indexOf(a);
        const rb = db === 0 ? 0 : db > 0 && db <= 2 ? db : 10 + ALL_DAYS_MON_FIRST.indexOf(b);
        return ra - rb;
      });

    return (
      <div className="pb-28 px-4 sm:px-5 pt-3 space-y-4">
        {/* Hero Card */}
        <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {lang === "te" ? "వసూలు కోసం గ్రామాన్ని ఎంచుకోండి" : "Select Village"}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                {lang === "te" ? "నేటి లైన్ వసూలు" : "Today's Line Collection"}
              </h2>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/60 flex items-center justify-center text-blue-700 dark:text-blue-300 shrink-0">
              <Navigation className="w-6 h-6" />
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              {formatDateIN(todayStr, lang)} · {getDayName(todayStr, lang)}
            </p>
            <button
              type="button"
              onClick={() => {
                setNewVillageDay(getPreferredLineDay());
                setAddVillageModal(true);
              }}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#1E3A8A] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs hover:bg-blue-900 active:scale-98 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === "te" ? "గ్రామం చేర్చండి" : "Add Village"}</span>
            </button>
          </div>
        </div>

        {orderedConfiguredDays.length === 0 ? (
          <div className="rounded-3xl p-8 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 text-center space-y-3 shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 flex items-center justify-center mx-auto">
              <Building2 className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {t.noVillagesYet}
            </p>
            <button
              type="button"
              onClick={() => {
                setNewVillageDay(getPreferredLineDay());
                setAddVillageModal(true);
              }}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/50"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === "te" ? "మొదటి గ్రామాన్ని జోడించండి" : "Add Your First Village"}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orderedConfiguredDays.map((day) => {
              const vList = data.villages.filter((v) => v.day === day);
              const isToday = todayEn === day;
              const dayLabel = translateDayName(day, lang);

              return (
                <div key={day} className="space-y-2.5">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span>
                        {lang === "te" ? `${dayLabel} గ్రామాలు` : `${day} Villages`}
                      </span>
                      {isToday && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-black">
                          {lang === "te" ? "ఈరోజు" : "TODAY"}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium tabular-nums">
                      {vList.length} {t.villages}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {vList.map((v) => {
                      const bs = data.borrowers[v.id] || [];
                      const access = getCollectionAccess(v);
                      const isDone = !!collections[getCollectionKey(v)];

                      return (
                        <button
                          type="button"
                          key={v.id}
                          onClick={() => openVillage(v)}
                          className={`w-full text-left rounded-2xl p-4 bg-white dark:bg-[#131B2E] border flex items-center justify-between cursor-pointer hover:border-blue-500/50 transition-all shadow-xs active:scale-99 ${
                            isDone
                              ? "border-emerald-400/70 dark:border-emerald-700"
                              : access.isGraceModifyWindow
                              ? "border-blue-300 dark:border-blue-700"
                              : "border-slate-200 dark:border-slate-800"
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                                isDone ? "badge-pastel-green" : "badge-pastel-blue"
                              }`}
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-6 h-6 text-emerald-700 dark:text-emerald-400" />
                              ) : (
                                <Building2 className="w-5 h-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-base truncate">
                                {v.name}
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                                {bs.length}{" "}
                                {lang === "te"
                                  ? t.borrowers
                                  : bs.length === 1
                                  ? "borrower"
                                  : "borrowers"}{" "}
                                · {dayLabel}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isDone && access.isGraceModifyWindow ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold text-[11px] tabular-nums">
                                {lang === "te"
                                  ? `✓ పూర్తి · మార్పు (${access.graceDaysRemaining}రో)`
                                  : `✓ Done · Edit (${access.graceDaysRemaining}d)`}
                              </span>
                            ) : isDone ? (
                              <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                                {lang === "te" ? "✓ పూర్తయింది" : "✓ Done"}
                              </span>
                            ) : access.isScheduledDay ? (
                              <span className="text-xs font-bold text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800">
                                {lang === "te" ? "ప్రారంభించు →" : "Start →"}
                              </span>
                            ) : access.isGraceModifyWindow ? (
                              <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 tabular-nums">
                                {lang === "te"
                                  ? `మార్పు (${access.graceDaysRemaining}రో)`
                                  : `Modify (${access.graceDaysRemaining}d)`}
                              </span>
                            ) : (
                              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                <span>
                                  {lang === "te" ? `${dayLabel} మాత్రమే` : `${v.day} Only`}
                                </span>
                              </span>
                            )}
                            <ChevronRight className="w-5 h-5 text-slate-400" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Add Village Modal (All 7 Days) */}
        {addVillageModal && (
          <div
            className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-center justify-center p-4"
            onClick={() => setAddVillageModal(false)}
          >
            <div
              className="rounded-3xl p-5 max-w-sm w-full bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                  {lang === "te" ? "కొత్త గ్రామం చేర్చండి" : "Add Line Village"}
                </h3>
                <button
                  type="button"
                  onClick={() => setAddVillageModal(false)}
                  aria-label="Close"
                  className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newVillageName.trim()) return;
                  const newV: Village = {
                    id: `v${Date.now()}`,
                    name: newVillageName.trim(),
                    day: newVillageDay,
                  };
                  onUpdateData({
                    ...data,
                    villages: [...data.villages, newV],
                    borrowers: { ...data.borrowers, [newV.id]: [] },
                  });
                  setNewVillageName("");
                  setAddVillageModal(false);
                  showToast(
                    lang === "te" ? "కొత్త గ్రామం చేర్చబడింది ✓" : "Village added successfully ✓",
                    "success"
                  );
                }}
                className="space-y-3"
              >
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 uppercase">
                    {lang === "te" ? "గ్రామం పేరు *" : "Village Name *"}
                  </label>
                  <input
                    type="text"
                    required
                    value={newVillageName}
                    onChange={(e) => setNewVillageName(e.target.value)}
                    placeholder="e.g. Attili"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 uppercase">
                    {lang === "te" ? "వసూలు రోజు *" : "Line Day *"}
                  </label>
                  <select
                    value={newVillageDay}
                    onChange={(e) => setNewVillageDay(e.target.value as DayOfWeek)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-blue-500"
                  >
                    {ALL_DAYS_MON_FIRST.map((day) => (
                      <option key={day} value={day}>
                        {lang === "te" ? `${translateDayName(day, "te")} (${day})` : day}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddVillageModal(false)}
                    className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                  >
                    {lang === "te" ? "రద్దు" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-[#1E3A8A] text-white text-xs font-bold shadow-md hover:bg-blue-900 cursor-pointer"
                  >
                    + {lang === "te" ? "జోడించండి" : "Add Village"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // SCREEN 2: Village Detail
  if (screen === "detail" && selectedVillage) {
    const access = getCollectionAccess(selectedVillage);
    const isDone = !!collections[getCollectionKey(selectedVillage)];
    const activeBs = currentBorrowers.filter((b) => !isBorrowerClosed(b)).length;
    const villageDayLabel = translateDayName(selectedVillage.day, lang);
    const todayDayLabel = getDayName(todayStr, lang);
    const targetDateFormatted = formatDateIN(access.targetDateStr, lang);
    const villageRemindersEnabled =
      waRules.masterEnabled &&
      waRules.autoTwoDayReminder &&
      !waRules.villageConfigs?.[selectedVillage.id]?.disableReminder;

    return (
      <div className="pb-28 px-4 sm:px-5 pt-3 space-y-4">
        {/* Prominent Back Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setScreen("villages")}
            className="w-11 h-11 rounded-full bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
            title={lang === "te" ? "అన్ని గ్రామాలు" : "All Villages"}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {selectedVillage.name}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium tabular-nums">
              {lang === "te"
                ? `${villageDayLabel} లైన్ · ${currentBorrowers.length} ${t.borrowers}`
                : `${selectedVillage.day} Line · ${currentBorrowers.length} ${t.borrowers}`}
            </p>
          </div>
        </div>

        {/* Hero Card */}
        <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                {lang === "te" ? `${villageDayLabel} గ్రామం` : `${selectedVillage.day} Village`}
              </span>
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5">
                {selectedVillage.name}
              </h2>
            </div>
            {isDone && (
              <span className="px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>
                  {access.isGraceModifyWindow
                    ? lang === "te"
                      ? `సేవ్ అయింది (${targetDateFormatted})`
                      : `Saved (${targetDateFormatted})`
                    : lang === "te"
                    ? "నేడు సేవ్ అయింది"
                    : "Saved Today"}
                </span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 text-center tabular-nums">
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">
                {t.borrowers}
              </span>
              <span className="text-lg font-black text-slate-900 dark:text-slate-100">
                {currentBorrowers.length}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">
                {t.active}
              </span>
              <span className="text-lg font-black text-slate-900 dark:text-slate-100">{activeBs}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold block">
                {lang === "te" ? "వసూలు లక్ష్యం" : "Expected Target"}
              </span>
              <span className="text-base font-black text-amber-700 dark:text-amber-400">
                {formatCurrency(totalExpected)}
              </span>
            </div>
          </div>
        </div>

        {/* 2-Day Grace Allowance Notice OR Schedule Lock Notice */}
        {access.isGraceModifyWindow ? (
          <div className="rounded-2xl p-3.5 bg-blue-50 dark:bg-blue-950/35 border border-blue-200 dark:border-blue-800 text-xs flex items-start gap-2.5">
            <Calendar className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
            <div className="text-blue-900 dark:text-blue-200 font-semibold leading-relaxed">
              {lang === "te"
                ? `2 రోజుల సవరణ అవకాశం (${access.graceDaysRemaining} రోజు మిగిలి ఉంది): PhonePe లేదా మరుసటి రోజు చెల్లింపుల కోసం ${villageDayLabel} (${targetDateFormatted}) వసూలును మార్చవచ్చు.`
                : `2-Day Grace Window (${access.graceDaysRemaining} day${access.graceDaysRemaining > 1 ? "s" : ""} left): You can modify ${selectedVillage.day}'s collection (${targetDateFormatted}) for late PhonePe or next-day payments.`}
            </div>
          </div>
        ) : !access.allowed ? (
          <div className="rounded-2xl p-3.5 bg-amber-50 dark:bg-amber-950/35 border border-amber-300 dark:border-amber-800 text-xs flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-amber-900 dark:text-amber-200 font-semibold leading-relaxed">
              {lang === "te"
                ? `ఈ గ్రామం వసూలు రోజు ${villageDayLabel} (తర్వాత 2 రోజులు మాత్రమే సవరణ అవకాశం). నేడు ${todayDayLabel} కనుక వసూలు లాక్ చేయబడింది — ఖాతాదారులను చూడవచ్చు లేదా కొత్త రుణం జోడించవచ్చు.`
                : `Collection for ${selectedVillage.name} opens on ${selectedVillage.day}s (with 2 days after to modify late PhonePe payments). Today is ${todayEn}, so collection is locked — you can still view borrowers or add a new loan.`}
            </div>
          </div>
        ) : null}

        {/* Action Buttons */}
        <div className={`grid grid-cols-1 ${villageRemindersEnabled ? "md:grid-cols-3" : "md:grid-cols-2"} gap-2.5`}>
          <button
            type="button"
            disabled={!access.allowed}
            onClick={() => {
              if (!access.allowed) return;
              setScreen("sheet");
            }}
            className={`min-h-[48px] w-full py-3.5 px-4 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition-all ${
              access.allowed
                ? "bg-[#1E3A8A] hover:bg-blue-900 text-white shadow-md cursor-pointer"
                : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-700 cursor-not-allowed"
            }`}
          >
            {access.allowed ? (
              <>
                <Wallet className="w-5 h-5 text-amber-300" />
                <span>
                  {access.isGraceModifyWindow
                    ? isDone
                      ? lang === "te"
                        ? `${villageDayLabel} వసూలు మార్చండి`
                        : `Modify ${selectedVillage.day} Sheet`
                      : lang === "te"
                      ? `${villageDayLabel} వసూలు నమోదు`
                      : `Update ${selectedVillage.day} Line`
                    : isDone
                    ? t.viewEditCollection
                    : t.startCollection}
                </span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4" />
                <span>
                  {lang === "te"
                    ? `${villageDayLabel} రోజున మాత్రమే వసూలు`
                    : `Collection Opens ${selectedVillage.day}`}
                </span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAddBorrowerModal(true)}
            className="min-h-[48px] w-full py-3 px-4 rounded-2xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>{t.addNewBorrower}</span>
          </button>

          {villageRemindersEnabled && (
            <button
              type="button"
              onClick={() => setShowReminderCenter(true)}
              className="min-h-[48px] w-full py-3 px-4 rounded-2xl bg-white dark:bg-[#131B2E] hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs"
            >
              <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>
                {lang === "te"
                  ? "🔔 2 రోజుల ముందస్తు రిమైండర్లు"
                  : "🔔 Send 2-Day Advance Reminders"}
              </span>
            </button>
          )}
        </div>

        {/* Borrowers List */}
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
            {t.borrowers} ({currentBorrowers.length})
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {lang === "te" ? "రోల్ నెం వరుస క్రమం" : "Sorted by Roll #"}
          </span>
        </div>

        {currentBorrowers.length === 0 ? (
          <div className="rounded-2xl p-8 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-500 dark:text-slate-400">
            {lang === "te"
              ? "ఈ గ్రామంలో ఖాతాదారులు లేరు. పైన కొత్త ఖాతాదారుని చేర్చండి."
              : "No borrowers in this village. Add one above."}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentBorrowers.map((b) => {
              const rem = calculateRemainingBalance(b);
              const isCompleted = isBorrowerClosed(b);
              const freqPrefix = getFrequencyShortPrefix(b.repaymentFreq);
              const freqLabel = getFrequencyLabel(b.repaymentFreq, lang);
              const telHref = getTelHref(b.phone);
              const guarantorTelHref = getTelHref(b.guarantorPhone);
              const showBorrowerReminder =
                waRules.masterEnabled &&
                waRules.autoTwoDayReminder &&
                !waRules.villageConfigs?.[selectedVillage.id]?.disableReminder &&
                b.hasWhatsApp !== false &&
                !b.disableReminder &&
                !waRules.borrowerConfigs?.[b.id]?.disableReminder;
              const showBorrowerReceipt =
                waRules.masterEnabled && !isBorrowerReceiptDisabled(b, selectedVillage.id, waRules);

              return (
                <div key={b.id} className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {b.photo ? (
                        <img
                          src={b.photo}
                          alt={b.name}
                          className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-extrabold text-xs text-blue-800 dark:text-blue-300 tabular-nums shrink-0">
                          {b.seqNo ? `#${b.seqNo}` : "—"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">
                            {b.photo && b.seqNo ? `#${b.seqNo} ` : ""}
                            {b.name}
                          </h4>
                          {(b.loanCycle || 1) > 1 && (
                            <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 text-[9px] font-black">
                              Cycle #{b.loanCycle}
                            </span>
                          )}
                          {waRules.masterEnabled && b.hasWhatsApp === false && (
                            <span className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[9px] font-black">
                              {lang === "te" ? "📵 కీప్యాడ్" : "📵 Keypad"}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {b.careOf ? `${b.careOf} · ` : ""}
                          {b.phone || (lang === "te" ? "ఫోన్ లేదు" : "No phone")}
                          {b.startDate ? ` · 📅 ${formatDateIN(b.startDate, lang)}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {b.settledAt ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                          ✓ {t.settledEarlyBadge}
                        </span>
                      ) : isCompleted ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                          {lang === "te" ? "✓ పూర్తయింది" : "✓ Completed"}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-[10px] font-bold tabular-nums">
                          {freqPrefix} {b.weeksPaid}/{b.durationWeeks || 12}
                        </span>
                      )}

                      {telHref && (
                        <a
                          href={telHref}
                          className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                          title={`${t.callNow} ${b.name}`}
                          aria-label={`${t.callNow} ${b.name}`}
                        >
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setEditBorrowerModal(b);
                          setEditForm({
                            name: b.name,
                            phone: b.phone || "",
                            seqNo: b.seqNo || "",
                            careOf: b.careOf || "",
                            guarantorName: b.guarantorName || "",
                            guarantorPhone: b.guarantorPhone || "",
                            startDate: b.startDate || todayStr,
                            hasWhatsApp: b.hasWhatsApp !== false,
                            disableReceipt: !!b.disableReceipt,
                            disableReminder: !!b.disableReminder,
                            photo: b.photo || "",
                            gender: b.gender || "",
                            age: b.age || "",
                            occupation: b.occupation || "",
                            address: b.address || "",
                          });
                        }}
                        className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
                        title={lang === "te" ? `${b.name} వివరాలు మార్చండి` : `Edit ${b.name}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteConfirmBorrower(b)}
                        className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 flex items-center justify-center text-red-600 dark:text-red-400 cursor-pointer hover:bg-red-100 dark:hover:bg-red-950/60"
                        title={lang === "te" ? `${b.name} ను తొలగించు` : `Delete ${b.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Guarantor Info Pill */}
                  {(b.guarantorName || b.guarantorPhone) && (
                    <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-[11px]">
                      <span className="flex items-center gap-1.5 text-amber-900 dark:text-amber-300 font-bold truncate">
                        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">
                          {t.guarantor}: {b.guarantorName || "—"}
                        </span>
                      </span>
                      {guarantorTelHref && (
                        <a
                          href={guarantorTelHref}
                          className="px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 font-bold flex items-center gap-1 shrink-0"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{b.guarantorPhone}</span>
                        </a>
                      )}
                    </div>
                  )}

                  {/* Financial Mini Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-center text-xs tabular-nums">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                        {lang === "te" ? "అప్పు" : "Loan"}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(b.loanAmt)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold truncate">
                        {freqLabel}
                      </span>
                      <span className="font-bold text-amber-700 dark:text-amber-400">
                        {formatCurrency(b.weeklyDue)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-semibold">
                        {lang === "te" ? "మిగిలిన బాకీ" : "Remaining"}
                      </span>
                      <span
                        className={`font-bold ${
                          rem > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
                        }`}
                      >
                        {formatCurrency(rem)}
                      </span>
                    </div>
                  </div>

                  {/* WhatsApp Quick Actions (hidden cleanly when disabled) */}
                  {(showBorrowerReminder || showBorrowerReceipt) && (
                    <div className="pt-1 flex items-center justify-between text-xs gap-2">
                      {showBorrowerReminder ? (
                        <button
                          type="button"
                          onClick={() => handleSendAdvanceReminder(b)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold flex items-center gap-1 text-[11px] cursor-pointer"
                        >
                          <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{t.advanceReminder}</span>
                        </button>
                      ) : <span />}

                      {showBorrowerReceipt && (
                        <button
                          type="button"
                          onClick={() => handleSendReceipt(b)}
                          className="min-h-[38px] px-2.5 py-1.5 rounded-lg text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-bold flex items-center gap-1 text-[11px] cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>{t.whatsappReceipt}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmBorrower && (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 max-w-xs w-full text-center shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-black text-slate-900 dark:text-slate-100 text-base mb-1">
                {lang === "te" ? "ఖాతాదారుని తొలగించాలా?" : "Delete Borrower?"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                {lang === "te" ? (
                  <>
                    మీరు <span className="font-bold text-slate-900 dark:text-slate-100">{deleteConfirmBorrower.name}</span> ను తొలగించాలనుకుంటున్నారా? వారి చెల్లింపు చరిత్ర మొత్తం పోతుంది.
                  </>
                ) : (
                  <>
                    Are you sure you want to delete{" "}
                    <span className="font-bold text-slate-900 dark:text-slate-100">
                      {deleteConfirmBorrower.name}
                    </span>
                    ? This will remove all their payment history.
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmBorrower(null)}
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                >
                  {lang === "te" ? "రద్దు" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteBorrower(deleteConfirmBorrower.id)}
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer"
                >
                  {lang === "te" ? "అవును, తొలగించు" : "Yes, Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Borrower Modal */}
        {editBorrowerModal && (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-700 dark:text-blue-400" />
                <span>{lang === "te" ? "ఖాతాదారు వివరాలు సవరించు" : "Edit Borrower"}</span>
              </h3>
              <form onSubmit={handleSaveEditBorrower} className="space-y-3">
                {/* Photo Uploader */}
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  {editForm.photo ? (
                    <img
                      src={editForm.photo}
                      alt={editForm.name || "Borrower"}
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E3A8A] text-white text-[11px] font-bold cursor-pointer">
                      <Camera className="w-3.5 h-3.5" />
                      <span>{lang === "te" ? "ఫోటో మార్చండి" : "Upload Photo"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const dataUrl = await compressBorrowerPhoto(file);
                            setEditForm((f) => ({ ...f, photo: dataUrl }));
                          } catch {
                            showToast(lang === "te" ? "ఫోటో లోడ్ కాలేదు" : "Failed to load photo", "error");
                          }
                        }}
                      />
                    </label>
                    {editForm.photo && (
                      <button
                        type="button"
                        onClick={() => setEditForm((f) => ({ ...f, photo: "" }))}
                        className="ml-2 text-[11px] font-bold text-red-600 dark:text-red-400 cursor-pointer"
                      >
                        {lang === "te" ? "తొలగించు" : "Remove"}
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {lang === "te" ? "రోల్ నెం" : "Roll #"}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === "te" ? "ఉదా. 1" : "e.g. 1"}
                      value={editForm.seqNo}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, seqNo: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {lang === "te" ? "పూర్తి పేరు *" : "Full Name *"}
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {lang === "te" ? "ఫోన్ నంబర్" : "Phone (WhatsApp / Call)"}
                    </label>
                    <input
                      type="tel"
                      placeholder={lang === "te" ? "10 అంకెలు" : "10-digit number"}
                      value={editForm.phone}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {t.loanStartDate}
                    </label>
                    <input
                      type="date"
                      value={editForm.startDate}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, startDate: e.target.value }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none font-bold focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {t.gender}
                    </label>
                    <select
                      value={editForm.gender}
                      onChange={(e) =>
                        setEditForm((f) => ({
                          ...f,
                          gender: e.target.value as "" | "male" | "female" | "other",
                        }))
                      }
                      className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none font-bold"
                    >
                      <option value="">{lang === "te" ? "ఎంచుకోండి" : "Select"}</option>
                      <option value="male">{lang === "te" ? "పురుషుడు" : "Male"}</option>
                      <option value="female">{lang === "te" ? "స్త్రీ" : "Female"}</option>
                      <option value="other">{lang === "te" ? "ఇతరులు" : "Other"}</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {t.age}
                    </label>
                    <input
                      type="number"
                      min="18"
                      max="100"
                      placeholder="35"
                      value={editForm.age}
                      onChange={(e) => setEditForm((f) => ({ ...f, age: e.target.value }))}
                      className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {t.occupation}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === "te" ? "కూలి / షాపు" : "Shop / Work"}
                      value={editForm.occupation}
                      onChange={(e) => setEditForm((f) => ({ ...f, occupation: e.target.value }))}
                      className="w-full px-2.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    {t.address}
                  </label>
                  <input
                    type="text"
                    placeholder={lang === "te" ? "వీధి / ఇంటి నెంబర్" : "Street / House No."}
                    value={editForm.address}
                    onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    {t.careOf}
                  </label>
                  <input
                    type="text"
                    placeholder={lang === "te" ? "ఉదా. S/o రమణ / కిరాణా షాపు" : "e.g. S/o Ramana / Kirana Shop"}
                    value={editForm.careOf}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, careOf: e.target.value }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {t.guarantor}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === "te" ? "హామీదారు పేరు" : "Guarantor name"}
                      value={editForm.guarantorName}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, guarantorName: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {lang === "te" ? "హామీదారు ఫోన్" : "Guarantor Phone"}
                    </label>
                    <input
                      type="tel"
                      placeholder={lang === "te" ? "10 అంకెలు" : "10-digit"}
                      value={editForm.guarantorPhone}
                      onChange={(e) =>
                        setEditForm((f) => ({ ...f, guarantorPhone: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Phone Type (Smartphone WhatsApp vs Keypad Mobile) */}
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-2 rounded-xl space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block px-1">
                    {lang === "te" ? "ఫోన్ రకం" : "Phone Type"}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, hasWhatsApp: true }))}
                      className={`min-h-[40px] py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        editForm.hasWhatsApp
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      {lang === "te" ? "📱 స్మార్ట్‌ఫోన్ (WhatsApp)" : "📱 Smartphone (WhatsApp)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, hasWhatsApp: false }))}
                      className={`min-h-[40px] py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        !editForm.hasWhatsApp
                          ? "bg-slate-800 dark:bg-slate-700 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      {lang === "te" ? "📵 కీప్యాడ్ ఫోన్" : "📵 Keypad Phone"}
                    </button>
                  </div>
                </div>

                {/* WhatsApp Auto Delivery Settings */}
                {editForm.hasWhatsApp && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, disableReceipt: !f.disableReceipt }))}
                      className={`min-h-[40px] p-2 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                        !editForm.disableReceipt
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                          : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                      }`}
                    >
                      <span>
                        {!editForm.disableReceipt
                          ? (lang === "te" ? "🧾 రశీదు: ఆన్ ✓" : "🧾 Receipt: ON ✓")
                          : (lang === "te" ? "🔕 రశీదు: ఆఫ్ 🔕" : "🔕 Receipt: OFF 🔕")}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, disableReminder: !f.disableReminder }))}
                      className={`min-h-[40px] p-2 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                        !editForm.disableReminder
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                          : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                      }`}
                    >
                      <span>
                        {!editForm.disableReminder
                          ? (lang === "te" ? "⏰ రిమైండర్: ఆన్ ✓" : "⏰ Reminder: ON ✓")
                          : (lang === "te" ? "🔕 రిమైండర్: ఆఫ్ 🔕" : "🔕 Reminder: OFF 🔕")}
                      </span>
                    </button>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditBorrowerModal(null)}
                    className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    {lang === "te" ? "రద్దు" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-[#1E3A8A] text-white font-bold text-xs shadow-md cursor-pointer"
                  >
                    {lang === "te" ? "మార్పులు సేవ్ చేయండి" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Borrower Modal */}
        {addBorrowerModal && (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <span>{t.addNewBorrower}</span>
              </h3>

              {/* Ongoing vs New Loan Toggle */}
              <div className="flex bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 rounded-xl mb-3">
                <button
                  type="button"
                  onClick={() =>
                    setNewBorrowerForm((f) => ({ ...f, isOngoing: false }))
                  }
                  className={`flex-1 min-h-[40px] py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    !newBorrowerForm.isOngoing
                      ? "bg-[#1E3A8A] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {lang === "te" ? "🆕 కొత్త రుణం" : "🆕 New Loan"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setNewBorrowerForm((f) => ({ ...f, isOngoing: true }))
                  }
                  className={`flex-1 min-h-[40px] py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    newBorrowerForm.isOngoing
                      ? "bg-[#1E3A8A] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {lang === "te" ? "⚡ పాత రుణం (నడుస్తున్నది)" : "⚡ Ongoing (Existing)"}
                </button>
              </div>

              <form onSubmit={handleAddBorrower} className="space-y-3">
                {/* Borrower Photo Picker */}
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                  {newBorrowerForm.photo ? (
                    <img
                      src={newBorrowerForm.photo}
                      alt="Borrower preview"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                      {lang === "te" ? "ఖాతాదారు ఫోటో (ఐచ్ఛికం)" : "Borrower Photo (Optional)"}
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1E3A8A] text-white text-[11px] font-bold cursor-pointer">
                        <Camera className="w-3 h-3" />
                        <span>{lang === "te" ? "ఫోటో ఎంచుకోండి" : "Choose Photo"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            try {
                              const dataUrl = await compressBorrowerPhoto(file);
                              setNewBorrowerForm((f) => ({ ...f, photo: dataUrl }));
                            } catch {
                              showToast(lang === "te" ? "ఫోటో లోడ్ కాలేదు" : "Failed to load photo", "error");
                            }
                          }}
                        />
                      </label>
                      {newBorrowerForm.photo && (
                        <button
                          type="button"
                          onClick={() => setNewBorrowerForm((f) => ({ ...f, photo: "" }))}
                          className="text-[11px] font-bold text-red-600 dark:text-red-400 cursor-pointer"
                        >
                          {lang === "te" ? "తొలగించు" : "Remove"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {lang === "te" ? "రోల్ నెం" : "Roll #"}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === "te" ? "ఉదా. 5" : "e.g. 5"}
                      value={newBorrowerForm.seqNo}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({ ...f, seqNo: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {lang === "te" ? "పూర్తి పేరు *" : "Full Name *"}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={lang === "te" ? "పేరు నమోదు చేయండి" : "Enter borrower full name"}
                      value={newBorrowerForm.name}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {lang === "te" ? "ఫోన్ నంబర్" : "Phone (WhatsApp / Call)"}
                    </label>
                    <input
                      type="tel"
                      placeholder={lang === "te" ? "10 అంకెలు" : "10-digit number"}
                      value={newBorrowerForm.phone}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {t.loanStartDate}
                    </label>
                    <input
                      type="date"
                      value={newBorrowerForm.startDate}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({ ...f, startDate: e.target.value }))
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none font-bold focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* KYC Details: Gender, Age, Work, Address */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {t.gender}
                    </label>
                    <select
                      value={newBorrowerForm.gender}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({
                          ...f,
                          gender: e.target.value as "" | "male" | "female" | "other",
                        }))
                      }
                      className="w-full px-2 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none font-bold"
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
                      min="18"
                      max="100"
                      placeholder="35"
                      value={newBorrowerForm.age}
                      onChange={(e) => setNewBorrowerForm((f) => ({ ...f, age: e.target.value }))}
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {t.occupation}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === "te" ? "షాపు / పని" : "Shop / Work"}
                      value={newBorrowerForm.occupation}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({ ...f, occupation: e.target.value }))
                      }
                      className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    {t.address}
                  </label>
                  <input
                    type="text"
                    placeholder={lang === "te" ? "వీధి / ఇంటి నెంబర్" : "Street / House No."}
                    value={newBorrowerForm.address}
                    onChange={(e) => setNewBorrowerForm((f) => ({ ...f, address: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none font-bold"
                  />
                </div>

                {/* Care Of & Guarantor Details */}
                <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 p-2.5 rounded-xl space-y-2">
                  <div>
                    <label className="text-[11px] font-bold text-amber-900 dark:text-amber-300 block mb-1">
                      {t.careOf}
                    </label>
                    <input
                      type="text"
                      placeholder={lang === "te" ? "ఉదా. S/o వెంకట్ / కిరాణా షాపు" : "e.g. S/o Venkat / Kirana Shop"}
                      value={newBorrowerForm.careOf}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({ ...f, careOf: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none font-bold focus:border-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] font-bold text-amber-900 dark:text-amber-300 block mb-1">
                        {t.guarantor}
                      </label>
                      <input
                        type="text"
                        placeholder={lang === "te" ? "పేరు" : "Name"}
                        value={newBorrowerForm.guarantorName}
                        onChange={(e) =>
                          setNewBorrowerForm((f) => ({ ...f, guarantorName: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none font-bold focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-amber-900 dark:text-amber-300 block mb-1">
                        {lang === "te" ? "హామీ ఫోన్" : "Guarantor Phone"}
                      </label>
                      <input
                        type="tel"
                        placeholder={lang === "te" ? "10 అంకెలు" : "10-digit"}
                        value={newBorrowerForm.guarantorPhone}
                        onChange={(e) =>
                          setNewBorrowerForm((f) => ({ ...f, guarantorPhone: e.target.value }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none font-bold focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Phone Type (Smartphone WhatsApp vs Keypad Mobile) */}
                <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-2 rounded-xl space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block px-1">
                    {lang === "te" ? "ఫోన్ రకం" : "Phone Type"}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNewBorrowerForm((f) => ({ ...f, hasWhatsApp: true }))}
                      className={`min-h-[40px] py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        newBorrowerForm.hasWhatsApp
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      {lang === "te" ? "📱 స్మార్ట్‌ఫోన్ (WhatsApp)" : "📱 Smartphone (WhatsApp)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBorrowerForm((f) => ({ ...f, hasWhatsApp: false }))}
                      className={`min-h-[40px] py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        !newBorrowerForm.hasWhatsApp
                          ? "bg-slate-800 dark:bg-slate-700 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800"
                      }`}
                    >
                      {lang === "te" ? "📵 కీప్యాడ్ ఫోన్" : "📵 Keypad Phone"}
                    </button>
                  </div>
                </div>

                {/* WhatsApp Auto Delivery Settings */}
                {newBorrowerForm.hasWhatsApp && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setNewBorrowerForm((f) => ({ ...f, disableReceipt: !f.disableReceipt }))}
                      className={`min-h-[40px] p-2 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                        !newBorrowerForm.disableReceipt
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                          : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                      }`}
                    >
                      <span>
                        {!newBorrowerForm.disableReceipt
                          ? (lang === "te" ? "🧾 రశీదు: ఆన్ ✓" : "🧾 Receipt: ON ✓")
                          : (lang === "te" ? "🔕 రశీదు: ఆఫ్ 🔕" : "🔕 Receipt: OFF 🔕")}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBorrowerForm((f) => ({ ...f, disableReminder: !f.disableReminder }))}
                      className={`min-h-[40px] p-2 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                        !newBorrowerForm.disableReminder
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                          : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                      }`}
                    >
                      <span>
                        {!newBorrowerForm.disableReminder
                          ? (lang === "te" ? "⏰ రిమైండర్: ఆన్ ✓" : "⏰ Reminder: ON ✓")
                          : (lang === "te" ? "🔕 రిమైండర్: ఆఫ్ 🔕" : "🔕 Reminder: OFF 🔕")}
                      </span>
                    </button>
                  </div>
                )}

                {/* Repayment Schedule Selector (Weekly / Daily / Monthly) */}
                <div>
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    {lang === "te" ? "వసూలు విధానం" : "Repayment Schedule"}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    {(["weekly", "daily", "monthly"] as RepaymentFrequency[]).map((fq) => (
                      <button
                        key={fq}
                        type="button"
                        onClick={() =>
                          setNewBorrowerForm((f) => ({
                            ...f,
                            repaymentFreq: fq,
                            durationWeeks: fq === "daily" ? "60" : fq === "monthly" ? "10" : "12",
                          }))
                        }
                        className={`min-h-[38px] py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
                          newBorrowerForm.repaymentFreq === fq
                            ? "bg-[#1E3A8A] text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                      >
                        {fq === "weekly"
                          ? lang === "te"
                            ? "వారం"
                            : "Weekly"
                          : fq === "daily"
                          ? lang === "te"
                            ? "రోజు"
                            : "Daily"
                          : lang === "te"
                          ? "నెల"
                          : "Monthly"}
                      </button>
                    ))}
                  </div>
                </div>

                {loanEntryMode === "principal_interest" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        {lang === "te" ? "అసలు మొత్తం (₹) *" : "Loan Amount (₹) *"}
                      </label>
                      <input
                        type="number"
                        required
                        value={newBorrowerForm.loanAmt}
                        onChange={(e) =>
                          setNewBorrowerForm((f) => ({
                            ...f,
                            loanAmt: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        {lang === "te" ? "వడ్డీ % *" : "Interest % *"}
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        required
                        value={newBorrowerForm.interestPct}
                        onChange={(e) =>
                          setNewBorrowerForm((f) => ({
                            ...f,
                            interestPct: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500 tabular-nums"
                      />
                    </div>
                  </div>
                ) : loanEntryMode === "total_only" ? (
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {lang === "te" ? "చెల్లించాల్సిన మొత్తం (₹) *" : "Total Amount to Pay (₹) *"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={newBorrowerForm.totalPayable}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({
                          ...f,
                          totalPayable: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500 tabular-nums"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        {lang === "te" ? "అసలు మొత్తం (₹) *" : "Loan Amount (₹) *"}
                      </label>
                      <input
                        type="number"
                        required
                        value={newBorrowerForm.loanAmt}
                        onChange={(e) =>
                          setNewBorrowerForm((f) => ({
                            ...f,
                            loanAmt: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500 tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                        {lang === "te" ? "చెల్లించాల్సిన మొత్తం (₹) *" : "Total Amount to Pay (₹) *"}
                      </label>
                      <input
                        type="number"
                        min="0"
                        required
                        value={newBorrowerForm.totalPayable}
                        onChange={(e) =>
                          setNewBorrowerForm((f) => ({
                            ...f,
                            totalPayable: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500 tabular-nums"
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {newBorrowerForm.repaymentFreq === "daily"
                        ? lang === "te"
                          ? "రోజులు (Days)"
                          : "Installments (Days)"
                        : newBorrowerForm.repaymentFreq === "monthly"
                        ? lang === "te"
                          ? "నెలలు (Months)"
                          : "Installments (Months)"
                        : lang === "te"
                        ? "వారాలు (Weeks)"
                        : "Installments (Weeks)"}
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={newBorrowerForm.durationWeeks}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({
                          ...f,
                          durationWeeks: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500 tabular-nums"
                    />
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(newBorrowerForm.repaymentFreq === "daily"
                        ? [30, 50, 60, 100]
                        : newBorrowerForm.repaymentFreq === "monthly"
                        ? [3, 6, 10, 12]
                        : [8, 10, 12, 16]
                      ).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() =>
                            setNewBorrowerForm((f) => ({ ...f, durationWeeks: String(p) }))
                          }
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer ${
                            newBorrowerForm.durationWeeks === String(p)
                              ? "bg-[#1E3A8A] text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                      {newBorrowerForm.repaymentFreq === "daily"
                        ? lang === "te"
                          ? "రోజు వాయిదా మార్పు"
                          : "Daily Due Override"
                        : newBorrowerForm.repaymentFreq === "monthly"
                        ? lang === "te"
                          ? "నెల వాయిదా మార్పు"
                          : "Monthly Due Override"
                        : lang === "te"
                        ? "వారం వాయిదా మార్పు"
                        : "Weekly Override"}
                    </label>
                    <input
                      type="number"
                      placeholder={`${lang === "te" ? "ఆటో:" : "Auto:"} ${formatCurrency(
                        resolveLoanTermsByMode({
                          mode: loanEntryMode,
                          loanAmtInput: parseInt(newBorrowerForm.loanAmt, 10) || 0,
                          interestPctInput: parseFloat(newBorrowerForm.interestPct) || 0,
                          totalPayableInput: parseInt(newBorrowerForm.totalPayable, 10) || 0,
                          periods: Math.max(1, parseInt(newBorrowerForm.durationWeeks, 10) || 12),
                        }).weeklyDue
                      )}`}
                      value={newBorrowerForm.weeklyOverride}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({
                          ...f,
                          weeklyOverride: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500 tabular-nums"
                    />
                  </div>
                </div>

                {/* Live EMI Preview Bar */}
                {(() => {
                  const previewPeriods = Math.max(1, parseInt(newBorrowerForm.durationWeeks, 10) || 12);
                  const previewResolved = resolveLoanTermsByMode({
                    mode: loanEntryMode,
                    loanAmtInput: parseInt(newBorrowerForm.loanAmt, 10) || 0,
                    interestPctInput: parseFloat(newBorrowerForm.interestPct) || 0,
                    totalPayableInput: parseInt(newBorrowerForm.totalPayable, 10) || 0,
                    periods: previewPeriods,
                    weeklyOverride: parseInt(newBorrowerForm.weeklyOverride, 10) || 0,
                  });
                  const previewDue = previewResolved.weeklyDue;
                  const previewTotal = previewResolved.totalReturn;
                  return (
                    <div className="px-3 py-2 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 flex items-center justify-between text-xs tabular-nums">
                      <span className="font-semibold text-blue-900 dark:text-blue-200">
                        {getFrequencyLabel(newBorrowerForm.repaymentFreq, lang)} {lang === "te" ? "వాయిదా:" : "Due:"}
                      </span>
                      <span className="font-black text-blue-900 dark:text-blue-200">
                        {previewDue * previewPeriods === previewTotal
                          ? `${formatCurrency(previewDue)} × ${previewPeriods} = ${formatCurrency(previewTotal)}`
                          : `${formatCurrency(previewDue)} × ${previewPeriods} · ${lang === "te" ? "మొత్తం:" : "Total:"} ${formatCurrency(previewTotal)}`}
                      </span>
                    </div>
                  );
                })()}

                {newBorrowerForm.isOngoing && (
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 rounded-xl">
                    <label className="text-xs font-bold text-amber-900 dark:text-amber-300 block mb-1">
                      {lang === "te" ? "ఇప్పటికే చెల్లించిన వాయిదాలు" : "Installments Already Paid"}
                    </label>
                    <input
                      type="number"
                      placeholder={lang === "te" ? "ఉదా. 4" : "e.g. 4"}
                      value={newBorrowerForm.weeksPaid}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({
                          ...f,
                          weeksPaid: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold tabular-nums"
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddBorrowerModal(false)}
                    className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer"
                  >
                    {lang === "te" ? "రద్దు" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-[#1E3A8A] text-white font-bold text-xs cursor-pointer shadow-md"
                  >
                    {lang === "te" ? "ఖాతాదారుని చేర్చు" : "Add Borrower"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showReminderCenter && (
          <WhatsAppReminderCenter
            data={data}
            profile={profile}
            lang={lang}
            onClose={() => setShowReminderCenter(false)}
            showToast={showToast}
          />
        )}
      </div>
    );
  }

  // SCREEN 3: Active Collection Sheet
  if (screen === "sheet" && selectedVillage) {
    const access = getCollectionAccess(selectedVillage);
    const villageDayLabel = translateDayName(selectedVillage.day, lang);

    if (!access.allowed) {
      return (
        <div className="pb-28 px-4 sm:px-5 pt-4 space-y-4">
          <div className="rounded-3xl p-6 bg-white dark:bg-[#131B2E] border border-amber-300 dark:border-amber-800 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
              {lang === "te"
                ? `${selectedVillage.name} — ${villageDayLabel} రోజున మాత్రమే వసూలు`
                : `${selectedVillage.name} — ${selectedVillage.day} Collection Only`}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {lang === "te"
                ? `నేడు ${getDayName(todayStr, "te")} కనుక వసూలు మార్కింగ్ (మరియు 2 రోజుల సవరణ గడువు) అందుబాటులో లేదు.`
                : `Today is ${todayEn}. Collection marking (including the 2-day modify grace window) is locked outside ${selectedVillage.day}s.`}
            </p>
            <button
              type="button"
              onClick={() => setScreen("detail")}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1E3A8A] text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{lang === "te" ? "గ్రామానికి తిరిగి వెళ్ళండి" : "Back to Village"}</span>
            </button>
          </div>
        </div>
      );
    }

    const excludedCompletedCount = Math.max(
      0,
      currentBorrowers.length - activeOrMarkedBorrowers.length
    );

    return (
      <div className="pb-48 px-4 sm:px-5 pt-2 space-y-3">
        {/* Header with prominent Back button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setScreen("detail")}
            className="w-11 h-11 rounded-full bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 shadow-xs cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
            title="Back to Village"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 truncate">
                {selectedVillage.name}
              </h2>
              {access.isGraceModifyWindow && (
                <span className="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/70 text-blue-800 dark:text-blue-300 text-[10px] font-bold tabular-nums">
                  {formatDateIN(activeCollectionDate, lang)} ({access.graceDaysRemaining}d)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium tabular-nums truncate">
              {paidCount + shortCount + extraCount}/{activeOrMarkedBorrowers.length}{" "}
              {lang === "te" ? "వసూలైంది" : "collected"}
              {excludedCompletedCount > 0 &&
                (lang === "te"
                  ? ` · ${excludedCompletedCount} పూర్తయిన ఖాతాలు దాచబడ్డాయి`
                  : ` · ${excludedCompletedCount} completed hidden`)}
            </p>
          </div>
        </div>

        {/* Sticky Status Bar */}
        <div className="sticky top-14 bg-white/95 dark:bg-[#131B2E]/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 p-3.5 rounded-2xl z-30 shadow-md">
          <div className="flex items-center justify-between text-xs mb-1.5 font-bold tabular-nums">
            <div className="flex items-center gap-2">
              <span className="text-emerald-700 dark:text-emerald-400">✅ {paidCount}</span>
              <span className="text-amber-700 dark:text-amber-400">⚡ {shortCount}</span>
              <span className="text-red-700 dark:text-red-400">❌ {skipCount}</span>
              <span className="text-blue-700 dark:text-blue-400">➕ {extraCount}</span>
              <span className="text-slate-500 dark:text-slate-400">⏳ {pendingCount}</span>
            </div>
            <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm">
              {formatCurrency(totalCollected)}
            </span>
          </div>

          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-emerald-600 h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.min(
                  (totalCollected / Math.max(totalExpected, 1)) * 100,
                  100
                )}%`,
              }}
            />
          </div>

          <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium tabular-nums">
            <span>
              {lang === "te" ? "లక్ష్యం:" : "Expected:"} {formatCurrency(totalExpected)}
            </span>
            <span>
              {lang === "te" ? "తరుగు:" : "Shortfall:"}{" "}
              {formatCurrency(Math.max(0, totalExpected - totalCollected))}
            </span>
          </div>

          {/* WhatsApp & Keypad Indicators Summary Strip (hidden if WhatsApp disabled) */}
          {waRules.masterEnabled && (() => {
            const keypadCount = activeOrMarkedBorrowers.filter((b) => isBorrowerKeypad(b, waRules)).length;
            const receiptsSentCount = activeOrMarkedBorrowers.filter(
              (b) => entries[b.id]?.receiptSent || isReceiptSent(b.id, activeCollectionDate)
            ).length;

            return (
              <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-slate-200 dark:border-slate-800 text-[10px] font-bold">
                <div className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span className="tabular-nums">
                    {receiptsSentCount} {lang === "te" ? "వాట్సాప్ రశీదులు పంపబడ్డాయి" : "WhatsApp receipts sent"}
                  </span>
                </div>
                {keypadCount > 0 && (
                  <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                    <PhoneOff className="w-3 h-3 text-slate-400" />
                    <span className="tabular-nums">
                      {keypadCount} {lang === "te" ? "కీప్యాడ్ ఫోన్లు" : "Keypad mobiles"}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Borrowers Collection Items */}
        {activeOrMarkedBorrowers.length === 0 ? (
          <div className="rounded-2xl p-8 bg-white dark:bg-[#131B2E] border border-emerald-300 dark:border-emerald-800 text-center space-y-2 shadow-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <p className="font-bold text-sm text-slate-900 dark:text-slate-100">
              {lang === "te"
                ? "ఈ గ్రామంలో అన్ని రుణాలు పూర్తయ్యాయి!"
                : "All loans in this village are completed!"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === "te"
                ? "వసూలు చేయవలసిన బాకీ ఖాతాలు ఏవీ లేవు."
                : "No pending installments left to collect."}
            </p>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {activeOrMarkedBorrowers.map((b) => {
            const entry = entries[b.id];
            const status = entry?.status;
            const isKeypad = isBorrowerKeypad(b, waRules);
            const isReceiptDisabled = isBorrowerReceiptDisabled(b, selectedVillage?.id, waRules);
            const sentReceipt = entry?.receiptSent || isReceiptSent(b.id, activeCollectionDate);
            const freqPrefix = getFrequencyShortPrefix(b.repaymentFreq);
            const closedAlready = isBorrowerClosed(b);
            const telHref = getTelHref(b.phone);
            const savedTodayAmt = (b.history || [])
              .filter((h) => h.date === activeCollectionDate)
              .reduce((sum, h) => sum + (h.amtPaid || 0), 0);
            const remWithoutToday = calculateRemainingBalance(b) + savedTodayAmt;
            const remAfterDraft = entry
              ? Math.max(0, remWithoutToday - (Number(entry.amtPaid) || 0))
              : calculateRemainingBalance(b);
            const completedWithDraft = Boolean(entry) && remAfterDraft <= 0;

            let cardStyle = "bg-white dark:bg-[#131B2E] border-slate-200 dark:border-slate-800";
            if (status === "paid") cardStyle = "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-400/80 dark:border-emerald-700";
            if (status === "skip") cardStyle = "bg-red-50/40 dark:bg-red-950/20 border-red-400/80 dark:border-red-700";
            if (status === "short") cardStyle = "bg-amber-50/40 dark:bg-amber-950/20 border-amber-400/80 dark:border-amber-700";
            if (status === "extra") cardStyle = "bg-blue-50/40 dark:bg-blue-950/20 border-blue-400/80 dark:border-blue-700";

            return (
              <div
                key={b.id}
                className={`rounded-2xl p-4 border shadow-xs transition-all ${cardStyle}`}
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-extrabold text-[11px] text-blue-800 dark:text-blue-300 flex items-center justify-center tabular-nums shrink-0">
                      {b.seqNo ? `#${b.seqNo}` : "—"}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-extrabold text-slate-900 dark:text-slate-100 text-sm leading-tight truncate">
                          {b.name}
                        </h4>

                        {telHref && (
                          <a
                            href={telHref}
                            className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 inline-flex items-center justify-center text-emerald-700 dark:text-emerald-300 shrink-0"
                            title={`${t.callNow} ${b.name}`}
                            aria-label={`${t.callNow} ${b.name}`}
                          >
                            <Phone className="w-3 h-3" />
                          </a>
                        )}

                        {(closedAlready || completedWithDraft) && (
                          <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[9px] font-black">
                            ✓ {b.settledAt ? t.settledEarlyBadge : (lang === "te" ? "పూర్తయింది" : "Completed")}
                          </span>
                        )}

                        {/* WhatsApp / Keypad Status Badge (only when WhatsApp enabled) */}
                        {waRules.masterEnabled && (
                          isKeypad ? (
                            <span
                              className="px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[9px] font-black flex items-center gap-0.5"
                              title={lang === "te" ? "సాధారణ కీప్యాడ్ మొబైల్ (వాట్సాప్ లేదు)" : "Keypad phone without WhatsApp"}
                            >
                              <span>📵</span>
                              <span>{lang === "te" ? "కీప్యాడ్" : "Keypad"}</span>
                            </span>
                          ) : sentReceipt ? (
                            <span
                              className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-[9px] font-black flex items-center gap-0.5"
                              title={lang === "te" ? "వాట్సాప్ రశీదు పంపబడింది" : "WhatsApp receipt sent"}
                            >
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400 inline" />
                              <span>{lang === "te" ? "రశీదు పంపబడింది" : "Receipt Sent"}</span>
                            </span>
                          ) : isReceiptDisabled ? (
                            <span
                              className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-[9px] font-black flex items-center gap-0.5"
                              title={lang === "te" ? "వాట్సాప్ రశీదు ఆపివేయబడింది" : "WhatsApp receipt is turned off"}
                            >
                              <span>🔕</span>
                              <span>{lang === "te" ? "రశీదు ఆఫ్" : "Receipt Off"}</span>
                            </span>
                          ) : null
                        )}
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                        {freqPrefix} {Math.min((b.weeksPaid || 0) + 1, b.durationWeeks || 12)}/
                        {b.durationWeeks || 12} · {lang === "te" ? "వాయిదా:" : "Due:"} {formatCurrency(b.weeklyDue)}
                        {` · ${lang === "te" ? "బాకీ:" : "Bal:"} ${formatCurrency(remAfterDraft)}`}
                        {b.careOf ? ` · ${b.careOf}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0 tabular-nums">
                    {status === "paid" && (
                      <span className="text-emerald-700 dark:text-emerald-400 font-black text-xs">
                        ✅ {formatCurrency(entry.amtPaid)}
                      </span>
                    )}
                    {status === "skip" && (
                      <span className="text-red-600 dark:text-red-400 font-black text-xs">
                        {lang === "te" ? "❌ దాటవేశారు" : "❌ Skipped"}
                      </span>
                    )}
                    {status === "short" && (
                      <span className="text-amber-700 dark:text-amber-400 font-black text-xs">
                        ⚡ {formatCurrency(entry.amtPaid)} ({t.short})
                      </span>
                    )}
                    {status === "extra" && (
                      <span className="text-blue-700 dark:text-blue-400 font-black text-xs">
                        ➕ {formatCurrency(entry.amtPaid)}
                      </span>
                    )}
                  </div>
                </div>

                {/* 4 Action Buttons */}
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => handlePaidClick(b)}
                    className={`min-h-[44px] py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      status === "paid"
                        ? "bg-emerald-600 border-emerald-600 text-white shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                    }`}
                  >
                    ✅ {t.paid}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSkipClick(b)}
                    className={`min-h-[44px] py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      status === "skip"
                        ? "bg-red-600 border-red-600 text-white shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                    }`}
                  >
                    ❌ {t.skip}
                  </button>

                  <button
                    type="button"
                    onClick={() => openShortModal(b)}
                    className={`min-h-[44px] py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      status === "short"
                        ? "bg-amber-600 border-amber-600 text-white shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                    }`}
                  >
                    ⚡ {t.short}
                  </button>

                  <button
                    type="button"
                    onClick={() => openExtraModal(b)}
                    className={`min-h-[44px] py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      status === "extra"
                        ? "bg-[#1E3A8A] border-[#1E3A8A] text-white shadow-xs"
                        : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                    }`}
                  >
                    ➕ {t.extra}
                  </button>
                </div>

                {/* Instant WhatsApp Receipt Status & Resend Button */}
                {status && (
                  <div className="mt-2.5 pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
                      <span>
                        {lang === "te" ? "విధానం:" : "Mode:"}{" "}
                        <strong className="capitalize text-slate-800 dark:text-slate-200">{entry?.payMethod || "cash"}</strong>
                      </span>
                      {waRules.masterEnabled && sentReceipt && !isKeypad && !isReceiptDisabled && (
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold ml-1 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          <span>{lang === "te" ? "రశీదు అందింది" : "Sent"}</span>
                        </span>
                      )}
                    </span>
                    {waRules.masterEnabled && !isKeypad && !isReceiptDisabled && (
                      <button
                        type="button"
                        onClick={() => handleSendReceipt(b)}
                        className="min-h-[36px] px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                        title={lang === "te" ? "వాట్సాప్ రశీదు చూడండి" : "View or Resend WhatsApp Receipt"}
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{sentReceipt ? (lang === "te" ? "మళ్లీ రశీదు" : "Resend") : (lang === "te" ? "వాట్సాప్ రశీదు" : "Send WhatsApp Receipt")}</span>
                      </button>
                    )}
                    {waRules.masterEnabled && !isKeypad && isReceiptDisabled && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-[10px] font-bold flex items-center gap-1 border border-amber-200 dark:border-amber-800">
                        <span>🔕</span>
                        <span>{lang === "te" ? "రశీదు ఆఫ్ చేయబడింది" : "Receipt Muted"}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        )}

        {/* FIXED BOTTOM ACTION BAR — sits right above the bottom tab bar (bottom-20) */}
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[92%] max-w-md bg-white/95 dark:bg-[#131B2E]/95 backdrop-blur-md rounded-2xl p-3 z-30 shadow-2xl border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-2 px-1 text-xs font-bold tabular-nums">
            <span className="text-slate-700 dark:text-slate-300">
              {lang === "te" ? "మొత్తం:" : "Total:"}{" "}
              <span className="text-emerald-700 dark:text-emerald-400 font-black text-sm">
                {formatCurrency(totalCollected)}
              </span>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {paidCount + shortCount + extraCount}/{activeOrMarkedBorrowers.length}{" "}
              {lang === "te" ? "వసూలైంది" : "collected"}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleQuickSave}
              className="flex-1 min-h-[44px] py-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              💾 {t.saveAndUpdate}
            </button>
            <button
              type="button"
              onClick={() => setCashCloseModal(true)}
              className="flex-1 min-h-[44px] py-3 rounded-xl bg-[#1E3A8A] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:bg-blue-900"
            >
              💰 {t.recordCash}
            </button>
          </div>
        </div>

        {/* Payment Method Selector Modal */}
        {payModalBorrower && (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
            <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">
                💳 {lang === "te" ? "చెల్లింపు విధానం" : "Payment Method"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 tabular-nums">
                {payModalBorrower.name} · {formatCurrency(payModalBorrower.weeklyDue)}
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => confirmPaidMethod("cash")}
                  className="w-full min-h-[48px] p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-bold text-sm flex items-center justify-between cursor-pointer hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
                >
                  <span className="flex items-center gap-2">
                    💵 {lang === "te" ? "చేతిలో నగదు (Cash)" : "Cash in Hand"}
                  </span>
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                    {lang === "te" ? "తక్షణమే" : "Instant"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => confirmPaidMethod("phonepe")}
                  className="w-full min-h-[48px] p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-200 font-bold text-sm flex items-center justify-between cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-950/60"
                >
                  <span className="flex items-center gap-2">📱 PhonePe UPI</span>
                  <span className="text-xs text-purple-700 dark:text-purple-400 font-semibold">
                    {lang === "te" ? "డిజిటల్" : "Digital"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => confirmPaidMethod("online")}
                  className="w-full min-h-[48px] p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-bold text-sm flex items-center justify-between cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-950/60"
                >
                  <span className="flex items-center gap-2">
                    🌐 {lang === "te" ? "బ్యాంక్ / ఇతర UPI" : "Bank / Other UPI"}
                  </span>
                  <span className="text-xs text-blue-800 dark:text-blue-400 font-semibold">
                    {lang === "te" ? "ట్రాన్స్‌ఫర్" : "Transfer"}
                  </span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPayModalBorrower(null)}
                className="w-full min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 mt-2 cursor-pointer"
              >
                {lang === "te" ? "రద్దు" : "Cancel"}
              </button>
            </div>
          </div>
        )}

        {/* Short Payment Modal */}
        {shortModalBorrower && (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                ⚡ {lang === "te" ? "తక్కువ వాయిదా (Short)" : "Short Payment"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {shortModalBorrower.name} · {lang === "te" ? "వాయిదా:" : "Due:"} {formatCurrency(shortModalBorrower.weeklyDue)}
              </p>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {lang === "te" ? "నేడు చెల్లించిన మొత్తం (₹) *" : "Amount Paid Today (₹) *"}
                </label>
                <input
                  type="number"
                  required
                  placeholder={`${lang === "te" ? "గరిష్టం" : "Max"} ₹${shortModalBorrower.weeklyDue}`}
                  value={shortAmt}
                  onChange={(e) => setShortAmt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none font-bold text-amber-700 dark:text-amber-400 tabular-nums focus:border-amber-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {lang === "te" ? "గమనిక" : "Note"}
                </label>
                <input
                  type="text"
                  placeholder={lang === "te" ? "ఉదా. మిగతా బాకీ వచ్చే వారం" : "e.g. Balance next week"}
                  value={shortNote}
                  onChange={(e) => setShortNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShortModalBorrower(null)}
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {lang === "te" ? "రద్దు" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={saveShortPayment}
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md cursor-pointer"
                >
                  {lang === "te" ? "తక్కువ సేవ్ చేయి" : "Save Short"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Extra Payment Modal */}
        {extraModalBorrower && (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                ➕ {lang === "te" ? "అదనపు చెల్లింపు" : "Extra Payment"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {extraModalBorrower.name} · {lang === "te" ? "వాయిదా:" : "Weekly EMI:"} {formatCurrency(extraModalBorrower.weeklyDue)}
              </p>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {lang === "te" ? "అదనంగా చెల్లించిన మొత్తం (₹) *" : "Extra Amount Paid (₹) *"}
                </label>
                <input
                  type="number"
                  required
                  placeholder={lang === "te" ? "ఉదా. 500" : "e.g. 500"}
                  value={extraAmt}
                  onChange={(e) => setExtraAmt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none font-bold text-blue-700 dark:text-blue-400 tabular-nums focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {lang === "te" ? "గమనిక (ఐచ్ఛికం)" : "Note (optional)"}
                </label>
                <input
                  type="text"
                  placeholder={lang === "te" ? "ఉదా. ముందు వాయిదా కలిపి" : "e.g. paid advance EMI"}
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none font-bold focus:border-blue-500"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExtraModalBorrower(null)}
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {lang === "te" ? "రద్దు" : "Cancel"}
                </button>
                <button
                  type="button"
                  onClick={saveExtraPayment}
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-[#1E3A8A] text-white text-xs font-bold shadow-md hover:bg-blue-900 cursor-pointer"
                >
                  {lang === "te" ? "అదనపు సేవ్ చేయి" : "Save Extra"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Record Cash & Close Modal */}
        {cashCloseModal && (
          <div className="fixed inset-0 bg-slate-900/65 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                💰 {lang === "te" ? "వసూలు సారాంశం & ముగింపు" : "Collection Summary & Close"}
              </h3>
              
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl space-y-2 text-xs tabular-nums">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400 font-semibold">{lang === "te" ? "నేటి వసూలు:" : "Collected Today:"}</span>
                  <span className="font-black text-emerald-700 dark:text-emerald-400 text-sm">
                    {formatCurrency(totalCollected)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400 font-semibold">{lang === "te" ? "లక్ష్యం:" : "Expected Target:"}</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(totalExpected)}
                  </span>
                </div>
                {totalExpected > totalCollected && (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-red-600 dark:text-red-400 font-bold">{lang === "te" ? "తరుగు బ్యాలెన్స్:" : "Shortfall:"}</span>
                    <span className="font-black text-red-600 dark:text-red-400">
                      -{formatCurrency(totalExpected - totalCollected)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-1 text-[11px] font-bold tabular-nums">
                <span className="text-emerald-700 dark:text-emerald-400">✅ {paidCount} {lang === "te" ? "చెల్లింపు" : "Paid"}</span>
                <span className="text-amber-700 dark:text-amber-400">⚡ {shortCount} {lang === "te" ? "తక్కువ" : "Short"}</span>
                <span className="text-red-700 dark:text-red-400">❌ {skipCount} {lang === "te" ? "దాటవేత" : "Skip"}</span>
                <span className="text-blue-700 dark:text-blue-400">➕ {extraCount} {lang === "te" ? "అదనపు" : "Extra"}</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCashCloseModal(false)}
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  {lang === "te" ? "వెనుకకు" : "Back"}
                </button>
                <button
                  type="button"
                  onClick={handleFinishCashClose}
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-[#1E3A8A] text-white text-xs font-bold shadow-md hover:bg-blue-900 cursor-pointer"
                >
                  {lang === "te" ? "సేవ్ & ముగించు ✓" : "Save & Finalize ✓"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Instant WhatsApp Receipt Modal */}
        {receiptModalData && (
          <WhatsAppReceiptModal
            borrower={receiptModalData.borrower}
            villageName={selectedVillage.name}
            amtPaid={receiptModalData.amtPaid}
            status={receiptModalData.status}
            payMethod={receiptModalData.payMethod}
            note={receiptModalData.note}
            extraAmt={receiptModalData.extraAmt}
            remainingBal={receiptModalData.remainingBal}
            dateStr={activeCollectionDate}
            profile={profile}
            lang={lang}
            onClose={() => setReceiptModalData(null)}
            showToast={showToast}
          />
        )}
      </div>
    );
  }

  return null;
};
