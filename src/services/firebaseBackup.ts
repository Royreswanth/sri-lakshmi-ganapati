import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  limit,
  deleteDoc,
  writeBatch,
  serverTimestamp,
} from "firebase/firestore";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import firebaseConfig from "../../firebase-applet-config.json";
import { CloudLicenseRecord } from "../types";
import {
  generateBackupPayload,
  restoreBackupPayload,
  BackupPayload,
  STORAGE_KEYS,
  DB,
} from "../utils/storage";
import {
  BLUEPRINT_LIMITS,
  buildSanitizedLedgerMap,
  clampNumber,
  clipString,
  estimateJsonBytes,
  formatGoogleSignInError,
} from "../utils/cloudSyncUtils";
import {
  PaidOrFreePlanId,
  computeExpiryForPlan,
  generateActivationKey,
  isOwnerAdminEmail,
  normalizeDeviceId,
} from "../utils/licenseUtils";
import { isNativeAndroidApk } from "../utils/platformUtils";

// Initialize Firebase App Singleton using exact provisioned config & firestoreDatabaseId
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Validate Firestore connectivity on app startup when online
async function testConnection(): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch {
    // Offline-first fallback: local ledger stays functional without Firestore
  }
}

if (typeof window !== "undefined") {
  void testConnection();
}

export interface GoogleVaultUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  emailVerified: boolean;
}

function mapFirebaseUser(user: User | null): GoogleVaultUser | null {
  if (!user) return null;
  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || user.email || "Lender Account",
    photoURL: user.photoURL || "",
    emailVerified: Boolean(user.emailVerified),
  };
}

export function getCurrentGoogleUser(): GoogleVaultUser | null {
  return mapFirebaseUser(auth.currentUser);
}

export function subscribeAuthState(
  callback: (user: GoogleVaultUser | null) => void
): () => void {
  return onAuthStateChanged(auth, (firebaseUser) => {
    callback(mapFirebaseUser(firebaseUser));
  });
}

export async function signInWithGoogle(): Promise<{
  success: boolean;
  user?: GoogleVaultUser;
  message: string;
  unauthorizedDomain?: string;
}> {
  if (isNativeAndroidApk()) {
    return {
      success: false,
      message:
        "Google popup login works in Chrome web browser only. In Android APK, use Share Backup (Drive / WhatsApp) or JSON Backup/Restore.",
    };
  }
  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await signInWithPopup(auth, provider);
    const mapped = mapFirebaseUser(credential.user);
    if (!mapped || !mapped.emailVerified) {
      return {
        success: false,
        message: "Verified Google account required for cloud backup.",
      };
    }
    return {
      success: true,
      user: mapped,
      message: `Connected ${mapped.email} ✓`,
    };
  } catch (error: any) {
    const hostname =
      typeof window !== "undefined" ? window.location.hostname : "";
    const formatted = formatGoogleSignInError({
      code: error?.code,
      rawMessage: error?.message,
      hostname,
    });
    return {
      success: false,
      message: formatted.message,
      unauthorizedDomain: formatted.unauthorizedDomain,
    };
  }
}

export async function signOutGoogle(): Promise<void> {
  await signOut(auth);
}

export interface CloudBackupRecord {
  backupId: string;
  ownerId: string;
  businessName: string;
  exportedAt: string;
  schemaVersion: number;
  villagesCount: number;
  borrowersCount: number;
  totalLent: number;
  auto: boolean;
  ledger?: Record<string, unknown>;
  dataJson?: string;
}

/**
 * Upload complete LineBook Pro offline ledger to authenticated user's UID-scoped Firestore vault.
 * Uses native Firestore Maps/Lists and an atomic batch covering /users/{uid} + /users/{uid}/backups/{backupId}.
 */
