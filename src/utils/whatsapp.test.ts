import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWhatsAppReceiptText,
  buildAdvanceReminderText,
  getTwoDayAdvanceInfo,
  normalizePhoneNumber,
  getWhatsAppUrl,
  isBorrowerKeypad,
  isBorrowerReceiptDisabled,
  canAutoSendReceipt,
} from "./whatsapp.ts";
import { Borrower, Village } from "../types.ts";

test("normalizePhoneNumber normalizes Indian 10-digit, 0-prefixed and 91-prefixed numbers", () => {
  assert.equal(normalizePhoneNumber("9876543210"), "9876543210");
  assert.equal(normalizePhoneNumber("09876543210"), "9876543210");
  assert.equal(normalizePhoneNumber("+91 98765 43210"), "9876543210");
  assert.equal(normalizePhoneNumber("919876543210"), "9876543210");
});

test("getWhatsAppUrl formats direct wa.me link with phone number and text", () => {
  const url = getWhatsAppUrl("9876543210", "Hello Telugu");
  assert.ok(url.startsWith("https://wa.me/919876543210?text="));
  assert.ok(url.includes("Hello%20Telugu"));
});

test("buildWhatsAppReceiptText formats Telugu receipt with exact payment and balance", () => {
  const borrower: Borrower = {
    id: "b1",
    seqNo: "5",
    name: "వెంకటేశ్వరరావు",
    phone: "9876543210",
    loanAmt: 10000,
    durationWeeks: 12,
    interestPct: 20,
    weeklyDue: 1000,
    totalReturn: 12000,
    weeksPaid: 4,
    startDate: "2026-10-01",
    history: [],
  };

  const text = buildWhatsAppReceiptText({
    borrower,
    amtPaid: 1000,
    status: "paid",
    dateStr: "2026-11-03",
    villageName: "పోలమూరు",
    businessName: "శ్రీ లక్ష్మీ గణపతి ఫైనాన్స్",
    payMethod: "cash",
    remainingBal: 8000,
    lang: "te",
  });

  assert.ok(text.includes("శ్రీ లక్ష్మీ గణపతి ఫైనాన్స్"));
  assert.ok(text.includes("వారం వాయిదా చెల్లింపు రశీదు"));
  assert.ok(text.includes("వెంకటేశ్వరరావు (#5)"));
  assert.ok(text.includes("పోలమూరు"));
  assert.ok(text.includes("Wk 4 / 12"));
  assert.ok(text.includes("₹1,000"));
  assert.ok(text.includes("నగదు (Cash in Hand)"));
  assert.ok(text.includes("₹8,000"));
});

test("buildAdvanceReminderText formats 2-day reminder with due amount and remaining balance", () => {
  const borrower: Borrower = {
    id: "b1",
    seqNo: "1",
    name: "నాగమణి",
    phone: "9848012345",
    loanAmt: 15000,
    durationWeeks: 12,
    interestPct: 20,
    weeklyDue: 1500,
    totalReturn: 18000,
    weeksPaid: 2,
    startDate: "2026-10-01",
    history: [],
  };

  const text = buildAdvanceReminderText({
    borrower,
    villageName: "పిప్పర",
    visitDate: "2026-11-05",
    businessName: "శ్రీ లక్ష్మీ గణపతి ఫైనాన్స్",
    remainingBal: 15000,
    lang: "te",
  });

  assert.ok(text.includes("నాగమణి"));
  assert.ok(text.includes("పిప్పర"));
  assert.ok(text.includes("Wk 3 / 12"));
  assert.ok(text.includes("₹1,500"));
  assert.ok(text.includes("₹15,000"));
});

test("getTwoDayAdvanceInfo correctly maps Saturday to Monday collections", () => {
  const villages: Village[] = [
    { id: "v1", name: "Polamuru", day: "Monday" },
    { id: "v2", name: "Pippara", day: "Tuesday" },
  ];

  // Saturday: 2026-11-07
  const saturday = new Date(2026, 10, 7, 12, 0, 0);
  const info = getTwoDayAdvanceInfo(villages, saturday);

  assert.equal(info.isTwoDaysAhead, true);
  assert.equal(info.targetDayName, "Monday");
  assert.equal(info.matchingVillages.length, 1);
  assert.equal(info.matchingVillages[0].name, "Polamuru");
});

