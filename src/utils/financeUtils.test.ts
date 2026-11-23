import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWeeklyDue,
  calculateInstallmentDue,
  calculateInstallmentDueFromTotal,
  computeImpliedInterestPct,
  calculateTotalPaid,
  calculateRemainingBalance,
  calculateTotalShortfall,
  calculateOutstandingInField,
  calculateTodayCashInBag,
  calculateTotalPersonalUse,
  calculateNetProfit,
  applyCollectionEntriesIdempotently,
  settleBorrowerEarly,
  renewBorrowerLoan,
  calculateLoanBreakdown,
  buildLoanSchedulePreview,
  isBorrowerClosed,
  canCollectVillageOnDate,
  getDaysSinceScheduledDay,
  getVillageCollectionAccess,
  getApproxCycleMonths,
  calculateDailyCashbook,
  getAllCashbookDates,
  calculateLineCashStatus,
  buildLoanCompletedWeeksSummary,
  buildRecordBookReport,
} from './financeUtils.ts';
import type { Borrower, CollectionEntry } from '../types.ts';

test('calculateWeeklyDue calculates accurately with integer round up', () => {
  // ₹10,000 + 20% = ₹12,000 / 12 = ₹1,000
  assert.equal(calculateWeeklyDue(10000, 20, 12), 1000);
  // ₹15,000 + 20% = ₹18,000 / 12 = ₹1,500
  assert.equal(calculateWeeklyDue(15000, 20, 12), 1500);
  // ₹20,000 + 25% = ₹25,000 / 16 = 1562.5 -> ceil = 1563
  assert.equal(calculateWeeklyDue(20000, 25, 16), 1563);
  // Daily loan: ₹10,000 + 20% = ₹12,000 / 100 days = ₹120/day
  assert.equal(calculateInstallmentDue(10000, 20, 100), 120);
  // Monthly loan: ₹50,000 + 20% = ₹60,000 / 10 months = ₹6,000/month
  assert.equal(calculateInstallmentDue(50000, 20, 10), 6000);
});

test('calculateTotalPaid accurately handles regular, short, and extra payments (Fix D3)', () => {
  const borrower: Borrower = {
    id: 'b1',
    seqNo: '1',
    name: 'Suresh',
    loanAmt: 10000,
    durationWeeks: 12,
    interestPct: 20,
    weeklyDue: 1000,
    totalReturn: 12000,
    weeksPaid: 3,
    startDate: '2026-10-01',
    history: [
      { date: '2026-10-05', status: 'paid', amtPaid: 1000 },
      { date: '2026-10-12', status: 'short', amtPaid: 400, note: 'Remaining ₹600 next week' },
      { date: '2026-10-19', status: 'extra', amtPaid: 1500, extraAmt: 500 },
      { date: '2026-10-26', status: 'skip', amtPaid: 0 },
    ],
  };

  assert.equal(calculateTotalPaid(borrower), 2900);
  assert.equal(calculateRemainingBalance(borrower), 9100);
  assert.equal(calculateTotalShortfall(borrower), 600);
});

test('calculateTotalPaid handles ongoing loans with pre-app payments', () => {
  const ongoingBorrower: Borrower = {
    id: 'b2',
    seqNo: '2',
    name: 'Venkatesh',
    loanAmt: 10000,
    durationWeeks: 12,
    interestPct: 20,
    weeklyDue: 1000,
    totalReturn: 12000,
    weeksPaid: 4,
    isOngoing: true,
    startDate: '2026-09-01',
    history: [
      { date: '2026-10-05', status: 'paid', amtPaid: 1000 },
    ],
  };

  assert.equal(calculateTotalPaid(ongoingBorrower), 4000);
  assert.equal(calculateRemainingBalance(ongoingBorrower), 8000);
});

