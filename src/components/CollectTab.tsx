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
} from "lucide-react";
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
} from "../types";
import { translations } from "../translations";
import {
  formatCurrency,
  formatDateIN,
  getTodayStr,
  getDayName,
  calculateWeeklyDue,
  calculateRemainingBalance,
} from "../utils/dateUtils";
import {
  applyCollectionEntriesIdempotently,
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

  // Add & Edit Borrower Modals
  const [addBorrowerModal, setAddBorrowerModal] = useState(false);
  const [newBorrowerForm, setNewBorrowerForm] = useState({
    name: "",
    phone: "",
    seqNo: "",
    loanAmt: "10000",
    interestPct: "20",
    durationWeeks: "12",
    weeklyOverride: "",
    startDate: getTodayStr(),
    isOngoing: false,
    weeksPaid: "0",
    hasWhatsApp: true,
    disableReceipt: false,
    disableReminder: false,
  });

  const [editBorrowerModal, setEditBorrowerModal] = useState<Borrower | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    seqNo: "",
    hasWhatsApp: true,
    disableReceipt: false,
    disableReminder: false,
  });
  const [deleteConfirmBorrower, setDeleteConfirmBorrower] = useState<Borrower | null>(null);

  const t = translations[lang];
  const todayStr = getTodayStr();

  const getCollectionKey = (v: Village) => `${v.id}_${todayStr}`;

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
        dateStr: todayStr,
        villageName: selectedVillage.name,
        businessName: profile.businessName,
        payMethod: method,
        remainingBal: updatedRem,
        lang,
      });
      openWhatsApp(b.phone, msg);
      markReceiptSent(b.id, todayStr);
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
        dateStr: todayStr,
        villageName: selectedVillage.name,
        businessName: profile.businessName,
        payMethod: "cash",
        note,
        remainingBal: updatedRem,
        lang,
      });
      openWhatsApp(b.phone, msg);
      markReceiptSent(b.id, todayStr);
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
        dateStr: todayStr,
        villageName: selectedVillage.name,
        businessName: profile.businessName,
        payMethod: "cash",
        note,
        remainingBal: updatedRem,
        lang,
      });
      openWhatsApp(b.phone, msg);
      markReceiptSent(b.id, todayStr);
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

  // Calculations for current village collection sheet
  const totalExpected = currentBorrowers.reduce((sum, b) => sum + b.weeklyDue, 0);
  const totalCollected = Object.values(entries).reduce((sum, e) => sum + (e.amtPaid || 0), 0);
  const paidCount = Object.values(entries).filter((e) => e.status === "paid").length;
  const skipCount = Object.values(entries).filter((e) => e.status === "skip").length;
  const shortCount = Object.values(entries).filter((e) => e.status === "short").length;
  const extraCount = Object.values(entries).filter((e) => e.status === "extra").length;
  const pendingCount = currentBorrowers.length - (paidCount + skipCount + shortCount + extraCount);

  // Apply entries to borrowers idempotently (Fixes D4, D5)
  const applyEntriesToBorrowers = (personalVal: number = 0) => {
    if (!selectedVillage) return;
    const villageId = selectedVillage.id;
    const currentList = data.borrowers[villageId] || [];

    // Pure, idempotent calculation that supports editing collections on same calendar day
    const updatedBorrowers = applyCollectionEntriesIdempotently(
      currentList,
      entries,
      todayStr
    );

    const newBorrowersMap = {
      ...data.borrowers,
      [villageId]: updatedBorrowers,
    };

    const collectionRecord: CollectionRecord = {
      villageId,
      villageName: selectedVillage.name,
      date: todayStr,
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

  // Add Borrower Submit (Fix D7: Check seqNo uniqueness in same village)
  const handleAddBorrower = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVillage || !newBorrowerForm.name || !newBorrowerForm.loanAmt) return;

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

    const loan = parseInt(newBorrowerForm.loanAmt) || 10000;
    const weeks = parseInt(newBorrowerForm.durationWeeks) || 12;
    const pct = parseInt(newBorrowerForm.interestPct) || 20;
    const weeklyDue =
      parseInt(newBorrowerForm.weeklyOverride) || calculateWeeklyDue(loan, pct, weeks);
    const totalReturn = weeklyDue * weeks;
    const weeksPaid = newBorrowerForm.isOngoing ? parseInt(newBorrowerForm.weeksPaid) || 0 : 0;

    const newBorrower: Borrower = {
      id: `b${Date.now()}`,
      seqNo: newBorrowerForm.seqNo.trim(),
      name: newBorrowerForm.name.trim(),
      phone: newBorrowerForm.phone.trim(),
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
        date: todayStr,
      });
    }

    setNewBorrowerForm({
      name: "",
      phone: "",
      seqNo: "",
      loanAmt: "10000",
      interestPct: "20",
      durationWeeks: "12",
      weeklyOverride: "",
      startDate: todayStr,
      isOngoing: false,
      weeksPaid: "0",
      hasWhatsApp: true,
      disableReceipt: false,
      disableReminder: false,
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
            hasWhatsApp: editForm.hasWhatsApp,
            disableReceipt: editForm.disableReceipt,
            disableReminder: editForm.disableReminder,
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

  // SCREEN 1: Villages List
  if (screen === "villages") {
    return (
      <div className="pb-28 px-4 pt-3 max-w-lg mx-auto space-y-4">
        {/* Neumorphic Hero Card */}
        <div className="neu-card rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {lang === "te" ? "వసూలు కోసం గ్రామాన్ని ఎంచుకోండి" : "Select Village"}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
                {lang === "te" ? "నేటి లైన్ వసూలు" : "Today's Line Collection"}
              </h2>
            </div>
            <div className="w-12 h-12 rounded-2xl neu-inset flex items-center justify-center text-blue-900">
              <Navigation className="w-6 h-6" />
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-2 font-medium">
            {formatDateIN(todayStr, lang)} · {getDayName(todayStr, lang)}
          </p>
        </div>

        {["Monday", "Tuesday"].map((day) => {
          const vList = data.villages.filter((v) => v.day === day);
          const isToday = getDayName(todayStr, "en") === day;

          return (
            <div key={day} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                  <span>{day} Villages</span>
                  {isToday && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                      TODAY
                    </span>
                  )}
                </span>
                <span className="text-xs text-slate-500 font-medium">
                  {vList.length} {t.villages}
                </span>
              </div>

              {vList.length === 0 ? (
                <div className="neu-card rounded-2xl p-4 text-xs text-slate-500 text-center">
                  {lang === "te"
                    ? `${day} కోసం ఇంకా ఏ గ్రామం లేదు. సెట్టింగ్స్‌లో చేర్చండి.`
                    : `No villages configured for ${day}. Add in Settings.`}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {vList.map((v) => {
                    const bs = data.borrowers[v.id] || [];
                    const isDone = !!collections[getCollectionKey(v)];

                    return (
                      <div
                        key={v.id}
                        onClick={() => openVillage(v)}
                        className={`neu-card rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-blue-900/40 transition-all ${
                          isDone ? "border-emerald-400/60" : ""
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm ${
                              isDone ? "badge-pastel-green" : "badge-pastel-blue"
                            }`}
                          >
                            {isDone ? (
                              <CheckCircle2 className="w-6 h-6 text-emerald-700" />
                            ) : (
                              <Building2 className="w-5 h-5" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-extrabold text-slate-900 text-base">
                              {v.name}
                            </h4>
                            <p className="text-xs text-slate-500">
                              {bs.length} {t.borrowers} · {v.day}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isDone ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                              ✓ Done
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-blue-900 px-2.5 py-1 rounded-full neu-inset">
                              Start →
                            </span>
                          )}
                          <ChevronRight className="w-5 h-5 text-slate-400" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // SCREEN 2: Village Detail
  if (screen === "detail" && selectedVillage) {
    const isDone = !!collections[getCollectionKey(selectedVillage)];
    const activeBs = currentBorrowers.filter(
      (b) => b.weeksPaid < (b.durationWeeks || 12)
    ).length;

    return (
      <div className="pb-28 px-4 pt-3 max-w-lg mx-auto space-y-4">
        {/* Prominent Back Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScreen("villages")}
            className="w-10 h-10 rounded-full neu-circle-btn flex items-center justify-center text-slate-700 cursor-pointer"
            title="All Villages"
          >
            <ArrowLeft className="w-5 h-5 text-slate-800" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {selectedVillage.name}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {selectedVillage.day} Line · {currentBorrowers.length} {t.borrowers}
            </p>
          </div>
        </div>

        {/* Hero Card */}
        <div className="neu-card rounded-3xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                {selectedVillage.day} Village
              </span>
              <h2 className="text-2xl font-black text-slate-900 mt-0.5">
                {selectedVillage.name}
              </h2>
            </div>
            {isDone && (
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Saved Today</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-300/40 text-center">
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                Borrowers
              </span>
              <span className="text-lg font-black text-slate-900">
                {currentBorrowers.length}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                Active
              </span>
              <span className="text-lg font-black text-slate-900">{activeBs}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase font-bold block">
                Weekly Target
              </span>
              <span className="text-base font-black text-amber-700">
                {formatCurrency(totalExpected)}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            onClick={() => setScreen("sheet")}
            className="w-full py-3.5 px-4 rounded-2xl bg-[#1E3A8A] hover:bg-blue-900 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <Wallet className="w-5 h-5 text-amber-300" />
            <span>
              {isDone ? t.viewEditCollection : t.startCollection}
            </span>
          </button>

          <button
            onClick={() => setAddBorrowerModal(true)}
            className="w-full py-3 px-4 rounded-2xl neu-btn text-slate-900 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-amber-600" />
            <span>{t.addNewBorrower}</span>
          </button>

          <button
            onClick={() => setShowReminderCenter(true)}
            className="w-full py-3 px-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-300/50 dark:border-amber-700/50 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs"
          >
            <Bell className="w-4 h-4 text-amber-600" />
            <span>
              {lang === "te"
                ? "🔔 2 రోజుల ముందస్తు వాట్సాప్ రిమైండర్లు పంపండి"
                : "🔔 Send 2-Day Advance WhatsApp Reminders"}
            </span>
          </button>
        </div>

        {/* Borrowers List */}
        <div className="flex items-center justify-between mb-1 px-1">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            {t.borrowers} ({currentBorrowers.length})
          </span>
          <span className="text-[11px] text-slate-400">Sorted by Roll #</span>
        </div>

        {currentBorrowers.length === 0 ? (
          <div className="neu-card rounded-2xl p-8 text-center text-xs text-slate-500">
            {lang === "te"
              ? "ఈ గ్రామంలో ఖాతాదారులు లేరు. పైన కొత్త ఖాతాదారుని చేర్చండి."
              : "No borrowers in this village. Add one above."}
          </div>
        ) : (
          <div className="space-y-2.5">
            {currentBorrowers.map((b) => {
              const rem = calculateRemainingBalance(b);
              const isCompleted = b.weeksPaid >= (b.durationWeeks || 12);

              return (
                <div key={b.id} className="neu-card rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl neu-inset flex items-center justify-center font-extrabold text-xs text-blue-900">
                        {b.seqNo ? `#${b.seqNo}` : "—"}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-slate-900 text-sm">{b.name}</h4>
                          {b.hasWhatsApp === false && (
                            <span className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[9px] font-black">
                              📵 కీప్యాడ్
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500">
                          {b.phone || (lang === "te" ? "ఫోన్ లేదు" : "No phone")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isCompleted ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          ✓ Done
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full neu-inset text-blue-900 text-[10px] font-bold">
                          Wk {b.weeksPaid}/{b.durationWeeks || 12}
                        </span>
                      )}

                      <button
                        onClick={() => {
                          setEditBorrowerModal(b);
                          setEditForm({
                            name: b.name,
                            phone: b.phone || "",
                            seqNo: b.seqNo || "",
                            hasWhatsApp: b.hasWhatsApp !== false,
                            disableReceipt: !!b.disableReceipt,
                            disableReminder: !!b.disableReminder,
                          });
                        }}
                        className="w-8 h-8 rounded-full neu-circle-btn flex items-center justify-center text-slate-600 cursor-pointer"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setDeleteConfirmBorrower(b)}
                        className="w-8 h-8 rounded-full neu-circle-btn flex items-center justify-center text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Financial Mini Grid */}
                  <div className="grid grid-cols-3 gap-2 neu-inset p-2 rounded-xl text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Loan</span>
                      <span className="font-bold text-slate-800">
                        {formatCurrency(b.loanAmt)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Weekly</span>
                      <span className="font-bold text-amber-700">
                        {formatCurrency(b.weeklyDue)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Remaining</span>
                      <span
                        className={`font-bold ${
                          rem > 0 ? "text-red-600" : "text-emerald-700"
                        }`}
                      >
                        {formatCurrency(rem)}
                      </span>
                    </div>
                  </div>

                  {/* WhatsApp Quick Actions */}
                  <div className="pt-1 flex items-center justify-between text-xs">
                    <button
                      onClick={() => handleSendAdvanceReminder(b)}
                      className="text-slate-600 hover:text-emerald-700 font-semibold flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{t.advanceReminder}</span>
                    </button>

                    <button
                      onClick={() => handleSendReceipt(b)}
                      className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>{t.whatsappReceipt}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirmBorrower && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
            <div className="neu-card rounded-3xl p-5 max-w-xs w-full text-center shadow-2xl">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="font-black text-slate-900 text-base mb-1">
                Delete Borrower?
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Are you sure you want to delete{" "}
                <span className="font-bold text-slate-900">
                  {deleteConfirmBorrower.name}
                </span>
                ? This will remove all their payment history.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirmBorrower(null)}
                  className="flex-1 py-2.5 rounded-xl neu-btn text-slate-600 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteBorrower(deleteConfirmBorrower.id)}
                  className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs"
                >
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Borrower Modal */}
        {editBorrowerModal && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="neu-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-900" />
                <span>Edit Borrower</span>
              </h3>
              <form onSubmit={handleSaveEditBorrower} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Sequence / Roll #
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1, 15"
                    value={editForm.seqNo}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, seqNo: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl neu-inset text-sm outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl neu-inset text-sm outline-none font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Phone (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit number"
                    value={editForm.phone}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl neu-inset text-sm outline-none font-bold"
                  />
                </div>

                {/* Phone Type (Smartphone WhatsApp vs Keypad Mobile) */}
                <div className="neu-inset p-2 rounded-xl space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 block px-1">
                    {lang === "te" ? "ఫోన్ రకం (Phone Type)" : "Phone Type"}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, hasWhatsApp: true }))}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        editForm.hasWhatsApp
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {lang === "te" ? "📱 స్మార్ట్‌ఫోన్ (WhatsApp)" : "📱 Smartphone (WhatsApp)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm((f) => ({ ...f, hasWhatsApp: false }))}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        !editForm.hasWhatsApp
                          ? "bg-slate-800 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-200"
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
                      className={`p-2 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                        !editForm.disableReceipt
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : "bg-amber-50 text-amber-800 border-amber-300"
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
                      className={`p-2 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                        !editForm.disableReminder
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : "bg-amber-50 text-amber-800 border-amber-300"
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
                    className="flex-1 py-2.5 rounded-xl neu-btn text-slate-600 font-bold text-xs cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-[#1E3A8A] text-white font-bold text-xs shadow-md cursor-pointer"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Borrower Modal */}
        {addBorrowerModal && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="neu-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto space-y-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-600" />
                <span>{t.addNewBorrower}</span>
              </h3>

              {/* Ongoing vs New Loan Toggle */}
              <div className="flex neu-inset p-1 rounded-xl mb-3">
                <button
                  type="button"
                  onClick={() =>
                    setNewBorrowerForm((f) => ({ ...f, isOngoing: false }))
                  }
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    !newBorrowerForm.isOngoing
                      ? "bg-[#1E3A8A] text-white shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  🆕 New Loan
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setNewBorrowerForm((f) => ({ ...f, isOngoing: true }))
                  }
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    newBorrowerForm.isOngoing
                      ? "bg-[#1E3A8A] text-white shadow-xs"
                      : "text-slate-500"
                  }`}
                >
                  ⚡ Ongoing (Existing)
                </button>
              </div>

              <form onSubmit={handleAddBorrower} className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-1">
                    <label className="text-xs font-bold text-slate-600 block mb-1">
                      Roll #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 5"
                      value={newBorrowerForm.seqNo}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({ ...f, seqNo: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl neu-inset text-sm outline-none font-bold"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-slate-600 block mb-1">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="పేరు నమోదు చేయండి"
                      value={newBorrowerForm.name}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({ ...f, name: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-xl neu-inset text-sm outline-none font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Phone (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    placeholder="10-digit number"
                    value={newBorrowerForm.phone}
                    onChange={(e) =>
                      setNewBorrowerForm((f) => ({ ...f, phone: e.target.value }))
                    }
                    className="w-full px-3 py-2 rounded-xl neu-inset text-sm outline-none font-bold"
                  />
                </div>

                {/* Phone Type (Smartphone WhatsApp vs Keypad Mobile) */}
                <div className="neu-inset p-2 rounded-xl space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-700 block px-1">
                    {lang === "te" ? "ఫోన్ రకం (Phone Type)" : "Phone Type"}
                  </label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNewBorrowerForm((f) => ({ ...f, hasWhatsApp: true }))}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        newBorrowerForm.hasWhatsApp
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {lang === "te" ? "📱 స్మార్ట్‌ఫోన్ (WhatsApp)" : "📱 Smartphone (WhatsApp)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewBorrowerForm((f) => ({ ...f, hasWhatsApp: false }))}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        !newBorrowerForm.hasWhatsApp
                          ? "bg-slate-800 text-white shadow-xs"
                          : "text-slate-600 hover:bg-slate-200"
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
                      className={`p-2 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                        !newBorrowerForm.disableReceipt
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : "bg-amber-50 text-amber-800 border-amber-300"
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
                      className={`p-2 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                        !newBorrowerForm.disableReminder
                          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                          : "bg-amber-50 text-amber-800 border-amber-300"
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

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">
                      Loan Amount (₹) *
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
                      className="w-full px-3 py-2 rounded-xl neu-inset text-sm outline-none font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">
                      Interest %
                    </label>
                    <select
                      value={newBorrowerForm.interestPct}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({
                          ...f,
                          interestPct: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl neu-inset text-sm outline-none bg-[#EDF1F7] font-bold"
                    >
                      {[0, 5, 10, 15, 20, 25, 30].map((p) => (
                        <option key={p} value={p}>
                          {p}%
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">
                      Duration (Weeks)
                    </label>
                    <select
                      value={newBorrowerForm.durationWeeks}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({
                          ...f,
                          durationWeeks: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl neu-inset text-sm outline-none bg-[#EDF1F7] font-bold"
                    >
                      {[4, 6, 8, 10, 12, 16, 20, 24].map((w) => (
                        <option key={w} value={w}>
                          {w} weeks
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">
                      Weekly Override
                    </label>
                    <input
                      type="number"
                      placeholder={`Auto: ${formatCurrency(
                        calculateWeeklyDue(
                          parseInt(newBorrowerForm.loanAmt) || 0,
                          parseInt(newBorrowerForm.interestPct) || 20,
                          parseInt(newBorrowerForm.durationWeeks) || 12
                        )
                      )}`}
                      value={newBorrowerForm.weeklyOverride}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({
                          ...f,
                          weeklyOverride: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl neu-inset text-sm outline-none font-bold"
                    />
                  </div>
                </div>

                {newBorrowerForm.isOngoing && (
                  <div className="neu-inset p-3 rounded-xl">
                    <label className="text-xs font-bold text-amber-900 block mb-1">
                      Weeks Already Paid
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 4"
                      value={newBorrowerForm.weeksPaid}
                      onChange={(e) =>
                        setNewBorrowerForm((f) => ({
                          ...f,
                          weeksPaid: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 rounded-xl neu-inset text-sm outline-none font-bold"
                    />
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddBorrowerModal(false)}
                    className="flex-1 py-2.5 rounded-xl neu-btn text-slate-600 font-bold text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-[#1E3A8A] text-white font-bold text-xs cursor-pointer shadow-md"
                  >
                    Add Borrower
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
    return (
      <div className="pb-48 px-3 pt-2 max-w-lg mx-auto space-y-3">
        {/* Header with prominent Back button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setScreen("detail")}
            className="w-10 h-10 rounded-full neu-circle-btn flex items-center justify-center text-slate-700 cursor-pointer"
            title="Back to Village"
          >
            <ArrowLeft className="w-5 h-5 text-slate-800" />
          </button>
          <div className="flex-1">
            <h2 className="text-base font-bold text-slate-800 truncate">
              {selectedVillage.name}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {paidCount + shortCount + extraCount}/{currentBorrowers.length} collected
            </p>
          </div>
        </div>

        {/* Sticky Status Bar */}
        <div className="sticky top-14 neu-card p-3 rounded-2xl z-30 shadow-md">
          <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
            <div className="flex items-center gap-2">
              <span className="text-emerald-700">✅ {paidCount}</span>
              <span className="text-amber-700">⚡ {shortCount}</span>
              <span className="text-red-700">❌ {skipCount}</span>
              <span className="text-blue-700">➕ {extraCount}</span>
              <span className="text-slate-400">⏳ {pendingCount}</span>
            </div>
            <span className="font-black text-emerald-700 text-sm">
              {formatCurrency(totalCollected)}
            </span>
          </div>

          <div className="w-full bg-slate-300/40 rounded-full h-2 overflow-hidden">
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

          <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-medium">
            <span>Expected: {formatCurrency(totalExpected)}</span>
            <span>
              Shortfall: {formatCurrency(Math.max(0, totalExpected - totalCollected))}
            </span>
          </div>

          {/* WhatsApp & Keypad Indicators Summary Strip (Requirement 3) */}
          {(() => {
            const rules = getWhatsAppRules();
            const keypadCount = currentBorrowers.filter((b) => isBorrowerKeypad(b, rules)).length;
            const receiptsSentCount = currentBorrowers.filter(
              (b) => entries[b.id]?.receiptSent || isReceiptSent(b.id, todayStr)
            ).length;

            return (
              <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-slate-200 text-[10px] font-bold">
                <div className="flex items-center gap-1 text-emerald-700">
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>
                    {receiptsSentCount} {lang === "te" ? "వాట్సాప్ రశీదులు పంపబడ్డాయి" : "WhatsApp receipts sent"}
                  </span>
                </div>
                {keypadCount > 0 && (
                  <div className="flex items-center gap-1 text-slate-500">
                    <PhoneOff className="w-3 h-3 text-slate-400" />
                    <span>
                      {keypadCount} {lang === "te" ? "కీప్యాడ్ ఫోన్లు" : "Keypad mobiles"}
                    </span>
                  </div>
                )}
              </div>
            );
          })()}
        </div>

        {/* Borrowers Collection Items */}
        <div className="space-y-3">
          {currentBorrowers.map((b) => {
            const entry = entries[b.id];
            const status = entry?.status;
            const rules = getWhatsAppRules();
            const isKeypad = isBorrowerKeypad(b, rules);
            const isReceiptDisabled = isBorrowerReceiptDisabled(b, selectedVillage?.id, rules);
            const sentReceipt = entry?.receiptSent || isReceiptSent(b.id, todayStr);

            let borderClass = "";
            if (status === "paid") borderClass = "border-emerald-400/80 bg-emerald-50/20";
            if (status === "skip") borderClass = "border-red-400/80 bg-red-50/20";
            if (status === "short") borderClass = "border-amber-400/80 bg-amber-50/20";
            if (status === "extra") borderClass = "border-blue-400/80 bg-blue-50/20";

            return (
              <div
                key={b.id}
                className={`neu-card rounded-2xl p-4 transition-all ${borderClass}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg neu-inset font-extrabold text-[11px] text-blue-900 flex items-center justify-center">
                      {b.seqNo ? `#${b.seqNo}` : "—"}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="font-extrabold text-slate-900 text-sm leading-tight">
                          {b.name}
                        </h4>

                        {/* WhatsApp / Keypad Status Badge (Requirement 3) */}
                        {isKeypad ? (
                          <span
                            className="px-1.5 py-0.2 rounded-full bg-slate-200 text-slate-700 text-[9px] font-black flex items-center gap-0.5"
                            title={lang === "te" ? "సాధారణ కీప్యాడ్ మొబైల్ (వాట్సాప్ లేదు)" : "Keypad phone without WhatsApp"}
                          >
                            <span>📵</span>
                            <span>{lang === "te" ? "కీప్యాడ్" : "Keypad"}</span>
                          </span>
                        ) : sentReceipt ? (
                          <span
                            className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-black flex items-center gap-0.5"
                            title={lang === "te" ? "వాట్సాప్ రశీదు పంపబడింది" : "WhatsApp receipt sent"}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 inline" />
                            <span>{lang === "te" ? "రశీదు పంపబడింది" : "Receipt Sent"}</span>
                          </span>
                        ) : isReceiptDisabled ? (
                          <span
                            className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[9px] font-black flex items-center gap-0.5"
                            title={lang === "te" ? "వాట్సాప్ రశీదు ఆపివేయబడింది" : "WhatsApp receipt is turned off"}
                          >
                            <span>🔕</span>
                            <span>{lang === "te" ? "రశీదు ఆఫ్" : "Receipt Off"}</span>
                          </span>
                        ) : null}
                      </div>

                      <p className="text-[11px] text-slate-500">
                        Wk {b.weeksPaid + 1}/{b.durationWeeks || 12} · Due:{" "}
                        {formatCurrency(b.weeklyDue)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    {status === "paid" && (
                      <span className="text-emerald-700 font-black text-xs">
                        ✅ {formatCurrency(entry.amtPaid)}
                      </span>
                    )}
                    {status === "skip" && (
                      <span className="text-red-600 font-black text-xs">
                        ❌ Skipped
                      </span>
                    )}
                    {status === "short" && (
                      <span className="text-amber-700 font-black text-xs">
                        ⚡ {formatCurrency(entry.amtPaid)} (Short)
                      </span>
                    )}
                    {status === "extra" && (
                      <span className="text-blue-900 font-black text-xs">
                        ➕ {formatCurrency(entry.amtPaid)}
                      </span>
                    )}
                  </div>
                </div>

                {/* 4 Action Buttons */}
                <div className="grid grid-cols-4 gap-2 mt-2">
                  <button
                    onClick={() => handlePaidClick(b)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      status === "paid"
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "neu-btn text-emerald-800"
                    }`}
                  >
                    ✅ Paid
                  </button>

                  <button
                    onClick={() => handleSkipClick(b)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      status === "skip"
                        ? "bg-red-600 text-white shadow-xs"
                        : "neu-btn text-red-800"
                    }`}
                  >
                    ❌ Skip
                  </button>

                  <button
                    onClick={() => openShortModal(b)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      status === "short"
                        ? "bg-amber-600 text-white shadow-xs"
                        : "neu-btn text-amber-800"
                    }`}
                  >
                    ⚡ Short
                  </button>

                  <button
                    onClick={() => openExtraModal(b)}
                    className={`py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      status === "extra"
                        ? "bg-[#1E3A8A] text-white shadow-xs"
                        : "neu-btn text-blue-900"
                    }`}
                  >
                    ➕ Extra
                  </button>
                </div>

                {/* Instant WhatsApp Receipt Status & Resend Button */}
                {status && (
                  <div className="mt-2.5 pt-2 border-t border-slate-300/40 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
                      <span>Mode: <strong className="capitalize text-slate-700">{entry?.payMethod || "cash"}</strong></span>
                      {sentReceipt && !isKeypad && !isReceiptDisabled && (
                        <span className="text-emerald-700 font-bold ml-1 flex items-center gap-0.5">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{lang === "te" ? "రశీదు అందింది" : "Sent"}</span>
                        </span>
                      )}
                    </span>
                    {!isKeypad && !isReceiptDisabled && (
                      <button
                        onClick={() => handleSendReceipt(b)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-all shadow-xs"
                        title="View or Resend WhatsApp Receipt"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>{sentReceipt ? (lang === "te" ? "మళ్లీ రశీదు" : "Resend") : (lang === "te" ? "వాట్సాప్ రశీదు" : "Send WhatsApp Receipt")}</span>
                      </button>
                    )}
                    {!isKeypad && isReceiptDisabled && (
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

        {/* FIXED BOTTOM ACTION BAR — sits right above the bottom tab bar (bottom-20) */}
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-[92%] max-w-md neu-card rounded-2xl p-3 z-30 shadow-2xl border border-white/95">
          <div className="flex items-center justify-between mb-2 px-1 text-xs font-bold">
            <span className="text-slate-600">
              Total:{" "}
              <span className="text-emerald-700 font-black text-sm">
                {formatCurrency(totalCollected)}
              </span>
            </span>
            <span className="text-slate-500">
              {paidCount + shortCount + extraCount}/{currentBorrowers.length} collected
            </span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleQuickSave}
              className="flex-1 py-3 rounded-xl neu-btn text-emerald-800 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              💾 {t.saveAndUpdate}
            </button>
            <button
              onClick={() => setCashCloseModal(true)}
              className="flex-1 py-3 rounded-xl bg-[#1E3A8A] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:bg-blue-900"
            >
              💰 {t.recordCash}
            </button>
          </div>
        </div>

        {/* Payment Method Selector Modal */}
        {payModalBorrower && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end justify-center p-0">
            <div className="neu-card w-full max-w-md rounded-t-3xl p-5 shadow-2xl space-y-3">
              <h3 className="text-base font-bold text-slate-900 mb-1">
                💳 Payment Method
              </h3>
              <p className="text-xs text-slate-500 mb-2">
                {payModalBorrower.name} · {formatCurrency(payModalBorrower.weeklyDue)}
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => confirmPaidMethod("cash")}
                  className="w-full p-3.5 rounded-2xl neu-btn text-emerald-900 font-bold text-sm flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">💵 Cash in Hand</span>
                  <span className="text-xs text-emerald-700 font-semibold">Instant</span>
                </button>
                <button
                  onClick={() => confirmPaidMethod("phonepe")}
                  className="w-full p-3.5 rounded-2xl neu-btn text-purple-900 font-bold text-sm flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">📱 PhonePe UPI</span>
                  <span className="text-xs text-purple-700 font-semibold">Digital</span>
                </button>
                <button
                  onClick={() => confirmPaidMethod("online")}
                  className="w-full p-3.5 rounded-2xl neu-btn text-blue-900 font-bold text-sm flex items-center justify-between cursor-pointer"
                >
                  <span className="flex items-center gap-2">🌐 Bank / Other UPI</span>
                  <span className="text-xs text-blue-900 font-semibold">Transfer</span>
                </button>
              </div>
              <button
                onClick={() => setPayModalBorrower(null)}
                className="w-full py-2.5 rounded-xl neu-btn text-xs font-bold text-slate-600 mt-2"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Short Payment Modal */}
        {shortModalBorrower && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="neu-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3">
              <h3 className="text-base font-bold text-slate-900">⚡ Short Payment</h3>
              <p className="text-xs text-slate-500">
                {shortModalBorrower.name} · Due: {formatCurrency(shortModalBorrower.weeklyDue)}
              </p>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Amount Paid Today (₹) *
                </label>
                <input
                  type="number"
                  required
                  placeholder={`Max ₹${shortModalBorrower.weeklyDue}`}
                  value={shortAmt}
                  onChange={(e) => setShortAmt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl neu-inset text-sm outline-none font-bold text-amber-800"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Balance next week"
                  value={shortNote}
                  onChange={(e) => setShortNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl neu-inset text-sm outline-none font-bold"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShortModalBorrower(null)}
                  className="flex-1 py-2.5 rounded-xl neu-btn text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveShortPayment}
                  className="flex-1 py-2.5 rounded-xl bg-amber-600 text-white text-xs font-bold shadow-md"
                >
                  Save Short
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Extra Payment Modal */}
        {extraModalBorrower && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="neu-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3">
              <h3 className="text-base font-bold text-slate-900">➕ Extra Payment</h3>
              <p className="text-xs text-slate-500">
                {extraModalBorrower.name} · Weekly EMI: {formatCurrency(extraModalBorrower.weeklyDue)}
              </p>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Extra Amount Paid (₹) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 500"
                  value={extraAmt}
                  onChange={(e) => setExtraAmt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl neu-inset text-sm outline-none font-bold text-blue-900"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Note (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. paid advance EMI"
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl neu-inset text-sm outline-none font-bold"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setExtraModalBorrower(null)}
                  className="flex-1 py-2.5 rounded-xl neu-btn text-xs font-bold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveExtraPayment}
                  className="flex-1 py-2.5 rounded-xl bg-[#1E3A8A] text-white text-xs font-bold shadow-md hover:bg-blue-900"
                >
                  Save Extra
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Record Cash & Close Modal */}
        {cashCloseModal && (
          <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="neu-card w-full max-w-sm rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                💰 {lang === "te" ? "వసూలు సారాంశం & ముగింపు" : "Collection Summary & Close"}
              </h3>
              
              <div className="neu-inset p-3.5 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">{lang === "te" ? "నేటి వసూలు:" : "Collected Today:"}</span>
                  <span className="font-black text-emerald-700 text-sm">
                    {formatCurrency(totalCollected)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-semibold">{lang === "te" ? "లక్ష్యం:" : "Expected Target:"}</span>
                  <span className="font-bold text-slate-800">
                    {formatCurrency(totalExpected)}
                  </span>
                </div>
                {totalExpected > totalCollected && (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                    <span className="text-red-600 font-bold">{lang === "te" ? "తరుగు బ్యాలెన్స్:" : "Shortfall:"}</span>
                    <span className="font-black text-red-600">
                      -{formatCurrency(totalExpected - totalCollected)}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-600">
                <span className="text-emerald-700">✅ {paidCount} {lang === "te" ? "చెల్లింపు" : "Paid"}</span>
                <span className="text-amber-700">⚡ {shortCount} {lang === "te" ? "తక్కువ" : "Short"}</span>
                <span className="text-red-700">❌ {skipCount} {lang === "te" ? "దాటవేత" : "Skip"}</span>
                <span className="text-blue-700">➕ {extraCount} {lang === "te" ? "అదనపు" : "Extra"}</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCashCloseModal(false)}
                  className="flex-1 py-2.5 rounded-xl neu-btn text-xs font-bold text-slate-600"
                >
                  {lang === "te" ? "వెనుకకు" : "Back"}
                </button>
                <button
                  type="button"
                  onClick={handleFinishCashClose}
                  className="flex-1 py-2.5 rounded-xl bg-[#1E3A8A] text-white text-xs font-bold shadow-md hover:bg-blue-900"
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
            dateStr={todayStr}
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
