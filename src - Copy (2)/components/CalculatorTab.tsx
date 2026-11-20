import React, { useState } from "react";
import { Calculator, Delete, RotateCcw, Sparkles } from "lucide-react";
import { formatCurrency, calculateWeeklyDue } from "../utils/dateUtils";

export const CalculatorTab: React.FC = () => {
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [newNum, setNewNum] = useState(true);
  const [history, setHistory] = useState<string[]>([]);

  // Loan EMI Estimator state
  const [lAmt, setLAmt] = useState("10000");
  const [lPct, setLPct] = useState("20");
  const [lWks, setLWks] = useState("12");

  const pressNum = (n: number | string) => {
    if (newNum) {
      setDisplay(String(n));
      setNewNum(false);
    } else {
      setDisplay((d) => (d === "0" ? String(n) : d + n));
    }
  };

  const pressDot = () => {
    if (newNum) {
      setDisplay("0.");
      setNewNum(false);
      return;
    }
    if (!display.includes(".")) setDisplay((d) => d + ".");
  };

  const calc = (a: number, b: number, o: string) => {
    if (o === "+") return Math.round((a + b) * 1e8) / 1e8;
    if (o === "−") return Math.round((a - b) * 1e8) / 1e8;
    if (o === "×") return Math.round(a * b * 1e8) / 1e8;
    if (o === "÷") return b !== 0 ? Math.round((a / b) * 1e8) / 1e8 : "Error";
    return b;
  };

  const pressOp = (o: string) => {
    const cur = parseFloat(display);
    if (prev !== null && !newNum && op) {
      const res = calc(prev, cur, op);
      setDisplay(String(res));
      setPrev(Number(res));
    } else {
      setPrev(cur);
    }
    setOp(o);
    setNewNum(true);
  };

  const pressEq = () => {
    if (prev === null || op === null) return;
    const cur = parseFloat(display);
    const res = calc(prev, cur, op);
    setHistory((h) => [`${prev} ${op} ${cur} = ${res}`, ...h.slice(0, 5)]);
    setDisplay(String(res));
    setPrev(null);
    setOp(null);
    setNewNum(true);
  };

  const pressC = () => {
    setDisplay("0");
    setPrev(null);
    setOp(null);
    setNewNum(true);
  };

  const pressPct = () => {
    setDisplay((d) => String(parseFloat(d) / 100));
  };

  const keys = [
    { l: "C", a: pressC, v: "spec" },
    { l: "%", a: pressPct, v: "spec" },
    { l: "÷", a: () => pressOp("÷"), v: "op" },
    { l: "×", a: () => pressOp("×"), v: "op" },
    { l: "7", a: () => pressNum("7") },
    { l: "8", a: () => pressNum("8") },
    { l: "9", a: () => pressNum("9") },
    { l: "−", a: () => pressOp("−"), v: "op" },
    { l: "4", a: () => pressNum("4") },
    { l: "5", a: () => pressNum("5") },
    { l: "6", a: () => pressNum("6") },
    { l: "+", a: () => pressOp("+"), v: "op" },
    { l: "1", a: () => pressNum("1") },
    { l: "2", a: () => pressNum("2") },
    { l: "3", a: () => pressNum("3") },
    { l: "=", a: pressEq, v: "eq" },
    { l: "0", a: () => pressNum("0"), wide: true },
    { l: ".", a: pressDot },
  ];

  const loanTotal = (parseInt(lAmt) || 0) * (1 + (parseInt(lPct) || 0) / 100);
  const loanWeekly = calculateWeeklyDue(
    parseInt(lAmt) || 0,
    parseInt(lPct) || 0,
    parseInt(lWks) || 12
  );

  return (
    <div className="pb-28 px-4 pt-3 max-w-lg mx-auto">
      {/* Display Screen */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 mb-3 shadow-md flex flex-col justify-end min-h-[110px]">
        {op && prev !== null && (
          <span className="text-xs text-amber-400 font-semibold mb-1">
            {prev} {op}
          </span>
        )}
        <div className="text-3xl sm:text-4xl font-extrabold text-right tracking-tight break-all font-mono">
          {display}
        </div>
      </div>

      {/* Standard Keypad */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {keys.map((k, idx) => {
          let btnStyle =
            "bg-white border border-slate-200 text-slate-900 hover:bg-slate-50";
          if (k.v === "op")
            btnStyle =
              "bg-sky-50 border border-sky-200 text-sky-800 font-bold hover:bg-sky-100";
          if (k.v === "eq")
            btnStyle =
              "bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black shadow-md hover:from-amber-500 hover:to-amber-700";
          if (k.v === "spec")
            btnStyle = "bg-slate-100 border border-slate-200 text-slate-700 font-bold";

          return (
            <button
              key={idx}
              onClick={k.a}
              className={`h-14 rounded-2xl text-lg font-semibold flex items-center justify-center transition-all active:scale-95 cursor-pointer ${btnStyle} ${
                k.wide ? "col-span-2" : ""
              }`}
            >
              {k.l}
            </button>
          );
        })}
      </div>

      {/* Microfinance Loan Quick EMI Calculator */}
      <div className="bg-white rounded-3xl border border-amber-200 p-4 shadow-xs mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 rounded-xl bg-amber-100 text-amber-800">
            <Sparkles className="w-4 h-4" />
          </div>
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">
            Microfinance Loan Estimator
          </h3>
        </div>

        <div className="grid grid-cols-3 gap-2 mb-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
              Loan (₹)
            </label>
            <input
              type="number"
              value={lAmt}
              onChange={(e) => setLAmt(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
              Interest %
            </label>
            <input
              type="number"
              value={lPct}
              onChange={(e) => setLPct(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
              Weeks
            </label>
            <input
              type="number"
              value={lWks}
              onChange={(e) => setLWks(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 bg-amber-50/70 p-3 rounded-2xl border border-amber-200/60 text-center">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Total Return
            </span>
            <span className="text-base font-black text-slate-900">
              {formatCurrency(loanTotal)}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">
              Weekly Due (EMI)
            </span>
            <span className="text-base font-black text-amber-700">
              {formatCurrency(loanWeekly)}
            </span>
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-white p-3 rounded-2xl border border-slate-200 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block mb-1.5">
            Recent Calculations
          </span>
          <div className="space-y-1 text-slate-600 font-mono">
            {history.map((h, i) => (
              <div key={i} className="py-0.5 border-b border-slate-50 last:border-none">
                {h}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