test('calculateOutstandingInField sums remaining balance only for active loans (Fix D8)', () => {
  const activeB: Borrower = {
    id: 'b1',
    seqNo: '1',
    name: 'Active',
    loanAmt: 10000,
    durationWeeks: 12,
    interestPct: 20,
    weeklyDue: 1000,
    totalReturn: 12000,
    weeksPaid: 2,
    startDate: '2026-10-01',
    history: [{ date: '2026-10-05', status: 'paid', amtPaid: 1000 }, { date: '2026-10-12', status: 'paid', amtPaid: 1000 }],
  };

  const completedB: Borrower = {
    id: 'b2',
    seqNo: '2',
    name: 'Completed',
    loanAmt: 5000,
    durationWeeks: 12,
    interestPct: 20,
    weeklyDue: 500,
    totalReturn: 6000,
    weeksPaid: 12,
    startDate: '2026-07-01',
    history: Array.from({ length: 12 }, (_, i) => ({ date: `2026-07-${i+1}`, status: 'paid' as const, amtPaid: 500 })),
  };

  const outstanding = calculateOutstandingInField([activeB, completedB]);
  assert.equal(outstanding, 10000);
});

test('calculateTodayCashInBag factors in personal use and expenses (Fix D6 & D8)', () => {
  const bagCash = calculateTodayCashInBag(10000, 300, 5000, 1000);
  assert.equal(bagCash, 3700);
  assert.equal(calculateTodayCashInBag(2000, 500, 3000, 500), 0);
});

test('calculateNetProfit incorporates personal use withdrawals (Fix D6)', () => {
  assert.equal(calculateNetProfit(50000, 4000, 5000), 41000);
});

test('applyCollectionEntriesIdempotently is 100% idempotent and handles same-day edits (Fix D5 & D4)', () => {
  const initialBorrowers: Borrower[] = [
    {
      id: 'b1',
      seqNo: '1',
      name: 'Ramu',
      loanAmt: 10000,
      durationWeeks: 12,
      interestPct: 20,
      weeklyDue: 1000,
      totalReturn: 12000,
      weeksPaid: 2,
      startDate: '2026-10-01',
      history: [
        { date: '2026-10-05', status: 'paid', amtPaid: 1000 },
        { date: '2026-10-12', status: 'paid', amtPaid: 1000 },
      ],
    },
  ];

  const today = '2026-10-19';

  const entries1: Record<string, CollectionEntry> = {
    b1: { borrowerId: 'b1', status: 'paid', amtPaid: 1000, payMethod: 'phonepe' },
  };
  const step1 = applyCollectionEntriesIdempotently(initialBorrowers, entries1, today);
  assert.equal(step1[0].weeksPaid, 3);
  assert.equal(step1[0].durationWeeks, 12);
  assert.equal(step1[0].history.length, 3);
  assert.equal(step1[0].history[2].status, 'paid');

  const step2 = applyCollectionEntriesIdempotently(step1, entries1, today);
  assert.equal(step2[0].weeksPaid, 3);
  assert.equal(step2[0].durationWeeks, 12);
  assert.equal(step2[0].history.length, 3);

  const entriesSkip: Record<string, CollectionEntry> = {
    b1: { borrowerId: 'b1', status: 'skip', amtPaid: 0 },
  };
  const step3 = applyCollectionEntriesIdempotently(step2, entriesSkip, today);
  assert.equal(step3[0].weeksPaid, 2);
  assert.equal(step3[0].durationWeeks, 13);
  assert.equal(step3[0].history[2].status, 'skip');

  const entriesExtra: Record<string, CollectionEntry> = {
    b1: { borrowerId: 'b1', status: 'extra', amtPaid: 1500, extraAmt: 500, note: 'Diwali bonus' },
  };
  const step4 = applyCollectionEntriesIdempotently(step3, entriesExtra, today);
  assert.equal(step4[0].weeksPaid, 3);
  assert.equal(step4[0].durationWeeks, 12);
  assert.equal(step4[0].history[2].status, 'extra');
  assert.equal(step4[0].history[2].amtPaid, 1500);
  assert.equal(step4[0].history[2].extraAmt, 500);

  const entriesEmpty: Record<string, CollectionEntry> = {};
  const step5 = applyCollectionEntriesIdempotently(step4, entriesEmpty, today);
  assert.equal(step5[0].weeksPaid, 2);
  assert.equal(step5[0].durationWeeks, 12);
  assert.equal(step5[0].history.length, 2);
});

