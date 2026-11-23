import type {
  Borrower,
  BusinessProfile,
  CollectionRecord,
  Language,
  Village,
} from "../types.ts";
import { formatCurrency, formatDateIN } from "./dateUtils.ts";
import {
  calculateDailyCashbook,
  calculateRemainingBalance,
  calculateTotalPaid,
  calculateTotalShortfall,
  getFrequencyLabel,
  getFrequencyShortPrefix,
  isBorrowerClosed,
  type CashbookDataSources,
  type RecordBookPeriodRow,
  type RecordBookLineCycleRow,
} from "./financeUtils.ts";
import { saveOrShareTextFile } from "./platformUtils";

export const UTF8_BOM = "\uFEFF";

/**
 * Escapes a single CSV value safely for Excel & Google Sheets (preserving Telugu Unicode & numbers)
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvLines(headers: string[], rows: unknown[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(",");
  const dataLines = rows.map((r) => r.map(escapeCsvCell).join(","));
  return `${UTF8_BOM}${[headerLine, ...dataLines].join("\r\n")}`;
}

/**
 * Builds UTF-8 BOM CSV for all Borrowers across all Line Villages
 */
export function buildBorrowersCsv(
  villages: Village[],
  borrowersMap: Record<string, Borrower[]>,
  lang: Language = "en"
): string {
  const headers =
    lang === "te"
      ? [
          "రోల్ నెం",
          "పేరు",
          "తండ్రి / భర్త / షాపు",
          "ఫోన్",
          "గ్రామం",
          "లైన్ రోజు",
          "హామీదారుడు",
          "హామీ ఫోన్",
          "సైకిల్ #",
          "వాయిదా రకం",
          "మొత్తం అప్పు (₹)",
          "వాయిదా (₹)",
          "రావలసిన మొత్తం (₹)",
          "చెల్లించినది (₹)",
          "మిగిలిన బాకీ (₹)",
          "తరుగు (₹)",
          "చెల్లించిన వాయిదాలు",
          "మొత్తం వాయిదాలు",
          "స్థితి",
          "ప్రారంభ తేదీ",
          "లింగం",
          "వయస్సు",
          "వ్యాపారం / పని",
          "చిరునామా",
        ]
      : [
          "Roll #",
          "Borrower Name",
          "Care Of",
          "Phone",
          "Village",
          "Line Day",
          "Guarantor Name",
          "Guarantor Phone",
          "Cycle #",
          "Schedule",
          "Principal (₹)",
          "Installment Due (₹)",
          "Total Return (₹)",
          "Total Paid (₹)",
          "Balance Remaining (₹)",
          "Shortfall (₹)",
          "Periods Paid",
          "Total Periods",
          "Status",
          "Start Date",
          "Gender",
          "Age",
          "Occupation",
          "Address",
        ];

  const rows: unknown[][] = [];
  for (const v of villages || []) {
    const list = borrowersMap?.[v.id] || [];
    for (const b of list) {
      const totalRet =
        b.totalReturn || b.weeklyDue * (b.durationWeeks || 12);
      const totalPaid = calculateTotalPaid(b);
      const remaining = calculateRemainingBalance(b);
      const shortfall = calculateTotalShortfall(b);
      const closed = isBorrowerClosed(b);
      const statusLabel = b.settledAt
        ? lang === "te"
          ? "ముందస్తు సెటిల్‌మెంట్"
          : "Settled Early"
        : closed
        ? lang === "te"
          ? "పూర్తయింది"
          : "Closed"
        : lang === "te"
        ? "యాక్టివ్"
        : "Active";

      rows.push([
        b.seqNo || "",
        b.name,
        b.careOf || "",
        b.phone || "",
        v.name,
        v.day,
        b.guarantorName || "",
        b.guarantorPhone || "",
        b.loanCycle || 1,
        getFrequencyLabel(b.repaymentFreq, "en"),
        b.loanAmt,
        b.weeklyDue,
        totalRet,
        totalPaid,
        remaining,
        shortfall,
        b.weeksPaid,
        b.durationWeeks,
        statusLabel,
        b.startDate || "",
        b.gender || "",
        b.age || "",
        b.occupation || "",
        b.address || "",
      ]);
    }
  }

  return toCsvLines(headers, rows);
}

