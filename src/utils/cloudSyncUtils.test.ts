import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_LEDGER_KEYS,
  BLUEPRINT_LIMITS,
  buildSanitizedLedgerMap,
  clampNumber,
  clipString,
  estimateJsonBytes,
  sanitizeForFirestore,
} from "./cloudSyncUtils";
import type { BackupPayload } from "./storage";

test("sanitizeForFirestore strips undefined keys and non-finite numbers cleanly", () => {
  const dirty = {
    name: "Polamuru",
    optionalPhone: undefined,
    amt: Infinity,
    nested: { a: 1, b: undefined },
    items: [1, undefined, { x: "ok", y: undefined }],
  };

  const clean = sanitizeForFirestore(dirty);
  assert.deepEqual(clean, {
    name: "Polamuru",
    amt: 0,
    nested: { a: 1 },
    items: [1, { x: "ok" }],
  });
});

test("buildSanitizedLedgerMap emits strictly allowed native Firestore maps/lists and drops invalid pins", () => {
  const payload: BackupPayload = {
    app: "LineBookPro",
    version: 3,
    exportedAt: "2026-10-17T10:00:00.000Z",
    keys: {
      slg_data: {
        villages: [{ id: "v1", name: "Polamuru", day: "Monday" }],
        borrowers: { v1: [{ id: "b1", name: "Rao", loanAmt: 10000, guarantorName: undefined }] },
      },
      slg_pin: "12345", // invalid 5-digit legacy PIN -> should be omitted from cloud doc rather than causing rules failure
      slg_lang: "te",
      slg_theme: "dark",
      slg_exp: [{ id: 1, amt: 200, desc: "Fuel", cat: "fuel", date: "2026-10-17" }],
      unknownShadowKey: { hack: true },
    },
  };

  const ledger = buildSanitizedLedgerMap(payload);
  for (const key of Object.keys(ledger)) {
    assert.ok((ALLOWED_LEDGER_KEYS as readonly string[]).includes(key), `Unexpected key: ${key}`);
  }
  assert.equal("slg_pin" in ledger, false);
  assert.equal("unknownShadowKey" in ledger, false);
  assert.equal((ledger.slg_data as any).villages.length, 1);
  assert.equal("guarantorName" in (ledger.slg_data as any).borrowers.v1[0], false);
  assert.equal(ledger.slg_lang, "te");
  assert.equal(ledger.slg_theme, "dark");
});

test("clipString and clampNumber enforce blueprint max lengths and numeric boundaries", () => {
  const longName = "A".repeat(250);
  assert.equal(clipString(longName, BLUEPRINT_LIMITS.BUSINESS_NAME_MAX).length, 120);
  assert.equal(clampNumber(-5, 0, BLUEPRINT_LIMITS.MAX_VILLAGES), 0);
  assert.equal(clampNumber(9999, 0, BLUEPRINT_LIMITS.MAX_VILLAGES), 500);
  assert.ok(estimateJsonBytes({ hello: "world" }) > 10);
});