test('settleBorrowerEarly closes active loan, records discount and exact cash paid, zeroes balance', () => {
  const active: Borrower = {
    id: 'b_settle',
    seqNo: '9',
    name: 'Ramesh',
    loanAmt: 10000,
    durationWeeks: 12,
    interestPct: 20,
    weeklyDue: 1000,
    totalReturn: 12000,
    weeksPaid: 6,
    startDate: '2026-09-01',
    history: Array.from({ length: 6 }, (_, idx) => ({
      date: `2026-09-${10 + idx}`,
      status: 'paid' as const,
      amtPaid: 1000,
    })),
  };

  // Remaining was ₹6,000; settles with ₹5,200 cash + ₹800 discount
  const settled = settleBorrowerEarly(active, 5200, 800, '2026-10-20', 'Festive closure', 'phonepe');

  assert.equal(isBorrowerClosed(settled), true);
  assert.equal(settled.settledAt, '2026-10-20');
  assert.equal(settled.settlementDiscount, 800);
  assert.equal(calculateTotalPaid(settled), 11200);
  assert.equal(calculateRemainingBalance(settled), 0);
  assert.equal(calculateOutstandingInField([settled]), 0);
  assert.equal(settled.history[settled.history.length - 1].isSettlement, true);
});

test('renewBorrowerLoan archives previous cycle in loanHistory and increments loanCycle', () => {
  const firstLoan: Borrower = {
    id: 'b_renew',
    seqNo: '4',
    name: 'Lakshmi',
    phone: '9848011223',
    careOf: 'W/o Satish',
    guarantorName: 'Prasad',
    guarantorPhone: '9848099887',
    loanAmt: 10000,
    durationWeeks: 12,
    repaymentFreq: 'weekly',
    interestPct: 20,
    weeklyDue: 1000,
    totalReturn: 12000,
    weeksPaid: 12,
    startDate: '2026-07-01',
    history: Array.from({ length: 12 }, (_, idx) => ({
      date: `2026-07-${idx + 1}`,
      status: 'paid' as const,
      amtPaid: 1000,
    })),
  };

  const renewed = renewBorrowerLoan(
    firstLoan,
    {
      loanAmt: 20000,
      interestPct: 20,
      durationWeeks: 6,
      repaymentFreq: 'monthly',
    },
    '2026-10-21'
  );

  assert.equal(renewed.loanCycle, 2);
  assert.equal(renewed.loanHistory?.length, 1);
  assert.equal(renewed.loanHistory?.[0].cycle, 1);
  assert.equal(renewed.loanHistory?.[0].totalPaid, 12000);
  assert.equal(renewed.loanHistory?.[0].closureType, 'completed');
  assert.equal(renewed.repaymentFreq, 'monthly');
  assert.equal(renewed.weeklyDue, 4000);
  assert.equal(renewed.totalReturn, 24000);
  assert.equal(renewed.weeksPaid, 0);
  assert.equal(renewed.history.length, 0);
  assert.equal(renewed.guarantorName, 'Prasad');
  assert.equal(renewed.careOf, 'W/o Satish');
});

test('calculateLoanBreakdown computes standard, per-100 monthly, and upfront deduction finance modes', () => {
  // 1. Standard 12 weeks, 20% flat
  const std = calculateLoanBreakdown({
    principal: 10000,
    rateValue: 20,
    rateMode: 'flat_pct',
    periods: 12,
    freq: 'weekly',
    deductUpfront: false,
  });
  assert.equal(std.cashHandedOut, 10000);
  assert.equal(std.installmentDue, 1000);
  assert.equal(std.totalRepayable, 12000);
  assert.equal(std.netProfit, 2000);
  assert.equal(std.roiPct, 20);

  // 2. Upfront deduction: ₹10,000 card with 15% cut upfront -> ₹8,500 cash given, ₹10,000 collected
  const upfront = calculateLoanBreakdown({
    principal: 10000,
    rateValue: 15,
    rateMode: 'flat_pct',
    periods: 100,
    freq: 'daily',
    deductUpfront: true,
  });
  assert.equal(upfront.cashHandedOut, 8500);
  assert.equal(upfront.installmentDue, 100);
  assert.equal(upfront.totalRepayable, 10000);
  assert.equal(upfront.netProfit, 1500);

  // 3. Per-100 monthly interest (₹2/100/month over 6 months = 12%)
  const per100 = calculateLoanBreakdown({
    principal: 50000,
    rateValue: 2,
    rateMode: 'per_100_monthly',
    periods: 6,
    freq: 'monthly',
    deductUpfront: false,
  });
  assert.equal(per100.effectiveFlatPct, 12);
  assert.equal(per100.interestAmount, 6000);
  assert.equal(per100.installmentDue, 9334);

  // 4. Schedule preview
  const sched = buildLoanSchedulePreview('2026-11-01', 3, 'monthly', 4000, 12000);
  assert.equal(sched.length, 3);
  assert.equal(sched[0].dueDate, '2026-12-01');
  assert.equal(sched[2].remainingAfter, 0);
});

