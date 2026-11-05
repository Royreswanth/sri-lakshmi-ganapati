import React, { useState } from "react";
import {
  Search,
  ChevronRight,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  X,
  Share2,
  ArrowLeft,
  Phone,
  Wallet,
} from "lucide-react";
import { Borrower, Village, Language, BusinessProfile } from "../types";
import { translations } from "../translations";
import {
  formatCurrency,
  formatDateIN,
  getDayName,
  calculateRemainingBalance,
  calculateTotalPaid,
} from "../utils/dateUtils";
import {
  buildWhatsAppReceiptText,
  buildAdvanceReminderText,
  buildSkipWarningText,
  openWhatsApp,
  isBorrowerReceiptDisabled,
  getWhatsAppRules,
} from "../utils/whatsapp";
import { Bell } from "lucide-react";

interface BorrowersTabProps {
  data: { villages: Village[]; borrowers: Record<string, Borrower[]> };
  profile: BusinessProfile;
  lang: Language;
}

export const BorrowersTab: React.FC<BorrowersTabProps> = ({
  data,
  profile,
  lang,
}) => {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "skipped">("all");
  const [selectedBorrower, setSelectedBorrower] = useState<{
    borrower: Borrower;
    villageName: string;
  } | null>(null);

  const t = translations[lang];

  // Flatten all borrowers with village names
  const allBorrowersList = Object.entries(data.borrowers).flatMap(([vid, bs]) => {
    const vName = data.villages.find((v) => v.id === vid)?.name || "Village";
    return bs.map((b) => ({
      borrower: b,
      villageName: vName,
      villageId: vid,
    }));
  });

  const filtered = allBorrowersList.filter(({ borrower, villageName }) => {
    const q = search.toLowerCase();
    const matchesSearch =
      borrower.name.toLowerCase().includes(q) ||
      (borrower.phone || "").includes(q) ||
      villageName.toLowerCase().includes(q) ||
      (borrower.seqNo || "").includes(q);

    if (!matchesSearch) return false;

    const isCompleted = borrower.weeksPaid >= (borrower.durationWeeks || 12);
    const hasSkips = (borrower.history || []).some((h) => h.status === "skip");

    if (filter === "active") return !isCompleted;
    if (filter === "completed") return isCompleted;
    if (filter === "skipped") return hasSkips && !isCompleted;
    return true;
  });

  const handleSendWarning = (b: Borrower) => {
    const rem = calculateRemainingBalance(b);
    const msg = buildSkipWarningText({
      borrower: b,
      businessName: profile.businessName,
      remainingBal: rem,
      lang,
    });
    openWhatsApp(b.phone, msg);
  };

  const handleSendReminder = (b: Borrower, villageName: string) => {
    const rem = calculateRemainingBalance(b);
    const msg = buildAdvanceReminderText({
      borrower: b,
      villageName,
      visitDate: new Date().toISOString().split("T")[0],
      businessName: profile.businessName,
      remainingBal: rem,
      lang,
    });
    openWhatsApp(b.phone, msg);
  };

  const handleSendLatestReceipt = (b: Borrower, villageName: string) => {
    const rules = getWhatsAppRules();
    if (isBorrowerReceiptDisabled(b, undefined, rules)) {
      return;
    }

    const lastPaid = [...(b.history || [])].reverse().find((h) => h.status !== "skip");
    const amtPaid = lastPaid ? lastPaid.amtPaid : b.weeklyDue;
    const dateStr = lastPaid ? lastPaid.date : new Date().toISOString().split("T")[0];
    const rem = calculateRemainingBalance(b);

    const msg = buildWhatsAppReceiptText({
      borrower: b,
      amtPaid,
      status: lastPaid ? lastPaid.status : "paid",
      payMethod: lastPaid?.payMethod || "cash",
      dateStr,
      villageName,
      businessName: profile.businessName,
      remainingBal: rem,
      lang,
    });
    openWhatsApp(b.phone, msg);
  };

  return (
    <div className="pb-28 px-4 pt-3 max-w-lg mx-auto space-y-3.5">
      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder={t.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-2xl neu-inset text-sm font-semibold text-slate-800 outline-none"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex neu-inset p-1 rounded-2xl text-xs font-bold gap-1 overflow-x-auto">
        {(
          [
            ["all", "All"],
            ["active", "Active"],
            ["skipped", "With Skips ⚠️"],
            ["completed", "Completed ✓"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`flex-1 py-2 px-3 rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              filter === k
                ? "bg-[#1E3A8A] text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="text-xs text-slate-500 font-medium px-1">
        {filtered.length} {t.borrowers} {search ? "found" : "total"}
      </div>

      {filtered.length === 0 ? (
        <div className="neu-card rounded-2xl p-8 text-center text-xs text-slate-500">
          No borrowers matching this filter.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(({ borrower: b, villageName }, i) => {
            const rem = calculateRemainingBalance(b);
            const isCompleted = b.weeksPaid >= (b.durationWeeks || 12);
            const skips = (b.history || []).filter((h) => h.status === "skip").length;

            return (
              <div
                key={b.id}
                onClick={() => setSelectedBorrower({ borrower: b, villageName })}
                className="neu-card rounded-2xl p-4 cursor-pointer hover:border-blue-900/40 transition-all space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl neu-inset text-blue-900 flex items-center justify-center font-extrabold text-xs">
                      {b.seqNo ? `#${b.seqNo}` : String(i + 1).padStart(2, "0")}
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
                        {villageName} · {b.phone || "No phone"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isCompleted ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        ✓ Done
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full neu-inset text-blue-900 text-[10px] font-bold">
                        Wk {b.weeksPaid}/{b.durationWeeks || 12}
                      </span>
                    )}
                    {skips > 0 && !isCompleted && (
                      <span className="px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 text-[10px] font-bold">
                        +{skips} skip
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 neu-inset p-2 rounded-xl text-center text-xs">
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
                    <span className="text-[10px] text-slate-400 block font-semibold">Paid</span>
                    <span className="font-bold text-emerald-700">
                      {formatCurrency(calculateTotalPaid(b))}
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
              </div>
            );
          })}
        </div>
      )}

      {/* Borrower Detail Modal / Screen with Prominent Back Button */}
      {selectedBorrower && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="neu-card w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4">
            {/* Top Bar with Prominent Back Button */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedBorrower(null)}
                  className="w-10 h-10 rounded-full neu-circle-btn flex items-center justify-center text-slate-700 cursor-pointer"
                  title="Close"
                >
                  <ArrowLeft className="w-5 h-5 text-slate-800" />
                </button>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    {selectedBorrower.borrower.seqNo
                      ? `#${selectedBorrower.borrower.seqNo} · `
                      : ""}
                    {selectedBorrower.borrower.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedBorrower.villageName} ·{" "}
                    {selectedBorrower.borrower.phone || "No phone"}
                  </p>
                </div>
              </div>

              {selectedBorrower.borrower.phone && (
                <button
                  onClick={() => handleSendWarning(selectedBorrower.borrower)}
                  className="p-2 rounded-full neu-circle-btn text-emerald-600"
                  title="WhatsApp"
                >
                  <MessageCircle className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Financial Status Summary */}
            <div className="neu-card rounded-2xl p-4 grid grid-cols-2 gap-3 text-center">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Total Paid
                </span>
                <span className="text-lg font-black text-emerald-700">
                  {formatCurrency(calculateTotalPaid(selectedBorrower.borrower))}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold block">
                  Balance Remaining
                </span>
                <span className="text-lg font-black text-red-600">
                  {formatCurrency(calculateRemainingBalance(selectedBorrower.borrower))}
                </span>
              </div>
            </div>

            {/* WhatsApp Quick Actions Bar */}
            <div className="grid grid-cols-2 gap-2">
              {(() => {
                const rules = getWhatsAppRules();
                const isReceiptOff = isBorrowerReceiptDisabled(selectedBorrower.borrower, undefined, rules);

                if (isReceiptOff) {
                  return (
                    <div className="py-2.5 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 font-bold text-xs flex items-center justify-center gap-1.5 opacity-90 text-center">
                      <span>🔕</span>
                      <span>{lang === "te" ? "రశీదు ఆఫ్" : "Receipt Off"}</span>
                    </div>
                  );
                }

                return (
                  <button
                    onClick={() =>
                      handleSendLatestReceipt(
                        selectedBorrower.borrower,
                        selectedBorrower.villageName
                      )
                    }
                    className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  >
                    <MessageCircle className="w-3.5 h-3.5 fill-white" />
                    <span>{lang === "te" ? "వాట్సాప్ రశీదు" : "Send Receipt"}</span>
                  </button>
                );
              })()}

              <button
                onClick={() =>
                  handleSendReminder(
                    selectedBorrower.borrower,
                    selectedBorrower.villageName
                  )
                }
                className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs cursor-pointer transition-all"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>{lang === "te" ? "2-రోజుల రిమైండర్" : "2-Day Reminder"}</span>
              </button>
            </div>

            {/* Khata Statement / History */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider px-1">
                Week-by-Week Payment History
              </h4>

              {(selectedBorrower.borrower.history || []).length === 0 ? (
                <div className="neu-inset p-4 rounded-xl text-center text-xs text-slate-500">
                  No collection entries recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {(selectedBorrower.borrower.history || []).map((h, idx) => (
                    <div
                      key={idx}
                      className="neu-card rounded-xl p-3 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">
                          {h.status === "paid"
                            ? "✅"
                            : h.status === "skip"
                            ? "❌"
                            : h.status === "short"
                            ? "⚡"
                            : "➕"}
                        </span>
                        <div>
                          <div className="font-bold text-slate-900">
                            Week {idx + 1} ({h.status.toUpperCase()})
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {formatDateIN(h.date, lang)}
                            {h.payMethod && ` · ${h.payMethod}`}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-black text-slate-900">
                          {h.status === "skip" ? "—" : formatCurrency(h.amtPaid)}
                        </div>
                        {h.note && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                            {h.note}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedBorrower(null)}
              className="w-full py-3 rounded-2xl neu-btn text-xs font-bold text-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
