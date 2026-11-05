import React, { useState } from "react";
import {
  TrendingUp,
  Calendar,
  Building2,
  ChevronRight,
  ArrowLeft,
  Coins,
  CheckCircle2,
  AlertCircle,
  PiggyBank,
  Receipt,
  Wallet,
} from "lucide-react";
import {
  Borrower,
  Village,
  CollectionRecord,
  ExpenseItem,
  Language,
  PersonalUseItem,
} from "../types";
import { translations } from "../translations";
import {
  formatCurrency,
  formatDateIN,
  getMondayOfWeek,
  getWeekDates,
  getDayName,
} from "../utils/dateUtils";
import {
  calculateOutstandingInField,
  calculateTotalPersonalUse,
  calculateNetProfit,
  calculateRemainingBalance,
} from "../utils/financeUtils";

interface ReportsTabProps {
  data: { villages: Village[]; borrowers: Record<string, Borrower[]> };
  collections: Record<string, CollectionRecord>;
  expenses: ExpenseItem[];
  personalLog?: PersonalUseItem[];
  lang: Language;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({
  data,
  collections,
  expenses,
  personalLog = [],
  lang,
}) => {
  const [view, setView] = useState<"summary" | "weeks" | "villages">("summary");
  const [selectedWeek, setSelectedWeek] = useState<string | null>(null);

  const t = translations[lang];

  const allBorrowers = Object.values(data.borrowers).flat();
  const totalLent = allBorrowers.reduce((s, b) => s + (b.loanAmt || 0), 0);
  const totalReturn = allBorrowers.reduce(
    (s, b) => s + (b.totalReturn || b.weeklyDue * (b.durationWeeks || 12)),
    0
  );
  const totalInterest = totalReturn - totalLent;

  // Real Outstanding in Field (Fix D8)
  const outstandingInField = calculateOutstandingInField(allBorrowers);

  const allCollections = Object.values(collections);
  const totalCollected = allCollections.reduce(
    (s, c) => s + (c.totalCollected || 0),
    0
  );
  const totalExpenses = expenses.reduce((s, e) => s + (e.amt || 0), 0);
  // Source of truth for personal use (Fix D6)
  const totalPersonal = calculateTotalPersonalUse(personalLog, collections);
  const netProfit = calculateNetProfit(totalCollected, totalExpenses, totalPersonal);

  const allMondays = Array.from(
    new Set(allCollections.map((c) => getMondayOfWeek(c.date)))
  ).sort((a, b) => b.localeCompare(a));

  // If week report is open
  if (selectedWeek) {
    const weekDates = getWeekDates(selectedWeek);
    const wColls = allCollections.filter((c) => weekDates.includes(c.date));
    const wColl = wColls.reduce((s, c) => s + (c.totalCollected || 0), 0);
    const wExp = wColls.reduce((s, c) => s + (c.totalExpected || 0), 0);

    return (
      <div className="pb-28 px-4 pt-3 max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSelectedWeek(null)}
            className="w-10 h-10 rounded-full neu-circle-btn flex items-center justify-center text-slate-700 cursor-pointer"
            title="Back to Reports"
          >
            <ArrowLeft className="w-5 h-5 text-slate-800" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-800">
              {lang === "te" ? "వారం నివేదిక" : "Week Report"}
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              {formatDateIN(selectedWeek, lang)} → {formatDateIN(weekDates[6], lang)}
            </p>
          </div>
        </div>

        <div className="neu-card rounded-3xl p-5 text-center">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {lang === "te" ? "మొత్తం వసూలు" : "Total Collected"}
          </span>
          <div className="text-3xl font-black text-emerald-700 mt-1">
            {formatCurrency(wColl)}
          </div>
          <div className="flex items-center justify-center gap-4 mt-3 pt-3 border-t border-slate-300/40 text-xs font-semibold">
            <span className="text-slate-600">Expected: {formatCurrency(wExp)}</span>
            <span className="text-red-600">
              Shortfall: {formatCurrency(Math.max(wExp - wColl, 0))}
            </span>
          </div>
        </div>

        <div className="space-y-2.5">
          {wColls.map((c, i) => (
            <div key={i} className="neu-card rounded-2xl p-4 space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{c.villageName}</h4>
                  <p className="text-xs text-slate-500">{formatDateIN(c.date, lang)}</p>
                </div>
                <div className="text-right">
                  <div className="font-black text-emerald-700 text-sm">
                    {formatCurrency(c.totalCollected)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    of {formatCurrency(c.totalExpected)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28 px-4 pt-3 max-w-lg mx-auto space-y-4">
      {/* Switcher */}
      <div className="flex neu-inset p-1 rounded-2xl text-xs font-bold gap-1">
        {(
          [
            ["summary", "📊 Summary"],
            ["weeks", "📅 Completed Weeks"],
            ["villages", "🏘️ Villages"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer ${
              view === k
                ? "bg-[#1E3A8A] text-white shadow-xs"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "summary" && (
        <div className="space-y-3.5">
          {/* Net Profit Card */}
          <div className="neu-card rounded-3xl p-5 text-center">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Overall Net Profit
            </span>
            <div className="text-3xl font-black text-emerald-700 mt-1">
              {formatCurrency(netProfit)}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Collected – Line Expenses – Personal Withdrawals
            </p>
          </div>

          <div className="space-y-2.5">
            {[
              { label: lang === "te" ? "ఫీల్డులో ఉన్న బకాయి" : "Outstanding in Field", val: formatCurrency(outstandingInField), badge: "badge-pastel-amber", icon: <Coins className="w-5 h-5 text-amber-600" /> },
              { label: lang === "te" ? "మొత్తం ఇచ్చిన అప్పు" : "Total Capital Lent Out", val: formatCurrency(totalLent), badge: "badge-pastel-blue", icon: <Wallet className="w-5 h-5 text-blue-600" /> },
              { label: lang === "te" ? "రావలసిన మొత్తం" : "Total Expected Return", val: formatCurrency(totalReturn), badge: "badge-pastel-green", icon: <TrendingUp className="w-5 h-5 text-emerald-600" /> },
              { label: lang === "te" ? "రావలసిన వడ్డీ" : "Total Expected Interest", val: formatCurrency(totalInterest), badge: "badge-pastel-amber", icon: <Coins className="w-5 h-5 text-amber-600" /> },
              { label: lang === "te" ? "మొత్తం వసూలైనది" : "Total Collected So Far", val: formatCurrency(totalCollected), badge: "badge-pastel-green", icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" /> },
              { label: lang === "te" ? "లైన్ ఖర్చులు (మొత్తం)" : "Total Line Expenses", val: formatCurrency(totalExpenses), badge: "badge-pastel-red", icon: <Receipt className="w-5 h-5 text-rose-600" /> },
              { label: lang === "te" ? "వ్యక్తిగత ఖర్చులు (సొంతం)" : "Personal Cash Withdrawals", val: formatCurrency(totalPersonal), badge: "badge-pastel-purple", icon: <PiggyBank className="w-5 h-5 text-purple-600" /> },
            ].map((item, idx) => (
              <div key={idx} className="neu-card rounded-2xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl ${item.badge} flex items-center justify-center`}>
                    {item.icon}
                  </div>
                  <span className="text-xs font-bold text-slate-700">{item.label}</span>
                </div>
                <span className="text-sm font-black text-slate-900">{item.val}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "weeks" && (
        <div className="space-y-2.5">
          {allMondays.length === 0 ? (
            <div className="neu-card rounded-2xl p-8 text-center text-xs text-slate-500">
              No weekly collection records yet.
            </div>
          ) : (
            allMondays.map((monday, idx) => {
              const weekDates = getWeekDates(monday);
              const wColls = allCollections.filter((c) => weekDates.includes(c.date));
              const wColl = wColls.reduce((s, c) => s + (c.totalCollected || 0), 0);
              const weekNum = allMondays.length - idx;

              return (
                <div
                  key={monday}
                  onClick={() => setSelectedWeek(monday)}
                  className="neu-card rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-blue-900/40 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl neu-inset font-black text-blue-900 flex items-center justify-center text-sm">
                      W{weekNum}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Week {weekNum}</h4>
                      <p className="text-[11px] text-slate-500">
                        {formatDateIN(monday, lang)} → {formatDateIN(weekDates[6], lang)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex items-center gap-2">
                    <div className="font-black text-emerald-700 text-sm">
                      {formatCurrency(wColl)}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {view === "villages" && (
        <div className="space-y-3">
          {data.villages.map((v) => {
            const bs = data.borrowers[v.id] || [];
            const tL = bs.reduce((s, b) => s + b.loanAmt, 0);
            const vCols = allCollections.filter((c) => c.villageId === v.id);
            const vCollected = vCols.reduce((s, c) => s + (c.totalCollected || 0), 0);
            const vOutstanding = calculateOutstandingInField(bs);

            return (
              <div key={v.id} className="neu-card rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl badge-pastel-blue flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{v.name}</h4>
                      <p className="text-[11px] text-slate-500">
                        {v.day} · {bs.length} {lang === "te" ? "ఖాతాదారులు" : "borrowers"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 neu-inset p-2.5 rounded-xl text-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">{lang === "te" ? "అప్పు" : "Lent"}</span>
                    <span className="font-bold text-slate-800">{formatCurrency(tL)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">{lang === "te" ? "వసూలు" : "Collected"}</span>
                    <span className="font-bold text-emerald-700">{formatCurrency(vCollected)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block font-semibold">{lang === "te" ? "బకాయి" : "Outstanding"}</span>
                    <span className="font-bold text-amber-700">{formatCurrency(vOutstanding)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
