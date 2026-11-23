import React, { useState } from "react";
import {
  Crown,
  KeyRound,
  Copy,
  Check,
  CheckCircle2,
  ExternalLink,
  Lock,
  Sun,
  Moon,
  ShieldAlert,
  Cloud,
  RefreshCw,
  LogOut,
  MessageCircle,
  Sparkles,
} from "lucide-react";
import { BusinessProfile, Language, ThemeMode } from "../types";
import { BusinessEmblem } from "./BusinessEmblem";
import { GoogleVaultUser } from "../services/firebaseBackup";
import {
  OWNER_WHATSAPP_DISPLAY,
  OWNER_WHATSAPP_NUMBER,
  PaidOrFreePlanId,
  SUBSCRIPTION_PLANS,
  SubscriptionAccessEvaluation,
  buildSubscriptionWhatsAppUrl,
  verifyActivationKey,
} from "../utils/licenseUtils";

interface SubscriptionPaywallProps {
  profile: BusinessProfile;
  deviceId: string;
  access: SubscriptionAccessEvaluation;
  lang: Language;
  theme: ThemeMode;
  googleUser: GoogleVaultUser | null;
  googleSigningIn: boolean;
  checkingCloudLicense: boolean;
  onToggleLang: () => void;
  onToggleTheme: () => void;
  onLock: () => void;
  onActivateKeySuccess: (params: {
    plan: PaidOrFreePlanId;
    expiresAt: string;
    licenseKey: string;
  }) => void;
  onGoogleSignIn: () => Promise<void>;
  onGoogleSignOut: () => Promise<void>;
  onCheckCloudLicense: () => Promise<void>;
  showToast: (msg: string, type?: "success" | "error" | "info") => void;
}

