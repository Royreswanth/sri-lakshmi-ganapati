import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWeeklyDue,
  calculateTotalPaid,
  calculateRemainingBalance,
  calculateTotalShortfall,
  calculateOutstandingInField,
  calculateTodayCashInBag,
  calculateTotalPersonalUse,
  calculateNetProfit,
  applyCollectionEntriesIdempotently,
} from './financeUtils.ts';
import type { Borrower, CollectionEntry } from '../types.ts';

test('calculateWeeklyDue calculates accurately with integer round up', () => {
  // ₹10,000 + 20% = ₹12,000 / 12 = ₹1,000
  assert.equal(calculateWeeklyDue(10000, 20, 12), 1000);
  // ₹15,000 + 20% = ₹18,000 / 12 = ₹1,500
  assert.equal(calculateWeeklyDue(15000, 20, 12), 1500);
  // ₹20,000 + 25% = ₹25,000 / 16 = 1562.5 -> ceil = 1563
  assert.equal(calculateWeeklyDue(20000, 25, 16), 1563);
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

  // Paid = 1000 + 400 + 1500 + 0 = 2900
  assert.equal(calculateTotalPaid(borrower), 2900);
  // Remaining = 12000 - 2900 = 9100
  assert.equal(calculateRemainingBalance(borrower), 9100);
  // Shortfall = 1000 - 400 = 600
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
    weeksPaid: 4, // 3 weeks before app, 1 week in app
    isOngoing: true,
    startDate: '2026-09-01',
    history: [
      { date: '2026-10-05', status: 'paid', amtPaid: 1000 },
    ],
  };

  // Pre-app paid: (4 - 1) * 1000 = 3000
  // In-app paid: 1000
  // Total paid: 4000
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
    weeksPaid: 12, // completed
    startDate: '2026-07-01',
    history: Array.from({ length: 12 }, (_, i) => ({ date: `2026-07-${i+1}`, status: 'paid' as const, amtPaid: 500 })),
  };

  const outstanding = calculateOutstandingInField([activeB, completedB]);
  // active remaining: 12000 - 2000 = 10000. completed is ignored.
  assert.equal(outstanding, 10000);
});

test('calculateTodayCashInBag factors in personal use and expenses (Fix D6 & D8)', () => {
  // Collected: 10,000, Expenses: 300, New loans: 5,000, Personal use: 1,000
  // Bag cash = 10000 - 300 - 5000 - 1000 = 3700
  const bagCash = calculateTodayCashInBag(10000, 300, 5000, 1000);
  assert.equal(bagCash, 3700);

  // If outflows exceed collections, returns 0 rather than negative
  assert.equal(calculateTodayCashInBag(2000, 500, 3000, 500), 0);
});

test('calculateNetProfit incorporates personal use withdrawals (Fix D6)', () => {
  // 50,000 collected - 4,000 expenses - 5,000 personal = 41,000
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

  // Step 1: Save first time today with 'paid'
  const entries1: Record<string, CollectionEntry> = {
    b1: { borrowerId: 'b1', status: 'paid', amtPaid: 1000, payMethod: 'phonepe' },
  };
  const step1 = applyCollectionEntriesIdempotently(initialBorrowers, entries1, today);
  assert.equal(step1[0].weeksPaid, 3);
  assert.equal(step1[0].durationWeeks, 12);
  assert.equal(step1[0].history.length, 3);
  assert.equal(step1[0].history[2].status, 'paid');

  // Step 2: Save AGAIN with the exact same entry (e.g. user clicked Save twice)
  const step2 = applyCollectionEntriesIdempotently(step1, entries1, today);
  assert.equal(step2[0].weeksPaid, 3, 'Must NOT double-count weeksPaid');
  assert.equal(step2[0].durationWeeks, 12);
  assert.equal(step2[0].history.length, 3, 'Must NOT duplicate history entry');

  // Step 3: Correct entry on the same day from 'paid' to 'skip'
  const entriesSkip: Record<string, CollectionEntry> = {
    b1: { borrowerId: 'b1', status: 'skip', amtPaid: 0 },
  };
  const step3 = applyCollectionEntriesIdempotently(step2, entriesSkip, today);
  assert.equal(step3[0].weeksPaid, 2, 'weeksPaid must decrement back since it was changed to skip');
  assert.equal(step3[0].durationWeeks, 13, 'durationWeeks must increment by 1 for skip');
  assert.equal(step3[0].history[2].status, 'skip');

  // Step 4: Correct entry on the same day to 'extra' (D4 fix verification)
  const entriesExtra: Record<string, CollectionEntry> = {
    b1: { borrowerId: 'b1', status: 'extra', amtPaid: 1500, extraAmt: 500, note: 'Diwali bonus' },
  };
  const step4 = applyCollectionEntriesIdempotently(step3, entriesExtra, today);
  assert.equal(step4[0].weeksPaid, 3, 'weeksPaid increments for extra');
  assert.equal(step4[0].durationWeeks, 12, 'durationWeeks resets back from skip extension');
  assert.equal(step4[0].history[2].status, 'extra');
  assert.equal(step4[0].history[2].amtPaid, 1500);
  assert.equal(step4[0].history[2].extraAmt, 500);

  // Step 5: Untoggle / clear entry on the same day
  const entriesEmpty: Record<string, CollectionEntry> = {};
  const step5 = applyCollectionEntriesIdempotently(step4, entriesEmpty, today);
  assert.equal(step5[0].weeksPaid, 2, 'weeksPaid reverts to before today');
  assert.equal(step5[0].durationWeeks, 12);
  assert.equal(step5[0].history.length, 2, "Today's entry is cleanly removed");
});