test('calculateDailyCashbook reconciles Cash vs PhonePe vs Online inflows, outflows, and auto-carry', () => {
  const sources = {
    openingBalances: {
      '2026-11-18': 5000,
    },
    collections: {
      'v1_2026-11-18': {
        villageId: 'v1',
        villageName: 'Polamuru',
        date: '2026-11-18',
        totalExpected: 3000,
        totalCollected: 3000,
        newLoans: 0,
        personalUse: 0,
        savedAt: '2026-11-18T10:00:00Z',
        entries: [
          { borrowerId: 'b1', status: 'paid' as const, amtPaid: 1000, payMethod: 'cash' as const },
          { borrowerId: 'b2', status: 'paid' as const, amtPaid: 1500, payMethod: 'phonepe' as const },
          { borrowerId: 'b3', status: 'short' as const, amtPaid: 500, payMethod: 'online' as const },
          { borrowerId: 'b4', status: 'skip' as const, amtPaid: 0 },
        ],
      },
      'v2_2026-11-19': {
        villageId: 'v2',
        villageName: 'Attili',
        date: '2026-11-19',
        totalExpected: 2000,
        totalCollected: 2000,
        newLoans: 0,
        personalUse: 0,
        savedAt: '2026-11-19T10:00:00Z',
        entries: [
          { borrowerId: 'b5', status: 'paid' as const, amtPaid: 2000, payMethod: 'cash' as const },
        ],
      },
    },
    newLoansLog: [
      { id: 'nl1', borrowerName: 'Raju', seqNo: '10', villageName: 'Polamuru', villageId: 'v1', loanAmt: 2000, date: '2026-11-18' },
    ],
    expenses: [
      { id: 1, desc: 'Petrol', amt: 300, cat: 'fuel' as const, date: '2026-11-18' },
    ],
    personalLog: [
      { id: 'p1', amt: 500, note: 'Lunch/Home', date: '2026-11-18' },
    ],
  };

  // Day 1: Explicit opening ₹5,000 + ₹1,000 physical cash - (₹2,000 new loans + ₹300 exp + ₹500 personal) = ₹3,200 bag
  const day1 = calculateDailyCashbook('2026-11-18', sources);
  assert.equal(day1.openingCash, 5000);
  assert.equal(day1.isOpeningExplicit, true);
  assert.equal(day1.cashCollected, 1000);
  assert.equal(day1.phonePeCollected, 1500);
  assert.equal(day1.onlineCollected, 500);
  assert.equal(day1.digitalCollected, 2000);
  assert.equal(day1.totalCollected, 3000);
  assert.equal(day1.totalOutflows, 2800);
  assert.equal(day1.closingCashInBag, 3200);
  assert.equal(day1.villageBreakdowns.length, 1);

  // Day 2: Auto-carries forward ₹3,200 opening bag from Day 1, plus ₹2,000 cash = ₹5,200 bag
  const day2 = calculateDailyCashbook('2026-11-19', sources);
  assert.equal(day2.openingCash, 3200);
  assert.equal(day2.isOpeningExplicit, false);
  assert.equal(day2.carriedFromDate, '2026-11-18');
  assert.equal(day2.cashCollected, 2000);
  assert.equal(day2.closingCashInBag, 5200);

  const dates = getAllCashbookDates(sources);
  assert.deepEqual(dates, ['2026-11-19', '2026-11-18']);
});

