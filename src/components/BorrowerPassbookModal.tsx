import React, { useEffect } from "react";
import { ArrowLeft, Printer, MessageCircle, ShieldCheck, CheckCircle2 } from "lucide-react";
import type { Borrower, BusinessProfile, Language } from "../types";
import { translations } from "../translations";
import { formatCurrency, formatDateIN, getTodayStr } from "../utils/dateUtils";
import {
  calculateRemainingBalance,
  calculateTotalPaid,
  calculateTotalShortfall,
  getFrequencyLabel,
  getFrequencyShortPrefix,
  isBorrowerClosed,
} from "../utils/financeUtils";
import { buildPassbookWhatsAppText } from "../utils/exportUtils";
import { openWhatsApp } from "../utils/whatsapp";

interface BorrowerPassbookModalProps {
  borrower: Borrower;
  villageName: string;
  profile: BusinessProfile;
  lang: Language;
  onClose: () => void;
  showToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

export const BorrowerPassbookModal: React.FC<BorrowerPassbookModalProps> = ({
  borrower,
  villageName,
  profile,
  lang,
  onClose,
  showToast,
}) => {
  const t = translations[lang];
  const totalReturn =
    borrower.totalReturn || borrower.weeklyDue * (borrower.durationWeeks || 12);
  const totalPaid = calculateTotalPaid(borrower);
  const remaining = calculateRemainingBalance(borrower);
  const shortfall = calculateTotalShortfall(borrower);
  const closed = isBorrowerClosed(borrower);
  const freqPrefix = getFrequencyShortPrefix(borrower.repaymentFreq);
  const statementDate = formatDateIN(getTodayStr(), lang);

  // Scope print stylesheet cleanly so only the Passbook surface prints on paper/PDF
  useEffect(() => {
    document.body.setAttribute("data-print-mode", "passbook");
    return () => {
      document.body.removeAttribute("data-print-mode");
    };
  }, []);

  const handlePrintPdf = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const text = buildPassbookWhatsAppText(borrower, villageName, profile, lang);
    openWhatsApp(borrower.phone, text);
    showToast?.(
      lang === "te" ? "పాస్‌బుక్ వాట్సాప్‌లో సిద్ధంగా ఉంది ✓" : "Passbook statement opened in WhatsApp ✓",
      "success"
    );
  };