export const SubscriptionPaywall: React.FC<SubscriptionPaywallProps> = ({
  profile,
  deviceId,
  access,
  lang,
  theme,
  googleUser,
  googleSigningIn,
  checkingCloudLicense,
  onToggleLang,
  onToggleTheme,
  onLock,
  onActivateKeySuccess,
  onGoogleSignIn,
  onGoogleSignOut,
  onCheckCloudLicense,
  showToast,
}) => {
  const [keyInput, setKeyInput] = useState("");
  const [keyError, setKeyError] = useState("");
  const [copiedId, setCopiedId] = useState(false);

  const isExpired = access.reason === "expired";
  const isRevoked = access.reason === "revoked";

  const handleCopyDeviceId = async () => {
    try {
      await navigator.clipboard.writeText(deviceId);
      setCopiedId(true);
      showToast(
        lang === "te" ? "డివైస్ ఐడీ కాపీ అయింది ✓" : "Device ID copied ✓",
        "info"
      );
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      showToast(deviceId, "info");
    }
  };

  const handleActivateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyError("");
    const result = verifyActivationKey(keyInput, deviceId);
    if (!result.valid || !result.plan || !result.expiresAt) {
      setKeyError(
        result.error ||
          (lang === "te" ? "చెల్లని యాక్టివేషన్ కీ" : "Invalid Activation Key")
      );
      return;
    }

    onActivateKeySuccess({
      plan: result.plan,
      expiresAt: result.expiresAt,
      licenseKey: keyInput.trim().toUpperCase(),
    });
  };

  const plan6M = SUBSCRIPTION_PLANS.half_yearly;
  const plan12M = SUBSCRIPTION_PLANS.yearly;
  const planCustom = SUBSCRIPTION_PLANS.custom_app;

  const waSupportUrl = `https://wa.me/${OWNER_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    lang === "te"
      ? `నమస్కారం! నా LineBook Pro సబ్‌స్క్రిప్షన్ గురించి సహాయం కావాలి.\nDevice ID: ${deviceId}`
      : `Hi! I need help activating my LineBook Pro subscription.\nDevice ID: ${deviceId}`
  )}`;

  return (
    <div
      className={`min-h-screen font-sans flex flex-col transition-colors ${
        theme === "dark"
          ? "dark bg-[#0B0F19] text-slate-100"
          : "bg-[#EDF1F7] text-slate-900"
      }`}
    >
      {/* Top Bar */}
      <header className="px-4 py-3 sticky top-0 z-40 backdrop-blur-md bg-white/85 dark:bg-[#0B0F19]/85 border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-lg md:max-w-3xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
              <BusinessEmblem
                emblem={profile.emblem || "ganesha"}
                size={22}
                color={profile.brandColor || "#D97706"}
              />
            </div>
            <div className="min-w-0">
              <h1
                className="text-sm sm:text-base font-black truncate leading-tight"
                style={{ color: profile.brandColor || "#D97706" }}
              >
                {profile.businessName || "LineBook Pro"}
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {lang === "te" ? "సబ్‌స్క్రిప్షన్ అవసరం" : "SUBSCRIPTION GATE"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle Theme"
              className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-700" />
              )}
            </button>
            <button
              type="button"
              onClick={onToggleLang}
              aria-label="Toggle Language"
              className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <span className="text-[11px] font-black">
                {lang === "en" ? "తె" : "EN"}
              </span>
            </button>
            <button
              type="button"
              onClick={onLock}
              aria-label="Lock App"
              className="w-9 h-9 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <Lock className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-lg md:max-w-3xl mx-auto px-4 py-5 space-y-5 pb-12">
        {/* Status & Device ID Banner */}
        <section className="rounded-3xl p-5 sm:p-6 bg-gradient-to-br from-[#0B1728] via-[#13294B] to-[#0A121E] text-white border border-amber-400/50 shadow-xl space-y-4">
          <div className="flex items-start gap-3.5">
            <div
              className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                isRevoked || isExpired
                  ? "bg-rose-500/20 border-rose-400/50 text-rose-300"
                  : "bg-amber-400/20 border-amber-400/50 text-amber-300"
              }`}
            >
              {isRevoked || isExpired ? (
                <ShieldAlert className="w-6 h-6" />
              ) : (
                <Crown className="w-6 h-6" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <span
                className={`inline-block text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-1.5 ${
                  isRevoked
                    ? "bg-rose-500/25 text-rose-200"
                    : isExpired
                    ? "bg-amber-500/25 text-amber-200"
                    : "bg-amber-400/20 text-amber-300"
                }`}
              >
                {isRevoked
                  ? lang === "te"
                    ? "లైసెన్స్ నిలిపివేయబడింది"
                    : "LICENSE SUSPENDED"
                  : isExpired
                  ? lang === "te"
                    ? "సబ్‌స్క్రిప్షన్ గడువు ముగిసింది"
                    : "SUBSCRIPTION EXPIRED"
                  : lang === "te"
                  ? "యాక్టివ్ సబ్‌స్క్రిప్షన్ అవసరం"
                  : "ACTIVATION REQUIRED"}
              </span>

              <h2 className="text-lg sm:text-xl font-black text-white leading-snug">
                {isRevoked
                  ? lang === "te"
                    ? "ఈ డివైస్ లైసెన్స్ నిలిపివేయబడింది"
                    : "Your License Was Suspended"
                  : isExpired
                  ? lang === "te"
                    ? `మీ ప్లాన్ (${access.expiresAt}) ముగిసింది — కొనసాగించడానికి రీన్యూ చేయండి`
                    : `Your Plan Expired on ${access.expiresAt}`
                  : lang === "te"
                  ? "LineBook Pro ఉపయోగించడానికి సబ్‌స్క్రిప్షన్ తీసుకోండి"
                  : "Subscribe to Unlock LineBook Pro"}
              </h2>

              <p className="text-xs text-slate-200/90 mt-1.5 leading-relaxed">
                {lang === "te"
                  ? "మీరు ఒక ప్లాన్ ఎంచుకుని WhatsApp ద్వారా యాక్టివేషన్ కీ పొందే వరకు ఏ యాప్ ఫంక్షన్లు పనిచేయవు. (మీ డేటా సురక్షితంగా ఉంటుంది.)"
                  : "All collection, borrower ledger, calculator & report features stay locked until an active license is verified for your device."}
              </p>
            </div>
          </div>

          {/* Device ID Copy Strip */}
          <div className="rounded-2xl bg-black/35 border border-white/15 p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 block">
                {lang === "te" ? "మీ డివైస్ ఐడీ (Device ID)" : "Your Unique Device ID"}
              </span>
              <span className="font-mono font-black text-base text-amber-300 tracking-wider select-all">
                {deviceId}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyDeviceId}
              className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs flex items-center gap-1.5 shrink-0 cursor-pointer transition-all"
            >
              {copiedId ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{lang === "te" ? "కాపీ అయింది" : "Copied"}</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>{lang === "te" ? "కాపీ" : "Copy ID"}</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Enter Activation Key + Cloud License Verification */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Activation Key Form */}
          <form
            onSubmit={handleActivateSubmit}
            className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-sm space-y-3.5"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                  {lang === "te"
                    ? "యాక్టివేషన్ కీతో అన్‌లాక్ చేయండి"
                    : "Have an Activation Key?"}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === "te"
                    ? "WhatsApp లో వచ్చిన కీ ని ఇక్కడ నమోదు చేయండి"
                    : "Enter the license key received via WhatsApp"}
                </p>
              </div>
            </div>

            <div>
              <label
                htmlFor="license-key-input"
                className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5"
              >
                {lang === "te" ? "లైసెన్స్ కీ (Activation Key)" : "Activation Key"}
              </label>
              <input
                id="license-key-input"
                type="text"
                value={keyInput}
                onChange={(e) => {
                  setKeyInput(e.target.value.toUpperCase());
                  setKeyError("");
                }}
                placeholder="SLG-12M-20270520-XXXXXXXX"
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white font-mono text-xs sm:text-sm uppercase focus:outline-none focus:border-amber-500"
              />
            </div>

            {keyError && (
              <p className="text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900">
                {keyError}
              </p>
            )}

            <button
              type="submit"
              className="w-full min-h-[44px] py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
            >
              <KeyRound className="w-4 h-4" />
              <span>
                {lang === "te" ? "కీ వెరిఫై & అన్‌లాక్" : "Activate & Unlock App"}
              </span>
            </button>
          </form>

          {/* Google Cloud License Auto-Check */}
          <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-3.5">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                  <Cloud className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900 dark:text-slate-100">
                    {lang === "te"
                      ? "క్లౌడ్ లైసెన్స్ & అడ్మిన్ సైన్-ఇన్"
                      : "Cloud License / Owner Login"}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {lang === "te"
                      ? "Google ఖాతా ద్వారా ఆన్‌లైన్ లైసెన్స్ తనిఖీ చేయండి"
                      : "Verify active Google subscription or Owner Admin access"}
                  </p>
                </div>
              </div>

              {googleUser && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                    {googleUser.email}
                  </span>
                  <button
                    type="button"
                    onClick={() => void onGoogleSignOut()}
                    className="text-[11px] font-bold text-slate-500 hover:text-rose-600 flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{lang === "te" ? "లాగ్‌అవుట్" : "Sign Out"}</span>
                  </button>
                </div>
              )}
            </div>

            {!googleUser ? (
              <button
                type="button"
                onClick={() => void onGoogleSignIn()}
                disabled={googleSigningIn}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60"
              >
                <Cloud className="w-4 h-4" />
                <span>
                  {googleSigningIn
                    ? lang === "te"
                      ? "కనెక్ట్ అవుతోంది..."
                      : "Connecting Google..."
                    : lang === "te"
                    ? "Google తో సైన్ ఇన్ చేయండి"
                    : "Sign in with Google"}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void onCheckCloudLicense()}
                disabled={checkingCloudLicense}
                className="w-full min-h-[44px] py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-60"
              >
                <RefreshCw
                  className={`w-4 h-4 ${checkingCloudLicense ? "animate-spin" : ""}`}
                />
                <span>
                  {checkingCloudLicense
                    ? lang === "te"
                      ? "తనిఖీ చేస్తోంది..."
                      : "Checking License..."
                    : lang === "te"
                    ? "క్లౌడ్ లైసెన్స్ రిఫ్రెష్ చేయండి"
                    : "Check Cloud Subscription"}
                </span>
              </button>
            )}
          </div>
        </section>

        {/* Pricing Plans Grid */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {lang === "te"
                ? "సబ్‌స్క్రిప్షన్ ప్లాన్‌లు ఎంచుకోండి"
                : "Choose Your Plan"}
            </h3>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              WhatsApp {OWNER_WHATSAPP_DISPLAY}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* 6 Months Plan - ₹1,599 */}
            <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border-2 border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4 shadow-sm">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Half-Yearly
                    </span>
                    <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                      {lang === "te" ? plan6M.nameTe : plan6M.nameEn}
                    </h4>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-slate-900 dark:text-slate-100">
                      {plan6M.priceLabel}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                      {lang === "te" ? plan6M.periodLabelTe : plan6M.periodLabelEn}
                    </div>
                  </div>
                </div>

                <ul className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {lang === "te"
                        ? "అపరిమిత గ్రామాలు & ఖాతాదారులు"
                        : "Unlimited Villages & Borrowers"}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {lang === "te"
                        ? "రోజు / వారం / నెలవారీ వసూళ్లు"
                        : "Daily, Weekly & Monthly Line"}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {lang === "te"
                        ? "WhatsApp రశీదులు & క్యాష్‌బుక్"
                        : "WhatsApp Receipts & Cashbook"}
                    </span>
                  </li>
                </ul>
              </div>

              <a
                href={buildSubscriptionWhatsAppUrl({
                  plan: "half_yearly",
                  deviceId,
                  businessName: profile.businessName,
                  googleEmail: googleUser?.email,
                  lang,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[44px] py-2.5 px-3 rounded-2xl bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <span>
                  {lang === "te"
                    ? `6 నెలలు · ${plan6M.priceLabel}`
                    : `Buy 6 Months · ${plan6M.priceLabel}`}
                </span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* 12 Months Plan - ₹2,599 */}
            <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border-2 border-amber-400 flex flex-col justify-between space-y-4 relative shadow-md">
              <span className="absolute -top-3 right-5 px-3 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] tracking-wider uppercase">
                {lang === "te" ? plan12M.badgeTe || plan12M.badgeEn : plan12M.badgeEn}
              </span>

              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Annual Pro
                    </span>
                    <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                      {lang === "te" ? plan12M.nameTe : plan12M.nameEn}
                    </h4>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-amber-600 dark:text-amber-400">
                      {plan12M.priceLabel}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                      {lang === "te" ? plan12M.periodLabelTe : plan12M.periodLabelEn}
                    </div>
                  </div>
                </div>

                <ul className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {lang === "te"
                        ? "6 నెలల ప్లాన్ లోనివన్నీ + Google క్లౌడ్"
                        : "All Features + Google Cloud Sync"}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {lang === "te"
                        ? "పాస్‌బుక్, PDF & CSV రిపోర్టులు"
                        : "Passbook, PDF & CSV Exports"}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      {lang === "te"
                        ? "ప్రాధాన్యత WhatsApp సపోర్ట్"
                        : "Priority Support · Save ₹599"}
                    </span>
                  </li>
                </ul>
              </div>

              <a
                href={buildSubscriptionWhatsAppUrl({
                  plan: "yearly",
                  deviceId,
                  businessName: profile.businessName,
                  googleEmail: googleUser?.email,
                  lang,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[44px] py-2.5 px-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md transition-all"
              >
                <span>
                  {lang === "te"
                    ? `12 నెలలు · ${plan12M.priceLabel}`
                    : `Buy 12 Months · ${plan12M.priceLabel}`}
                </span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Custom App Plan - ₹4,999+ */}
            <div className="rounded-3xl p-5 bg-white dark:bg-[#131B2E] border-2 border-purple-300 dark:border-purple-800 flex flex-col justify-between space-y-4 shadow-sm">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 dark:text-purple-400">
                      Custom App
                    </span>
                    <h4 className="text-base font-black text-slate-900 dark:text-slate-100">
                      {lang === "te" ? planCustom.nameTe : planCustom.nameEn}
                    </h4>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-purple-700 dark:text-purple-400">
                      {planCustom.priceLabel}
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                      {lang === "te"
                        ? planCustom.periodLabelTe
                        : planCustom.periodLabelEn}
                    </div>
                  </div>
                </div>

                <ul className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>
                      {lang === "te"
                        ? "మీ స్వంత లోగో, పేరు & ప్రత్యేక యాప్"
                        : "Your Own Brand Name & Custom Icon"}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>
                      {lang === "te"
                        ? "మీ వ్యాపార నియమాల ప్రకారం మార్పులు"
                        : "Custom Loan Rules & Fields"}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-purple-600 shrink-0" />
                    <span>
                      {lang === "te"
                        ? "నేరుగా WhatsApp లో ఆర్డర్ చేయండి"
                        : "Direct Developer WhatsApp Setup"}
                    </span>
                  </li>
                </ul>
              </div>

              <a
                href={buildSubscriptionWhatsAppUrl({
                  plan: "custom_app",
                  deviceId,
                  businessName: profile.businessName,
                  googleEmail: googleUser?.email,
                  lang,
                })}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[44px] py-2.5 px-3 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
              >
                <span>
                  {lang === "te"
                    ? `కస్టమ్ యాప్ · ${planCustom.priceLabel}`
                    : `Request Custom App · ${planCustom.priceLabel}`}
                </span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </section>

        {/* Direct WhatsApp Help Desk Footer */}
        <section className="rounded-2xl p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-emerald-950 dark:text-emerald-200">
                {lang === "te"
                  ? "తక్షణ యాక్టివేషన్ కోసం WhatsApp చేయండి"
                  : "Instant Activation on WhatsApp"}
              </h4>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                {OWNER_WHATSAPP_DISPLAY} ·{" "}
                {lang === "te"
                  ? "మీ Device ID పంపి కీ పొందండి"
                  : "Send your Device ID to receive your Activation Key"}
              </p>
            </div>
          </div>
          <a
            href={waSupportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shrink-0"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{lang === "te" ? "WhatsApp చాట్" : "Chat on WhatsApp"}</span>
          </a>
        </section>
      </main>
    </div>
  );
};
