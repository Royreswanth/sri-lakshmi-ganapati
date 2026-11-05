import React, { useState } from "react";
import {
  MessageCircle,
  Copy,
  Check,
  X,
  Phone,
  User,
  Building2,
  Calendar,
  Wallet,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Borrower, Language, PaymentMethod, PaymentStatus, BusinessProfile } from "../types";
import { formatCurrency, formatDateIN, getDayName } from "../utils/dateUtils";
import {
  buildWhatsAppReceiptText,
  openWhatsApp,
  normalizePhoneNumber,
  isBorrowerReceiptDisabled,
  getWhatsAppRules,
} from "../utils/whatsapp";

interface WhatsAppReceiptModalProps {
  borrower: Borrower | null;
  villageName: string;
  amtPaid: number;
  status: PaymentStatus;
  payMethod: PaymentMethod;
  note?: string;
  extraAmt?: number;
  remainingBal: number;
  dateStr: string;
  profile: BusinessProfile;
  lang: Language;
  onClose: () => void;
  onNext?: () => void;
  showToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

export const WhatsAppReceiptModal: React.FC<WhatsAppReceiptModalProps> = ({
  borrower,
  villageName,
  amtPaid,
  status,
  payMethod,
  note = "",
  extraAmt = 0,
  remainingBal,
  dateStr,
  profile,
  lang,
  onClose,
  onNext,
  showToast,
}) => {
  const [copied, setCopied] = useState(false);
  const [phoneInput, setPhoneInput] = useState(borrower?.phone || "");

  if (!borrower) return null;

  const rules = getWhatsAppRules();
  const isReceiptDisabled = isBorrowerReceiptDisabled(borrower, undefined, rules);
  if (isReceiptDisabled) return null;

  const currentPhone = phoneInput || borrower.phone || "";
  const cleanPhone = normalizePhoneNumber(currentPhone);

  const receiptMessage = buildWhatsAppReceiptText({
    borrower: { ...borrower, phone: currentPhone },
    amtPaid,
    status,
    dateStr,
    villageName,
    businessName: profile.businessName,
    payMethod,
    note,
    extraAmt,
    remainingBal,
    lang,
  });

  const handleSendOnWhatsApp = () => {
    if (isReceiptDisabled) {
      if (showToast) {
        showToast(
          lang === "te"
            ? "ఈ ఖాతాదారుని ప్రొఫైల్‌లో వాట్సాప్ రశీదు ఆపివేయబడింది 🔕"
            : "WhatsApp receipt is disabled in this borrower's profile 🔕",
          "error"
        );
      }
      return;
    }

    openWhatsApp(currentPhone, receiptMessage);
    if (showToast) {
      showToast(
        lang === "te"
          ? "వాట్సాప్ ఓపెన్ చేయబడింది ✓"
          : "Opening WhatsApp chat ✓",
        "success"
      );
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(receiptMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      if (showToast) {
        showToast(
          lang === "te" ? "రశీదు కాపీ చేయబడింది ✓" : "Receipt text copied ✓",
          "info"
        );
      }
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const currentWeek = borrower.weeksPaid;
  const totalWeeks = borrower.durationWeeks || 12;

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#131B2E] w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[94vh] overflow-y-auto space-y-4 border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 fill-emerald-500 text-emerald-500" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                {lang === "te" ? "తక్షణ చెల్లింపు రశీదు" : "Instant WhatsApp Receipt"}
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                {lang === "te" ? "వాట్సాప్ రశీదు పంపండి" : "Send WhatsApp Receipt"}
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Success Notice */}
        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 font-bold text-sm">
            ✓
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
              {lang === "te"
                ? `${borrower.name} వాయిదా విజయవంతంగా నమోదైంది`
                : `Payment for ${borrower.name} saved!`}
            </p>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
              {lang === "te"
                ? `నగదు: ${formatCurrency(amtPaid)} · Wk ${currentWeek}/${totalWeeks}`
                : `Collected: ${formatCurrency(amtPaid)} · Wk ${currentWeek}/${totalWeeks}`}
            </p>
          </div>
        </div>

        {/* Digital Slip Preview Card */}
        <div className="bg-slate-50 dark:bg-[#0B1120] rounded-2xl p-4 border border-dashed border-slate-300 dark:border-slate-700 space-y-2.5 relative">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
            <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
              🙏 {profile.businessName}
            </span>
            <span className="text-[10px] font-bold text-slate-400">
              {formatDateIN(dateStr, lang)}
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">
                {lang === "te" ? "ఖాతాదారు:" : "Borrower:"}
              </span>
              <span className="font-extrabold text-slate-900 dark:text-white">
                {borrower.seqNo ? `#${borrower.seqNo} · ` : ""}
                {borrower.name}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">
                {lang === "te" ? "గ్రామం:" : "Village:"}
              </span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {villageName}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">
                {lang === "te" ? "వాయిదా వారం:" : "Installment:"}
              </span>
              <span className="font-bold text-blue-900 dark:text-blue-400">
                Wk {currentWeek} / {totalWeeks}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 bg-white dark:bg-[#1E293B] px-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700">
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {lang === "te" ? "చెల్లించిన మొత్తం:" : "Paid Amount:"}
              </span>
              <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                {formatCurrency(amtPaid)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">
                {lang === "te" ? "చెల్లింపు విధానం:" : "Mode:"}
              </span>
              <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">
                {payMethod === "phonepe"
                  ? "📱 PhonePe UPI"
                  : payMethod === "online"
                  ? "🌐 Online Transfer"
                  : "💵 Cash in Hand"}
              </span>
            </div>

            <div className="flex justify-between pt-1 border-t border-slate-200 dark:border-slate-800">
              <span className="text-slate-500 font-medium">
                {lang === "te" ? "మిగిలిన బాకీ:" : "Remaining Balance:"}
              </span>
              <span className="font-black text-amber-700 dark:text-amber-400">
                {formatCurrency(remainingBal)}
              </span>
            </div>
          </div>
        </div>

        {/* Phone Number Input (if missing or needs edit) */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lang === "te" ? "వాట్సాప్ నంబర్" : "Borrower WhatsApp Phone"}</span>
            </span>
            {cleanPhone ? (
              <span className="text-emerald-600 font-semibold text-[10px]">
                {cleanPhone.length === 10 ? "✓ 10-Digits Valid" : `+91 ${cleanPhone}`}
              </span>
            ) : (
              <span className="text-amber-600 text-[10px]">
                {lang === "te" ? "నెంబర్ నమోదు చేయండి" : "Enter phone"}
              </span>
            )}
          </label>
          <input
            type="tel"
            placeholder="e.g. 9876543210"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-bold text-sm outline-none border border-slate-200 dark:border-slate-700 focus:border-emerald-500"
          />
        </div>

        {/* Primary WhatsApp Dispatch Action */}
        <div className="space-y-2 pt-1">
          {isReceiptDisabled ? (
            <div className="w-full py-3 px-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-center">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center justify-center gap-1.5">
                <span>🔕</span>
                <span>
                  {lang === "te"
                    ? "ఖాతాదారు ప్రొఫైల్‌లో వాట్సాప్ రశీదు ఆపివేయబడింది"
                    : "Receipt is disabled in this borrower's profile"}
                </span>
              </span>
            </div>
          ) : (
            <button
              onClick={handleSendOnWhatsApp}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#25D366] hover:bg-[#20bd5a] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer active:scale-98"
            >
              <MessageCircle className="w-5 h-5 fill-white" />
              <span>
                {lang === "te" ? "వాట్సాప్ లో రశీదు పంపండి" : "Send WhatsApp Receipt"}
              </span>
              <ExternalLink className="w-4 h-4 ml-0.5 opacity-80" />
            </button>
          )}
          <p className="text-[10px] text-center text-slate-500 dark:text-slate-400">
            {lang === "te"
              ? "మీ స్వంత ఫోన్ వాట్సాప్ నంబర్ నుండి నేరుగా మెసేజ్ వెళ్తుంది"
              : "Delivered directly from your personal WhatsApp number"}
          </p>
        </div>

        {/* Secondary Actions */}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleCopyText}
            className="flex-1 py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-600">{lang === "te" ? "కాపీ అయింది!" : "Copied!"}</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>{lang === "te" ? "టెక్స్ట్ కాపీ చేయి" : "Copy Receipt Text"}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              if (onNext) onNext();
            }}
            className="flex-1 py-2.5 px-3 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white font-bold text-xs flex items-center justify-center gap-1 cursor-pointer transition-all shadow-xs"
          >
            <span>{lang === "te" ? "తదుపరి ఖాతాదారు" : "Done / Next"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
