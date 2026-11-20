import React, { useState, useEffect } from "react";
import {
  Delete,
  Fingerprint,
  Globe,
  Shield,
  ArrowLeft,
  Lock,
  Smartphone,
} from "lucide-react";
import { Language, EmblemType } from "../types";
import { translations } from "../translations";
import { BusinessEmblem } from "./BusinessEmblem";

interface PinScreenProps {
  storedPin: string;
  onUnlock: () => void;
  businessName?: string;
  tagline?: string;
  emblem?: EmblemType | string;
  brandColor?: string;
  lang: Language;
  onToggleLang: () => void;
}

export const PinScreen: React.FC<PinScreenProps> = ({
  storedPin,
  onUnlock,
  businessName = "LineBook Pro",
  tagline = "FINANCE & LINE",
  emblem = "ganesha",
  brandColor = "#D97706",
  lang,
  onToggleLang,
}) => {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [shake, setShake] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [hasWebAuthnSupport, setHasWebAuthnSupport] = useState(false);

  // 5-Attempt Security Lockout Protection
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    try {
      return parseInt(sessionStorage.getItem("slg_pin_fails") || "0", 10);
    } catch {
      return 0;
    }
  });
  const [lockoutUntil, setLockoutUntil] = useState<number>(() => {
    try {
      return parseInt(sessionStorage.getItem("slg_pin_lockout") || "0", 10);
    } catch {
      return 0;
    }
  });
  const [remainingLockout, setRemainingLockout] = useState<number>(0);

  useEffect(() => {
    const checkLock = () => {
      const now = Date.now();
      if (lockoutUntil > now) {
        setRemainingLockout(Math.ceil((lockoutUntil - now) / 1000));
      } else {
        setRemainingLockout(0);
      }
    };
    checkLock();
    const interval = setInterval(checkLock, 500);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const t = translations[lang];

  // Detect whether the device/browser physically supports platform biometric credentials
  useEffect(() => {
    let isMounted = true;
    const checkSupport = async () => {
      try {
        if (
          window.PublicKeyCredential &&
          typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function"
        ) {
          const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
          if (isMounted) setHasWebAuthnSupport(!!available);
        } else {
          if (isMounted) setHasWebAuthnSupport(false);
        }
      } catch {
        if (isMounted) setHasWebAuthnSupport(false);
      }
    };
    checkSupport();
    return () => {
      isMounted = false;
    };
  }, []);

  // Web Audio Synth for authentic tactile/haptic cues
  const playAudio = (type: "touch" | "success" | "error") => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      if (type === "touch") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.05);
      } else if (type === "success") {
        // High-end fintech 2-tone unlock chime (C5 -> G5)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "triangle";
        osc1.frequency.setValueAtTime(523.25, now);
        gain1.gain.setValueAtTime(0.08, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.18);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(783.99, now + 0.12);
        gain2.gain.setValueAtTime(0.1, now + 0.12);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.12);
        osc2.stop(now + 0.35);
      } else if (type === "error") {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(150, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.22);
      }
    } catch {
      // Audio context silently ignored
    }
  };

  // TRUE MOBILE HARDWARE BIOMETRICS (WebAuthn / Android Fingerprint / iOS TouchID & FaceID)
  const triggerMobileFingerprint = async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setErr("");
    playAudio("touch");

    try {
      if (!window.PublicKeyCredential) {
        throw new Error("NOT_SUPPORTED");
      }

      // Check if platform authenticator (mobile fingerprint reader) is physically present
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (!available) {
        throw new Error("NOT_AVAILABLE");
      }

      const storedCredId = localStorage.getItem("slg_bio_cred_id");
      const challenge = crypto.getRandomValues(new Uint8Array(32));

      if (storedCredId) {
        // Authenticate using the lender's previously registered mobile device credential
        try {
          const rawId = Uint8Array.from(atob(storedCredId), (c) => c.charCodeAt(0));
          const assertion = await navigator.credentials.get({
            publicKey: {
              challenge,
              timeout: 60000,
              userVerification: "required", // STRICTLY requires user biometric / screen verification
              allowCredentials: [
                {
                  type: "public-key",
                  id: rawId,
                  transports: ["internal"],
                },
              ],
            },
          });

          if (assertion) {
            handleBiometricSuccess();
            return;
          }
        } catch (getErr: any) {
          // If the prompt was cancelled by user, stop and do NOT fall through to registration
          if (getErr?.name === "NotAllowedError" || getErr?.name === "AbortError") {
            throw getErr;
          }
          console.warn("Credential get failed, attempting fresh enrollment:", getErr);
        }
      }

      // First-time biometric registration on this phone (brings up Android / iOS system fingerprint prompt)
      const userId = crypto.getRandomValues(new Uint8Array(16));
      const credential = (await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: {
            name: businessName || "LineBook Pro",
          },
          user: {
            id: userId,
            name: "lender_admin",
            displayName: businessName || "Line Lender",
          },
          pubKeyCredParams: [
            { type: "public-key", alg: -7 },   // ES256
            { type: "public-key", alg: -257 }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: "platform", // Enforces device fingerprint / FaceID / screen lock
            userVerification: "required",        // Strictly requires biometric check
            requireResidentKey: false,
          },
          timeout: 60000,
          attestation: "none",
        },
      })) as PublicKeyCredential;

      if (credential && credential.rawId) {
        const rawIdBytes = new Uint8Array(credential.rawId);
        let binary = "";
        for (let i = 0; i < rawIdBytes.byteLength; i++) {
          binary += String.fromCharCode(rawIdBytes[i]);
        }
        localStorage.setItem("slg_bio_cred_id", btoa(binary));
        handleBiometricSuccess();
        return;
      }

      throw new Error("AUTH_FAILED");
    } catch (error: any) {
      console.warn("Mobile biometric verification error:", error);
      setIsAuthenticating(false);
      playAudio("error");
      setShake(true);
      setTimeout(() => setShake(false), 450);

      if (error?.name === "NotAllowedError" || error?.name === "AbortError") {
        setErr(
          lang === "te"
            ? "వేలిముద్ర రద్దు చేయబడింది. దయచేసి 4-అంకెల పిన్ నమోదు చేయండి."
            : "Mobile fingerprint cancelled. Please enter your 4-digit PIN."
        );
      } else if (error?.message === "NOT_SUPPORTED" || error?.message === "NOT_AVAILABLE") {
        setErr(
          lang === "te"
            ? "ఈ బ్రౌజర్‌లో మొబైల్ వేలిముద్ర సెన్సార్ అందుబాటులో లేదు. 4-అంకెల పిన్ వాడండి."
            : "Mobile biometric hardware unavailable in this browser. Use 4-digit PIN."
        );
      } else {
        setErr(
          lang === "te"
            ? "వేలిముద్ర సరిపోలలేదు. దయచేసి 4-అంకెల పిన్ నమోదు చేయండి."
            : "Fingerprint verification failed. Please enter your 4-digit PIN."
        );
      }
    }
  };

  // Called ONLY when the mobile operating system confirms verified fingerprint
  const handleBiometricSuccess = () => {
    setIsAuthenticating(false);
    playAudio("success");
    if (navigator.vibrate) navigator.vibrate([40, 80, 120]);
    onUnlock();
  };

  // PIN Keypad Press Handler
  const press = (k: string) => {
    if (remainingLockout > 0) {
      playAudio("error");
      setShake(true);
      setTimeout(() => setShake(false), 450);
      return;
    }
    if (k === "del") {
      setPin((p) => p.slice(0, -1));
      setErr("");
      return;
    }
    if (k === "bio") {
      triggerMobileFingerprint();
      return;
    }
    if (pin.length >= 4) return;
    const np = pin + k;
    setPin(np);

    if (np.length === 4) {
      setTimeout(() => {
        if (np === storedPin) {
          try {
            sessionStorage.removeItem("slg_pin_fails");
            sessionStorage.removeItem("slg_pin_lockout");
          } catch {}
          setFailedAttempts(0);
          setRemainingLockout(0);
          playAudio("success");
          onUnlock();
        } else {
          const newFails = failedAttempts + 1;
          setFailedAttempts(newFails);
          try {
            sessionStorage.setItem("slg_pin_fails", String(newFails));
          } catch {}

          setShake(true);
          setPin("");
          playAudio("error");
          if (navigator.vibrate) navigator.vibrate([80, 40, 80]);
          setTimeout(() => setShake(false), 450);

          if (newFails >= 5) {
            const until = Date.now() + 30000;
            setLockoutUntil(until);
            setRemainingLockout(30);
            try {
              sessionStorage.setItem("slg_pin_lockout", String(until));
              sessionStorage.setItem("slg_pin_fails", "0");
            } catch {}
            setFailedAttempts(0);
            setErr(
              lang === "te"
                ? "5 సార్లు తప్పు పిన్ నమోదు చేశారు. భద్రత కోసం 30 సెకన్లు లాక్ చేయబడింది."
                : "5 failed PIN attempts. Locked for 30 seconds for security."
            );
          } else {
            const left = 5 - newFails;
            setErr(
              lang === "te"
                ? `${t.pinError} (ఇంకా ${left} ప్రయత్నాలు మిగిలి ఉన్నాయి)`
                : `${t.pinError} (${left} attempt${left > 1 ? "s" : ""} remaining)`
            );
          }
        }
      }, 150);
    }
  };

  const keys = [
    { label: "1", val: "1" },
    { label: "2", val: "2" },
    { label: "3", val: "3" },
    { label: "4", val: "4" },
    { label: "5", val: "5" },
    { label: "6", val: "6" },
    { label: "7", val: "7" },
    { label: "8", val: "8" },
    { label: "9", val: "9" },
    {
      label: "bio",
      val: "bio",
      icon: (
        <Fingerprint
          className={`w-7 h-7 text-amber-400 group-hover:scale-110 group-active:scale-95 transition-all ${
            isAuthenticating ? "animate-pulse text-amber-300" : ""
          }`}
        />
      ),
    },
    { label: "0", val: "0" },
    {
      label: "del",
      val: "del",
      icon: <Delete className="w-6 h-6 text-slate-400 group-hover:text-white" />,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-950 to-black text-slate-100 flex flex-col items-center justify-between p-4 sm:p-6 select-none relative">
      {/* Top action row */}
      <div className="w-full max-w-sm flex items-center justify-between pt-2">
        <button
          onClick={() => {
            setPin("");
            setErr("");
          }}
          className="w-10 h-10 rounded-full bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-slate-300 hover:text-white cursor-pointer active:scale-95 transition-all"
          title="Clear PIN"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <button
          onClick={onToggleLang}
          className="px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 flex items-center gap-1.5 text-xs font-bold text-slate-200 hover:text-amber-400 active:scale-95 transition-all cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-amber-400" />
          <span>{lang === "en" ? "తెలుగు" : "English"}</span>
        </button>
      </div>

      {/* Main Branding Card */}
      <div className="w-full max-w-sm flex flex-col items-center text-center my-auto py-2">
        {/* Cultural & Religious Emblem */}
        <div className="mb-3 transform hover:scale-105 transition-transform duration-300">
          <BusinessEmblem emblem={emblem} size={68} color={brandColor} />
        </div>

        {/* Brand Name */}
        <h1
          className="text-2xl sm:text-3xl font-serif font-black tracking-wide truncate max-w-xs"
          style={{ color: brandColor || "#D97706" }}
        >
          {businessName}
        </h1>

        {/* Subtitle with line accents */}
        <div className="flex items-center gap-3 mt-1.5">
          <div className="w-6 h-[1px] bg-gradient-to-r from-transparent to-amber-500/60" />
          <span className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">
            {tagline}
          </span>
          <div className="w-6 h-[1px] bg-gradient-to-l from-transparent to-amber-500/60" />
        </div>

        {/* Master PIN entry instruction */}
        <div className="mt-6">
          <h2 className="text-lg font-bold text-slate-200">
            {lang === "te" ? "మీ పిన్ నమోదు చేయండి" : "Enter Master PIN"}
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-0.5">
            {lang === "te"
              ? "లేదా ఫోన్ వేలిముద్ర సెన్సార్ ఉపయోగించండి"
              : "Or use mobile phone fingerprint sensor"}
          </p>
        </div>

        {/* PIN Dot Indicators */}
        <div
          className={`flex items-center justify-center gap-4 mt-5 transition-transform ${
            shake ? "animate-bounce text-red-500" : ""
          }`}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
                i < pin.length
                  ? "bg-amber-400 shadow-lg shadow-amber-400/50 scale-125"
                  : "bg-transparent border-2 border-slate-600"
              }`}
            />
          ))}
        </div>

        {/* Real-time Status / Error Message */}
        {remainingLockout > 0 ? (
          <div className="mt-3 px-3.5 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs font-bold flex items-center justify-center gap-2 animate-pulse">
            <Shield className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>
              {lang === "te"
                ? `చాలా సార్లు తప్పు పిన్. భద్రత కోసం ${remainingLockout}s వేచి ఉండండి.`
                : `Too many failed attempts. Locked for ${remainingLockout}s.`}
            </span>
          </div>
        ) : err ? (
          <p className="text-xs text-red-400 font-bold tracking-wide mt-3 max-w-xs text-center animate-pulse px-3">
            {err}
          </p>
        ) : isAuthenticating ? (
          <div className="mt-3 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs font-semibold flex items-center gap-2 animate-pulse">
            <Fingerprint className="w-4 h-4 text-amber-400 animate-bounce" />
            <span>
              {lang === "te"
                ? "మీ ఫోన్ వేలిముద్ర సెన్సార్‌ను తాకండి..."
                : "Touch your phone's fingerprint sensor..."}
            </span>
          </div>
        ) : null}
      </div>

      {/* Prominent Direct Mobile Fingerprint Action Button */}
      <div className="w-full max-w-xs mb-3">
        <button
          type="button"
          onClick={triggerMobileFingerprint}
          disabled={isAuthenticating || remainingLockout > 0}
          className={`w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-orange-500/15 to-amber-500/10 hover:from-amber-500/25 hover:to-amber-500/20 border-2 border-amber-500/50 text-amber-300 font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-2.5 shadow-lg shadow-amber-950/20 active:scale-98 transition-all ${remainingLockout > 0 ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <Fingerprint className={`w-5 h-5 text-amber-400 ${isAuthenticating ? "animate-bounce" : ""}`} />
          <span>
            {isAuthenticating
              ? lang === "te"
                ? "ధృవీకరిస్తోంది..."
                : "Awaiting Phone Sensor..."
              : lang === "te"
              ? "మొబైల్ వేలిముద్రతో అన్‌లాక్ చేయండి"
              : "Unlock with Mobile Fingerprint"}
          </span>
        </button>
      </div>

      {/* Circular Numeric Keypad */}
      <div className="w-full max-w-xs grid grid-cols-3 gap-3.5 pb-2">
        {keys.map((k) => (
          <div key={k.label} className="flex justify-center">
            <button
              type="button"
              disabled={remainingLockout > 0}
              onClick={() => press(k.val)}
              className={`group w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-800/90 active:border-amber-400/60 active:scale-95 flex items-center justify-center text-xl sm:text-2xl font-bold text-slate-100 shadow-lg transition-all ${
                remainingLockout > 0 ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              {k.icon ? k.icon : k.label}
            </button>
          </div>
        ))}
      </div>

      {/* Security Privacy sub-label */}
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pb-2">
        <Shield className="w-3.5 h-3.5 text-emerald-400" />
        <span>{t.dataStoredPrivately}</span>
      </div>
    </div>
  );
};