export async function uploadCloudBackup(isAuto = false): Promise<{
  success: boolean;
  needsAuth?: boolean;
  message: string;
  backupId?: string;
  exportedAt?: string;
  borrowersCount?: number;
  villagesCount?: number;
}> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    return {
      success: false,
      needsAuth: true,
      message: "Sign in with Google to enable Cloud Vault sync.",
    };
  }

  const uid = currentUser.uid;
  const userPath = `users/${uid}`;
  const backupId = `bk_${Date.now()}`;
  const backupPath = `users/${uid}/backups/${backupId}`;

  try {
    const payload: BackupPayload = generateBackupPayload();
    const dataObj = (payload.keys[STORAGE_KEYS.DATA] as any) || {
      villages: [],
      borrowers: {},
    };
    const villages = Array.isArray(dataObj.villages) ? dataObj.villages : [];
    const allBorrowers = Object.values(dataObj.borrowers || {}).flat() as any[];
    const totalLentRaw = allBorrowers.reduce((s, b) => s + (Number(b?.loanAmt) || 0), 0);
    const profile = DB.get<any>(STORAGE_KEYS.PROFILE, {});

    const villagesCount = clampNumber(villages.length, 0, BLUEPRINT_LIMITS.MAX_VILLAGES);
    const borrowersCount = clampNumber(allBorrowers.length, 0, BLUEPRINT_LIMITS.MAX_BORROWERS);
    const totalLent = clampNumber(totalLentRaw, 0, BLUEPRINT_LIMITS.MAX_TOTAL_LENT);

    const businessName = clipString(
      profile.businessName,
      BLUEPRINT_LIMITS.BUSINESS_NAME_MAX,
      "LineBook Pro"
    );
    const email = clipString(currentUser.email, BLUEPRINT_LIMITS.EMAIL_MAX, "");
    const displayName = clipString(
      currentUser.displayName,
      BLUEPRINT_LIMITS.DISPLAY_NAME_MAX,
      businessName
    );
    const exportedAt = clipString(
      new Date().toISOString(),
      BLUEPRINT_LIMITS.EXPORTED_AT_MAX
    );

    const ledger = buildSanitizedLedgerMap(payload);
    const docSizeBytes = estimateJsonBytes(ledger);
    if (docSizeBytes > BLUEPRINT_LIMITS.MAX_DOC_BYTES) {
      return {
        success: false,
        message: "Ledger size exceeds single-snapshot cloud limit. Download JSON backup instead.",
      };
    }

    const userDocRef = doc(db, "users", uid);
    let userExists = false;
    try {
      const existingSnap = await getDoc(userDocRef);
      userExists = existingSnap.exists();
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, userPath);
    }

    const batch = writeBatch(db);
    if (userExists) {
      batch.update(userDocRef, {
        email,
        displayName,
        businessName,
        lastBackupId: backupId,
        lastBackupAt: exportedAt,
        villagesCount,
        borrowersCount,
        totalLent,
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.set(userDocRef, {
        ownerId: uid,
        email,
        displayName,
        businessName,
        lastBackupId: backupId,
        lastBackupAt: exportedAt,
        villagesCount,
        borrowersCount,
        totalLent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const backupDocRef = doc(db, "users", uid, "backups", backupId);
    batch.set(backupDocRef, {
      backupId,
      ownerId: uid,
      businessName,
      exportedAt,
      schemaVersion: 3,
      villagesCount,
      borrowersCount,
      totalLent,
      auto: Boolean(isAuto),
      ledger,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, backupPath);
    }

    localStorage.setItem("slg_last_cloud_backup", exportedAt);

    return {
      success: true,
      message: "Cloud backup completed successfully ✓",
      backupId,
      exportedAt,
      borrowersCount,
      villagesCount,
    };
  } catch (error: any) {
    console.error("Cloud Backup Error:", error);
    return {
      success: false,
      message:
        error?.message || "Failed to create cloud backup. Check network connection.",
    };
  }
}

/**
 * Fetch cloud backup snapshots strictly belonging to the signed-in Google user.
 */
export async function getCloudBackupsList(): Promise<CloudBackupRecord[]> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    return [];
  }

  const uid = currentUser.uid;
  const backupsPath = `users/${uid}/backups`;

  try {
    const backupsColRef = collection(db, "users", uid, "backups");
    const q = query(backupsColRef, where("ownerId", "==", uid), limit(30));
    const snapshot = await getDocs(q);

    const list: CloudBackupRecord[] = [];
    snapshot.forEach((d) => {
      list.push(d.data() as CloudBackupRecord);
    });

    return list.sort((a, b) => (b.exportedAt || "").localeCompare(a.exportedAt || ""));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, backupsPath);
  }
}

