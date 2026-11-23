import React, { useState } from "react";
import { Receipt, Plus, Trash2, Fuel, Car, Utensils, Home, Package } from "lucide-react";
import { ExpenseItem, Language } from "../types";
import { translations } from "../translations";
import { formatCurrency, formatDateIN, getTodayStr } from "../utils/dateUtils";

interface ExpensesTabProps {
  expenses: ExpenseItem[];
  onAddExpense: (expense: ExpenseItem) => void;
  onDeleteExpense: (id: number) => void;
  lang: Language;
}

export const ExpensesTab: React.FC<ExpensesTabProps> = ({
  expenses,
  onAddExpense,
  onDeleteExpense,
  lang,
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [desc, setDesc] = useState("");
  const [amt, setAmt] = useState("");
  const [cat, setCat] = useState<ExpenseItem["cat"]>("travel");

  const t = translations[lang];
  const todayStr = getTodayStr();

  const CATS: { id: ExpenseItem["cat"]; label: string; labelTe: string; icon: React.ElementType }[] = [
    { id: "travel", label: "Travel", labelTe: "ప్రయాణం", icon: Car },
    { id: "fuel", label: "Fuel", labelTe: "పెట్రోల్", icon: Fuel },
    { id: "food", label: "Food", labelTe: "భోజనం", icon: Utensils },
    { id: "rent", label: "Rent", labelTe: "అద్దె", icon: Home },
    { id: "other", label: "Other", labelTe: "ఇతరం", icon: Package },
  ];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(amt);
    if (!val || val <= 0) return;

    const item: ExpenseItem = {
      id: Date.now(),
      desc: desc.trim() || (lang === "te" ? CATS.find((c) => c.id === cat)?.labelTe : CATS.find((c) => c.id === cat)?.label) || "Expense",
      amt: val,
      cat,
      date: todayStr,
    };

    onAddExpense(item);
    setDesc("");
    setAmt("");
    setCat("travel");
    setShowAdd(false);
  };

  const todayTotal = expenses
    .filter((e) => e.date === todayStr)
    .reduce((s, e) => s + e.amt, 0);
  const overallTotal = expenses.reduce((s, e) => s + e.amt, 0);

  return (
    <div className="pb-28 px-4 pt-3 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 p-4 rounded-3xl shadow-xs">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide block">
            {lang === "te" ? "నేటి ఖర్చు" : "Today's Expense"}
          </span>
          <span className="text-2xl font-black text-rose-700 dark:text-rose-400 mt-0.5 block tabular-nums">
            {formatCurrency(todayTotal)}
          </span>
        </div>

        <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 p-4 rounded-3xl shadow-xs">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide block">
            {lang === "te" ? "మొత్తం ఖర్చులు" : "Total Recorded"}
          </span>
          <span className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5 block tabular-nums">
            {formatCurrency(overallTotal)}
          </span>
        </div>
      </div>

      {/* Add Expense Button */}
      <button
        onClick={() => setShowAdd(true)}
        className="w-full min-h-[48px] mb-4 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
      >
        <Plus className="w-5 h-5" />
        <span>{lang === "te" ? "+ కొత్త లైన్ ఖర్చు నమోదు" : "+ Add New Expense"}</span>
      </button>

      {/* Expense List */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider tabular-nums">
          {lang === "te" ? "అన్ని ఖర్చులు" : "All Expenses"} ({expenses.length})
        </span>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-white dark:bg-[#131B2E] p-8 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-600 dark:text-slate-400">
          {lang === "te" ? "ఇంకా ఏ ఖర్చులు నమోదు చేయలేదు." : "No expenses recorded yet."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {expenses.map((e) => {
            const catObj = CATS.find((c) => c.id === e.cat) || CATS[4];
            const Icon = catObj.icon;

            return (
              <div
                key={e.id}
                className="bg-white dark:bg-[#131B2E] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-xs text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{e.desc}</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      {formatDateIN(e.date, lang)} · {lang === "te" ? catObj.labelTe : catObj.label}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-black text-rose-700 dark:text-rose-400 text-sm tabular-nums">
                    {formatCurrency(e.amt)}
                  </span>
                  <button
                    onClick={() => onDeleteExpense(e.id)}
                    className="w-9 h-9 rounded-lg text-slate-500 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center justify-center cursor-pointer"
                    title="Delete expense"
                    aria-label={`Delete ${e.desc}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setShowAdd(false)}
        >
          <div className="bg-white dark:bg-[#131B2E] border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-rose-600 dark:text-rose-400" />
              <span>{lang === "te" ? "ఖర్చు నమోదు చేయండి" : "Add Expense"}</span>
            </h3>

            {/* Category Chips */}
            <div className="flex gap-1.5 mb-3 overflow-x-auto pb-1">
              {CATS.map((c) => {
                const Icon = c.icon;
                const isSel = cat === c.id;

                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCat(c.id)}
                    className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                      isSel
                        ? "bg-rose-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{lang === "te" ? c.labelTe : c.label}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {lang === "te" ? "వివరణ" : "Description"}
                </label>
                <input
                  type="text"
                  placeholder={lang === "te" ? "ఉదా: పెట్రోల్, టీ, ఆటో ఖర్చు" : "e.g. Petrol, Tea, Auto fare"}
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-rose-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  {lang === "te" ? "మొత్తం (₹) *" : "Amount (₹) *"}
                </label>
                <input
                  type="number"
                  required
                  placeholder="0"
                  value={amt}
                  onChange={(e) => setAmt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-rose-500 tabular-nums"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {lang === "te" ? "రద్దు" : "Cancel"}
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
                >
                  {lang === "te" ? "ఖర్చు సేవ్ చేయండి" : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