test('calculateLineCashStatus keeps collected cash across days, deducts new loans, and auto-marks home taken after 2 days without new loan', () => {
  const baseCollections = {
    'v1_2026-11-16': {
      villageId: 'v1',
      villageName: 'Polamuru',
      date: '2026-11-16',
      totalExpected: 5000,
      totalCollected: 5000,
      newLoans: 0,
      personalUse: 0,
      savedAt: '2026-11-16T11:00:00Z',
      entries: [
        { borrowerId: 'b1', status: 'paid' as const, amtPaid: 5000, payMethod: 'cash' as const },
      ],
    },
  };

  // Same day & next day: ₹5,000 stays in Line Cash in Hand
  const day0 = calculateLineCashStatus({
    collections: baseCollections,
    newLoansLog: [],
    expenses: [],
    personalLog: [],
    todayStr: '2026-11-16',
  });
  assert.equal(day0.lineCashInHand, 5000);
  assert.equal(day0.autoHomeTakenTotal, 0);

  const day1 = calculateLineCashStatus({
    collections: baseCollections,
    newLoansLog: [],
    expenses: [{ id: 1, desc: 'Petrol', amt: 200, cat: 'fuel', date: '2026-11-17' }],
    personalLog: [],
    todayStr: '2026-11-17',
  });
  assert.equal(day1.lineCashInHand, 4800);
  assert.equal(day1.autoHomeTakenTotal, 0);

  // If NO new loan given by 2 days after collection (2026-11-18), ₹4,800 becomes auto home taken -> cash in hand = 0
  const day2NoLoan = calculateLineCashStatus({
    collections: baseCollections,
    newLoansLog: [],
    expenses: [{ id: 1, desc: 'Petrol', amt: 200, cat: 'fuel', date: '2026-11-17' }],
    personalLog: [],
    todayStr: '2026-11-18',
  });
  assert.equal(day2NoLoan.lineCashInHand, 0);
  assert.equal(day2NoLoan.autoHomeTakenTotal, 4800);
  assert.equal(day2NoLoan.totalTakenCash, 4800);

  // If a new loan of ₹3,000 IS given within 2 days (2026-11-17), remaining ₹1,800 stays in hand on 2026-11-18
  const day2WithLoan = calculateLineCashStatus({
    collections: baseCollections,
    newLoansLog: [
      { id: 'nl1', borrowerName: 'Kiran', seqNo: '3', villageName: 'Polamuru', villageId: 'v1', loanAmt: 3000, date: '2026-11-17' },
    ],
    expenses: [{ id: 1, desc: 'Petrol', amt: 200, cat: 'fuel', date: '2026-11-17' }],
    personalLog: [],
    todayStr: '2026-11-18',
  });
  assert.equal(day2WithLoan.lineCashInHand, 1800);
  assert.equal(day2WithLoan.autoHomeTakenTotal, 0);
});

test('buildLoanCompletedWeeksSummary highlights completed pre-app, actual payments, skips, and remaining dates', () => {
  const borrower: Borrower = {
    id: 'b_weeks',
    seqNo: '7',
    name: 'Satish',
    loanAmt: 10000,
    durationWeeks: 6,
    repaymentFreq: 'weekly',
    interestPct: 20,
    weeklyDue: 2000,
    totalReturn: 12000,
    weeksPaid: 4,
    isOngoing: true,
    startDate: '2026-10-05',
    history: [
      { date: '2026-10-19', status: 'paid', amtPaid: 2000 },
      { date: '2026-10-26', status: 'skip', amtPaid: 0 },
      { date: '2026-11-02', status: 'short', amtPaid: 1000 },
    ],
  };

  const summary = buildLoanCompletedWeeksSummary(borrower, '2026-11-09');
  assert.equal(summary.startDate, '2026-10-05');
  assert.equal(summary.completedPeriods, 4);
  assert.equal(summary.remainingPeriods, 2);
  assert.equal(summary.skippedCount, 1);
  assert.equal(summary.shortCount, 1);
  assert.equal(summary.items[0].status, 'completed_pre');
  assert.equal(summary.items[2].status, 'paid');
  assert.equal(summary.items[3].status, 'skip');
  assert.equal(summary.items[4].status, 'short');
  assert.equal(summary.items[5].status, 'due_today');
  assert.equal(summary.items[6].status, 'upcoming');
});