/**
 * Builds UTF-8 BOM CSV for recorded Village Collection Sheets with Payment Mode splits
 */
export function buildCollectionsCsv(
  collections: Record<string, CollectionRecord>,
  lang: Language = "en"
): string {
  const headers =
    lang === "te"
      ? [
          "తేదీ",
          "గ్రామం",
          "లక్ష్యం (₹)",
          "మొత్తం వసూలు (₹)",
          "నగదు - Cash (₹)",
          "ఫోన్‌పే - PhonePe (₹)",
          "ఆన్‌లైన్ - Online (₹)",
          "తరుగు (₹)",
          "చెల్లించిన వారు",
          "తక్కువ",
          "దాటవేసిన వారు",
          "అదనపు",
        ]
      : [
          "Date",
          "Village",
          "Expected Target (₹)",
          "Total Collected (₹)",
          "Cash (₹)",
          "PhonePe UPI (₹)",
          "Online Bank (₹)",
          "Shortfall (₹)",
          "Paid Count",
          "Short Count",
          "Skip Count",
          "Extra Count",
        ];

  const sorted = Object.values(collections || {}).sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  const rows: unknown[][] = sorted.map((col) => {
    const entries = col.entries || [];
    let cash = 0;
    let phonepe = 0;
    let online = 0;
    let paidC = 0;
    let shortC = 0;
    let skipC = 0;
    let extraC = 0;

    if (entries.length > 0) {
      for (const e of entries) {
        if (e.status === "paid") paidC++;
        else if (e.status === "short") shortC++;
        else if (e.status === "skip") skipC++;
        else if (e.status === "extra") extraC++;

        if (e.status !== "skip") {
          const amt = Number(e.amtPaid) || 0;
          if (e.payMethod === "phonepe") phonepe += amt;
          else if (e.payMethod === "online") online += amt;
          else cash += amt;
        }
      }
    } else {
      cash = Number(col.totalCollected) || 0;
    }

    const expected = Number(col.totalExpected) || 0;
    const collected = Number(col.totalCollected) || cash + phonepe + online;
    const shortfall = Math.max(0, expected - collected);

    return [
      col.date,
      col.villageName,
      expected,
      collected,
      cash,
      phonepe,
      online,
      shortfall,
      paidC,
      shortC,
      skipC,
      extraC,
    ];
  });

  return toCsvLines(headers, rows);
}

/**
 * Builds UTF-8 BOM CSV for Daily Cashbook Reconciliation across dates
 */
export function buildCashbookCsv(
  dates: string[],
  sources: CashbookDataSources,
  lang: Language = "en"
): string {
  const headers =
    lang === "te"
      ? [
          "తేదీ",
          "ప్రారంభ బ్యాగ్ నగదు (₹)",
          "నగదు వసూలు (₹)",
          "ఫోన్‌పే వసూలు (₹)",
          "ఆన్‌లైన్ వసూలు (₹)",
          "మొత్తం వసూలు (₹)",
          "కొత్త అప్పులు (₹)",
          "లైన్ ఖర్చులు (₹)",
          "సొంత ఖర్చులు (₹)",
          "ముగింపు బ్యాగ్ నగదు (₹)",
        ]
      : [
          "Date",
          "Opening Bag Cash (₹)",
          "Cash Collected (₹)",
          "PhonePe UPI (₹)",
          "Online Bank (₹)",
          "Total Collected (₹)",
          "New Loans Given (₹)",
          "Field Expenses (₹)",
          "Personal Drawings (₹)",
          "Closing Cash in Bag (₹)",
        ];

  const rows: unknown[][] = dates.map((d) => {
    const s = calculateDailyCashbook(d, sources);
    return [
      s.date,
      s.openingCash,
      s.cashCollected,
      s.phonePeCollected,
      s.onlineCollected,
      s.totalCollected,
      s.newLoansTotal,
      s.expensesTotal,
      s.personalTotal,
      s.closingCashInBag,
    ];
  });

  return toCsvLines(headers, rows);
}

/**
 * Builds UTF-8 BOM CSV for Weekly / Monthly / Cycle Record Book statements
 */
