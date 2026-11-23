import React, { useState, useMemo } from "react";
import {
  Calculator,
  Sparkles,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  RotateCcw,
} from "lucide-react";
import { formatCurrency, formatDateIN, getTodayStr } from "../utils/dateUtils";
import {
  calculateLoanBreakdown,
  buildLoanSchedulePreview,
} from "../utils/financeUtils";
import { Language, RepaymentFrequency } from "../types";

const TENURE_PRESETS: Record<RepaymentFrequency, number[]> = {
  daily: [30, 50, 60, 100],
  weekly: [8, 10, 12, 16, 24],
  monthly: [3, 6, 10, 12, 24],
};

export const CalculatorTab: React.FC<{ lang?: Language }> = ({ lang = "te" }) => {
  // Keypad state
  const [display, setDisplay] = useState("0");
  const [prev, setPrev] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [newNum, setNewNum] = useState(true);
  const [history, setHistory] = useState<string[]>([]);

  // Commercial Loan Interest Calculator state
  const [freq, setFreq] = useState<RepaymentFrequency>("weekly");
  const [rateMode, setRateMode] = useState<"flat_pct" | "per_100_monthly">("flat_pct");
  const [deductUpfront, setDeductUpfront] = useState(false);
  const [principalStr, setPrincipalStr] = useState("10000");
  const [rateStr, setRateStr] = useState("20");
  const [periodsStr, setPeriodsStr] = useState("12");
  const [customDueStr, setCustomDueStr] = useState("");
  const [startDate, setStartDate] = useState(() => getTodayStr());
  const [showSchedule, setShowSchedule] = useState(false);

  const handleFreqChange = (nextFreq: RepaymentFrequency) => {
    setFreq(nextFreq);
    setCustomDueStr("");
    if (nextFreq === "daily") setPeriodsStr("100");
    else if (nextFreq === "monthly") setPeriodsStr("6");
    else setPeriodsStr("12");
  };

  const handleRateModeChange = (nextMode: "flat_pct" | "per_100_monthly") => {
    setRateMode(nextMode);
    if (nextMode === "per_100_monthly") setRateStr("2");
    else setRateStr("20");
  };

  const breakdown = useMemo(
    () =>
      calculateLoanBreakdown({
        principal: parseFloat(principalStr) || 0,
        rateValue: parseFloat(rateStr) || 0,
        rateMode,
        periods: parseInt(periodsStr, 10) || 1,
        freq,
        deductUpfront,
        customInstallment: customDueStr ? parseFloat(customDueStr) : undefined,
      }),
    [principalStr, rateStr, rateMode, periodsStr, freq, deductUpfront, customDueStr]
  );

  const scheduleRows = useMemo(
    () =>
      showSchedule
        ? buildLoanSchedulePreview(
            startDate,
            parseInt(periodsStr, 10) || 1,
            freq,
            breakdown.installmentDue,
            breakdown.totalRepayable
          )
        : [],
    [showSchedule, startDate, periodsStr, freq, breakdown.installmentDue, breakdown.totalRepayable]
  );

  // Keypad handlers
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

  const periodUnit =
    freq === "daily"
      ? lang === "te"
        ? "రోజులు"
        : "Days"
      : freq === "monthly"
      ? lang === "te"
        ? "నెలలు"
        : "Months"
      : lang === "te"
      ? "వారాలు"
      : "Weeks";

  const perPeriodLabel =
    freq === "daily"
      ? lang === "te"
        ? "రోజు వాయిదా"
        : "Daily Due"
      : freq === "monthly"
      ? lang === "te"
        ? "నెల వాయిదా"
        : "Monthly Due"
      : lang === "te"
      ? "వారం వాయిదా"
      : "Weekly Due";

  return (
    <div className="pb-28 px-4 pt-3 max-w-lg md:max-w-3xl lg:max-w-5xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT / PRIMARY: LOAN INTEREST & SCHEDULE CALCULATOR */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-[#131B2E] rounded-3xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-slate-100">
                    {lang === "te" ? "రుణ వడ్డీ & వాయిదా క్యాలిక్యులేటర్" : "Loan Interest & Schedule Calculator"}
                  </h2>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {lang === "te"
                      ? "రోజువారీ, వారంవారీ & నెలవారీ లైన్ లెక్కలు"
                      : "Daily, Weekly & Monthly Line EMI + Yield"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFreq("weekly");
                  setRateMode("flat_pct");
                  setDeductUpfront(false);
                  setPrincipalStr("10000");
                  setRateStr("20");
                  setPeriodsStr("12");
                  setCustomDueStr("");
                }}
                aria-label="Reset calculator"
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === "te" ? "రీసెట్" : "Reset"}</span>
              </button>
            </div>

            {/* Frequency Segmented Control */}
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              {(
                [
                  ["weekly", lang === "te" ? "వారం (Weekly)" : "Weekly"],
                  ["daily", lang === "te" ? "రోజు (Daily)" : "Daily"],
                  ["monthly", lang === "te" ? "నెల (Monthly)" : "Monthly"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleFreqChange(key)}
                  className={`min-h-[40px] py-2 px-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                    freq === key
                      ? "bg-[#1E3A8A] text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Interest Calculation Mode + Upfront Cut Toggle */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => handleRateModeChange("flat_pct")}
                  className={`min-h-[38px] px-2 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                    rateMode === "flat_pct"
                      ? "bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {lang === "te" ? "ఫ్లాట్ % (Flat %)" : "Flat % Rate"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRateModeChange("per_100_monthly")}
                  className={`min-h-[38px] px-2 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                    rateMode === "per_100_monthly"
                      ? "bg-white dark:bg-[#1E293B] text-slate-900 dark:text-white shadow-xs"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {lang === "te" ? "₹100 కి నెల వడ్డీ" : "₹ / 100 Monthly"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setDeductUpfront((v) => !v)}
                aria-pressed={deductUpfront}
                className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between cursor-pointer transition-all ${
                  deductUpfront
                    ? "bg-amber-50 dark:bg-amber-950/50 border-amber-400 text-amber-900 dark:text-amber-300"
                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                }`}
              >
                <span>
                  {lang === "te" ? "ముందే వడ్డీ కోత (Upfront Cut)" : "Upfront Interest Deduction"}
                </span>
                <span className="font-black">{deductUpfront ? "ON" : "OFF"}</span>
              </button>
            </div>

            {/* Principal + Quick Presets */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="calc-principal"
                  className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase"
                >
                  {lang === "te" ? "రుణం మొత్తం (₹)" : "Loan / Card Amount (₹)"}
                </label>
                <div className="flex gap-1.5 flex-wrap">
                  {[5000, 10000, 20000, 50000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setPrincipalStr(String(amt))}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer tabular-nums ${
                        Number(principalStr) === amt
                          ? "bg-blue-50 dark:bg-blue-950/60 border-blue-400 text-blue-800 dark:text-blue-300"
                          : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      ₹{amt >= 1000 ? `${amt / 1000}k` : amt}
                    </button>
                  ))}
                </div>
              </div>
              <input
                id="calc-principal"
                type="number"
                value={principalStr}
                onChange={(e) => setPrincipalStr(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-base font-black text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 tabular-nums"
              />
            </div>

            {/* Rate, Tenure & Custom EMI */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label
                  htmlFor="calc-rate"
                  className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1"
                >
                  {rateMode === "flat_pct"
                    ? lang === "te"
                      ? "వడ్డీ రేటు (%)"
                      : "Flat Interest (%)"
                    : lang === "te"
                    ? "₹100 కి వడ్డీ (₹)"
                    : "₹ per 100 / Mo"}
                </label>
                <input
                  id="calc-rate"
                  type="number"
                  step="0.5"
                  value={rateStr}
                  onChange={(e) => setRateStr(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="calc-periods"
                  className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1"
                >
                  {lang === "te" ? `వ్యవధి (${periodUnit})` : `Tenure (${periodUnit})`}
                </label>
                <input
                  id="calc-periods"
                  type="number"
                  min={1}
                  value={periodsStr}
                  onChange={(e) => setPeriodsStr(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 tabular-nums"
                />
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {TENURE_PRESETS[freq].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriodsStr(String(p))}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold cursor-pointer tabular-nums ${
                        Number(periodsStr) === p
                          ? "bg-[#1E3A8A] text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label
                  htmlFor="calc-custom-emi"
                  className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase block mb-1"
                >
                  {lang === "te" ? "వాయిదా మార్పు (ఐచ్ఛికం)" : "Override EMI (Opt.)"}
                </label>
                <input
                  id="calc-custom-emi"
                  type="number"
                  placeholder={`Auto ${formatCurrency(breakdown.installmentDue)}`}
                  value={customDueStr}
                  onChange={(e) => setCustomDueStr(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500 tabular-nums"
                />
              </div>
            </div>

            {/* Results Readout Card */}
            <div className="rounded-2xl p-4 bg-gradient-to-br from-[#0B1728] via-[#102A45] to-[#0B1320] text-white space-y-3 border border-slate-700">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 tabular-nums">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-300 block">
                    {lang === "te" ? "చేతికిచ్చే నగదు" : "Cash Handed Out"}
                  </span>
                  <span className="text-base sm:text-lg font-black text-white">
                    {formatCurrency(breakdown.cashHandedOut)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-amber-300 block">
                    {perPeriodLabel}
                  </span>
                  <span className="text-base sm:text-lg font-black text-amber-300">
                    {formatCurrency(breakdown.installmentDue)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-300 block">
                    {lang === "te" ? "మొత్తం రావాల్సింది" : "Total Repayable"}
                  </span>
                  <span className="text-base sm:text-lg font-black text-white">
                    {formatCurrency(breakdown.totalRepayable)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-300 block">
                    {lang === "te" ? "నికర లాభం" : "Net Profit"}
                  </span>
                  <span className="text-base sm:text-lg font-black text-emerald-300">
                    {formatCurrency(breakdown.netProfit)}
                  </span>
                </div>
              </div>

              <div className="pt-2.5 border-t border-white/15 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200 tabular-nums">
                <span>
                  {lang === "te" ? "ప్రభావవంతమైన రాబడి (ROI):" : "Cycle ROI:"}{" "}
                  <strong className="text-amber-300">{breakdown.roiPct}%</strong>
                  {" · "}
                  {lang === "te" ? "వార్షిక APR:" : "Annual APR:"}{" "}
                  <strong className="text-emerald-300">{breakdown.annualizedAprPct}%</strong>
                </span>

                <button
                  type="button"
                  onClick={() => setShowSchedule((s) => !s)}
                  className="min-h-[36px] px-3 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center gap-1 cursor-pointer"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>
                    {showSchedule
                      ? lang === "te"
                        ? "షెడ్యూల్ దాచు"
                        : "Hide Schedule"
                      : lang === "te"
                      ? "వాయిదాల పట్టిక చూడండి"
                      : "View Schedule"}
                  </span>
                  {showSchedule ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Installment Schedule Preview */}
            {showSchedule && (
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase">
                    {lang === "te" ? "వాయిదా తేదీల పట్టిక" : "Installment Schedule Preview"}
                  </span>
                  <input
                    type="date"
                    aria-label="Loan start date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100"
                  />
                </div>

                <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 text-xs tabular-nums">
                  {scheduleRows.map((row) => (
                    <div
                      key={row.installmentNumber}
                      className="flex items-center justify-between px-3 py-2 bg-slate-50/70 dark:bg-slate-900/40"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-6 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-[10px] text-blue-800 dark:text-blue-300">
                          #{row.installmentNumber}
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {formatDateIN(row.dueDate, lang)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          {formatCurrency(row.amount)}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 min-w-[70px] text-right">
                          {lang === "te" ? "బాకీ:" : "Bal:"} {formatCurrency(row.remainingAfter)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT / SECONDARY: QUICK ARITHMETIC KEYPAD */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-[#131B2E] rounded-3xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-sky-700 dark:text-sky-400" />
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {lang === "te" ? "త్వరిత క్యాలిక్యులేటర్" : "Quick Keypad Calculator"}
              </h3>
            </div>

            <div className="bg-slate-900 dark:bg-[#0B1120] text-white rounded-2xl p-4 border border-slate-800 flex flex-col justify-end min-h-[96px]">
              {op && prev !== null && (
                <span className="text-xs text-amber-400 font-semibold mb-1 tabular-nums">
                  {prev} {op}
                </span>
              )}
              <div className="text-3xl font-extrabold text-right tracking-tight break-all font-mono tabular-nums">
                {display}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {keys.map((k, idx) => {
                let btnStyle =
                  "bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800";
                if (k.v === "op")
                  btnStyle =
                    "bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-300 font-bold hover:bg-sky-100 dark:hover:bg-sky-900/60";
                if (k.v === "eq")
                  btnStyle =
                    "bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-black shadow-md hover:from-amber-500 hover:to-amber-700";
                if (k.v === "spec")
                  btnStyle =
                    "bg-slate-200/70 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-bold";

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={k.a}
                    className={`h-13 rounded-2xl text-lg font-semibold flex items-center justify-center transition-all active:scale-95 cursor-pointer ${btnStyle} ${
                      k.wide ? "col-span-2" : ""
                    }`}
                  >
                    {k.l}
                  </button>
                );
              })}
            </div>
          </div>

          {history.length > 0 && (
            <div className="bg-white dark:bg-[#131B2E] p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1.5">
                {lang === "te" ? "ఇటీవలి లెక్కలు" : "Recent Calculations"}
              </span>
              <div className="space-y-1 text-slate-700 dark:text-slate-300 font-mono tabular-nums">
                {history.map((h, i) => (
                  <div
                    key={i}
                    className="py-1 border-b border-slate-100 dark:border-slate-800 last:border-none"
                  >
                    {h}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
