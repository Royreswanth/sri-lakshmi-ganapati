import test from "node:test";
import assert from "node:assert/strict";
import {
  UTF8_BOM,
  escapeCsvCell,
  buildBorrowersCsv,
  buildCollectionsCsv,
  buildCashbookCsv,
  buildRecordBookCsv,
  buildPassbookWhatsAppText,
} from "./exportUtils.ts";
import { DEFAULT_PROFILE } from "./storage.ts";
import type { Borrower, CollectionRecord, Village } from "../types.ts";

test("escapeCsvCell quotes commas, quotes, newlines cleanly", () => {
  assert.equal(escapeCsvCell("Polamuru"), "Polamuru");
  assert.equal(escapeCsvCell('S/o "Raju", Shop'), '"S/o ""Raju"", Shop"');
  assert.equal(escapeCsvCell(null), "");
});

test("buildBorrowersCsv starts with UTF-8 BOM and preserves Telugu + guarantor columns", () => {
  const villages: Village[] = [{ id: "v1", name: "పోలమూరు (Polamuru)", day: "Wednesday" }];
  const borrowers: Record<string, Borrower[]> = {
    v1: [
      {
        id: "b1",
        seqNo: "12",
        name: "రాముడు (Ramudu)",
        careOf: "S/o వెంకన్న",
        phone: "9876543210",
        guarantorName: "సుబ్బారావు",
        guarantorPhone: "9123456789",
        loanAmt: 10000,
        durationWeeks: 12,
        repaymentFreq: "weekly",
        interestPct: 20,
        weeklyDue: 1000,
        totalReturn: 12000,
        weeksPaid: 2,
        startDate: "2026-11-01",
        loanCycle: 2,
        history: [
          { date: "2026-11-08", status: "paid", amtPaid: 1000, payMethod: "cash" },
          { date: "2026-11-15", status: "short", amtPaid: 600, payMethod: "phonepe" },
        ],
      },
    ],
  };

  const csv = buildBorrowersCsv(villages, borrowers, "en");
  assert.equal(csv.startsWith(UTF8_BOM), true);
  assert.match(csv, /Roll #,Borrower Name,Care Of/);
  assert.match(csv, /పోలమూరు \(Polamuru\)/);
  assert.match(csv, /రాముడు \(Ramudu\)/);
  assert.match(csv, /సుబ్బారావు/);
  assert.match(csv, /,10000,1000,12000,1600,10400,400,2,12,Active/);
});

test("buildCollectionsCsv & buildCashbookCsv export mode splits and bag cash accurately", () => {
  const collections: Record<string, CollectionRecord> = {
    "v1_2026-11-20": {
      villageId: "v1",
      villageName: "Polamuru",
      date: "2026-11-20",
      totalExpected: 3000,
      totalCollected: 2500,
      newLoans: 0,
      personalUse: 0,
      savedAt: "2026-11-20T12:00:00Z",
      entries: [
        { borrowerId: "b1", status: "paid", amtPaid: 1000, payMethod: "cash" },
        { borrowerId: "b2", status: "extra", amtPaid: 1500, payMethod: "phonepe", extraAmt: 500 },
        { borrowerId: "b3", status: "skip", amtPaid: 0 },
      ],
    },
  };

  const colCsv = buildCollectionsCsv(collections, "en");
  assert.equal(colCsv.startsWith(UTF8_BOM), true);
  assert.match(colCsv, /2026-11-20,Polamuru,3000,2500,1000,1500,0,500,1,0,1,1/);

  const cashCsv = buildCashbookCsv(
    ["2026-11-20"],
    {
      collections,
      expenses: [{ id: 1, desc: "Fuel", amt: 200, cat: "fuel", date: "2026-11-20" }],
      newLoansLog: [],
      personalLog: [],
      openingBalances: { "2026-11-20": 4000 },
    },
    "en"
  );
  assert.equal(cashCsv.startsWith(UTF8_BOM), true);
  assert.match(cashCsv, /2026-11-20,4000,1000,1500,0,2500,0,200,0,4800/);
});

test("buildRecordBookCsv exports recurring Line Cycle statements with duration", () => {
  const csv = buildRecordBookCsv(
    [
      {
        key: "Cycle #1",
        cycleNumber: 1,
        cycleWeeks: 12,
        approxMonths: 3,
        startDate: "2026-01-05",
        endDate: "2026-03-29",
        expected: 10000,
        collected: 9500,
        cashCollected: 9500,
        digitalCollected: 0,
        shortage: 500,
        newLoansCount: 2,
        givenNewLoans: 8000,
        manualTakenCash: 0,
        autoHomeTakenCash: 1000,
        takenCash: 1000,
        expenses: 200,
        netBalance: 300,
        visitsCount: 4,
      },
    ],
    "cycle",
    "en"
  );
  assert.equal(csv.startsWith(UTF8_BOM), true);
  assert.match(csv, /Line Cycle,Duration \(Weeks \/ Months\),Start Date,End Date/);
  assert.match(csv, /Cycle #1,12 Wks \(3 Mo\),2026-01-05,2026-03-29/);
});

test("buildPassbookWhatsAppText formats bilingual borrower ledger statement", () => {
  const b: Borrower = {
    id: "b1",
    seqNo: "7",
    name: "Lakshmi",
    guarantorName: "Srinivas",
    loanAmt: 10000,
    durationWeeks: 12,
    repaymentFreq: "weekly",
    interestPct: 20,
    weeklyDue: 1000,
    totalReturn: 12000,
    weeksPaid: 1,
    startDate: "2026-11-01",
    history: [{ date: "2026-11-10", status: "paid", amtPaid: 1000, payMethod: "cash" }],
  };

  const textTe = buildPassbookWhatsAppText(b, "Polamuru", DEFAULT_PROFILE, "te");
  assert.match(textTe, /డిజిటల్ పాస్‌బుక్/);
  assert.match(textTe, /Lakshmi \(#7\)/);
  assert.match(textTe, /Srinivas/);
  assert.match(textTe, /₹11,000/);

  const textEn = buildPassbookWhatsAppText(b, "Polamuru", DEFAULT_PROFILE, "en");
  assert.match(textEn, /Digital Passbook/);
  assert.match(textEn, /Balance Remaining:\* ₹11,000/);
});
