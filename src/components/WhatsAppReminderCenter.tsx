import React, { useState, useMemo } from "react";
import {
  Bell,
  MessageCircle,
  CheckCircle2,
  Clock,
  Send,
  Building2,
  Calendar,
  X,
  ExternalLink,
  Phone,
  Copy,
  Check,
  ChevronRight,
  Filter,
  Flame,
} from "lucide-react";
import { Borrower, Village, Language, BusinessProfile } from "../types";
import {
  formatCurrency,
  formatDateIN,
  getDayName,
  getTodayStr,
  calculateRemainingBalance,
} from "../utils/dateUtils";
import {
  buildAdvanceReminderText,
  openWhatsApp,
  getTwoDayAdvanceInfo,
  isReminderSent,
  markReminderSent,
  normalizePhoneNumber,
  getWhatsAppRules,
  isBorrowerKeypad,
  canAutoSendReminder,
} from "../utils/whatsapp";

interface WhatsAppReminderCenterProps {
  data: { villages: Village[]; borrowers: Record<string, Borrower[]> };
  profile: BusinessProfile;
  lang: Language;
  onClose: () => void;
  showToast?: (msg: string, type?: "success" | "error" | "info") => void;
}

export const WhatsAppReminderCenter: React.FC<WhatsAppReminderCenterProps> = ({
  data,
  profile,
  lang,
  onClose,
  showToast,
}) => {
  const advanceInfo = useMemo(
    () => getTwoDayAdvanceInfo(data.villages),
    [data.villages]
  );

  // Selected village tab (defaults to first matching 2-day village, or first available village)
  const [selectedVillageId, setSelectedVillageId] = useState<string>(() => {
    if (advanceInfo.matchingVillages.length > 0) {
      return advanceInfo.matchingVillages[0].id;
    }
    return data.villages[0]?.id || "";
  });

  const [previewBorrower, setPreviewBorrower] = useState<Borrower | null>(null);
  const [copied, setCopied] = useState(false);
  // Local trigger to re-render when reminders are marked as sent
  const [sentVersion, setSentVersion] = useState(0);

  const selectedVillage = data.villages.find((v) => v.id === selectedVillageId);
  const targetDateStr = advanceInfo.targetDateStr;

  // Active borrowers for selected village
  const activeBorrowers = useMemo(() => {
    if (!selectedVillageId) return [];
    const list = data.borrowers[selectedVillageId] || [];
    return [...list]
      .filter((b) => b.weeksPaid < (b.durationWeeks || 12))
      .sort((a, b) => {
        const na = a.seqNo ? parseInt(a.seqNo) || 0 : 99999;
        const nb = b.seqNo ? parseInt(b.seqNo) || 0 : 99999;
        if (na !== nb) return na - nb;
        return (a.seqNo || "").localeCompare(b.seqNo || "");
      });
  }, [data.borrowers, selectedVillageId]);

  // Status mapping
  const reminderStats = useMemo(() => {
    const rules = getWhatsAppRules();
    let sentCount = 0;
    let eligibleCount = 0;
    activeBorrowers.forEach((b) => {
      const eligible = canAutoSendReminder(b, selectedVillageId, rules);
      if (eligible) {
        eligibleCount++;
        if (isReminderSent(b.id, targetDateStr)) {
          sentCount++;
        }
      }
    });
    const pendingCount = Math.max(0, eligibleCount - sentCount);
    const progressPct =
      eligibleCount > 0 ? Math.round((sentCount / eligibleCount) * 100) : 0;

    return { sentCount, eligibleCount, pendingCount, progressPct };
  }, [activeBorrowers, selectedVillageId, targetDateStr, sentVersion]);

  // Send single reminder
  const handleSendReminder = (b: Borrower) => {
    const rules = getWhatsAppRules();
    const isKeypad = isBorrowerKeypad(b, rules);
    const reminderDisabled =
      b.disableReminder ||
      rules.borrowerConfigs[b.id]?.disableReminder ||
      (selectedVillageId ? rules.villageConfigs[selectedVillageId]?.disableReminder : false);

    if (isKeypad) {
      if (showToast) {
        showToast(
          lang === "te"
            ? `${b.name} సాధారణ కీప్యాడ్ మొబైల్ గలవారు (వాట్సాప్ లేదు 📵)`
            : `${b.name} has a keypad mobile (No WhatsApp 📵)`,
          "info"
        );
      }
      return;
    }

    if (reminderDisabled) {
      if (showToast) {
        showToast(
          lang === "te"
            ? `${b.name} కి రిమైండర్లు ఆపివేయబడ్డాయి 🔕`
            : `WhatsApp reminders are disabled for ${b.name} 🔕`,
          "info"
        );
      }
      return;
    }

    const rem = calculateRemainingBalance(b);
    const msg = buildAdvanceReminderText({
      borrower: b,
      villageName: selectedVillage?.name || "",
      visitDate: targetDateStr,
      businessName: profile.businessName,
      remainingBal: rem,
      lang,
    });

    openWhatsApp(b.phone, msg);
    markReminderSent(b.id, targetDateStr);
    setSentVersion((v) => v + 1);

    if (showToast) {
      showToast(
        lang === "te"
          ? `${b.name} కి రిమైండర్ పంపబడింది ✓`
          : `Reminder sent to ${b.name} ✓`,
        "success"
      );
    }
  };

  // 1-Click "Send Next Pending"
  const handleSendNextPending = () => {
    const rules = getWhatsAppRules();
    const nextPending = activeBorrowers.find(
      (b) =>
        canAutoSendReminder(b, selectedVillageId, rules) &&
        !isReminderSent(b.id, targetDateStr)
    );
    if (!nextPending) {
      if (showToast) {
        showToast(
          lang === "te"
            ? "అన్ని రిమైండర్లు ఇప్పటికే పంపబడ్డాయి! ✓"
            : "All reminders already sent! ✓",
          "info"
        );
      }
      return;
    }
    handleSendReminder(nextPending);
  };

  const previewMessage = previewBorrower
    ? buildAdvanceReminderText({
        borrower: previewBorrower,
        villageName: selectedVillage?.name || "",
        visitDate: targetDateStr,
        businessName: profile.businessName,
        remainingBal: calculateRemainingBalance(previewBorrower),
        lang,
      })
    : "";

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white dark:bg-[#131B2E] w-full max-w-lg rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl max-h-[94vh] flex flex-col border border-slate-200 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {lang === "te" ? "లైన్ కలెక్షన్ ముందస్తు హెచ్చరిక" : "2-Day Advance Line Reminder"}
              </span>
              <h3 className="text-base font-black text-slate-900 dark:text-white leading-tight">
                {lang === "te" ? "వాట్సాప్ రిమైండర్ సెంటర్" : "WhatsApp Reminders"}
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

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3.5 pr-0.5">
          {/* Target Visit Notice Card */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/40 dark:border-amber-600/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                2D
              </div>
              <div>
                <p className="text-xs font-black text-slate-900 dark:text-white">
                  {lang === "te"
                    ? `రాబోయే లైన్: ${getDayName(targetDateStr, lang)} (${formatDateIN(targetDateStr, lang)})`
                    : `Upcoming Line: ${getDayName(targetDateStr, lang)} (${formatDateIN(targetDateStr, lang)})`}
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                  {advanceInfo.isTwoDaysAhead
                    ? lang === "te"
                      ? "⚡ సరిగ్గా 2 రోజుల్లో లైన్ కలెక్షన్ ఉంది!"
                      : "⚡ Exactly 2 days before collection day!"
                    : lang === "te"
                    ? "ఖాతాదారులకు ముందస్తు వాట్సాప్ రిమైండర్ పంపండి"
                    : "Send advance WhatsApp reminders to borrowers"}
                </p>
              </div>
            </div>
          </div>

          {/* Village Select Tabs */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              {lang === "te" ? "గ్రామం ఎంచుకోండి" : "Select Line Village"}
            </span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {data.villages.map((v) => {
                const isSelected = v.id === selectedVillageId;
                const bCount = (data.borrowers[v.id] || []).filter(
                  (b) => b.weeksPaid < (b.durationWeeks || 12)
                ).length;

                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVillageId(v.id)}
                    className={`py-2 px-3.5 rounded-xl font-extrabold text-xs shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#1E3A8A] text-white shadow-md shadow-blue-900/30"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200"
                    }`}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                    <span>{v.name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                        isSelected
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
                      }`}
                    >
                      {bCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Progress & Quick Batch Dispatch */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0B1120] border border-slate-200 dark:border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {lang === "te" ? "రిమైండర్ల పురోగతి" : "Reminder Progress"}
              </span>
              <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                {reminderStats.sentCount} / {activeBorrowers.length} {lang === "te" ? "పంపబడ్డాయి" : "Sent"} (
                {reminderStats.progressPct}%)
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${reminderStats.progressPct}%` }}
              />
            </div>

            {/* Quick 1-Tap Send Next Button */}
            <button
              onClick={handleSendNextPending}
              disabled={reminderStats.pendingCount === 0}
              className={`w-full py-3 px-4 rounded-xl font-black text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                reminderStats.pendingCount > 0
                  ? "bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-md shadow-emerald-500/20 active:scale-98"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-400 cursor-not-allowed"
              }`}
            >
              <Send className="w-4 h-4" />
              <span>
                {reminderStats.pendingCount > 0
                  ? lang === "te"
                    ? `వరుసగా తదుపరి రిమైండర్ పంపండి (${reminderStats.pendingCount} మిగిలాయి) →`
                    : `Send Next Pending Reminder (${reminderStats.pendingCount} left) →`
                  : lang === "te"
                  ? "✓ అన్ని రిమైండర్లు పంపబడ్డాయి"
                  : "✓ All Reminders Sent"}
              </span>
            </button>
          </div>

          {/* Borrower List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                {selectedVillage?.name} {lang === "te" ? "ఖాతాదారులు" : "Borrowers"} (
                {activeBorrowers.length})
              </span>
              <span className="text-[11px] text-slate-400">
                {lang === "te" ? "1-క్లిక్ వాట్సాప్" : "1-Click WhatsApp"}
              </span>
            </div>

            {activeBorrowers.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                {lang === "te"
                  ? "ఈ గ్రామంలో యాక్టివ్ ఖాతాదారులు ఎవరూ లేరు."
                  : "No active borrowers in this village."}
              </div>
            ) : (
              activeBorrowers.map((b, idx) => {
                const rules = getWhatsAppRules();
                const isKeypad = isBorrowerKeypad(b, rules);
                const bCfg = rules.borrowerConfigs[b.id];
                const vCfg = selectedVillageId ? rules.villageConfigs[selectedVillageId] : undefined;
                const isReminderDisabled = Boolean(
                  b.disableReminder || bCfg?.disableReminder || vCfg?.disableReminder
                );
                const isSent = isReminderSent(b.id, targetDateStr);
                const remBal = calculateRemainingBalance(b);
                const nextWeek = b.weeksPaid + 1;
                const totalWeeks = b.durationWeeks || 12;

                return (
                  <div
                    key={b.id}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      isSent
                        ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300/40 dark:border-emerald-800/40"
                        : "bg-white dark:bg-[#1E293B] border-slate-200 dark:border-slate-800"
                    }`}
                  >
                    {/* Left: Borrower info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-black flex items-center justify-center shrink-0">
                          {b.seqNo || idx + 1}
                        </span>
                        <h4 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                          {b.name}
                        </h4>
                        {isKeypad ? (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] font-bold">
                            📵 {lang === "te" ? "కీప్యాడ్" : "Keypad"}
                          </span>
                        ) : isReminderDisabled ? (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 text-[10px] font-bold">
                            🔕 {lang === "te" ? "రిమైండర్ ఆఫ్" : "Reminder Off"}
                          </span>
                        ) : isSent ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 text-[10px] font-bold">
                            ✓ {lang === "te" ? "పంపబడింది" : "Sent"}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span>
                          {lang === "te" ? "వాయిదా:" : "Due:"}{" "}
                          <strong className="text-slate-900 dark:text-white">
                            {formatCurrency(b.weeklyDue)}
                          </strong>
                        </span>
                        <span>·</span>
                        <span>
                          Wk {nextWeek}/{totalWeeks}
                        </span>
                        <span>·</span>
                        <span>
                          {b.phone ? `📱 ${b.phone}` : "⚠️ No phone"}
                        </span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setPreviewBorrower(b)}
                        title="Preview message"
                        className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 cursor-pointer"
                      >
                        👁️
                      </button>

                      {isKeypad || isReminderDisabled ? (
                        <span className="py-1.5 px-2.5 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700">
                          {isKeypad ? "📵 Keypad" : "🔕 Muted"}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSendReminder(b)}
                          className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                            isSent
                              ? "bg-slate-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-300/40"
                              : "bg-[#25D366] hover:bg-[#20bd5a] text-white shadow-xs"
                          }`}
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-current" />
                          <span>
                            {isSent
                              ? lang === "te"
                                ? "మళ్లీ పంపు"
                                : "Resend"
                              : lang === "te"
                              ? "పంపు"
                              : "Send"}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200/80 dark:border-slate-800 pt-3 flex justify-between items-center">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {lang === "te"
              ? "ల్యాప్‌టాప్ & ఫోన్ వాట్సాప్ నుండి నేరుగా డెలివరీ అవుతాయి"
              : "Directly delivered from your personal WhatsApp"}
          </p>
          <button
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 cursor-pointer"
          >
            {lang === "te" ? "ముగించు" : "Done"}
          </button>
        </div>
      </div>

      {/* Message Preview Sheet */}
      {previewBorrower && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#131B2E] w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-3 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <span className="text-xs font-black text-slate-900 dark:text-white">
                {lang === "te" ? "రిమైండర్ మెసేజ్ ప్రివ్యూ" : "Reminder Message Preview"}
              </span>
              <button
                onClick={() => setPreviewBorrower(null)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-[#0B1120] rounded-xl text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-mono border border-slate-200 dark:border-slate-800 max-h-60 overflow-y-auto">
              {previewMessage}
            </div>

            <div className="flex gap-2">
              <button
                onClick={async () => {
                  await navigator.clipboard.writeText(previewMessage);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center justify-center gap-1"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? "Copied" : "Copy Text"}</span>
              </button>

              <button
                onClick={() => {
                  handleSendReminder(previewBorrower);
                  setPreviewBorrower(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-[#25D366] text-white text-xs font-bold flex items-center justify-center gap-1 shadow-md"
              >
                <Send className="w-4 h-4" />
                <span>{lang === "te" ? "ఇప్పుడే పంపు" : "Send Now"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
