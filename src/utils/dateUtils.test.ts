import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateWeeklyDue,
  getMondayOfWeek,
  getWeekDates,
  formatCurrency,
  calculateRemainingBalance
} from './dateUtils.ts';
import type { Borrower } from '../types.ts';

test('calculateWeeklyDue calculates standard 12-week 20% interest loan accurately', () => {
  // ₹10,000 + 20% = ₹12,000 / 12 = ₹1,000
  const emi = calculateWeeklyDue(10000, 20, 12);
  assert.equal(emi, 1000);

  // ₹15,000 + 20% = ₹18,000 / 12 = ₹1,500
  assert.equal(calculateWeeklyDue(15000, 20, 12), 1500);

  // ₹20,000 + 25% = ₹25,000 / 16 weeks = ceil(1562.5) = 1563
  assert.equal(calculateWeeklyDue(20000, 25, 16), 1563);
});

test('getMondayOfWeek correctly finds local Monday without timezone shifts', () => {
  // 2026-10-21 is Wednesday -> Monday is 2026-10-19
  assert.equal(getMondayOfWeek('2026-10-21'), '2026-10-19');
  
  // 2026-10-19 is Monday -> itself
  assert.equal(getMondayOfWeek('2026-10-19'), '2026-10-19');
  
  // 2026-10-25 is Sunday -> should map to Monday 2026-10-19
  assert.equal(getMondayOfWeek('2026-10-25'), '2026-10-19');

  // 2026-06-29 is Monday -> should return 2026-06-29 (verifies D2 bug fix)
  assert.equal(getMondayOfWeek('2026-06-29'), '2026-06-29');
});

test('getWeekDates returns Mon through Sun full 7 days', () => {
  const dates = getWeekDates('2026-10-19');
  assert.equal(dates.length, 7);
  assert.equal(dates[0], '2026-10-19'); // Monday
  assert.equal(dates[1], '2026-10-20'); // Tuesday
  assert.equal(dates[6], '2026-10-25'); // Sunday
});

test('formatCurrency formats Indian number grouping correctly', () => {
  assert.equal(formatCurrency(1000), '₹1,000');
  assert.equal(formatCurrency(120000), '₹1,20,000');
});

test('calculateRemainingBalance tracks short payments and extra payments accurately (Fix D3)', () => {
  const borrower: Borrower = {
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
      { date: '2026-10-12', status: 'short', amtPaid: 600, note: 'Remaining next week' },
    ]
  };

  // Total return: 12,000. Paid: 1000 + 600 = 1600. Remaining must be 12000 - 1600 = 10400.
  // In the old buggy code, short payment counted as a full paid week (1000), so remaining became 10000 instead of 10400!
  const rem = calculateRemainingBalance(borrower);
  assert.equal(rem, 10400);
});
