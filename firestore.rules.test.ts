import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Pure static & Dirty Dozen security assertion harness for `firestore.rules`.
 * Verifies every invariant defined in `security_spec.md` without external emulator binaries.
 */

const rulesPath = path.resolve(process.cwd(), "firestore.rules");
const blueprintPath = path.resolve(process.cwd(), "firebase-blueprint.json");

const rulesText = fs.readFileSync(rulesPath, "utf8");
const blueprint = JSON.parse(fs.readFileSync(blueprintPath, "utf8"));

test("Phase 1 & 4: firestore.rules starts with rules_version = '2' and default-deny catch-all", () => {
  assert.match(rulesText, /^rules_version\s*=\s*'2';/);
  assert.match(rulesText, /match\s*\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/);
});

test("Dirty Dozen #1 & #2: Verified Google auth (email_verified == true) required everywhere", () => {
  assert.match(rulesText, /function\s+isVerifiedUser\(\)\s*\{\s*return\s+isSignedIn\(\)\s*&&\s*request\.auth\.token\.email_verified\s*==\s*true;/);
  assert.match(rulesText, /function\s+isOwner\(userId\)\s*\{\s*return\s+isVerifiedUser\(\)\s*&&\s*request\.auth\.uid\s*==\s*userId;/);
});

test("Dirty Dozen #3 & #4: Strict PII Isolation and zero blanket listing of /users", () => {
  assert.match(rulesText, /match\s+\/users\/\{userId\}[\s\S]*allow\s+get:\s*if\s+isValidId\(userId\)\s*&&\s*isOwner\(userId\);/);
  assert.match(rulesText, /match\s+\/users\/\{userId\}[\s\S]*allow\s+list:\s*if\s+false;/);
  assert.ok(!/allow\s+(read|get|list):\s*if\s+isSignedIn\(\)\s*;/.test(rulesText));
});

test("Dirty Dozen #5, #6, #7: Ownership hijack, shadow keys, and immutable ownerId/createdAt blocked", () => {
  assert.match(rulesText, /data\.keys\(\)\.hasAll\(/);
  assert.match(rulesText, /data\.keys\(\)\.hasOnly\(/);
  assert.match(rulesText, /incoming\(\)\.ownerId\s*==\s*existing\(\)\.ownerId/);
  assert.match(rulesText, /incoming\(\)\.createdAt\s*==\s*existing\(\)\.createdAt/);
  assert.match(rulesText, /incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\.hasOnly\(/);
});

test("Dirty Dozen #8: Server timestamp request.time strictly enforced on create and update", () => {
  assert.match(rulesText, /incoming\(\)\.createdAt\s*==\s*request\.time/);
  assert.match(rulesText, /incoming\(\)\.updatedAt\s*==\s*request\.time/);
});

test("Dirty Dozen #9 & #10: Path ID regex/size bounds and native Map/List array guards enforced", () => {
  assert.match(rulesText, /function\s+isValidId\(id\)\s*\{\s*return\s+id\s+is\s+string\s*&&\s*id\.size\(\)\s*>=\s*1\s*&&\s*id\.size\(\)\s*<=\s*128\s*&&\s*id\.matches\(/);
  assert.match(rulesText, /ledger\.slg_data\.villages\s+is\s+list/);
  assert.match(rulesText, /ledger\.slg_data\.villages\.size\(\)\s*<=\s*500/);
  assert.match(rulesText, /ledger\.slg_data\.villages\[0\]\s+is\s+map/);
  assert.ok(!rulesText.includes("dataJson"), "Firestore rules must not depend on raw JSON.stringify dataJson blobs");
});

test("Dirty Dozen #11 & #12: Immutable backups, Master Gate existsAfter/getAfter, and Secure List Query", () => {
  assert.match(rulesText, /match\s+\/backups\/\{backupId\}[\s\S]*allow\s+list:\s*if\s+isOwner\(userId\)\s*&&\s*resource\.data\.ownerId\s*==\s*request\.auth\.uid;/);
  assert.match(rulesText, /existsAfter\(\/databases\/\$\(database\)\/documents\/users\/\$\(userId\)\)/);
  assert.match(rulesText, /getAfter\(\/databases\/\$\(database\)\/documents\/users\/\$\(userId\)\)\.data\.ownerId\s*==\s*request\.auth\.uid/);
  assert.match(rulesText, /allow\s+update:\s*if\s+false;/);
});

test("Dirty Dozen #13 & #14: Admin-only /licenses writes with verified email check and owner-email scoped reads", () => {
  assert.match(rulesText, /function\s+isAdmin\(\)\s*\{\s*return\s+isVerifiedUser\(\)\s*&&\s*request\.auth\.token\.email\s*==\s*'reswanth6789@gmail\.com';/);
  assert.match(rulesText, /match\s+\/licenses\/\{licenseId\}[\s\S]*allow\s+create:\s*if\s+isValidId\(licenseId\)\s*&&\s*isAdmin\(\)/);
  assert.match(rulesText, /match\s+\/licenses\/\{licenseId\}[\s\S]*allow\s+update:\s*if\s+isValidId\(licenseId\)\s*&&\s*isAdmin\(\)/);
  assert.match(rulesText, /match\s+\/licenses\/\{licenseId\}[\s\S]*existing\(\)\.lenderEmail\s*!=\s*''\s*&&\s*existing\(\)\.lenderEmail\s*==\s*request\.auth\.token\.email/);
});

test("Blueprint sync check: firebase-blueprint.json paths match /users, /backups, and /licenses", () => {
  assert.ok(blueprint.firestore["/users/{userId}"]);
  assert.ok(blueprint.firestore["/users/{userId}/backups/{backupId}"]);
  assert.ok(blueprint.firestore["/licenses/{licenseId}"]);
  assert.ok(blueprint.entities.UserVaultProfile);
  assert.ok(blueprint.entities.UserVaultBackup);
  assert.ok(blueprint.entities.LicenseGrant);
});