test('buildRecordBookReport produces accurate weekly, monthly, and cycle summaries', () => {
  const villages = [{ id: 'v1', name: 'Polamuru', day: 'Monday' as const }];
  const borrowers = {
    v1: [
      {
        id: 'b1',
        seqNo: '1',
        name: 'Venkat',
        loanAmt: 10000,
        durationWeeks: 12,
        interestPct: 20,
        weeklyDue: 1000,
        totalReturn: 12000,
        weeksPaid: 2,
        startDate: '2026-11-02',
        history: [
          { date: '2026-11-09', status: 'paid' as const, amtPaid: 1000, payMethod: 'cash' as const },
          { date: '2026-11-16', status: 'short' as const, amtPaid: 600, payMethod: 'cash' as const },
        ],
      },
    ],
  };
  const collections = {
    'v1_2026-11-09': {
      villageId: 'v1',
      villageName: 'Polamuru',
      date: '2026-11-09',
      totalExpected: 1000,
      totalCollected: 1000,
      newLoans: 0,
      personalUse: 0,
      savedAt: '2026-11-09T10:00:00Z',
      entries: [{ borrowerId: 'b1', status: 'paid' as const, amtPaid: 1000, payMethod: 'cash' as const }],
    },
    'v1_2026-11-16': {
      villageId: 'v1',
      villageName: 'Polamuru',
      date: '2026-11-16',
      totalExpected: 1000,
      totalCollected: 600,
      newLoans: 0,
      personalUse: 0,
      savedAt: '2026-11-16T10:00:00Z',
      entries: [{ borrowerId: 'b1', status: 'short' as const, amtPaid: 600, payMethod: 'cash' as const }],
    },
  };
  const report = buildRecordBookReport({
    villages,
    borrowers,
    collections,
    expenses: [{ id: 1, desc: 'Tea', amt: 100, cat: 'food', date: '2026-11-09' }],
    newLoansLog: [{ id: 'nl1', borrowerName: 'Venkat', seqNo: '1', villageName: 'Polamuru', villageId: 'v1', loanAmt: 10000, date: '2026-11-02' }],
    personalLog: [{ id: 'p1', amt: 200, note: 'Home', date: '2026-11-09' }],
    todayStr: '2026-11-18',
  });

  assert.equal(report.weeklyRows.length, 3);
  assert.equal(report.monthlyRows.length, 1);
  assert.equal(report.cycleRows.length, 1);
  assert.equal(report.overallTotals.collected, 1600);
  assert.equal(report.overallTotals.givenNewLoans, 10000);
  assert.equal(report.overallTotals.shortage, 400);
  assert.equal(report.overallTotals.expenses, 100);
  assert.equal(report.overallTotals.manualTakenCash, 200);
  assert.equal(report.overallTotals.autoHomeTakenCash, 1300); // Nov 9 left 700 (taken Nov 11) + Nov 16 left 600 (taken Nov 18)
  assert.equal(report.overallTotals.lineCashInHand, 0);
});

test('isBorrowerClosed closes immediately when totalPaid >= totalReturn even at week 2/12, and stays active if balance remains after durationWeeks', () => {
  const paidEarlyViaExtra: Borrower = {
    id: 'tommy',
    seqNo: '2',
    name: 'Tommy',
    loanAmt: 30000,
    durationWeeks: 12,
    interestPct: 20,
    weeklyDue: 3000,
    totalReturn: 36000,
    weeksPaid: 2,
    startDate: '2026-11-01',
    history: [
      { date: '2026-11-09', status: 'paid', amtPaid: 3000 },
      { date: '2026-11-16', status: 'extra', amtPaid: 36000, extraAmt: 33000 },
    ],
  };

  assert.equal(calculateTotalPaid(paidEarlyViaExtra), 39000);
  assert.equal(calculateRemainingBalance(paidEarlyViaExtra), 0);
  assert.equal(isBorrowerClosed(paidEarlyViaExtra), true);
  assert.equal(calculateTotalShortfall(paidEarlyViaExtra), 0);
  assert.equal(calculateOutstandingInField([paidEarlyViaExtra]), 0);

  const reached12WeeksStillOwing: Borrower = {
    id: 'b_owing',
    seqNo: '3',
    name: 'Pending After 12 Wks',
    loanAmt: 10000,
    durationWeeks: 12,
    interestPct: 20,
    weeklyDue: 1000,
    totalReturn: 12000,
    weeksPaid: 12,
    startDate: '2026-08-01',
    history: Array.from({ length: 12 }, (_, idx) => ({
      date: `2026-09-${String(idx + 1).padStart(2, '0')}`,
      status: idx === 11 ? ('short' as const) : ('paid' as const),
      amtPaid: idx === 11 ? 400 : 1000,
    })),
  };

  assert.equal(calculateTotalPaid(reached12WeeksStillOwing), 11400);
  assert.equal(calculateRemainingBalance(reached12WeeksStillOwing), 600);
  assert.equal(isBorrowerClosed(reached12WeeksStillOwing), false);
  assert.equal(calculateTotalShortfall(reached12WeeksStillOwing), 600);
});

