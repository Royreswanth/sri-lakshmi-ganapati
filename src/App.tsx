import React, { useState, useEffect } from "react";
import { PinScreen } from "./components/PinScreen";
import { HeaderNav } from "./components/HeaderNav";
import { BottomTabBar, TabType } from "./components/BottomTabBar";
import { HomeTab } from "./components/HomeTab";
import { CollectTab } from "./components/CollectTab";
import { BorrowersTab } from "./components/BorrowersTab";
import { ReportsTab } from "./components/ReportsTab";
import { CalendarTab } from "./components/CalendarTab";
import { CalculatorTab } from "./components/CalculatorTab";
import { ExpensesTab } from "./components/ExpensesTab";
import { SettingsTab } from "./components/SettingsTab";

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
} from "./types";
import { DB, STORAGE_KEYS, DEFAULT_PROFILE } from "./utils/storage";
import { getTodayStr } from "./utils/dateUtils";
import { checkAndAutoBackup } from "./services/firebaseBackup";
import { OfflineIndicator } from "./components/OfflineIndicator";

interface ToastState {
  msg: string;
  type: "success" | "error" | "info";
}

export default function App() {
  const [unlocked, setUnlocked] = useState(false);
  const [tab, setTab] = useState<TabType>("home");

  // Core Data Stores (backed by existing slg_* keys for 100% zero data loss)
  const [data, setData] = useState<{
    villages: Village[];
    borrowers: Record<string, Borrower[]>;
  }>(() => DB.get(STORAGE_KEYS.DATA, { villages: [], borrowers: {} }));

  const [collections, setCollections] = useState<Record<string, CollectionRecord>>(
    () => DB.get(STORAGE_KEYS.COLS, {})
  );

  const [expenses, setExpenses] = useState<ExpenseItem[]>(() =>
    DB.get(STORAGE_KEYS.EXP, [])
  );

  const [pin, setPin] = useState<string>(() => DB.get(STORAGE_KEYS.PIN, "1234"));

  const [newLoansLog, setNewLoansLog] = useState<NewLoanLogItem[]>(() =>
    DB.get(STORAGE_KEYS.NEW_LOANS, [])
  );

  const [personalLog, setPersonalLog] = useState<PersonalUseItem[]>(() =>
    DB.get(STORAGE_KEYS.PERSONAL, [])
  );

  const [profile, setProfile] = useState<BusinessProfile>(() =>
    DB.get(STORAGE_KEYS.PROFILE, DEFAULT_PROFILE)
  );

  const [lang, setLang] = useState<Language>(() =>
    DB.get(STORAGE_KEYS.LANG, "te")
  );

  const [theme, setTheme] = useState<ThemeMode>(() =>
    DB.get(STORAGE_KEYS.THEME, "light")
  );

  // Toast notification
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (
    msg: string,
    type: "success" | "error" | "info" = "success"
  ) => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // 3-Minute Auto-lock on inactivity
  useEffect(() => {
    if (!unlocked) return;
    let timer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        setUnlocked(false);
      }, 180000); // 3 minutes
    };

    const events = ["touchstart", "mousemove", "keydown", "click"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [unlocked]);

  // Auto-backup to Firebase Cloud on app unlock / session start
  useEffect(() => {
    if (unlocked) {
      checkAndAutoBackup();
    }
  }, [unlocked]);

  // Update Handlers that persist to storage
  const handleUpdateData = (newData: {
    villages: Village[];
    borrowers: Record<string, Borrower[]>;
  }) => {
    setData(newData);
    DB.set(STORAGE_KEYS.DATA, newData);
  };

  const handleSaveCollection = (
    col: CollectionRecord,
    updatedBorrowers: Record<string, Borrower[]>
  ) => {
    const colKey = `${col.villageId}_${col.date}`;
    const newCols = { ...collections, [colKey]: col };
    setCollections(newCols);
    DB.set(STORAGE_KEYS.COLS, newCols);

    const newData = { ...data, borrowers: updatedBorrowers };
    setData(newData);
    DB.set(STORAGE_KEYS.DATA, newData);

    // Auto-backup to Firebase Cloud in background
    checkAndAutoBackup(true);
  };

  const handleUpdatePin = (newPin: string) => {
    setPin(newPin);
    DB.set(STORAGE_KEYS.PIN, newPin);
  };

  const handleUpdateProfile = (newProfile: BusinessProfile) => {
    setProfile(newProfile);
    DB.set(STORAGE_KEYS.PROFILE, newProfile);
  };

  const handleToggleLang = () => {
    const nextLang = lang === "en" ? "te" : "en";
    setLang(nextLang);
    DB.set(STORAGE_KEYS.LANG, nextLang);
    showToast(nextLang === "te" ? "భాష: తెలుగు" : "Language: English", "info");
  };

  const handleToggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    DB.set(STORAGE_KEYS.THEME, nextTheme);
  };

  const handleRecordPersonalUse = (amt: number, note: string) => {
    const item: PersonalUseItem = {
      id: `p${Date.now()}`,
      amt,
      note,
      date: getTodayStr(),
    };
    const updated = [item, ...personalLog];
    setPersonalLog(updated);
    DB.set(STORAGE_KEYS.PERSONAL, updated);
    showToast(lang === "te" ? "సొంత ఖర్చు నమోదైంది ✓" : "Personal use recorded ✓", "success");
  };

  const handleAddNewLoanLog = (item: NewLoanLogItem) => {
    const updated = [item, ...newLoansLog];
    setNewLoansLog(updated);
    DB.set(STORAGE_KEYS.NEW_LOANS, updated);

    // Auto-backup to Firebase Cloud in background
    checkAndAutoBackup(true);
  };

  const handleAddExpense = (expense: ExpenseItem) => {
    const updated = [expense, ...expenses];
    setExpenses(updated);
    DB.set(STORAGE_KEYS.EXP, updated);
    showToast(lang === "te" ? "లైన్ ఖర్చు నమోదైంది ✓" : "Line expense saved ✓", "success");
  };

  const handleDeleteExpense = (id: number) => {
    const updated = expenses.filter((e) => e.id !== id);
    setExpenses(updated);
    DB.set(STORAGE_KEYS.EXP, updated);
    showToast(lang === "te" ? "ఖర్చు తొలగించబడింది" : "Expense deleted", "info");
  };

  // Seed sample villages if empty
  useEffect(() => {
    if (data.villages.length === 0) {
      const v1: Village = { id: "v1", name: "Polamuru (పోలమూరు)", day: "Monday" };
      const v2: Village = { id: "v2", name: "Pippara (పిప్పర)", day: "Tuesday" };
      const b1: Borrower = {
        id: "b1",
        seqNo: "1",
        name: "వెంకటేశ్వరరావు (Venkateswara Rao)",
        phone: "9876543210",
        loanAmt: 10000,
        durationWeeks: 12,
        interestPct: 20,
        weeklyDue: 1000,
        totalReturn: 12000,
        weeksPaid: 2,
        startDate: getTodayStr(),
        history: [
          { date: "2026-10-06", status: "paid", amtPaid: 1000, payMethod: "cash" },
          { date: "2026-10-13", status: "paid", amtPaid: 1000, payMethod: "phonepe" },
        ],
      };
      const b2: Borrower = {
        id: "b2",
        seqNo: "2",
        name: "నాగమణి (Nagamani)",
        phone: "9848012345",
        loanAmt: 15000,
        durationWeeks: 12,
        interestPct: 20,
        weeklyDue: 1500,
        totalReturn: 18000,
        weeksPaid: 1,
        startDate: getTodayStr(),
        history: [
          { date: "2026-10-06", status: "paid", amtPaid: 1500, payMethod: "cash" },
        ],
      };
      const initial = {
        villages: [v1, v2],
        borrowers: { v1: [b1, b2], v2: [] },
      };
      handleUpdateData(initial);
    }
  }, []);

  // Sync Theme with document root element
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // 1. PIN Lock Screen (Matching Image 2 Right Pane)
  if (!unlocked) {
    return (
      <PinScreen
        storedPin={pin}
        onUnlock={() => setUnlocked(true)}
        businessName={profile.businessName}
        tagline={profile.tagline}
        emblem={profile.emblem || "ganesha"}
        brandColor={profile.brandColor || "#D97706"}
        lang={lang}
        onToggleLang={handleToggleLang}
      />
    );
  }

  // 2. Unlocked App Shell (Soft Neumorphic Luxury Fintech Layout)
  return (
    <div
      className={`min-h-screen font-sans flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 transition-colors ${
        theme === "dark" ? "dark bg-[#0B0F19] text-slate-100" : "bg-[#EDF1F7] text-slate-900"
      }`}
    >
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`px-4 py-2.5 rounded-full font-bold text-xs shadow-xl text-white flex items-center gap-1.5 ${
              toast.type === "success"
                ? "bg-emerald-600 shadow-emerald-900/30"
                : toast.type === "error"
                ? "bg-rose-600 shadow-rose-900/30"
                : "bg-[#1E3A8A] shadow-blue-900/30"
            }`}
          >
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      {/* Offline Village Mode Status Bar */}
      <OfflineIndicator lang={lang} />

      {/* Main Top Header with Universal Back Button when outside Home */}
      <HeaderNav
        title={
          tab === "home"
            ? profile.businessName
            : tab === "collect"
            ? lang === "te"
              ? "లైన్ వసూలు (Line Collection)"
              : "Line Collection"
            : tab === "borrowers"
            ? lang === "te"
              ? "ఖాతాదారులు (Borrowers)"
              : "Borrowers"
            : tab === "reports"
            ? lang === "te"
              ? "లైన్ నివేదికలు"
              : "Line Reports"
            : tab === "calendar"
            ? lang === "te"
              ? "క్యాలెండర్"
              : "Calendar"
            : tab === "calc"
            ? lang === "te"
              ? "క్యాలిక్యులేటర్"
              : "Calculator"
            : tab === "expenses"
            ? lang === "te"
              ? "లైన్ ఖర్చులు"
              : "Line Expenses"
            : lang === "te"
            ? "సెట్టింగ్స్"
            : "Settings"
        }
        onBack={tab !== "home" ? () => setTab("home") : undefined}
        showFullBranding={tab === "home"}
        businessName={profile.businessName}
        tagline={profile.tagline}
        emblem={profile.emblem || "ganesha"}
        brandColor={profile.brandColor || "#D97706"}
        lang={lang}
        theme={theme}
        onToggleLang={handleToggleLang}
        onToggleTheme={handleToggleTheme}
        onLock={() => setUnlocked(false)}
      />

      {/* Tab Screen Router */}
      <main className="flex-1 w-full max-w-lg mx-auto">
        {tab === "home" && (
          <HomeTab
            data={data}
            collections={collections}
            expenses={expenses}
            newLoansLog={newLoansLog}
            personalLog={personalLog}
            profile={profile}
            lang={lang}
            theme={theme}
            onNavigateTab={setTab}
            onRecordPersonalUse={handleRecordPersonalUse}
          />
        )}

        {tab === "collect" && (
          <CollectTab
            data={data}
            onUpdateData={handleUpdateData}
            collections={collections}
            onSaveCollection={handleSaveCollection}
            onAddNewLoanLog={handleAddNewLoanLog}
            profile={profile}
            lang={lang}
            showToast={showToast}
          />
        )}

        {tab === "borrowers" && (
          <BorrowersTab data={data} profile={profile} lang={lang} />
        )}

        {tab === "reports" && (
          <ReportsTab
            data={data}
            collections={collections}
            expenses={expenses}
            personalLog={personalLog}
            lang={lang}
          />
        )}

        {tab === "calendar" && (
          <CalendarTab collections={collections} lang={lang} />
        )}

        {tab === "calc" && <CalculatorTab />}

        {tab === "expenses" && (
          <ExpensesTab
            expenses={expenses}
            onAddExpense={handleAddExpense}
            onDeleteExpense={handleDeleteExpense}
            lang={lang}
          />
        )}

        {tab === "settings" && (
          <SettingsTab
            pin={pin}
            onUpdatePin={handleUpdatePin}
            data={data}
            onUpdateData={handleUpdateData}
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            lang={lang}
            theme={theme}
            onToggleLang={handleToggleLang}
            onToggleTheme={handleToggleTheme}
            onLock={() => setUnlocked(false)}
            showToast={showToast}
          />
        )}
      </main>

      {/* Soft Neumorphic Floating Bottom Tab Bar */}
      <BottomTabBar
        currentTab={tab}
        onSelectTab={setTab}
        lang={lang}
        theme={theme}
      />
    </div>
  );
}
