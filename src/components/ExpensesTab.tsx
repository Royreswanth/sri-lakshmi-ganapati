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

  const CATS: { id: ExpenseItem["cat"]; label: string; icon: React.ElementType }[] = [
    { id: "travel", label: "Travel", icon: Car },
    { id: "fuel", label: "Fuel", icon: Fuel },
    { id: "food", label: "Food", icon: Utensils },
    { id: "rent", label: "Rent", icon: Home },
    { id: "other", label: "Other", icon: Package },
  ];

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(amt);
    if (!val || val <= 0) return;

    const item: ExpenseItem = {
      id: Date.now(),
      desc: desc.trim() || CATS.find((c) => c.id === cat)?.label || "Expense",
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
    <div className="pb-28 px-4 pt-3 max-w-lg mx-auto">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-3xl shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
            Today's Expense
          </span>
          <span className="text-2xl font-black text-rose-600 mt-0.5 block">
            {formatCurrency(todayTotal)}
          </span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-3xl shadow-xs">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide block">
            Total Recorded
          </span>
          <span className="text-2xl font-black text-slate-900 mt-0.5 block">
            {formatCurrency(overallTotal)}
          </span>
        </div>
      </div>

      {/* Add Expense Button */}
      <button
        onClick={() => setShowAdd(true)}
        className="w-full mb-4 py-3.5 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800 text-white font-extrabold text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
      >
        <Plus className="w-5 h-5" />
        <span>+ Add New Expense</span>
      </button>

      {/* Expense List */}
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          All Expenses ({expenses.length})
        </span>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
          No expenses recorded yet.
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((e) => {
            const catObj = CATS.find((c) => c.id === e.cat) || CATS[4];
            const Icon = catObj.icon;

            return (
              <div
                key={e.id}
                className="bg-white p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between shadow-xs text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{e.desc}</h4>
                    <p className="text-[11px] text-slate-500">
                      {formatDateIN(e.date, lang)} · {catObj.label}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="font-black text-rose-600 text-sm">
                    {formatCurrency(e.amt)}
                  </span>
                  <button
                    onClick={() => onDeleteExpense(e.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-0">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-5 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-rose-600" />
              <span>Add Expense</span>
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all cursor-pointer ${
                      isSel
                        ? "bg-rose-600 text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleAdd} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. Petrol, Tea, Auto fare"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">
                  Amount (₹) *
                </label>
                <input
                  type="number"
                  required
                  placeholder="0"
                  value={amt}
                  onChange={(e) => setAmt(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdd(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