test('canCollectVillageOnDate strictly enforces scheduled line day (e.g. Monday/Tuesday locked on Sunday)', () => {
  assert.equal(canCollectVillageOnDate({ day: 'Monday' }, 'Sunday'), false);
  assert.equal(canCollectVillageOnDate({ day: 'Tuesday' }, 'Sunday'), false);
  assert.equal(canCollectVillageOnDate({ day: 'Monday' }, 'Monday'), true);
  assert.equal(canCollectVillageOnDate({ day: 'Tuesday' }, 'Tuesday'), true);
  assert.equal(canCollectVillageOnDate({ day: 'Sunday' }, 'Sunday'), true);
});

test('buildRecordBookReport groups recurring line cycles (e.g. 12 weeks = 3 months, 25 weeks = 6 months)', () => {
  assert.equal(getApproxCycleMonths(12), 3);
  assert.equal(getApproxCycleMonths(25), 6);

  const villages = [{ id: 'v1', name: 'Polamuru', day: 'Monday' as const }];
  const borrowers = { v1: [] as Borrower[] };
  const collections = {
    'v1_2026-01-05': {
      villageId: 'v1',
      villageName: 'Polamuru',
      date: '2026-01-05',
      totalExpected: 5000,
      totalCollected: 5000,
      newLoans: 0,
      personalUse: 0,
      savedAt: '2026-01-05T10:00:00Z',
      entries: [{ borrowerId: 'b1', status: 'paid' as const, amtPaid: 5000, payMethod: 'cash' as const }],
    },
    'v1_2026-04-20': {
      villageId: 'v1',
      villageName: 'Polamuru',
      date: '2026-04-20',
      totalExpected: 4000,
      totalCollected: 4000,
      newLoans: 0,
      personalUse: 0,
      savedAt: '2026-04-20T10:00:00Z',
      entries: [{ borrowerId: 'b1', status: 'paid' as const, amtPaid: 4000, payMethod: 'cash' as const }],
    },
  };

  // 15 weeks apart -> 2 separate cycles under 12-week cycle (3 months), 1 single cycle under 25-week cycle (6 months)
  const report12 = buildRecordBookReport({
    villages,
    borrowers,
    collections,
    expenses: [],
    newLoansLog: [],
    personalLog: [],
    todayStr: '2026-04-25',
    cycleWeeks: 12,
  });
  assert.equal(report12.cycleWeeks, 12);
  assert.equal(report12.cycleApproxMonths, 3);
  assert.equal(report12.cyclePeriodRows.length, 2);
  assert.equal(report12.cyclePeriodRows[0].cycleNumber, 2);
  assert.equal(report12.cyclePeriodRows[0].collected, 4000);
  assert.equal(report12.cyclePeriodRows[1].cycleNumber, 1);
  assert.equal(report12.cyclePeriodRows[1].collected, 5000);

  const report25 = buildRecordBookReport({
    villages,
    borrowers,
    collections,
    expenses: [],
    newLoansLog: [],
    personalLog: [],
    todayStr: '2026-04-25',
    cycleWeeks: 25,
  });
  assert.equal(report25.cycleWeeks, 25);
  assert.equal(report25.cycleApproxMonths, 6);
  assert.equal(report25.cyclePeriodRows.length, 1);
  assert.equal(report25.cyclePeriodRows[0].collected, 9000);
});