  return (
    <div
      className="passbook-print-backdrop fixed inset-0 bg-black/70 backdrop-blur-xs z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="passbook-print-surface bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[94vh] overflow-y-auto space-y-4">
        {/* Top Modal Action Bar (hidden when printing) */}
        <div className="flex items-center justify-between gap-2 print:hidden">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close passbook"
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 flex items-center justify-center cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-white" />
              <span>{lang === "te" ? "వాట్సాప్ షేర్" : "WhatsApp"}</span>
            </button>
            <button
              type="button"
              onClick={handlePrintPdf}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#1E3A8A] hover:bg-blue-900 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{t.printPdf}</span>
            </button>
          </div>
        </div>

        {/* Printable Statement Header */}
        <div className="rounded-2xl p-4 bg-slate-900 text-white print:bg-white print:text-slate-900 print:border-2 print:border-slate-800 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-extrabold uppercase tracking-widest text-amber-300 print:text-slate-600">
              {lang === "te" ? "డిజిటల్ రుణ పాస్‌బుక్" : "DIGITAL LOAN PASSBOOK"}
            </div>
            <h2 className="text-lg font-black tracking-tight mt-0.5">
              {profile.businessName}
            </h2>
            {profile.tagline && (
              <p className="text-[11px] text-slate-300 print:text-slate-600">
                {profile.tagline}
                {profile.phone ? ` · 📞 ${profile.phone}` : ""}
              </p>
            )}
          </div>
          <div className="text-right text-[11px] shrink-0">
            <div className="text-slate-300 print:text-slate-600 font-semibold">
              {lang === "te" ? "స్టేట్‌మెంట్ తేదీ" : "Statement Date"}
            </div>
            <div className="font-bold">{statementDate}</div>
          </div>
        </div>

        {/* Borrower & Guarantor KYC */}
        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/70 print:bg-slate-50 border border-slate-200 dark:border-slate-800 print:border-slate-300 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="space-y-1 flex items-start gap-2.5">
            {borrower.photo && (
              <img
                src={borrower.photo}
                alt={borrower.name}
                className="w-12 h-12 rounded-xl object-cover border border-slate-300 dark:border-slate-700 shrink-0"
              />
            )}
            <div className="space-y-1 min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                {lang === "te" ? "ఖాతాదారు వివరాలు" : "Borrower Details"}
              </div>
              <div className="text-sm font-black text-slate-900 dark:text-slate-100 print:text-slate-900">
                {borrower.seqNo ? `#${borrower.seqNo} · ` : ""}
                {borrower.name}
              </div>
              {borrower.careOf && (
                <div className="text-slate-700 dark:text-slate-300 print:text-slate-700">
                  {t.careOf}: {borrower.careOf}
                </div>
              )}
              <div className="text-slate-600 dark:text-slate-400 print:text-slate-700">
                📍 {villageName}
                {borrower.phone ? ` · 📞 ${borrower.phone}` : ""}
              </div>
              {(borrower.occupation || borrower.address) && (
                <div className="text-[11px] text-slate-600 dark:text-slate-400 print:text-slate-700">
                  {[borrower.occupation, borrower.address].filter(Boolean).join(" · ")}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-700 dark:text-blue-400" />
              <span>{t.guarantor} & Cycle</span>
            </div>
            <div className="font-bold text-slate-900 dark:text-slate-100 print:text-slate-900">
              {borrower.guarantorName
                ? `${borrower.guarantorName}${borrower.guarantorPhone ? ` (${borrower.guarantorPhone})` : ""}`
                : lang === "te"
                ? "హామీదారు నమోదు లేదు"
                : "No Guarantor Listed"}
            </div>
            <div className="text-slate-600 dark:text-slate-400 print:text-slate-700">
              Cycle #{borrower.loanCycle || 1} ·{" "}
              {getFrequencyLabel(borrower.repaymentFreq, lang)} ·{" "}
              {formatDateIN(borrower.startDate, lang)}
            </div>
          </div>
        </div>

        {/* Loan Terms & Balance Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center tabular-nums">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 print:border-slate-300">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              {lang === "te" ? "అప్పు" : "Principal"}
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-slate-100 print:text-slate-900">
              {formatCurrency(borrower.loanAmt)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 print:border-slate-300">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">
              {lang === "te" ? "రావలసినది" : "Total Return"}
            </span>
            <span className="text-sm font-black text-slate-900 dark:text-slate-100 print:text-slate-900">
              {formatCurrency(totalReturn)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 print:border-slate-300">
            <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block">
              {lang === "te" ? "చెల్లించినది" : "Total Paid"}
            </span>
            <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 print:text-emerald-800">
              {formatCurrency(totalPaid)}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 print:border-slate-300">
            <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400 block">
              {lang === "te" ? "మిగిలిన బాకీ" : "Balance Due"}
            </span>
            <span className="text-sm font-black text-rose-700 dark:text-rose-400 print:text-rose-800">
              {formatCurrency(remaining)}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-1">
          <span className="text-slate-600 dark:text-slate-400 print:text-slate-700 font-semibold tabular-nums">
            {lang === "te" ? "వాయిదా:" : "Installment:"}{" "}
            <strong>{formatCurrency(borrower.weeklyDue)}</strong> ·{" "}
            {borrower.weeksPaid}/{borrower.durationWeeks}{" "}
            {lang === "te" ? "వాయిదాలు" : "installments"}
          </span>

          <div className="flex items-center gap-2">
            {shortfall > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[11px] tabular-nums">
                {lang === "te" ? "తరుగు:" : "Shortfall:"} {formatCurrency(shortfall)}
              </span>
            )}
            <span
              className={`px-2.5 py-0.5 rounded-full font-bold text-[11px] flex items-center gap-1 ${
                closed
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-blue-100 text-blue-800"
              }`}
            >
              {closed && <CheckCircle2 className="w-3 h-3" />}
              {borrower.settledAt
                ? `${t.settledEarlyBadge} (${formatDateIN(borrower.settledAt, lang)})`
                : closed
                ? lang === "te"
                  ? "పూర్తయింది"
                  : "Closed"
                : lang === "te"
                ? "యాక్టివ్"
                : "Active"}
            </span>
          </div>
        </div>

        {/* Installment Ledger Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 print:border-slate-300">
          <table className="w-full text-left border-collapse text-xs tabular-nums">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800/80 print:bg-slate-100 text-slate-600 dark:text-slate-300 print:text-slate-700 text-[10px] uppercase tracking-wider">
                <th className="py-2.5 px-3 font-extrabold">#</th>
                <th className="py-2.5 px-3 font-extrabold">{lang === "te" ? "తేదీ" : "Date"}</th>
                <th className="py-2.5 px-3 font-extrabold">{lang === "te" ? "స్థితి" : "Status"}</th>
                <th className="py-2.5 px-3 font-extrabold">{lang === "te" ? "విధానం" : "Mode"}</th>
                <th className="py-2.5 px-3 font-extrabold text-right">{lang === "te" ? "మొత్తం" : "Paid"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 print:divide-slate-300">
              {(borrower.history || []).length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-5 text-center text-slate-500 dark:text-slate-400"
                  >
                    {lang === "te"
                      ? "ఇంకా వాయిదాల చెల్లింపులు లేవు."
                      : "No installment transactions recorded yet."}
                  </td>
                </tr>
              ) : (
                (borrower.history || []).map((h, idx) => (
                  <tr key={`${h.date}_${idx}`} className="text-slate-800 dark:text-slate-200 print:text-slate-900">
                    <td className="py-2 px-3 font-bold">
                      {freqPrefix} {idx + 1}
                    </td>
                    <td className="py-2 px-3">
                      <div>{formatDateIN(h.date, lang)}</div>
                      {h.note && (
                        <div className="text-[10px] text-slate-500 print:text-slate-600">
                          {h.note}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 font-bold uppercase text-[11px]">
                      {h.isSettlement ? "SETTLED" : h.status}
                    </td>
                    <td className="py-2 px-3 uppercase text-[11px] text-slate-500 dark:text-slate-400 print:text-slate-600">
                      {h.status === "skip" ? "—" : h.payMethod || "cash"}
                    </td>
                    <td className="py-2 px-3 text-right font-black">
                      {h.status === "skip" ? "₹0" : formatCurrency(h.amtPaid)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Previous Loan Cycles Summary */}
        {(borrower.loanHistory || []).length > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              {lang === "te" ? "పాత లోన్ సైకిళ్ళు" : "Previous Loan Cycles"}
            </div>
            <div className="space-y-1">
              {(borrower.loanHistory || []).map((c) => (
                <div
                  key={c.cycle}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 print:border-slate-300 flex items-center justify-between text-[11px] tabular-nums"
                >
                  <span>
                    Cycle #{c.cycle} · {formatCurrency(c.loanAmt)} ({formatDateIN(c.startDate, lang)} →{" "}
                    {formatDateIN(c.closedDate, lang)})
                  </span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 print:text-slate-900">
                    {lang === "te" ? "చెల్లింపు:" : "Paid:"} {formatCurrency(c.totalPaid)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Print-Only Signature Footer */}
        <div className="hidden print:flex items-center justify-between pt-8 text-[11px] text-slate-700 border-t border-slate-300">
          <span>
            {lang === "te" ? "ఖాతాదారు సంతకం" : "Borrower Signature"}: ________________
          </span>
          <span>
            {lang === "te" ? "అధికారిక సంతకం" : "Authorized Signature"}: ________________
          </span>
        </div>
      </div>
    </div>
  );
};
