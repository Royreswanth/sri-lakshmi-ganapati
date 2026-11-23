import test from "node:test";
import assert from "node:assert/strict";
import { computeOnboardingProgress, isBusinessProfileCustomized } from "./onboardingUtils.ts";
import { DEFAULT_PROFILE } from "./storage.ts";

test("detects uncustomized default profile vs customized commercial lender profile", () => {
  assert.equal(isBusinessProfileCustomized(DEFAULT_PROFILE), false);
  assert.equal(
    isBusinessProfileCustomized({
      ...DEFAULT_PROFILE,
      businessName: "Sri Venkateswara Finance",
    }),
    true
  );
  assert.equal(
    isBusinessProfileCustomized({
      ...DEFAULT_PROFILE,
      phone: "9876543210",
    }),
    true
  );
});

test("computes 0/4 on a fresh lender clean slate", () => {
  const res = computeOnboardingProgress({
    profile: DEFAULT_PROFILE,
    villagesCount: 0,
    borrowersCount: 0,
    hasCloudOrLocalBackup: false,
  });

  assert.equal(res.completedCount, 0);
  assert.equal(res.totalCount, 4);
  assert.equal(res.percentComplete, 0);
  assert.equal(res.allComplete, false);
  assert.equal(res.nextStepId, "profile");
});

test("tracks partial milestones accurately through onboarding journey", () => {
  const afterProfileAndVillage = computeOnboardingProgress({
    profile: { ...DEFAULT_PROFILE, businessName: "Roy Line Finance" },
    villagesCount: 2,
    borrowersCount: 0,
    hasCloudOrLocalBackup: false,
  });

  assert.equal(afterProfileAndVillage.completedCount, 2);
  assert.equal(afterProfileAndVillage.percentComplete, 50);
  assert.equal(afterProfileAndVillage.allComplete, false);
  assert.equal(afterProfileAndVillage.nextStepId, "borrower");
});

test("marks 4/4 allComplete once profile, village, borrower and backup are done", () => {
  const done = computeOnboardingProgress({
    profile: { ...DEFAULT_PROFILE, ownerName: "Ramesh Rao" },
    villagesCount: 1,
    borrowersCount: 3,
    hasCloudOrLocalBackup: true,
  });

  assert.equal(done.completedCount, 4);
  assert.equal(done.percentComplete, 100);
  assert.equal(done.allComplete, true);
  assert.equal(done.nextStepId, null);
});