export function buildRecordBookCsv(
  periodRows: (RecordBookPeriodRow | RecordBookLineCycleRow)[],
  mode: "weekly" | "monthly" | "cycle",
  lang: Language = "en"
): string {
  const periodColEn =
    mode === "weekly" ? "Week" : mode === "monthly" ? "Month" : "Line Cycle";
  const periodColTe =
    mode === "weekly" ? "వారం" : mode === "monthly" ? "నెల" : "లైన్ సైకిల్";

  const headers =
    lang === "te"
      ? [
          periodColTe,
          ...(mode === "cycle" ? ["వ్యవధి (వారాలు / నెలలు)"] : []),
          "ప్రారంభ తేదీ",
          "ముగింపు తేదీ",
          "వసూలు లక్ష్యం (₹)",
          "మొత్తం వసూలు (₹)",
          "తరుగు (₹)",
          "కొత్త రుణాల సంఖ్య",
          "ఇచ్చిన కొత్త రుణాలు (₹)",
          "సొంతానికి తీసుకున్న నగదు (₹)",
          "2-రోజుల ఆటో హోమ్ నగదు (₹)",
          "మొత్తం తీసుకున్న నగదు (₹)",
          "ఖర్చులు (₹)",
          "నికర నిల్వ (₹)",
        ]
      : [
          periodColEn,
          ...(mode === "cycle" ? ["Duration (Weeks / Months)"] : []),
          "Start Date",
          "End Date",
          "Expected Target (₹)",
          "Collected (₹)",
          "Shortage (₹)",
          "New Loans Count",
          "Given New Loans (₹)",
          "Manual Taken Cash (₹)",
          "Auto 2-Day Home Cash (₹)",
          "Total Taken Cash (₹)",
          "Expenses (₹)",
          "Net Balance (₹)",
        ];

  const rows: unknown[][] = periodRows.map((r) => {
    const cycleMeta =
      mode === "cycle" && "cycleWeeks" in r
        ? [`${r.cycleWeeks} Wks (${r.approxMonths} Mo)`]
        : mode === "cycle"
        ? [""]
        : [];
    return [
      r.key,
      ...cycleMeta,
      r.startDate,
      r.endDate,
      r.expected,
      r.collected,
      r.shortage,
      r.newLoansCount,
      r.givenNewLoans,
      r.manualTakenCash,
      r.autoHomeTakenCash,
      r.takenCash,
      r.expenses,
      r.netBalance,
    ];
  });

  return toCsvLines(headers, rows);
}

/**
 * Formats an itemized Borrower Digital Passbook statement for 1-tap WhatsApp sharing
 */
