import test from "node:test";
import assert from "node:assert/strict";
import {
  SUBSCRIPTION_PLANS,
  OWNER_WHATSAPP_NUMBER,
  OWNER_ADMIN_EMAIL,
  applyActivationToProfile,
  buildSubscriptionWhatsAppUrl,
  computeExpiryForPlan,
  evaluateSubscriptionAccess,
  generateActivationKey,
  verifyActivationKey,
} from "./licenseUtils";
import { DEFAULT_PROFILE } from "./storage";

test("Subscription pricing matches ₹1,599 / ₹2,599 / ₹4,999+ and uses +91 9573328444", () => {
  assert.equal(SUBSCRIPTION_PLANS.half_yearly.priceInr, 1599);
  assert.equal(SUBSCRIPTION_PLANS.yearly.priceInr, 2599);
  assert.equal(SUBSCRIPTION_PLANS.custom_app.priceInr, 4999);
  assert.equal(OWNER_WHATSAPP_NUMBER, "919573328444");

  const waUrl = buildSubscriptionWhatsAppUrl({
    plan: "half_yearly",
    deviceId: "LBP-ABCD-1234",
    businessName: "Kaveri Finance",
  });
  assert.ok(waUrl.startsWith("https://wa.me/919573328444?text="));
  assert.ok(decodeURIComponent(waUrl).includes("LBP-ABCD-1234"));
  assert.ok(decodeURIComponent(waUrl).includes("1,599"));
});

test("New unsubscribed installs and expired plans are strictly blocked", () => {
  const locked = evaluateSubscriptionAccess({
    profile: DEFAULT_PROFILE,
    todayStr: "2026-11-21",
  });
  assert.equal(locked.allowed, false);
  assert.equal(locked.reason, "unsubscribed");

  // Legacy 'trial' plan without active paid status must NOT bypass lock
  const legacyTrialBlocked = evaluateSubscriptionAccess({
    profile: { ...DEFAULT_PROFILE, subscriptionPlan: "trial" },
    todayStr: "2026-11-21",
  });
  assert.equal(legacyTrialBlocked.allowed, false);

  // Expired paid subscription must lock cleanly
  const expired = evaluateSubscriptionAccess({
    profile: {
      ...DEFAULT_PROFILE,
      subscriptionPlan: "half_yearly",
      subscriptionStatus: "active",
      subscriptionExpiresAt: "2026-11-20",
    },
    todayStr: "2026-11-21",
  });
  assert.equal(expired.allowed, false);
  assert.equal(expired.reason, "expired");
});

test("Device-bound activation keys validate matching device only and reject tampering or expiry", () => {
  const deviceA = "LBP-7X9K-2M4P";
  const deviceB = "LBP-ZZZZ-9999";
  const expiry = computeExpiryForPlan("half_yearly", "2026-11-21");
  assert.equal(expiry, "2027-05-20");

  const { key } = generateActivationKey(deviceA, "half_yearly", expiry);
  const okRes = verifyActivationKey(key, deviceA, "2026-11-21");
  assert.equal(okRes.valid, true);
  assert.equal(okRes.plan, "half_yearly");
  assert.equal(okRes.expiresAt, "2027-05-20");

  // Key copied to a different device must fail
  const wrongDevice = verifyActivationKey(key, deviceB, "2026-11-21");
  assert.equal(wrongDevice.valid, false);

  // Expired check
  const expiredCheck = verifyActivationKey(key, deviceA, "2027-05-21");
  assert.equal(expiredCheck.valid, false);

  // Tampering 1 char fails signature
  const tampered = `${key.slice(0, -1)}${key.endsWith("A") ? "B" : "A"}`;
  assert.equal(verifyActivationKey(tampered, deviceA, "2026-11-21").valid, false);

  // Applying verified activation unlocks profile
  const activatedProfile = applyActivationToProfile(DEFAULT_PROFILE, {
    plan: okRes.plan!,
    expiresAt: okRes.expiresAt!,
    licenseKey: key,
    deviceId: deviceA,
    activatedBy: "activation_key",
  });
  const activeEval = evaluateSubscriptionAccess({
    profile: activatedProfile,
    todayStr: "2026-11-21",
  });
  assert.equal(activeEval.allowed, true);
  assert.equal(activeEval.reason, "active");
});

test("Dad Lifetime Free Pass and Owner Admin Google email always grant access", () => {
  const { key } = generateActivationKey("LBP-DAD1-FREE", "lifetime_free");
  const verified = verifyActivationKey(key, "LBP-DAD1-FREE", "2035-01-01");
  assert.equal(verified.valid, true);
  assert.equal(verified.plan, "lifetime_free");

  const dadProfile = applyActivationToProfile(DEFAULT_PROFILE, {
    plan: "lifetime_free",
    expiresAt: verified.expiresAt!,
    licenseKey: key,
    deviceId: "LBP-DAD1-FREE",
    activatedBy: "legacy_family",
  });
  assert.equal(
    evaluateSubscriptionAccess({ profile: dadProfile, todayStr: "2035-01-01" }).allowed,
    true
  );

  // Owner Admin bypass when signed in with verified admin Google account
  const ownerAccess = evaluateSubscriptionAccess({
    profile: DEFAULT_PROFILE,
    userEmail: OWNER_ADMIN_EMAIL,
    emailVerified: true,
    todayStr: "2026-11-21",
  });
  assert.equal(ownerAccess.allowed, true);
  assert.equal(ownerAccess.reason, "owner_admin");
  assert.equal(ownerAccess.isOwner, true);
});
