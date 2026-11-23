import test from "node:test";
import assert from "node:assert/strict";
import { isNativeAndroidApk, sanitizeExportFilename } from "./platformUtils";

test("isNativeAndroidApk returns false cleanly inside Node / standard browser runtime", () => {
  assert.equal(isNativeAndroidApk(), false);
});

test("sanitizeExportFilename strips path traversal and illegal filesystem characters", () => {
  assert.equal(
    sanitizeExportFilename("../../etc/passwd?name=Line:Book.json"),
    "._._etc_passwd_name=Line_Book.json"
  );
  assert.equal(
    sanitizeExportFilename("LineBookPro_Backup_2026-11-21.json"),
    "LineBookPro_Backup_2026-11-21.json"
  );
  assert.equal(sanitizeExportFilename("   ", "fallback.csv"), "fallback.csv");
});
