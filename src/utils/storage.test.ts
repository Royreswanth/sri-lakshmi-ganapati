import test from "node:test";
import assert from "node:assert/strict";
import { isUntouchedDemoData, clearAllAppData, STORAGE_KEYS } from "./storage";

// Polyfill minimal localStorage for Node unit tests
function installMockLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map<string, string>(Object.entries(initial));
  (globalThis as any).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
    clear: () => store.clear(),
  };
  return store;
}

test("isUntouchedDemoData returns true strictly for exact untouched preview seed", () => {
  const demoData = {
    villages: [
      { id: "v1", name: "Polamuru (పోలమూరు)" },
      { id: "v2", name: "Pippara (పిప్పర)" },
    ],
    borrowers: {
      v1: [
        { id: "b1", name: "వెంకటేశ్వరరావు (Venkateswara Rao)" },
        { id: "b2", name: "నాగమణి (Nagamani)" },
      ],
      v2: [],
    },
  };

  assert.equal(isUntouchedDemoData(demoData, {}, [], [], []), true);
});

test("isUntouchedDemoData returns false if data is already empty", () => {
  assert.equal(
    isUntouchedDemoData({ villages: [], borrowers: {} }, {}, [], [], []),
    false
  );
});

test("isUntouchedDemoData returns false when real user villages, borrowers, or activity exist", () => {
  const baseDemo = {
    villages: [{ id: "v1", name: "Polamuru (పోలమూరు)" }],
    borrowers: {
      v1: [{ id: "b1", name: "వెంకటేశ్వరరావు (Venkateswara Rao)" }],
    },
  };

  // Real village added
  assert.equal(
    isUntouchedDemoData(
      {
        villages: [...baseDemo.villages, { id: "v17000", name: "Attili" }],
        borrowers: baseDemo.borrowers,
      },
      {},
      [],
      [],
      []
    ),
    false
  );

  // Real borrower added
  assert.equal(
    isUntouchedDemoData(
      {
        villages: baseDemo.villages,
        borrowers: { v1: [...baseDemo.borrowers.v1, { id: "b999", name: "Raju" }] },
      },
      {},
      [],
      [],
      []
    ),
    false
  );

  // Collection recorded
  assert.equal(
    isUntouchedDemoData(baseDemo, { "v1_2026-11-20": { totalCollected: 1000 } }, [], [], []),
    false
  );

  // Expense recorded
  assert.equal(
    isUntouchedDemoData(baseDemo, {}, [{ id: 1, amt: 200 }], [], []),
    false
  );
});

test("clearAllAppData clears all financial keys and preserves profile/PIN unless requested", () => {
  const store = installMockLocalStorage({
    [STORAGE_KEYS.DATA]: JSON.stringify({ villages: [{ id: "v1", name: "Test" }], borrowers: {} }),
    [STORAGE_KEYS.COLS]: JSON.stringify({ c1: {} }),
    [STORAGE_KEYS.EXP]: JSON.stringify([{ id: 1 }]),
    [STORAGE_KEYS.NEW_LOANS]: JSON.stringify([{ id: "nl1" }]),
    [STORAGE_KEYS.PERSONAL]: JSON.stringify([{ id: "p1" }]),
    [STORAGE_KEYS.RECEIPTS_SENT]: JSON.stringify({ r1: true }),
    [STORAGE_KEYS.CASH_OPENING]: JSON.stringify({ "2026-11-20": 5000 }),
    [STORAGE_KEYS.PROFILE]: JSON.stringify({ businessName: "Dad Line" }),
    [STORAGE_KEYS.PIN]: JSON.stringify("5678"),
    [STORAGE_KEYS.WHATSAPP_RULES]: JSON.stringify({
      masterEnabled: true,
      autoReceiptOnPayment: false,
      autoTwoDayReminder: true,
      villageConfigs: { v1: { disableReceipt: true } },
      borrowerConfigs: { b1: { hasWhatsApp: false } },
    }),
  });

  clearAllAppData({ includeProfileAndPin: false });

  assert.equal(store.has(STORAGE_KEYS.DATA), false);
  assert.equal(store.has(STORAGE_KEYS.COLS), false);
  assert.equal(store.has(STORAGE_KEYS.EXP), false);
  assert.equal(store.has(STORAGE_KEYS.NEW_LOANS), false);
  assert.equal(store.has(STORAGE_KEYS.PERSONAL), false);
  assert.equal(store.has(STORAGE_KEYS.RECEIPTS_SENT), false);
  assert.equal(store.has(STORAGE_KEYS.CASH_OPENING), false);
  assert.equal(store.has(STORAGE_KEYS.PROFILE), true);
  assert.equal(store.has(STORAGE_KEYS.PIN), true);

  const rules = JSON.parse(store.get(STORAGE_KEYS.WHATSAPP_RULES)!);
  assert.deepEqual(rules.villageConfigs, {});
  assert.deepEqual(rules.borrowerConfigs, {});
  assert.equal(rules.autoReceiptOnPayment, false);

  // Full factory reset clears profile and PIN too
  clearAllAppData({ includeProfileAndPin: true });
  assert.equal(store.has(STORAGE_KEYS.PROFILE), false);
  assert.equal(store.has(STORAGE_KEYS.PIN), false);
});