/**
 * Restore an exact snapshot from Firebase Cloud into localStorage.
 * Supports both native `ledger` Map and legacy `dataJson` payload format.
 */
export async function restoreFromCloudBackup(record: CloudBackupRecord): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    let payload: any;
    if (record.ledger && typeof record.ledger === "object") {
      payload = {
        app: "LineBookPro",
        version: record.schemaVersion || 3,
        exportedAt: record.exportedAt,
        keys: record.ledger,
      };
    } else if (record.dataJson) {
      payload = JSON.parse(record.dataJson);
    } else {
      throw new Error("Backup snapshot data is empty.");
    }

    const result = restoreBackupPayload(payload);
    if (result.success) {
      localStorage.setItem("slg_last_cloud_backup", record.exportedAt);
    }

    return result;
  } catch (error: any) {
    return {
      success: false,
      message: error?.message || "Failed to restore cloud snapshot.",
    };
  }
}

/**
 * Delete a cloud backup snapshot owned by the signed-in Google user.
 */
export async function deleteCloudBackup(backupId: string): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.emailVerified) {
    return false;
  }

  const uid = currentUser.uid;
  const path = `users/${uid}/backups/${backupId}`;

  try {
    const backupDocRef = doc(db, "users", uid, "backups", backupId);
    await deleteDoc(backupDocRef);
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Trigger Auto-Backup in the background ONLY when signed in with Google, online, and non-empty.
 */
export async function checkAndAutoBackup(force = false): Promise<void> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser || !currentUser.emailVerified) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    const isAutoDisabled = localStorage.getItem("slg_auto_cloud_disabled") === "true";
    if (isAutoDisabled && !force) return;

    if (!force) {
      const dataObj = DB.get<any>(STORAGE_KEYS.DATA, { villages: [], borrowers: {} });
      const colsObj = DB.get<any>(STORAGE_KEYS.COLS, {});
      const expArr = DB.get<any[]>(STORAGE_KEYS.EXP, []);
      if (
        (!dataObj.villages || dataObj.villages.length === 0) &&
        Object.keys(colsObj || {}).length === 0 &&
        (!expArr || expArr.length === 0)
      ) {
        return;
      }
    }

    const last = localStorage.getItem("slg_last_cloud_backup");
    const now = Date.now();

    if (!last || force || now - new Date(last).getTime() > 4 * 60 * 60 * 1000) {
      await uploadCloudBackup(true);
    }
  } catch (e) {
    console.warn("Background auto-backup skipped:", e);
  }
}

// ── CLOUD SAAS LICENSING RPCs (/licenses/{licenseId}) ──

/**
 * Check Firestore `/licenses` for any license bound to the signed-in lender's verified Google email.
 * Also supports cross-device recovery when lender moves phones with the same Google account.
 */
export async function checkMyCloudLicense(
  currentDeviceId?: string
): Promise<CloudLicenseRecord | null> {
  const currentUser = auth.currentUser;
  const email = (currentUser?.email || "").trim().toLowerCase();
  if (!currentUser || !currentUser.emailVerified || !email) {
    return null;
  }

  const normDevice = currentDeviceId ? normalizeDeviceId(currentDeviceId) : "";
  try {
    const q = query(
      collection(db, "licenses"),
      where("lenderEmail", "==", email),
      limit(10)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;

    const list: CloudLicenseRecord[] = [];
    snap.forEach((d) => list.push(d.data() as CloudLicenseRecord));

    // If current device record was explicitly revoked, enforce revocation
    if (normDevice) {
      const exactDeviceRevoked = list.find(
        (r) => r.deviceId === normDevice && r.status === "revoked"
      );
      if (exactDeviceRevoked) return exactDeviceRevoked;

      const exactDeviceActive = list.find(
        (r) => r.deviceId === normDevice && r.status === "active"
      );
      if (exactDeviceActive) return exactDeviceActive;
    }

    const activeList = list
      .filter((r) => r.status === "active")
      .sort((a, b) => (b.expiresAt || "").localeCompare(a.expiresAt || ""));
    if (activeList.length > 0) return activeList[0];

    return list[0];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "licenses");
  }
}