test("getTwoDayAdvanceInfo correctly maps Sunday to Tuesday collections", () => {
  const villages: Village[] = [
    { id: "v1", name: "Polamuru", day: "Monday" },
    { id: "v2", name: "Pippara", day: "Tuesday" },
  ];

  // Sunday: 2026-11-08
  const sunday = new Date(2026, 10, 8, 12, 0, 0);
  const info = getTwoDayAdvanceInfo(villages, sunday);

  assert.equal(info.isTwoDaysAhead, true);
  assert.equal(info.targetDayName, "Tuesday");
  assert.equal(info.matchingVillages.length, 1);
  assert.equal(info.matchingVillages[0].name, "Pippara");
});

test("isBorrowerKeypad and canAutoSendReceipt respect keypad mobile and rules", () => {
  const smartphoneBorrower: Borrower = {
    id: "b1",
    seqNo: "1",
    name: "Roy",
    phone: "9876543210",
    loanAmt: 10000,
    durationWeeks: 12,
    interestPct: 20,
    weeklyDue: 1000,
    totalReturn: 12000,
    weeksPaid: 0,
    startDate: "2026-11-01",
    history: [],
    hasWhatsApp: true,
  };

  const keypadBorrower: Borrower = {
    ...smartphoneBorrower,
    id: "b2",
    hasWhatsApp: false,
  };

  const defaultRules = {
    masterEnabled: true,
    autoReceiptOnPayment: true,
    autoTwoDayReminder: true,
    borrowerConfigs: {},
    villageConfigs: {},
  };

  assert.equal(isBorrowerKeypad(smartphoneBorrower, defaultRules), false);
  assert.equal(isBorrowerKeypad(keypadBorrower, defaultRules), true);

  assert.equal(canAutoSendReceipt(smartphoneBorrower, "v1", defaultRules), true);
  assert.equal(canAutoSendReceipt(keypadBorrower, "v1", defaultRules), false);

  // Muted village
  const villageMutedRules = {
    ...defaultRules,
    villageConfigs: { v1: { disableReceipt: true } },
  };
  assert.equal(canAutoSendReceipt(smartphoneBorrower, "v1", villageMutedRules), false);

  // Muted good payer borrower
  const borrowerMutedRules = {
    ...defaultRules,
    borrowerConfigs: { b1: { hasWhatsApp: true, disableReceipt: true } },
  };
  assert.equal(canAutoSendReceipt(smartphoneBorrower, "v1", borrowerMutedRules), false);
});

test("strictly blocks canAutoSendReceipt when receipt option is disabled in borrower profile even if general WhatsApp is fully enabled", () => {
  const generalWhatsAppEnabledRules = {
    masterEnabled: true,
    autoReceiptOnPayment: true,
    autoTwoDayReminder: true,
    borrowerConfigs: {},
    villageConfigs: {},
  };

  // 1. Borrower has disableReceipt: true on profile
  const profileDisabledBorrower: Borrower = {
    id: "b_muted",
    seqNo: "10",
    name: "Muted Borrower",
    phone: "9876543210",
    loanAmt: 10000,
    durationWeeks: 12,
    interestPct: 20,
    weeklyDue: 1000,
    totalReturn: 12000,
    weeksPaid: 2,
    startDate: "2026-11-01",
    history: [],
    hasWhatsApp: true,
    disableReceipt: true, // disabled in borrower profile!
  };

  // Must strictly evaluate to true for disabled
  assert.equal(isBorrowerReceiptDisabled(profileDisabledBorrower, "v1", generalWhatsAppEnabledRules), true);

  // Must strictly block dispatch even with masterEnabled & autoReceiptOnPayment
  assert.equal(canAutoSendReceipt(profileDisabledBorrower, "v1", generalWhatsAppEnabledRules), false);

  // 2. Borrower has disableReceipt: false on profile -> allowed
  const normalBorrower: Borrower = {
    ...profileDisabledBorrower,
    id: "b_normal",
    disableReceipt: false,
  };

  assert.equal(isBorrowerReceiptDisabled(normalBorrower, "v1", generalWhatsAppEnabledRules), false);
  assert.equal(canAutoSendReceipt(normalBorrower, "v1", generalWhatsAppEnabledRules), true);

  // 3. String representation truthiness test
  const stringTruthyBorrower: Borrower = {
    ...profileDisabledBorrower,
    id: "b_string_truthy",
    disableReceipt: ("true" as unknown) as boolean,
  };
  assert.equal(isBorrowerReceiptDisabled(stringTruthyBorrower, "v1", generalWhatsAppEnabledRules), true);
  assert.equal(canAutoSendReceipt(stringTruthyBorrower, "v1", generalWhatsAppEnabledRules), false);
});
