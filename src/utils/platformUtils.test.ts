import test from "node:test";
import assert from "node:assert/strict";
import {
  authenticateNativeBiometric,
  checkNativeBiometricAvailability,
  isNativeAndroidApk,
  sanitizeExportFilename,
} from "./platformUtils";

test("isNativeAndroidApk returns false cleanly inside Node / standard browser runtime", () => {
  assert.equal(isNativeAndroidApk(), false);
});

test("native biometric helpers safely fail closed outside Android APK", async () => {
  const avail = await checkNativeBiometricAvailability();
  assert.equal(avail.available, false);
  assert.equal(avail.status, "NOT_AVAILABLE");

  const auth = await authenticateNativeBiometric({
    title: "LineBook Pro",
    subtitle: "Unlock",
    negativeButtonText: "Use PIN",
  });
  assert.equal(auth.verified, false);
  assert.equal(auth.code, "NOT_AVAILABLE");
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
