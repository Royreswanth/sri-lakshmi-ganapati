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
} from "lucide-react";
import { Village, BusinessProfile, Language, Borrower, ThemeMode, EmblemType, WhatsAppRules } from "../types";
import { translations } from "../translations";
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
import { BusinessEmblem } from "./BusinessEmblem";
import {
  uploadCloudBackup,
  getCloudBackupsList,
  restoreFromCloudBackup,
  deleteCloudBackup,
  getLenderCloudId,
  CloudBackupRecord,
} from "../services/firebaseBackup";
import { usePWAInstall } from "../hooks/usePWAInstall";

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
  lang: Language;
  theme: ThemeMode;
  onToggleLang: () => void;
  onToggleTheme: () => void;
  onLock: () => void;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  pin,
  onUpdatePin,
  data,
  onUpdateData,
  profile,
  onUpdateProfile,
  lang,
  theme,
  onToggleLang,
  onToggleTheme,
  onLock,
  showToast,
}) => {
  const [activeSection, setActiveSection] = useState<
    "main" | "pin" | "profile" | "villages" | "backup" | "subscription" | "whatsapp"
  >("main");

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
  const [vDay, setVDay] = useState<"Monday" | "Tuesday">("Monday");
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
      businessName: bizName.trim() || "Sri Lakshmi Ganapati",
      tagline: tagline.trim() || "FINANCE & LINE",
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
    showToast(
      lang === "te" ? "లైన్ బ్యాకప్ డౌన్‌లోడ్ పూర్తయింది ✓" : "Backup downloaded ✓",
      "success"
    );
  };

  const handleShareBackup = async () => {
    const payload = generateBackupPayload();
    await shareBackupFile(payload);
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

  // Cloud Backup State & Handlers
  const [cloudSyncing, setCloudSyncing] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<CloudBackupRecord[]>([]);
  const [loadingCloudBackups, setLoadingCloudBackups] = useState(false);
  const [lastCloudTime, setLastCloudTime] = useState<string>(
    () => localStorage.getItem("slg_last_cloud_backup") || ""
  );
  const [autoCloudEnabled, setAutoCloudEnabled] = useState<boolean>(
    () => localStorage.getItem("slg_auto_cloud_disabled") !== "true"
  );
  const [cloudId] = useState<string>(() => getLenderCloudId());
  const [confirmRestoreCloud, setConfirmRestoreCloud] = useState<CloudBackupRecord | null>(null);

  const fetchCloudBackups = async () => {
    setLoadingCloudBackups(true);
    try {
      const list = await getCloudBackupsList();
      setCloudBackups(list);
    } catch (e) {
      console.warn("Failed to load cloud backups", e);
    } finally {
      setLoadingCloudBackups(false);
    }
  };

  useEffect(() => {
    if (activeSection === "backup") {
      fetchCloudBackups();
      setLastCloudTime(localStorage.getItem("slg_last_cloud_backup") || "");
    }
  }, [activeSection]);

  const handleSyncCloud = async () => {
    setCloudSyncing(true);
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
  };

  return (
    <div className="pb-28 px-4 pt-3 max-w-lg mx-auto space-y-4">
      {/* Prominent Back Button on all sub-sections */}
      {activeSection !== "main" && (
        <div className="flex items-center gap-3 mb-2">
          <button
            onClick={() => setActiveSection("main")}
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-all"
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
                : lang === "te"
                ? "వ్యాపార ప్రొఫైల్ & లోగో"
                : "Business Profile & Logo"}
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {lang === "te" ? "సెట్టింగ్స్ మెనూ కి తిరిగి వెళ్ళండి" : "Tap back to return"}
            </p>
          </div>
        </div>
      )}

      {/* MAIN SETTINGS MENU */}
      {activeSection === "main" && (
        <div className="space-y-3.5">
          {/* Software Plan Banner */}
          <div
            onClick={() => setActiveSection("subscription")}
            style={{ backgroundColor: "#8c4747" }}
            className="rounded-3xl p-5 cursor-pointer border-2 border-amber-500/50 hover:border-amber-500/80 transition-all flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-3.5">
              <div
                style={{ backgroundColor: "#d98509" }}
                className="w-12 h-12 rounded-2xl text-slate-950 flex items-center justify-center shadow-xs shrink-0"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-crown w-6 h-6"
                  style={{ backgroundColor: "#de762d" }}
                  aria-hidden="true"
                >
                  <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                  <path d="M5 21h14" style={{ backgroundColor: "#b79b08" }} />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                  {lang === "te" ? "వాణిజ్య సాఫ్ట్‌వేర్ సభ్యత్వం" : "Commercial Software Membership"}
                </span>
                <h3 className="text-lg font-black text-slate-950 dark:text-white leading-tight">
                  LineBook Pro
                </h3>
                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mt-0.5">
                  6 Months (₹1,199) · 12 Months (₹1,999) · Custom App
                </p>
              </div>
            </div>
            <div className="px-3.5 py-1.5 rounded-full bg-[#1E3A8A] text-white font-bold text-xs shadow-sm shrink-0">
              {lang === "te" ? "ప్లాన్లు" : "Plans"}
            </div>
          </div>

          {/* Dark / Light Mode Toggle Card (C-0.1 Item 7) */}
          <div
            onClick={onToggleTheme}
            className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm flex items-center justify-between cursor-pointer hover:border-slate-400 dark:hover:border-slate-700 transition-all"
          >
            <div className="flex items-center gap-3">
              <div
                style={{ backgroundColor: "#000000" }}
                className="w-10 h-10 rounded-xl text-amber-400 flex items-center justify-center"
              >
                {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5 text-slate-200" />}
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {lang === "te" ? "డిస్ప్లే థీమ్ (Theme)" : "Appearance & Theme"}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {theme === "dark"
                    ? lang === "te"
                      ? "డార్క్ మోడ్ యాక్టివ్ (రాత్రి లైన్)"
                      : "Dark Mode Active (Night Line)"
                    : lang === "te"
                    ? "లైట్ మోడ్ యాక్టివ్ (పగలు)"
                    : "Light Mode Active (Day Soft Pearl)"}
                </p>
              </div>
            </div>
            <span className="font-bold text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
              {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
            </span>
          </div>

          {/* Quick Language Toggle */}
          <div
            onClick={onToggleLang}
            className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm flex items-center justify-between cursor-pointer hover:border-slate-400 dark:hover:border-slate-700 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {lang === "te" ? "యాప్ భాష (Language)" : "Language"}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === "en" ? "English active" : "తెలుగు యాక్టివ్"}
                </p>
              </div>
            </div>
            <span className="font-bold text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-blue-900 dark:text-blue-300 border border-slate-200 dark:border-slate-700">
              {lang === "en" ? "తెలుగుకి మార్చండి" : "Switch to English"}
            </span>
          </div>

          {/* Business / Line Name (Receipt Branding & Custom Logo) */}
          <div
            onClick={() => setActiveSection("profile")}
            className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-amber-500/40 dark:border-amber-500/30 shadow-sm flex items-center justify-between cursor-pointer hover:border-amber-500 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center p-1.5 shrink-0">
                <BusinessEmblem emblem={profile.emblem || "ganesha"} size={26} color={profile.brandColor || "#D97706"} />
              </div>
              <div>
                <h4
                  className="font-black text-sm truncate max-w-[200px]"
                  style={{ color: profile.brandColor || "#D97706" }}
                >
                  {profile.businessName || "LineBook Pro"}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === "te"
                    ? "🏢 మీ లైన్ పేరు, లోగో & రశీదు వివరాలు మార్చండి"
                    : "🏢 Business / Line Name, Emblem & Brand Color"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                {lang === "te" ? "మార్చండి" : "Edit Name"}
              </span>
              <span className="text-slate-400">›</span>
            </div>
          </div>

          {/* Line Villages */}
          <div
            onClick={() => setActiveSection("villages")}
            className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm flex items-center justify-between cursor-pointer hover:border-slate-400 dark:hover:border-slate-700 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Plus className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {lang === "te" ? "లైన్ గ్రామాలు (Line Villages)" : "Line Villages"}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {data.villages.length} {lang === "te" ? "గ్రామాలు నమోదయ్యాయి" : "villages active"}
                </p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </div>

          {/* WhatsApp Rules & Automation (Requirement 2) */}
          <div
            onClick={() => setActiveSection("whatsapp")}
            className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-emerald-500/40 dark:border-emerald-500/30 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-500 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span>{lang === "te" ? "వాట్సాప్ ఆటోమేషన్ & నియమాలు" : "WhatsApp Automation & Rules"}</span>
                  {waRules.masterEnabled ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[9px] font-black flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      ACTIVE
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-[9px] font-bold">
                      OFF
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === "te"
                    ? "ఆటో-రశీదులు, 2-రోజుల రిమైండర్లు & కీప్యాడ్ ఫోన్లు"
                    : "Auto-receipts, 2-day advance reminders & keypad mobiles"}
                </p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </div>

          {/* Backup & Restore (Fix B1 + Firebase Cloud Auto-Sync) */}
          <div
            onClick={() => setActiveSection("backup")}
            className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-blue-500/40 dark:border-blue-500/30 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-500 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span>{lang === "te" ? "క్లౌడ్ బ్యాకప్ & రీస్టోర్" : "Cloud Backup & Restore"}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[9px] font-black flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    CLOUD VAULT
                  </span>
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === "te"
                    ? "ఫైర్‌బేస్ ఆటో-సింక్ & వాట్సాప్ బ్యాకప్"
                    : "Firebase Auto-Sync & Local Backup"}
                </p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </div>

          {/* Install Mobile App (PWA) & Offline Village Mode */}
          <div
            onClick={async () => {
              if (isInstalled) {
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
                      ? "శ్రీ లక్ష్మీ గణపతి యాప్ హోమ్‌స్క్రీన్‌కు జోడించబడింది!"
                      : "Sri Lakshmi Ganapati added to Home Screen!",
                    "success"
                  );
                }
              } else {
                setShowPwaGuide(true);
              }
            }}
            className="rounded-2xl p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/20 dark:to-transparent border border-amber-500/40 dark:border-amber-500/30 shadow-sm flex items-center justify-between cursor-pointer hover:border-amber-500 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span>{lang === "te" ? "మొబైల్ యాప్ (PWA)" : "Install Mobile App (PWA)"}</span>
                  {isInstalled ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-[9px] font-black flex items-center gap-1">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      {lang === "te" ? "ఇన్‌స్టాల్ అయింది" : "INSTALLED"}
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-[9px] font-black">
                      OFFLINE READY
                    </span>
                  )}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isInstalled
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
          </div>

          {/* Change PIN (Fix D1) */}
          <div
            onClick={() => setActiveSection("pin")}
            className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800/90 shadow-sm flex items-center justify-between cursor-pointer hover:border-slate-400 dark:hover:border-slate-700 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">
                  {lang === "te" ? "లాక్ పిన్ మార్చండి" : "Change Security PIN"}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  ఖచ్చితంగా 4 అంకెల పిన్
                </p>
              </div>
            </div>
            <span className="text-slate-400">›</span>
          </div>

          {/* Lock App Now Button */}
          <button
            onClick={onLock}
            style={{ backgroundColor: "#000000" }}
            className="w-full py-3.5 rounded-2xl border border-red-200 dark:border-red-900/50 text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98 transition-all shadow-sm"
          >
            <Lock className="w-4 h-4" />
            <span style={{ backgroundColor: "#000000", color: "#ffffff" }}>
              {lang === "te" ? "యాప్ లాక్ చేయండి" : "Lock Application Now"}
            </span>
          </button>
        </div>
      )}

      {/* SUBSCRIPTION PLANS (Exactly 3 Plans: 6 Months, 12 Months, Custom App) */}
      {activeSection === "subscription" && (
        <div className="space-y-4">
          <div className="rounded-3xl p-5 text-center bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto mb-2">
              <Crown className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">
              {lang === "te" ? "లైన్‌బుక్ ప్రో ప్లాన్లు" : "LineBook Pro Plans"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
              {lang === "te"
                ? "గ్రామీణ మైక్రోఫైనాన్స్ వ్యాపారుల కోసం ప్రత్యేకంగా రూపొందించబడింది. ఉచిత ప్లాన్ లేదు."
                : "Engineered for weekly village micro-lenders. All features included in every plan."}
            </p>
          </div>

          <div className="space-y-3.5">
            {/* PLAN 1: 6 MONTHS PLAN */}
            <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border-2 border-slate-300/80 dark:border-slate-700 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Half-Yearly License
                  </span>
                  <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    6 Months Plan
                  </h4>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900 dark:text-slate-100">₹1,199</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">/ 6 Months</div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Unlimited Borrowers & Villages on Line</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>1-Tap WhatsApp Payment Receipts</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>2-Day Advance Village Reminders</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>100% Private Offline Local Storage</span>
                </div>
              </div>

              <button
                onClick={() =>
                  window.open(
                    `https://wa.me/919876543210?text=${encodeURIComponent(
                      "Hi! I want to activate LineBook Pro 6 Months Plan for ₹1,199."
                    )}`,
                    "_blank"
                  )
                }
                className="w-full py-3 rounded-2xl bg-[#1E3A8A] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer hover:bg-blue-900 mt-2 shadow-sm"
              >
                <span>Select 6 Months Plan</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* PLAN 2: 12 MONTHS PLAN (BEST VALUE) */}
            <div className="rounded-3xl p-5 border-2 border-amber-400 bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent space-y-3 relative shadow-md">
              <span className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-[10px] tracking-wider uppercase shadow-xs">
                BEST VALUE ★
              </span>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    Annual Full License
                  </span>
                  <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    12 Months Plan
                  </h4>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-amber-600 dark:text-amber-400">₹1,999</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    (₹166/month only)
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Everything in 6 Months Plan</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Priority WhatsApp VIP Support</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Save ₹400 compared to half-yearly</span>
                </div>
              </div>

              <button
                onClick={() =>
                  window.open(
                    `https://wa.me/919876543210?text=${encodeURIComponent(
                      "Hi! I want to activate LineBook Pro 12 Months Plan for ₹1,999."
                    )}`,
                    "_blank"
                  )
                }
                className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md mt-2"
              >
                <span>Select 12 Months Plan (₹1,999)</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* PLAN 3: CUSTOM APP PLAN */}
            <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border-2 border-purple-300 dark:border-purple-800 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">
                    Bespoke Engineered
                  </span>
                  <h4 className="text-lg font-black text-slate-900 dark:text-slate-100">
                    Custom App Plan
                  </h4>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-purple-700 dark:text-purple-400">₹4,999+</div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">One-Time Setup</div>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Custom Business Name & Unique App Icon</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Add Custom Fields & Rules by Lender Request</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                  <span>Direct Developer Consultation & Updates</span>
                </div>
              </div>

              <button
                onClick={() =>
                  window.open(
                    `https://wa.me/919876543210?text=${encodeURIComponent(
                      "Hi! I want to discuss a Custom App for my microfinance business."
                    )}`,
                    "_blank"
                  )
                }
                className="w-full py-3 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer mt-2 shadow-sm"
              >
                <span>Request Custom App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BACKUP & RESTORE SECTION */}
      {activeSection === "backup" && (
        <div className="space-y-4">
          {/* 1. Firebase Cloud Auto-Backup Card */}
          <div className="rounded-3xl p-5 bg-gradient-to-br from-blue-900/10 via-sky-500/5 to-transparent dark:from-blue-950/40 dark:via-sky-950/20 bg-white dark:bg-[#131B2E] border-2 border-blue-500/40 dark:border-blue-500/30 space-y-4 shadow-sm relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                  <Cloud className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 dark:text-slate-100 text-base flex items-center gap-2">
                    <span>{lang === "te" ? "ఫైర్‌బేస్ క్లౌడ్ ఆటో-బ్యాకప్" : "Firebase Cloud Auto-Backup"}</span>
                  </h3>
                  <p className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold">
                    {lang === "te" ? "సురక్షిత క్లౌడ్ వాల్ట్" : "Encrypted Cloud Vault (Zero Data Loss)"}
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-[10px] font-black flex items-center gap-1.5 border border-emerald-500/30 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                ACTIVE
              </span>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {lang === "te"
                ? "మీ గ్రామాల ఖాతా లెడ్జర్ సురక్షితంగా క్లౌడ్‌లో సేవ్ అవుతుంది. ఫోన్ పగిలిపోయినా, పోయినా లేదా కొత్త ఫోన్ మార్చినా మీ డేటా 100% రక్షించబడి ఉంటుంది."
                : "Your village lending ledger is securely backed up to Firebase Cloud Storage. If your mobile phone is ever damaged or replaced, you can restore all records in 1 tap."}
            </p>

            {/* Cloud Vault Info Row */}
            <div className="p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200/90 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-500" />
                  <span>Device Cloud Vault ID</span>
                </span>
                <span className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[180px]">
                  {cloudId}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Last Cloud Backup</span>
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
              onClick={handleSyncCloud}
              disabled={cloudSyncing}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-800 hover:to-indigo-800 text-white font-black text-xs flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all disabled:opacity-50"
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

          {/* 2. Cloud Snapshots List */}
          <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <Database className="w-4 h-4 text-indigo-600" />
                <span>
                  {lang === "te" ? "క్లౌడ్ స్నాప్‌షాట్ల చరిత్ర" : "Cloud Snapshots"} ({cloudBackups.length})
                </span>
              </h4>
              <button
                onClick={fetchCloudBackups}
                disabled={loadingCloudBackups}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1 cursor-pointer hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingCloudBackups ? "animate-spin" : ""}`} />
                <span>{lang === "te" ? "రిఫ్రెష్" : "Refresh"}</span>
              </button>
            </div>

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
                          ₹{bk.totalLent.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setConfirmRestoreCloud(bk)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs cursor-pointer shadow-xs transition-all"
                      >
                        {lang === "te" ? "రీస్టోర్" : "Restore"}
                      </button>
                      <button
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
              ⚠️ A safety snapshot of your current device data will be preserved automatically before restoring.
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmRestoreCloud(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRestoreCloud(confirmRestoreCloud)}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs cursor-pointer hover:bg-blue-700"
              >
                Confirm & Restore
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
                required
                maxLength={4}
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value)}
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
                  onChange={(e) => setVDay(e.target.value as "Monday" | "Tuesday")}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="Monday">Monday (సోమవారం)</option>
                  <option value="Tuesday">Tuesday (మంగళవారం)</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-[#1E3A8A] text-white font-bold text-xs cursor-pointer shadow-md hover:bg-blue-900"
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
                  className="rounded-2xl p-4 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs shadow-sm"
                >
                  <div>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{v.name}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {v.day} · {bCount} {lang === "te" ? "ఖాతాదారులు" : "borrowers"}
                    </p>
                  </div>

                  <button
                    onClick={() => setDeleteVillageConfirm(v)}
                    className="px-3 py-1.5 rounded-xl bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 font-bold text-xs cursor-pointer hover:bg-red-200"
                  >
                    Remove
                  </button>
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
                  Remove Village?
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Are you sure you want to remove "{deleteVillageConfirm.name}"?
                  All associated borrowers will be deleted.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDeleteVillageConfirm(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleRemoveVillage(deleteVillageConfirm.id)}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs cursor-pointer hover:bg-red-700"
                  >
                    Yes, Remove
                  </button>
                </div>
              </div>
            </div>
          )}
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
                {bizName || "Sri Lakshmi Ganapati"}
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
                Finance Business Name *
              </label>
              <input
                type="text"
                required
                value={bizName}
                onChange={(e) => setBizName(e.target.value)}
                placeholder="e.g. Sri Lakshmi Ganapati Finance"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-bold outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 uppercase tracking-wide">
                Tagline
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
                Owner / Manager Name
              </label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1 uppercase tracking-wide">
                Contact Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="10-digit phone number"
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
    </div>
  );
};
