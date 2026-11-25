import React, { useState, useRef, useEffect } from "react";
import {
  Shield,
  Lock,
  Download,
  Share2,
  Upload,
  Globe,
  Building2,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Crown,
  Sparkles,
  Smartphone,
  ExternalLink,
  Sun,
  Moon,
  Palette,
  Cloud,
  RefreshCw,
  Clock,
  Database,
  MessageCircle,
  MessageSquare,
  PhoneOff,
  Phone,
  Bell,
  BellOff,
  Filter,
  LogOut,
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  Ban,
  BookOpen,
  Calendar,
  Calculator,
} from "lucide-react";
import {
  Village,
  BusinessProfile,
  Language,
  Borrower,
  ThemeMode,
  EmblemType,
  WhatsAppRules,
  DayOfWeek,
  CloudLicenseRecord,
  LoanEntryMode,
} from "../types";
import { translations } from "../translations";
import { ALL_DAYS_MON_FIRST, translateDayName } from "../utils/dateUtils";
import {
  generateBackupPayload,
  downloadBackupFile,
  shareBackupFile,
  restoreBackupPayload,
} from "../utils/storage";
import {
  getWhatsAppRules,
  saveWhatsAppRules,
  isBorrowerKeypad,
} from "../utils/whatsapp";
import {
  OWNER_WHATSAPP_DISPLAY,
  PaidOrFreePlanId,
  SUBSCRIPTION_PLANS,
  applyActivationToProfile,
  buildSubscriptionWhatsAppUrl,
  evaluateSubscriptionAccess,
  generateActivationKey,
  getOrCreateDeviceId,
  isOwnerAdminEmail,
  normalizeDeviceId,
  verifyActivationKey,
} from "../utils/licenseUtils";
import { BusinessEmblem } from "./BusinessEmblem";
import { isNativeAndroidApk } from "../utils/platformUtils";
import {
  uploadCloudBackup,
  getCloudBackupsList,
  restoreFromCloudBackup,
  deleteCloudBackup,
  signInWithGoogle,
  signOutGoogle,
  subscribeAuthState,
  getCurrentGoogleUser,
  grantOrUpdateCloudLicense,
  revokeCloudLicense,
  fetchAllCloudLicenses,
  GoogleVaultUser,
  CloudBackupRecord,
} from "../services/firebaseBackup";
import { usePWAInstall } from "../hooks/usePWAInstall";

export type SettingsSection =
  | "main"
  | "pin"
  | "profile"
  | "villages"
  | "backup"
  | "subscription"
  | "whatsapp"
  | "loan_entry";