test('getVillageCollectionAccess allows scheduled day (0) plus 2-day modify grace (+1, +2) targeting scheduled date, and locks +3..+6', () => {
  // 2026-11-23 is Monday
  assert.equal(getDaysSinceScheduledDay('Monday', 'Monday'), 0);
  assert.equal(getDaysSinceScheduledDay('Sunday', 'Monday'), 1);
  assert.equal(getDaysSinceScheduledDay('Saturday', 'Monday'), 2);
  assert.equal(getDaysSinceScheduledDay('Friday', 'Monday'), 3);
  assert.equal(getDaysSinceScheduledDay('Tuesday', 'Monday'), 6);

  // Monday village checked on Monday -> allowed, scheduled day
  const monOnMon = getVillageCollectionAccess({ day: 'Monday' }, '2026-11-23');
  assert.equal(monOnMon.allowed, true);
  assert.equal(monOnMon.isScheduledDay, true);
  assert.equal(monOnMon.isGraceModifyWindow, false);
  assert.equal(monOnMon.targetDateStr, '2026-11-23');

  // Monday village checked on Tuesday (+1 day) -> grace day 1 (2d left), targets Monday 2026-11-23
  const monOnTue = getVillageCollectionAccess({ day: 'Monday' }, '2026-11-24');
  assert.equal(monOnTue.allowed, true);
  assert.equal(monOnTue.isScheduledDay, false);
  assert.equal(monOnTue.isGraceModifyWindow, true);
  assert.equal(monOnTue.graceDaysRemaining, 2);
  assert.equal(monOnTue.targetDateStr, '2026-11-23');
  assert.equal(canCollectVillageOnDate({ day: 'Monday' }, 'Tuesday'), true);

  // Monday village checked on Wednesday (+2 days) -> grace day 2 (1d left), targets Monday 2026-11-23
  const monOnWed = getVillageCollectionAccess({ day: 'Monday' }, '2026-11-25');
  assert.equal(monOnWed.allowed, true);
  assert.equal(monOnWed.isGraceModifyWindow, true);
  assert.equal(monOnWed.graceDaysRemaining, 1);
  assert.equal(monOnWed.targetDateStr, '2026-11-23');
  assert.equal(canCollectVillageOnDate({ day: 'Monday' }, 'Wednesday'), true);

  // Monday village checked on Thursday (+3 days) & Sunday (+6 days) -> locked
  const monOnThu = getVillageCollectionAccess({ day: 'Monday' }, '2026-11-26');
  assert.equal(monOnThu.allowed, false);
  assert.equal(canCollectVillageOnDate({ day: 'Monday' }, 'Thursday'), false);
  assert.equal(getVillageCollectionAccess({ day: 'Monday' }, '2026-11-22').allowed, false);
});

test('calculateInstallmentDueFromTotal, computeImpliedInterestPct, and renewBorrowerLoan work from Total Payable without Interest % input', () => {
  assert.equal(calculateInstallmentDueFromTotal(12000, 12), 1000);
  assert.equal(calculateInstallmentDueFromTotal(12500, 12), 1042);
  assert.equal(computeImpliedInterestPct(10000, 12000), 20);
  assert.equal(computeImpliedInterestPct(10000, 10000), 0);

  const prev: Borrower = {
    id: 'b_prev',
    seqNo: '4',
    name: 'Suresh',
    loanAmt: 10000,
    durationWeeks: 12,
    interestPct: 20,
    weeklyDue: 1000,
    totalReturn: 12000,
    weeksPaid: 12,
    startDate: '2026-08-01',
    history: Array.from({ length: 12 }, (_, idx) => ({
      date: `2026-08-${String(idx + 1).padStart(2, '0')}`,
      status: 'paid' as const,
      amtPaid: 1000,
    })),
  };

  const renewed = renewBorrowerLoan(
    prev,
    {
      loanAmt: 20000,
      totalReturn: 24000,
      durationWeeks: 12,
      repaymentFreq: 'weekly',
    },
    '2026-11-23'
  );
  assert.equal(renewed.loanCycle, 2);
  assert.equal(renewed.weeklyDue, 2000);
  assert.equal(renewed.totalReturn, 24000);
  assert.equal(renewed.interestPct, 20);
  assert.equal(renewed.loanHistory?.length, 1);
});