export function buildPassbookWhatsAppText(
  borrower: Borrower,
  villageName: string,
  profile: BusinessProfile,
  lang: Language = "te"
): string {
  const totalReturn =
    borrower.totalReturn || borrower.weeklyDue * (borrower.durationWeeks || 12);
  const totalPaid = calculateTotalPaid(borrower);
  const remaining = calculateRemainingBalance(borrower);
  const shortfall = calculateTotalShortfall(borrower);
  const prefix = getFrequencyShortPrefix(borrower.repaymentFreq);
  const recentHistory = (borrower.history || []).slice(-10);

  if (lang === "te") {
    const lines = [
      `📒 *${profile.businessName} — డిజిటల్ పాస్‌బుక్*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `👤 *ఖాతాదారు:* ${borrower.name}${borrower.seqNo ? ` (#${borrower.seqNo})` : ""}`,
      ...(borrower.careOf ? [`👪 *సంరక్షకులు:* ${borrower.careOf}`] : []),
      ...(borrower.guarantorName
        ? [`🛡️ *హామీదారుడు:* ${borrower.guarantorName}${borrower.guarantorPhone ? ` (${borrower.guarantorPhone})` : ""}`]
        : []),
      `📍 *గ్రామం:* ${villageName}`,
      `🔁 *సైకిల్:* #${borrower.loanCycle || 1} · ${getFrequencyLabel(borrower.repaymentFreq, "te")}`,
      `💵 *అప్పు మొత్తం:* ${formatCurrency(borrower.loanAmt)}`,
      `📊 *వాయిదా మొత్తం:* ${formatCurrency(borrower.weeklyDue)} × ${borrower.durationWeeks} = ${formatCurrency(totalReturn)}`,
      `✅ *ఇప్పటివరకు చెల్లించినది:* ${formatCurrency(totalPaid)}`,
      `⏳ *మిగిలిన బాకీ:* ${formatCurrency(remaining)}`,
      ...(shortfall > 0 ? [`⚡ *తరుగు బాకీ:* ${formatCurrency(shortfall)}`] : []),
      ...(borrower.settledAt ? [`🏁 *సెటిల్‌మెంట్ తేదీ:* ${formatDateIN(borrower.settledAt, "te")}`] : []),
      ``,
      `🧾 *చెల్లింపుల వివరాలు:*`,
      ...(recentHistory.length === 0
        ? [`• ఇంకా వాయిదాలు నమోదు కాలేదు`]
        : recentHistory.map((h, i) => {
            const idxNum = (borrower.history?.length || 0) - recentHistory.length + i + 1;
            const icon = h.status === "paid" ? "✅" : h.status === "skip" ? "❌" : h.status === "short" ? "⚡" : "➕";
            return `${icon} ${prefix} ${idxNum} (${formatDateIN(h.date, "te")}): ${
              h.status === "skip" ? "Skip" : formatCurrency(h.amtPaid)
            }${h.payMethod ? ` [${h.payMethod}]` : ""}`;
          })),
      `━━━━━━━━━━━━━━━━━━━━`,
    ];
    return lines.join("\n");
  }

  const linesEn = [
    `📒 *${profile.businessName} — Digital Passbook*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 *Borrower:* ${borrower.name}${borrower.seqNo ? ` (#${borrower.seqNo})` : ""}`,
    ...(borrower.careOf ? [`👪 *Care Of:* ${borrower.careOf}`] : []),
    ...(borrower.guarantorName
      ? [`🛡️ *Guarantor:* ${borrower.guarantorName}${borrower.guarantorPhone ? ` (${borrower.guarantorPhone})` : ""}`]
      : []),
    `📍 *Village:* ${villageName}`,
    `🔁 *Cycle:* #${borrower.loanCycle || 1} · ${getFrequencyLabel(borrower.repaymentFreq, "en")}`,
    `💵 *Principal:* ${formatCurrency(borrower.loanAmt)}`,
    `📊 *Installment:* ${formatCurrency(borrower.weeklyDue)} × ${borrower.durationWeeks} = ${formatCurrency(totalReturn)}`,
    `✅ *Total Paid:* ${formatCurrency(totalPaid)}`,
    `⏳ *Balance Remaining:* ${formatCurrency(remaining)}`,
    ...(shortfall > 0 ? [`⚡ *Shortfall:* ${formatCurrency(shortfall)}`] : []),
    ...(borrower.settledAt ? [`🏁 *Settled Early:* ${formatDateIN(borrower.settledAt, "en")}`] : []),
    ``,
    `🧾 *Payment Ledger:*`,
    ...(recentHistory.length === 0
      ? [`• No installments recorded yet`]
      : recentHistory.map((h, i) => {
          const idxNum = (borrower.history?.length || 0) - recentHistory.length + i + 1;
          const icon = h.status === "paid" ? "✅" : h.status === "skip" ? "❌" : h.status === "short" ? "⚡" : "➕";
          return `${icon} ${prefix} ${idxNum} (${formatDateIN(h.date, "en")}): ${
            h.status === "skip" ? "Skip" : formatCurrency(h.amtPaid)
          }${h.payMethod ? ` [${h.payMethod}]` : ""}`;
        })),
    `━━━━━━━━━━━━━━━━━━━━`,
  ];
  return linesEn.join("\n");
}

/**
 * Triggers a clean browser CSV download or native Android Share/Save sheet inside APK
 */
export function downloadCsvFile(filename: string, csvContent: string): void {
  void saveOrShareTextFile({
    filename,
    content: csvContent,
    mimeType: "text/csv;charset=utf-8;",
    title: filename,
    text: "LineBook Pro CSV Export",
  });
}