interface SettingsTabProps {
  pin: string;
  onUpdatePin: (newPin: string) => void;
  data: { villages: Village[]; borrowers: Record<string, Borrower[]> };
  onUpdateData: (newData: {
    villages: Village[];
    borrowers: Record<string, Borrower[]>;
  }) => void;
  profile: BusinessProfile;
  onUpdateProfile: (newProfile: BusinessProfile) => void;
  deviceId?: string;
  requestedSection?: { section: SettingsSection; nonce: number } | null;
  onBackupRecorded?: () => void;
  lang: Language;
  theme: ThemeMode;
  onToggleLang: () => void;
  onToggleTheme: () => void;
  onLock: () => void;
  onClearAllData?: (options?: { includeProfileAndPin?: boolean }) => void;
  collectionsCount?: number;
  expensesCount?: number;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  pin,
  onUpdatePin,
  data,
  onUpdateData,
  profile,
  onUpdateProfile,
  deviceId: propDeviceId,
  requestedSection,
  onBackupRecorded,
  lang,
  theme,
  onToggleLang,
  onToggleTheme,
  onLock,
  onClearAllData,
  collectionsCount = 0,
  expensesCount = 0,
  showToast,
}) => {
  const resolvedDeviceId = propDeviceId || getOrCreateDeviceId();
  const [activeSection, setActiveSection] = useState<SettingsSection>("main");

  useEffect(() => {
    if (requestedSection) {
      setActiveSection(requestedSection.section);
    }
  }, [requestedSection]);
  const [showClearModal, setShowClearModal] = useState(false);
  const [resetProfileToo, setResetProfileToo] = useState(false);

  // WhatsApp Rules State
  const [waRules, setWaRules] = useState<WhatsAppRules>(() => getWhatsAppRules());
  const [waBorrowerSearch, setWaBorrowerSearch] = useState("");
  const [waBorrowerFilter, setWaBorrowerFilter] = useState<"all" | "keypad" | "receiptDisabled" | "reminderDisabled">("all");

  const updateWaRules = (newRules: WhatsAppRules) => {
    setWaRules(newRules);
    saveWhatsAppRules(newRules);
  };

  // PWA Install Hook
  const { isInstallable, isInstalled, install, isIOS } = usePWAInstall();
  const [showPwaGuide, setShowPwaGuide] = useState(false);

  // PIN Form (Strict 4-digit validation - Fix D1)
  const [oldPin, setOldPin] = useState("");
  const [newPin1, setNewPin1] = useState("");
  const [newPin2, setNewPin2] = useState("");
  const [pinErr, setPinErr] = useState("");

  // Village Form
  const [vName, setVName] = useState("");
  const [vDay, setVDay] = useState<DayOfWeek>("Monday");
  const [deleteVillageConfirm, setDeleteVillageConfirm] = useState<Village | null>(null);

  // Business Profile Form
  const [bizName, setBizName] = useState(profile.businessName);
  const [tagline, setTagline] = useState(profile.tagline);
  const [ownerName, setOwnerName] = useState(profile.ownerName || "");
  const [phone, setPhone] = useState(profile.phone || "");
  const [selectedEmblem, setSelectedEmblem] = useState<EmblemType>(profile.emblem || "ganesha");
  const [brandColor, setBrandColor] = useState(profile.brandColor || "#D97706");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = translations[lang];

  const emblemsList: { id: EmblemType; nameEn: string; nameTe: string }[] = [
    { id: "ganesha", nameEn: "Lord Ganesha", nameTe: "శ్రీ వినాయకుడు" },
    { id: "lakshmi", nameEn: "Goddess Lakshmi", nameTe: "శ్రీ మహాలక్ష్మి" },
    { id: "venkateswara", nameEn: "Lord Venkateswara", nameTe: "శ్రీ బాలాజీ (నామం)" },
    { id: "shiva", nameEn: "Lord Shiva", nameTe: "శివుడు (త్రిశూలం)" },
    { id: "cross", nameEn: "Christian Cross", nameTe: "పవిత్ర సిలువ" },
    { id: "crescent", nameEn: "Crescent & Star", nameTe: "చంద్రవంక & తార" },
    { id: "crown", nameEn: "Royal Crown", nameTe: "రాజ కిరీటం" },
    { id: "tree", nameEn: "Wealth Tree", nameTe: "కల్పవృక్షం" },
  ];

  const brandColors = [
    { label: "Royal Gold", hex: "#D97706" },
    { label: "Sapphire Navy", hex: "#1E3A8A" },
    { label: "Emerald Green", hex: "#059669" },
    { label: "Ruby Crimson", hex: "#DC2626" },
    { label: "Deep Amethyst", hex: "#7C3AED" },
    { label: "Rose Gold", hex: "#BE185D" },
    { label: "Imperial Bronze", hex: "#92400E" },
    { label: "Midnight Slate", hex: "#334155" },
  ];

  // Handle PIN Change (Fix D1)
  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (oldPin !== pin) {
      setPinErr(lang === "te" ? "ప్రస్తుత పిన్ తప్పు" : "Current PIN is incorrect");
      return;
    }
    if (!/^\d{4}$/.test(newPin1)) {
      setPinErr(
        lang === "te"
          ? "కొత్త పిన్ తప్పనిసరిగా 4 అంకెలు మాత్రమే ఉండాలి"
          : "New PIN must be exactly 4 numeric digits"
      );
      return;
    }
    if (newPin1 !== newPin2) {
      setPinErr(lang === "te" ? "పిన్‌లు సరిపోలడం లేదు" : "New PINs do not match");
      return;
    }

    onUpdatePin(newPin1);
    setOldPin("");
    setNewPin1("");
    setNewPin2("");
    setPinErr("");
    setActiveSection("main");
    showToast(
      lang === "te" ? "పిన్ విజయవంతంగా మార్చబడింది ✓" : "PIN changed successfully ✓",
      "success"
    );
  };

  // Handle Village Addition
  const handleAddVillage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vName.trim()) return;

    const newVillage: Village = {
      id: `v${Date.now()}`,
      name: vName.trim(),
      day: vDay,
    };

    onUpdateData({
      ...data,
      villages: [...data.villages, newVillage],
      borrowers: { ...data.borrowers, [newVillage.id]: [] },
    });

    setVName("");
    setVDay("Monday");
    setActiveSection("main");
    showToast(
      lang === "te" ? "కొత్త గ్రామం చేర్చబడింది ✓" : "Village added successfully ✓",
      "success"
    );
  };

  // Handle Village Deletion
  const handleRemoveVillage = (vId: string) => {
    const updatedVillages = data.villages.filter((v) => v.id !== vId);
    const updatedBorrowers = { ...data.borrowers };
    delete updatedBorrowers[vId];

    onUpdateData({
      villages: updatedVillages,
      borrowers: updatedBorrowers,
    });

    setDeleteVillageConfirm(null);
    showToast(lang === "te" ? "గ్రామం తొలగించబడింది" : "Village removed", "info");
  };

  // Handle Business Profile Save
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({
      ...profile,
      businessName: bizName.trim() || "LineBook Pro",
      tagline: tagline.trim() || "Weekly Line Finance",
      ownerName: ownerName.trim(),
      phone: phone.trim(),
      emblem: selectedEmblem,
      brandColor: brandColor,
    });
    setActiveSection("main");
    showToast(
      lang === "te" ? "వ్యాపార ప్రొఫైల్ సేవ్ అయ్యింది ✓" : "Business profile saved ✓",
      "success"
    );
  };

  // 1-Click Backup
  const handleDownloadBackup = () => {
    const payload = generateBackupPayload();
    downloadBackupFile(payload);
    try {
      localStorage.setItem("slg_local_backup_at", new Date().toISOString());
    } catch {}
    onBackupRecorded?.();
    showToast(
      lang === "te" ? "లైన్ బ్యాకప్ డౌన్‌లోడ్ పూర్తయింది ✓" : "Backup downloaded ✓",
      "success"
    );
  };

  const handleShareBackup = async () => {
    const payload = generateBackupPayload();
    await shareBackupFile(payload);
    try {
      localStorage.setItem("slg_local_backup_at", new Date().toISOString());
    } catch {}
    onBackupRecorded?.();
  };

  const handleFileRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const res = restoreBackupPayload(json);
        if (res.success) {
          showToast(res.message, "success");
          setTimeout(() => window.location.reload(), 800);
        } else {
          showToast(res.message, "error");
        }
      } catch {
        showToast("Invalid JSON file", "error");
      }
    };
    reader.readAsText(file);
  };

  // Cloud Backup & Google Auth State & Handlers
  const [googleUser, setGoogleUser] = useState<GoogleVaultUser | null>(() =>
    getCurrentGoogleUser()
  );
  const [googleSigningIn, setGoogleSigningIn] = useState(false);
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<CloudBackupRecord[]>([]);
  const [loadingCloudBackups, setLoadingCloudBackups] = useState(false);
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [cloudUnauthorizedDomain, setCloudUnauthorizedDomain] = useState<string | null>(null);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [lastCloudTime, setLastCloudTime] = useState<string>(
    () => localStorage.getItem("slg_last_cloud_backup") || ""
  );
  const [autoCloudEnabled, setAutoCloudEnabled] = useState<boolean>(
    () => localStorage.getItem("slg_auto_cloud_disabled") !== "true"
  );
  const [confirmRestoreCloud, setConfirmRestoreCloud] = useState<CloudBackupRecord | null>(null);

  // Subscription Key & Owner Admin Console State
  const [renewKeyInput, setRenewKeyInput] = useState("");
  const [renewKeyErr, setRenewKeyErr] = useState("");
  const [copiedDevice, setCopiedDevice] = useState(false);

  const [adminDeviceId, setAdminDeviceId] = useState("");
  const [adminLenderEmail, setAdminLenderEmail] = useState("");
  const [adminBizName, setAdminBizName] = useState("");
  const [adminPlan, setAdminPlan] = useState<PaidOrFreePlanId>("yearly");
  const [adminGeneratedKey, setAdminGeneratedKey] = useState<{
    key: string;
    expiresAt: string;
    deviceId: string;
  } | null>(null);
  const [adminSavingLicense, setAdminSavingLicense] = useState(false);
  const [adminLicenses, setAdminLicenses] = useState<CloudLicenseRecord[]>([]);
  const [loadingAdminLicenses, setLoadingAdminLicenses] = useState(false);
  const [copiedGeneratedKey, setCopiedGeneratedKey] = useState(false);

  const runningInApk = isNativeAndroidApk();

  const isOwnerAdmin = isOwnerAdminEmail(
    googleUser?.email,
    googleUser?.emailVerified
  );

  const subscriptionAccess = evaluateSubscriptionAccess({
    profile,
    userEmail: googleUser?.email,
    emailVerified: googleUser?.emailVerified,
  });

  useEffect(() => {
    const unsubscribe = subscribeAuthState((user) => {
      setGoogleUser(user);
      if (!user) {
        setCloudBackups([]);
        setAdminLicenses([]);
      }
    });
    return unsubscribe;
  }, []);

  const loadAdminLicenses = async () => {
    if (!isOwnerAdminEmail(getCurrentGoogleUser()?.email, getCurrentGoogleUser()?.emailVerified)) {
      return;
    }
    setLoadingAdminLicenses(true);
    try {
      const list = await fetchAllCloudLicenses();
      setAdminLicenses(list);
    } catch (err) {
      console.warn("Could not load admin licenses", err);
    } finally {
      setLoadingAdminLicenses(false);
    }
  };

  useEffect(() => {
    if (activeSection === "subscription" && isOwnerAdmin) {
      void loadAdminLicenses();
    }
  }, [activeSection, isOwnerAdmin]);

  const handleRenewWithKey = (e: React.FormEvent) => {
    e.preventDefault();
    setRenewKeyErr("");
    const check = verifyActivationKey(renewKeyInput, resolvedDeviceId);
    if (!check.valid || !check.plan || !check.expiresAt) {
      setRenewKeyErr(check.error || "Invalid Activation Key");
      return;
    }
    const updated = applyActivationToProfile(profile, {
      plan: check.plan,
      expiresAt: check.expiresAt,
      licenseKey: renewKeyInput.trim().toUpperCase(),
      deviceId: resolvedDeviceId,
      activatedBy: "activation_key",
    });
    onUpdateProfile(updated);
    setRenewKeyInput("");
    showToast(
      lang === "te"
        ? `సబ్‌స్క్రిప్షన్ యాక్టివేట్ అయింది (${check.expiresAt} వరకు) ✓`
        : `License activated until ${check.expiresAt} ✓`,
      "success"
    );
  };

  const handleAdminIssueLicense = async (
    overridePlan?: PaidOrFreePlanId,
    overrideDeviceId?: string,
    overrideBizName?: string
  ) => {
    const targetPlan = overridePlan || adminPlan;
    const rawDev = overrideDeviceId || adminDeviceId || resolvedDeviceId;
    const normDev = normalizeDeviceId(rawDev);
    if (!normDev) {
      showToast("Enter lender's Device ID (e.g. LBP-XXXX-XXXX)", "error");
      return;
    }

    const gen = generateActivationKey(normDev, targetPlan);
    setAdminGeneratedKey({
      key: gen.key,
      expiresAt: gen.expiresAt,
      deviceId: normDev,
    });

    if (isOwnerAdmin) {
      setAdminSavingLicense(true);
      try {
        const res = await grantOrUpdateCloudLicense({
          deviceId: normDev,
          lenderEmail: adminLenderEmail.trim(),
          businessName:
            (overrideBizName || adminBizName).trim() || "LineBook Lender",
          plan: targetPlan,
        });
        if (res.success) {
          showToast(res.message, "success");
          await loadAdminLicenses();
        } else {
          showToast(res.message, "error");
        }
      } catch (err: any) {
        showToast(err?.message || "Failed to save cloud license", "error");
      } finally {
        setAdminSavingLicense(false);
      }
    } else {
      showToast("Offline key generated ✓", "success");
    }
  };

  const handleAdminRevoke = async (licenseId: string) => {
    try {
      const res = await revokeCloudLicense(licenseId);
      if (res.success) {
        showToast(res.message, "info");
        await loadAdminLicenses();
      } else {
        showToast(res.message, "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Failed to revoke license", "error");
    }
  };

  const fetchCloudBackups = async () => {
    if (!getCurrentGoogleUser()?.emailVerified) {
      setCloudBackups([]);
      return;
    }
    setLoadingCloudBackups(true);
    setCloudError(null);
    try {
      const list = await getCloudBackupsList();
      setCloudBackups(list);
    } catch (e: any) {
      console.warn("Failed to load cloud backups", e);
      setCloudError(
        lang === "te"
          ? "క్లౌడ్ రికార్డులు లోడ్ కాలేదు. ఇంటర్నెట్ తనిఖీ చేయండి."
          : "Could not load cloud snapshots. Please check connection."
      );
    } finally {
      setLoadingCloudBackups(false);
    }
  };

  useEffect(() => {
    if (activeSection === "backup") {
      setLastCloudTime(localStorage.getItem("slg_last_cloud_backup") || "");
      if (googleUser?.emailVerified) {
        fetchCloudBackups();
      } else {
        setCloudBackups([]);
      }
    }
  }, [activeSection, googleUser?.uid]);

  const handleGoogleSignIn = async () => {
    setGoogleSigningIn(true);
    setCloudError(null);
    setCloudUnauthorizedDomain(null);
    try {
      const res = await signInWithGoogle();
      if (res.success && res.user) {
        setGoogleUser(res.user);
        setCloudError(null);
        setCloudUnauthorizedDomain(null);
        showToast(
          lang === "te"
            ? `${res.user.email} తో క్లౌడ్ కనెక్ట్ అయింది ✓`
            : res.message,
          "success"
        );
      } else {
        setCloudError(res.message);
        setCloudUnauthorizedDomain(res.unauthorizedDomain || null);
        showToast(res.message, "error");
      }
    } finally {
      setGoogleSigningIn(false);
    }
  };

  const handleCopyAuthDomain = async (domain: string) => {
    try {
      await navigator.clipboard.writeText(domain);
      setCopiedDomain(true);
      showToast(
        lang === "te" ? `డొమైన్ కాపీ అయింది: ${domain} ✓` : `Copied domain: ${domain} ✓`,
        "info"
      );
      setTimeout(() => setCopiedDomain(false), 2000);
    } catch {
      showToast(domain, "info");
    }
  };

  const handleGoogleSignOut = async () => {
    await signOutGoogle();
    setGoogleUser(null);
    setCloudBackups([]);
    setCloudError(null);
    setCloudUnauthorizedDomain(null);
    showToast(
      lang === "te"
        ? "క్లౌడ్ ఖాతా లాగ్‌అవుట్ అయింది (స్థానిక డేటా సురక్షితం)"
        : "Signed out of Cloud Vault (local ledger untouched)",
      "info"
    );
  };

  const handleSyncCloud = async () => {
    setCloudSyncing(true);
    setCloudError(null);
    try {
      const res = await uploadCloudBackup(false);
      if (res.success) {
        showToast(
          lang === "te"
            ? "క్లౌడ్ బ్యాకప్ విజయవంతంగా సేవ్ అయ్యింది ✓"
            : "Cloud backup synced successfully ✓",
          "success"
        );
        setLastCloudTime(res.exportedAt || new Date().toISOString());
        onBackupRecorded?.();
        await fetchCloudBackups();
      } else {
        showToast(res.message, "error");
      }
    } catch (err: any) {
      showToast(err?.message || "Cloud sync error", "error");
    } finally {
      setCloudSyncing(false);
    }
  };

  const handleToggleAutoCloud = () => {
    const nextVal = !autoCloudEnabled;
    setAutoCloudEnabled(nextVal);
    if (nextVal) {
      localStorage.removeItem("slg_auto_cloud_disabled");
      showToast(
        lang === "te" ? "ఆటో క్లౌడ్ బ్యాకప్ ప్రారంభించబడింది ✓" : "Auto Cloud Backup enabled ✓",
        "success"
      );
    } else {
      localStorage.setItem("slg_auto_cloud_disabled", "true");
      showToast(
        lang === "te" ? "ఆటో క్లౌడ్ బ్యాకప్ నిలిపివేయబడింది" : "Auto Cloud Backup disabled",
        "info"
      );
    }
  };

  const handleRestoreCloud = async (record: CloudBackupRecord) => {
    try {
      const res = await restoreFromCloudBackup(record);
      if (res.success) {
        showToast(
          lang === "te"
            ? "క్లౌడ్ నుండి విజయవంతంగా రీస్టోర్ అయ్యింది ✓"
            : "Restored successfully from Cloud ✓",
          "success"
        );
        setConfirmRestoreCloud(null);
        setTimeout(() => window.location.reload(), 800);
      } else {
        showToast(res.message, "error");
      }
    } catch (e: any) {
      showToast(e?.message || "Failed to restore cloud snapshot", "error");
    }
  };

  const handleDeleteCloudSnapshot = async (backupId: string) => {
    try {
      const ok = await deleteCloudBackup(backupId);
      if (ok) {
        setCloudBackups((prev) => prev.filter((b) => b.backupId !== backupId));
        showToast(
          lang === "te" ? "క్లౌడ్ స్నాప్‌షాట్ తొలగించబడింది" : "Cloud snapshot deleted",
          "info"
        );
      } else {
        showToast("Failed to delete snapshot", "error");
      }
    } catch (e: any) {
      showToast(e?.message || "Failed to delete snapshot", "error");
    }
  };

  return (
    <div className="pb-28 px-4 pt-3 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto space-y-4">
      {/* Prominent Back Button on all sub-sections */}
      {activeSection !== "main" && (
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => setActiveSection("main")}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-all"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {activeSection === "subscription"
                ? lang === "te"
                  ? "సాఫ్ట్‌వేర్ ప్లాన్లు"
                  : "Software Plans"
                : activeSection === "whatsapp"
                ? lang === "te"
                  ? "వాట్సాప్ నియమాలు & ఆటోమేషన్"
                  : "WhatsApp Rules & Automation"
                : activeSection === "backup"
                ? lang === "te"
                  ? "బ్యాకప్ & రీస్టోర్"
                  : "Backup & Restore"
                : activeSection === "pin"
                ? lang === "te"
                  ? "పిన్ మార్చండి"
                  : "Change PIN"
                : activeSection === "villages"
                ? lang === "te"
                  ? "లైన్ గ్రామాలు"
                  : "Line Villages"
                : activeSection === "loan_entry"
                ? lang === "te"
                  ? "లోన్ నమోదు విధానం"
                  : "Loan Entry Method"
                : lang === "te"
                ? "వ్యాపార ప్రొఫైల్ & లోగో"
                : "Business Profile & Logo"}
            </h2>
            <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">
              {lang === "te" ? "సెట్టింగ్స్ మెనూ కి తిరిగి వెళ్ళండి" : "Tap back to return"}
            </p>
          </div>
        </div>
      )}

      {/* MAIN SETTINGS MENU */}
      {activeSection === "main" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Software Plan Banner */}
          <button
            type="button"
            onClick={() => setActiveSection("subscription")}
            className="md:col-span-2 text-left rounded-3xl p-5 cursor-pointer bg-gradient-to-br from-[#0B1728] via-[#13294B] to-[#0A121E] text-white border border-amber-400/50 hover:border-amber-400 transition-all flex items-center justify-between gap-3 shadow-md"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
                <Crown className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300">
                    {lang === "te" ? "వాణిజ్య సాఫ్ట్‌వేర్ సభ్యత్వం" : "SaaS Subscription"}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[9px] font-black uppercase">
                    {subscriptionAccess.isOwner
                      ? "OWNER ADMIN"
                      : subscriptionAccess.reason === "lifetime_free"
                      ? "FREE PASS"
                      : `ACTIVE · ${subscriptionAccess.daysRemaining ?? 0}d`}
                  </span>
                </div>
                <h3 className="text-lg font-black text-white leading-tight mt-0.5">
                  LineBook Pro
                </h3>
                <p className="text-[11px] font-medium text-slate-200 mt-0.5">
                  6 Months (₹1,599) · 12 Months (₹2,599) · Custom App (₹4,999+)
                </p>
              </div>
            </div>
            <div className="min-h-[36px] px-4 py-1.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow-sm shrink-0 flex items-center">
              {isOwnerAdmin
                ? lang === "te"
                  ? "అడ్మిన్"
                  : "Manage"
                : lang === "te"
                ? "ప్లాన్లు"
                : "Plans"}
            </div>
          </button>

          {/* Dark / Light Mode Toggle Card */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="text-left min-h-[72px] rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 dark:bg-amber-500/20 text-amber-300 dark:text-amber-300 flex items-center justify-center shrink-0">
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {lang === "te" ? "డిస్ప్లే థీమ్ (Theme)" : "Appearance & Theme"}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {theme === "dark"
                    ? lang === "te"
                      ? "డార్క్ మోడ్ యాక్టివ్ (రాత్రి లైన్)"
                      : "Dark Mode Active (Night Line)"
                    : lang === "te"
                    ? "లైట్ మోడ్ యాక్టివ్ (పగలు)"
                    : "Light Mode Active (Daylight)"}
                </p>
              </div>
            </div>
            <span className="font-bold text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 shrink-0">
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </span>
          </button>

          {/* Quick Language Toggle */}
          <button
            type="button"
            onClick={onToggleLang}
            className="text-left min-h-[72px] rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {lang === "te" ? "యాప్ భాష (Language)" : "Language"}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {lang === "en" ? "English active" : "తెలుగు యాక్టివ్"}
                </p>
              </div>
            </div>
            <span className="font-bold text-xs px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-blue-900 dark:text-blue-300 border border-slate-200 dark:border-slate-700 shrink-0">
              {lang === "en" ? "తెలుగుకి మార్చండి" : "Switch to English"}
            </span>
          </button>

          {/* Business / Line Name */}
          <button
            type="button"
            onClick={() => setActiveSection("profile")}
            className="text-left min-h-[72px] rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-amber-400/50 dark:border-amber-500/30 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-amber-500 transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center p-1.5 shrink-0">
                <BusinessEmblem emblem={profile.emblem || "ganesha"} size={26} color={profile.brandColor || "#D97706"} />
              </div>
              <div className="min-w-0">
                <h4
                  className="font-black text-sm truncate"
                  style={{ color: profile.brandColor || "#D97706" }}
                >
                  {profile.businessName || "LineBook Pro"}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                  {lang === "te"
                    ? "మీ లైన్ పేరు, లోగో & రశీదు వివరాలు మార్చండి"
                    : "Business / Line Name, Emblem & Brand Color"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                {lang === "te" ? "మార్చండి" : "Edit"}
              </span>
              <span className="text-slate-400">›</span>
            </div>
          </button>

          {/* Line Villages */}
          <button
            type="button"
            onClick={() => setActiveSection("villages")}
            className="text-left min-h-[72px] rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {lang === "te" ? "లైన్ గ్రామాలు (Line Villages)" : "Line Villages"}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                  {data.villages.length} {lang === "te" ? "గ్రామాలు నమోదయ్యాయి" : "villages active"} ·{" "}
                  {profile.lineDaysMode === "daily"
                    ? lang === "te"
                      ? "ప్రతి రోజు"
                      : "Daily"
                    : (profile.lineDays || ["Monday", "Tuesday"]).map((d) => d.slice(0, 3)).join(", ")}
                </p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </button>

          {/* Daily Cashbook Enable / Disable Toggle */}
          <div className="min-h-[72px] rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 flex items-center justify-center shrink-0">
                <BookOpen className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {lang === "te" ? "రోజువారీ క్యాష్‌బుక్ (Daily Cashbook)" : "Daily Cashbook"}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                  {profile.enableDailyCashbook !== false
                    ? lang === "te"
                      ? "హోమ్ & రిపోర్టులలో యాక్టివ్‌గా ఉంది"
                      : "Shown on Home & Reports (Tap to disable)"
                    : lang === "te"
                    ? "ప్రస్తుతం ఆఫ్‌లో ఉంది (రికార్డులు సురక్షితం)"
                    : "Disabled (Hidden from Home & Reports)"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const nextEnabled = profile.enableDailyCashbook === false;
                onUpdateProfile({ ...profile, enableDailyCashbook: nextEnabled });
                showToast(
                  nextEnabled
                    ? lang === "te"
                      ? "రోజువారీ క్యాష్‌బుక్ ఆన్ చేయబడింది ✓"
                      : "Daily Cashbook enabled ✓"
                    : lang === "te"
                    ? "రోజువారీ క్యాష్‌బుక్ ఆఫ్ చేయబడింది"
                    : "Daily Cashbook disabled",
                  nextEnabled ? "success" : "info"
                );
              }}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl font-extrabold text-xs shrink-0 cursor-pointer transition-all ${
                profile.enableDailyCashbook !== false
                  ? "bg-teal-600 text-white hover:bg-teal-700"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              }`}
            >
              {profile.enableDailyCashbook !== false
                ? lang === "te"
                  ? "ఆన్ (ON)"
                  : "Enabled"
                : lang === "te"
                ? "ఆఫ్ (OFF)"
                : "Disabled"}
            </button>
          </div>

          {/* Loan Entry Method (3 Types) */}
          <button
            type="button"
            onClick={() => setActiveSection("loan_entry")}
            className="text-left min-h-[72px] rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-indigo-500 transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Calculator className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {lang === "te" ? "లోన్ నమోదు విధానం" : "Loan Entry Method"}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                  {(profile.loanEntryMode || "principal_total") === "principal_interest"
                    ? lang === "te"
                      ? "అసలు + వడ్డీ % + వారాలు"
                      : "Loan Amount + Interest % + Weeks"
                    : (profile.loanEntryMode || "principal_total") === "total_only"
                    ? lang === "te"
                      ? "చెల్లించాల్సిన మొత్తం + వారాలు మాత్రమే"
                      : "Total Amount to Pay + Weeks Only"
                    : lang === "te"
                    ? "అసలు + చెల్లించాల్సిన మొత్తం + వారాలు"
                    : "Loan Amount + Total to Pay + Weeks"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
                {lang === "te" ? "మార్చండి" : "Choose"}
              </span>
              <span className="text-slate-400">›</span>
            </div>
          </button>

          {/* WhatsApp Rules & Automation */}
          <button
            type="button"
            onClick={() => setActiveSection("whatsapp")}
            className="text-left min-h-[72px] rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-emerald-500 transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span className="truncate">
                    {lang === "te" ? "వాట్సాప్ ఆటోమేషన్ & నియమాలు" : "WhatsApp Automation & Rules"}
                  </span>
                  {!waRules.masterEnabled && (
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold shrink-0">
                      Off
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                  {lang === "te"
                    ? "ఆటో-రశీదులు, 2-రోజుల రిమైండర్లు & కీప్యాడ్ ఫోన్లు"
                    : "Auto-receipts, 2-day advance reminders & keypad mobiles"}
                </p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </button>

          {/* Backup & Restore */}
          <button
            type="button"
            onClick={() => setActiveSection("backup")}
            className="text-left min-h-[72px] rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-blue-500 transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>
                    {runningInApk
                      ? lang === "te"
                        ? "బ్యాకప్ & రీస్టోర్ (Drive / ఫైల్)"
                        : "Backup & Restore (Drive / JSON)"
                      : lang === "te"
                      ? "క్లౌడ్ బ్యాకప్ & రీస్టోర్"
                      : "Cloud Backup & Restore"}
                  </span>
                  {googleUser && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold shrink-0">
                      Google ✓
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                  {googleUser
                    ? googleUser.email
                    : runningInApk
                    ? lang === "te"
                      ? "WhatsApp, Google Drive లేదా JSON ఫైల్‌కు సేవ్ చేయండి"
                      : "Save to Google Drive, WhatsApp or JSON File"
                    : lang === "te"
                    ? "కొత్త ఫోన్‌కు Google సైన్-ఇన్ ద్వారా సింక్ చేయండి"
                    : "Sign in with Google for Cross-Phone Sync & JSON"}
                </p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </button>

          {/* Install Mobile App (PWA) / APK Status */}
          <button
            type="button"
            onClick={async () => {
              if (runningInApk) {
                showToast(
                  lang === "te"
                    ? `${profile.businessName || "LineBook Pro"} Android APK లో 100% ఆఫ్‌లైన్ రన్ అవుతోంది ✓`
                    : `${profile.businessName || "LineBook Pro"} Android APK is installed & 100% offline ready ✓`,
                  "info"
                );
              } else if (isInstalled) {
                showToast(
                  lang === "te"
                    ? "యాప్ మీ ఫోన్‌లో ఇన్‌స్టాల్ చేయబడింది! 100% ఆఫ్‌లైన్ పనిచేస్తుంది."
                    : "App is already installed on this device! Runs 100% offline.",
                  "info"
                );
              } else if (isInstallable) {
                const res = await install();
                if (res) {
                  showToast(
                    lang === "te"
                      ? `${profile.businessName || "LineBook Pro"} యాప్ హోమ్‌స్క్రీన్‌కు జోడించబడింది!`
                      : `${profile.businessName || "LineBook Pro"} added to Home Screen!`,
                    "success"
                  );
                }
              } else {
                setShowPwaGuide(true);
              }
            }}
            className="text-left min-h-[72px] rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-amber-400/50 dark:border-amber-500/30 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-amber-500 transition-all"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>
                    {runningInApk
                      ? lang === "te"
                        ? "Android APK యాప్"
                        : "Android App (APK)"
                      : lang === "te"
                      ? "మొబైల్ యాప్ (PWA)"
                      : "Install Mobile App (PWA)"}
                  </span>
                  {(runningInApk || isInstalled) && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3 h-3" />
                      {runningInApk
                        ? "APK Active"
                        : lang === "te"
                        ? "ఇన్‌స్టాల్ అయింది"
                        : "Installed"}
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                  {runningInApk || isInstalled
                    ? lang === "te"
                      ? "100% ఆఫ్‌లైన్ విలేజ్ మోడ్ సపోర్ట్"
                      : "Runs 100% offline in remote villages"
                    : lang === "te"
                    ? "హోమ్‌స్క్రీన్‌పై యాప్‌లాగా ఇన్‌స్టాల్ చేయండి"
                    : "Add to home screen for 100% offline access"}
                </p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </button>

          {/* Change PIN */}
          <button
            type="button"
            onClick={() => setActiveSection("pin")}
            className="text-left min-h-[72px] rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-slate-400 dark:hover:border-slate-600 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {lang === "te" ? "లాక్ పిన్ మార్చండి" : "Change Security PIN"}
                </h4>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {lang === "te" ? "ఖచ్చితంగా 4 అంకెల పిన్" : "Strictly 4 numeric digits"}
                </p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </button>

          {/* Start Fresh / Clear All Data */}
          {onClearAllData && (
            <button
              type="button"
              onClick={() => setShowClearModal(true)}
              className="md:col-span-2 text-left min-h-[72px] rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-red-200 dark:border-red-900/50 shadow-sm flex items-center justify-between gap-3 cursor-pointer hover:border-red-400 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-red-700 dark:text-red-400">
                    {lang === "te" ? "అన్ని పరీక్ష డేటా తొలగించండి (Start Fresh)" : "Clear All Data / Start Fresh"}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    {lang === "te"
                      ? "గ్రామాలు, ఖాతాదారులు & టెస్ట్ వసూళ్లను క్లియర్ చేయండి"
                      : "Wipe preview/test villages, borrowers & collections"}
                  </p>
                </div>
              </div>
              <span className="text-slate-400">›</span>
            </button>
          )}

          {/* Lock App Now Button */}
          <button
            type="button"
            onClick={onLock}
            className="md:col-span-2 w-full min-h-[48px] py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 dark:bg-rose-950/70 dark:hover:bg-rose-900/80 border border-slate-800 dark:border-rose-800/70 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all shadow-sm"
          >
            <Lock className="w-4 h-4" />
            <span>
              {lang === "te" ? "యాప్ లాక్ చేయండి" : "Lock Application Now"}
            </span>
          </button>

          {/* LineBook Pro Commercial Version & Device Footer */}
          <div className="md:col-span-2 rounded-2xl p-4 bg-white/80 dark:bg-[#131B2E]/80 border border-slate-200 dark:border-slate-800 text-center space-y-1">
            <div className="text-xs font-black text-slate-800 dark:text-slate-100">
              LineBook Pro · v4.0
            </div>
            <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400">
              {lang === "te"
                ? "100% ఆఫ్‌లైన్ విలేజ్ మోడ్ · క్లౌడ్ & ఫైల్ వాల్ట్ సిద్ధం"
                : "100% Offline-First Line OS · Cloud & Local Vault Ready"}
            </div>
            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 select-all">
              ID: {resolvedDeviceId}
            </div>
          </div>
        </div>
      )}

      {/* SUBSCRIPTION PLANS, LICENSE STATUS & OWNER ADMIN CONSOLE */}
      {activeSection === "subscription" && (
        <div className="space-y-4">
          {/* 1. Active License Status & Device ID Card */}
          <div className="rounded-3xl p-5 bg-gradient-to-br from-[#0B1728] via-[#13294B] to-[#0A121E] text-white border border-amber-400/40 shadow-md space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-400/40 text-amber-300 flex items-center justify-center shrink-0">
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
                    {lang === "te" ? "ప్రస్తుత లైసెన్స్ స్థితి" : "Current License Status"}
                  </span>
                  <h3 className="text-lg font-black text-white">
                    {subscriptionAccess.planLabel}
                  </h3>
                  <p className="text-xs text-slate-200 mt-0.5">
                    {subscriptionAccess.isOwner
                      ? lang === "te"
                        ? "యాజమాని అడ్మిన్ యాక్సెస్ (పూర్తి నియంత్రణ)"
                        : "Verified Owner Admin Account"
                      : subscriptionAccess.reason === "lifetime_free"
                      ? lang === "te"
                        ? "జీవితకాల ఉచిత ఫ్యామిలీ పాస్ యాక్టివ్ ✓"
                        : "Lifetime Free Family Pass Active ✓"
                      : `${
                          lang === "te" ? "గడువు తేదీ:" : "Valid until"
                        } ${subscriptionAccess.expiresAt} (${
                          subscriptionAccess.daysRemaining ?? 0
                        } ${lang === "te" ? "రోజులు మిగిలాయి" : "days left"})`}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-black uppercase shrink-0">
                ACTIVE ✓
              </span>
            </div>

            <div className="rounded-2xl bg-black/35 border border-white/15 p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                  {lang === "te" ? "ఈ ఫోన్ డివైస్ ఐడీ" : "Device ID"}
                </span>
                <span className="font-mono font-black text-sm text-amber-300 select-all">
                  {resolvedDeviceId}
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(resolvedDeviceId);
                    setCopiedDevice(true);
                    setTimeout(() => setCopiedDevice(false), 1800);
                  } catch {
                    showToast(resolvedDeviceId, "info");
                  }
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer shrink-0"
              >
                {copiedDevice ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDevice ? "Copied" : "Copy"}</span>
              </button>
            </div>

            {/* Renew / Update Activation Key Form */}
            <form onSubmit={handleRenewWithKey} className="pt-1 space-y-2">
              <label
                htmlFor="settings-renew-key"
                className="block text-[10px] font-bold uppercase tracking-wider text-slate-300"
              >
                {lang === "te"
                  ? "కొత్త యాక్టివేషన్ కీతో రీన్యూ చేయండి"
                  : "Activate / Renew With Key"}
              </label>
              <div className="flex gap-2">
                <input
                  id="settings-renew-key"
                  type="text"
                  value={renewKeyInput}
                  onChange={(e) => {
                    setRenewKeyInput(e.target.value.toUpperCase());
                    setRenewKeyErr("");
                  }}
                  placeholder="SLG-12M-YYYYMMDD-XXXXXXXX"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-black/40 border border-white/20 text-white placeholder-slate-400 font-mono text-xs uppercase focus:outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{lang === "te" ? "యాక్టివేట్" : "Apply"}</span>
                </button>
              </div>
              {renewKeyErr && (
                <p className="text-[11px] font-bold text-rose-300">{renewKeyErr}</p>
              )}
            </form>
          </div>

          {/* 2. OWNER ADMIN LICENSE CONSOLE (Strictly visible ONLY to verified reswanth6789@gmail.com) */}
          {isOwnerAdmin && (
            <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border-2 border-emerald-500/60 shadow-md space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                      Owner SaaS Control
                    </span>
                    <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                      Issue Lender Subscription / Free Pass
                    </h4>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void loadAdminLicenses()}
                  disabled={loadingAdminLicenses}
                  className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                  title="Refresh Licenses"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${loadingAdminLicenses ? "animate-spin" : ""}`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Lender Device ID *
                  </label>
                  <input
                    type="text"
                    value={adminDeviceId}
                    onChange={(e) => setAdminDeviceId(e.target.value.toUpperCase())}
                    placeholder="LBP-XXXX-XXXX"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Plan Duration
                  </label>
                  <select
                    value={adminPlan}
                    onChange={(e) => setAdminPlan(e.target.value as PaidOrFreePlanId)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold"
                  >
                    <option value="half_yearly">6 Months Plan (₹1,599)</option>
                    <option value="yearly">12 Months Plan (₹2,599)</option>
                    <option value="custom_app">Custom App (₹4,999+)</option>
                    <option value="lifetime_free">Dad / Family Free Pass (₹0 Forever)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Lender Business Name
                  </label>
                  <input
                    type="text"
                    value={adminBizName}
                    onChange={(e) => setAdminBizName(e.target.value)}
                    placeholder="e.g. Sri Venkateswara Finance"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                    Lender Google Email (Optional Cloud Sync)
                  </label>
                  <input
                    type="email"
                    value={adminLenderEmail}
                    onChange={(e) => setAdminLenderEmail(e.target.value)}
                    placeholder="lender@gmail.com"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={adminSavingLicense}
                  onClick={() => void handleAdminIssueLicense()}
                  className="flex-1 min-h-[42px] py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>
                    {adminSavingLicense
                      ? "Saving Cloud License..."
                      : "Generate Key & Save to Cloud"}
                  </span>
                </button>
                <button
                  type="button"
                  disabled={adminSavingLicense}
                  onClick={() =>
                    void handleAdminIssueLicense(
                      "lifetime_free",
                      adminDeviceId || resolvedDeviceId,
                      adminBizName || "Sri Lakshmi Ganapati (Dad)"
                    )
                  }
                  className="min-h-[42px] py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Issue Dad / Family Free Pass</span>
                </button>
              </div>

              {adminGeneratedKey && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-300 dark:border-emerald-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Generated Key for {adminGeneratedKey.deviceId} (Exp:{" "}
                      {adminGeneratedKey.expiresAt})
                    </span>
                  </div>
                  <div className="font-mono font-black text-xs sm:text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 select-all">
                    {adminGeneratedKey.key}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(adminGeneratedKey.key);
                        setCopiedGeneratedKey(true);
                        setTimeout(() => setCopiedGeneratedKey(false), 1800);
                      }}
                      className="flex-1 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer"
                    >
                      {copiedGeneratedKey ? (
                        <Check className="w-3.5 h-3.5" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>{copiedGeneratedKey ? "Key Copied ✓" : "Copy Key"}</span>
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(
                        `LineBook Pro Activated!\nDevice ID: ${adminGeneratedKey.deviceId}\nValid Until: ${adminGeneratedKey.expiresAt}\n\nActivation Key:\n${adminGeneratedKey.key}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Send via WhatsApp</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Issued Cloud Licenses List */}
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <h5 className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Cloud Licenses ({adminLicenses.length})
                </h5>
                {adminLicenses.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    No cloud licenses issued yet.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {adminLicenses.map((lic) => (
                      <div
                        key={lic.licenseId}
                        className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-xs text-slate-900 dark:text-white">
                              {lic.deviceId}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                lic.status === "active"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                              }`}
                            >
                              {lic.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                            {lic.businessName} ·{" "}
                            {SUBSCRIPTION_PLANS[lic.plan]?.nameEn || lic.plan} · Exp:{" "}
                            {lic.expiresAt}
                          </div>
                          {lic.lenderEmail && (
                            <div className="text-[10px] text-slate-500 truncate">
                              {lic.lenderEmail}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={async () => {
                              await navigator.clipboard.writeText(lic.activationKey);
                              showToast("Key copied ✓", "info");
                            }}
                            className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                            title="Copy Activation Key"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {lic.status === "active" && (
                            <button
                              type="button"
                              onClick={() => void handleAdminRevoke(lic.licenseId)}
                              className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-300 cursor-pointer"
                              title="Revoke License"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. COMMERCIAL SAAS PLANS (6 Months ₹1,599 · 12 Months ₹2,599 · Custom App ₹4,999+) */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                {lang === "te" ? "లైన్‌బుక్ ప్రో ప్లాన్లు" : "LineBook Pro Commercial Plans"}
              </h3>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                {OWNER_WHATSAPP_DISPLAY}
              </span>
            </div>

            {/* PLAN 1: 6 MONTHS PLAN (₹1,599) */}
            <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border-2 border-slate-300/80 dark:border-slate-700 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {lang === "te" ? "6 నెలల లైసెన్స్" : "Half-Yearly License"}
                  </span>
                  <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {lang === "te"
                      ? SUBSCRIPTION_PLANS.half_yearly.nameTe
                      : SUBSCRIPTION_PLANS.half_yearly.nameEn}
                  </h4>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                    {SUBSCRIPTION_PLANS.half_yearly.priceLabel}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {lang === "te"
                      ? SUBSCRIPTION_PLANS.half_yearly.periodLabelTe
                      : SUBSCRIPTION_PLANS.half_yearly.periodLabelEn}
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {lang === "te"
                      ? "అపరిమిత గ్రామాలు & ఖాతాదారులు (రోజు/వారం/నెల)"
                      : "Unlimited Borrowers & Villages (Daily / Weekly / Monthly)"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {lang === "te"
                      ? "1-ట్యాప్ వాట్సాప్ రశీదులు & 2 రోజుల రిమైండర్లు"
                      : "1-Tap WhatsApp Payment Receipts & 2-Day Reminders"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {lang === "te"
                      ? "రోజువారీ క్యాష్‌బుక్, పాస్‌బుక్, PDF & CSV రిపోర్టులు"
                      : "Daily Cashbook, Passbook, PDF & CSV Reports"}
                  </span>
                </div>
              </div>

              <a
                href={buildSubscriptionWhatsAppUrl({
                  plan: "half_yearly",
                  deviceId: resolvedDeviceId,
                  businessName: profile.businessName,
                  googleEmail: googleUser?.email,
                  lang,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-2xl bg-[#1E3A8A] text-white font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-900 mt-2 shadow-sm"
              >
                <span>
                  {lang === "te"
                    ? "6 నెలల ప్లాన్ ఎంచుకోండి (₹1,599)"
                    : "Select 6 Months Plan (₹1,599)"}
                </span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* PLAN 2: 12 MONTHS PLAN (₹2,599 · BEST VALUE) */}
            <div className="rounded-3xl p-5 border-2 border-amber-400 bg-white dark:bg-[#131B2E] space-y-3 relative shadow-md">
              <span className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] tracking-wider uppercase shadow-xs">
                {lang === "te"
                  ? SUBSCRIPTION_PLANS.yearly.badgeTe
                  : SUBSCRIPTION_PLANS.yearly.badgeEn}
              </span>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    {lang === "te" ? "పూర్తి వార్షిక లైసెన్స్" : "Annual Full License"}
                  </span>
                  <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {lang === "te"
                      ? SUBSCRIPTION_PLANS.yearly.nameTe
                      : SUBSCRIPTION_PLANS.yearly.nameEn}
                  </h4>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {SUBSCRIPTION_PLANS.yearly.priceLabel}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {lang === "te"
                      ? SUBSCRIPTION_PLANS.yearly.periodLabelTe
                      : SUBSCRIPTION_PLANS.yearly.periodLabelEn}
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {lang === "te"
                      ? "6 నెలల అన్ని ఫీచర్లు + Google క్లౌడ్ బ్యాకప్"
                      : "Everything in 6 Months Plan + Google Cloud Backup"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {lang === "te"
                      ? `ప్రియారిటీ వాట్సాప్ సపోర్ట్ (${OWNER_WHATSAPP_DISPLAY})`
                      : `Priority WhatsApp VIP Support (${OWNER_WHATSAPP_DISPLAY})`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    {lang === "te"
                      ? "అర్ధ-సంవత్సర ప్లాన్‌తో పోలిస్తే ₹599 ఆదా"
                      : "Save ₹599 compared to 2 half-yearly renewals"}
                  </span>
                </div>
              </div>

              <a
                href={buildSubscriptionWhatsAppUrl({
                  plan: "yearly",
                  deviceId: resolvedDeviceId,
                  businessName: profile.businessName,
                  googleEmail: googleUser?.email,
                  lang,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md mt-2"
              >
                <span>
                  {lang === "te"
                    ? "12 నెలల ప్లాన్ ఎంచుకోండి (₹2,599)"
                    : "Select 12 Months Plan (₹2,599)"}
                </span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* PLAN 3: CUSTOM APP PLAN (₹4,999+) */}
            <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border-2 border-purple-300 dark:border-purple-800 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">
                    {lang === "te" ? "ప్రత్యేక కస్టమ్ యాప్" : "Bespoke Engineered"}
                  </span>
                  <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    {lang === "te"
                      ? SUBSCRIPTION_PLANS.custom_app.nameTe
                      : SUBSCRIPTION_PLANS.custom_app.nameEn}
                  </h4>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-purple-700 dark:text-purple-400">
                    {SUBSCRIPTION_PLANS.custom_app.priceLabel}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {lang === "te"
                      ? SUBSCRIPTION_PLANS.custom_app.periodLabelTe
                      : "One-Time Setup + 1 Yr"}
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>
                    {lang === "te"
                      ? "మీ ఫైనాన్స్ పేరు, డొమైన్ & ప్రత్యేక యాప్ లోగో"
                      : "Custom Business Name, Domain & Unique App Icon"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>
                    {lang === "te"
                      ? "మీ వ్యాపారానికి తగిన ప్రత్యేక ఫీల్డ్స్ & నియమాలు"
                      : "Add Custom Fields & Loan Rules by Lender Request"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>
                    {lang === "te"
                      ? `డెవలపర్‌తో డైరెక్ట్ వాట్సాప్ సపోర్ట్ (${OWNER_WHATSAPP_DISPLAY})`
                      : `Direct Developer WhatsApp Support (${OWNER_WHATSAPP_DISPLAY})`}
                  </span>
                </div>
              </div>

              <a
                href={buildSubscriptionWhatsAppUrl({
                  plan: "custom_app",
                  deviceId: resolvedDeviceId,
                  businessName: profile.businessName,
                  googleEmail: googleUser?.email,
                  lang,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 mt-2 shadow-sm"
              >
                <span>
                  {lang === "te"
                    ? "వాట్సాప్‌లో కస్టమ్ యాప్ కోరండి (₹4,999+)"
                    : "Request Custom App on WhatsApp (₹4,999+)"}
                </span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

      {/* BACKUP & RESTORE SECTION */}
      {activeSection === "backup" && (
        <div className="space-y-4">
          {/* 1. Google Sign-In Firebase Cloud Vault Card */}
          <div className="rounded-3xl p-5 bg-gradient-to-br from-blue-900/10 via-sky-500/5 to-transparent dark:from-blue-950/40 dark:via-sky-950/20 bg-white dark:bg-[#131B2E] border-2 border-blue-500/40 dark:border-blue-500/30 space-y-4 shadow-sm relative overflow-hidden">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                  <Cloud className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-slate-900 dark:text-slate-100 text-sm sm:text-base leading-snug">
                    {lang === "te" ? "Google క్లౌడ్ వాల్ట్ సింక్" : "Google Cloud Vault"}
                  </h3>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold leading-snug">
                    {lang === "te" ? "ఫోన్ మారినా డేటా సురక్షితం" : "Cross-Phone Cloud Sync"}
                  </p>
                </div>
              </div>
              {googleUser ? (
                <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-black flex items-center gap-1.5 border border-emerald-500/30 shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  SYNC ON
                </span>
              ) : runningInApk ? (
                <span className="px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 text-[10px] font-black border border-blue-200 dark:border-blue-800 shrink-0">
                  APK MODE
                </span>
              ) : (
                <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px] font-black border border-slate-200 dark:border-slate-700 shrink-0">
                  LOCAL ONLY
                </span>
              )}
            </div>

            {!googleUser ? (
              runningInApk ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/70 space-y-2">
                    <div className="text-xs font-black text-blue-950 dark:text-blue-200">
                      {lang === "te"
                        ? "Android APK లో Google Drive & WhatsApp బ్యాకప్"
                        : "Backing up inside Android APK"}
                    </div>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {lang === "te"
                        ? "Android APK లోపల Google పాప్-అప్ లాగిన్ Google భద్రతా నియమాల వల్ల పనిచేయదు (Chrome బ్రౌజర్‌లో మాత్రమే పనిచేస్తుంది)."
                        : "Google popup login only runs inside Chrome browser (Android restricts Google web popups inside standalone APKs)."}
                    </p>
                    <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {lang === "te"
                        ? "ఈ APK నుండి మీ డేటాను సురక్షితంగా Google Drive లేదా WhatsApp లో సేవ్ చేయడానికి క్రింద ఉన్న 'వాట్సాప్ లేదా డ్రైవ్‌కి పంపండి' నొక్కండి. Chrome లోని పాత డేటాను ఈ APK లోకి తేవడానికి అక్కడ JSON ఫైల్ డౌన్‌లోడ్ చేసి క్రింద రీస్టోర్ చేయండి."
                        : "To save directly to Google Drive or WhatsApp from this APK, tap 'Share Backup via WhatsApp / Drive' below. To move old Chrome data here, download the JSON file from Chrome and restore it below."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {lang === "te"
                      ? "మీ లెడ్జర్ ఆఫ్‌లైన్‌లో ఎప్పుడూ పనిచేస్తుంది. కొత్త ఫోన్ మారినప్పుడు మీ పూర్తి ఖాతాలను తిరిగి పొందడానికి మీ Google ఖాతాతో సైన్ ఇన్ చేయండి."
                      : "Your lending ledger always runs 100% offline first. Sign in with your Google account to securely back up snapshots across any phone."}
                  </p>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={googleSigningIn}
                    className="w-full min-h-[48px] py-3 px-4 rounded-2xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-black text-xs flex items-center justify-center gap-2.5 shadow-sm cursor-pointer transition-all disabled:opacity-60"
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#EA4335"
                        d="M12 5.04c1.94 0 3.51.68 4.75 1.81l3.55-3.55C18.17 1.34 15.32 0 12 0 7.31 0 3.25 2.69 1.25 6.62l4.14 3.21C6.39 6.95 8.98 5.04 12 5.04z"
                      />
                      <path
                        fill="#4285F4"
                        d="M23.49 12.27c0-.79-.07-1.55-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.74-2.41 3.58l3.88 3.01c2.27-2.09 3.55-5.17 3.55-8.83z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.39 14.17c-.24-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29L1.25 6.38C.45 7.98 0 9.93 0 11.88s.45 3.9 1.25 5.5l4.14-3.21z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.9l-3.88-3.01c-1.08.72-2.45 1.15-4.05 1.15-3.02 0-5.61-1.91-6.61-4.59l-4.14 3.21C3.25 21.31 7.31 24 12 24z"
                      />
                    </svg>
                    <span>
                      {googleSigningIn
                        ? lang === "te"
                          ? "Google ఖాతాకు కనెక్ట్ అవుతోంది..."
                          : "Connecting Google Account..."
                        : lang === "te"
                        ? "క్లౌడ్ సింక్ కోసం Google తో సైన్ ఇన్ చేయండి"
                        : "Sign in with Google to Sync Across Phones"}
                    </span>
                  </button>

                  {cloudError && (
                    <div
                      role="alert"
                      className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 space-y-2 leading-relaxed"
                    >
                      <div className="font-bold break-words">{cloudError}</div>
                      {cloudUnauthorizedDomain && (
                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-rose-200/70 dark:border-rose-800/70">
                          <code className="font-mono text-[11px] font-bold text-rose-900 dark:text-rose-100 truncate select-all">
                            {cloudUnauthorizedDomain}
                          </code>
                          <button
                            type="button"
                            onClick={() => void handleCopyAuthDomain(cloudUnauthorizedDomain)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                          >
                            {copiedDomain ? (
                              <>
                                <Check className="w-3 h-3" />
                                <span>{lang === "te" ? "కాపీ అయింది" : "Copied"}</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>{lang === "te" ? "డొమైన్ కాపీ" : "Copy Domain"}</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="space-y-3.5">
                {/* Connected Google Account Bar */}
                <div className="p-3.5 rounded-2xl bg-white/90 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {googleUser.photoURL ? (
                        <img
                          src={googleUser.photoURL}
                          alt={googleUser.displayName}
                          className="w-9 h-9 rounded-full border border-slate-200 dark:border-slate-700 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                          {(googleUser.displayName || "G").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1 truncate">
                          <span className="truncate">{googleUser.displayName}</span>
                          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {googleUser.email}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleGoogleSignOut}
                      className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{lang === "te" ? "లాగ్‌అవుట్" : "Sign Out"}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-500" />
                      <span>{lang === "te" ? "చివరి క్లౌడ్ బ్యాకప్" : "Last Cloud Backup"}</span>
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 text-[11px]">
                      {lastCloudTime
                        ? new Date(lastCloudTime).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : lang === "te"
                        ? "ఇంకా చేయలేదు"
                        : "Not yet synced"}
                    </span>
                  </div>
                </div>

                {/* Auto Cloud Sync Toggle */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
                  <div className="pr-3">
                    <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {lang === "te" ? "కలెక్షన్ల తర్వాత ఆటో-సింక్" : "Auto-Sync After Collections"}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      {lang === "te"
                        ? "వసూలు లేదా కొత్త రుణం నమోదు చేసినప్పుడు ఆటోమేటిక్ గా క్లౌడ్ లో సేవ్ అవుతుంది"
                        : "Automatically snapshots ledger whenever collections or loans are saved"}
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Toggle automatic cloud backup"
                    onClick={handleToggleAutoCloud}
                    className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                      autoCloudEnabled ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                        autoCloudEnabled ? "left-7" : "left-1"
                      }`}
                    />
                  </button>
                </div>

                {/* Sync to Cloud Now Button */}
                <button
                  type="button"
                  onClick={handleSyncCloud}
                  disabled={cloudSyncing}
                  className="w-full min-h-[46px] py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${cloudSyncing ? "animate-spin" : ""}`} />
                  <span>
                    {cloudSyncing
                      ? lang === "te"
                        ? "క్లౌడ్ వాల్ట్ కి సింక్ అవుతోంది..."
                        : "Uploading to Firebase Cloud..."
                      : lang === "te"
                      ? "ఇప్పుడే క్లౌడ్‌కి సింక్ చేయండి (Sync Now)"
                      : "Sync Ledger to Cloud Now"}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* 2. Cloud Snapshots List (Shown when signed in) */}
          {googleUser && (
            <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <Database className="w-4 h-4 text-indigo-600" />
                  <span>
                    {lang === "te" ? "క్లౌడ్ స్నాప్‌షాట్ల చరిత్ర" : "Cloud Snapshots"} ({cloudBackups.length})
                  </span>
                </h4>
                <button
                  type="button"
                  onClick={fetchCloudBackups}
                  disabled={loadingCloudBackups}
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 cursor-pointer hover:underline disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingCloudBackups ? "animate-spin" : ""}`} />
                  <span>{lang === "te" ? "రిఫ్రెష్" : "Refresh"}</span>
                </button>
              </div>

              {cloudError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 font-semibold">
                  {cloudError}
                </div>
              )}

              {loadingCloudBackups ? (
                <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  <span>{lang === "te" ? "క్లౌడ్ రికార్డులు లోడ్ అవుతున్నాయి..." : "Checking Cloud Vault..."}</span>
                </div>
              ) : cloudBackups.length === 0 ? (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-800 text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === "te"
                      ? "ఇంకా క్లౌడ్ స్నాప్‌షాట్లు లేవు. పైన ఉన్న 'ఇప్పుడే క్లౌడ్‌కి సింక్ చేయండి' బటన్ నొక్కండి."
                      : "No cloud snapshots created yet. Tap 'Sync Ledger to Cloud Now' above."}
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-0.5">
                  {cloudBackups.map((bk) => (
                    <div
                      key={bk.backupId}
                      className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                            {new Date(bk.exportedAt).toLocaleString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                              bk.auto
                                ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                : "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                            }`}
                          >
                            {bk.auto ? "AUTO" : "MANUAL"}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <span>{bk.villagesCount} Villages</span>
                          <span>•</span>
                          <span>{bk.borrowersCount} Borrowers</span>
                          <span>•</span>
                          <span className="font-bold text-amber-700 dark:text-amber-400">
                            ₹{(bk.totalLent || 0).toLocaleString("en-IN")}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setConfirmRestoreCloud(bk)}
                          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-all"
                        >
                          {lang === "te" ? "రీస్టోర్" : "Restore"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteCloudSnapshot(bk.backupId)}
                          className="p-1.5 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer transition-all"
                          title="Delete this snapshot"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. Local Offline & WhatsApp Backup */}
          <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border border-emerald-500/40 space-y-3 shadow-sm">
            <h3 className="font-black text-emerald-800 dark:text-emerald-300 text-base flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-emerald-600" />
              <span>{lang === "te" ? "ఆఫ్‌లైన్ లోకల్ & వాట్సాప్ బ్యాకప్" : "Offline Local & WhatsApp Backup"}</span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {lang === "te"
                ? "ఇంటర్నెట్ లేనప్పుడు కూడా మీ వాట్సాప్ లేదా ఫోన్ ఫైల్ మేనేజర్‌కి డైరెక్ట్ బ్యాకప్ ఫైల్ డౌన్‌లోడ్ చేసుకోవచ్చు."
                : "Independent of cloud sync, you can also share an offline backup file directly to your personal WhatsApp or download to device storage."}
            </p>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={handleShareBackup}
                className="w-full py-3.5 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all"
              >
                <Share2 className="w-4 h-4" />
                <span>{lang === "te" ? "వాట్సాప్ లేదా డ్రైవ్‌కి పంపండి" : "Share Backup via WhatsApp / Drive"}</span>
              </button>

              <button
                onClick={handleDownloadBackup}
                className="w-full py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-200"
              >
                <Download className="w-4 h-4" />
                <span>{lang === "te" ? "బ్యాకప్ ఫైల్ డౌన్‌లోడ్ చేసుకోండి" : "Download Backup File (*.json)"}</span>
              </button>
            </div>
          </div>

          {/* 4. Restore from Local JSON File */}
          <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" />
              <span>{lang === "te" ? "ఫైల్ నుండి రీస్టోర్ చేయండి" : "Restore from Local File"}</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === "te"
                ? "గతంలో డౌన్‌లోడ్ చేసిన బ్యాకప్ JSON ఫైల్‌ను సెలెక్ట్ చేయండి."
                : "Select a previously downloaded backup JSON file to restore all villages and borrowers."}
            </p>

            <input
              type="file"
              accept=".json"
              ref={fileInputRef}
              onChange={handleFileRestore}
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-2 cursor-pointer hover:bg-slate-200"
            >
              <Upload className="w-4 h-4" />
              <span>{lang === "te" ? "ఫైల్ ఎంచుకోండి (*.json)" : "Select Backup File (*.json)"}</span>
            </button>
          </div>

          {/* 5. Start Fresh / Wipe Test Data Card */}
          {onClearAllData && (
            <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border border-red-300/60 dark:border-red-900/50 space-y-3 shadow-sm">
              <h4 className="font-bold text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                <span>{lang === "te" ? "కొత్తగా ప్రారంభించండి (Clear All Data)" : "Clear Test Data / Start Fresh"}</span>
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === "te"
                  ? "అన్ని నమూనా గ్రామాలు, ఖాతాదారులు మరియు వసూళ్ల రికార్డులను శాశ్వతంగా తొలగిస్తుంది."
                  : "Permanently removes all villages, borrowers, collections, and expenses so you can hand over a fresh ledger."}
              </p>
              <button
                onClick={() => setShowClearModal(true)}
                className="w-full py-3 px-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-xs font-bold text-red-700 dark:text-red-400 flex items-center justify-center gap-2 cursor-pointer hover:bg-red-100"
              >
                <Trash2 className="w-4 h-4" />
                <span>{lang === "te" ? "అన్ని డేటా క్లియర్ చేయండి" : "Clear All Ledger Data"}</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Confirmation Modal for Cloud Restore */}
      {confirmRestoreCloud && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 flex items-center justify-center mx-auto">
              <Cloud className="w-6 h-6" />
            </div>
            <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
              {lang === "te" ? "క్లౌడ్ స్నాప్‌షాట్ రీస్టోర్ చేయాలా?" : "Restore Cloud Snapshot?"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {lang === "te"
                ? `ఈ స్నాప్‌షాట్ (${new Date(confirmRestoreCloud.exportedAt).toLocaleString("en-IN")}) నుండి రీస్టోర్ అవుతుంది. మీ ప్రస్తుత డేటా ఒక భద్రతా కాపీగా సేవ్ చేయబడుతుంది.`
                : `Restore snapshot from ${new Date(confirmRestoreCloud.exportedAt).toLocaleString("en-IN")}? It contains ${confirmRestoreCloud.villagesCount} villages and ${confirmRestoreCloud.borrowersCount} borrowers.`}
            </p>
            <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs text-left">
              {lang === "te"
                ? "⚠️ రీస్టోర్ చేయడానికి ముందు మీ ప్రస్తుత ఫోన్ డేటా ఆటోమేటిక్‌గా భద్రతా కాపీగా సేవ్ చేయబడుతుంది."
                : "⚠️ A safety snapshot of your current device data will be preserved automatically before restoring."}
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmRestoreCloud(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200"
              >
                {lang === "te" ? "రద్దు" : "Cancel"}
              </button>
              <button
                onClick={() => handleRestoreCloud(confirmRestoreCloud)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs cursor-pointer hover:bg-blue-700"
              >
                {lang === "te" ? "నిర్ధారించి రీస్టోర్ చేయి" : "Confirm & Restore"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CHANGE PIN */}
      {activeSection === "pin" && (
        <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div>
            <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
              {lang === "te" ? "లాక్ పిన్ మార్చండి" : "Change Security PIN"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === "te"
                ? "పిన్ ఖచ్చితంగా 4 అంకెలు మాత్రమే ఉండాలి (ఉదాహరణ: 1234)"
                : "PIN must be strictly 4 numeric digits (e.g. 1234)"}
            </p>
          </div>

          <form onSubmit={handleChangePin} className="space-y-3.5">
            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 uppercase">
                {lang === "te" ? "ప్రస్తుత పిన్ *" : "Current PIN *"}
              </label>
              <input
                type="password"
                inputMode="numeric"
                required
                maxLength={4}
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="4 digits"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-base outline-none tracking-widest focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 uppercase">
                {lang === "te" ? "కొత్త 4-అంకెల పిన్ *" : "New 4-Digit PIN *"}
              </label>
              <input
                type="password"
                inputMode="numeric"
                required
                maxLength={4}
                value={newPin1}
                onChange={(e) => setNewPin1(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="4 digits"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-base outline-none tracking-widest focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 uppercase">
                {lang === "te" ? "కొత్త పిన్ ధృవీకరించండి *" : "Confirm New PIN *"}
              </label>
              <input
                type="password"
                inputMode="numeric"
                required
                maxLength={4}
                value={newPin2}
                onChange={(e) => setNewPin2(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="Repeat 4 digits"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-bold text-base outline-none tracking-widest focus:border-blue-500"
              />
            </div>

            {pinErr && (
              <p className="text-xs text-red-600 dark:text-red-400 font-bold tracking-wide">
                {pinErr}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-[#1E3A8A] text-white font-black text-xs cursor-pointer shadow-md hover:bg-blue-900 mt-2"
            >
              {lang === "te" ? "పిన్ మార్చండి" : "Update PIN"}
            </button>
          </form>
        </div>
      )}

      {/* LINE VILLAGES MANAGEMENT */}
      {activeSection === "villages" && (
        <div className="space-y-4">
          {/* Operating Days Preference (Specific Days vs Daily) */}
          <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border border-sky-200 dark:border-sky-800/60 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-sky-700 dark:text-sky-400 shrink-0" />
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                  {lang === "te" ? "వారపు లైన్ రోజులు" : "Weekly Line Schedule Days"}
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  {lang === "te"
                    ? "మీరు ప్రతిరోజు లైన్ చేస్తారా లేదా వారానికి కొన్ని రోజులు చేస్తారా ఎంచుకోండి"
                    : "Choose whether you run your collection line daily or on specific weekdays."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateProfile({
                    ...profile,
                    lineDaysMode: "specific",
                    lineDays:
                      profile.lineDays && profile.lineDays.length > 0 && profile.lineDays.length < 7
                        ? profile.lineDays
                        : ["Monday", "Tuesday"],
                    lineDaysConfigured: true,
                  })
                }
                className={`min-h-[42px] rounded-xl px-3 py-2 text-xs font-extrabold border cursor-pointer transition-all ${
                  (profile.lineDaysMode || "specific") === "specific"
                    ? "bg-sky-700 text-white border-sky-700"
                    : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
              >
                {lang === "te" ? "ఎంచుకున్న రోజులు" : "Specific Days"}
              </button>
              <button
                type="button"
                onClick={() =>
                  onUpdateProfile({
                    ...profile,
                    lineDaysMode: "daily",
                    lineDays: [...ALL_DAYS_MON_FIRST],
                    lineDaysConfigured: true,
                  })
                }
                className={`min-h-[42px] rounded-xl px-3 py-2 text-xs font-extrabold border cursor-pointer transition-all ${
                  profile.lineDaysMode === "daily"
                    ? "bg-sky-700 text-white border-sky-700"
                    : "bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                }`}
              >
                {lang === "te" ? "ప్రతి రోజు (Daily)" : "Daily (All 7 Days)"}
              </button>
            </div>

            {(profile.lineDaysMode || "specific") === "specific" && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ALL_DAYS_MON_FIRST.map((day) => {
                  const activeDays = profile.lineDays || ["Monday", "Tuesday"];
                  const selected = activeDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => {
                        const nextDays = selected
                          ? activeDays.length > 1
                            ? activeDays.filter((d) => d !== day)
                            : activeDays
                          : [...activeDays, day];
                        onUpdateProfile({
                          ...profile,
                          lineDaysMode: "specific",
                          lineDays: nextDays,
                          lineDaysConfigured: true,
                        });
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
          </div>

          <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
              {lang === "te" ? "కొత్త గ్రామం చేర్చండి" : "Add Line Village"}
            </h3>

            <form onSubmit={handleAddVillage} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 uppercase">
                  {lang === "te" ? "గ్రామం పేరు *" : "Village Name *"}
                </label>
                <input
                  type="text"
                  required
                  value={vName}
                  onChange={(e) => setVName(e.target.value)}
                  placeholder="e.g. Polamuru"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1 uppercase">
                  {lang === "te" ? "వసూలు రోజు *" : "Line Day *"}
                </label>
                <select
                  value={vDay}
                  onChange={(e) => setVDay(e.target.value as DayOfWeek)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-blue-500 cursor-pointer"
                >
                  {ALL_DAYS_MON_FIRST.map((day) => (
                    <option key={day} value={day}>
                      {day} ({translateDayName(day, "te")})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] py-3 rounded-2xl bg-[#1E3A8A] text-white font-bold text-xs cursor-pointer shadow-md hover:bg-blue-900"
              >
                + {lang === "te" ? "గ్రామం జోడించండి" : "Add Village"}
              </button>
            </form>
          </div>

          <div className="space-y-2.5">
            {data.villages.map((v) => {
              const bCount = (data.borrowers[v.id] || []).length;

              return (
                <div
                  key={v.id}
                  className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shadow-sm"
                >
                  <div className="min-w-0">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{v.name}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {translateDayName(v.day, lang)} · {bCount} {lang === "te" ? "ఖాతాదారులు" : "borrowers"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      aria-label={`Change collection day for ${v.name}`}
                      value={v.day}
                      onChange={(e) => {
                        const nextDay = e.target.value as DayOfWeek;
                        onUpdateData({
                          ...data,
                          villages: data.villages.map((item) =>
                            item.id === v.id ? { ...item, day: nextDay } : item
                          ),
                        });
                        showToast(
                          lang === "te"
                            ? `${v.name} రోజు ${translateDayName(nextDay, "te")} కు మారింది ✓`
                            : `${v.name} moved to ${nextDay} ✓`,
                          "success"
                        );
                      }}
                      className="min-h-[38px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-xs outline-none cursor-pointer"
                    >
                      {ALL_DAYS_MON_FIRST.map((day) => (
                        <option key={day} value={day}>
                          {day}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setDeleteVillageConfirm(v)}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-bold text-xs cursor-pointer hover:bg-red-200"
                    >
                      {lang === "te" ? "తొలగించు" : "Remove"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {deleteVillageConfirm && (
            <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
              <div className="rounded-3xl p-6 max-w-xs w-full text-center shadow-2xl bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950 text-red-600 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100 mb-1">
                  {lang === "te" ? "గ్రామాన్ని తొలగించాలా?" : "Remove Village?"}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  {lang === "te"
                    ? `"${deleteVillageConfirm.name}" ను తొలగించాలా? ఈ గ్రామంలోని ఖాతాదారులు కూడా తొలగించబడతారు.`
                    : `Are you sure you want to remove "${deleteVillageConfirm.name}"? All associated borrowers will be deleted.`}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteVillageConfirm(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200"
                  >
                    {lang === "te" ? "రద్దు" : "Cancel"}
                  </button>
                  <button
                    onClick={() => handleRemoveVillage(deleteVillageConfirm.id)}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs cursor-pointer hover:bg-red-700"
                  >
                    {lang === "te" ? "అవును, తొలగించు" : "Yes, Remove"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* LOAN ENTRY METHOD (3 MODES) */}
      {activeSection === "loan_entry" && (
        <div className="space-y-4">
          <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border border-indigo-200 dark:border-indigo-800/60 space-y-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 flex items-center justify-center shrink-0">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                  {lang === "te"
                    ? "కొత్త లోన్ నమోదు విధానాన్ని ఎంచుకోండి"
                    : "Choose Loan Entry Method"}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {lang === "te"
                    ? "కొత్త ఖాతాదారుని లేదా రెన్యువల్ చేసేటప్పుడు ఏ బాక్స్‌లు కనిపించాలో ఇక్కడ ఎంచుకోండి."
                    : "Choose how you enter loan amounts when adding a borrower or renewing a loan."}
                </p>
              </div>
            </div>

            <div className="space-y-3 pt-1">
              {(
                [
                  {
                    id: "principal_interest" as LoanEntryMode,
                    badge: lang === "te" ? "విధానం 1 (పాతది)" : "Method 1 · Interest %",
                    titleEn: "Loan Amount + Interest % + Weeks",
                    titleTe: "అసలు మొత్తం + వడ్డీ % + వారాలు",
                    descEn:
                      "Enter principal loan amount, interest percentage (e.g. 20%), and weeks. Auto-calculates weekly due.",
                    descTe:
                      "ఇచ్చిన అప్పు, వడ్డీ శాతం (ఉదా. 20%) మరియు వారాలు నమోదు చేయండి. వాయిదా ఆటోమేటిక్‌గా వస్తుంది.",
                    example: "₹10,000 + 20% + 12 Wks → ₹1,000/wk",
                  },
                  {
                    id: "principal_total" as LoanEntryMode,
                    badge: lang === "te" ? "విధానం 2 (ప్రస్తుతం)" : "Method 2 · Principal & Total",
                    titleEn: "Loan Amount + Total Amount to Pay + Weeks",
                    titleTe: "అసలు మొత్తం + చెల్లించాల్సిన మొత్తం + వారాలు",
                    descEn:
                      "Enter principal given and total repayable amount + weeks (no Interest % shown on screen).",
                    descTe:
                      "ఇచ్చిన అప్పు మరియు తిరిగి చెల్లించాల్సిన మొత్తం + వారాలు నమోదు చేయండి (వడ్డీ % కనిపించదు).",
                    example: "₹10,000 + ₹12,000 + 12 Wks → ₹1,000/wk",
                  },
                  {
                    id: "total_only" as LoanEntryMode,
                    badge: lang === "te" ? "విధానం 3 (సులభం)" : "Method 3 · Total & Weeks Only",
                    titleEn: "Total Amount to Pay + Weeks Only",
                    titleTe: "చెల్లించాల్సిన మొత్తం + వారాలు మాత్రమే",
                    descEn:
                      "Fastest entry: only enter the total amount borrower should pay back and weeks (no Loan Amount or Interest %).",
                    descTe:
                      "చాలా సులభం: ఖాతాదారుడు తిరిగి కట్టాల్సిన మొత్తం మరియు వారాలు మాత్రమే నమోదు చేయండి.",
                    example: "₹12,000 + 12 Wks → ₹1,000/wk",
                  },
                ] as const
              ).map((opt) => {
                const currentMode: LoanEntryMode = profile.loanEntryMode || "principal_total";
                const isSelected = currentMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onUpdateProfile({ ...profile, loanEntryMode: opt.id });
                      showToast(
                        lang === "te"
                          ? `${opt.titleTe} సేవ్ అయింది ✓`
                          : `Loan entry set to: ${opt.titleEn} ✓`,
                        "success"
                      );
                    }}
                    className={`w-full text-left rounded-2xl p-4 border-2 transition-all cursor-pointer space-y-2 ${
                      isSelected
                        ? "bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-600 dark:border-indigo-400 shadow-sm"
                        : "bg-slate-50/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {opt.badge}
                      </span>
                      {isSelected && (
                        <span className="inline-flex items-center gap-1 text-xs font-black text-indigo-700 dark:text-indigo-300">
                          <CheckCircle2 className="w-4 h-4" />
                          {lang === "te" ? "ఎంచుకోబడింది" : "Selected"}
                        </span>
                      )}
                    </div>
                    <div className="font-black text-sm text-slate-900 dark:text-slate-100">
                      {lang === "te" ? opt.titleTe : opt.titleEn}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                      {lang === "te" ? opt.descTe : opt.descEn}
                    </p>
                    <div className="inline-block px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200">
                      {opt.example}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* BUSINESS PROFILE & EMBLEM CUSTOMIZATION (C-0.1 Item 6) */}
      {activeSection === "profile" && (
        <div className="space-y-4">
          {/* Live Preview Card */}
          <div className="rounded-3xl p-5 bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white border border-slate-800 shadow-xl text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
              {lang === "te" ? "లైవ్ బ్రాండింగ్ ప్రివ్యూ" : "Live Branding Preview"}
            </span>

            <div className="flex flex-col items-center justify-center">
              <div className="p-2 rounded-2xl bg-slate-800/60 border border-slate-700/60 mb-2">
                <BusinessEmblem emblem={selectedEmblem} size={48} color={brandColor} />
              </div>

              <h2
                className="text-lg sm:text-xl font-serif font-black tracking-wide truncate max-w-xs"
                style={{ color: brandColor }}
              >
                {bizName || "LineBook Pro"}
              </h2>

              <p className="text-[10px] tracking-widest font-extrabold uppercase text-slate-400 mt-0.5">
                {tagline || "FINANCE & LINE"}
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <div>
              <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                {lang === "te" ? "వ్యాపార ప్రొఫైల్ & లోగో ఎంపిక" : "Customize Profile & Emblem"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {lang === "te"
                  ? "మీ మతం లేదా వ్యాపార అభిరుచికి తగిన లోగో మరియు బ్రాండ్ రంగు ఎంచుకోండి."
                  : "Choose your preferred religious or secular emblem and signature brand color."}
              </p>
            </div>

            {/* 1. Religious / Cultural Emblem Selection */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2 uppercase tracking-wide">
                {lang === "te" ? "లోగో / ప్రతీక ఎంచుకోండి *" : "Select Emblem / Symbol *"}
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {emblemsList.map((item) => {
                  const isSelected = selectedEmblem === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedEmblem(item.id)}
                      className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isSelected
                          ? "bg-amber-500/15 border-amber-500 shadow-sm scale-102"
                          : "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700/80 hover:border-slate-400"
                      }`}
                    >
                      <BusinessEmblem
                        emblem={item.id}
                        size={32}
                        color={isSelected ? brandColor : "#64748B"}
                      />
                      <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
                        {lang === "te" ? item.nameTe : item.nameEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Brand Color Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  {lang === "te" ? "పేరు & లోగో రంగు *" : "Name & Emblem Color *"}
                </label>
                <span className="text-xs font-mono font-bold" style={{ color: brandColor }}>
                  {brandColor}
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap mb-2">
                {brandColors.map((col) => {
                  const isSelected = brandColor.toLowerCase() === col.hex.toLowerCase();
                  return (
                    <button
                      key={col.hex}
                      type="button"
                      onClick={() => setBrandColor(col.hex)}
                      className={`w-9 h-9 rounded-full transition-transform cursor-pointer relative flex items-center justify-center ${
                        isSelected ? "scale-115 ring-2 ring-offset-2 ring-blue-600 dark:ring-offset-slate-900" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: col.hex }}
                      title={col.label}
                    >
                      {isSelected && <span className="text-white text-xs font-bold">✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Custom Color Picker input */}
              <div className="flex items-center gap-2 mt-2">
                <Palette className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === "te" ? "సొంత రంగు ఎంచుకోండి:" : "Custom Color:"}
                </span>
                <input
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                />
              </div>
            </div>

            {/* 3. Business Name & Tagline Inputs */}
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 uppercase tracking-wide">
                {lang === "te" ? "ఫైనాన్స్ వ్యాపారం పేరు *" : "Finance Business Name *"}
              </label>
              <input
                type="text"
                required
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                placeholder="e.g. Roy Line Finance"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-bold outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 uppercase tracking-wide">
                {lang === "te" ? "ట్యాగ్‌లైన్ / ఉప శీర్షిక" : "Tagline"}
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="e.g. FINANCE & LINE"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 uppercase tracking-wide">
                {lang === "te" ? "యజమాని / మేనేజర్ పేరు" : "Owner / Manager Name"}
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder={lang === "te" ? "మీ పేరు" : "Your name"}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 uppercase tracking-wide">
                {lang === "te" ? "సంప్రదింపు ఫోన్ నంబర్" : "Contact Phone Number"}
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={lang === "te" ? "10-అంకెల ఫోన్ నంబర్" : "10-digit phone number"}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl text-white font-black text-xs cursor-pointer shadow-md active:scale-98 transition-all mt-2"
              style={{ backgroundColor: brandColor || "#1E3A8A" }}
            >
              {lang === "te" ? "ప్రొఫైల్ సేవ్ చేయండి" : "Save Profile & Customization"}
            </button>
          </form>
        </div>
      )}

      {/* WHATSAPP AUTOMATION & RULES SECTION (Requirement 2) */}
      {activeSection === "whatsapp" && (
        <div className="space-y-4">
          {/* Header Info Card */}
          <div className="rounded-3xl p-5 bg-gradient-to-r from-emerald-600/10 via-emerald-600/5 to-transparent border border-emerald-500/30 dark:bg-emerald-950/20 shadow-sm space-y-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shrink-0">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                  {lang === "te" ? "వాట్సాప్ కంట్రోల్ సెంటర్" : "WhatsApp Control Center"}
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 leading-tight">
                  {lang === "te" ? "ఆటోమేషన్ & నియంత్రణ నియమాలు" : "Automation & Delivery Rules"}
                </h3>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
              {lang === "te"
                ? "వాయిదా రశీదులు, 2-రోజుల ముందస్తు రిమైండర్లు మరియు కీప్యాడ్ మొబైల్స్ నిర్వహణ. మీ ఇష్టానుసారం గ్రామం లేదా ఖాతాదారుని వారీగా నియంత్రించుకోవచ్చు."
                : "Configure automatic WhatsApp receipts, 2-day collection reminders, and keypad feature phones by village or borrower."}
            </p>
          </div>

          {/* MASTER CONTROLS */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
              {lang === "te" ? "ప్రధాన స్విచ్‌లు (Master Toggles)" : "Master Automation Controls"}
            </h4>

            {/* 1. Master Enable */}
            <div className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-0.5 max-w-[75%]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {lang === "te" ? "వాట్సాప్ ఆటోమేషన్ (Master)" : "Master WhatsApp Automation"}
                  </span>
                  {waRules.masterEnabled && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[9px] font-black">
                      ON
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === "te"
                    ? "యాప్‌లో వాట్సాప్ ఫీచర్లు పూర్తిగా ఆన్ / ఆఫ్ చేయండి"
                    : "Turn WhatsApp messaging capabilities completely on or off"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const updated = { ...waRules, masterEnabled: !waRules.masterEnabled };
                  updateWaRules(updated);
                  showToast(
                    updated.masterEnabled
                      ? (lang === "te" ? "వాట్సాప్ ఆటోమేషన్ ఆన్ చేయబడింది ✓" : "WhatsApp automation enabled ✓")
                      : (lang === "te" ? "వాట్సాప్ ఆటోమేషన్ ఆఫ్ చేయబడింది" : "WhatsApp automation disabled"),
                    "info"
                  );
                }}
                className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                  waRules.masterEnabled ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    waRules.masterEnabled ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* 2. Auto-Receipt on Payment */}
            <div className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-0.5 max-w-[75%]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {lang === "te" ? "వాయిదా పడగానే ఆటో-రశీదు" : "Auto-Send Receipt on Payment"}
                  </span>
                  {waRules.autoReceiptOnPayment && (
                    <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[9px] font-black">
                      AUTO
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === "te"
                    ? "వాయిదా మార్క్ చేయగానే నేరుగా వాట్సాప్ తెరుచుకుంటుంది (అనవసరమైన క్లిక్‌లు లేకుండా)"
                    : "Directly opens WhatsApp with ready slip when marking paid (no extra clicks)"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const updated = { ...waRules, autoReceiptOnPayment: !waRules.autoReceiptOnPayment };
                  updateWaRules(updated);
                  showToast(
                    updated.autoReceiptOnPayment
                      ? (lang === "te" ? "ఆటో-రశీదు ప్రారంభించబడింది ✓" : "Auto-receipt enabled ✓")
                      : (lang === "te" ? "ఆటో-రశీదు నిలిపివేయబడింది" : "Auto-receipt disabled"),
                    "info"
                  );
                }}
                className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                  waRules.autoReceiptOnPayment ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    waRules.autoReceiptOnPayment ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* 3. Auto 2-Day Advance Reminder */}
            <div className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
              <div className="space-y-0.5 max-w-[75%]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {lang === "te" ? "2 రోజుల ముందు ఆటో-రిమైండర్" : "2-Day Advance Line Reminder"}
                  </span>
                  {waRules.autoTwoDayReminder && (
                    <span className="px-1.5 py-0.2 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[9px] font-black">
                      2-DAYS
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === "te"
                    ? "శనివారం సోమవారం గ్రామాలకు, ఆదివారం మంగళవారం గ్రామాలకు ముందస్తు మెసేజ్ నోటీస్"
                    : "Sends advance reminder: Sat for Mon line, Sun for Tue line"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const updated = { ...waRules, autoTwoDayReminder: !waRules.autoTwoDayReminder };
                  updateWaRules(updated);
                  showToast(
                    updated.autoTwoDayReminder
                      ? (lang === "te" ? "ఆటో 2-రోజుల రిమైండర్ ఆన్ చేయబడింది ✓" : "2-day reminder enabled ✓")
                      : (lang === "te" ? "రిమైండర్ నిలిపివేయబడింది" : "Reminder disabled"),
                    "info"
                  );
                }}
                className={`w-12 h-6 rounded-full p-0.5 transition-colors cursor-pointer ${
                  waRules.autoTwoDayReminder ? "bg-emerald-600" : "bg-slate-300 dark:bg-slate-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    waRules.autoTwoDayReminder ? "translate-x-6" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* VILLAGE-LEVEL RULES */}
          <div className="space-y-2.5 pt-2">
            <div className="flex items-center justify-between px-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {lang === "te" ? "గ్రామాల వారీగా నియమాలు" : "Village-Wise Rules"} ({data.villages.length})
              </h4>
              <span className="text-[10px] text-slate-400 font-semibold">
                {lang === "te" ? "రశీదులు & రిమైండర్లు ఆన్/ఆఫ్" : "Receipts & Reminders per village"}
              </span>
            </div>

            {data.villages.length === 0 ? (
              <div className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] text-center text-slate-400 text-xs">
                {lang === "te" ? "గ్రామాలు ఏవీ లేవు" : "No villages active"}
              </div>
            ) : (
              <div className="space-y-2">
                {data.villages.map((v) => {
                  const vCfg = waRules.villageConfigs[v.id] || {};
                  const receiptsDisabled = !!vCfg.disableReceipt;
                  const remindersDisabled = !!vCfg.disableReminder;
                  const bCount = (data.borrowers[v.id] || []).length;

                  return (
                    <div
                      key={v.id}
                      className="rounded-2xl p-3.5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                            <span>🏘️ {v.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                              {v.day}
                            </span>
                          </h5>
                          <span className="text-[11px] text-slate-500">
                            {bCount} {lang === "te" ? "ఖాతాదారులు" : "borrowers"}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        {/* Village Receipts Toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = {
                              ...waRules,
                              villageConfigs: {
                                ...waRules.villageConfigs,
                                [v.id]: {
                                  ...vCfg,
                                  disableReceipt: !receiptsDisabled,
                                },
                              },
                            };
                            updateWaRules(updated);
                            showToast(
                              receiptsDisabled
                                ? (lang === "te"
                                    ? `${v.name} - రశీదులు ఆన్ చేయబడ్డాయి ✓`
                                    : `${v.name} - Receipts turned ON ✓`)
                                : (lang === "te"
                                    ? `${v.name} - రశీదులు ఆఫ్ చేయబడ్డాయి`
                                    : `${v.name} - Receipts turned OFF`),
                              "info"
                            );
                          }}
                          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer border transition-all ${
                            !receiptsDisabled
                              ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            <span>🧾</span>
                            <span>{lang === "te" ? "రశీదులు" : "Receipts"}</span>
                          </span>
                          <span>{!receiptsDisabled ? "✓ ON" : "OFF"}</span>
                        </button>

                        {/* Village Reminders Toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            const updated = {
                              ...waRules,
                              villageConfigs: {
                                ...waRules.villageConfigs,
                                [v.id]: {
                                  ...vCfg,
                                  disableReminder: !remindersDisabled,
                                },
                              },
                            };
                            updateWaRules(updated);
                            showToast(
                              remindersDisabled
                                ? (lang === "te"
                                    ? `${v.name} - రిమైండర్లు ఆన్ చేయబడ్డాయి ✓`
                                    : `${v.name} - Reminders turned ON ✓`)
                                : (lang === "te"
                                    ? `${v.name} - రిమైండర్లు ఆఫ్ చేయబడ్డాయి`
                                    : `${v.name} - Reminders turned OFF`),
                              "info"
                            );
                          }}
                          className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer border transition-all ${
                            !remindersDisabled
                              ? "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          <span className="flex items-center gap-1">
                            <span>⏰</span>
                            <span>{lang === "te" ? "రిమైండర్లు" : "Reminders"}</span>
                          </span>
                          <span>{!remindersDisabled ? "✓ ON" : "OFF"}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* BORROWER-LEVEL RULES & KEYPAD MOBILES */}
          <div className="space-y-3 pt-3">
            <div className="px-1">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {lang === "te" ? "ఖాతాదారుల నియమాలు & కీప్యాడ్ ఫోన్లు" : "Borrower Rules & Keypad Mobiles"}
              </h4>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {lang === "te"
                  ? "కీప్యాడ్ మొబైల్ గలవారికి వాట్సాప్ లింక్ ఓపెన్ కాదు (📵 ఐకాన్ కనిపిస్తుంది). బాగా చెల్లించేవారికి రశీదు ఆఫ్ చేయవచ్చు."
                  : "Mark basic keypad phones without WhatsApp (shows 📵 icon) or mute messages for punctual payers."}
              </p>
            </div>

            {/* Search Box */}
            <div className="relative">
              <input
                type="text"
                value={waBorrowerSearch}
                onChange={(e) => setWaBorrowerSearch(e.target.value)}
                placeholder={lang === "te" ? "ఖాతాదారుని పేరు, ఫోన్ లేదా గ్రామం..." : "Search name, phone or village..."}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131B2E] text-xs font-bold outline-none focus:border-emerald-500 text-slate-900 dark:text-slate-100"
              />
              {waBorrowerSearch && (
                <button
                  onClick={() => setWaBorrowerSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-[11px]">
              {[
                { id: "all", label: lang === "te" ? "అందరూ" : "All" },
                { id: "keypad", label: lang === "te" ? "📵 కీప్యాడ్ ఫోన్లు" : "📵 Keypad Phones" },
                { id: "receiptDisabled", label: lang === "te" ? "🔕 రశీదు ఆఫ్" : "🔕 Receipt Off" },
                { id: "reminderDisabled", label: lang === "te" ? "⏰ రిమైండర్ ఆఫ్" : "⏰ Reminder Off" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setWaBorrowerFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-full font-bold whitespace-nowrap cursor-pointer transition-all ${
                    waBorrowerFilter === f.id
                      ? "bg-[#1E3A8A] text-white shadow-xs"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Borrower List */}
            {(() => {
              const allB = Object.entries(data.borrowers).flatMap(([vid, bs]) => {
                const v = data.villages.find((x) => x.id === vid);
                return bs.map((b) => ({
                  borrower: b,
                  villageId: vid,
                  villageName: v?.name || "Village",
                }));
              });

              const filtered = allB.filter(({ borrower, villageName }) => {
                const q = waBorrowerSearch.toLowerCase().trim();
                const matches =
                  !q ||
                  borrower.name.toLowerCase().includes(q) ||
                  (borrower.phone || "").includes(q) ||
                  (borrower.seqNo || "").includes(q) ||
                  villageName.toLowerCase().includes(q);

                if (!matches) return false;

                const isKeypad = isBorrowerKeypad(borrower, waRules);
                const bCfg = waRules.borrowerConfigs[borrower.id];
                const receiptOff = borrower.disableReceipt || bCfg?.disableReceipt;
                const reminderOff = borrower.disableReminder || bCfg?.disableReminder;

                if (waBorrowerFilter === "keypad") return isKeypad;
                if (waBorrowerFilter === "receiptDisabled") return receiptOff;
                if (waBorrowerFilter === "reminderDisabled") return reminderOff;

                return true;
              });

              if (filtered.length === 0) {
                return (
                  <div className="rounded-2xl p-6 bg-white dark:bg-[#131B2E] text-center text-slate-400 text-xs">
                    {lang === "te" ? "ఎటువంటి ఖాతాదారులు కనుగొనబడలేదు" : "No borrowers matching filter"}
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {filtered.map(({ borrower: b, villageId, villageName }) => {
                    const isKeypad = isBorrowerKeypad(b, waRules);
                    const bCfg = waRules.borrowerConfigs[b.id] || {};
                    const receiptDisabled = b.disableReceipt || bCfg.disableReceipt;
                    const reminderDisabled = b.disableReminder || bCfg.disableReminder;

                    return (
                      <div
                        key={b.id}
                        className="rounded-2xl p-3.5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-xs space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 text-blue-900 dark:text-blue-300 font-extrabold text-xs flex items-center justify-center">
                              {b.seqNo ? `#${b.seqNo}` : "—"}
                            </div>
                            <div>
                              <h5 className="font-extrabold text-xs text-slate-900 dark:text-slate-100">
                                {b.name}
                              </h5>
                              <p className="text-[10px] text-slate-500">
                                {villageName} · {b.phone || (lang === "te" ? "ఫోన్ లేదు" : "No phone")}
                              </p>
                            </div>
                          </div>

                          {/* Keypad or Smartphone Badge */}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isKeypad
                                ? "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                                : "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                            }`}
                          >
                            {isKeypad
                              ? (lang === "te" ? "📵 కీప్యాడ్ ఫోన్" : "📵 Keypad Phone")
                              : (lang === "te" ? "📱 వాట్సాప్" : "📱 WhatsApp")}
                          </span>
                        </div>

                        {/* Controls Strip */}
                        <div className="grid grid-cols-3 gap-1.5 pt-1 text-[11px] font-bold">
                          {/* 1. Phone Type Toggle */}
                          <button
                            type="button"
                            onClick={() => {
                              const nextKeypad = !isKeypad;
                              const updated = {
                                ...waRules,
                                borrowerConfigs: {
                                  ...waRules.borrowerConfigs,
                                  [b.id]: {
                                    ...bCfg,
                                    hasWhatsApp: !nextKeypad,
                                  },
                                },
                              };
                              updateWaRules(updated);

                              // Also update borrower record directly
                              const updatedB = (data.borrowers[villageId] || []).map((x) =>
                                x.id === b.id ? { ...x, hasWhatsApp: !nextKeypad } : x
                              );
                              onUpdateData({
                                ...data,
                                borrowers: { ...data.borrowers, [villageId]: updatedB },
                              });

                              showToast(
                                nextKeypad
                                  ? (lang === "te"
                                      ? `${b.name} - కీప్యాడ్ ఫోన్‌గా మార్చబడింది 📵`
                                      : `${b.name} - Marked as Keypad Phone 📵`)
                                  : (lang === "te"
                                      ? `${b.name} - స్మార్ట్‌ఫోన్ (WhatsApp) గా మార్చబడింది 📱`
                                      : `${b.name} - Marked as Smartphone (WhatsApp) 📱`),
                                "info"
                              );
                            }}
                            className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                              isKeypad
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"
                                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                            }`}
                          >
                            {isKeypad
                              ? (lang === "te" ? "📵 కీప్యాడ్" : "📵 Keypad")
                              : (lang === "te" ? "📱 వాట్సాప్" : "📱 WhatsApp")}
                          </button>

                          {/* 2. Auto Receipt Toggle */}
                          <button
                            type="button"
                            disabled={isKeypad}
                            onClick={() => {
                              const nextDisable = !receiptDisabled;
                              const updated = {
                                ...waRules,
                                borrowerConfigs: {
                                  ...waRules.borrowerConfigs,
                                  [b.id]: {
                                    ...bCfg,
                                    hasWhatsApp: !isKeypad,
                                    disableReceipt: nextDisable,
                                  },
                                },
                              };
                              updateWaRules(updated);

                              const updatedB = (data.borrowers[villageId] || []).map((x) =>
                                x.id === b.id ? { ...x, disableReceipt: nextDisable } : x
                              );
                              onUpdateData({
                                ...data,
                                borrowers: { ...data.borrowers, [villageId]: updatedB },
                              });

                              showToast(
                                nextDisable
                                  ? (lang === "te"
                                      ? `${b.name} - రశీదు ఆఫ్ చేయబడింది 🔕`
                                      : `${b.name} - Receipt turned OFF 🔕`)
                                  : (lang === "te"
                                      ? `${b.name} - రశీదు ఆన్ చేయబడింది 🧾`
                                      : `${b.name} - Receipt turned ON 🧾`),
                                "info"
                              );
                            }}
                            className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                              isKeypad
                                ? "opacity-40 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                                : !receiptDisabled
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                            }`}
                          >
                            {!receiptDisabled
                              ? (lang === "te" ? "🧾 రశీదు: ఆన్" : "🧾 Receipt: ON")
                              : (lang === "te" ? "🔕 రశీదు: ఆఫ్" : "🔕 Receipt: OFF")}
                          </button>

                          {/* 3. 2-Day Reminder Toggle */}
                          <button
                            type="button"
                            disabled={isKeypad}
                            onClick={() => {
                              const nextDisable = !reminderDisabled;
                              const updated = {
                                ...waRules,
                                borrowerConfigs: {
                                  ...waRules.borrowerConfigs,
                                  [b.id]: {
                                    ...bCfg,
                                    hasWhatsApp: !isKeypad,
                                    disableReminder: nextDisable,
                                  },
                                },
                              };
                              updateWaRules(updated);

                              const updatedB = (data.borrowers[villageId] || []).map((x) =>
                                x.id === b.id ? { ...x, disableReminder: nextDisable } : x
                              );
                              onUpdateData({
                                ...data,
                                borrowers: { ...data.borrowers, [villageId]: updatedB },
                              });

                              showToast(
                                nextDisable
                                  ? (lang === "te"
                                      ? `${b.name} - రిమైండర్ ఆఫ్ చేయబడింది 🔕`
                                      : `${b.name} - Reminder turned OFF 🔕`)
                                  : (lang === "te"
                                      ? `${b.name} - రిమైండర్ ఆన్ చేయబడింది ⏰`
                                      : `${b.name} - Reminder turned ON ⏰`),
                                "info"
                              );
                            }}
                            className={`py-1.5 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                              isKeypad
                                ? "opacity-40 cursor-not-allowed bg-slate-50 text-slate-400 border-slate-200"
                                : !reminderDisabled
                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
                                : "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                            }`}
                          >
                            {!reminderDisabled
                              ? (lang === "te" ? "⏰ రిమైండర్: ఆన్" : "⏰ Reminder: ON")
                              : (lang === "te" ? "🔕 రిమైండర్: ఆఫ్" : "🔕 Reminder: OFF")}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* PWA Guided Installation Modal */}
      {showPwaGuide && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPwaGuide(false)}
        >
          <div
            className="bg-white dark:bg-[#131B2E] rounded-3xl p-6 max-w-sm w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Smartphone className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100">
                {lang === "te" ? "ఫోన్‌లో యాప్‌ను ఇన్‌స్టాల్ చేయండి" : "Install Mobile App (PWA)"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {lang === "te"
                  ? "ఆంధ్రప్రదేశ్ మారుమూల గ్రామాల్లో ఇంటర్నెట్ లేకపోయినా 100% ఆఫ్‌లైన్ పనిచేస్తుంది"
                  : "Works 100% offline in remote villages without any mobile signal"}
              </p>
            </div>

            {isIOS ? (
              <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 text-xs space-y-2 text-slate-700 dark:text-slate-300">
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  {lang === "te" ? "ఐఫోన్ (Safari) లో:" : "On iPhone / iPad (Safari):"}
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>{lang === "te" ? "సఫారీ క్రింద 'Share' (షేర్) బటన్ నొక్కండి" : "Tap 'Share' icon at bottom"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>{lang === "te" ? "'Add to Home Screen' ను ఎంచుకోండి" : "Select 'Add to Home Screen'"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                  <span>{lang === "te" ? "పై కుడి వైపు 'Add' నొక్కండి" : "Tap 'Add' on top right"}</span>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-4 text-xs space-y-2 text-slate-700 dark:text-slate-300">
                <p className="font-bold text-slate-900 dark:text-slate-100">
                  {lang === "te" ? "ఆండ్రాయిడ్ (Chrome) లో:" : "On Android (Chrome):"}
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold">1</span>
                  <span>{lang === "te" ? "బ్రౌజర్ పైన కుడివైపు 3 చుక్కలు (⋮) నొక్కండి" : "Tap the 3 dots (⋮) in Chrome"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold">2</span>
                  <span>{lang === "te" ? "'Add to Home screen' లేదా 'Install app' నొక్కండి" : "Tap 'Add to Home screen' or 'Install app'"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-600 text-white flex items-center justify-center text-[10px] font-bold">3</span>
                  <span>{lang === "te" ? "'Install' కన్ఫర్మ్ చేయండి" : "Confirm 'Install'"}</span>
                </div>
              </div>
            )}

            <button
              onClick={() => setShowPwaGuide(false)}
              className="w-full py-3 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 font-bold text-xs cursor-pointer active:scale-98 transition-all"
            >
              {lang === "te" ? "సరే (Got it)" : "Got It"}
            </button>
          </div>
        </div>
      )}

      {/* Clear All Data / Start Fresh Confirmation Modal */}
      {showClearModal && onClearAllData && (
        <div
          className="fixed inset-0 bg-slate-900/65 z-50 flex items-center justify-center p-4"
          onClick={() => setShowClearModal(false)}
        >
          <div
            className="rounded-3xl p-6 max-w-sm w-full bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-black text-base text-slate-900 dark:text-slate-100">
                {lang === "te" ? "అన్ని డేటా క్లియర్ చేయాలా?" : "Clear All Ledger Data?"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {lang === "te"
                  ? "ఇది ప్రస్తుత గ్రామాలు, ఖాతాదారులు, వసూళ్లు మరియు ఖర్చులన్నింటినీ తొలగించి కొత్తగా ప్రారంభిస్తుంది."
                  : "This permanently clears all villages, borrowers, collections, and expenses on this device so you can start completely fresh."}
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Villages</span>
                <span className="font-black text-slate-800 dark:text-slate-200">{data.villages.length}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Borrowers</span>
                <span className="font-black text-slate-800 dark:text-slate-200">
                  {Object.values(data.borrowers).flat().length}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Collections</span>
                <span className="font-black text-slate-800 dark:text-slate-200">{collectionsCount}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase">Expenses</span>
                <span className="font-black text-slate-800 dark:text-slate-200">{expensesCount}</span>
              </div>
            </div>

            <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={resetProfileToo}
                onChange={(e) => setResetProfileToo(e.target.checked)}
                className="w-4 h-4 accent-red-600 rounded"
              />
              <span className="font-semibold">
                {lang === "te"
                  ? "లైన్ పేరు & పిన్ (1234) కూడా రీసెట్ చేయండి"
                  : "Also reset Line Name & PIN back to default (1234)"}
              </span>
            </label>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowClearModal(false);
                  setResetProfileToo(false);
                }}
                className="flex-1 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200"
              >
                {lang === "te" ? "రద్దు" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAllData({ includeProfileAndPin: resetProfileToo });
                  setWaRules(getWhatsAppRules());
                  setLastCloudTime("");
                  setShowClearModal(false);
                  setResetProfileToo(false);
                  setActiveSection("main");
                }}
                className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs cursor-pointer shadow-md"
              >
                {lang === "te" ? "అవును, క్లియర్ చేయండి" : "Yes, Clear All Data"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
