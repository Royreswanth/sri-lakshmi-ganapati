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
import { CashbookTab } from "./components/CashbookTab";
import { ExpensesTab } from "./components/ExpensesTab";
import { SettingsTab, SettingsSection } from "./components/SettingsTab";

import {
  Borrower,
  Village,
  CollectionRecord,
  ExpenseItem,
  NewLoanLogItem,
  PersonalUseItem,
  CashOpeningMap,
  BusinessProfile,
  Language,
  ThemeMode,
} from "./types";
import {
  DB,
  STORAGE_KEYS,
  DEFAULT_PROFILE,
  isUntouchedDemoData,
  clearAllAppData,
} from "./utils/storage";
import { getTodayStr } from "./utils/dateUtils";
import {
  PaidOrFreePlanId,
  applyActivationToProfile,
  applyCloudLicenseToProfile,
  evaluateSubscriptionAccess,
  getOrCreateDeviceId,
  isOwnerAdminEmail,
} from "./utils/licenseUtils";
import {
  GoogleVaultUser,
  checkAndAutoBackup,
  checkMyCloudLicense,
  getCurrentGoogleUser,
  signInWithGoogle,
  signOutGoogle,
  subscribeAuthState,
} from "./services/firebaseBackup";
import { OfflineIndicator } from "./components/OfflineIndicator";
import { SubscriptionPaywall } from "./components/SubscriptionPaywall";

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

  const [openingBalances, setOpeningBalances] = useState<CashOpeningMap>(() =>
    DB.get(STORAGE_KEYS.CASH_OPENING, {})
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

  const [deviceId] = useState<string>(() => getOrCreateDeviceId());
  const [googleUser, setGoogleUser] = useState<GoogleVaultUser | null>(() =>
    getCurrentGoogleUser()
  );
  const [googleSigningIn, setGoogleSigningIn] = useState(false);
  const [checkingCloudLicense, setCheckingCloudLicense] = useState(false);
  const [settingsSectionReq, setSettingsSectionReq] = useState<{
    section: SettingsSection;
    nonce: number;
  } | null>(null);
  const [reportsViewReq, setReportsViewReq] = useState<{
    view: "summary" | "recordBook" | "weeks" | "villages";
    nonce: number;
  } | null>(null);
  const [hasBackup, setHasBackup] = useState<boolean>(() => {
    try {
      return Boolean(
        localStorage.getItem("slg_last_cloud_backup") ||
          localStorage.getItem("slg_local_backup_at") ||
          getCurrentGoogleUser()
      );
    } catch {
      return false;
    }
  });

  // Toast notification
  const [toast, setToast] = useState<ToastState | null>(null);

  const navigateToTab = (
    targetTab: TabType,
    settingsSection?: SettingsSection,
    reportsView?: "summary" | "recordBook" | "weeks" | "villages"
  ) => {
    setTab(targetTab);
    if (targetTab === "settings") {
      setSettingsSectionReq({
        section: settingsSection || "main",
        nonce: Date.now(),
      });
    }
    if (targetTab === "reports") {
      setReportsViewReq({
        view: reportsView || "summary",
        nonce: Date.now(),
      });
    }
  };

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

  // Subscribe to Firebase Google Auth state
  useEffect(() => {
    const unsubscribe = subscribeAuthState((user) => {
      setGoogleUser(user);
      if (user) {
        setHasBackup(true);
      }
    });
    return unsubscribe;
  }, []);

  // Check Firestore /licenses whenever a verified non-admin Google user signs in
  const handleCheckCloudLicense = async (silent = false) => {
    if (!googleUser?.emailVerified) return;
    if (isOwnerAdminEmail(googleUser.email, googleUser.emailVerified)) return;
    setCheckingCloudLicense(true);
    try {
      const cloudLic = await checkMyCloudLicense(deviceId);
      if (cloudLic) {
        setProfile((prev) => {
          const next = applyCloudLicenseToProfile(prev, cloudLic, deviceId);
          DB.set(STORAGE_KEYS.PROFILE, next);
          return next;
        });
        if (!silent) {
          showToast(
            cloudLic.status === "revoked"
              ? lang === "te"
                ? "లైసెన్స్ నిలిపివేయబడింది"
                : "License suspended by admin"
              : lang === "te"
              ? "క్లౌడ్ సబ్‌స్క్రిప్షన్ ధృవీకరించబడింది ✓"
              : "Cloud subscription verified ✓",
            cloudLic.status === "revoked" ? "error" : "success"
          );
        }
      } else if (!silent) {
        showToast(
          lang === "te"
            ? "ఈ Google ఖాతాకు యాక్టివ్ సబ్‌స్క్రిప్షన్ లేదు"
            : "No active cloud license found for this email yet",
          "info"
        );
      }
    } catch (err) {
      console.warn("Cloud license check failed:", err);
      if (!silent) {
        showToast(
          lang === "te" ? "క్లౌడ్ లైసెన్స్ తనిఖీ విఫలమైంది" : "Could not check cloud license",
          "error"
        );
      }
    } finally {
      setCheckingCloudLicense(false);
    }
  };

  useEffect(() => {
    if (googleUser?.emailVerified && !isOwnerAdminEmail(googleUser.email, googleUser.emailVerified)) {
      void handleCheckCloudLicense(true);
    }
  }, [googleUser?.uid, googleUser?.emailVerified]);

  const handlePaywallGoogleSignIn = async () => {
    setGoogleSigningIn(true);
    try {
      const res = await signInWithGoogle();
      if (res.success && res.user) {
        setGoogleUser(res.user);
        showToast(res.message, "success");
      } else {
        showToast(res.message, "error");
      }
    } finally {
      setGoogleSigningIn(false);
    }
  };

  const handlePaywallGoogleSignOut = async () => {
    await signOutGoogle();
    setGoogleUser(null);
    showToast(lang === "te" ? "లాగ్‌అవుట్ అయింది" : "Signed out", "info");
  };

  const handleActivateKeySuccess = (params: {
    plan: PaidOrFreePlanId;
    expiresAt: string;
    licenseKey: string;
  }) => {
    const nextProfile = applyActivationToProfile(profile, {
      plan: params.plan,
      expiresAt: params.expiresAt,
      licenseKey: params.licenseKey,
      deviceId,
      activatedBy: "activation_key",
    });
    handleUpdateProfile(nextProfile);
    showToast(
      lang === "te"
        ? `యాక్టివేట్ అయింది! (${params.expiresAt} వరకు) ✓`
        : `Subscription Activated until ${params.expiresAt} ✓`,
      "success"
    );
  };

  // Auto-backup to Firebase Cloud on app unlock / session start (only when subscribed)
  useEffect(() => {
    if (unlocked) {
      const accessNow = evaluateSubscriptionAccess({
        profile,
        userEmail: googleUser?.email,
        emailVerified: googleUser?.emailVerified,
      });
      if (accessNow.allowed) {
        checkAndAutoBackup();
      }
    }
  }, [unlocked, profile.subscriptionStatus, googleUser?.uid]);

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

  const handleUpdateOpeningBalance = (dateStr: string, amount: number) => {
    const next = { ...openingBalances, [dateStr]: amount };
    setOpeningBalances(next);
    DB.set(STORAGE_KEYS.CASH_OPENING, next);
    showToast(
      lang === "te" ? "ప్రారంభ నగదు సేవ్ అయింది ✓" : "Opening bag cash updated ✓",
      "success"
    );
  };

  // Auto-clean strictly untouched preview seed data AND grandfather pre-SaaS existing real ledgers (Dad's live app)
  useEffect(() => {
    let wasDemo = false;
    if (isUntouchedDemoData(data, collections, expenses, newLoansLog, personalLog)) {
      wasDemo = true;
      const emptyLedger = { villages: [], borrowers: {} };
      setData(emptyLedger);
      DB.set(STORAGE_KEYS.DATA, emptyLedger);
    }

    if (!profile.subscriptionStatus) {
      const hasExistingRealData =
        !wasDemo &&
        (Object.values(data.borrowers || {}).flat().length > 0 ||
          Object.keys(collections || {}).length > 0 ||
          (expenses || []).length > 0);

      if (hasExistingRealData) {
        // Grandfather pre-existing live lender data (e.g., Dad's phone) as Lifetime Free Family Pass
        const grandfathered = applyActivationToProfile(profile, {
          plan: "lifetime_free",
          expiresAt: "2099-12-31",
          licenseKey: "LEGACY-FAMILY-FREE",
          deviceId,
          activatedBy: "legacy_family",
        });
        setProfile(grandfathered);
        DB.set(STORAGE_KEYS.PROFILE, grandfathered);
      } else {
        // Explicitly lock new / empty installs until subscribed or activated
        const lockedProfile: BusinessProfile = {
          ...profile,
          subscriptionPlan: "unsubscribed",
          subscriptionStatus: "unsubscribed",
          subscriptionExpiresAt: "",
          deviceId,
        };
        setProfile(lockedProfile);
        DB.set(STORAGE_KEYS.PROFILE, lockedProfile);
      }
    }
  }, []);

  // Reset all test / ledger data cleanly (called from Settings -> Start Fresh)
  const handleClearAllData = (options: { includeProfileAndPin?: boolean } = {}) => {
    clearAllAppData(options);
    setData({ villages: [], borrowers: {} });
    setCollections({});
    setExpenses([]);
    setNewLoansLog([]);
    setPersonalLog([]);
    setOpeningBalances({});
    setHasBackup(Boolean(googleUser));
    if (options.includeProfileAndPin) {
      setProfile(DEFAULT_PROFILE);
      setPin("1234");
    }
    showToast(
      lang === "te"
        ? "అన్ని పరీక్షా డేటా తొలగించబడింది — కొత్తగా ప్రారంభించడానికి సిద్ధం ✓"
        : "All test data cleared! Ready for a clean start ✓",
      "success"
    );
  };

  // Sync Theme with document root element
  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [theme]);

  // 1. PIN Lock Screen
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

  // 2. Hard SaaS Subscription Gate — NO operational function works until subscribed or Owner Admin signed in
  const subscriptionAccess = evaluateSubscriptionAccess({
    profile,
    userEmail: googleUser?.email,
    emailVerified: googleUser?.emailVerified,
  });

  if (!subscriptionAccess.allowed) {
    return (
      <>
        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none print:hidden">
            <div
              className={`px-4 py-2 rounded-full font-bold text-xs shadow-xl text-white flex items-center gap-1.5 whitespace-nowrap ${
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
        <SubscriptionPaywall
          profile={profile}
          deviceId={deviceId}
          access={subscriptionAccess}
          lang={lang}
          theme={theme}
          googleUser={googleUser}
          googleSigningIn={googleSigningIn}
          checkingCloudLicense={checkingCloudLicense}
          onToggleLang={handleToggleLang}
          onToggleTheme={handleToggleTheme}
          onLock={() => setUnlocked(false)}
          onActivateKeySuccess={handleActivateKeySuccess}
          onGoogleSignIn={handlePaywallGoogleSignIn}
          onGoogleSignOut={handlePaywallGoogleSignOut}
          onCheckCloudLicense={() => handleCheckCloudLicense(false)}
          showToast={showToast}
        />
      </>
    );
  }

  // 3. Unlocked & Subscribed App Shell (Soft Neumorphic Luxury Fintech Layout)
  return (
    <div
      className={`min-h-screen font-sans flex flex-col justify-between selection:bg-amber-400 selection:text-slate-950 transition-colors ${
        theme === "dark" ? "dark bg-[#0B0F19] text-slate-100" : "bg-[#EDF1F7] text-slate-900"
      }`}
    >
      {/* Toast Alert */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-200 print:hidden">
          <div
            className={`px-4 py-2 rounded-full font-bold text-xs shadow-xl text-white flex items-center gap-1.5 whitespace-nowrap ${
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
      <div className="print:hidden">
        <OfflineIndicator lang={lang} />
      </div>

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
            : tab === "cashbook"
            ? lang === "te"
              ? "రోజువారీ క్యాష్‌బుక్"
              : "Daily Cashbook"
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
      <main className="flex-1 w-full max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto">
        {tab === "home" && (
          <HomeTab
            data={data}
            collections={collections}
            expenses={expenses}
            newLoansLog={newLoansLog}
            personalLog={personalLog}
            profile={profile}
            hasBackup={hasBackup}
            lang={lang}
            theme={theme}
            onNavigateTab={navigateToTab}
            onRecordPersonalUse={handleRecordPersonalUse}
            onUpdateProfile={handleUpdateProfile}
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
          <BorrowersTab
            data={data}
            profile={profile}
            lang={lang}
            onUpdateData={handleUpdateData}
            onAddNewLoanLog={handleAddNewLoanLog}
            onNavigateCollect={() => setTab("collect")}
            showToast={showToast}
          />
        )}

        {tab === "reports" && (
          <ReportsTab
            data={data}
            collections={collections}
            expenses={expenses}
            personalLog={personalLog}
            newLoansLog={newLoansLog}
            openingBalances={openingBalances}
            profile={profile}
            requestedView={reportsViewReq}
            onUpdateProfile={handleUpdateProfile}
            lang={lang}
            onNavigateTab={setTab}
            showToast={showToast}
          />
        )}

        {tab === "calendar" && (
          <CalendarTab
            data={data}
            collections={collections}
            expenses={expenses}
            newLoansLog={newLoansLog}
            personalLog={personalLog}
            profile={profile}
            lang={lang}
            onNavigateTab={setTab}
          />
        )}

        {tab === "calc" && <CalculatorTab lang={lang} />}

        {tab === "cashbook" && (
          <CashbookTab
            collections={collections}
            expenses={expenses}
            newLoansLog={newLoansLog}
            personalLog={personalLog}
            openingBalances={openingBalances}
            onUpdateOpeningBalance={handleUpdateOpeningBalance}
            profile={profile}
            onUpdateProfile={handleUpdateProfile}
            lang={lang}
            showToast={showToast}
          />
        )}

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
            deviceId={deviceId}
            requestedSection={settingsSectionReq}
            onBackupRecorded={() => setHasBackup(true)}
            lang={lang}
            theme={theme}
            onToggleLang={handleToggleLang}
            onToggleTheme={handleToggleTheme}
            onLock={() => setUnlocked(false)}
            onClearAllData={handleClearAllData}
            collectionsCount={Object.keys(collections).length}
            expensesCount={expenses.length}
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