/**
 * Owner-Admin only: Provision or renew a lender license in `/licenses/{licenseId}` and
 * automatically generate its cryptographic device-bound Activation Key.
 */
export async function grantOrUpdateCloudLicense(params: {
  deviceId: string;
  lenderEmail?: string;
  businessName: string;
  plan: PaidOrFreePlanId;
  customExpiresAt?: string;
}): Promise<{
  success: boolean;
  message: string;
  license?: CloudLicenseRecord;
}> {
  const currentUser = auth.currentUser;
  if (
    !currentUser ||
    !isOwnerAdminEmail(currentUser.email, currentUser.emailVerified)
  ) {
    return {
      success: false,
      message: "Owner Google Sign-In (reswanth6789@gmail.com) is required.",
    };
  }

  const licenseId = normalizeDeviceId(params.deviceId);
  if (!licenseId || !/^[a-zA-Z0-9_-]{4,64}$/.test(licenseId)) {
    return {
      success: false,
      message: "Invalid Device ID format (example: LBP-A1B2-C3D4).",
    };
  }

  const expiresAt =
    params.customExpiresAt && /^\d{4}-\d{2}-\d{2}$/.test(params.customExpiresAt)
      ? params.customExpiresAt
      : computeExpiryForPlan(params.plan);

  const generated = generateActivationKey(licenseId, params.plan, expiresAt);
  const lenderEmail = clipString(
    (params.lenderEmail || "").trim().toLowerCase(),
    BLUEPRINT_LIMITS.EMAIL_MAX,
    ""
  );
  const businessName = clipString(
    params.businessName,
    BLUEPRINT_LIMITS.BUSINESS_NAME_MAX,
    "LineBook Lender"
  );

  const path = `licenses/${licenseId}`;
  const docRef = doc(db, "licenses", licenseId);

  try {
    let exists = false;
    try {
      const snap = await getDoc(docRef);
      exists = snap.exists();
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }

    if (exists) {
      await updateDoc(docRef, {
        lenderEmail,
        businessName,
        plan: params.plan,
        status: "active",
        expiresAt,
        activationKey: generated.key,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, {
        licenseId,
        deviceId: licenseId,
        lenderEmail,
        businessName,
        plan: params.plan,
        status: "active",
        expiresAt,
        activationKey: generated.key,
        grantedBy: currentUser.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    return {
      success: true,
      message: `Cloud license saved for ${licenseId} ✓`,
      license: {
        licenseId,
        deviceId: licenseId,
        lenderEmail,
        businessName,
        plan: params.plan,
        status: "active",
        expiresAt,
        activationKey: generated.key,
        grantedBy: currentUser.uid,
      },
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Owner-Admin only: Revoke a cloud license immediately.
 */
export async function revokeCloudLicense(licenseId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const currentUser = auth.currentUser;
  if (
    !currentUser ||
    !isOwnerAdminEmail(currentUser.email, currentUser.emailVerified)
  ) {
    return {
      success: false,
      message: "Owner Google Sign-In required.",
    };
  }

  const normId = normalizeDeviceId(licenseId);
  const path = `licenses/${normId}`;
  try {
    await updateDoc(doc(db, "licenses", normId), {
      status: "revoked",
      updatedAt: serverTimestamp(),
    });
    return {
      success: true,
      message: `License ${normId} revoked.`,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Owner-Admin only: List recent provisioned cloud licenses.
 */
export async function fetchAllCloudLicenses(): Promise<CloudLicenseRecord[]> {
  const currentUser = auth.currentUser;
  if (
    !currentUser ||
    !isOwnerAdminEmail(currentUser.email, currentUser.emailVerified)
  ) {
    return [];
  }

  try {
    const q = query(collection(db, "licenses"), limit(50));
    const snap = await getDocs(q);
    const list: CloudLicenseRecord[] = [];
    snap.forEach((d) => list.push(d.data() as CloudLicenseRecord));
    return list.sort((a, b) => (b.expiresAt || "").localeCompare(a.expiresAt || ""));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, "licenses");
  }
}
