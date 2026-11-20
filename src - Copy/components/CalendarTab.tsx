import React, { useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, Calendar } from "lucide-react";
import { CollectionRecord, Language } from "../types";
import { translations } from "../translations";
import {
  MONTHS_EN,
  MONTHS_TE,
  formatCurrency,
  formatDateIN,
  getDayName,
} from "../utils/dateUtils";

interface CalendarTabProps {
  collections: Record<string, CollectionRecord>;
  lang: Language;
}

export const CalendarTab: React.FC<CalendarTabProps> = ({
  collections,
  lang,
}) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  const t = translations[lang];

  const collDates = new Set(Object.values(collections).map((c) => c.date));
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const isMonday = (d: number) => new Date(year, month, d).getDay() === 1;
  const isTuesday = (d: number) => new Date(year, month, d).getDay() === 2;
  const isToday = (d: number) =>
    d === now.getDate() && month === now.getMonth() && year === now.getFullYear();

  const isCollected = (d: number) => {
    const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return collDates.has(ds);
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // Monthly collection records
  const monthCollections = Object.values(collections)
    .filter((c) => {
      const cd = new Date(c.date + "T12:00:00");
      return cd.getMonth() === month && cd.getFullYear() === year;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="pb-28 px-4 pt-3 max-w-lg mx-auto">
      {/* Calendar Card */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm mb-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900 to-cyan-800 text-white p-4 flex items-center justify-between">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="font-extrabold text-base tracking-wide">
            {lang === "te" ? MONTHS_TE[month] : MONTHS_EN[month]} {year}
          </h3>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day Name Labels */}
        <div className="grid grid-cols-7 bg-sky-50/50 py-2 text-center text-xs font-bold text-slate-500 border-b border-slate-100">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, idx) => (
            <div
              key={d}
              className={idx === 1 || idx === 2 ? "text-sky-700 font-black" : ""}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Days Grid */}
        <div className="grid grid-cols-7 gap-1 p-2 text-center text-xs">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="h-10" />;

            const mon = isMonday(d);
            const tue = isTuesday(d);
            const tod = isToday(d);
            const col = isCollected(d);
            const isVisitDay = mon || tue;

            let bgClass = "hover:bg-slate-50 text-slate-700";
            if (col) bgClass = "bg-emerald-600 text-white font-extrabold shadow-xs";
            else if (tod) bgClass = "bg-sky-700 text-white font-extrabold shadow-xs";
            else if (isVisitDay) bgClass = "bg-sky-50 text-sky-800 font-bold border border-sky-200/60";

            return (
              <div
                key={i}
                className={`h-10 rounded-xl flex flex-col items-center justify-center transition-all ${bgClass}`}
              >
                <span>{d}</span>
                {isVisitDay && !col && (
                  <span className="w-1 h-1 rounded-full bg-sky-600 mt-0.5" />
                )}
                {col && (
                  <span className="w-1 h-1 rounded-full bg-white mt-0.5" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend Card */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs mb-4 text-xs space-y-2">
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-md bg-sky-50 border border-sky-200 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
          </div>
          <span className="text-slate-600 font-medium">
            Monday / Tuesday — Scheduled Village Visit Days
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-md bg-emerald-600 flex items-center justify-center text-white text-[10px]">
            ✓
          </div>
          <span className="text-slate-600 font-medium">
            Collection Completed & Saved
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="w-5 h-5 rounded-md bg-sky-700 text-white flex items-center justify-center font-bold text-[10px]">
            •
          </div>
          <span className="text-slate-600 font-medium">Today</span>
        </div>
      </div>

      {/* Collections This Month */}
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
        {lang === "te" ? "ఈ నెల సేకరణలు" : "This Month's Collections"} (
        {monthCollections.length})
      </h3>

      {monthCollections.length === 0 ? (
        <div className="bg-white p-6 rounded-2xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
          No collections recorded in this month.
        </div>
      ) : (
        <div className="space-y-2">
          {monthCollections.map((c, idx) => (
            <div
              key={idx}
              className="bg-white p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between shadow-xs text-xs"
            >
              <div>
                <h4 className="font-bold text-slate-900 text-sm">
                  {c.villageName}
                </h4>
                <p className="text-[11px] text-slate-500">
                  {getDayName(c.date, lang)}, {formatDateIN(c.date, lang)}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-extrabold text-xs">
                {formatCurrency(c.totalCollected)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
